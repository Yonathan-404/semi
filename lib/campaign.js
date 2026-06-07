// lib/campaign.js
// ─────────────────────────────────────────────────────────────
// Campaign reference data (real targets from the deck) + auth helpers.
// Used by the seed function and by other functions for shared logic.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

// ---- AUTH ----
// Simple salted hash for shared passwords (prototype-grade).
function hash(pw, salt) {
  return crypto.createHmac('sha256', salt || 'boa-dts-2026').update(String(pw)).digest('hex');
}
function makeToken(payload) {
  // signed, stateless token: base64(json).hmac
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret').update(body).digest('base64url');
  return body + '.' + sig;
}
function readToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret').update(body).digest('base64url');
  if (sig !== expect) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
}

// ---- CAMPAIGN CONFIG (HO-editable defaults) ----
function defaultCampaign() {
  return {
    name: '4th Dare to Serve Campaign',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    // bank-wide headline goals (from deck)
    goals: { deposit: 24010029024, accounts: 17010, schools: 66, planMultiplier: 1.5, eligibilityPct: 60 },
    phases: [
      { num: 'Phase 1', name: 'Launch', start: '2026-06-01', end: '2026-06-10' },
      { num: 'Phase 2', name: 'Intensify', start: '2026-06-11', end: '2026-06-20' },
      { num: 'Phase 3', name: 'Final Sprint', start: '2026-06-21', end: '2026-06-30' }
    ],
    // HO-configurable KPI set; branches enter daily increments against these.
    // weights total 100; pillar is informational.
    kpis: [
      { key: 'deposit',  name: 'Deposit Mobilized (ETB)',        weight: 40, alertPct: 50, pillar: 'Dare to Listen / Retain', unit: 'ETB' },
      { key: 'accounts', name: 'New Accounts',                   weight: 25, alertPct: 50, pillar: 'Mass Onboarding',         unit: 'count' },
      { key: 'schools',  name: 'Schools Onboarded',              weight: 10, alertPct: 0,  pillar: 'Dare to Serve Schools',   unit: 'count' },
      { key: 'visits',   name: 'Field Visits',                   weight: 9,  alertPct: 40, pillar: 'Dare to Visit',           unit: 'count' },
      { key: 'hvc',      name: 'HVC Conversions',                weight: 8,  alertPct: 0,  pillar: 'Competitor Swap',         unit: 'count' },
      { key: 'referrals',name: 'Referrals',                      weight: 5,  alertPct: 0,  pillar: 'Dare to Recommend',       unit: 'count' },
      { key: 'idle',     name: 'Idle-Balance Activated (ETB)',   weight: 3,  alertPct: 0,  pillar: 'Dare to Retain',          unit: 'ETB' }
    ],
    rewards: {
      district: [{ rank: '1st', etb: 500000 }, { rank: '2nd', etb: 300000 }, { rank: '3rd', etb: 200000 }],
      branch: [{ rank: '1st', etb: 75000 }, { rank: '2nd', etb: 60000 }, { rank: '3rd', etb: 50000 }, { rank: '4th–6th', etb: '40,000–30,000' }, { rank: '7th–10th', etb: '25,000–10,000' }],
      merchantRM: [{ rank: '1st', etb: 30000 }, { rank: '2nd', etb: 20000 }, { rank: '3rd', etb: 10000 }]
    }
  };
}

// ---- DISTRICTS (real names, branch counts, deposit + school targets) ----
const DISTRICTS = [
  { id: 'central_addis', name: 'Central Addis District', branchCount: 104, junePlan: 4571802994, depositTarget: 6857704491, schoolTarget: 8 },
  { id: 'east_addis',    name: 'East Addis District',    branchCount: 150, junePlan: 4140938652, depositTarget: 6211407978, schoolTarget: 8 },
  { id: 'west_addis',    name: 'West Addis District',    branchCount: 128, junePlan: 2403948825, depositTarget: 3605923238, schoolTarget: 8 },
  { id: 'hawassa',       name: 'Hawassa District',       branchCount: 91,  junePlan: 917761635,  depositTarget: 1376642453, schoolTarget: 6 },
  { id: 'jimma',         name: 'Jimma District',         branchCount: 72,  junePlan: 652815395,  depositTarget: 979223093,  schoolTarget: 6 },
  { id: 'dire_dawa',     name: 'Dire Dawa District',     branchCount: 77,  junePlan: 638310818,  depositTarget: 957466227,  schoolTarget: 6 },
  { id: 'adama',         name: 'Adama District',         branchCount: 78,  junePlan: 633380546,  depositTarget: 950070820,  schoolTarget: 6 },
  { id: 'bahir_dar',     name: 'Bahir Dar District',     branchCount: 121, junePlan: 863200000,  depositTarget: 1294800000, schoolTarget: 6 },
  { id: 'dessie',        name: 'Dessie District',        branchCount: 94,  junePlan: 558671362,  depositTarget: 838007042,  schoolTarget: 6 },
  { id: 'mekelle',       name: 'Mekelle District',       branchCount: 62,  junePlan: 432522455,  depositTarget: 648783682,  schoolTarget: 6 },
  { id: 'digital',       name: 'Digital Banking District', branchCount: 1, junePlan: 118974359,  depositTarget: 178461538,  schoolTarget: 0 },
  { id: 'int_banking',   name: 'Int. Banking Special Br.', branchCount: 1, junePlan: 74358974,   depositTarget: 111538462,  schoolTarget: 0 }
];

// ---- SAMPLE BRANCHES (Phase 1: full Addis lists + a few per outlying district) ----
const SAMPLE_BRANCHES = {
  central_addis: ['Piassa','Arat Kilo','Sidist Kilo','Mexico','Legehar','Churchill Avenue','Tewodros Square','National Theatre','Stadium','Meskel Square','Kazanchis','Bambis','Lideta','Kirkos','Kera','Gofa','Saris','Akaki','Kaliti','Kilinto','Koye Feche','Tulu Dimtu','Gelan','Dukem','Bishoftu','Sululta','Gotera'],
  east_addis: ['Bole','Bole Medhanialem','Bole Arabsa','Bole Bulbula','Gerji','CMC','Ayat','Summit','Megenagna','Kotebe','Kara Kore','Yeka','Wosen','Hayat','Figa','Shola','Ruwanda','Goro','Gurd Shola','Sealite Mihiret','Meri Loki','Jackros','Yeka Abado','Gerji Mebrat','Debre Berhan'],
  west_addis: ['Mercato','Kolfe','Kolfe Keranio','Ayer Tena','Tor Hailoch','Wingate','Asko','Atikilt Tera','Addis Ketema','Menalesh Tera','Coca','Anfo','Bethel','Lebu','Jemo','Jemo Michael','Alem Bank','Lafto','Mebrathail','Keraniyo','Repi','Kessemate','Tafo','Sheger City West','Sebeta','Alem Gena','Burayu','Gefersa'],
  hawassa: ['Hawassa Main','Tabor','Piazza Hawassa'],
  jimma: ['Jimma Main','Hermata','Ginjo'],
  dire_dawa: ['Dire Dawa Main','Kezira','Sabian'],
  adama: ['Adama Main','Franko','Dabe'],
  bahir_dar: ['Bahir Dar Main','Kebele 14','Tana'],
  dessie: ['Dessie Main','Piassa Dessie','Robit'],
  mekelle: ['Mekelle Main','Hadnet','Adi Haki'],
  digital: ['Digital Banking Center'],
  int_banking: ['International Banking Special Branch']
};

module.exports = { hash, makeToken, readToken, defaultCampaign, DISTRICTS, SAMPLE_BRANCHES };
