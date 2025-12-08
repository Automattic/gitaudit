import { randomUUID } from 'crypto';
import { z } from 'zod';
import { repoQueries, jobQueries, userQueries } from '../db/queries.js';

// Job handlers with schemas
import { issueFetchHandler, issueFetchSchema } from './jobs/issue-fetch.js';
import { prFetchHandler, prFetchSchema } from './jobs/pr-fetch.js';
import { sentimentHandler, sentimentSchema } from './jobs/sentiment.js';
import { singleIssueRefreshHandler, singleIssueRefreshSchema } from './jobs/single-issue-refresh.js';
import { singlePRRefreshHandler, singlePRRefreshSchema } from './jobs/single-pr-refresh.js';

// Job queue configuration
const MAX_CONCURRENT_REPOS = 5;

// Job runner state
let jobRunnerActive = false;

/**
 * Trigger the job loop to process pending jobs
 * This is the single place where we trigger job processing
 */
function triggerJobLoop() {
  setImmediate(() => runJobLoop());
}

/**
 * Generic job queueing function
 * Handles DB insertion and triggers processing
 * @returns {boolean} true if job was queued, false if duplicate
 */
export function queueJob({ type, repoId, userId, args = {}, priority = 50 }) {
  const argsJson = JSON.stringify(args);

  // Check if an identical job is already pending or processing
  const existingJob = jobQueries.findDuplicateJob.get(type, repoId, argsJson);
  if (existingJob) {
    console.log(`[JobQueue] Duplicate job already queued: ${type} for repo ${repoId}, skipping`);
    return false;
  }

  // Generate unique job ID
  const jobId = randomUUID();

  try {
    jobQueries.insert.run(
      jobId,
      type,
      repoId,
      userId,
      argsJson,
      'pending',
      priority
    );
    console.log(`[JobQueue] Queued: ${type} for repo ${repoId} (${jobId})`);
    triggerJobLoop();
    return true;
  } catch (error) {
    console.error(`[JobQueue] Failed to queue job: ${error.message}`);
    throw error;
  }
}

/**
 * Job runner - event-driven loop that starts jobs up to capacity
 * Exits when at capacity or no jobs available
 * Retriggered by job completion or new job queuing
 */
async function runJobLoop() {
  // Prevent multiple concurrent loops
  if (jobRunnerActive) {
    return;
  }

  jobRunnerActive = true;

  try {
    // Keep trying to start jobs until we hit capacity or run out of jobs
    while (true) {
      // Get currently processing jobs
      const processingJobs = jobQueries.findProcessingJobs.all();

      // Check if we're at max capacity
      if (processingJobs.length >= MAX_CONCURRENT_REPOS) {
        console.log(`[JobQueue] At capacity (${processingJobs.length}/${MAX_CONCURRENT_REPOS}), waiting for jobs to complete`);
        break;
      }

      // Get repo IDs currently being processed
      const processingRepoIds = processingJobs.map(j => j.repo_id);

      // Find next pending job (excluding repos currently processing)
      const job = jobQueries.findNextPendingJob(processingRepoIds);

      if (!job) {
        // No more jobs available
        if (processingJobs.length === 0) {
          console.log('[JobQueue] No pending or processing jobs, loop idle');
        } else {
          console.log(`[JobQueue] No pending jobs, ${processingJobs.length} job(s) still processing`);
        }
        break;
      }

      // Mark job as processing in database
      try {
        jobQueries.updateStarted.run(job.job_id);
      } catch (error) {
        console.error(`[JobQueue] Failed to mark job ${job.job_id} as processing:`, error.message);
        break;
      }

      // Update repo status to in_progress
      try {
        repoQueries.updateStatus.run('in_progress', job.repo_id);
      } catch (error) {
        console.error(`[JobQueue] Failed to update repo status to in_progress:`, error.message);
      }

      console.log(`[JobQueue] Starting: ${job.type} for repo ${job.repo_id}`);

      // Process the job asynchronously (don't await - run in parallel)
      processJob(job);
    }
  } catch (error) {
    console.error('[JobQueue] Error in job loop:', error);
  } finally {
    jobRunnerActive = false;
  }
}

/**
 * Job handler dispatch map with schemas
 */
const jobHandlers = {
  'issue-fetch': { handler: issueFetchHandler, schema: issueFetchSchema },
  'pr-fetch': { handler: prFetchHandler, schema: prFetchSchema },
  'sentiment': { handler: sentimentHandler, schema: sentimentSchema },
  'single-issue-refresh': { handler: singleIssueRefreshHandler, schema: singleIssueRefreshSchema },
  'single-pr-refresh': { handler: singlePRRefreshHandler, schema: singlePRRefreshSchema },
};

/**
 * Enrich job args with derived data from database
 * Parses args JSON, fetches user for accessToken, fetches repo for owner/name
 * @param {object} job - Job from database
 * @returns {object} Enriched args with repoId, userId, accessToken, owner, repoName
 */
