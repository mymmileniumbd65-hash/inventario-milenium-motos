'use client';

import { useEffect } from 'react';
import Crown from '@/components/Crown';

// Root-level boundary: catches errors thrown by (app)/layout.tsx itself
// (e.g. a DB hiccup while loading the sidebar's alert count), which a
// same-segment error.tsx inside (app)/ can't catch by design.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Crown size={44} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1b2230' }}>Algo salió mal</div>
        <div style={{ fontSize: 14, color: '#5b6472', marginTop: 8, lineHeight: 1.5 }}>
          No pudimos cargar el sistema. Puede ser un problema temporal de conexión con la base de datos.
        </div>
        <button
          onClick={reset}
          style={{ marginTop: 22, padding: '11px 22px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
