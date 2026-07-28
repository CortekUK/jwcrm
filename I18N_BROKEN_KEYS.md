# i18n Translation Key Audit — RESOLVED

Re-run the checker at any time with `python3 scripts/check-i18n-keys.py`.

## Result

| Check | Before | After |
|---|---|---|
| Keys rendering as raw text (missing in EN) | **1,406 occurrences / 928 unique** | **0** |
| Keys present in EN but missing in AR | 36 | **0** |
| Dynamic `t(`...${x}`)` keys | 143 unverified | all 25 families enumerated & resolved |

## What was done

**1,006 unique keys added** to `src/locales/{en,ar}/*.json` — every one with both an English string and a Modern Standard Arabic translation:
- 930 statically-resolvable keys that were missing from EN entirely
- 59 keys behind dynamic template-literal lookups (enumerated from their TS unions / DB enums / option constants)
- 35 keys that existed in EN but had no AR counterpart
- 37 further EN-only keys not referenced by the checker (unused but would have fallen back to English)

The `hr` namespace was the worst affected — `reviews`, `kpiOverview`, `analytics`, `reports`, `attendanceAlerts`, `leavePage` and `legalNotice` did not exist in `hr.json` at all.

## Source changes (6 files) — string/object collisions

i18next cannot hold a plain string and an object at the same key path. Three families were unfixable in JSON alone and were renamed in code:

| Was | Now | Reason | Files |
|---|---|---|---|
| `leadManagement:status.*` | `leadManagement:leadStatus.*` | `status` already a string `"Status"` | `admin/lead-management/reports/page.tsx`, `admin/salesperson/reports/page.tsx` |
| `hr:leaveTypes.*` | `hr:leaveTypeLabels.*` | `leaveTypes` already a string `"Leave Types"` | `admin/hr/reports/page.tsx`, `hr/reports/page.tsx` |
| `finance:status.*` | `finance:invoiceStatus.*` | `status` already a string `"Status"` | `finance/FinanceCharts.tsx`, `finance/InvoiceTable.tsx` |

These would have rendered raw keys forever regardless of what was added to the JSON.

## Current key counts (EN/AR now at full parity)

| Namespace | EN | AR |
|---|---|---|
| `common` | 73 | 73 |
| `auth` | 86 | 86 |
| `portal` | 263 | 263 |
| `admin` | 420 | 420 |
| `form` | 631 | 631 |
| `landing` | 51 | 51 |
| `pdf` | 159 | 159 |
| `toast` | 188 | 190 |
| `hr` | 1323 | 1323 |
| `finance` | 190 | 190 |
| `leadManagement` | 625 | 625 |
| `salesperson` | 84 | 84 |
| **total** | **4093** | **4095** |

The only remaining EN/AR delta is 2 pre-existing Arabic-only keys in `toast.json`
(`upload.photoUploadedSuccess`, `upload.photoRemovedSuccess`) which are referenced by no code.

## Verification

```
BROKEN KEYS (missing in EN namespaces) — 0 occurrences
EN ok but MISSING IN AR — 0 occurrences
```

`npx tsc --noEmit` reports 496 pre-existing errors under `src/` both before and after these changes — no new type errors were introduced.
