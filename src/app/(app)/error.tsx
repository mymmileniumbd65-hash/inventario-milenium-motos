'use client';

import { useEffect } from 'react';
import Crown from '@/components/Crown';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Crown size={40} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#1b2230' }}>Algo salió mal</div>
        <div style={{ fontSize: 14, color: '#5b6472', marginTop: 8, lineHeight: 1.5 }}>
          No pudimos cargar esta página. Puede ser un problema temporal de conexión con la base de datos.
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
