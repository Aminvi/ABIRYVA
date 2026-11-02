# Client and staff portals

Clients use `/portal.html` for projects, progress, private documents and support requests. Abiryva staff use `/admin.html` to manage workspaces, projects, documents, membership and support replies. Every private request is checked on the server.

## Authentication and environments

Use invite-only Clerk registration with verified email-code sign-in. The owner selected email codes for staff for now. Staff IDs belong only in the server-side `PORTAL_ADMIN_USER_IDS` allowlist. Active staff sessions expire for administration after 30 minutes; sign out and back in to renew. `PORTAL_REQUIRE_STAFF_MFA=true` additionally requires a second factor when configured and supported.

Set `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `APP_DATA_NAMESPACE` and staff IDs separately for each environment. Give each Redis service credential access only to its `abiryva:<namespace>:*` keys and required commands. Production also needs legacy `booking:*` access. Do not use database-owner credentials in an application environment. Preview must use development Clerk credentials, a separate namespace and its restricted Redis credential.

Complete Clerk's five production DNS CNAME records before inviting production users. Keep website, mailbox and Resend records intact. Dashboard accounts are separate from portal accounts. Keep secrets in private environment settings, outside Git and public assets. Rotate credentials by installing and verifying the replacement in its matching environment before retiring the old key.

## Staff workflow

1. Invite an authorised staff account through Clerk. After registration, add its verified user ID to the server allowlist and redeploy.
2. Sign in at `/admin.html`, create a workspace, add projects and upload documents.
3. Invite a client through Clerk. After the client registers and verifies their email, grant that email access to a workspace in the staff portal. A user can belong to one workspace at a time.
4. Review support requests and save replies/statuses in the staff portal. Requests do not send a separate notification email.
5. Revoke client access when required. Membership and Clerk session revocation are checked on subsequent API requests.

Documents are limited to 1 MB each and expire after 90 days. Tickets expire after 90 days; staff replies preserve the original expiry. Workspace records expire 180 days after creation or the latest project/document update. Membership expires 180 days after granting access. Content-free audit events expire after 90 days. Indexes contain IDs and may outlive their records. Provider backups and logs require a separate retention review. Export or renew records before expiry when appropriate.

## Build and verification

Run `npm ci`, `npm test`, `npm run security:headers` and `npm run build`. Only allowlisted public assets enter `public/`; handlers remain under `api/`. Generated bundles, environments and public output are ignored by Git. Confidential files must never enter static folders.

Test a staff user and two separate clients: project changes, protected downloads, support replies, cross-workspace denial, revoked membership and revoked sessions. Use disposable development accounts and data. Verify production DNS, provider settings, environment variables and live responses before treating deployment as ready.

CSP follows [Clerk's guidance](https://clerk.com/docs/guides/secure/best-practices/csp-headers): explicit script hosts and JSON-LD hashes, with inline styles retained for the site and sign-in UI.
