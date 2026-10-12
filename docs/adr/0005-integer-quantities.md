# 0005 — Paise and milli-units, never floats

**Status:** accepted

## Context

Money and raw material quantities are summed thousands of times (every sale,
every production entry). Floating point drifts (`0.1 + 0.2 !== 0.3`), and a
stock figure that is off by 0.0000001 kg eventually shows up as a wrong
"low stock" decision.

## Decision

- Money is integer paise; INR only (the product is for Indian businesses).
- Raw material quantities are integer thousandths of the material's own unit
  (kg, tonne, bag, litre).
- Bricks are whole numbers.
- Typing and display go through `lib/money.ts` / `lib/quantity.ts`, which parse
  decimal strings without ever producing a float, and format with `en-IN` /
  `hi-IN` (lakh/crore grouping).
- Recipe consumption rounds _up_, so the yard never looks fuller than it is.
