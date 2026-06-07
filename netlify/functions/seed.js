// netlify/functions/seed.js
// ─────────────────────────────────────────────────────────────
// One-time setup: loads campaign config, 12 districts (real targets),
// sample branches, and the role passwords. Safe to re-run (idempotent).
// Protected by SEED_TOKEN so only you can trigger it.
// ─────────────────────────────────────────────────────────────

const { Store } = require('../../lib/store');
const { hash, defaultCampaign, DISTRICTS, SAMPLE_BRANCHES } = require('../../lib/campaign');

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  // gate
  const token = (event.queryStringParameters && event.queryStringParameters.token) ||
                (event.headers && event.headers['x-seed-token']);
  if (process.env.SEED_TOKEN && token !== process.env.SEED_TOKEN) return json(401, { error: 'Unauthorized' });

  const reset = event.queryStringParameters && event.queryStringParameters.reset === '1';

  // 1) campaign config (don't clobber HO edits unless reset)
  const existing = await Store.getCampaign();
  if (!existing || reset) await Store.setCampaign(defaultCampaign());

  // 2) districts
  for (const d of DISTRICTS) {
    await Store.setDistrict({
      id: d.id, name: d.name, branchCount: d.branchCount,
      junePlan: d.junePlan, depositTarget: d.depositTarget, schoolTarget: d.schoolTarget
    });
  }

  // 3) sample branches — prorate district deposit target across its sample branches
  let branchTotal = 0;
  for (const d of DISTRICTS) {
    const names = SAMPLE_BRANCHES[d.id] || [];
    const per = names.length ? Math.round(d.depositTarget / names.length) : 0;
    for (const nm of names) {
      const id = d.id + '__' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const cur = await Store.getBranch(id);
      await Store.setBranch({
        id, name: nm, districtId: d.id, districtName: d.name,
        depositTarget: per,
        // accounts target: deck baseline 3/staff/day; prototype assumes ~8 staff → ~24/day → use a simple campaign target
        accountsTarget: 720,          // ~ 24/day * 30 days (editable later)
        schoolTarget: 0,              // schools tracked at district level
        password: (cur && cur.password) || null // keep existing pw if re-seeding
      });
      branchTotal++;
    }
  }

  // 4) auth — set role passwords (only if not already set, unless reset)
  let auth = await Store.getAuth();
  if (!auth || reset) {
    auth = {
      ho: hash(process.env.HO_PASSWORD || 'ho-demo-2026'),
      // district passwords: one per district
      district: {},
      // branch passwords: one shared default; HO/branch can change later
      branchDefault: hash(process.env.BRANCH_PASSWORD || 'branch-demo-2026')
    };
    for (const d of DISTRICTS) auth.district[d.id] = hash((process.env.DISTRICT_PASSWORD || 'district-demo') + '-' + d.id);
    await Store.setAuth(auth);
  }

  return json(200, { ok: true, districts: DISTRICTS.length, branches: branchTotal, reset: !!reset });
};
