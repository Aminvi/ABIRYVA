# Backend readiness review

This is a source-code review and automated test report, not a penetration test or confirmation of production settings.

## Enquiry source

Fields have type, length, format and consent checks. A service allowlist includes the new five service lines and retains previous IDs for backwards compatibility. Requests are JSON-only and capped at 16 KB in the handler. Honeypot and signed submission token checks remain; tokens require at least two seconds on the page and expire after one hour. The email body is plain text, not HTML. Credentials are read only from server environment variables. Provider errors return generic messages, and application logs contain status or event names only.

Added shared Redis rate limits: ten valid submissions per IP per hour and five per email per hour. Keys contain hashed identifiers, with one-hour TTL. The Vercel forwarded IP header is trusted only in the Vercel deployment environment; other hosting needs a trusted proxy configuration. Missing Redis configuration disables delivery. Limits fail closed on storage errors. Add Vercel Firewall rate limits at the edge for /api/enquiry and /api/booking-verification as well, including token requests, to reduce work before function execution. Existing honeypots, signed tokens and rate limits are layered controls, not proof of a human visitor.

## Response settings

Executable inline scripts have been moved to local files. CSP no longer allows unsafe-inline scripts. JSON-LD has explicit SHA-256 hashes. Inline styles remain permitted to preserve existing styling. Clerk domains are allowlisted for portal authentication. No Access-Control-Allow-Origin header is configured in repository response settings or API handlers. If production still emits a wildcard, inspect Vercel project, edge/proxy and upstream settings; source changes alone cannot establish its origin. API POSTs retain explicit origin checks.

## Hosting checks still required

- Confirm production secrets, scope and provider ownership in Vercel and Resend. Resend key should have sending-only access to the verified Abiryva domain. Rotate through provider dashboards and update server environment variables, then redeploy.
- Inspect Vercel runtime/access logs, configured drains, platform retention and any observability integrations. Code-level log minimisation does not control platform logging.
- Confirm Resend email-body/log retention and mailbox retention. Confirm Upstash backup settings, data residency and retention. Do not claim provider content is never retained.
- Verify the deployed response headers and Firewall rules. Test actual inbox delivery, configured rate limits, failure states and two-client portal isolation.
- Confirm the contracting entity name, registration jurisdiction and company details before revising legal identity claims. An Ireland contact address is not evidence of Irish incorporation. No legal entity or incorporation fact has been inferred or changed in this revision.

## Portal readiness

Managed Clerk authentication and server-side workspace membership isolate clients. Tenant IDs come only from server-managed membership records. Documents are served as attachment downloads through authenticated API access, with no public document links. Support requests have input limits and per-user quotas. No client records have been seeded and no auth account has been provisioned. See PORTAL-SETUP.md for deployment and staff operation. Do not treat the portal as production-ready until authentication, provider configuration, real-account isolation tests and operational retention checks are complete.
