const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { createBranch, deleteBranch, getBranchById, getBranchBusinessProfileById, listBranches, updateBranch } = require('../services/branchService');
const { findUserById, passwordsMatch } = require('../services/userService');
const { logoUpload, saveBranchBusinessLogoFile, handleLogoUploadError } = require('../utils/logoUpload');
const { resolvePublicBranchId } = require('../utils/resolvePublicBranch');

const router = express.Router();

function hasBranchesAccess(user) {
  return user?.role === 'Admin' || Boolean(user?.pageAccess?.branches);
}

function normalizeDeletePasswords(payload) {
  const passwords = payload?.passwords;
  if (!Array.isArray(passwords) || passwords.length !== 3) {
    const error = new Error('Three password confirmations are required to delete a branch.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = passwords.map((value) => String(value || '').trim());
  if (normalized.some((value) => !value)) {
    const error = new Error('All three password confirmations are required.');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

async function verifyDeletePasswords(sessionUserId, passwords) {
  if (!sessionUserId) {
    const error = new Error('Unable to verify session user.');
    error.statusCode = 401;
    throw error;
  }

  const actingUser = await findUserById(sessionUserId);
  if (!actingUser) {
    const error = new Error('Unable to verify session user.');
    error.statusCode = 401;
    throw error;
  }

  passwords.forEach((password, index) => {
    if (!passwordsMatch(password, actingUser.password_hash)) {
      const error = new Error(`Password verification failed on confirmation ${index + 1} of 3.`);
      error.statusCode = 401;
      throw error;
    }
  });
}

function buildBranchPayload(body, existing = null) {
  const payload = { ...(body || {}) };

  if (existing?.business_logo_path && payload.business_logo_path === undefined) {
    payload.business_logo_path = existing.business_logo_path;
  }

  return payload;
}

function applyBusinessLogoUpload(payload, file, branchId) {
  if (file) {
    payload.business_logo_path = saveBranchBusinessLogoFile(file, branchId);
  }
}

router.get('/public', async (request, response) => {
  try {
    const branchCode = String(request.query.branch_code || '').trim();
    const branchId = await resolvePublicBranchId(branchCode);
    const data = await getBranchBusinessProfileById(branchId);

    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/', requireAuth, requireBranchContext, async (request, response) => {
  try {
    const branches = await listBranches();
    return response.json({ data: branches });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post(
  '/',
  requireAuth,
  requireBranchContext,
  logoUpload.single('business_logo'),
  async (request, response) => {
    if (!hasBranchesAccess(request.session.user)) {
      return response.status(403).json({ error: 'You do not have permission to manage branches.' });
    }

    try {
      const payload = buildBranchPayload(request.body);
      const branch = await createBranch(payload);

      if (request.file) {
        const logoPath = saveBranchBusinessLogoFile(request.file, branch.branch_id);
        const updated = await updateBranch(branch.branch_id, {
          ...payload,
          business_logo_path: logoPath,
        });
        return response.status(201).json({ data: updated });
      }

      return response.status(201).json({ data: branch });
    } catch (error) {
      if (handleLogoUploadError(error, response)) {
        return undefined;
      }
      return response.status(error.statusCode || 500).json({ error: error.message });
    }
  },
);

router.patch(
  '/:branchId',
  requireAuth,
  requireBranchContext,
  logoUpload.single('business_logo'),
  async (request, response) => {
    if (!hasBranchesAccess(request.session.user)) {
      return response.status(403).json({ error: 'You do not have permission to manage branches.' });
    }

    const branchId = Number(request.params.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return response.status(400).json({ error: 'Invalid branch id.' });
    }

    try {
      const existing = await getBranchById(branchId);
      if (!existing) {
        return response.status(404).json({ error: 'Branch not found.' });
      }

      const payload = buildBranchPayload(request.body, existing);
      applyBusinessLogoUpload(payload, request.file, branchId);

      const branch = await updateBranch(branchId, payload);
      return response.json({ data: branch });
    } catch (error) {
      if (handleLogoUploadError(error, response)) {
        return undefined;
      }
      return response.status(error.statusCode || 500).json({ error: error.message });
    }
  },
);

router.delete('/:branchId', requireAuth, requireBranchContext, async (request, response) => {
  if (!hasBranchesAccess(request.session.user)) {
    return response.status(403).json({ error: 'You do not have permission to manage branches.' });
  }

  const branchId = Number(request.params.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return response.status(400).json({ error: 'Invalid branch id.' });
  }

  try {
    const passwords = normalizeDeletePasswords(request.body || {});
    await verifyDeletePasswords(request.session?.user?.userId, passwords);

    const sessionBranchId = Number(request.session?.user?.branchId);
    if (Number.isInteger(sessionBranchId) && sessionBranchId === branchId) {
      return response.status(409).json({
        error: 'Switch to another branch before deleting the branch you are currently using.',
      });
    }

    const deleted = await deleteBranch(branchId);
    if (!deleted) {
      return response.status(404).json({ error: 'Branch not found.' });
    }

    return response.json({
      message: 'Branch deleted successfully.',
      data: deleted,
    });
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
