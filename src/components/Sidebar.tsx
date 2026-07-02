'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Crown from '@/components/Crown';
import { signOutAction } from '@/app/(app)/actions';

const iconProps = {
  width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

const ICONS: Record<string, React.ReactNode> = {
  '/': (
    <svg {...iconProps}><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></svg>
  ),
  '/inventario': (
    <svg {...iconProps}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><line x1="7" y1="10.5" x2="17" y2="10.5" /></svg>
  ),
  '/alertas': (
    <svg {...iconProps}><path d="M12 4 L21 19 L3 19 Z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" /></svg>
  ),
  '/movimientos': (
    <svg {...iconProps}><path d="M4 9 H20 M17 6 L20 9 L17 12" /><path d="M20 15 H4 M7 12 L4 15 L7 18" /></svg>
  ),
  '/reportes': (
    <svg {...iconProps}><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="15" /></svg>
  ),
};

const NAV_ITEMS = [
  { href: '/', label: 'Panel general' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/alertas', label: 'Alertas' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/reportes', label: 'Reportes' },
];

export default function Sidebar({ alertCount, userEmail }: { alertCount: number; userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside style={{ width: 248, flex: 'none', display: 'flex', flexDirection: 'column', background: '#1b2230' }}>
      <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Crown size={30} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
            MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>MOTOS</span>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9.5, letterSpacing: '.22em', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            REPUESTOS
          </div>
        </div>
      </div>
      <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px',
                borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
                background: active ? 'rgba(31,86,214,0.24)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.64)',
                boxShadow: active ? 'inset 3px 0 0 #1F56D6' : 'none',
              }}
            >
              <span style={{ flex: 'none', display: 'flex', opacity: active ? 1 : 0.85 }}>{ICONS[item.href]}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.href === '/alertas' && alertCount > 0 && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 5px', borderRadius: 9, background: '#E23B3B',
                  color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1F56D6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>Administrador</div>
          </div>
          <form action={signOutAction} style={{ flex: 'none', display: 'flex' }}>
            <button type="submit" title="Salir" aria-label="Salir" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 6, display: 'flex' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4 H7 a2 2 0 0 0-2 2 v12 a2 2 0 0 0 2 2 h8" />
                <path d="M11 12 H21 M17.5 8.5 L21 12 L17.5 15.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
