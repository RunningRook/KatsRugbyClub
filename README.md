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
├── 2023-24-season.html      2024/25 Fixtures & Results (filename kept from the live site's URL)
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
- **Any Wix-hosted online payment/registration or membership-checkout flow** — none was found
  linked from the crawled pages (dues/fees are described in text only, on `join-our-team.html`),
  but if the live site has a "Pay Dues" button elsewhere that this crawl didn't reach, that
  functionality has no static equivalent and would need a third-party solution (e.g. a payment
  link from Stripe, PayPal.me, or Square).
- **Exact Wix visual theme (fonts/spacing/animations)** — Wix renders its actual theme via
  client-side JS/CSS bundles that aren't present in the plain HTML response, so pixel-perfect
  colours/fonts couldn't be scraped directly. This rebuild's palette was instead sampled from the
  club's own logo file and its typography chosen to match the spirit of the original (geometric
  sans headings + humanist sans body) — visually close, but not a pixel-perfect clone.
- **Season page URL** — kept as `2023-24-season.html` to match the live site's actual URL (the
  club appears to reuse last year's URL/page for each new season rather than creating a new one
  each year), even though its on-page heading now reads "2024/25". Rename/duplicate this file for
  future seasons and update the nav link in every page.

## Manual steps for the club after migrating

1. **Swap in a real form backend** — see "Forms" above. This is the most important step; forms
   will silently do nothing useful until `YOUR_FORM_ID` is replaced.
2. **Re-point DNS** once the new host is live: update the domain's nameservers or `A`/`CNAME`
   records to point at the new static host instead of Wix, then cancel the Wix subscription once
   the new site is confirmed live and DNS has propagated (can take up to 24–48 hours).
3. **Set up email** — if `info@katsrugbyclub.com` / `manager@katsrugbyclub.com` mailboxes were
   provided by Wix, arrange email hosting separately (e.g. Google Workspace, Zoho Mail, or the
   new host's mail service) before cancelling Wix, so club email doesn't go down.
4. **Update the roster and season pages** each year (see above).
5. Optionally set up free HTTPS (Netlify/GitHub Pages both auto-provision this; a shared host may
   need a free Let's Encrypt certificate enabled in its control panel).