function enrichJobArgs(job) {
  // Parse args JSON
  const args = job.args ? JSON.parse(job.args) : {};

  // Get user for access token
  const user = userQueries.findById.get(job.user_id);
  if (!user) {
    throw new Error(`User not found for job ${job.job_id}`);
  }

  // Get repo for owner/name
  const repo = repoQueries.getById.get(job.repo_id);
  if (!repo) {
    throw new Error(`Repository not found for job ${job.job_id}`);
  }

  // Return enriched args
  return {
    ...args,
    repoId: job.repo_id,
    userId: job.user_id,
    accessToken: user.access_token,
    owner: repo.owner,
    repoName: repo.name,
  };
}

/**
 * Process a single job by dispatching to the appropriate handler
 * Request-level retries are handled within the API call layer
 */
async function processJob(job) {
  try {
    const handlerConfig = jobHandlers[job.type];
    if (!handlerConfig) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Enrich and validate
    const enrichedArgs = enrichJobArgs(job);
    const validationResult = handlerConfig.schema.safeParse(enrichedArgs);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten();
      throw new Error(`Invalid args: ${JSON.stringify(errors.fieldErrors)}`);
    }

    // Call handler with validated, enriched args
    await handlerConfig.handler(enrichedArgs);

    console.log(`[JobQueue] ✓ Completed job: ${job.type} for repo ${job.repo_id}`);

    // Mark job as completed in database
    try {
      jobQueries.updateCompleted.run(job.job_id);
    } catch (error) {
      console.error(`[JobQueue] Failed to mark job ${job.job_id} as completed:`, error.message);
    }

    // Generic repo status update on success
    try {
      repoQueries.updateStatus.run('completed', job.repo_id);
    } catch (error) {
      console.error(`[JobQueue] Failed to update repo status to completed:`, error.message);
    }
  } catch (error) {
    console.error(
      `[JobQueue] ✗ Job failed: ${job.type} for repo ${job.repo_id}`,
      error.message || error
    );

    // Mark job as failed in database
    try {
      jobQueries.updateFailed.run(error.message || String(error), job.job_id);
    } catch (dbError) {
      console.error(`[JobQueue] Failed to mark job ${job.job_id} as failed:`, dbError.message);
    }

    // Generic repo status update on failure
    try {
      repoQueries.updateStatus.run('failed', job.repo_id);
    } catch (dbError) {
      console.error(`[JobQueue] Failed to update repo status to failed:`, dbError.message);
    }
  } finally {
    // Job completed (success or failure) - trigger loop to process next job
    triggerJobLoop();
  }
}

/**
 * Initialize the job runner on server startup
 * Resets stuck jobs and starts processing if there are pending jobs
 */
export function startJobRunner() {
  console.log('[JobQueue] Initializing job runner...');

  try {
    // Find jobs that were processing when server stopped (mark them as pending)
    const processingJobs = jobQueries.findProcessingJobs.all();
    if (processingJobs.length > 0) {
      console.log(`[JobQueue] Found ${processingJobs.length} jobs stuck in 'processing' state, resetting to pending`);
      for (const job of processingJobs) {
        jobQueries.updateStatus.run('pending', job.job_id);
      }
    }

    // Count pending jobs
    const pendingJobs = jobQueries.findPendingJobs.all();
    console.log(`[JobQueue] Found ${pendingJobs.length} pending job(s)`);

    // Clean up old completed/failed jobs (older than 7 days)
    const cleanupResult = jobQueries.deleteOldCompleted.run();
    if (cleanupResult.changes > 0) {
      console.log(`[JobQueue] Cleaned up ${cleanupResult.changes} old completed/failed job(s)`);
    }

    // Trigger job loop if there are pending jobs
    if (pendingJobs.length > 0) {
      console.log('[JobQueue] ✓ Job runner initialized, starting event loop');
      triggerJobLoop();
    } else {
      console.log('[JobQueue] ✓ Job runner initialized (no pending jobs)');
    }
  } catch (error) {
    console.error('[JobQueue] Failed to initialize job runner:', error);
    // Don't throw - allow server to start even if initialization fails
  }
}

/**
 * Get queue status from database
 */
export function getQueueStatus() {
  const stats = jobQueries.countByStatus.all();
  const statusMap = Object.fromEntries(stats.map(s => [s.status, s.count]));

  return {
    queueLength: statusMap.pending || 0,
    processingCount: statusMap.processing || 0,
    completedCount: statusMap.completed || 0,
    failedCount: statusMap.failed || 0,
    maxConcurrent: MAX_CONCURRENT_REPOS,
  };
}

/**
 * Get the current job type being processed for a specific repo
 * Returns 'issue-fetch', 'sentiment', or null
 */
export function getCurrentJobForRepo(repoId) {
  const processingJobs = jobQueries.findProcessingJobs.all();
  const job = processingJobs.find(j => j.repo_id === repoId);
  return job ? job.type : null;
}
