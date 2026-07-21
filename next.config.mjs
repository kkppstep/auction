# Supabase project settings (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

# Service role key — server-only, NEVER expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Random long string used to sign admin login session cookies.
# Generate one with: openssl rand -base64 32
SESSION_SECRET=replace-with-a-long-random-string

# Firebase service account JSON (base64-encoded), used to send push
# notifications to the admin's Android app when a new offer comes in.
# Firebase Console → Project settings → Service accounts → Generate new
# private key → download the JSON → base64 it → paste here.
# Optional: leave unset and push notifications are silently skipped.
FIREBASE_SERVICE_ACCOUNT_JSON=
