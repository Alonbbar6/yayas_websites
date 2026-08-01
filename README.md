# Walks with Yaya 🐾

Two things live in this repo:

- **The marketing site** (repo root) — a cinematic, dependency-free static page. Live at `/`.
- **The app** (`app/`) — Yaya's dashboard for bookings, running a walk with live GPS + photo report cards, and the client-facing link that shows the live map and finished report. Live at `/app/`.

Yaya works **cash-only** and books by phone, so there's no online payment or self-service booking anywhere — the site's contact form just captures a name, phone, and best time to call, so Yaya can reach out herself.

## ✨ Marketing site

A fast, dependency-free static site with:

| Section | Purpose (from a dog-walking perspective) |
|---|---|
| **Cinematic hero** | Parallax sky, drifting clouds, animated sun, walking-dog scene, word-by-word headline reveal, live stat counters |
| **Trust marquee** | Insured · GPS-tracked · background-checked · pet-first-aid certified — the signals owners look for first |
| **About Yaya** | Personal story that builds the human connection + credentials |
| **Services** | Solo walks, group adventures, puppy drop-ins, pet sitting, overnight care, trail hikes |
| **How it works** | Meet & greet → book → GPS walk → report card |
| **🌟 Pup Report Card** | A phone mockup previewing the real thing — see `app/` for the live version generated from an actual walk |
| **Gallery** | The "happy tails" wall |
| **Testimonials** | Auto-playing review slider |
| **Pricing** | Three honest, no-contract packages (cash) |
| **Service area** | Animated map with pulsing coverage pins |
| **FAQ** | Vaccinations, keys, cancellations, reactive dogs, weather |
| **Lead form** | "Have Yaya call me" — name, phone, best time to call. No booking or payment happens here. |

## 🐾 The app (`app/`)

A Vite + TypeScript PWA talking to a shared Supabase backend:

- **Yaya's dashboard** (`app/` → `/app/`) — sign in with a magic link, see today's and next-7-days' bookings, add clients/dogs/bookings, work the leads inbox, and run a walk: start/end, live GPS breadcrumb trail on a map, potty/water/note logging, camera photo capture. All from one phone-friendly screen (installable as a PWA).
- **Client tracking page** (`app/track.html` → `/app/track.html?w=<token>`) — no login. Yaya shares this link when a walk starts; it shows a live map while the walk is active, then flips to the finished report card (route, photos, log) once it ends.

## 🚀 Run it locally

**Marketing site** — no build step:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

**App** — needs a Supabase project (see Setup below) and Node 20+:
```bash
cd app
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev
```

## 🔧 Setup: connect the app to Supabase

The code is complete but inert until it has a real Supabase project — this is the one-time setup:

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is plenty for one operator). Note the **Project URL** and **anon public key** from Settings → API.
2. **Run the migrations**: Settings → SQL Editor, run `supabase/migrations/0001_init.sql` then `supabase/migrations/0002_storage.sql`, in order. (Or via the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Create Yaya's account**: Authentication → Users → **Add user** → invite by her real email. This sends her a sign-in email and creates the account without needing public sign-up.
4. **Add her to the admin allowlist** — the schema locks all admin access behind this table (auth alone isn't enough: with sign-ups left on, anyone could request a magic link and get in). Run in the SQL Editor:
   ```sql
   insert into admins (email) values ('yaya@her-real-email.com');
   ```
6. **Lock down sign-ups** now that her account exists: Authentication → Settings → turn off "Allow new users to sign up". Nobody else can create an account after this.
7. **Wire the marketing site's lead form**: in `index.html`, replace `REPLACE_SUPABASE_URL` and `REPLACE_SUPABASE_ANON_KEY` near the top of `<head>` with your real values (the anon key is meant to be public — row-level security limits it to inserting a lead, nothing else).
8. **Wire the app build**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **GitHub Actions repo secrets** (Settings → Secrets and variables → Actions) — the deploy workflow reads them at build time.
9. **Switch GitHub Pages to build via Actions**: Settings → Pages → Build and deployment → Source → **GitHub Actions**. (It's currently set to "Deploy from a branch"; the included workflow needs "GitHub Actions" instead, since it now needs to run `npm run build` for the app.)
10. Push to `main` — the workflow builds the app and republishes both the site and the app together.

### Optional: text Yaya when a new lead comes in

`supabase/functions/notify-lead` sends Yaya a text via Twilio when someone submits the lead form. It's a safe no-op until configured:

1. Get a Twilio account, phone number, Account SID, and Auth Token.
2. Deploy the function: `supabase functions deploy notify-lead`.
3. Set its secrets: `supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1... YAYA_PHONE_NUMBER=+1...`
4. Database → Webhooks → create one on `leads`, event `INSERT`, pointing at the deployed function's URL.

## 🎨 Make the marketing site yours

Open `index.html` and **search for the word `REPLACE`** — every spot that needs
your real details is marked, and there's a checklist at the very top of the
`<body>`:

- **Photos (biggest impact)** — swap the emoji/gradient placeholders (Hero, About, Gallery, Report Card) for real photos of Yaya and her happy clients. Marked `REPLACE PHOTO`.
- **Contact details** — phone, email & hours in the Booking section (and again in the structured-data block in `<head>`).
- **Social links** — the three footer icons and the `sameAs` list in `<head>`, plus the "find me on Instagram/Facebook" line next to the contact list.
- **Business name / tagline / prices / services / service area / reviews** — all plain text in `index.html`.
- **Colours** — the palette lives in `:root` at the top of `css/styles.css`.
- **Privacy & booking policies** — edit `privacy.html` (linked in the footer) and fill in the placeholders.

### 🔎 SEO & sharing
- Open Graph / Twitter tags and `LocalBusiness` structured data are in `<head>` — update the URLs, phone, email, area and social links there.
- A ready-made **social-share image** lives at `assets/social-card.png` — replace it with a real photo-based 1200×630 image.
- Update the domain in `<head>`, `sitemap.xml` and `robots.txt` if you use a custom domain, then submit the sitemap in [Google Search Console](https://search.google.com/search-console).

## ⚠️ Known limitations (v1)

- **iOS backgrounding**: Safari suspends GPS updates when the walk screen isn't in the foreground. Yaya keeps `/app/` open (like a stopwatch) during a walk rather than it tracking silently in her pocket.
- **Photo storage is public-read**: report-card links are unlisted (token-gated) rather than access-controlled. Fine for an MVP; revisit if photo privacy needs to be stronger than "unguessable link."
- **No recurring-booking automation**: `recurring_note` on a booking is a free-text reminder (e.g. "every Tue/Thu") — Yaya still adds each occurrence by hand. Worth a `pg_cron` job later if the manual step becomes a real chore.
- **Single operator only**: the data model assumes one walker (Yaya). Adding other walkers would need walker accounts and job assignment — a deliberate scope decision, not an oversight.

## 📁 Structure
```
index.html, privacy.html      # marketing site markup
css/styles.css, js/main.js    # marketing site styles & behavior
assets/, sitemap.xml, robots.txt, .nojekyll

app/                           # Vite + TS PWA (dashboard + tracking page)
  index.html, track.html
  src/                         # supabase client, api layer, views
  vite.config.ts

supabase/
  migrations/                  # schema + storage bucket, run in order
  functions/notify-lead/       # optional Twilio SMS on new lead

.github/workflows/deploy.yml   # builds app/, combines with the static site,
                                # deploys both to GitHub Pages
```
