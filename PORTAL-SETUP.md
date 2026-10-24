# Client portal setup

The portal supports client project progress, authenticated document downloads and support requests. It does not create public client workspaces or trust client IDs supplied by visitors. Each Clerk user is assigned a workspace in Redis by Abiryva staff. Client access is read-only except for submitting support requests.

## Hosting and authentication

1. Create a Clerk application and configure sign-in for invited clients. Configure verified email sign-in and require MFA for staff. Disable public sign-up if you want invite-only accounts. No Clerk account has been provisioned by this code change.
2. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel's server environment, alongside UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. The public key alone is returned to the browser. Secrets never enter HTML, the browser bundle or GitHub.
3. Set the Clerk production frontend domain to clerk.abiryva.com, or amend the script/connect/frame CSP allowlists in vercel.json for your actual Clerk frontend domain. The development *.clerk.accounts.dev domain is allowed for testing. Complete Clerk's production DNS configuration.
4. Use npm ci and npm run build. Vercel uses npm run build; the configured Output Directory is public/. The build copies only public website assets there; API functions remain in the root api/ directory. The generated js/portal-bundle.js is ignored by Git and produced by the build. Do not expose .env files. Existing Vercel environment variables must be configured separately from local .env.local.
5. Invite the client in Clerk. Obtain their Clerk user ID. Use the local staff tool below to provision workspace access. No live client data has been inserted.
6. Verify that two separate clients cannot see each other's workspace, files or tickets using two test accounts before enabling client invitations. Test sign-out, expired sessions and revoked membership as well.

## Staff provisioning

Run from the repository root with a private .env.local containing Redis credentials. Staff access is intentionally a local administration tool, not a public admin API. Do not commit the input JSON or documents.

Create a local JSON file containing:

    {"name":"Client display name","projects":[{"name":"Engagement name","status":"In progress","progress":35,"summary":"Agreed scope","nextStep":"Next agreed milestone"}],"documents":[{"id":"project-brief","name":"Project brief","filename":"brief.pdf"}]}

Provision it:

    node --env-file=.env.local scripts/portal-admin.cjs workspace client-slug /private/path/workspace.json
    node --env-file=.env.local scripts/portal-admin.cjs grant client-slug user_CLERK_USER_ID
    node --env-file=.env.local scripts/portal-admin.cjs document client-slug project-brief /private/path/brief.pdf

Documents are limited to 1 MB each and expire after 90 days. Re-provision a document when it is updated or needs to remain available. Documents are retrieved through the authenticated API, not public static URLs. Never place confidential files in images/, the repository or public hosting folders.

Revoke a user:

    node --env-file=.env.local scripts/portal-admin.cjs revoke client-slug user_CLERK_USER_ID

Export support requests to a private local file and update a request status:

    node --env-file=.env.local scripts/portal-admin.cjs tickets client-slug /private/path/requests.json
    node --env-file=.env.local scripts/portal-admin.cjs ticket-status client-slug TICKET_ID "In progress"

Statuses: Open, In progress, Resolved. Messages expire after 90 days and the index is bounded to 500 IDs. The UI shows the most recent 50 requests. Submission saves to the workspace; it does not send a separate email notification. Staff should review requests through the local export until a staff dashboard or notification workflow is commissioned. Workspace and membership records require explicit removal to meet the agreed retention policy; provider backup/log retention must be assessed separately.

CSP configuration follows Clerk’s official guidance: https://clerk.com/docs/guides/secure/best-practices/csp-headers. Only styles permit unsafe-inline; script execution remains restricted to self, explicit hosts and JSON-LD hashes.
