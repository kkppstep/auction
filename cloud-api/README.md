# POS cloud API

Receives synced/pending orders from store hubs, serves each store's
sync configuration, and backs the admin dashboard and customer
ordering page. Run against a Postgres database created from
`schema.sql` (in the project root, alongside `local-hub/`).

## ⚠️ Required one-time setup: Google OAuth (for owner sign-in)

This is an external dashboard step, not something deployment does for
you — easy to miss, so it's its own section rather than a line in a
paragraph. Owner sign-in now works via "Sign in with Google," which
needs both of these configured **before it will work at all**:

1. **Google Cloud Console** → create an OAuth 2.0 Client ID (APIs &
   Services → Credentials → Create Credentials → OAuth client ID →
   Web application). Note the Client ID and Client Secret.
2. **Supabase dashboard** → Authentication → Providers → Google →
   paste in that Client ID and Client Secret, enable the provider.
   Supabase will show you a callback URL — add that exact URL to the
   Google OAuth client's "Authorized redirect URIs" back in step 1.

Until both of these are done, the "Sign in with Google" button in
`admin-app` will fail silently or error out — it's not a bug in this
code, it's this configuration being incomplete.

CORS is open (`cors()` with defaults) since `customer-app` and
`admin-app` are static sites on different domains than this API —
without it, every browser call from them would be blocked. Worth
restricting to your actual deployed domains before going live.

## Auth — four separate schemes, deliberately not shared

- **Hub auth** — every hub carries a bearer API key issued at
  registration. The cloud stores only its SHA-256 hash
  (`hubs.api_key_hash`) and compares against that — see
  `src/middleware/auth.js`.
- **User auth** — real login for shop owners/managers/staff, two ways
  in: email/password (bcrypt, `users.password_hash`) via
  `POST /auth/login`, or Google sign-in via `POST /auth/google-exchange`
  (see the OAuth setup section above). Both return the same JWT shape.
  A first-time Google sign-in auto-creates a new tenant + owner user —
  that's the *only* way a tenant gets created; there's no manual/key-
  gated alternative. Per-store role (owner/manager/cashier/kitchen_staff)
  is looked up fresh from `store_users` on every request rather than
  baked into the token, so revoking someone's access takes effect
  immediately — see `src/middleware/userAuth.js` and
  `src/middleware/roles.js`. This middleware also blocks the request
  entirely if the tenant's `subscription_status` is `suspended`/
  `cancelled` (`402`), or if that specific user's `is_active` is false
  (`403`) — a platform admin can deactivate one account without
  suspending the whole tenant.
- **Platform-admin auth** — real accounts for you, the platform
  operator, separate from tenant `users` (`platform_admins` table,
  own JWT secret `PLATFORM_JWT_SECRET` — never interchangeable with a
  tenant-user token). `POST /platform/auth/login` for daily use. There
  is deliberately **no API endpoint that creates a platform admin** —
  you insert the row directly via SQL (see `create-platform-admin.sql`
  in the project root, uses pgcrypto to bcrypt-hash the password in the
  same INSERT). One less credential (a shared bootstrap key) to leak.
  The platform-admin UI lives at `admin-app/platform/` — a genuinely
  separate page (own `index.html`/`platform.js`), not a mode toggle
  inside the shop-owner app, and not linked from it anywhere.
