const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logosDir = path.resolve(__dirname, '..', 'api', 'logos');
const MAX_LOGO_HEIGHT = 240;
const MIN_LOGO_WIDTH = 80;
const MAX_LOGO_WIDTH = 384;

function normalizePrintLogoWidth(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 240;
  }
  return Math.max(MIN_LOGO_WIDTH, Math.min(MAX_LOGO_WIDTH, Math.round(parsed)));
}

function normalizePrintLogoAlign(value) {
  const align = String(value || 'center').trim().toLowerCase();
  if (align === 'left' || align === 'right') {
    return align;
  }
  return 'center';
}

function isPrintLogoEnabled(value) {
  return value === true || value === 1 || value === '1' || value === 'Y' || value === 'y';
}

function resolveLogoFilePath(logoPath) {
  if (!logoPath) {
    return null;
  }

  const normalized = String(logoPath).trim();
  if (!normalized) {
    return null;
  }

  const fileName = path.basename(normalized.replace(/^\/api\/logos\//i, ''));
  if (!fileName || fileName.includes('..')) {
    return null;
  }

  const filePath = path.join(logosDir, fileName);
  return fs.existsSync(filePath) ? filePath : null;
}

function alignmentCommand(align) {
  if (align === 'left') {
    return Buffer.from([0x1b, 0x61, 0x00]);
  }
  if (align === 'right') {
    return Buffer.from([0x1b, 0x61, 0x02]);
  }
  return Buffer.from([0x1b, 0x61, 0x01]);
}

function encodeRasterImage(imageBuffer, targetWidth) {
  return sharp(imageBuffer)
    .resize({
      width: targetWidth,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .normalize()
    .threshold(170)
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      const width = info.width;
      const height = info.height;
      const bytesPerRow = Math.ceil(width / 8);
      const raster = Buffer.alloc(bytesPerRow * height);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pixel = data[y * width + x];
          if (pixel < 128) {
            raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x % 8);
          }
        }
      }

      const header = Buffer.alloc(8);
      header[0] = 0x1d;
      header[1] = 0x76;
      header[2] = 0x30;
      header[3] = 0x00;
      header[4] = bytesPerRow & 0xff;
      header[5] = (bytesPerRow >> 8) & 0xff;
      header[6] = height & 0xff;
      header[7] = (height >> 8) & 0xff;

      return Buffer.concat([header, raster]);
    });
}

async function buildLogoEscPosBuffer(heading) {
  if (!heading || !isPrintLogoEnabled(heading.print_logo_enabled)) {
    return null;
  }

  const logoPath = resolveLogoFilePath(heading.business_logo_path);
  if (!logoPath) {
    return null;
  }

  const targetWidth = normalizePrintLogoWidth(heading.print_logo_width);
  const align = normalizePrintLogoAlign(heading.print_logo_align);

  const imageBuffer = await sharp(logoPath)
    .resize({
      width: targetWidth,
      height: MAX_LOGO_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();

  const raster = await encodeRasterImage(imageBuffer, targetWidth);

  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    alignmentCommand(align),
    raster,
    Buffer.from('\n\n', 'ascii'),
    Buffer.from([0x1b, 0x61, 0x00]),
  ]);
}

module.exports = {
  buildLogoEscPosBuffer,
  normalizePrintLogoWidth,
  normalizePrintLogoAlign,
  isPrintLogoEnabled,
  resolveLogoFilePath,
};
