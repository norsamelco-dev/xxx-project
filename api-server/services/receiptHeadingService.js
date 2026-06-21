const { getPool } = require('../db');
const {
  normalizePrintLogoAlign,
  normalizePrintLogoWidth,
  isPrintLogoEnabled,
} = require('../utils/escPosLogo');

const VALID_PRICE_VAT_MODES = new Set(['INCLUSIVE', 'EXCLUSIVE']);

const editableFields = [
  'busi_name',
  'busi_addr',
  'busi_owner',
  'busi_vat_type',
  'busi_tin',
  'vat_rate',
  'price_vat_mode',
  'developer',
  'accreditation_no',
  'valid_start',
  'valid_until',
  'softwareversion',
  'contactdetail',
  'business_logo_path',
  'developer_logo_path',
  'print_logo_width',
  'print_logo_align',
  'print_logo_enabled',
];

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return text;
}

function normalizeVatRate(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    const error = new Error('vat_rate must be a valid number.');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizePriceVatModeField(value) {
  if (value === undefined || value === null || value === '') {
    return 'INCLUSIVE';
  }

  const normalized = String(value).trim().toUpperCase();
  if (!VALID_PRICE_VAT_MODES.has(normalized)) {
    const error = new Error('price_vat_mode must be INCLUSIVE or EXCLUSIVE.');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizePrintLogoEnabled(value) {
  if (value === undefined || value === null || value === '') {
    return 1;
  }
  return isPrintLogoEnabled(value) ? 1 : 0;
}

function normalizePayload(payload) {
  const busi_vat_type = normalizeText(payload.busi_vat_type);
  const price_vat_mode =
    busi_vat_type === 'VAT-EXEMPT TIN' ? 'INCLUSIVE' : normalizePriceVatModeField(payload.price_vat_mode);

  return {
    busi_name: normalizeText(payload.busi_name),
    busi_addr: normalizeText(payload.busi_addr),
    busi_owner: normalizeText(payload.busi_owner),
    busi_vat_type,
    busi_tin: normalizeText(payload.busi_tin),
    vat_rate: normalizeVatRate(payload.vat_rate),
    price_vat_mode,
    developer: normalizeText(payload.developer),
    accreditation_no: normalizeText(payload.accreditation_no),
    valid_start: normalizeDate(payload.valid_start),
    valid_until: normalizeDate(payload.valid_until),
    softwareversion: normalizeText(payload.softwareversion),
    contactdetail: normalizeText(payload.contactdetail),
    business_logo_path: normalizeText(payload.business_logo_path),
    developer_logo_path: normalizeText(payload.developer_logo_path),
    print_logo_width: normalizePrintLogoWidth(payload.print_logo_width),
    print_logo_align: normalizePrintLogoAlign(payload.print_logo_align),
    print_logo_enabled: normalizePrintLogoEnabled(payload.print_logo_enabled),
  };
}

async function getReceiptHeading(branchId) {
  const [rows] = await getPool().query(
    `SELECT id, busi_name, busi_addr, busi_owner, busi_vat_type, busi_tin, vat_rate, price_vat_mode,
            developer, accreditation_no, valid_start, valid_until, softwareversion, contactdetail,
            business_logo_path, developer_logo_path,
            print_logo_width, print_logo_align, print_logo_enabled, branch_id
     FROM receipt_heading
     WHERE branch_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [branchId],
  );

  return rows[0] || null;
}

async function saveReceiptHeading(branchId, payload) {
  const normalized = normalizePayload(payload);
  const existing = await getReceiptHeading(branchId);
  const targetId = Number(payload.id) || existing?.id || null;

  if (targetId) {
    const values = editableFields.map((field) => normalized[field]);
    values.push(targetId, branchId);

    await getPool().query(
      `UPDATE receipt_heading
       SET busi_name = ?,
           busi_addr = ?,
           busi_owner = ?,
           busi_vat_type = ?,
           busi_tin = ?,
           vat_rate = ?,
           price_vat_mode = ?,
           developer = ?,
           accreditation_no = ?,
           valid_start = ?,
           valid_until = ?,
           softwareversion = ?,
           contactdetail = ?,
           business_logo_path = ?,
           developer_logo_path = ?,
           print_logo_width = ?,
           print_logo_align = ?,
           print_logo_enabled = ?
       WHERE id = ?
         AND branch_id = ?`,
      values,
    );
  } else {
    await getPool().query(
      `INSERT INTO receipt_heading
       (busi_name, busi_addr, busi_owner, busi_vat_type, busi_tin, vat_rate, price_vat_mode,
        developer, accreditation_no, valid_start, valid_until, softwareversion, contactdetail,
        business_logo_path, developer_logo_path, print_logo_width, print_logo_align, print_logo_enabled, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...editableFields.map((field) => normalized[field]), branchId],
    );
  }

  return getReceiptHeading(branchId);
}

module.exports = {
  getReceiptHeading,
  saveReceiptHeading,
  normalizePrintLogoWidth,
  normalizePrintLogoAlign,
  normalizePrintLogoEnabled,
};
