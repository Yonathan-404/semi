# Dare to Serve — Campaign Management System (Phases 1+2)

Bank of Abyssinia · 3-tier campaign system: **Head Office → District → Branch**.

## What this is
A shared web app (one backend, one database) where:
- **Branches** enter daily KPI increments for their officers' work.
- **Districts** see a league table of their branches and drill in.
- **Head Office** sees the national dashboard, every district & branch, reporting
  coverage, controls the campaign KPIs/weights, and views reward tiers.

Built on **Netlify Functions + Netlify Blobs** (prototype). The data layer
(`lib/store.js`) is swappable — moving to Supabase later means rewriting only
that one file.

## Files
```
public/            ← the website (login, branch, district, ho pages)
  index.html        login (role picker)
  branch.html       branch workspace (daily entry + dashboard)
  district.html     district league table + drill-down
  ho.html           HO national dashboard + KPI control + rewards
  app.css, app.js   shared styling + API client
netlify/functions/ ← the private backend
  seed.js           one-time setup (loads 12 districts, targets, branches, passwords)
  login.js          role login → signed token
  data.js           core API (submit/read, role-scoped)
  directory.js      public list of districts/branches (login dropdowns only)
lib/
  store.js          SWAPPABLE data layer (Netlify Blobs now, Supabase later)
  campaign.js       real district targets + auth helpers + KPI defaults
netlify.toml, package.json
```

## Deploy (≈10 min)
1. Put these files in a **private** Git repo; connect to Netlify.
2. Netlify → Site configuration → Environment variables, set:
   | Key | Example | Purpose |
   |-----|---------|---------|
   | `SESSION_SECRET` | long random string | signs login tokens |
   | `SEED_TOKEN` | long random string | protects the seed endpoint |
   | `HO_PASSWORD` | choose one | Head Office login |
   | `DISTRICT_PASSWORD` | choose one | base for district logins (becomes `<pw>-<districtId>`) |
   | `BRANCH_PASSWORD` | choose one | shared branch login |
3. Deploy. Then run the seed once in your browser:
   `https://YOURSITE/.netlify/functions/seed?token=YOUR_SEED_TOKEN`
   (add `&reset=1` to reset KPIs/passwords to defaults.)
4. Open the site → sign in.

### Demo passwords (if you don't set env vars)
- HO: `ho-demo-2026`
- District: `district-demo-<districtId>` e.g. `district-demo-east_addis`
- Branch: `branch-demo-2026`
(Set real env vars before sharing — see above.)

## Honest limitations (read before showing widely)
- **Prototype storage.** Netlify Blobs is fine for sample branches; for all 979
  real branches with heavy traffic, migrate the data layer to Supabase/Postgres.
- **Shared passwords.** Simple by design (your choice). For production, individual
  accounts / SSO and audit logging would be needed — that's an IT/Security step.
- **Real customer/deposit data** crossing into a central store needs bank IT &
  data-protection sign-off. Treat this as a working proof-of-concept to win buy-in,
  not the production system yet.
- **Sample branches only** are loaded (your full Addis lists + a few per outlying
  district). Loading all 979 needs a branch list file.
- Tested thoroughly against an in-memory mock of the database; confirm behavior on
  a real Netlify deploy (live Blobs + env vars) before relying on it.

## Roadmap (Phase 3 ideas)
Reward/certificate generation, exports (Excel/PDF) for management meetings,
national leaderboards for announcements, kiosk/TV mode, per-officer breakdown
inside each branch, and the Supabase migration when you're ready to scale.
