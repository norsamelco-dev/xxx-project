const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const { getReceiptHeading, saveReceiptHeading } = require('../services/receiptHeadingService');

const router = express.Router();
const logosDir = path.resolve(__dirname, '..', 'api', 'logos');
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only png, jpg, jpeg, and webp files are allowed.');
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

function ensureLogosDirectory() {
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }
}

function getExtensionByMimeType(mimeType) {
  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}

function saveLogoFile(file, prefix) {
  ensureLogosDirectory();

  const files = fs.readdirSync(logosDir);
  for (const entry of files) {
    if (entry.startsWith(`${prefix}.`)) {
      fs.unlinkSync(path.join(logosDir, entry));
    }
  }

  const extension = getExtensionByMimeType(file.mimetype);
  const fileName = `${prefix}${extension}`;
  const filePath = path.join(logosDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  return `/api/logos/${fileName}`;
}

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

router.get('/public', async (_request, response) => {
  try {
    const data = await getReceiptHeading();

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

router.get('/', async (_request, response) => {
  try {
    const data = await getReceiptHeading();

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
  upload.fields([
    { name: 'business_logo', maxCount: 1 },
    { name: 'developer_logo', maxCount: 1 },
  ]),
  async (request, response) => {
  try {
    const existing = await getReceiptHeading();
    const files = request.files || {};
    const businessLogoFile = files.business_logo?.[0] || null;
    const developerLogoFile = files.developer_logo?.[0] || null;

    const payload = {
      ...(request.body || {}),
      id: request.body?.id || existing?.id || null,
      business_logo_path: existing?.business_logo_path || null,
      developer_logo_path: existing?.developer_logo_path || null,
    };

    if (businessLogoFile) {
      payload.business_logo_path = saveLogoFile(businessLogoFile, 'business-logo');
    }

    if (developerLogoFile) {
      payload.developer_logo_path = saveLogoFile(developerLogoFile, 'developer-logo');
    }

    const data = await saveReceiptHeading(payload);

    response.json({
      data,
      message: 'Receipt heading updated successfully.',
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({
        error: 'Logo file must be 2 MB or less.',
      });
      return;
    }

    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
  },
);

module.exports = router;