'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { groups, parts } from '@/db/schema';

export type ActionResult = { error: string } | { success: true };

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };

  const existing = await db.select().from(groups).where(eq(groups.name, name)).limit(1);
  if (existing.length > 0) return { error: 'Ya existe un grupo con ese nombre.' };

  await db.insert(groups).values({ name });
  revalidatePath('/inventario');
  revalidatePath('/');
  return { success: true };
}

export async function updateGroup(id: string, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string | null)?.trim();
  if (!name) return { error: 'El nombre del grupo es obligatorio.' };

  const existing = await db.select().from(groups).where(eq(groups.name, name)).limit(1);
  if (existing.length > 0 && existing[0].id !== id) return { error: 'Ya existe un grupo con ese nombre.' };

  await db.update(groups).set({ name }).where(eq(groups.id, id));
  revalidatePath('/inventario');
  return { success: true };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const partsInGroup = await db.select().from(parts).where(eq(parts.groupId, id)).limit(1);
  if (partsInGroup.length > 0) {
    return { error: 'No se puede eliminar un grupo que tiene repuestos asociados.' };
  }
  await db.delete(groups).where(eq(groups.id, id));
  revalidatePath('/inventario');
  return { success: true };
}
