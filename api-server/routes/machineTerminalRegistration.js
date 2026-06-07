const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { findUserById, passwordsMatch } = require('../services/userService');
const {
  listMachines,
  findDuplicateFields,
  createMachine,
  updateMachine,
  deleteMachine,
} = require('../services/machineTerminalService');

const router = express.Router();

router.use(requireAuth);
router.use(requireBranchContext);

router.get('/', async (request, response) => {
  try {
    const data = await listMachines(request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

router.post('/validate', async (request, response) => {
  try {
    const excludeId = request.body?.id || request.body?.exclude_id || null;
    const duplicates = await findDuplicateFields(request.branchId, request.body || {}, excludeId);

    response.json({
      duplicates,
      hasDuplicates: duplicates.length > 0,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/', async (request, response) => {
  try {
    const data = await createMachine(request.branchId, request.body || {});
    response.status(201).json({
      data,
      message: 'Machine terminal created successfully.',
    });
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : error.statusCode || 500;
    response.status(status).json({
      error:
        error.code === 'ER_DUP_ENTRY'
          ? 'Duplicate value for a unique terminal field.'
          : error.message,
      duplicates: error.duplicates || undefined,
    });
  }
});

router.put('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        error: 'A valid machine ID is required.',
      });
    }

    const data = await updateMachine(request.branchId, id, request.body || {});

    if (!data) {
      return response.status(404).json({
        error: 'Machine terminal record not found.',
      });
    }

    response.json({
      data,
      message: 'Machine terminal updated successfully.',
    });
  } catch (error) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : error.statusCode || 500;
    response.status(status).json({
      error:
        error.code === 'ER_DUP_ENTRY'
          ? 'Duplicate value for a unique terminal field.'
          : error.message,
      duplicates: error.duplicates || undefined,
    });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const password = String(request.body?.password || '');
    const sessionUserId = request.session?.user?.userId;

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        error: 'A valid machine ID is required.',
      });
    }

    if (!password) {
      return response.status(400).json({
        error: 'Password is required to delete a machine terminal record.',
      });
    }

    if (!sessionUserId) {
      return response.status(401).json({
        error: 'Unable to verify session user.',
      });
    }

    const user = await findUserById(sessionUserId);

    if (!user || !passwordsMatch(password, user.password_hash)) {
      return response.status(401).json({
        error: 'Password verification failed.',
      });
    }

    const deleted = await deleteMachine(request.branchId, id);

    if (!deleted) {
      return response.status(404).json({
        error: 'Machine terminal record not found.',
      });
    }

    response.json({
      message: 'Machine terminal deleted successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
