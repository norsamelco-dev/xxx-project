const express = require('express');
const {
  findUserByUsername,
  passwordsMatch,
  isUserActive,
  toSessionUser,
} = require('../services/userService');
const { signToken } = require('../services/tokenService');
const { getPool } = require('../db');

const router = express.Router();

async function findTerminalBranchId(machineName) {
  const normalized = String(machineName || '').trim();
  if (!normalized) {
    return null;
  }

  const [rows] = await getPool().query(
    `SELECT branch_id
     FROM terminals_a
     WHERE machine_name = ?
       AND is_active = 1
     LIMIT 1`,
    [normalized],
  );

  return rows[0]?.branch_id ?? null;
}

router.post('/login', async (request, response) => {
  const username = String(request.body.username || '').trim();
  const password = String(request.body.password || '');
  const machineName = String(request.body.machine_name || request.headers['x-machine-name'] || '').trim();
  const wantsToken = Boolean(request.body.mobile || request.headers['x-pos-client']);

  if (!username || !password) {
    return response.status(400).json({
      error: 'Username and password are required.',
    });
  }

  try {
    const user = await findUserByUsername(username);

    if (!user || !passwordsMatch(password, user.password_hash)) {
      return response.status(401).json({
        error: 'Invalid username or password.',
      });
    }

    if (!isUserActive(user.ACTIVE)) {
      return response.status(403).json({
        error: 'This account is inactive. Please contact an administrator.',
      });
    }

    if (wantsToken && machineName) {
      const terminalBranchId = await findTerminalBranchId(machineName);
      if (terminalBranchId && Number(user.branch_id) !== Number(terminalBranchId)) {
        return response.status(403).json({
          error: 'This account belongs to a different branch than this terminal.',
        });
      }
    }

    const sessionUser = toSessionUser(user);
    request.session.user = sessionUser;

    return response.json({
      user: sessionUser,
      ...(wantsToken ? { token: signToken(sessionUser) } : {}),
    });
  } catch (error) {
    return response.status(500).json({
      error: error.message,
    });
  }
});

router.get('/me', (request, response) => {
  if (!request.session || !request.session.user) {
    return response.status(401).json({
      error: 'No active session.',
    });
  }

  return response.json({
    user: request.session.user,
  });
});

router.post('/logout', (request, response) => {
  if (!request.session) {
    return response.status(204).send();
  }

  return request.session.destroy((error) => {
    if (error) {
      return response.status(500).json({
        error: 'Unable to end the session right now.',
      });
    }

    response.clearCookie('linda.sid');
    return response.status(204).send();
  });
});

module.exports = router;
