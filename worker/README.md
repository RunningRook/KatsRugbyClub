# Team Check-In API (Cloudflare Worker + D1)

This is the backend for `/check-in/` — a small dependency-free Worker
backed by a Cloudflare D1 database. It's what lets the check-in page work
for anyone with the link, with **no Claude/Google/other account required**
— just a normal webpage talking to a normal API.

I can't run these commands myself (this build environment's network is
locked to an allowlist that doesn't include Cloudflare), so here's exactly
what to run yourself. It's about 5 minutes, once.

## 1. Install and log in to Wrangler

```bash
npm install -g wrangler
wrangler login
```

## 2. Create the database

```bash
cd worker
wrangler d1 create kats-checkin
```

This prints a `database_id`. Copy it into `worker/wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

## 3. Create the tables

```bash
wrangler d1 execute kats-checkin --remote --file=./schema.sql
```

## 3b. Load the 2026/27 season fixtures (optional but recommended)

```bash
wrangler d1 execute kats-checkin --remote --file=./seed-fixtures.sql
```

This loads all 18 Division 2 fixtures from the club-provided schedule. A
few notes on that data (also in the comment header of `seed-fixtures.sql`):

- Kickoff is set to the club's stated typical **12:45** for every game —
  spot-check any that differ once the actual schedule/times are posted.
- Home games are set to **Balaclava Park, Vancouver, BC**.
- Away games use the opponent's club name as a Google Maps *search* term
  (e.g. "Chilliwack RFC"), not a confirmed street address — good enough to
  get players pointed the right way, not precise. The **Bruins away**
  fixture (07-Nov) has no venue at all — I wasn't confident guessing which
  club that name refers to, so it's blank rather than wrong. Fill in real
  venues via the admin ⚙ → edit fixture as they're confirmed, or re-run
  this file after editing it.
- Re-running this file is safe — it's `INSERT OR REPLACE`, so editing a row
  above and re-running just updates that game instead of duplicating it.

## 4. Set the private-link access key

This is what keeps the page private — nobody sees so much as the roster or
fixture list without it, not just admin actions. Generate a long random
value and store it as a Worker secret (never committed to the repo):

```bash
# generates a random key and shows it to you — save it somewhere, you'll need it below
python3 -c "import secrets; print(secrets.token_urlsafe(24))"

wrangler secret put ACCESS_KEY
# paste the generated value when prompted
```

## 5. Deploy the Worker

```bash
wrangler deploy
```

Wrangler prints a URL like `https://kats-checkin-api.<your-subdomain>.workers.dev`
— that's your API's base URL.

**Optional but recommended:** attach it to a subdomain you already control
in Cloudflare (e.g. `checkin-api.katsrugbyclub.com`) instead of the
`workers.dev` URL — in the Cloudflare dashboard: Workers & Pages → your
worker → Settings → Domains & Routes → Add → Custom Domain.

## 6. Point the frontend at it

Open `../check-in/app.js` and replace the `API_BASE` constant near the top
with the URL from step 5:

```js
var API_BASE = "https://kats-checkin-api.your-subdomain.workers.dev";
```

If you're using a custom domain instead, also double check
`ALLOWED_ORIGINS` in `worker/src/index.js` already lists the domain(s) the
check-in page is served from (it defaults to `katsrugbyclub.com` and
`www.katsrugbyclub.com`) — if not, add it and run `wrangler deploy` again.

## 7. Publish the site

Commit the `API_BASE` change and push/merge as you normally deploy this
repo (GitHub Pages, via `.github/workflows/static.yml`).

## 8. Share the private link

The link to send the team is the page URL with your access key from step 4
tacked on:

```
https://www.katsrugbyclub.com/check-in/?key=PASTE_YOUR_KEY_HERE
```

The first time someone opens it, the page saves the key on their device and
drops it from the visible URL. Nobody who only has the bare
`/check-in/` URL (no `?key=...`) sees anything but a "this page is private"
message — not the roster, not fixtures, nothing. Open it yourself once and
use the ⚙ icon to set your admin PIN — first person there sets it up for
the whole team (this is separate from the access key: the access key gets
everyone in, the PIN additionally gates fixture/roster management).

**If the link ever leaks** (posted somewhere public by mistake, someone
who left the club still has it, etc.), rotate it: run `wrangler secret put
ACCESS_KEY` again with a new value, `wrangler deploy`, and share the new
link — the old one stops working immediately for everyone.

## Updating later

