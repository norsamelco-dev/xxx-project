# POS Terminal Features

## Machine registration

Before selling, each register must map to a row in `terminals_a`:

- Serial number, machine name
- MIN, PTU, permit number
- OR number range (start/end) and current OR
- Valid from / valid until dates
- Branch assignment

Admin manages terminals in **Machine / Terminal Registration** (web). POS validates on login.

## Sales series (cashier shift)

A **sales series** is one cashier session on one machine:

1. Cashier opens series (may set **starting balance**)
2. All checkouts attach to `sales_series_no`
3. OR numbers increment within terminal's allowed range
4. Series closes on **Z reading** (`lockbatch = 'Y'`)

Only one **open** series per cashier/machine combination is typical.

## Cart and checkout

| Step | Behavior |
|------|----------|
| Add item | Barcode or search → FIFO batch allocation in `cart` |
| Adjust qty | Update line; re-validate stock |
| Checkout | Insert `sales_a` header + `sales_b` lines; decrement batches; clear cart |
| Receipt | Print via ESC/POS layout with business heading |

Checkout is transactional — failure rolls back stock and sale rows.

## Payment

Recorded on `sales_a` (cash, card, etc. per configuration). Totals include VAT per branch `receipt_heading` settings.

## X reading

- **When:** Any time during open series
- **Scope:** Sales for **current open series**, **current cashier**, **current machine**
- **Query:** `GET /api/pos/reports/x?machineName=...&sales_series_no=...`
- **Output:** Printed slip with gross, voids, net, payment breakdown

Does not include other cashiers' or closed series' sales.

## Z reading

- **When:** End of shift
- **Scope:** Same as X for totals
- **Action:** `POST /api/pos/reports/z` then closes series
- **After Z:** New series required to sell again

## Cash count sheet

Modal compares expected cash (from series sales) vs physical count. Uses same series-scoped totals as X report.

## Void operations

| Operation | Effect |
|-----------|--------|
| Void entire transaction | Reverses sale; restores batch qty |
| Void single line | Partial reversal |

Voids are audited and reflected in X/Z void totals.

## Transaction history

Browse transactions within a series; reprint receipt; void from history UI.

## Error cases

| Situation | Response |
|-----------|----------|
| OR exceeds terminal range | Checkout blocked |
| Insufficient batch stock | Add to cart fails |
| Closed series for X/Z | 409 conflict |
| Wrong cashier's series | 403/validation error |

## Related

- [API POS routes](../api/overview.md)
- [Printing](../printing.md)
- [Database schema](../database/schema.md)
