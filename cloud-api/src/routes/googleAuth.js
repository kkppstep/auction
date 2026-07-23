const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const supabase = require('../lib/supabaseClient');

const router = express.Router();

// POST /auth/google-exchange — the browser signs in with Google via
// Supabase Auth client-side (admin-app), then hands us that Supabase
// access token here. We verify it by asking Supabase's own Auth
// server (supabase.auth.getUser()) rather than decoding the JWT
// locally with a shared secret — Supabase has been moving projects
// from a shared HS256 secret to asymmetric signing keys, and a local
// shared-secret check silently fails against a token signed the new
// way. Asking the Auth server directly works regardless of which
// signing method the project uses, at the cost of one extra network
// call on login (infrequent, so the tradeoff is fine).
router.post('/auth/google-exchange', async (req, res) => {
  const { supabase_access_token } = req.body;
  if (!supabase_access_token) return res.status(400).json({ error: 'supabase_access_token_required' });

  const { data, error } = await supabase.auth.getUser(supabase_access_token);
  if (error || !data?.user) {
    console.error('[auth] supabase token verification failed:', error?.message);
    return res.status(401).json({ error: 'invalid_supabase_token' });
  }

  const googleEmail = data.user.email;
  const googleSub = data.user.id;
  const googleName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || googleEmail;
  if (!googleEmail) return res.status(400).json({ error: 'google_account_has_no_email' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Existing owner signing back in.
    const existing = await client.query(
      'SELECT id, tenant_id FROM users WHERE auth_provider = $1 AND auth_provider_id = $2',
      ['google', googleSub]
    );

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      // First-time sign-in: create the tenant and owner user together.
      // Business name defaults to a placeholder so signup stays one
      // click — the owner renames it from the Business tab afterward.
      const tenantRes = await client.query(
        `INSERT INTO tenants (id, business_name, contact_email, subscription_status, subscription_expires_at)
         VALUES (gen_random_uuid(), $1, $2, 'trial', now() + interval '14 days')
         RETURNING id`,
        [`${googleName}'s Business`, googleEmail]
      );
      const userRes = await client.query(
        `INSERT INTO users (id, tenant_id, name, email, auth_provider, auth_provider_id)
         VALUES (gen_random_uuid(), $1, $2, $3, 'google', $4)
         RETURNING id, tenant_id`,
        [tenantRes.rows[0].id, googleName, googleEmail, googleSub]
      );
      user = userRes.rows[0];
    }

    await client.query('COMMIT');

    const storesRes = await db.query(
      `SELECT su.store_id, su.role, s.name AS store_name
       FROM store_users su JOIN stores s ON s.id = su.store_id
       WHERE su.user_id = $1`,
      [user.id]
    );

    const token = jwt.sign({ sub: user.id, tenant_id: user.tenant_id }, config.jwtSecret, { expiresIn: '12h' });
    res.json({
      token,
      user: { id: user.id, name: googleName, email: googleEmail, tenant_id: user.tenant_id },
      stores: storesRes.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth] google exchange failed:', err.message);
    res.status(500).json({ error: 'google_exchange_failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
