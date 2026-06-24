const { findBranchByCode, getBranchById } = require('../services/branchService');

async function resolvePublicBranchId(branchCode) {
  const normalizedCode = String(branchCode || '').trim();

  if (normalizedCode) {
    const branch = await findBranchByCode(normalizedCode);
    if (branch?.branch_id) {
      return branch.branch_id;
    }
  }

  const mainBranch = await findBranchByCode('MAIN');
  if (mainBranch?.branch_id) {
    return mainBranch.branch_id;
  }

  const fallback = await getBranchById(1);
  return fallback?.branch_id ?? 1;
}

module.exports = {
  resolvePublicBranchId,
};
