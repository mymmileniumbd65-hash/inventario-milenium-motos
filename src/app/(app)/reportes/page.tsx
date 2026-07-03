import Header from '@/components/Header';
import { getGroups, getPartsWithMovements } from '@/db/queries';
import { computeParts, buildAlerts, buildComprasSugeridas, buildGroupBars, buildReportKpis } from '@/lib/inventory';

const PRIO_COLORS: Record<string, [string, string]> = { 'Crítica': ['#fde8e8', '#c0322f'], 'Alta': ['#fdeede', '#b3640f'] };

export default async function ReportesPage() {
  const [groups, partsInput] = await Promise.all([getGroups(), getPartsWithMovements()]);
  const parts = computeParts(partsInput);
  const alertCount = buildAlerts(parts).length;
  const compras = buildComprasSugeridas(parts);
  const groupBars = buildGroupBars(parts, groups);
  const reportKpis = buildReportKpis(parts, compras);

  const rotationRows = parts
    .filter((p) => p.stock > 0 && p.rotationDays !== null)
    .sort((a, b) => (b.rotationDays ?? 0) - (a.rotationDays ?? 0));

  return (
    <>
      <Header title="Reportes" subtitle="Decisiones de compra y rotación" alertCount={alertCount} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 20 }}>
          <ReportKpiCard label="Unidades a reponer" value={String(reportKpis.unitsToReplenish)} sub={`${reportKpis.comprasCount} SKUs bajo mínimo`} />
          <ReportKpiCard label="Rotación lenta" value={String(reportKpis.slowRotationCount)} sub="SKUs ≥ 60 días de cobertura" />
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef1f5', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Compras sugeridas</div>
              <div style={{ fontSize: 12, color: '#8a93a3', marginTop: 1 }}>SKUs bajo el stock mínimo, priorizados por urgencia.</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fbfbfc' }}>
                <th style={thStyle}>SKU / Repuesto</th>
                <th style={thStyle}>Grupo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actual</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Mínimo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Sugerido</th>
                <th style={thStyle}>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((r) => (
                <tr key={r.sku}>
                  <td style={tdStyle}><div style={{ fontWeight: 700 }}>{r.desc}</div><div style={{ fontSize: 11.5, color: '#8a93a3', fontFamily: 'IBM Plex Mono, monospace' }}>{r.sku}</div></td>
                  <td style={tdStyle}>{r.groupName}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{r.actual}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#8a93a3' }}>{r.min}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#1F56D6' }}>+{r.sugerido}</td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: PRIO_COLORS[r.prio][0], color: PRIO_COLORS[r.prio][1] }}>{r.prio}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compras.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8a93a3' }}>No hay SKUs bajo el mínimo.</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Rotación por SKU</div>
            <div style={{ fontSize: 12, color: '#8a93a3', marginBottom: 14 }}>Días de cobertura estimados — menor es mejor.</div>
            {rotationRows.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.sku}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, fontWeight: 600 }}>{p.rotationDays} d</span>
                </div>
              </div>
            ))}
            {rotationRows.length === 0 && <div style={{ color: '#8a93a3', fontSize: 13 }}>Sin datos de rotación todavía.</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Inventario por grupo</div>
            <div style={{ fontSize: 12, color: '#8a93a3', marginBottom: 14 }}>Participación de cada grupo en el stock total.</div>
            {groupBars.map((g) => (
              <div key={g.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                  <span style={{ fontSize: 12.5, color: '#5b6472' }}><b>{g.count}</b> u. · {g.pct}%</span>
                </div>
                <div style={{ height: 8, background: '#eef1f5', borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${g.pct}%`, background: '#1F56D6', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function ReportKpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 18px 16px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 7 }}>{sub}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a93a3', padding: '12px 20px', borderBottom: '1px solid #eef1f5' };
const tdStyle: React.CSSProperties = { padding: '13px 20px', borderBottom: '1px solid #f3f4f7' };
