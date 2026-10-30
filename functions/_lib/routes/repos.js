import {
  authenticate,
  githubToken,
  requireRepositoryAccess,
  requireRepositoryAdmin,
  resolveRole,
} from '../auth.js';
import {
  fetchRepositoryPermission,
  fetchUserRepositories,
  searchRepositories,
} from '../github.js';
import { HttpError, json, readJson } from '../http.js';
import {
  createLocalRepo,
  deleteRepo,
  findRepo,
  findReposForUser,
  saveGithubRepo,
  updateLocalRepo,
} from '../queries.js';

const toIso = (ms) => (ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString());

const formatRepo = (repo) => ({
  id: repo.id,
  name: repo.name,
  owner: repo.owner,
  fullName: `${repo.owner}/${repo.name}`,
  description: repo.description,
  stars: Number(repo.stars),
  language: repo.language,
  languageColor: repo.language_color,
  updatedAt: toIso(repo.updated_at),
  isPrivate: Boolean(Number(repo.is_private)),
  isGithub: Boolean(Number(repo.is_github)),
  url: repo.url || null,
});

export function repoRoutes(router) {
  // Get user's SAVED repositories (from database)
  router.get('/api/repos', authenticate, async ({ db, user }) =>
    json({ repos: (await findReposForUser(db, user.id)).map(formatRepo) })
  );

  // Get user's accessible repositories from GitHub (for browsing)
  router.get('/api/repos/browse', authenticate, async (context) => {
    const limit = parseInt(context.query.get('limit')) || 12;
    return json({ repos: await fetchUserRepositories(await githubToken(context), limit) });
  });

  // Search GitHub for repositories
  router.get('/api/repos/search', authenticate, async (context) => {
    const q = context.query.get('q');

    if (!q || q.length < 3) {
      throw new HttpError(400, 'Search query must be at least 3 characters');
    }

    return json({ repos: await searchRepositories(await githubToken(context), q) });
  });

  // Save a repository to user's list
  router.post('/api/repos/save', authenticate, async (context) => {
    const { db, request, user } = context;
    const { owner, name, githubId, description, stars, language, languageColor, updatedAt, isPrivate } =
      await readJson(request);

    if (!owner || !name || !githubId) {
      throw new HttpError(400, 'Missing required fields: owner, name, githubId');
    }

    // Check GitHub permission to determine role, denying admin if GitHub can't say
    const permission = await fetchRepositoryPermission(await githubToken(context), owner, name).catch(
      () => null
    );
    const role = permission === 'ADMIN' ? 'admin' : 'member';

    const repo = await saveGithubRepo(
      db,
      {
        owner,
        name,
        githubId,
        description: description || null,
        stars: stars || 0,
        language: language || null,
        languageColor: languageColor || null,
        updatedAt: updatedAt ? Date.parse(updatedAt) : null,
        isPrivate: isPrivate ? 1 : 0,
      },
      user.id,
      role,
      Date.now()
    );

    return json({ repo: formatRepo(repo), role });
  });

  // Create a local (non-GitHub) repository
  router.post('/api/repos/local', authenticate, async ({ db, request, user }) => {
    const { name, url, description } = await readJson(request);

    if (!name || !url) {
      throw new HttpError(400, 'Missing required fields: name, url');
    }

    // Use the authenticated user's username as the owner for URL routing consistency
    const repo = await createLocalRepo(
      db,
      { owner: user.username, name, description: description || null, url },
      user.id
    );

    return json({ repo: formatRepo(repo), role: 'admin' });
  });

  // Update a custom (non-GitHub) repository's info
  router.patch('/api/repos/:owner/:repo', authenticate, requireRepositoryAdmin, async ({ db, request, repo }) => {
    const { url, description } = await readJson(request);

    // Only allow updates to non-GitHub repos
    if (Number(repo.is_github)) {
      throw new HttpError(400, 'Cannot update GitHub repository info. Repository data is synced from GitHub.');
    }

    // Validate URL is not empty (use provided url, or fall back to existing)
    const finalUrl = url !== undefined ? url : repo.url;
    if (!finalUrl || finalUrl.trim() === '') {
      throw new HttpError(400, 'Repository URL is required');
    }

    await updateLocalRepo(db, repo.id, url ?? repo.url, description ?? repo.description);
    return json({ repo: formatRepo(await findRepo(db, repo.owner, repo.name)) });
  });

  // Check user's permission level for a repository
  router.get('/api/repos/:owner/:repo/permission', authenticate, requireRepositoryAccess, async (context) => {
    const { repo } = context;
    const role = await resolveRole(context, repo);

    if (role === null) {
      throw new HttpError(403, 'Access denied', {
        message: 'You no longer have access to this repository',
      });
    }

    const isAdmin = role === 'admin';

    return json({
      permission: isAdmin ? 'ADMIN' : 'READ',
      role,
      isAdmin,
      isGithub: Boolean(Number(repo.is_github)),
      lastSynced: toIso(repo.last_synced),
    });
  });

  // Full repository deletion (admin only)
  // Deletes the repository and all associated data (metrics, data points, collaborators)
  router.delete('/api/repos/:owner/:repo/full', authenticate, requireRepositoryAdmin, async ({ db, repo }) => {
    await deleteRepo(db, repo.id);
    return json({ success: true, message: 'Repository and all associated data deleted' });
  });
}
