-- ============================================================
-- Multi-tenant POS platform — PostgreSQL schema
-- Internet-first with local-hub fallback (see architecture notes)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANT & SUBSCRIPTION
-- ============================================================
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price_mmk NUMERIC(12,2) NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
    max_stores INT,
    max_terminals_per_store INT,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    subscription_plan_id UUID REFERENCES subscription_plans(id),
    subscription_status TEXT NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial','active','past_due','suspended','cancelled')),
    subscription_expires_at TIMESTAMPTZ,
    -- Per-tenant feature permissions, set by the platform admin — e.g.
    -- {"live_orders": true, "analytics": false, "staff_management": true}.
    -- Missing key = locked by default. Checked by cloud-api's
    -- middleware/features.js on both the sidebar (owner UI) and the
    -- actual API endpoints, so this isn't just a hidden button — the
    -- backend enforces it too.
    feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STORES, HUBS & DEVICES
-- Every store has exactly one local hub. cloud_timeout_ms / retry_*
-- are per-store because outage severity varies a lot by region in
-- Myanmar (e.g. conflict-affected states vs. Yangon/Mandalay).
-- ============================================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    township TEXT,
    region_state TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Yangon',
    cloud_timeout_ms INT NOT NULL DEFAULT 3000,
    retry_count INT NOT NULL DEFAULT 2,
    retry_backoff_ms INT NOT NULL DEFAULT 1000,
    kbzpay_qr_url TEXT,   -- static KBZPay QR image shown at customer checkout; NULL = not offered
    logo_url TEXT,        -- shown in the customer app's header and admin-app's context
    ambient_audio_url TEXT,          -- small looping audio file played while browsing the menu
    ambient_audio_enabled BOOLEAN NOT NULL DEFAULT false,
    -- { preset: 'green'|'cozy'|'ice'|'custom', primary_color, background_image_url, gradient_from, gradient_to }
    theme_config JSONB NOT NULL DEFAULT '{"preset": "green"}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    app_version TEXT,
    local_lan_url TEXT,   -- e.g. 'http://192.168.1.50:4000' — handed to customer phones as the offline fallback target
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
    last_seen_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Short-lived, single-use codes an admin issues when setting up a new
-- hub device. The device has no credentials yet, so registration is
-- gated by this code instead of a hub API key.
CREATE TABLE provisioning_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_by_hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_provisioning_codes_lookup ON provisioning_codes (store_id, code, status);

CREATE TABLE terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'terminal' CHECK (device_type IN ('terminal','kitchen_display')),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target TEXT NOT NULL,          -- e.g. 'usb:///dev/usb/lp0' or '192.168.1.50:9100'
    role TEXT NOT NULL DEFAULT 'receipt' CHECK (role IN ('receipt','kitchen','bar')),
    has_cash_drawer BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS & ACCESS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    -- NULL for Google-authenticated owners (see auth_provider) — they
    -- have no password in our system, Google is their identity.
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'password' CHECK (auth_provider IN ('password', 'google')),
    auth_provider_id TEXT,          -- Supabase auth user id, for Google accounts
    -- Individual account control, separate from tenant-wide
    -- subscription_status — platform admin can deactivate one person
    -- without suspending the whole business. Also settable by an
    -- owner for their own staff (not yet exposed in admin-app; see
    -- cloud-api README).
    is_active BOOLEAN NOT NULL DEFAULT true,
    pin_code_hash TEXT,           -- fast PIN login at the terminal
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_auth_provider_id ON users (auth_provider_id) WHERE auth_provider_id IS NOT NULL;

-- Platform operator accounts — deliberately separate from tenant
-- `users`. Bootstrapped once via PLATFORM_API_KEY (see
-- POST /platform/admins), logged into normally after that.
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','manager','cashier','kitchen_staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, store_id)
);

-- ============================================================
-- CATALOG
-- ============================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate_percent NUMERIC(5,2) NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    sku TEXT,
    barcode TEXT,
    price NUMERIC(12,2) NOT NULL,
    cost NUMERIC(12,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    -- Manually set by the owner/manager, not stock-counted. A missing
    -- row for a product+store means "available" by default (see the
    -- COALESCE in publicMenu.js) — a row only needs to exist once
    -- something is marked unavailable.
    is_available BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, store_id)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT,
    phone TEXT,
    loyalty_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ORDERS
-- id is generated client-side (terminal or hub), never by the
-- database, so an order created during a cloud-unreachable moment
-- keeps a stable identity when it eventually syncs.
-- origin + sync_status record which path handled it.
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,
    terminal_id UUID REFERENCES terminals(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    table_number TEXT,
    channel TEXT NOT NULL DEFAULT 'staff_terminal' CHECK (channel IN ('staff_terminal','customer_qr')),
    order_number TEXT,                 -- human-friendly, per-store sequence
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','voided','refunded')),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    origin TEXT NOT NULL CHECK (origin IN ('cloud','hub')),
    sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced','pending','failed')),
    -- NULL until the store's hub has pulled this order down and printed
    -- it. Only meaningful for origin = 'cloud' (customer self-order);
    -- hub-originated orders are set delivered immediately since the hub
    -- already has them. See the hub pull-down mechanism.
    delivered_to_hub_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ
);
CREATE INDEX idx_orders_store_created ON orders (store_id, created_at DESC);
CREATE INDEX idx_orders_sync_status ON orders (sync_status) WHERE sync_status <> 'synced';
CREATE INDEX idx_orders_undelivered ON orders (store_id) WHERE origin = 'cloud' AND delivered_to_hub_at IS NULL;

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name_snapshot TEXT NOT NULL,   -- survives later product renames/deletes
    qty NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(12,2) NOT NULL,
    notes TEXT   -- customer's special instructions, e.g. 'extra sweet, less ice'
);

-- ============================================================
-- PAYMENTS
-- Myanmar wallets are first-class methods. Wallet payments start
-- 'pending' until a webhook confirms them, or staff override the
-- status after visually verifying payment on the customer's phone.
-- ============================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('cash','kbzpay','wavepay','cbpay','mpu_card','bank_transfer','other')),
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','refunded')),
    external_ref TEXT,                 -- aggregator transaction id / MMQR reference
    confirmed_by TEXT CHECK (confirmed_by IN ('webhook','staff_override')),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_pending ON payments (status) WHERE status = 'pending';

-- ============================================================
-- OFFLINE SYNC
-- Primary copy of this table lives in the hub's local SQLite db;
-- mirrored here mainly for cloud-side visibility/debugging once
-- entries land.
-- ============================================================
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,          -- 'order' | 'payment' | 'inventory' | ...
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
    payload JSONB NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_queue_pending ON sync_queue (hub_id, status) WHERE status = 'pending';

-- ============================================================
-- PRINTING
-- Print jobs are a local-only concern on the hub. This cloud copy
-- is optional and mainly useful for remote diagnostics/support.
-- ============================================================
CREATE TABLE print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('receipt','kitchen','bar')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printed','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    printed_at TIMESTAMPTZ
);

-- ============================================================
-- AUDIT LOG
-- Voids, refunds, and manual payment overrides are sensitive —
-- always trace who did what, from where.
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,               -- e.g. 'order.voided', 'payment.manual_confirm'
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
