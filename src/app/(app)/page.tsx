import Header from '@/components/Header';
import KpiCard from '@/components/KpiCard';
import { getGroups, getPartsWithMovements, getRecentMovements } from '@/db/queries';
import { computeParts, buildAlerts, buildGroupBars, buildDashboardKpis } from '@/lib/inventory';

export default async function DashboardPage() {
  const [groups, partsInput, recentMovements] = await Promise.all([
    getGroups(), getPartsWithMovements(), getRecentMovements(5),
  ]);
  const parts = computeParts(partsInput);
  const alerts = buildAlerts(parts);
  const groupBars = buildGroupBars(parts, groups);
  // eslint-disable-next-line react-hooks/purity -- async Server Component computing a per-request time window, not a client re-render concern.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const movementsLast7Days = (await getRecentMovements(1000)).filter((m) => m.createdAt >= sevenDaysAgo).length;
  const kpis = buildDashboardKpis(parts, groups.length, alerts, movementsLast7Days);

  const slowest = parts
    .filter((p) => p.stock > 0 && p.rotationDays !== null)
    .sort((a, b) => (b.rotationDays ?? 0) - (a.rotationDays ?? 0))
    .slice(0, 5);

  return (
    <>
      <Header title="Panel general" subtitle="Resumen de stock, alertas y movimientos de repuestos" alertCount={alerts.length} />
      <main style={{ flex: 1, overflow: 'auto', padding: '26px 28px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          <KpiCard label="Unidades en stock" value={String(kpis.totalUnits)} sub={`${kpis.totalSkus} SKUs · ${kpis.inStockSkus} con stock`} dotColor="#1F56D6" />
          <KpiCard label="Grupos" value={String(kpis.totalGroups)} sub={`${kpis.totalSkus} SKUs clasificados`} dotColor="#1b7a47" />
          <KpiCard label="Alertas activas" value={String(kpis.activeAlerts)} sub={`${kpis.criticalAlerts} críticas · ${kpis.highAlerts} altas`} dotColor="#E23B3B" />
          <KpiCard label="Rotación promedio" value={kpis.avgRotationDays !== null ? `${kpis.avgRotationDays} d` : '—'} sub="meta ≤ 30 días" dotColor="#e8870f" />
          <KpiCard label="Movimientos (7d)" value={String(kpis.movementsLast7Days)} sub="ingresos, salidas y ajustes" dotColor="#5b6472" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Alertas activas</div>
              {alerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid #f3f4f7' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.tipo} · {a.desc}</div>
                    <div style={{ fontSize: 12.5, color: '#5b6472', marginTop: 3 }}>{a.detail}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3', padding: '12px 0' }}>Sin alertas activas.</div>}
            </div>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Movimientos recientes</div>
              {recentMovements.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderTop: '1px solid #f3f4f7' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      {m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u. {m.partDescription}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a93a3', marginTop: 2 }}>{m.fromLocation} → {m.toLocation} · {m.referenceCode}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: '#8a93a3' }}>
                    <div>{m.createdAt.toLocaleDateString('es-PE')}</div>
                    <div>{m.userEmail}</div>
                  </div>
                </div>
              ))}
              {recentMovements.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3', padding: '12px 0' }}>Sin movimientos todavía.</div>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Rotación más lenta</div>
              {slowest.map((p) => (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.description}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, fontWeight: 600 }}>{p.rotationDays} d</span>
                  </div>
                </div>
              ))}
              {slowest.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3' }}>Sin datos de rotación todavía.</div>}
              <div style={{ fontSize: 11.5, color: '#8a93a3', marginTop: 2 }}>Días de cobertura estimados a partir de las salidas de los últimos 90 días.</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Stock por grupo</div>
              {groupBars.map((g) => (
                <div key={g.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12.5, color: '#5b6472' }}><b>{g.count}</b> u. · {g.skuCount} SKU</span>
                  </div>
                  <div style={{ height: 8, background: '#eef1f5', borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.pct}%`, background: '#1F56D6', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
              {groupBars.length === 0 && <div style={{ fontSize: 13, color: '#8a93a3' }}>Sin grupos registrados todavía.</div>}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
