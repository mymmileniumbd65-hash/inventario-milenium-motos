'use client';

import { useActionState } from 'react';
import { authenticate } from './actions';

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} style={{ width: 380, maxWidth: '100%' }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>Iniciar sesión</div>
      <div style={{ fontSize: 14, color: '#5b6472', marginTop: 6 }}>Ingresa con tu cuenta del sistema</div>

      <div style={{ marginTop: 28 }}>
        <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Usuario</label>
        <input
          id="email" name="email" type="email" required placeholder="admin@mileniummotos.pe"
          style={inputStyle}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Contraseña</label>
        <input
          id="password" name="password" type="password" required placeholder="••••••••"
          style={inputStyle}
        />
      </div>

      {errorMessage && (
        <div style={{ marginTop: 14, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
          {errorMessage}
        </div>
      )}

      <button
        type="submit" disabled={isPending}
        style={{ width: '100%', marginTop: 20, padding: 14, background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: isPending ? 'default' : 'pointer' }}
      >
        {isPending ? 'Ingresando…' : 'Ingresar al sistema'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#8a93a3' }}>
        Acceso solo para personal autorizado.
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', border: '1px solid #e3e6ec', borderRadius: 11, fontSize: 14.5, outline: 'none',
};
