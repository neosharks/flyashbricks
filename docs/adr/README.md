# Architecture decision records

One file per decision that was hard to reverse, or that departs from the
guidelines in `../../../development-guidelines/`. Each states the context, the
decision, and what it costs.

| #                                  | Decision                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| [0001](0001-modular-monolith.md)   | One Next.js app, self-hosted                                 |
| [0002](0002-authentication.md)     | Phone/email credentials, admin-issued temporary passwords    |
| [0003](0003-csp.md)                | A static CSP with no third-party origins                     |
| [0004](0004-multi-tenancy.md)      | Organisation-scoped documents in one database                |
| [0005](0005-integer-quantities.md) | Paise and milli-units, never floats                          |
| [0006](0006-i18n.md)               | English + Hindi by cookie, not URL                           |
| [0007](0007-pwa.md)                | A PWA that caches assets, never data                         |
| [0008](0008-ledgers.md)            | Running balances kept in step with append-only ledgers       |
| [0009](0009-seo.md)                | A small public website per language; everything else noindex |
| [0010](0010-native-install.md)     | Native install from ready-built releases, no Docker          |
