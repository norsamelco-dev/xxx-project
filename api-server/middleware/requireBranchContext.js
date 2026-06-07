const { getBranchById } = require('../services/branchService');

async function requireBranchContext(request, response, next) {
  const user = request.session?.user || request.posUser;

  if (!user?.branchId) {
    return response.status(403).json({
      error: 'Your account is not assigned to a branch. Contact an administrator.',
    });
  }

  try {
    const branch = await getBranchById(user.branchId);

    if (!branch || !branch.is_active) {
      return response.status(403).json({
        error: 'Your branch is inactive or does not exist. Contact an administrator.',
      });
    }

    request.branchId = user.branchId;
    request.branch = branch;
    return next();
  } catch (error) {
    return response.status(500).json({
      error: error.message,
    });
  }
}

module.exports = requireBranchContext;
