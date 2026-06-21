const { getReceiptHeading } = require('../services/receiptHeadingService');

const DEFAULT_VAT_RATE = 0.12;
const DEFAULT_PRICE_VAT_MODE = 'INCLUSIVE';
const VALID_PRICE_VAT_MODES = new Set(['INCLUSIVE', 'EXCLUSIVE']);

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeVatRateDecimal(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VAT_RATE;
  }
  if (parsed > 1) {
    return parsed / 100;
  }
  return parsed;
}

function normalizePriceVatMode(value, fallback = DEFAULT_PRICE_VAT_MODE) {
  const normalized = String(value || fallback).trim().toUpperCase();
  if (VALID_PRICE_VAT_MODES.has(normalized)) {
    return normalized;
  }
  return fallback;
}

function isVatExemptHeading(heading) {
  const vatType = String(heading?.busi_vat_type || '').trim().toUpperCase();
  return vatType === 'VAT-EXEMPT TIN';
}

function resolveEffectiveVatRate(vatRate, heading) {
  if (isVatExemptHeading(heading)) {
    return 0;
  }
  return normalizeVatRateDecimal(vatRate);
}

function computeSaleTotals({ lineTotals, discountRate, vatRate, priceVatMode = DEFAULT_PRICE_VAT_MODE, heading = null }) {
  const grossSales = roundMoney(lineTotals.reduce((sum, value) => sum + Number(value || 0), 0));
  const normalizedDiscountRate = Math.max(0, Number(discountRate) || 0);
  const discountAmount = roundMoney(grossSales * normalizedDiscountRate);
  const taxableGross = roundMoney(grossSales - discountAmount);
  const mode = normalizePriceVatMode(priceVatMode);
  const effectiveRate = resolveEffectiveVatRate(vatRate, heading);
  const storedRate = normalizeVatRateDecimal(vatRate);

  let vatAmount = 0;
  let netSales = taxableGross;
  let grandTotal = taxableGross;

  if (effectiveRate > 0) {
    if (mode === 'EXCLUSIVE') {
      vatAmount = roundMoney(taxableGross * effectiveRate);
      netSales = taxableGross;
      grandTotal = roundMoney(taxableGross + vatAmount);
    } else {
      vatAmount = roundMoney(taxableGross * (effectiveRate / (1 + effectiveRate)));
      netSales = roundMoney(taxableGross - vatAmount);
      grandTotal = taxableGross;
    }
  }

  return {
    grossSales,
    discountRate: normalizedDiscountRate,
    discountAmount,
    vatRate: storedRate,
    priceVatMode: mode,
    vatAmount,
    netSales,
    grandTotal,
    totalQty: lineTotals.length,
  };
}

async function getBranchVatSettings(branchId) {
  try {
    const heading = await getReceiptHeading(branchId);
    if (!heading) {
      return {
        vatRate: DEFAULT_VAT_RATE,
        priceVatMode: DEFAULT_PRICE_VAT_MODE,
        heading: null,
      };
    }

    return {
      vatRate: resolveEffectiveVatRate(heading.vat_rate, heading),
      priceVatMode: normalizePriceVatMode(heading.price_vat_mode),
      heading,
    };
  } catch {
    return {
      vatRate: DEFAULT_VAT_RATE,
      priceVatMode: DEFAULT_PRICE_VAT_MODE,
      heading: null,
    };
  }
}

module.exports = {
  DEFAULT_VAT_RATE,
  DEFAULT_PRICE_VAT_MODE,
  VALID_PRICE_VAT_MODES,
  roundMoney,
  normalizeVatRateDecimal,
  normalizePriceVatMode,
  isVatExemptHeading,
  resolveEffectiveVatRate,
  computeSaleTotals,
  getBranchVatSettings,
};
