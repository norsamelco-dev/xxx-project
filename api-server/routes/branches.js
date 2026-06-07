const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { createBranch, getBranchById, listBranches, updateBranch } = require('../services/branchService');

const router = express.Router();

function hasBranchesAccess(user) {
  return user?.role === 'Admin' || Boolean(user?.pageAccess?.branches);
}

router.get('/', requireAuth, requireBranchContext, async (request, response) => {
  try {
    const branches = await listBranches();
    return response.json({ data: branches });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/', requireAuth, requireBranchContext, async (request, response) => {
  if (!hasBranchesAccess(request.session.user)) {
    return response.status(403).json({ error: 'You do not have permission to manage branches.' });
  }

  try {
    const branch = await createBranch(request.body || {});
    return response.status(201).json({ data: branch });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.patch('/:branchId', requireAuth, requireBranchContext, async (request, response) => {
  if (!hasBranchesAccess(request.session.user)) {
    return response.status(403).json({ error: 'You do not have permission to manage branches.' });
  }

  const branchId = Number(request.params.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return response.status(400).json({ error: 'Invalid branch id.' });
  }

  try {
    const branch = await updateBranch(branchId, request.body || {});
    if (!branch) {
      return response.status(404).json({ error: 'Branch not found.' });
    }
    return response.json({ data: branch });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/:branchId', requireAuth, requireBranchContext, async (request, response) => {
  const branchId = Number(request.params.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return response.status(400).json({ error: 'Invalid branch id.' });
  }

  try {
    const branch = await getBranchById(branchId);
    if (!branch) {
      return response.status(404).json({ error: 'Branch not found.' });
    }
    return response.json({ data: branch });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;
