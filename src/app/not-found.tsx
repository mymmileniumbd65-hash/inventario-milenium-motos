import Link from 'next/link';
import Crown from '@/components/Crown';

export default function NotFound() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Crown size={44} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, letterSpacing: '.12em', color: '#8a93a3', marginBottom: 6 }}>ERROR 404</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1b2230' }}>Página no encontrada</div>
        <div style={{ fontSize: 14, color: '#5b6472', marginTop: 8, lineHeight: 1.5 }}>
          La página que buscas no existe o fue movida.
        </div>
        <Link
          href="/"
          style={{ display: 'inline-block', marginTop: 22, padding: '11px 22px', background: '#1F56D6', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
