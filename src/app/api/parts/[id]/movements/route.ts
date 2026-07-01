import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMovementsByPartId } from '@/db/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const history = await getMovementsByPartId(id);
  return NextResponse.json(history);
}
