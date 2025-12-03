import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { searchGitHubRepositories, fetchUserRepositories } from '../services/github.js';
import { repoQueries } from '../db/queries.js';

const router = express.Router();

// Get user's SAVED repositories (from database)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const repos = repoQueries.findAllByUser.all(req.user.id);

    // Format response
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      fullName: `${repo.owner}/${repo.name}`,
      description: repo.description,
      stars: repo.stars,
      language: repo.language,
      languageColor: repo.language_color,
      updatedAt: repo.updated_at,
      isPrivate: Boolean(repo.is_private),
    }));

    res.json({ repos: formattedRepos });
  } catch (error) {
    console.error('Error fetching saved repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get user's accessible repositories from GitHub (for browsing)
router.get('/browse', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;

    // Fetch user's repositories from GitHub
    const result = await fetchUserRepositories(req.user.accessToken, limit);

    res.json({ repos: result.nodes });
  } catch (error) {
    console.error('Error fetching accessible repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Search GitHub for repositories
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 3) {
      return res.status(400).json({ error: 'Search query must be at least 3 characters' });
    }

    // Call GitHub search API
    const results = await searchGitHubRepositories(req.user.accessToken, q);

    res.json({ repos: results });
  } catch (error) {
    console.error('Error searching repositories:', error);
    res.status(500).json({ error: 'Failed to search repositories' });
  }
});

// Save a repository to user's list
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { owner, name, githubId, description, stars, language, languageColor, updatedAt, isPrivate } = req.body;

    if (!owner || !name || !githubId) {
      return res.status(400).json({ error: 'Missing required fields: owner, name, githubId' });
    }

    const repo = repoQueries.saveRepo.get(
      req.user.id,
      owner,
      name,
      githubId,
      description || null,
      stars || 0,
      language || null,
      languageColor || null,
      updatedAt || null,
      isPrivate ? 1 : 0
    );

    res.json({ repo });
  } catch (error) {
    console.error('Error saving repository:', error);
    res.status(500).json({ error: 'Failed to save repository' });
  }
});

// Remove a saved repository
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    repoQueries.deleteByUserAndId.run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting repository:', error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

export default router;
