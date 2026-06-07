// netlify/functions/login.js
// ─────────────────────────────────────────────────────────────
// Login for the three roles. Returns a signed token carrying the
// role and (for district/branch) the scope id. The token is what
// every other function checks to enforce "you only see your slice".
// ─────────────────────────────────────────────────────────────

const { Store } = require('../../lib/store');
const { hash, makeToken } = require('../../lib/campaign');

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
  const { role, scopeId, password } = body; // role: 'ho' | 'district' | 'branch'
  if (!role || !password) return json(400, { error: 'Missing role or password' });

  const auth = await Store.getAuth();
  if (!auth) return json(500, { error: 'System not seeded yet' });

  const h = hash(password);

  if (role === 'ho') {
    if (h !== auth.ho) return json(401, { error: 'Wrong password' });
    return json(200, { token: makeToken({ role: 'ho' }), role: 'ho', name: 'HO Campaign Department' });
  }

  if (role === 'district') {
    const d = await Store.getDistrict(scopeId);
    if (!d) return json(404, { error: 'District not found' });
    if (h !== auth.district[scopeId]) return json(401, { error: 'Wrong password' });
    return json(200, { token: makeToken({ role: 'district', scopeId }), role: 'district', name: d.name });
  }

  if (role === 'branch') {
    const b = await Store.getBranch(scopeId);
    if (!b) return json(404, { error: 'Branch not found' });
    // branch uses its own password if set, else the shared default
    const ok = (b.password && h === b.password) || h === auth.branchDefault;
    if (!ok) return json(401, { error: 'Wrong password' });
    return json(200, { token: makeToken({ role: 'branch', scopeId, districtId: b.districtId }), role: 'branch', name: b.name, districtId: b.districtId });
  }

  return json(400, { error: 'Unknown role' });
};
