# Kats Rugby Club — Static Site

A plain HTML/CSS/JS rebuild of [katsrugbyclub.com](https://www.katsrugbyclub.com/), which was
previously built on **Wix** (confirmed via the `<meta name="generator" content="Wix.com Website
Builder">` tag and `static.wixstatic.com` asset URLs) at roughly $450/year. This rebuild has no
backend, no CMS, and no subscription — it's just files, so it can be hosted for free or a few
dollars a year on any static host.

## What's here

```
.
├── index.html              Home
├── about-us.html            About Us
├── history.html             History
├── join-our-team.html       Join Our Team
├── diversity-and-inclusion.html  Diversity & Inclusion
├── contact.html              Contact (full form + map)
├── 2023-24-season.html      Fixtures & Results (BC Rugby link-out + live PlayHQ widget; filename kept from the live site's URL)
├── robots.txt               Allows all crawlers, points at sitemap.xml
├── sitemap.xml              Lists all 7 pages for search engines
├── assets/
│   ├── css/style.css        Single shared stylesheet (brand colours, layout, responsive rules)
│   ├── js/main.js           Mobile nav toggle + progressive-enhancement form submission
│   ├── js/playhq.js         Live fixtures/ladder widget (calls the Worker's /playhq/* endpoints)
│   └── img/                 All images used on the site (crests, photos, opponent logos, favicon)
├── check-in/                Team Check-In tool (fixtures + roster + In/Out/Maybe) — see below
├── worker/                  Its small Cloudflare Worker + D1 backend — see worker/README.md
└── README.md
```

There's no build step and no framework — open `index.html` directly in a browser, or serve the
folder with any static file server, and everything works.

Each page repeats its own `<header>`/`<footer>` markup (no templating engine, by design — keeps
the "just files" property that makes static hosting simple). If you add a page, copy the
nav/footer block from an existing one and update the `aria-current="page"` attribute on the
matching nav link.

## Team Check-In

`/check-in/` is the one deliberate exception to "no backend" above: players
tap **In / Maybe / Out** on each upcoming fixture and it updates live for
everyone, which needs somewhere to actually store that shared state. It's
a plain static page (`check-in/index.html` + `check-in/app.js`) talking to
a small Cloudflare Worker + D1 database (`worker/`) — no accounts, no
Claude/Google/other sign-in, just a normal webpage and a normal API.

**It's private, not just unlisted.** The page isn't linked from the site's
nav or anywhere else, and it's `noindex`ed — but on top of that, the Worker
itself refuses every request (viewing the roster/fixtures included, not
just admin actions) unless it carries a shared access key. Nobody who
finds or guesses the bare `/check-in/` URL sees any team data; the actual
link you hand out looks like `/check-in/?key=<long-random-string>`, which
the page remembers on that device after the first visit. See "Share the
private link" in [`worker/README.md`](worker/README.md) for how to
generate that key and rotate it if it ever leaks.

**Before any of this works, someone needs to deploy the Worker once** —
it's not live yet. Full steps are in
[`worker/README.md`](worker/README.md) (~5 minutes: create a D1 database,
run the schema, set the access key, `wrangler deploy`, then paste the
resulting URL into `check-in/app.js`'s `API_BASE` constant). Until that's
done, the check-in page shows its private-link gate but nothing behind it
will load.

Once deployed, the first person to open the ⚙ icon on `/check-in/` sets an
admin PIN for the team — that PIN (not a Claude/GitHub/Google account)
gates adding/editing fixtures and removing roster players. It's enforced
server-side by the Worker, not just hidden in the page.

## Brand

Colours were sampled directly from the club crest (`assets/img/kats-logo.png`):

- Green `#056839`
- Gold `#d7922c`
- White `#ffffff`

Headings use **Poppins** (a free geometric sans similar in spirit to the Futura family the
original site used); body text uses **Inter**. Both are loaded from Google Fonts — remove the
`<link>` tags in each page's `<head>` if you'd rather self-host fonts or drop them entirely.

## SEO

Every page now carries the tags search engines and social platforms actually use:

- **Unique `<title>` and meta description per page** (already existed from the initial rebuild).
- **Open Graph tags** (`og:type`, `og:description`, `og:url`, `og:image`) on every page, not just
  the homepage — this is what controls the preview card when a link is shared on Facebook, group
  chats, Slack, etc. Each page uses a relevant photo where one exists (e.g. `about-us.html` uses
  the team photo); pages without a unique photo fall back to the crest-on-photo image.
- **Twitter/X Card tags** (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
  — same idea, for X share previews specifically.
- **Canonical URLs** (`<link rel="canonical">`) on every page, pointed at `https://www.katsrugbyclub.com/...`
  — this assumes the club keeps its existing domain. **If the domain ever changes, every
  `og:url`/`og:image`/`twitter:image`/canonical URL (and `sitemap.xml`, and the `Sitemap:` line in
  `robots.txt`) needs updating to match** — search `katsrugbyclub.com` across the repo to find them
  all.
- **`theme-color`** (`#056839`, the brand green) — tints the browser chrome/status bar on mobile.
- **Structured data (JSON-LD)** on the homepage: a `SportsOrganization` schema with the club's
  real name, address, phone, email, and social links (`sameAs`). This is what can make Google show
  a richer result (logo, contact info) rather than a plain blue link, and helps local searches like
  "rugby club Vancouver."
- **`robots.txt`** — allows all crawlers and points at `sitemap.xml`.
- **`sitemap.xml`** — lists all 7 pages so search engines can discover them without waiting to
  find internal links. Re-submit it in Google Search Console after the domain goes live (see
  "Manual steps" below), and add a new `<url>` entry here any time a page is added.

**Not done, and why:** a `<title>`/meta-description rewrite for `index.html` to match the other
pages exactly wasn't made — its title ("Home | Kitsilano Kats Rugby") differs intentionally,
since "Kitsilano" is a real, searched Vancouver neighbourhood and keeping it can help local search
even though it doesn't match the "... | Kats Rugby Club" pattern used elsewhere.

## Fixtures, Results &amp; Registration (PlayHQ)

BC Rugby Union (and Rugby Canada nationally) migrated competition management to
**[PlayHQ](https://www.playhq.com/)** for the 2026/27 season. Kats RFC's live schedule, ladder,
results and season registration now live on PlayHQ, not on this static site.

**The verified Kats RFC PlayHQ organisation page:**

```
https://www.playhq.com/ca/rugby-canada/org/kats-rfc/0ab94db6
```

**The verified registration page for that org:**

```
https://www.playhq.com/ca/rugby-canada/org/kats-rfc/0ab94db6/register
```

The registration URL is used as the "Register on PlayHQ" button on `join-our-team.html`.

**Fixtures & results link to BC Rugby, not directly to PlayHQ.** At the club's request, the
"View on BC Rugby" / "Fixtures, Ladder & Results" buttons on `index.html` and
`2023-24-season.html` point to BC Rugby Union's own fixtures/results page instead of the PlayHQ
org page above:

```
https://www.bcrugby.com/fixtures---results0adb61e3
```

BC Rugby's page is itself powered by PlayHQ's data underneath, but the club wanted the visible
link to be BC Rugby's own branded page rather than PlayHQ directly, so this link-out card stays
either way.

**A live fixtures/ladder widget now sits alongside it, deployed and confirmed working.** The
club obtained a PlayHQ API key, tenant (`rca`) and organisation ID, so `2023-24-season.html`
(fixtures + ladder) and `index.html` ("Next up" teaser) now also pull live data via
`assets/js/playhq.js`, which talks to the Cloudflare Worker's `/playhq/fixtures` and
`/playhq/ladder` endpoints (the same Worker that backs `/check-in/`). It correctly resolves to
the real team ("Kats Men's Division 2", grade "Senior Men Division 2") and now shows the full
19-round 2026/27 fixture list and a live 10-team ladder — see `worker/README.md`'s "PlayHQ live
fixtures & ladder" section for the full story, including two real bugs that surfaced and were
fixed post-deploy: team name matching was unreliable across PlayHQ's full multi-club team list
(fixed by matching on club ID instead), and the games/ladder endpoints turned out to use
relational/column-index shapes nothing like a flat list of rows, which silently produced empty
results even though PlayHQ had a full schedule loaded (fixed by rewriting the parsers against the
real response shapes). Scores aren't shown yet only because no game has been played — the field
that will hold them once one is couldn't be confirmed and is the one thing still worth
double-checking after the first result comes in (see worker/README.md). **The PlayHQ API key
itself is a Worker secret, never committed to this repo** — same pattern as the check-in tool's
`ACCESS_KEY`.

### How this was verified (so it doesn't get pasted-in blind next season)

PlayHQ is a heavy client-rendered single-page app, so its pages can't be scraped like a normal
site — the raw HTML is just an empty `<div id="root">` shell for every URL, valid or not, which
makes a plain `curl`/200-check useless for confirming a specific club/URL is real. Instead:

1. PlayHQ's public **search API** was queried directly
   (`POST https://search.caprod.playhq.com/graphql`, the same GraphQL endpoint PlayHQ's own
   search bar calls) for organisations named "Kats" under the `RUGBY` sport filter. It returned
   exactly one match: an organisation named **"Kats RFC"**, type `CLUB`, address **Vancouver, BC**,
   with `websiteUrl` set to `https://www.katsrugbyclub.com/` &mdash; i.e. PlayHQ's own database
   already links this exact organisation record back to the club's real website, which is
   unambiguous confirmation it's the right club (not some other country's/sport's "Kats").
   That query returned the org's internal ID (`0ab94db6-f0cb-4454-95d8-90b8b05150b3`) and short
   `routingCode` (`0ab94db6`).
2. PlayHQ's own shipped JavaScript (the production bundle served from
   `www.playhq.com/ca/assets/*.js`) was read to find the *actual* URL-building logic their app
   uses for an org's page (`` `/${tenant}/org/${slugify(name)}/${routingCode}` ``) and its
   `/register` sub-route, rather than guessing a URL pattern. Applying that logic to the "Kats
   RFC" record above is what produced the two URLs listed here.
3. **Live iframe embedding was ruled out with evidence, not assumption**: PlayHQ's org pages
   respond with the header `X-Frame-Options: SAMEORIGIN`, which browsers enforce to block any
   other site (including this one) from framing the page. `embed.playhq.com` (referenced in
   PlayHQ's Content-Security-Policy as an allowed frame source) was also checked directly — it
   turned out to be an internal ad-container shell, not a fixtures/ladder widget, so there's no
   official embeddable widget to use instead. **This is why the fixtures/results/registration UI
   here is a styled "link out" card (`.playhq-card` in `style.css`), not a live `<iframe>`.**

**What could *not* be fully confirmed** in this environment: headless-browser rendering of
playhq.com pages was blocked by the sandbox's outbound network layer (connection resets specific
to the Chromium client, not present with plain HTTPS requests), and PlayHQ's main content API
returned internal server errors when queried for this org's live registration/season data at the
time of writing. Combined with [BC Rugby's own reporting](https://bcrugbynews.com/bc-rugby-2026-27-season/)
that "the BCRU scheduling system is in transition" and fixtures were still being loaded into
PlayHQ ahead of the 2026/27 season kicking off September 12, 2026, it's possible the Kats' PlayHQ
page looks sparse (no fixtures yet, or registration not yet open) for the first few weeks of the
season even though the organisation page itself is correct and permanent.

### Updating these links in future seasons

- The **org page URL itself should not need to change** season to season — `routingCode`
  (`0ab94db6`) is permanent to the "Kats RFC" organisation record in PlayHQ, not tied to a
  particular season or competition.
- If the club ever needs to re-derive or double check these URLs (e.g. PlayHQ changes its URL
  scheme, or you want to confirm the org record directly): query
  `https://search.caprod.playhq.com/graphql` with a `POST` body of
  `{"query":"query Q($filter: SearchFilter!) { search(filter: $filter) { results { ... on Organisation { id routingCode name websiteUrl tenant { slug } address { suburb state } } } } }","variables":{"filter":{"meta":{"page":1,"limit":20},"organisation":{"query":"Kats","sports":["RUGBY"],"types":["CLUB"]}}}}`
  with headers `Content-Type: application/json`, `Origin: https://www.playhq.com`, and a normal
  browser `User-Agent` (PlayHQ's CDN blocks requests without those). Match on the `websiteUrl`
  field to make sure you've got the club's real record before trusting any ID it returns.
- `2023-24-season.html` no longer keeps a hand-maintained fixture list — it's just the link-out
  card. If BC Rugby ever discontinues PlayHQ, the original `.fixtures-list`/`.fixture` markup and
  CSS are still in `style.css` (unused now) and can be reused to add a fixtures table back.

## Diversity &amp; Inclusion (Safe Sport / Code of Conduct links)

`diversity-and-inclusion.html`'s "Safe Sport &amp; Code of Conduct" section links out to BC
Rugby's own policy pages rather than restating them:

**Safe Sport:**

```
https://www.bcrugby.com/safe-sport
```

**BCRU Code of Conduct (PDF):**

```
https://irp.cdn-website.com/601daad2/files/uploaded/BC+Rugby+Code+of+Conduct-9242d4a2.pdf
```

Both were found by browsing BC Rugby's real site, not guessed:

- `www.bcrugby.com/safe-sport` is BC Rugby's own live Safe Sport page (confirmed via its
  `og:title`: "Safe Sport &amp; Player Safety | BC Rugby | BC"). Note that `bcrugby.com` (no
  `www`) uses a different URL structure/CMS (e.g. `bcrugby.com/governance/`) where the
  equivalent `/governance/safe-sport/` path 404s &mdash; `www.bcrugby.com/safe-sport` is the
  correct live one.
- The Code of Conduct PDF link was scraped directly out of that Safe Sport page's HTML (it's
  hosted on `irp.cdn-website.com`, the CDN behind BC Rugby's site builder, not on the
  `bcrugby.com` domain itself — that's expected and not a sign of a wrong link, since the
  live page itself links there). Guessed `bcrugby.com/wp-content/uploads/.../*.pdf` URLs found
  via search (there's an older WordPress instance at that domain, apparently a leftover/staging
  copy) all returned `403 Forbidden`, so they were **not** used. The PDF above was downloaded
  and its text extracted to confirm it's genuinely titled "BC Rugby code of conduct", board
  approved January 27, 2026, with BC Rugby's real Vancouver address and contact info on the
  cover page.

If BC Rugby reorganizes their site, re-derive these by opening `https://www.bcrugby.com/safe-sport`
directly and reading whatever Code of Conduct link it currently points to, rather than guessing
a URL pattern.

## Diversity &amp; Inclusion sourcing

`diversity-and-inclusion.html`'s copy quotes or paraphrases several real policy documents rather
than making claims up. Every quote/claim on that page, its exact source, and how it was verified:

1. **"BC Rugby ... supports equal opportunity, prohibits discriminatory practices, and is
   committed to providing an environment in which all Individuals can safely participate in sport
   and are treated with respect and fairness."** (intro section, "Rugby is for everyone")
   Source: **BC Rugby Code of Conduct**, §1.2 —
   `https://irp.cdn-website.com/601daad2/files/uploaded/BC+Rugby+Code+of+Conduct-9242d4a2.pdf`
   (board approved January 27, 2026). Verified by downloading the PDF and extracting its text
   with `pdftotext`; the sentence is exact. **This replaces an earlier draft** that attributed a
   different sentence ("welcomes full participation of all individuals ... irrespective of race,
   ancestry, place of origin...") to BC Rugby generally. That exact wording could not be found
   anywhere on `bcrugby.com` after extensive searching, and instead turned out to match the
   Oakville, Ontario **Crusaders Rugby Club**'s own Inclusion and Harassment Policy — an unrelated
   club with no connection to BC Rugby or the Kats. It was removed rather than kept misattributed.

2. **"provide a safe, fun, positive, and inclusive environment"** (Safe Sport &amp; Code of
   Conduct section) — Source: **BC Rugby Code of Conduct**, §1.1, same PDF as above. Verified
   verbatim by the same `pdftotext` extraction ("...aims to provide a safe, fun, positive, and
   inclusive environment within BC Rugby and all of BC Rugby's programs, competitions, events,
   and activities.").

3. **"modifications to make... competitions, programs, and events accessible to Players and
   Participants of all abilities"** (Members with Disabilities card) — Source: **BC Rugby Code of
   Conduct**, §4.1(d), same PDF. Verified verbatim; the elided text is "BC Rugby" (i.e. the full
   clause reads "...make or provide modifications to make **BC Rugby** competitions, programs,
   and events accessible...").

4. **"demonstrate respect for the diversity of Participants, and act to correct or prevent
   practices that are unjustly discriminatory"** (Racialized Communities card) — Source: **BC
   Rugby Code of Conduct**, §4.1(c), same PDF. Verified verbatim, exact match, no changes needed.

5. **Land acknowledgement** (Indigenous Members card) — Source: **BC Rugby**, published site-wide
   (confirmed independently on the `www.bcrugby.com` homepage, the `bcrugby.com/governance/`
   page, and printed on the cover of the Code of Conduct PDF above, all with identical wording):
   > BC Rugby gratefully acknowledges that its offices reside on the traditional and unceded
   > territory of the Coast Salish Peoples, including the territories of the xʷməθkwəy̓əm
   > (Musqueam), Skwxwú7mesh (Squamish) and Səl̓ílwətaʔ/Selilwitulh (Tsleil-Waututh) Nations.

   The page previously said "Like BC Rugby, we recognize that Kats' training and matches take
   place on..." those same three Nations' territory — the **Nations named were correct**, but BC
   Rugby's actual acknowledgement is about where its **offices** sit, not a general statement
   about where rugby is played. The card was reworded to quote BC Rugby's real sentence exactly
   (attributed to BC Rugby) and to make the training/matches claim **the Kats' own** statement,
   not something attributed to BC Rugby.

6. **"all individuals deserve respectful and inclusive environments for participation that value
   the individual's gender identity and gender expression"** (2SLGBTQIA+ Members card) — Source:
   **Rugby Canada's Trans Inclusion Policy** (approved January 1, 2019) —
   `https://rugby.ca/uploads/Documents/TransInclusionPolicyEN_DEV_POL_20190101_FINAL.pdf`,
   §3 ("Purpose"). Verified verbatim by downloading the PDF and extracting its text.
   **This corrects a misattribution**: the quote was previously credited to "BC Rugby's Gender
   Equity, Diversity and Inclusion Policy." That policy is real and is listed as one of BC Rugby's
   own Supporting Policies in the Code of Conduct (§10) at
   `https://bcrugby.com/wp-content/uploads/2021/05/BC-Rugby-Gender-Equity-Diversity-and-Inclusion-Policy.pdf`
   — but that specific URL (and every other `bcrugby.com/wp-content/uploads/*` PDF) consistently
   returns `403 Forbidden` to direct requests, browser-UA `curl`, a headless Chromium fetch, and
   even the Wayback Machine's cached copy, so its actual text could not be read to confirm the
   quote appears there. The quote's exact wording, however, was confirmed verbatim in Rugby
   Canada's own Trans Inclusion Policy, so the card now cites that document (the national policy
   BC Rugby operates under) instead of asserting a match against a BC Rugby document that
   couldn't be opened.

If BC Rugby ever unblocks direct access to its `wp-content/uploads` PDFs, it would be worth
re-checking whether the BC Rugby Gender Equity, Diversity and Inclusion Policy also contains this
sentence (it's plausible BC Rugby adopted it directly, the way its Code of Conduct explicitly
incorporates the national UCCMS/provincial BCUCC frameworks) — if so, item 6 above could cite BC
Rugby's own document directly instead.

## Forms

Two kinds of form appear on the site, matching the original:

1. A short "quick contact" form (first/last name, email, message) repeated near the bottom of
   every page.
2. A fuller contact form (name, address, email, phone, subject, message) on `contact.html`.

Both forms are wired to a live Formspree endpoint (`https://formspree.io/f/moeqnbpq`), on the
club's free Formspree account:

```html
<form action="https://formspree.io/f/moeqnbpq" method="POST" data-ajax-form>
```

`assets/js/main.js` submits the form via `fetch` and shows an inline "Thanks for submitting!"
message; the plain `<form action>` also works with JavaScript disabled (Formspree redirects to
its own thank-you page in that case). The free tier is 50 submissions/month — plenty for a club
contact form; Formspree's dashboard shows usage and lets you upgrade if that's ever not enough.

**If the club ever needs to change where submissions go** (a different account, or the free tier
is exceeded): create a new form at [formspree.io](https://formspree.io), then replace
`moeqnbpq` with the new ID across `index.html`, `about-us.html`, `history.html`,
`join-our-team.html`, `contact.html`, `diversity-and-inclusion.html`, and `2023-24-season.html`
(8 `<form action>` occurrences total — `contact.html` has two forms). Any other static-friendly
form backend (Netlify Forms, Basin, Getform, a Google Form, a serverless function you write
yourself) works the same way — just change the `action` URL everywhere it appears.

`contact.html` also embeds a free, key-less Google Maps `<iframe>` pointed at the club's address.
The original Wix page likely had a similar map widget, but it's client-side rendered and
couldn't be scraped — remove the `<iframe>` block if you don't want it.

## Deploying

Any static host works. Three easy options:

### Netlify (drag-and-drop, free tier)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole project folder in.
3. Done — you get a `*.netlify.app` URL immediately.
4. **Custom domain:** Site settings → Domain management → Add a custom domain, then update your
   domain's DNS (an `A` record to Netlify's load balancer IP, or a `CNAME` if using a subdomain) as
   instructed on-screen.

### GitHub Pages (free)
1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Repo → Settings → Pages → Source: deploy from the branch you want (e.g. `main`), folder `/`.
3. Your site is live at `https://<username>.github.io/<repo>/`.
4. **Custom domain:** add a `CNAME` file to the repo root containing just your domain
   (e.g. `katsrugbyclub.com`), then in your DNS provider add either an `A` record pointing at
   GitHub's Pages IPs (185.199.108.153, .109.153, .110.153, .111.153) for an apex domain, or a
   `CNAME` record to `<username>.github.io` for a subdomain like `www`.

### Any shared host via FTP
1. Upload every file/folder here (keeping the folder structure) to your host's public web root
   (often `public_html/` or `www/`) via FTP/SFTP or the host's file manager.
2. Point your domain's DNS `A` record at the host's IP address (your host's control panel will
   show you this), or use their nameservers if that's how they're set up.

In all three cases, no server-side config is needed — it's static HTML/CSS/JS/images only.

## What was and wasn't captured

**Captured:** full navigation (Home, About Us, History, Join Our Team, Diversity & Inclusion,
Contact, Fixtures & Results), all page text/copy, the club crest and every photo/opponent-crest
image referenced on those pages, the contact address/phone/email, and social links (Facebook,
Instagram, Twitter). The 2024/25 fixtures & results list (15 rounds) was originally kept as a
historical archive on the Fixtures & Results page, but has since been removed at the club's
request — that page now only links out to BC Rugby's live fixtures/results.

**Not captured / needs manual attention:**
- **`team-roster` page** — this URL exists on the live site (linked in its sitemap) but returned
  an essentially empty page when scraped; it's almost certainly a Wix "Roster"/team-member app
  block that renders entirely client-side (no content in the server-rendered HTML to scrape). It
  isn't linked from the visible nav, so it wasn't rebuilt here. If the club wants a roster page,
  it'll need to be authored fresh with current player info.
- **Contact map widget** — the original Wix contact page likely had an interactive map, but (like
  the roster) it's client-side rendered and left no trace in the scraped HTML. A plain Google Maps
  iframe embed was added in its place using the same address.
- **Registration/payment** — the original Wix site had no linked payment/registration flow to
  scrape. This rebuild instead links out to the club's real PlayHQ registration page (BC Rugby's
  season-registration platform) from `join-our-team.html` — see "Fixtures, Results &amp;
  Registration (PlayHQ)" above for how that link was found and verified.
- **Exact Wix visual theme (fonts/spacing/animations)** — Wix renders its actual theme via
  client-side JS/CSS bundles that aren't present in the plain HTML response, so pixel-perfect
  colours/fonts couldn't be scraped directly. This rebuild's palette was instead sampled from the
  club's own logo file and its typography chosen to match the spirit of the original (geometric
  sans headings + humanist sans body) — visually close, but not a pixel-perfect clone.
- **Season page URL** — kept as `2023-24-season.html` to match the live site's actual URL (the
  club appears to reuse last year's URL/page for each new season rather than creating a new one
  each year). Its content and nav label were changed from "2024/25 Fixtures & Results" to a
  season-agnostic "Fixtures & Results" (see the PlayHQ section above) specifically so it
  **doesn't** need renaming every season anymore — BC Rugby's site is now the source of truth for
  the current season, and this page carries no fixture list of its own to keep updated.

## Manual steps for the club after migrating

1. ~~Swap in a real form backend~~ — done. Forms are live on Formspree (`f/moeqnbpq`) — see
   "Forms" above for how to change it later if needed.
2. **Re-point DNS** once the new host is live: update the domain's nameservers or `A`/`CNAME`
   records to point at the new static host instead of Wix, then cancel the Wix subscription once
   the new site is confirmed live and DNS has propagated (can take up to 24–48 hours).
3. **Set up email** — if `info@katsrugbyclub.com` / `manager@katsrugbyclub.com` mailboxes were
   provided by Wix, arrange email hosting separately (e.g. Google Workspace, Zoho Mail, or the
   new host's mail service) before cancelling Wix, so club email doesn't go down.
4. **Update the roster page** if/when the club wants one built (see above) — the fixtures/season
   page no longer needs a yearly update since it now links out to PlayHQ (see "Fixtures, Results &
   Registration (PlayHQ)" above).
5. Optionally set up free HTTPS (Netlify/GitHub Pages both auto-provision this; a shared host may
   need a free Let's Encrypt certificate enabled in its control panel).
6. **Once the domain is live on the new host**, submit `sitemap.xml` in
   [Google Search Console](https://search.google.com/search-console) (Sitemaps → enter
   `sitemap.xml` → Submit) and [Bing Webmaster Tools](https://www.bing.com/webmasters) — this gets
   all 7 pages crawled and indexed much faster than waiting for search engines to find them on
   their own. See the "SEO" section above for what's already in place, and what to update if the
   domain ever changes.

## Moving the domain: Wix → Cloudflare, hosting on GitHub Pages

This is a from-scratch runbook for the club to follow by hand, in this exact order, to (1) host
this site on GitHub Pages for free, (2) move the domain's *registration* (not just its DNS) from
Wix to Cloudflare Registrar, at cost with no markup, and (3) keep `www.katsrugbyclub.com` and
`katsrugbyclub.com` working the whole time. No step here has been performed for you — every
step below happens in the club's own Wix, Cloudflare, and GitHub accounts, by hand.

**Why this order matters:** Cloudflare's own transfer process *requires* a domain to already be
using Cloudflare's nameservers (an "Active" DNS zone) before it will even accept an authorization
code to start the registration transfer — see Phase 3 below. So the safe sequence is: get the new
site fully working on the *old* DNS first (zero risk, easy to undo), then move DNS hosting to
Cloudflare (a nameserver change, not a registrar change — the domain still legally belongs to Wix
at this point), confirm nothing broke, and only *then* start the registrar transfer, which from
that point on is a paperwork/billing change that doesn't touch the live DNS records again.

### Phase 1 — Put the site on GitHub Pages, but don't touch the domain yet (~15–30 minutes)

1. Push this repository to GitHub if it isn't already (it is, if you're reading this on GitHub).
2. In the repo, go to **Settings → Pages**. Under "Build and deployment", set Source to "Deploy
   from a branch" and pick the branch this site lives on (e.g. `main`) with folder `/ (root)`.
3. Under "Custom domain", type `katsrugbyclub.com` and click **Save**. This automatically creates
   a `CNAME` file (containing just `katsrugbyclub.com`) in the repo root — GitHub does this for
   you, you don't need to create it by hand.
4. At this point GitHub will show "DNS check unsuccessful" — that's expected, because the domain's
   DNS still points at Wix. Leave it; you'll fix DNS in the next phase.
   *(Source: [GitHub Docs — Managing a custom domain for your GitHub Pages
   site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).)*

### Phase 2 — Point the domain at GitHub Pages while it's still fully hosted at Wix (~10 minutes to change, up to 24–48 hours to fully propagate)

This proves the new site works on the real domain *before* anything about the domain's
registration changes — if anything looks wrong, you can revert this in Wix in minutes with no
transfer in progress to worry about.

1. In Wix, go to **Domains**, click the **Domain Actions** icon next to `katsrugbyclub.com`, and
   choose **Manage DNS records**.
   *(Source: [Wix — Managing DNS Records in Your Wix
   Account](https://support.wix.com/en/article/managing-dns-records-in-your-wix-account).)*
2. Add four **A** records for the bare/apex domain (host field left blank or set to `@`,
   whichever Wix's form asks for), one per GitHub Pages IP address:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. Add one **CNAME** record: host `www`, value `runningrook.github.io` (or the correct
   `<username-or-org>.github.io` for wherever this repo lives).
4. Remove/replace whatever A/CNAME records currently point the domain at Wix's own hosting (Wix's
   DNS manager lets you edit or delete existing A/CNAME entries the same way).
5. Wait for DNS to propagate (Wix and GitHub docs both note this can take up to 24–48 hours,
   though it's often much faster). Back in the repo's **Settings → Pages**, GitHub will show a
   green "DNS check successful" once it sees the records, and will then auto-provision an HTTPS
   certificate. Once that finishes, tick **Enforce HTTPS**. GitHub notes this checkbox "can take up
   to 24 hours" to become available after DNS first verifies.
   *(Source: [GitHub Docs, same
   page](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) as above.)*
6. Confirm `https://katsrugbyclub.com` and `https://www.katsrugbyclub.com` both load the new site
   correctly before moving on. At this point the domain is still 100% registered and DNS-hosted at
   Wix — only where it *points* has changed.

### Phase 3 — Move DNS hosting to Cloudflare (nameserver change only — the domain still belongs to Wix) (~a few minutes to set up, up to 24 hours for Cloudflare to show "Active")

Cloudflare's own registrar-transfer flow will not let you enter an authorization code until the
domain is already an **Active** DNS zone on Cloudflare, so this has to happen before Phase 4, not
after. *(Source: [Cloudflare Docs — Transfer a domain to
Cloudflare](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/):
"You cannot proceed with the transfer until your domain shows Active status.")*

1. Create a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com) if the
   club doesn't have one, and click **Add a domain**, entering `katsrugbyclub.com`.
2. Cloudflare will scan and import the existing DNS records automatically. Check the imported list
   against what you set up in Phase 2 (four A records for the apex + one CNAME for `www`) and add
   anything missing. **Leave every record "DNS only" (grey cloud, not orange)** — do not enable
   Cloudflare's proxy on these records. This isn't documented on Cloudflare's or GitHub's official
   pages, but is strong, consistent community guidance: if Cloudflare proxies (orange-clouds) the
   records, GitHub can't complete the verification check it uses to issue/renew the HTTPS
   certificate, and the site's certificate can silently fail to renew later. *(Source: [GitHub
   Community discussion #23632](https://github.com/orgs/community/discussions/23632) and multiple
   independent write-ups reaching the same conclusion — treat this as well-corroborated practical
   guidance rather than an official policy.)*
3. Cloudflare gives you two nameservers (e.g. `xxx.ns.cloudflare.com`). Go back to Wix → Domains →
   Domain Actions → and look for the option to change nameservers (Wix may call this "Connect
   Domain" / "Use custom nameservers" or similar — the exact wording moves around in Wix's UI, so
   look under Domain Actions if it isn't obvious). Enter Cloudflare's two nameservers there.
4. Wait for the Cloudflare dashboard to show the domain as **Active** (Cloudflare says this
   typically takes minutes, up to 24 hours). Until then, DNS resolution is still working normally
   through Wix's nameservers, so the site stays up throughout this step.
5. Re-confirm `katsrugbyclub.com` and `www.katsrugbyclub.com` still load correctly once Cloudflare
   shows Active.

### Phase 4 — Unlock the domain and get its authorization code from Wix (~10 minutes, code arrives by email — Wix doesn't state an exact delivery time)

1. Confirm the domain qualifies for transfer. Per Wix's own transfer page, ICANN rules mean a
   domain **cannot** be transferred if any of the following happened in the last 60 days: it was
   first registered, its registrant contact info was changed, or it was already transferred.
   *(Source: [Wix — Domain Transfer](https://www.wix.com/domains/domain-transfer): "You usually
   can't transfer a domain within 60 days of registering it because of ICANN's '60-day domain
   lock' policy.")* If katsrugbyclub.com doesn't meet this, wait until it does before continuing.
2. In Wix, go to **Domains**, click **Domain Actions** next to `katsrugbyclub.com`, and choose
   **Transfer away from Wix**. Wix will ask you to confirm ("Transfer Domain" → "I Still Want to
   Transfer"). Wix does not have a separate manual "unlock" toggle for this — starting the
   transfer-away flow is what unlocks the domain and triggers the authorization (EPP) code, sent to
   the domain's registrant contact email.
   *(Source: [Wix — Transferring Your Wix Domain Away from
   Wix](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749).)*
3. Also check that **domain privacy/WHOIS privacy is off (or that you have access to the
   registrant email)**, since the authorization code and the transfer-approval request both go to
   that inbox.
4. Save the authorization code somewhere safe once it arrives — you'll paste it into Cloudflare in
   the next phase.

### Phase 5 — Start the registrar transfer at Cloudflare (~30 minutes of active work; Cloudflare states the full transfer can take "up to 10 days", Wix states "up to 7–8 days" — expect up to about a week and a half)

The site stays live and reachable throughout this entire phase — DNS is already being served by
Cloudflare from Phase 3, and a registrar transfer only changes *who bills for and administers* the
domain, not where it resolves.

1. In the Cloudflare dashboard, go to the domain → **Transfer Domain In**, and paste the
   authorization code from Phase 4.
2. Cloudflare will ask for registrant contact details (required by ICANN) and a payment method on
   file, since a transfer also counts as a one-year renewal — **you cannot get a "free" partial
   transfer; the standard renewal-price year is added on top of whatever time was left**.
   *(Source: [Wix — Domain
   Transfer](https://www.wix.com/domains/domain-transfer): "You must pay for at least one
   additional year of registration at the standard renewal price".)*
3. Confirm the request. Wix (the losing registrar) will then email a separate transfer-approval
   request — approve it there too; most registrars send this within 24 hours of the request, and
   the transfer usually completes within an hour of approving, but can take longer.
   *(Source: same [Cloudflare transfer
   docs](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/)
   as above: "Active work: about 30 minutes. Total time: up to 10 days, depending on your
   registrar.")*
4. **Price check** — Cloudflare Registrar sells at the registry's wholesale cost with no markup, so
   the exact number moves with the underlying `.com` wholesale fee rather than being a fixed retail
   price. As of this writing, independent domain-price trackers report Cloudflare's `.com` price at
   roughly **$10.44–$10.46/year**, and note a wholesale increase (Verisign's registry fee) is
   expected to push this to roughly **$11.15/year around November 2026**. Cloudflare's own
   marketing page confirms the *policy* ("Cloudflare Registrar does not mark up domain prices at
   all... customers only pay the price charged by registries and ICANN") but does not publish a
   literal number on a page this research could fetch — **the club should check the live price
   shown in the Cloudflare dashboard at the moment of transfer**, rather than relying on the figure
   above. *(Sources: [Cloudflare — Registrar
   product page](https://www.cloudflare.com/products/registrar/) for the no-markup policy;
   third-party trackers [tld-list.com/registrars/cloudflare](https://tld-list.com/registrars/cloudflare)
   and [startupowl.com/reviews/cloudflare-registrar](https://startupowl.com/reviews/cloudflare-registrar)
   for the current/upcoming numbers — not verified against Cloudflare's own dashboard, since this
   task didn't log into any account.)*

### Phase 6 — After the transfer completes (~15 minutes)

1. Confirm in the Cloudflare dashboard that `katsrugbyclub.com` now shows Cloudflare as the
   registrar (not just the DNS host).
2. Re-check `https://katsrugbyclub.com` and `https://www.katsrugbyclub.com` one more time, and
   confirm **Enforce HTTPS** is still ticked in the repo's **Settings → Pages**.
3. In Wix, the domain itself has now left Wix, so there's nothing left to "cancel" on the domain
   side — but the **website/Premium plan is billed completely separately from the domain** and
   will keep renewing on its own unless cancelled. Go to Wix **Premium Subscriptions** and cancel
   or let the site plan lapse once you're sure the GitHub Pages site is fully working.
   *(Source: [Wix — Canceling a Wix
   Domain](https://support.wix.com/en/article/canceling-a-wix-domain): "Your site plan and domain
   are separate services. If you want to cancel your Premium or Studio plan, you'll need to do
   that separately.")*
4. **Before cancelling the Wix plan**, double check whether Wix was also hosting any
   `@katsrugbyclub.com` email mailboxes (e.g. `info@`, `manager@`) — cancelling the plan can cut
   those off. Set up replacement email hosting first (Google Workspace, Zoho Mail, etc.) if so.

### What's genuinely uncertain in this guide

- **Wix's exact wording/menu path for "unlock" and for changing nameservers** moves around in
  Wix's own UI over time and between account types, and Wix's help articles don't show a
  standalone "unlock" switch separate from the transfer-away flow itself — treat "Domain Actions"
  as the place to look, not the literal button text above.
- **How long Wix actually takes to email the authorization code** after you request it isn't
  stated on Wix's own pages this research could reach (one third-party support site claims "within
  24 hours," but that wasn't confirmed on support.wix.com directly).
- **The exact current Cloudflare `.com` price** — Cloudflare doesn't publish a plain numeric price
  list on a page this research could fetch (the pricing pages returned 403/no figures); the
  ~$10.44–$10.46/year figure comes from third-party domain-price trackers, not Cloudflare directly.
  Confirm the live number in the Cloudflare dashboard before starting Phase 5.
- **Keeping Cloudflare DNS records "DNS only" instead of proxied** is well-corroborated advice from
  community sources, not from an official Cloudflare or GitHub statement — included here because
  the failure mode it avoids (silent HTTPS certificate renewal failure) is exactly the kind of
  downtime this whole runbook is trying to prevent.
