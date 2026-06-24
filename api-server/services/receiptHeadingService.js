const { getPool } = require('../db');
const {
  normalizePrintLogoAlign,
  normalizePrintLogoWidth,
  isPrintLogoEnabled,
} = require('../utils/escPosLogo');
const { normalizeText } = require('../utils/businessProfile');

const developerFields = [
  'developer',
  'accreditation_no',
  'valid_start',
  'valid_until',
  'softwareversion',
  'contactdetail',
  'developer_logo_path',
  'print_logo_width',
  'print_logo_align',
  'print_logo_enabled',
];

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return text;
}

function normalizePrintLogoEnabled(value) {
  if (value === undefined || value === null || value === '') {
    return 1;
  }
  return isPrintLogoEnabled(value) ? 1 : 0;
}

function normalizeDeveloperPayload(payload) {
  return {
    developer: normalizeText(payload.developer),
    accreditation_no: normalizeText(payload.accreditation_no),
    valid_start: normalizeDate(payload.valid_start),
    valid_until: normalizeDate(payload.valid_until),
    softwareversion: normalizeText(payload.softwareversion),
    contactdetail: normalizeText(payload.contactdetail),
    developer_logo_path: normalizeText(payload.developer_logo_path),
    print_logo_width: normalizePrintLogoWidth(payload.print_logo_width),
    print_logo_align: normalizePrintLogoAlign(payload.print_logo_align),
    print_logo_enabled: normalizePrintLogoEnabled(payload.print_logo_enabled),
  };
}

async function getReceiptHeading(branchId) {
  const [rows] = await getPool().query(
    `SELECT rh.id,
            b.busi_name,
            b.busi_addr,
            b.busi_owner,
            b.busi_vat_type,
            b.busi_tin,
            b.vat_rate,
            b.price_vat_mode,
            b.business_logo_path,
            rh.developer,
            rh.accreditation_no,
            rh.valid_start,
            rh.valid_until,
            rh.softwareversion,
            rh.contactdetail,
            rh.developer_logo_path,
            rh.print_logo_width,
            rh.print_logo_align,
            rh.print_logo_enabled,
            rh.branch_id
     FROM branches b
     LEFT JOIN receipt_heading rh ON rh.branch_id = b.branch_id
     WHERE b.branch_id = ?
     ORDER BY rh.id ASC
     LIMIT 1`,
    [branchId],
  );

  return rows[0] || null;
}

async function saveReceiptHeading(branchId, payload) {
  const normalized = normalizeDeveloperPayload(payload);
  const existing = await getReceiptHeading(branchId);
  const targetId = Number(payload.id) || existing?.id || null;

  if (targetId) {
    const values = developerFields.map((field) => normalized[field]);
    values.push(targetId, branchId);

    await getPool().query(
      `UPDATE receipt_heading
       SET developer = ?,
           accreditation_no = ?,
           valid_start = ?,
           valid_until = ?,
           softwareversion = ?,
           contactdetail = ?,
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
       (developer, accreditation_no, valid_start, valid_until, softwareversion, contactdetail,
        developer_logo_path, print_logo_width, print_logo_align, print_logo_enabled, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...developerFields.map((field) => normalized[field]), branchId],
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
