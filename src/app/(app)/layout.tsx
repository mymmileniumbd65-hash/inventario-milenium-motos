import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const partsInput = await getPartsWithMovements();
  const alerts = buildAlerts(computeParts(partsInput));

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', minHeight: 0 }}>
      <Sidebar alertCount={alerts.length} userEmail={user.email ?? 'Usuario'} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
