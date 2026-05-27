function requireAuth(request, response, next) {
  if (!request.session || !request.session.user) {
    return response.status(401).json({
      error: 'You must sign in to access this resource.',
    });
  }

  return next();
}

module.exports = requireAuth;