const { verifyToken } = require('../services/tokenService');
const { findUserById, toSessionUser, isUserActive } = require('../services/userService');

async function requirePosAuth(request, response, next) {
  if (request.session?.user) {
    request.posUser = request.session.user;
    return next();
  }

  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return response.status(401).json({
      error: 'You must sign in to access this resource.',
    });
  }

  const payload = verifyToken(match[1]);

  if (!payload) {
    return response.status(401).json({
      error: 'Invalid or expired token.',
    });
  }

  try {
    const user = await findUserById(payload.userId);

    if (!user || !isUserActive(user.ACTIVE)) {
      return response.status(401).json({
        error: 'Invalid or inactive user.',
      });
    }

    request.posUser = toSessionUser(user);
    return next();
  } catch (error) {
    return response.status(500).json({
      error: error.message,
    });
  }
}

module.exports = requirePosAuth;
