const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { getReceiptHeading, saveReceiptHeading } = require('../services/receiptHeadingService');
const { resolvePublicBranchId } = require('../utils/resolvePublicBranch');
const { logoUpload, saveLogoFile, handleLogoUploadError } = require('../utils/logoUpload');

const router = express.Router();

function toPublicReceiptHeading(data) {
  if (!data) {
    return null;
  }

  return {
    busi_name: data.busi_name,
    busi_addr: data.busi_addr,
    busi_owner: data.busi_owner,
    busi_vat_type: data.busi_vat_type,
    busi_tin: data.busi_tin,
    vat_rate: data.vat_rate,
    price_vat_mode: data.price_vat_mode,
    developer: data.developer,
    accreditation_no: data.accreditation_no,
    valid_start: data.valid_start,
    valid_until: data.valid_until,
    softwareversion: data.softwareversion,
    contactdetail: data.contactdetail,
    business_logo_path: data.business_logo_path,
    developer_logo_path: data.developer_logo_path,
    print_logo_width: data.print_logo_width,
    print_logo_align: data.print_logo_align,
    print_logo_enabled: data.print_logo_enabled,
  };
}

router.get('/public', async (request, response) => {
  try {
    const branchCode = String(request.query.branch_code || '').trim();
    const branchId = await resolvePublicBranchId(branchCode);
    const data = await getReceiptHeading(branchId);

    response.json({
      data: toPublicReceiptHeading(data),
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

router.use(requireAuth);
router.use(requireBranchContext);

router.get('/', async (request, response) => {
  try {
    const data = await getReceiptHeading(request.branchId);

    response.json({
      data,
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

router.put(
  '/',
  logoUpload.fields([{ name: 'developer_logo', maxCount: 1 }]),
  async (request, response) => {
    try {
      const existing = await getReceiptHeading(request.branchId);
      const files = request.files || {};
      const developerLogoFile = files.developer_logo?.[0] || null;

      const payload = {
        ...(request.body || {}),
        id: request.body?.id || existing?.id || null,
        developer_logo_path: existing?.developer_logo_path || null,
      };

      if (developerLogoFile) {
        payload.developer_logo_path = saveLogoFile(developerLogoFile, 'developer-logo');
      }

      const data = await saveReceiptHeading(request.branchId, payload);

      response.json({
        data,
        message: 'Receipt heading updated successfully.',
      });
    } catch (error) {
      if (handleLogoUploadError(error, response)) {
        return undefined;
      }

      response.status(error.statusCode || 500).json({
        error: error.message,
      });
    }
  },
);

module.exports = router;
