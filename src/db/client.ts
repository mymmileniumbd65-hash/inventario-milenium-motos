import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { SUPABASE_CA_CERT } from './supabase-ca';

// Verify the server certificate against Supabase's pinned root CA instead of
// disabling verification. Supabase's pooler presents a self-signed chain, so we
// supply their root explicitly rather than trusting Node's default CA store.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA_CERT, rejectUnauthorized: true },
});

export const db = drizzle(pool, { schema });
