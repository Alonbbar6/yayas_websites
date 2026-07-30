# Walks with Yaya 🐾

A cinematic, single-page website for **Yaya's dog walking & pet care business** — built to win a dog owner's trust in seconds and make booking effortless.

## ✨ What's inside

A fast, dependency-free static site (perfect for GitHub Pages / Netlify) with:

| Section | Purpose (from a dog-walking perspective) |
|---|---|
| **Cinematic hero** | Parallax sky, drifting clouds, animated sun, walking-dog scene, word-by-word headline reveal, live stat counters |
| **Trust marquee** | Insured · GPS-tracked · background-checked · pet-first-aid certified — the signals owners look for first |
| **About Yaya** | Personal story that builds the human connection + credentials |
| **Services** | Solo walks, group adventures, puppy drop-ins, pet sitting, overnight care, trail hikes |
| **How it works** | Meet & greet → book → GPS walk → report card |
| **🌟 Pup Report Card** | The differentiator — a phone mockup showing photos, an animated GPS route, potty/water log & a note after every walk |
| **Gallery** | The "happy tails" wall |
| **Testimonials** | Auto-playing review slider |
| **Pricing** | Three honest, no-contract packages |
| **Service area** | Animated map with pulsing coverage pins |
| **FAQ** | Vaccinations, keys, cancellations, reactive dogs, weather |
| **Booking** | Floating-label meet-&-greet request form |

## 🎬 Cinematic touches
Custom paw cursor · scroll progress bar · reveal-on-scroll · 3D card tilt · animated paw trails · counters · sticky shrinking nav · respects `prefers-reduced-motion` and is fully responsive.

## 🚀 Run it locally
Just open `index.html` — no build step. To serve locally:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## 🌐 Deploy to GitHub Pages
This repo is ready for GitHub Pages — no build step, all paths are relative (so it
works fine under a project subpath like `username.github.io/yayas_websites/`), and a
`.nojekyll` file tells Pages to serve the files as-is.

Go live in three clicks (this is a one-time setup — after this, every push to `main`
re-publishes automatically):

1. In the repo, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set **Branch: `main`** and folder **`/ (root)`**, then click **Save**.

Wait ~1 minute and your site is live at
`https://<username>.github.io/yayas_websites/`.

> **Why this and not a CI workflow?** GitHub only lets the *repo owner* switch Pages
> on for the first time — an automated token can't do that initial activation. Once
> it's on, "Deploy from a branch" already rebuilds on every push, so no Actions
> workflow is needed for a static site like this.

> Using a custom domain? Add a `CNAME` file at the repo root containing your domain
> (e.g. `walkswithyaya.com`) and configure it under **Settings → Pages**.

## 🎨 Make it yours
Open `index.html` and **search for the word `REPLACE`** — every spot that needs
your real details is marked, and there's a checklist at the very top of the
`<body>`. The essentials:

- **Photos (biggest impact)** — swap the emoji/gradient placeholders (Hero, About, Gallery, Report Card) for real photos of Yaya and her happy clients. Marked `REPLACE PHOTO`.
- **Contact details** — phone, email & hours in the Booking section (and again in the structured-data block in `<head>`).
- **Social links** — the three footer icons and the `sameAs` list in `<head>`.
- **Business name / tagline / prices / services / service area / reviews** — all plain text in `index.html`.
- **Colours** — the palette lives in `:root` at the top of `css/styles.css`.
- **Privacy & booking policies** — edit `privacy.html` (linked in the footer) and fill in the placeholders.

### 📨 Make the booking form deliver real enquiries
The form works in **demo mode** out of the box (it validates and shows a success
message but doesn't send). To receive real enquiries by email:

1. Create a free form at [Formspree](https://formspree.io) (or Netlify Forms / Getform). You'll get an endpoint like `https://formspree.io/f/abcdwxyz`.
2. In `index.html`, find the `<form class="book__form" …>` and paste that endpoint into **both** the `action` and `data-endpoint` attributes (replacing `YOUR_FORM_ID`).

That's it — the form then submits by AJAX, shows the success message, and emails Yaya. It also has a hidden honeypot field to deflect spam bots.

### 🔎 SEO & sharing
- Open Graph / Twitter tags and `LocalBusiness` structured data are in `<head>` — update the URLs, phone, email, area and social links there.
- A ready-made **social-share image** lives at `assets/social-card.png` (regenerate it by editing the source in the repo's build notes, or just replace it with a real photo-based 1200×630 image).
- Update the domain in `<head>`, `sitemap.xml` and `robots.txt` if you use a custom domain, then submit the sitemap in [Google Search Console](https://search.google.com/search-console) so Yaya shows up in searches.

## 📁 Structure
```
index.html          # all content & markup + SEO/social tags
privacy.html        # privacy & booking/cancellation policies
css/styles.css      # design system + animations
js/main.js          # cursor, parallax, reveals, counters, slider, form
assets/social-card.png  # 1200×630 link-preview image
sitemap.xml, robots.txt # search-engine discoverability
.nojekyll           # tells GitHub Pages to serve files as-is
```
