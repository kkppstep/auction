require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/pos',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // Separate secret from jwtSecret on purpose — a platform-admin token
  // must never be accepted by tenant-user routes or vice versa, even
  // if there were a bug in a role check somewhere.
  platformJwtSecret: process.env.PLATFORM_JWT_SECRET || 'dev-platform-secret-change-me',
  // Used to verify tokens issued by Supabase Auth (Google sign-in) —
  // Supabase dashboard -> Settings -> API -> JWT Secret.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};
