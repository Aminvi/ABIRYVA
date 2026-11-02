# Backend readiness review

This is a source-code review and automated test report, not a penetration test or confirmation of production settings.

## Enquiry source

Fields have type, length, format and consent checks. A service allowlist includes the new five service lines and retains previous IDs for backwards compatibility. Requests are JSON-only and capped at 16 KB in the handler. Honeypot and signed submission token checks remain; tokens require at least two seconds on the page and expire after one hour. The email body is plain text, not HTML. Credentials are read only from server environment variables. Provider errors return generic messages, and application logs contain status or event names only.

Added shared Redis rate limits: ten valid submissions per IP per hour and five per email per hour. Keys contain keyed HMAC identifiers, with one-hour TTL. The Vercel forwarded IP header is trusted only in the Vercel deployment environment; other hosting needs a trusted proxy configuration. Missing Redis configuration disables delivery. Limits fail closed on storage errors. Add Vercel Firewall rate limits at the edge for /api/enquiry and /api/booking-verification as well, including token requests, to reduce work before function execution. Existing honeypots, signed tokens and rate limits are layered controls, not proof of a human visitor.

## Response settings

Executable inline scripts have been moved to local files. CSP no longer allows unsafe-inline scripts. JSON-LD has explicit SHA-256 hashes. Inline styles remain permitted to preserve existing styling. Clerk domains are allowlisted for portal authentication. Static page settings explicitly restrict Access-Control-Allow-Origin to https://www.abiryva.com. This override excludes API routes; API handlers do not set a wildcard. Live response verification is still required. API POSTs retain explicit origin checks.

## Hosting checks still required

- Confirm production secrets, scope and provider ownership in Vercel and Resend. Resend key should have sending-only access to the verified Abiryva domain. Rotate through provider dashboards and update server environment variables, then redeploy.
- Inspect Vercel runtime/access logs, configured drains, platform retention and any observability integrations. Code-level log minimisation does not control platform logging.
- Confirm Resend email-body/log retention and mailbox retention. Confirm Upstash backup settings, data residency and retention. Do not claim provider content is never retained.
- Verify the deployed response headers and Firewall rules. Test actual inbox delivery, configured rate limits, failure states and two-client portal isolation.
- Confirm the contracting entity name, registration jurisdiction and company details before revising legal identity claims. An Ireland contact address is not evidence of Irish incorporation. No legal entity or incorporation fact has been inferred or changed in this revision.

## Portal readiness

Managed Clerk authentication and server-side workspace membership isolate clients. Tenant IDs come only from server-managed membership records. Documents are served as attachment downloads through authenticated API access, with no public document links. Support requests have input limits and per-user quotas. A Clerk application and three disposable development accounts have been provisioned with owner approval. Production DNS and first staff onboarding must be completed before use. The staff dashboard manages projects, documents, membership and ticket replies; staff IDs are server-controlled, with active-session checks and a 30-minute staff session limit. The owner selected email-code sign-in for now; second-factor enforcement is optional configuration. See PORTAL-SETUP.md for deployment and staff operation. Do not treat the portal as production-ready until authentication, provider configuration, real-account isolation tests and operational retention checks are complete.

## Configuration observations, 2 November 2026

Vercel environment metadata confirmed server-side Resend and Redis variables, including sensitive secret types. No configured log drains were returned. Runtime log inspection did not complete successfully, so platform logs and their retention remain unverified. A custom Firewall configuration was not returned; this does not establish that Vercel platform protections are disabled. No paid changes or firewall publication were made.

Separate development, branch-preview and production Redis ACL credentials were created. Read/write access within each namespace passed; cross-namespace reads and Lua script escape attempts were rejected by Redis. Production retains access to legacy booking keys. These checks do not verify provider backups or account-level log retention.

Resend's published standard retention is 30 days for emails/logs: https://resend.com/security/gdpr. Account-specific settings and mailbox retention still need confirmation. Public privacy wording now distinguishes application log minimisation from provider retention. No company registration facts have been invented.
