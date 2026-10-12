# 0002 — Phone/email credentials, admin-issued temporary passwords

**Status:** accepted

## Context

There is no sign-up: an admin creates every account. Many plant staff have a
phone number but no email address. Access must be revocable immediately — an
employee who leaves must lose access now, not when a token expires.

## Decision

- Auth.js v5 with the Credentials provider. The identifier is a ten-digit
  Indian phone number or an email address; both are unique across the system.
- An admin creating or resetting an account gets a generated temporary
  password, shown once. `mustChangePassword` then confines that session to
  `/set-password` (enforced in `requireUser`, not just by redirect).
- JWT session strategy (Credentials requires it) carrying only the user id.
  The `session` callback re-reads role, permissions and status from MongoDB on
  every request and refuses tokens issued before `sessionsValidFrom`, which is
  bumped on password change, reset, disable and "sign out everywhere".
- bcrypt cost 12; same error and comparable timing for unknown accounts;
  rate limits per IP and per identifier; every attempt against a known account
  is written to `login_events` (shown on the employee's page).

## Consequences

- Revocation and permission changes take effect on the next request, at the
  cost of one indexed lookup per request (deduplicated per render).
- Active sessions cannot be listed individually (stateless tokens); "sign out
  everywhere" is the control instead. Login history covers the audit need.
- SMS/WhatsApp OTP login can be added later as a second provider.
