# YBC — Your Board Car

Mobile-first car auction & sale PWA. Next.js 14 (App Router) + Supabase.

## Features

- **Auction (Home)** — admin-uploaded photos in a swipeable (left/right) full-bleed
  feed, TikTok-style right-rail buttons: **Love**, **စျေး (offer price)**, **Share**.
  The offer button opens a form for the buyer's price + Viber number, saves it to
  Supabase, and routes the buyer to the admin's Viber or Telegram.
- **Sale** — table/card view of admin-listed cars with full specs (model, power,
  year, mileage, transmission, fuel type, color, price).
- **Account** — quick contact links + admin login.
- **Admin dashboard** — upload auction photos, add/manage sale listings, view
  incoming offers, and edit the Viber/Telegram contact routing at any time.
- Installable PWA (manifest + service worker), mobile-first layout capped at a
  phone-width column, safe-area aware for notches/home indicators.

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/schema.sql` (creates tables, RLS
   policies, and the `car-photos` storage bucket).
3. Create your first admin login:
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
   ```
   Copy the printed hash, then in the SQL editor:
   ```sql
   insert into admins (username, password_hash)
   values ('admin', '<paste hash here>');
   ```
4. Grab your Project URL, anon key, and service role key from
   Project Settings → API.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and generate a `SESSION_SECRET`:
```bash
openssl rand -base64 32
```

## 3. Run locally

```bash
npm install
npm run dev
```
Open http://localhost:3000. Admin dashboard: http://localhost:3000/admin/login.

## 4. Set your contact routing

Log into `/admin/login`, go to **Settings**, and fill in your Viber number and/or
Telegram username — this is what buyers get routed to when they tap **စျေး**.
You can change this any time; nothing is hardcoded.

## 5. Deploy

Push to GitHub and import into Vercel. Add the same environment variables in
Vercel's Project Settings, then deploy. Vercel gives you HTTPS by default,
which is required for the PWA install prompt and camera/share APIs.

## Project structure

```
app/
  page.tsx              Home — auction swipe feed
  sale/page.tsx          Sale — listings with spec tables
  account/page.tsx        Account — contact + admin login link
  admin/login/page.tsx     Admin login
  admin/dashboard/page.tsx  Admin dashboard (photos / cars / offers / settings)
  api/offer/route.ts       Buyer submits a price offer
  api/admin/*               Admin-only API routes (protected by middleware.ts)
components/                Auction feed, cards, offer modal, sale table, nav
lib/supabase/               Browser + server Supabase clients
lib/auth.ts                 Admin session (signed JWT cookie)
supabase/schema.sql          Full DB schema + RLS + storage bucket
```

## Notes

- Reads (auction photos, sale listings, settings) go straight from the browser
  to Supabase using the public anon key, gated by Row Level Security.
- All writes (uploads, listings, settings, offers) go through Next.js API
  routes using the service role key, so the anon key never needs write access.
- The offer flow copies the message to the clipboard and opens
  `viber://chat?number=...` (or a pre-filled `t.me` link for Telegram) — Viber's
  own scheme doesn't support pre-filled text, so the buyer pastes the copied
  message once the chat opens.
