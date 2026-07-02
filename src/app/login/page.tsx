import Crown from '@/components/Crown';
import { getInventorySummary } from '@/db/queries';
import LoginForm from './LoginForm';

// Cache the (public) login page and refresh the headline stats at most hourly,
// so anonymous visits don't hit the DB on every request but the numbers don't
// go stale for long either.
export const revalidate = 3600;

export default async function LoginPage() {
  let summary: { groups: number; skus: number; units: number } | null = null;
  try {
    summary = await getInventorySummary();
  } catch {
    summary = null; // never block login on a stats read
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: 'Manrope, system-ui, sans-serif', background: '#f6f7f9' }}>
      <div style={{ position: 'relative', overflow: 'hidden', width: '44%', minWidth: 380, background: '#1b2230', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 56px' }}>
        {/* decorative glow */}
        <div style={{ position: 'absolute', top: -160, right: -140, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle at center, rgba(31,86,214,0.45), rgba(31,86,214,0) 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Crown size={34} />
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.01em' }}>
            MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>MOTOS</span>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '.16em', color: 'rgba(255,255,255,.45)', marginBottom: 16 }}>
            INVENTARIO DE REPUESTOS
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.12, maxWidth: 400 }}>
            Cada repuesto, clasificado y bajo control.
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.62)', marginTop: 16, maxWidth: 370, lineHeight: 1.5 }}>
            Control de stock por grupo y SKU, alertas automáticas de reposición, trazabilidad de movimientos y reportes para tus compras.
          </div>
        </div>

        <div style={{ position: 'relative', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, letterSpacing: '.04em', color: 'rgba(255,255,255,.5)' }}>
          {summary
            ? `${summary.groups} grupos · ${summary.skus} SKUs · ${summary.units} unidades`
            : ' '}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <LoginForm />
      </div>
    </div>
  );
}
