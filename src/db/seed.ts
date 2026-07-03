import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { db } from './client';
import { groups, parts, movements } from './schema';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Credentials come from the environment, never hardcoded in source. If no
// password is supplied the seed generates a strong random one and prints it
// once — copy it somewhere safe, it is not stored anywhere else.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@mileniummotos.pe';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
const PASSWORD_WAS_GENERATED = !process.env.SEED_ADMIN_PASSWORD;

const CATALOG: { id: string; name: string; skus: { sku: string; desc: string; compat: string; min: number; initialStock: number }[] }[] = [
  { id: 'PAR', name: 'Parabrisas', skus: [
    { sku: 'PAR-15', desc: 'Parabrisas 15" ahumado', compat: 'Universal', min: 4, initialStock: 9 },
    { sku: 'PAR-17', desc: 'Parabrisas 17" cristal', compat: 'CB / FZ', min: 5, initialStock: 3 },
    { sku: 'PAR-19', desc: 'Parabrisas 19" ahumado', compat: 'Touring', min: 3, initialStock: 0 },
  ]},
  { id: 'LLA', name: 'Llantas', skus: [
    { sku: 'LLA-8017', desc: 'Llanta 80/100-17', compat: 'Delantera', min: 8, initialStock: 22 },
    { sku: 'LLA-9017', desc: 'Llanta 90/90-17', compat: 'Delantera', min: 8, initialStock: 14 },
    { sku: 'LLA-9018', desc: 'Llanta 90/90-18', compat: 'Trasera', min: 6, initialStock: 6 },
    { sku: 'LLA-1017', desc: 'Llanta 100/90-17', compat: 'Trasera', min: 8, initialStock: 40 },
  ]},
  { id: 'CAD', name: 'Cadenas', skus: [
    { sku: 'CAD-428', desc: 'Cadena 428H · 120L', compat: 'CB / YBR', min: 10, initialStock: 18 },
    { sku: 'CAD-520', desc: 'Cadena 520 · 112L', compat: 'FZ / Pulsar', min: 6, initialStock: 2 },
  ]},
  { id: 'PAS', name: 'Pastillas de freno', skus: [
    { sku: 'PAS-D190', desc: 'Pastilla delantera CB190', compat: 'CB190R', min: 8, initialStock: 12 },
    { sku: 'PAS-DFZ', desc: 'Pastilla delantera FZ25', compat: 'FZ25', min: 6, initialStock: 5 },
    { sku: 'PAS-TUNI', desc: 'Pastilla trasera universal', compat: 'Universal', min: 8, initialStock: 30 },
  ]},
  { id: 'FIL', name: 'Filtros', skus: [
    { sku: 'FIL-ACH', desc: 'Filtro de aceite Honda', compat: 'Honda', min: 10, initialStock: 16 },
    { sku: 'FIL-ACY', desc: 'Filtro de aceite Yamaha', compat: 'Yamaha', min: 8, initialStock: 9 },
    { sku: 'FIL-AIR', desc: 'Filtro de aire CB190', compat: 'CB190R', min: 5, initialStock: 1 },
  ]},
  { id: 'BUJ', name: 'Bujías', skus: [
    { sku: 'BUJ-CR7', desc: 'Bujía NGK CR7HSA', compat: '125–160cc', min: 10, initialStock: 44 },
    { sku: 'BUJ-CR8', desc: 'Bujía NGK CR8E', compat: '190–250cc', min: 8, initialStock: 12 },
  ]},
  { id: 'ESP', name: 'Espejos', skus: [
    { sku: 'ESP-UNI', desc: 'Espejo universal 10mm (par)', compat: 'Universal', min: 6, initialStock: 20 },
    { sku: 'ESP-190', desc: 'Espejo CB190 (par)', compat: 'CB190R', min: 4, initialStock: 0 },
  ]},
  { id: 'BAT', name: 'Baterías', skus: [
    { sku: 'BAT-5A', desc: 'Batería 12V 5Ah gel', compat: '125–160cc', min: 5, initialStock: 7 },
    { sku: 'BAT-7A', desc: 'Batería 12V 7Ah gel', compat: '190–250cc', min: 5, initialStock: 3 },
  ]},
  { id: 'FOC', name: 'Focos', skus: [
    { sku: 'FOC-H4', desc: 'Foco H4 12V halógeno', compat: 'Universal', min: 8, initialStock: 26 },
    { sku: 'FOC-LED', desc: 'Foco LED H4 6000K', compat: 'Universal', min: 6, initialStock: 10 },
  ]},
  { id: 'KIT', name: 'Kits de arrastre', skus: [
    { sku: 'KIT-190', desc: 'Kit arrastre CB190', compat: 'CB190R', min: 4, initialStock: 4 },
    { sku: 'KIT-FZ', desc: 'Kit arrastre FZ25', compat: 'FZ25', min: 3, initialStock: 2 },
  ]},
];

async function ensureAdminUser(): Promise<{ id: string; email: string }> {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Admin' },
  });
  if (created?.user) return { id: created.user.id, email: created.user.email! };

  // If the account already exists, look it up instead of failing the whole seed.
  if (createError?.message.includes('already been registered')) {
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === ADMIN_EMAIL);
    if (existing) return { id: existing.id, email: existing.email! };
  }
  throw createError ?? new Error('No se pudo crear ni encontrar el usuario admin.');
}

async function main() {
  console.log('Ensuring admin user exists in Supabase Auth...');
  const admin = await ensureAdminUser();

  console.log('Seeding groups and parts...');
  const now = new Date();
  // Wrapped in a transaction so a failure partway through (e.g. a duplicate
  // SKU on the Nth group) leaves no partially-seeded groups/parts behind —
  // either the whole catalog lands, or none of it does.
  await db.transaction(async (tx) => {
    for (const group of CATALOG) {
      const [insertedGroup] = await tx.insert(groups).values({ name: group.name }).returning();
      for (const s of group.skus) {
        const [insertedPart] = await tx.insert(parts).values({
          sku: s.sku, description: s.desc, compat: s.compat,
          groupId: insertedGroup.id, minStock: s.min,
        }).returning();

        if (s.initialStock > 0) {
          await tx.insert(movements).values({
            partId: insertedPart.id, type: 'ingreso', qty: s.initialStock,
            fromLocation: 'Proveedor', toLocation: 'Almacén',
            referenceCode: `OC-${insertedPart.sku}`,
            userId: admin.id, userEmail: admin.email,
            createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          });
        }
      }
    }
  });

  if (PASSWORD_WAS_GENERATED) {
    console.log(`Seed complete. Admin: ${ADMIN_EMAIL}`);
    console.log(`Generated admin password (shown once, store it now): ${ADMIN_PASSWORD}`);
    console.log('Note: if this admin already existed, its password was NOT changed — set SEED_ADMIN_PASSWORD or rotate it in Supabase.');
  } else {
    console.log(`Seed complete. Admin: ${ADMIN_EMAIL} (password from SEED_ADMIN_PASSWORD).`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
