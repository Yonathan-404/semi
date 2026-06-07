// netlify/functions/data.js
// ─────────────────────────────────────────────────────────────
// Core data API for the campaign system. Role-scoped:
//   branch   → submit/read its own daily entries
//   district → read all its branches (aggregated)
//   ho       → read everything (national + per district + per branch)
// Action is chosen via ?action=... ; token enforces scope.
// ─────────────────────────────────────────────────────────────

const { Store } = require('../../lib/store');
const { readToken } = require('../../lib/campaign');

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(body) };
}
function auth(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const token = h.replace(/^Bearer\s+/i, '');
  return readToken(token);
}

// sum an array of entries' kpi values into a totals object
function sumEntries(entries, kpis) {
  const t = {};
  kpis.forEach((k) => { t[k.key] = 0; });
  entries.forEach((e) => { (kpis).forEach((k) => { t[k.key] += (e.values && e.values[k.key]) || 0; }); });
  return t;
}
// weighted achievement score (0..100+) of totals vs a target map
function scoreTotals(totals, kpis, targetMap) {
  let s = 0, w = 0;
  kpis.forEach((k) => {
    const tgt = targetMap[k.key];
    if (tgt && tgt > 0) { s += (totals[k.key] / tgt) * k.weight; w += k.weight; }
  });
  return w > 0 ? (s / w * 100) : 0;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  const session = auth(event);
  if (!session) return json(401, { error: 'Not logged in' });
  const action = (event.queryStringParameters && event.queryStringParameters.action) || '';
  const campaign = await Store.getCampaign();
  const kpis = (campaign && campaign.kpis) || [];

  // ---------- BRANCH: submit a day's increment ----------
  if (action === 'submitEntry') {
    if (session.role !== 'branch') return json(403, { error: 'Only branches submit entries' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const { date, values, notes } = body;
    if (!date || !values) return json(400, { error: 'Missing date or values' });
    const entry = { branchId: session.scopeId, districtId: session.districtId, date, values, notes: notes || '', updatedAt: new Date().toISOString() };
    await Store.setEntry(entry);
    return json(200, { ok: true, entry });
  }

  // ---------- BRANCH: read own dashboard ----------
  if (action === 'branchView') {
    // A branch is ALWAYS locked to its own id, regardless of any query param.
    let branchId;
    if (session.role === 'branch') branchId = session.scopeId;
    else branchId = (event.queryStringParameters && event.queryStringParameters.branchId);
    if (!branchId) return json(400, { error: 'Missing branchId' });
    const branch = await Store.getBranch(branchId);
    if (!branch) return json(404, { error: 'Branch not found' });
    if (session.role === 'district' && branch.districtId !== session.scopeId) return json(403, { error: 'Forbidden' });
    const entries = await Store.listEntriesByBranch(branchId);
    const totals = sumEntries(entries, kpis);
    const targetMap = { deposit: branch.depositTarget, accounts: branch.accountsTarget, schools: branch.schoolTarget };
    const score = scoreTotals(totals, kpis, targetMap);
    return json(200, { branch, entries: entries.sort((a, b) => a.date < b.date ? 1 : -1), totals, score, kpis, targetMap });
  }

  // ---------- DISTRICT: league table of its branches ----------
  if (action === 'districtView') {
    const districtId = session.role === 'district' ? session.scopeId : (event.queryStringParameters && event.queryStringParameters.districtId);
    if (!districtId) return json(400, { error: 'Missing districtId' });
    if (session.role === 'district' && districtId !== session.scopeId) return json(403, { error: 'Forbidden' });
    if (session.role === 'branch') return json(403, { error: 'Forbidden' });
    const district = await Store.getDistrict(districtId);
    const branches = await Store.listBranchesByDistrict(districtId);
    const allEntries = await Store.listAllEntries();
    const rows = branches.map((b) => {
      const ent = allEntries.filter((e) => e.branchId === b.id);
      const totals = sumEntries(ent, kpis);
      const targetMap = { deposit: b.depositTarget, accounts: b.accountsTarget, schools: b.schoolTarget };
      const reported = ent.length;
      return { id: b.id, name: b.name, totals, depositTarget: b.depositTarget, score: scoreTotals(totals, kpis, targetMap), reportedDays: reported };
    }).sort((a, b) => b.score - a.score);
    const distDeposit = rows.reduce((s, r) => s + (r.totals.deposit || 0), 0);
    return json(200, { district, rows, kpis, distDeposit });
  }

  // ---------- HO: national overview ----------
  if (action === 'hoView') {
    if (session.role !== 'ho') return json(403, { error: 'HO only' });
    const districts = await Store.listDistricts();
    const branches = await Store.listBranches();
    const allEntries = await Store.listAllEntries();
    const nat = sumEntries(allEntries, kpis);
    // per-district roll-up
    const distRows = districts.map((d) => {
      const dBranches = branches.filter((b) => b.districtId === d.id);
      const dEntries = allEntries.filter((e) => e.districtId === d.id);
      const totals = sumEntries(dEntries, kpis);
      const reportedBranches = new Set(dEntries.map((e) => e.branchId)).size;
      const depPct = d.depositTarget > 0 ? (totals.deposit / d.depositTarget * 100) : 0;
      return {
        id: d.id, name: d.name, branchCount: d.branchCount, sampleBranches: dBranches.length,
        depositTarget: d.depositTarget, depositActual: totals.deposit || 0, depositPct: depPct,
        accounts: totals.accounts || 0, schools: totals.schools || 0,
        reportedBranches, score: depPct
      };
    }).sort((a, b) => b.depositPct - a.depositPct);
    const goals = (campaign && campaign.goals) || {};
    return json(200, {
      campaign, kpis,
      national: {
        deposit: nat.deposit || 0, depositTarget: goals.deposit || 0,
        accounts: nat.accounts || 0, accountsTarget: goals.accounts || 0,
        schools: nat.schools || 0, schoolsTarget: goals.schools || 0,
        totalBranches: branches.length, reportedBranches: new Set(allEntries.map((e) => e.branchId)).size
      },
      districts: distRows
    });
  }

  // ---------- HO: update campaign config (KPIs/targets/dates) ----------
  if (action === 'setCampaign') {
    if (session.role !== 'ho') return json(403, { error: 'HO only' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    if (!body.campaign) return json(400, { error: 'Missing campaign' });
    await Store.setCampaign(body.campaign);
    return json(200, { ok: true });
  }

  // ---------- lookup lists for login screens ----------
  if (action === 'directory') {
    const districts = await Store.listDistricts();
    const branches = await Store.listBranches();
    return json(200, {
      districts: districts.map((d) => ({ id: d.id, name: d.name })),
      branches: branches.map((b) => ({ id: b.id, name: b.name, districtId: b.districtId }))
    });
  }

  return json(400, { error: 'Unknown action' });
};
