# Abiryva website

Static HTML site with a Vercel Node.js enquiry function. No build step is required.

## Enquiry delivery

Add `RESEND_API_KEY` and `ENQUIRY_FROM_EMAIL` in the Vercel project's production environment, using a verified sender domain. `ENQUIRY_TO_EMAIL` defaults to `info@abiryva.com`. Redeploy after configuring them. Never place API keys in HTML or client-side JavaScript.

Until delivery is configured, the page shows booking and email alternatives instead of an unusable form. The API checks origin, field lengths, consent, a signed short-lived submission token and a honeypot. Resend idempotency prevents duplicate sends during retries. Configure production rate limiting for `/api/enquiry` in the Vercel Firewall before enabling delivery. No enquiry bodies or email addresses are logged.

Verify one real submission and receipt after configuring delivery. Local tests mock Resend; they do not prove inbox delivery.

## Content still requiring owner evidence

No leadership identities, photos, registration numbers, complete address, project timelines, baselines, client permissions or external social profiles were provided. Add verified facts before publishing those details. Existing project claims are retained and the client ISO certification is labelled accordingly. Review the privacy text against your actual retention and business practices.

## Validation

`node --test tests/enquiry.test.js` verifies validation, provider failure, safe unconfigured behaviour and retry idempotency. `python tests/check_site.py` checks local links, anchors, metadata and document structure (requires BeautifulSoup).

Calendly is optional and loads only after the visitor explicitly clicks its load button. Direct booking, phone and email links remain available. Privacy choices use one shared local-storage key across pages.
