const store = require('./store');
const configured = () => Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY && store.ready());
async function authenticate(req) {
  const bearer = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!bearer) throw Object.assign(new Error('Please sign in.'), { status: 401 });
  try {
    const { verifyToken, createClerkClient } = require('@clerk/backend');
    const parties = ['https://www.abiryva.com', 'https://abiryva.com', 'https://abiryva.vercel.app'];
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (host) parties.push('https://' + host);
    if (process.env.NODE_ENV === 'development') { parties.push('http://localhost:3000'); if (/^http:\/\/localhost:\d+$/.test(process.env.LOCAL_APP_ORIGIN || '')) parties.push(process.env.LOCAL_APP_ORIGIN); }
    const claims = await verifyToken(bearer[1], { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: parties });
    if (!/^user_[a-zA-Z0-9]+$/.test(claims.sub || '') || !claims.sid) throw new Error('Not a user session');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const session = await clerk.sessions.getSession(claims.sid);
    if (session.status !== 'active' || session.userId !== claims.sub) throw new Error('Inactive session');
    const admin = (process.env.PORTAL_ADMIN_USER_IDS || '').split(',').map(x => x.trim()).includes(claims.sub);
    // The owner selected email-code staff sign-in; MFA can be required separately.
    const mfa = Array.isArray(claims.fva) && Number.isFinite(claims.fva[1]) && claims.fva[1] >= 0;
    return { userId: claims.sub, admin, mfa, sessionStartedAt: session.createdAt, clerk };
  } catch { throw Object.assign(new Error('Your session expired or could not be verified. Please sign in again.'), { status: 401 }); }
}
function requireAdmin(actor) {
  if (!actor.admin) throw Object.assign(new Error('Staff access is required.'), { status: 403 });
  const age = Date.now() - actor.sessionStartedAt;
  if (!Number.isFinite(age) || age < -60000 || age > 30 * 60 * 1000) throw Object.assign(new Error('For staff access, please sign out and sign in again. Staff sessions are limited to 30 minutes.'), { status: 403 });
  if (process.env.PORTAL_REQUIRE_STAFF_MFA === 'true' && !actor.mfa) throw Object.assign(new Error('Staff access requires multi-factor authentication. Enable a second factor in your account and sign in again.'), { status: 403 });
}
module.exports = { configured, authenticate, requireAdmin };
