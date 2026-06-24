const VALID_PRICE_VAT_MODES = new Set(['INCLUSIVE', 'EXCLUSIVE']);

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeBusinessName(value) {
  const name = normalizeText(value);
  if (!name) {
    const error = new Error('Business name is required.');
    error.statusCode = 400;
    throw error;
  }
  return name;
}

function normalizeVatRate(value, { allowNull = true } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowNull ? null : 12;
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

function normalizeBusinessProfilePayload(payload, { requireName = false } = {}) {
  const busi_vat_type = normalizeText(payload.busi_vat_type);
  const price_vat_mode =
    busi_vat_type === 'VAT-EXEMPT TIN' ? 'INCLUSIVE' : normalizePriceVatModeField(payload.price_vat_mode);

  return {
    busi_name: requireName ? normalizeBusinessName(payload.busi_name) : normalizeText(payload.busi_name),
    busi_addr: normalizeText(payload.busi_addr),
    busi_owner: normalizeText(payload.busi_owner),
    busi_vat_type,
    busi_tin: normalizeText(payload.busi_tin),
    vat_rate: normalizeVatRate(payload.vat_rate),
    price_vat_mode,
    business_logo_path: normalizeText(payload.business_logo_path),
  };
}

function mapBusinessProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    busi_name: row.busi_name ?? null,
    busi_addr: row.busi_addr ?? null,
    busi_owner: row.busi_owner ?? null,
    busi_vat_type: row.busi_vat_type ?? null,
    busi_tin: row.busi_tin ?? null,
    vat_rate: row.vat_rate ?? null,
    price_vat_mode: row.price_vat_mode ?? 'INCLUSIVE',
    business_logo_path: row.business_logo_path ?? null,
  };
}

module.exports = {
  VALID_PRICE_VAT_MODES,
  normalizeText,
  normalizeBusinessName,
  normalizeVatRate,
  normalizePriceVatModeField,
  normalizeBusinessProfilePayload,
  mapBusinessProfileRow,
};
