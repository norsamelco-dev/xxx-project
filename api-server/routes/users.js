const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  USER_ROLES,
  listUsers,
  findExistingUsername,
  createUser,
  updateUser,
  deleteUser,
  findUserById,
  passwordsMatch,
} = require('../services/userService');

const router = express.Router();

router.use(requireAuth);

router.use((request, response, next) => {
  if (request.session?.user?.role !== 'Admin') {
    return response.status(403).json({
      error: 'Admin access is required for user management.',
    });
  }

  return next();
});

router.get('/', async (_request, response) => {
  try {
    const data = await listUsers();
    response.json({ data, roles: USER_ROLES });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

router.get('/username-exists', async (request, response) => {
  try {
    const username = String(request.query.username || '').trim();
    const excludeId = Number(request.query.excludeId);
    const normalizedExcludeId = Number.isInteger(excludeId) && excludeId > 0 ? excludeId : null;

    if (!username) {
      return response.status(400).json({ error: 'Username is required.' });
    }

    const existing = await findExistingUsername(username, normalizedExcludeId);
    response.json({ exists: Boolean(existing) });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/', async (request, response) => {
  try {
    const data = await createUser(request.body || {});
    response.status(201).json({
      data,
      message: 'User created successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({ error: 'A valid user ID is required.' });
    }

    const data = await updateUser(id, request.body || {});

    if (!data) {
      return response.status(404).json({ error: 'User record not found.' });
    }

    response.json({
      data,
      message: 'User updated successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const password = String(request.body?.password || '');
    const sessionUserId = request.session?.user?.userId;

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({ error: 'A valid user ID is required.' });
    }

    if (!password) {
      return response.status(400).json({ error: 'Password is required to delete a user.' });
    }

    if (!sessionUserId) {
      return response.status(401).json({ error: 'Unable to verify session user.' });
    }

    if (id === sessionUserId) {
      return response.status(403).json({ error: 'You cannot delete your own account.' });
    }

    const actingUser = await findUserById(sessionUserId);
    if (!actingUser || !passwordsMatch(password, actingUser.password_hash)) {
      return response.status(401).json({ error: 'Password verification failed.' });
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return response.status(404).json({ error: 'User record not found.' });
    }

    response.json({ message: 'User deleted successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;