- **Feature permissions** — `tenants.feature_overrides` (JSONB, e.g.
  `{"live_orders": true, "analytics": false}`) gates both the owner
  sidebar's tabs AND the underlying endpoints
  (`src/middleware/features.js`'s `requireFeature(key)`), currently
  applied to Live Orders, Analytics, and Staff management. A missing
  key defaults to locked — new tenants start with none of these until
  a platform admin turns them on. This is separate from and simpler
  than `subscription_plans.features`, which is descriptive/billing
  data only and isn't enforced anywhere.

## Endpoints

- `GET /health` — no auth.
- `POST /auth/login` — public. `{ email, password }` → JWT + the list
  of stores that user has a role at.
- `POST /auth/google-exchange` — public. `{ supabase_access_token }` →
  same response shape as `/auth/login`. Verifies the token by calling
  Supabase's own Auth server (`supabase.auth.getUser()`) rather than
  decoding it locally with a shared secret — this works regardless of
  whether the Supabase project uses the legacy shared-secret (HS256)
  or newer asymmetric signing keys, and needs no `SUPABASE_JWT_SECRET`
  env var. Creates a new tenant + owner on a first-time sign-in
  (placeholder business name, renamed from the Business tab
  afterward), or logs in an existing one.
- `POST /platform/auth/login` — public. `{ email, password }` → a
  platform-admin JWT (separate token type from tenant users). No
  corresponding create-account endpoint — see `create-platform-admin.sql`.
- `GET /platform/tenants` — platform-admin. Every tenant, with store
  counts, for the operator's overview.
- `PATCH /platform/tenants/:id` — platform-admin. Change
  `subscription_status`/`subscription_plan_id`/`subscription_expires_at`
  and/or `feature_overrides` — the latter is what actually gates the
  owner's Live Orders/Analytics/Staff tabs and endpoints.
- `GET /platform/features` — platform-admin. The canonical list of
  gate-able feature keys, so the UI doesn't hardcode a duplicate list.
- `GET /platform/tenants/:id/users` — platform-admin. Every user under
  one tenant, with their store roles and `is_active` status.
- `PATCH /platform/users/:id` — platform-admin. `{ is_active?,
  new_password? }` — deactivate one specific account, or reset its
  password as an emergency access grant (works even for a Google-only
  account; doesn't change their normal sign-in method, just adds a
  password as a fallback).
- `/platform/plans` (GET/POST/PATCH) — platform-admin. CRUD for
  `subscription_plans` — descriptive/billing data (price, cycle, max
  stores), separate from and NOT the same as `feature_overrides`. See
  the auth section above for why these are kept apart.
- `GET /admin/tenants/me` — user-authenticated. The caller's own tenant.
- `/admin/stores`, `/admin/categories`, `/admin/products` — user-
  authenticated CRUD, scoped to the caller's own tenant. Category/
  product writes require `owner` or `manager` role at any of the
  tenant's stores; store creation just requires being logged in (the
  creator becomes that store's `owner` automatically). `PATCH
  /admin/stores/:storeId` (owner/manager) updates an existing store's
  settings — currently `kbzpay_qr_url` and the ambient-audio fields.
- `GET /admin/orders?store_id=` — user-authenticated, requires
  `owner`/`manager` at that specific store.
- `POST /admin/stores/:storeId/provisioning-codes` — user-authenticated,
  requires `owner`/`manager` at that store. Issues a short-lived,
  single-use code for setting up a new hub device.
- `/admin/stores/:storeId/staff` (POST/GET/DELETE) — owner-only for
  adding/removing, owner or manager for viewing. Creates a login for a
  manager/cashier/kitchen_staff at that store, or reuses an existing
  user in the same tenant (e.g. staff working two branches).
- `GET /admin/stores/:storeId/live-orders` — any assigned role. Open
  orders only, with items/notes/payment status included — backs the
  kitchen/staff working view.
- `POST /admin/uploads` — owner/manager. Accepts a base64-encoded file
  (image or small audio loop, 5MB cap) and returns a public URL via
  Supabase Storage. Backs the drag-and-drop upload zones in
  `admin-app` for product images, the KBZPay QR, and ambient audio —
  no more hand-hosting files elsewhere and pasting URLs.
  **Requires a Storage bucket named `uploads` in your Supabase project,
  set to Public** (Supabase dashboard → Storage → New bucket), plus
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set as environment
  variables. Without these this endpoint returns 500s.
- `POST /admin/orders/:id/confirm-payment` — owner/manager only. Marks
  pending payments confirmed via staff override, writes to `audit_log`.
- `POST /admin/orders/:id/status` — any assigned role can move an order
  to `completed`; only owner/manager can `void`/`refund`. Writes to
  `audit_log`.
- `PATCH /admin/stores/:storeId/products/:productId/availability` —
  owner/manager. Manual sold-out toggle, per store (a product can be
  out at one branch and available at another) — not stock-counted.
- `GET /admin/stores/:storeId/analytics?days=7|30|90` — owner/manager.
  Daily revenue, order count/average, and top 10 best sellers by
  quantity, excluding voided/refunded orders.
- `POST /hubs/register` — public, gated by a valid provisioning code
  instead of a hub API key (the device doesn't have one yet). Returns
  `hub_id` + `api_key` in plaintext exactly once — only the key's hash
  is ever stored.
- `GET /public/stores/:storeId/menu` — public, unauthenticated. Called
  by the customer ordering page after a QR scan. No rate limiting yet —
  worth adding before this is exposed for real, since it's the one
  endpoint with zero auth by design.
- `POST /public/stores/:storeId/orders` — public, unauthenticated,
  idempotent on `id`. Sets `origin = 'cloud'` and leaves
  `delivered_to_hub_at` NULL until the store's hub pulls it down.
- `GET /orders/pending` / `POST /orders/:id/ack` — hub-authenticated.
  The pull-down half of the sync loop.

## Deploying to Vercel

```
vercel deploy
```

`vercel.json` routes every request through `api/index.js`, which
re-exports the same Express app used for local dev (`src/app.js`) — no
duplicate route definitions to maintain. Set `DATABASE_URL`,
`JWT_SECRET`, `PLATFORM_JWT_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` as Vercel
environment variables. Use a connection pooler (e.g. Supabase or
Neon's pgbouncer endpoint) for `DATABASE_URL` in production — see the
comment in `src/db.js`.

## Not yet implemented (next steps)

- Password reset / self-service invite flow for staff — an owner sets
  a staff member's initial password directly right now rather than
  sending an invite link. (Platform admin resetting any account's
  password is built — see `PATCH /platform/users/:id` — this gap is
  specifically about owner-initiated staff invites.)
- `max_stores`/`max_terminals_per_store` on `subscription_plans` are
  stored but not enforced — a tenant can create more stores than their
  assigned plan allows.
- Rate limiting on the two public endpoints.
- Order edits and refund handling beyond a plain status change to
  `refunded` — no partial refunds or line-item edits yet.
- Payment webhook support — deliberately skipped for now, since
  KBZPay/WavePay/CBPay don't offer reliable webhook confirmation for
  small merchants in Myanmar. The `staff_override` path (now with a
  real UI button in admin-app) is primary.
