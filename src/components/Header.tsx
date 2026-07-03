import Link from 'next/link';

export default function Header({ title, subtitle, alertCount }: { title: string; subtitle: string; alertCount: number }) {
  return (
    <header style={{ height: 66, flex: 'none', background: '#fff', borderBottom: '1px solid #eef1f5', display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px' }}>
      <div style={{ flex: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#8a93a3', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href="/alertas"
          aria-label={alertCount > 0 ? `Alertas (${alertCount} activas)` : 'Alertas'}
          style={{
            position: 'relative', width: 40, height: 40, border: '1px solid #eef1f5', borderRadius: 10,
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b6472', textDecoration: 'none',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 10 a6 6 0 0 1 12 0 c0 4.2 1.4 6 2.2 6.8 H3.8 C4.6 16 6 14.2 6 10 Z" />
            <path d="M10.2 20.5 a1.9 1.9 0 0 0 3.6 0" />
          </svg>
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', background: '#E23B3B',
              color: '#fff', borderRadius: 9, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
            }}>
              {alertCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
