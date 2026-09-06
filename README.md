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
├── contact.html              Contact (full form + map)
├── 2023-24-season.html      Fixtures & Results (live BC Rugby link-out + 2024/25 archive; filename kept from the live site's URL)
├── assets/
│   ├── css/style.css        Single shared stylesheet (brand colours, layout, responsive rules)
│   ├── js/main.js           Mobile nav toggle + progressive-enhancement form submission
│   └── img/                 All images used on the site (crests, photos, opponent logos, favicon)
└── README.md
```

There's no build step and no framework — open `index.html` directly in a browser, or serve the
folder with any static file server, and everything works.

Each page repeats its own `<header>`/`<footer>` markup (no templating engine, by design — keeps
the "just files" property that makes static hosting simple). If you add a page, copy the
nav/footer block from an existing one and update the `aria-current="page"` attribute on the
matching nav link.

## Brand

Colours were sampled directly from the club crest (`assets/img/kats-logo.png`):

- Green `#056839`
- Gold `#d7922c`
- White `#ffffff`

Headings use **Poppins** (a free geometric sans similar in spirit to the Futura family the
original site used); body text uses **Inter**. Both are loaded from Google Fonts — remove the
`<link>` tags in each page's `<head>` if you'd rather self-host fonts or drop them entirely.

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
link to be BC Rugby's own branded page rather than PlayHQ directly. **A live, client-side
fixtures/ladder widget pulling this data automatically was investigated but is on hold**: BC
Rugby's page calls a CORS-open PlayHQ API (so it *can* legitimately be called from another site's
JavaScript, unlike the blocked iframe approach), but doing so needs a PlayHQ API key and the
Kats' specific Division 2 team ID, neither of which exist yet. Once the club has requested and
received those from PlayHQ/BC Rugby, a live widget can replace this link-out card — until then,
linking straight to BC Rugby's page is the correct, zero-maintenance option.

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
- `2023-24-season.html`'s archived 2024/25 fixture list is a historical snapshot only — it is not
  meant to be updated. If BC Rugby ever discontinues PlayHQ, replace the `.playhq-card` blocks
  with a hand-maintained fixtures list again (the original `.fixtures-list`/`.fixture` markup and
  CSS are still in `style.css` and used for the archive section, so nothing needs to be rebuilt).

## Forms

Two kinds of form appear on the site, matching the original:

1. A short "quick contact" form (first/last name, email, message) repeated near the bottom of
   every page.
2. A fuller contact form (name, address, email, phone, subject, message) on `contact.html`.

Neither form has a real backend — **you must wire up your own endpoint before launching**. Every
`<form>` currently points at:

```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" data-ajax-form>
```

To fix this:

1. Create a free account at [formspree.io](https://formspree.io) (100 submissions/month free) and
   make a form.
2. Replace every `YOUR_FORM_ID` in `index.html`, `about-us.html`, `history.html`,
   `join-our-team.html`, `contact.html`, and `2023-24-season.html` with the ID Formspree gives you.
3. That's it — `assets/js/main.js` submits the form via `fetch` and shows an inline "Thanks for
   submitting!" message; the plain `<form action>` also works with JavaScript disabled (Formspree
   redirects to its own thank-you page in that case).

Any other static-friendly form backend (Netlify Forms, Basin, Getform, a Google Form, a serverless
function you write yourself) works the same way — just change the `action` URL.

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

**Captured:** full navigation (Home, About Us, History, Join Our Team, Contact, Fixtures &
Results), all page text/copy, the club crest and every photo/opponent-crest image referenced on
those pages, the contact address/phone/email, social links (Facebook, Instagram, Twitter), and
the full 2024/25 fixtures & results list (15 rounds, scores where played).

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
  **doesn't** need renaming every season anymore — PlayHQ is now the source of truth for the
  current season, and this file's own fixture list is kept only as a labelled 2024/25 archive.

## Manual steps for the club after migrating

1. **Swap in a real form backend** — see "Forms" above. This is the most important step; forms
   will silently do nothing useful until `YOUR_FORM_ID` is replaced.
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