- **Schema changes**: edit `schema.sql`, then re-run the `d1 execute`
  command from step 3 (it's idempotent — `CREATE TABLE IF NOT EXISTS`).
- **API changes**: edit `src/index.js`, then `wrangler deploy` again.
- **Inspecting data** (e.g. to manually fix something): `wrangler d1
  execute kats-checkin --remote --command "SELECT * FROM games"`.

## How the admin PIN works

The Worker stores a salted SHA-256 hash of the PIN (never the PIN itself)
in the `config` table. A correct PIN mints a random bearer token stored in
`admin_sessions`, which the browser then sends as `Authorization: Bearer
<token>` on admin actions (add/edit/delete fixtures, remove a player,
change the PIN or team name). Tokens expire after 30 days. This is real
server-side enforcement — unlike a client-only check, someone can't bypass
it just by reading the page's source.

## PlayHQ live fixtures & ladder

This same Worker also serves `/playhq/fixtures` and `/playhq/ladder` —
**public**, un-gated endpoints (no `ACCESS_KEY` needed) that back the live
widget on `fixtures-results.html` and the "Next up" line on `index.html` (see
`assets/js/playhq.js`). They're a thin proxy + cache in front of PlayHQ's
own External API, so the club's PlayHQ API key stays a server-side secret
and PlayHQ isn't hit on every single page load — see the big comment above
`handlePlayhq()` in `src/index.js` for how the org → season → team → grade
lookup works and how it's cached in the `playhq_cache` D1 table.

**Status: deployed and confirmed working (2026-09-10).** This build
environment's network can't reach `playhq.com` at all (confirmed by a
direct `curl` failing at the egress proxy, not at PlayHQ), so none of this
could be tested from here — it shipped as a best-effort reading of PlayHQ's
docs, then someone with real Cloudflare/PlayHQ access deployed it and
walked through the verification steps below. What that turned up:

- Org → season → team → grade resolution works correctly against the real
  API, resolving to team **"Kats Men's Division 2"** in grade **"Senior Men
  Division 2"**. This needed one real fix along the way: `/v1/seasons/:id/teams`
  returns every team in the *entire* BC Rugby competition (hundreds,
  paginated), not just this org's, and matching by team **name** was
  unreliable (a Kelowna Crows team happens to be named "KRFC U12 Boys",
  which would have false-matched a naive "kats"/"krfc" search). Fixed by
  paginating through all pages and matching each team's `club.id` against
  the org's own verified ID instead — see `playhqFetchAllPages()` and
  `resolveKatsGrade()` in `src/index.js`.
- `/playhq/fixtures` and `/playhq/ladder` first came back empty
  (`"games":[]` / `"ladder":[]`) even though the 2026/27 season's full
  19-round schedule and a 10-team ladder both genuinely exist in PlayHQ —
  that was a **real parsing bug**, caught by checking `/playhq/debug`'s
  raw output rather than assuming "empty means nothing's loaded yet."
  Both endpoints turn out to use shapes nothing like a flat list of rows:
  - **Games**: `{ rounds: [{ name, games: [...] }], teams: [{id,name}],
    playingSurfaces: [{id, venue:{name,...}}] }` — each game references
    team/venue IDs into those lookup tables rather than embedding names.
  - **Ladder**: `{ ladders: [{ headers: [{key,...}], standings: [{
    team:{id,name}, values:[...] }] }] }` — a column-index scheme, not
    keyed rows (`values[i]` corresponds to `headers[i].key`).

  `normalizeGamesResponse()` and `normalizeLadderResponse()` in
  `src/index.js` were rewritten against these real shapes and now
  correctly return the full fixture list and ladder standings (confirmed:
  18 opponent rounds + finals, real dates/venues, all 10 teams at 0-0-0
  pre-season). **The one still-unverified piece**: no game has been played
  yet, so the `outcome`/score field shape once a result exists is a
  best-effort guess (see the comment on `normalizeGamesResponse()`) — if
  fixtures show but scores don't appear after a game is played, that's
  the first thing to check via `/playhq/debug`.
- No redeploy needed for new fixtures/results as the season progresses —
  the endpoints poll PlayHQ live (cached ~10 minutes) and the widget
  updates on its own.

**Setup (once):**

1. **Set the API key as a secret — never commit it to this repo:**
   ```bash
   wrangler secret put PLAYHQ_API_KEY
   # paste the key you were given when prompted
   ```
2. `PLAYHQ_TENANT`, `PLAYHQ_ORG_ID` and `PLAYHQ_TEAM_MATCH` are already set
   as plain vars in `wrangler.toml` (they're not sensitive — the org ID is
   already published in this repo's root `README.md`). Team resolution
   matches on `PLAYHQ_ORG_ID` directly (via each team's `club.id`), so
   `PLAYHQ_TEAM_MATCH` is only a fallback for the unlikely case that field
   isn't populated — nothing to change here normally.
3. Apply the schema update for the new `playhq_cache` table (safe to
   re-run — same command as step 3 above):
   ```bash
   wrangler d1 execute kats-checkin --remote --file=./schema.sql
   ```
4. `wrangler deploy`.

**Verify it actually worked** — this is the step that stands in for the
testing this build environment couldn't do:

```bash
curl "https://kats-checkin-api.katsrfc.workers.dev/playhq/fixtures"
curl "https://kats-checkin-api.katsrfc.workers.dev/playhq/ladder"
```

- A full round-by-round fixture list and a 10-team ladder → it worked,
  nothing more to do (this is the confirmed state as of "Status" above,
  pre-season: real dates/venues/opponents, no scores yet since no game has
  been played).
- `"games":[]` or `"ladder":[]` when you know PlayHQ has a schedule loaded
  → **don't assume this is fine because the season hasn't started** (that
  assumption was wrong once already here) — treat it as a parsing bug and
  check `/playhq/debug` immediately.
- `{"error": "..."}`, or the above empty-when-it-shouldn't-be case → open
  `https://kats-checkin-api.katsrfc.workers.dev/playhq/debug?key=YOUR_ACCESS_KEY`
  (reuses the check-in `ACCESS_KEY`, just to keep this worker from being
  usable as a free anonymous PlayHQ proxy). It reports the resolved
  season/team/grade, a team-count + club-list summary if team resolution
  itself failed, and raw upstream JSON for the games/ladder calls. Compare
  that raw JSON's actual shape against `normalizeGamesResponse()` /
  `normalizeLadderResponse()` / `resolveKatsGrade()` in `src/index.js`, fix
  whichever part guessed wrong, and `wrangler deploy` again. If it's an
  authorization error instead, double check the API key and `x-phq-tenant`
  value (`rca`) are exactly what the club was given.

If you'd rather not deal with any of this, the site works fine without
it — the widget just never appears and the existing "View on BC Rugby"
link-out card (already there regardless) stays the only fixtures/ladder UI.
