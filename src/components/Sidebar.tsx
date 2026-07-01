'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(app)/actions';

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
      <div style={{ padding: '22px 20px 18px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
          MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>MOTOS</span>
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9.5, letterSpacing: '.22em', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          REPUESTOS
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
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1F56D6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
          <form action={signOutAction}>
            <button type="submit" title="Salir" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 6 }}>
              Salir
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
