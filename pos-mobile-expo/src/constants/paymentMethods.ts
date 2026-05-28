export type PaymentCategory = 'cash' | 'card' | 'ewallet'

export type CardNetworkId = 'VISA' | 'MASTERCARD' | 'OTHERS'

export type EwalletProviderId =
  | 'GCASH'
  | 'MAYA'
  | 'GRABPAY'
  | 'SHOPEEPAY'
  | 'COINSPH'
  | 'PALAWANPAY'
  | 'UNIONBANK'
  | 'GOTYME'
  | 'BAYAD'
  | 'STARPAY'
  | 'OTHERS'

export const PAYMENT_REFERENCE_MIN_LENGTH = 6

export const PAYMENT_CATEGORIES: Array<{ id: PaymentCategory; label: string; icon: string }> = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'ewallet', label: 'E-Wallet', icon: '📱' },
]

export const CARD_NETWORKS: Array<{ id: CardNetworkId; label: string }> = [
  { id: 'VISA', label: 'Visa' },
  { id: 'MASTERCARD', label: 'Mastercard' },
  { id: 'OTHERS', label: 'Others' },
]

/** Popular Philippine e-wallets (GCash & Maya first). */
export const EWALLET_PROVIDERS: Array<{ id: EwalletProviderId; label: string }> = [
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'GRABPAY', label: 'GrabPay' },
  { id: 'SHOPEEPAY', label: 'ShopeePay' },
  { id: 'COINSPH', label: 'Coins.ph' },
  { id: 'PALAWANPAY', label: 'Palawan Pay' },
  { id: 'UNIONBANK', label: 'UnionBank' },
  { id: 'GOTYME', label: 'GoTyme' },
  { id: 'BAYAD', label: 'Bayad' },
  { id: 'STARPAY', label: 'Starpay' },
  { id: 'OTHERS', label: 'Others' },
]

export function buildPaymentMethod(
  category: PaymentCategory,
  subtype?: CardNetworkId | EwalletProviderId,
): string {
  if (category === 'cash') {
    return 'CASH PAYMENT'
  }

  if (category === 'card') {
    return `CARD PAYMENT - ${subtype || 'OTHERS'}`
  }

  return `E-WALLET - ${subtype || 'OTHERS'}`
}

export function requiresPaymentReference(category: PaymentCategory) {
  return category === 'card' || category === 'ewallet'
}

export function isPaymentReferenceValid(reference: string) {
  return reference.trim().length >= PAYMENT_REFERENCE_MIN_LENGTH
}

export function usesExactTenderedAmount(category: PaymentCategory) {
  return category === 'card' || category === 'ewallet'
}
