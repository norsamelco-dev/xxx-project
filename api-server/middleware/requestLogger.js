function resolveActor(request) {
  const user = request.posUser || request.session?.user;

  if (user?.username) {
    return String(user.username);
  }

  return null;
}

function resolveClientLabel(request) {
  const posClient = request.headers['x-pos-client'];
  if (typeof posClient === 'string' && posClient.trim()) {
    return posClient.trim();
  }

  return null;
}

function resolveAuditLabel(request) {
  const page = request.headers['x-audit-page'];
  const action = request.headers['x-audit-action'];

  if (typeof page !== 'string' || !page.trim()) {
    return null;
  }

  const actionLabel =
    typeof action === 'string' && action.trim() ? action.trim() : 'ACTION';

  return `${actionLabel} @ ${page.trim()}`;
}

function shouldLog(request) {
  if (process.env.REQUEST_LOG === '0' || process.env.REQUEST_LOG === 'false') {
    return false;
  }

  return request.originalUrl.startsWith('/api');
}

function requestLogger(request, response, next) {
  if (!shouldLog(request)) {
    return next();
  }

  const startedAt = Date.now();

  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const timestamp = new Date().toISOString();
    const status = response.statusCode;
    const method = request.method;
    const url = request.originalUrl;
    const parts = [`[${timestamp}]`, method, url, status, `${durationMs}ms`];

    const client = resolveClientLabel(request);
    if (client) {
      parts.push(`client=${client}`);
    }

    const actor = resolveActor(request);
    if (actor) {
      parts.push(`user=${actor}`);
    }

    const audit = resolveAuditLabel(request);
    if (audit) {
      parts.push(`audit=${audit}`);
    }

    const ip = request.ip;
    if (ip) {
      parts.push(`ip=${ip}`);
    }

    const line = parts.join(' ');
    if (status >= 500) {
      console.error(line);
      return;
    }

    if (status >= 400) {
      console.warn(line);
      return;
    }

    console.log(line);
  });

  next();
}

module.exports = requestLogger;
