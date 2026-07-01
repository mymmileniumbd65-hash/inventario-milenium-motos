import Header from '@/components/Header';
import { getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts } from '@/lib/inventory';

const SEV_COLORS: Record<string, [string, string, string]> = {
  'Crítica': ['#fde8e8', '#c0322f', '#E23B3B'],
  'Alta': ['#fdeede', '#b3640f', '#e8870f'],
  'Media': ['#e8eefc', '#1846B3', '#1F56D6'],
};

export default async function AlertasPage() {
  const partsInput = await getPartsWithMovements();
  const parts = computeParts(partsInput);
  const alerts = buildAlerts(parts);
  const critCount = alerts.filter((a) => a.sev === 'Crítica').length;
  const altaCount = alerts.filter((a) => a.sev === 'Alta').length;
  const mediaCount = alerts.filter((a) => a.sev === 'Media').length;

  return (
    <>
      <Header title="Alertas automáticas" subtitle="Reposición, rotación y exceso de stock" alertCount={alerts.length} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          <SummaryCard label="Críticas" value={critCount} sub="Agotado — reposición urgente" color="#E23B3B" textColor="#c0322f" />
          <SummaryCard label="Altas" value={altaCount} sub="Por debajo del mínimo" color="#e8870f" textColor="#b3640f" />
          <SummaryCard label="Medias" value={mediaCount} sub="Rotación lenta y exceso" color="#1F56D6" textColor="#1846B3" />
        </div>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef1f5', fontSize: 15, fontWeight: 800 }}>
            Todas las alertas <span style={{ fontWeight: 500, color: '#8a93a3' }}>· generadas automáticamente</span>
          </div>
          {alerts.map((a, i) => {
            const colors = SEV_COLORS[a.sev];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', borderBottom: '1px solid #f3f4f7' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: colors[2] }} />
                <div style={{ width: 150, flex: 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{a.tipo}</div>
                  <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginTop: 5, background: colors[0], color: colors[1] }}>{a.sev}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.desc} <span style={{ color: '#8a93a3', fontWeight: 500, fontSize: 12 }}>· {a.groupName}</span></div>
                  <div style={{ fontSize: 12.5, color: '#5b6472', marginTop: 2 }}>{a.detail}</div>
                </div>
                <div style={{ width: 210, flex: 'none', fontSize: 12.5, color: '#5b6472' }}>
                  <span style={{ color: '#8a93a3' }}>Sugerido:</span> {a.accion}
                </div>
              </div>
            );
          })}
          {alerts.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>No hay alertas activas.</div>}
        </div>
      </main>
    </>
  );
}

function SummaryCard({ label, value, sub, color, textColor }: { label: string; value: number; sub: string; color: string; textColor: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: textColor }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
