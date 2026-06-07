// lib/store.js
// ─────────────────────────────────────────────────────────────
// SWAPPABLE DATA LAYER — Dare to Serve Campaign System
//
// Every database read/write in the whole app goes through this one
// module. Today it is backed by Netlify Blobs (prototype). To move to
// Supabase/Postgres later, you ONLY rewrite the functions in this file —
// the rest of the app never changes because it only calls these methods.
//
// Keys are namespaced "table:id" so the same shape maps cleanly onto SQL
// rows later (e.g. table "branches", primary key id).
// ─────────────────────────────────────────────────────────────

const { getStore } = require('@netlify/blobs');

function store() {
  // One logical "database". Strong consistency so reads see latest writes.
  return getStore({ name: 'daretoserve', consistency: 'strong' });
}

// ---- low-level helpers ----
async function get(key) {
  try {
    const v = await store().get(key, { type: 'json' });
    return v || null;
  } catch (e) { return null; }
}
async function set(key, value) {
  await store().setJSON(key, value);
  return value;
}
async function del(key) {
  await store().delete(key);
}
async function list(prefix) {
  // Returns array of {key} under a prefix, then we fetch each.
  const out = [];
  const { blobs } = await store().list({ prefix });
  for (const b of blobs) {
    const v = await get(b.key);
    if (v) out.push(v);
  }
  return out;
}

// ---- domain-shaped API (this is what the rest of the app uses) ----
const Store = {
  // CAMPAIGN CONFIG (single record): KPIs, dates, phases, reward tiers
  getCampaign: () => get('campaign:current'),
  setCampaign: (cfg) => set('campaign:current', cfg),

  // DISTRICTS
  getDistrict: (id) => get('district:' + id),
  listDistricts: () => list('district:'),
  setDistrict: (d) => set('district:' + d.id, d),

  // BRANCHES
  getBranch: (id) => get('branch:' + id),
  listBranches: () => list('branch:'),
  listBranchesByDistrict: async (districtId) =>
    (await list('branch:')).filter((b) => b.districtId === districtId),
  setBranch: (b) => set('branch:' + b.id, b),

  // OFFICERS (belong to a branch)
  listOfficersByBranch: async (branchId) =>
    (await list('officer:')).filter((o) => o.branchId === branchId),
  setOfficer: (o) => set('officer:' + o.id, o),
  delOfficer: (id) => del('officer:' + id),

  // DAILY ENTRIES — one record per branch per date (daily increments)
  // key: entry:<branchId>:<YYYY-MM-DD>
  getEntry: (branchId, date) => get('entry:' + branchId + ':' + date),
  setEntry: (e) => set('entry:' + e.branchId + ':' + e.date, e),
  listEntriesByBranch: async (branchId) =>
    (await list('entry:' + branchId + ':')),
  listAllEntries: () => list('entry:'),

  // AUTH — role passwords (hashed) and session-ish lookups
  getAuth: () => get('auth:config'),
  setAuth: (a) => set('auth:config', a),

  // raw escape hatches (rarely needed)
  _get: get, _set: set, _del: del, _list: list
};

module.exports = { Store };
