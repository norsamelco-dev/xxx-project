const fs = require('fs');
const path = require('path');
const multer = require('multer');

const logosDir = path.resolve(__dirname, '..', 'api', 'logos');
const allowedLogoMimeType = 'image/png';

function isPngLogoUpload(file) {
  return file.mimetype === allowedLogoMimeType || /\.png$/i.test(String(file.originalname || ''));
}

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!isPngLogoUpload(file)) {
      const error = new Error('Only PNG files are allowed.');
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

function saveLogoFile(file, prefix) {
  ensureLogosDirectory();

  const files = fs.readdirSync(logosDir);
  for (const entry of files) {
    if (entry.startsWith(`${prefix}.`) || entry === `${prefix}.png`) {
      fs.unlinkSync(path.join(logosDir, entry));
    }
  }

  const fileName = `${prefix}.png`;
  const filePath = path.join(logosDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  return `/api/logos/${fileName}`;
}

function saveBranchBusinessLogoFile(file, branchId) {
  return saveLogoFile(file, `business-logo-br${branchId}`);
}

function handleLogoUploadError(error, response) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(400).json({
      error: 'Logo file must be 2 MB or less.',
    });
    return true;
  }

  if (error?.statusCode) {
    response.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
}

module.exports = {
  logoUpload,
  saveLogoFile,
  saveBranchBusinessLogoFile,
  handleLogoUploadError,
  isPngLogoUpload,
};
