const crypto = require('crypto');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;

function getSecret() {
  return process.env.SESSION_SECRET || 'development-session-secret-change-me';
}

function signToken(user) {
  const payload = {
    userId: user.userId,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [encoded, signature] = token.split('.');

  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));

    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  TOKEN_TTL_MS,
};
