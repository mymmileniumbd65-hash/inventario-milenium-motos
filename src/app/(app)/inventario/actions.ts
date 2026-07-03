'use server';

import { eq, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { groups, parts } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';

export type ActionResult = { error: string } | { success: true };

const NAME_MAX_LENGTH = 200;

function revalidateAll() {
  revalidatePath('/inventario');
  revalidatePath('/movimientos');
  revalidatePath('/reportes');
  revalidatePath('/alertas');
  revalidatePath('/');
}

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };
  if (name.length > NAME_MAX_LENGTH) return { error: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.` };

  const existing = await db.select().from(groups).where(ilike(groups.name, name)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un grupo con ese nombre.' };

  try {
    await db.insert(groups).values({ name });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un grupo con ese nombre.' };
    throw err;
  }
  revalidateAll();
  return { success: true };
}

export async function updateGroup(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };
  if (name.length > NAME_MAX_LENGTH) return { error: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.` };

  const existing = await db.select().from(groups).where(ilike(groups.name, name)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un grupo con ese nombre.' };

  try {
    await db.update(groups).set({ name }).where(eq(groups.id, id));
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Ya existe un grupo con ese nombre.' };
    throw err;
  }
  revalidateAll();
  return { success: true };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Debes iniciar sesión.' };

  const partsInGroup = await db.select().from(parts).where(eq(parts.groupId, id)).limit(1);
  if (partsInGroup.length > 0) {
    return { error: 'No se puede eliminar un grupo que tiene repuestos asociados.' };
  }
  await db.delete(groups).where(eq(groups.id, id));
  revalidateAll();
  return { success: true };
}
