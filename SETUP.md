# Hifzhelper — GitHub & Cloudflare Setup Manifest

Do these in order. Each step says which tool (GitHub / Cloudflare dashboard /
your terminal) it happens in.

## 1. Repository (GitHub)

- [ ] Push this repo to GitHub if it isn't already there.
- [ ] Create a `dev` branch from `main`: `git checkout -b dev && git push -u origin dev`
- [ ] (Optional but recommended) In GitHub repo Settings → Branches, protect
      `main` — require a pull request before merging, so nothing lands in
      production without going through `dev` first.

## 2. D1 databases (Cloudflare dashboard, or terminal)

Two databases — never share one between dev and prod.

Dashboard: **Workers & Pages → D1 → Create Database**, twice:
- `hifzhelper-maktab1` (production)
- `hifzhelper-maktab1-dev` (development)

Or terminal, from `worker/`:
```
wrangler d1 create hifzhelper-maktab1
wrangler d1 create hifzhelper-maktab1-dev
```

- [ ] Copy each database's ID into `worker/wrangler.jsonc` — replace
      `<FILL_IN_PRODUCTION_DATABASE_ID>` and `<FILL_IN_DEVELOPMENT_DATABASE_ID>`.
- [ ] Commit that change.

## 3. Apply migrations (terminal, from `worker/`)

```
npm install
npm run migrate:dev     # applies worker/migrations/*.sql to the dev database
npm run migrate:prod    # applies the same migrations to the production database
```
Both databases now have identical schema — this is what keeps dev and prod
from drifting apart structurally.

## 4. Secrets (Cloudflare dashboard — do this per environment, see step 5)

Two secrets the Worker needs, neither of which goes in any file or git:
- `HH_AUTH_SECRET` — signs login tokens. Generate a long random string
  (e.g. `openssl rand -base64 32`).
- `HH_PEPPER` — mixed into PIN hashing. Generate a separate random string
  the same way.

**Use different values for dev and prod** — a dev secret leaking is a much
smaller problem than a production one.

## 5. Create the two Worker projects (Cloudflare dashboard)

**Production Worker:**
- Workers & Pages → Create Application → Create Worker → name it `hifzhelper-api`
- Settings → Builds → Connect → select this GitHub repo → production branch: `main`
- Settings → Variables and Bindings → add the `HH_AUTH_SECRET` and `HH_PEPPER`
  secrets (production values) → add D1 binding `DB` → `hifzhelper-maktab1`

**Development Worker:**
- Create Application → Create Worker → name it `hifzhelper-api-dev`
- Settings → Builds → Connect → same repo → production branch setting: `dev`
  (this is the branch *this* Worker project watches, even though it's not
  called "production" in your workflow — that's just Cloudflare's field name)
- Settings → Variables and Bindings → add `HH_AUTH_SECRET` / `HH_PEPPER`
  (dev values) → add D1 binding `DB` → `hifzhelper-maktab1-dev`

- [ ] Since the repo root now contains `frontend/`, `worker/`, and `shared/`,
      set each Worker project's **Build → Root directory** to `worker/` so it
      only builds the Worker, not the whole repo.

## 6. First deploy

- [ ] Push any small change to `dev` → confirm `hifzhelper-api-dev` rebuilds
      automatically (Cloudflare dashboard → your Worker → Deployments tab).
- [ ] Merge `dev` → `main` (via PR) → confirm `hifzhelper-api` rebuilds automatically.

From here on: **you never deploy by hand.** A push to `dev` is a dev deploy,
a merge to `main` is a production deploy. That's what makes GitHub the actual
source of truth.

## 7. Add a student/teacher to test with

Once a Worker is live, insert a test row directly via the D1 console (dashboard)
or terminal:
```sql
INSERT INTO students (id, name, role, created_date, active)
VALUES ('K7M2QX', 'Test Student', 'student', '2026-07-18', 1);
```
Then log in from the frontend with ID `K7M2QX` and any 4-digit PIN (first
login sets it).

## 8. Point the frontend at the Worker

The frontend currently only saves to `localStorage`. Wiring it to actually
call these endpoints (`/auth/login`, `/entries`, `/attendance`, `/position`)
instead is real app.js work, not a config step — flagging that it's a
separate, not-yet-done piece, not something this manifest covers.
