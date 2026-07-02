'use client';

import { useActionState, useState } from 'react';
import { authenticate } from './actions';

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showResetHint, setShowResetHint] = useState(false);

  return (
    <form action={formAction} style={{ width: 380, maxWidth: '100%' }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>Iniciar sesión</div>
      <div style={{ fontSize: 14, color: '#5b6472', marginTop: 6 }}>Ingresa con tu cuenta del sistema</div>

      <div style={{ marginTop: 28 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Usuario</label>
        <input
          name="email" type="email" required placeholder="admin@mileniummotos.pe"
          style={inputStyle}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Contraseña</label>
        <input
          name="password" type="password" required placeholder="••••••••"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#5b6472', cursor: 'pointer' }}>
          <input name="remember" type="checkbox" defaultChecked style={{ width: 15, height: 15, accentColor: '#1F56D6' }} />
          Recordarme
        </label>
        <button
          type="button" onClick={() => setShowResetHint((v) => !v)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: '#1F56D6', cursor: 'pointer' }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      {showResetHint && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#5b6472', background: '#f1f3f6', padding: '9px 11px', borderRadius: 9 }}>
          Solicita el restablecimiento al administrador del sistema.
        </div>
      )}

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
