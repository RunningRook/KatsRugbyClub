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
