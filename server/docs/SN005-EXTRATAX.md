# SN005 / `extraTax` — PRAL clarification required

## Scenario

- Sandbox scenario: **SN005** (Goods at Reduced Rate / Eighth Schedule)
- Example HS Code under discussion: `0102.2930`
- SRO schedule text often used in samples: `EIGHTH SCHEDULE Table 1`
- Official PRAL sandbox JSON sample for SN005 sends:

```json
"extraTax": ""
```

(empty **string**, not `0`, not omitted, not `null`)

## Observed validator conflict (reported)

| Payload choice | Reported FBR error |
| --- | --- |
| `extraTax: 0` | `0091` — extra tax must be empty for the applicable reduced-rate sale |
| Omitting `extraTax` | `0300` — numeric ExtraTax required |

This application **does not** hardcode a workaround (switching between `0`, `""`, `null`, or omission).

## Application behaviour

1. The form lets you set Extra Tax to empty or a number.
2. Whatever is saved is sent to FBR unchanged in the mapped payload.
3. The **complete original FBR response** is stored on the invoice and shown in the UI.
4. Tax rate, SRO item serial, and sale type remain user-editable. No assumed `10%` (or other) rate is invented for this HS code.

## Action needed

Ask PRAL / FBR support to confirm the correct `extraTax` representation for SN005 reduced-rate lines when the sale type is `Goods at Reduced Rate`, and which SRO item serial applies for the HS code in use.

Until clarified, treat sandbox validation failures on this field as **external specification conflict**, not an application bug.
