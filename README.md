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

## 5. Push notifications for new offers (optional but recommended)

When a buyer submits a price offer, the API route calls `sendPushToAdmins()`
which sends a push notification to every device registered in the
`push_tokens` table. Registration only happens from inside `/admin/dashboard`
running in the Android app (see the `ybc-android` repo) — regular website
visitors are never prompted for push permission.

To enable it:
1. In Firebase Console → ⚙️ **Project settings → Service accounts →
   Generate new private key**, download the JSON.
2. Base64-encode it:
   ```bash
   base64 -w0 service-account.json   # Linux
   base64 -i service-account.json    # macOS
   ```
3. Set `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel (Project Settings →
   Environment Variables) to that base64 string, and redeploy.

This is the **same Firebase project** you register the Android app under in
`ybc-android`'s README (its `google-services.json` step) — one Firebase
project covers both sides: the app receives, this key sends.

Without this env var set, offers still save to Supabase and show up in the
admin dashboard's **Offers** tab as normal — push notifications are just
skipped silently.

## 6. Native share in the Android app

The Share button on auction cards calls `@capacitor/share`'s native share
sheet when running inside the Android app (`Capacitor.isNativePlatform()`),
and falls back to the browser's Web Share API / clipboard copy on the
regular website. No extra setup needed — it's already wired up.

## 7. Deploy

Push to GitHub and import into Vercel. Add the same environment variables in
Vercel's Project Settings, then deploy. Vercel gives you HTTPS by default,
which is required for the PWA install prompt and camera/share APIs.

## Project structure

## How auction posts work

Each upload batch in the admin dashboard becomes one **post** — buyers swipe
**vertically** between posts (TikTok-style) and **tap left/right** on the
image to browse photos *within* the current post (Instagram Stories-style).
This is exactly the "post mechanism" — 50 photos uploaded together show up
as one swipeable post; the next 50 uploaded later show up as a separate post.

Uploads happen one photo at a time behind the scenes (create the post, then
stream each photo into it), so 50+ photo batches never hit Vercel's request
size or timeout limits — you'll see a progress bar in the dashboard.

```
app/
  page.tsx              Home — auction post feed (vertical swipe)
  sale/page.tsx          Sale — listings with spec tables
  account/page.tsx        Account — contact + admin login link
  admin/login/page.tsx     Admin login
  admin/dashboard/page.tsx  Admin dashboard (posts / cars / offers / settings)
  api/offer/route.ts       Buyer submits a price offer (also triggers push)
  api/push/register/route.ts Device registers for push notifications
  api/admin/posts/route.ts   Create/edit/delete a post
  api/admin/posts/[postId]/photos/route.ts  Add/remove one photo in a post
  api/admin/*               Admin-only API routes (protected by middleware.ts)
components/
  AuctionFeed.tsx            Vertical swipe between posts
  AuctionPostCard.tsx         Tap left/right to browse photos in one post
  AuctionCard.tsx              Renders a single photo + action rail
  PushNotificationSetup.tsx    Registers admin device for push (dashboard only)
lib/supabase/               Browser + server Supabase clients
lib/auth.ts                 Admin session (signed JWT cookie)
lib/push.ts                  Sends push notifications via Firebase Cloud Messaging
lib/storage.ts                Maps a public Supabase URL back to its storage path
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
