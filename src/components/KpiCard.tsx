export default function KpiCard({ label, value, sub, dotColor }: { label: string; value: string; sub: string; dotColor?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {dotColor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />}
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3' }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5b6472', marginTop: 7 }}>{sub}</div>
    </div>
  );
}
