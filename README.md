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

## Booking email verification

Both contact and partner calendars now require a six-digit email code before this website loads Calendly. The calendar is https://calendly.com/abiryva-info/30min and is prefilled with the verified email.

Configure RESEND_API_KEY and ENQUIRY_FROM_EMAIL with a verified Resend sender, plus UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from an Upstash Redis database in your hosting environment, then redeploy. These secrets stay on the server. Verification fails closed if configuration or a provider is unavailable. Codes are cryptographically generated, stored as keyed hashes, expire after ten minutes, allow five attempts and are consumed atomically. Requests are limited to five per email and twenty per IP per hour, with a one-minute resend cooldown. No code or address is logged. Stored email addresses expire with the challenge. Update your privacy policy to identify Resend and Upstash as verification processors.

Verify real code delivery, wrong and expired codes, resend, and a completed Calendly booking after deployment. Automated tests mock the providers and cannot establish inbox delivery. This gate proves access to an inbox, not a person's identity or that an address is non-disposable. Calendly is an external public service: someone who already knows its URL can book there directly, and a visitor may change the prefilled email in Calendly. Enforcing verification on every Calendly booking requires an additional Calendly-side control or a booking API integration.


## If the browser shows HTML instead of JSON

The POST /api/booking-verification endpoint must run as a server function. Uploading only HTML/CSS/JS, opening contact.html from disk, or serving this project on static-only hosting cannot send verification emails. On Vercel, import the complete ABIRYVA-main-2 directory as the project root, use the Other framework preset, leave Build Command unset, and keep Output Directory at the project root (do not select a static-only subdirectory). Ensure api/booking-verification.js is deployed as a function. Configure the four verification environment variables above and redeploy. A POST from the live website must return JSON, including JSON errors for missing configuration; an HTML response usually indicates a missing function, a hosting rewrite, or a hosting error page. For other hosts, deploy an equivalent Node server endpoint and route /api/booking-verification to it.
