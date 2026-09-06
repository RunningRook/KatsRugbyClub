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
├── 2023-24-season.html      Fixtures & Results (live BC Rugby link-out only; filename kept from the live site's URL)
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
