'use client';

import { useActionState } from 'react';
import { authenticate } from './actions';

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: 'Manrope, system-ui, sans-serif', background: '#f6f7f9' }}>
      <div style={{ width: '44%', minWidth: 380, background: '#1b2230', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 56px' }}>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>MILENIUM <span style={{ fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>MOTOS</span></div>
        </div>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '.16em', color: 'rgba(255,255,255,.45)', marginBottom: 16 }}>
            INVENTARIO DE REPUESTOS
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.12, maxWidth: 400 }}>
            Cada repuesto, clasificado y bajo control.
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.62)', marginTop: 16, maxWidth: 370, lineHeight: 1.5 }}>
            Control de stock por grupo y SKU, alertas automáticas de reposición, trazabilidad de movimientos y reportes para tus compras.
          </div>
        </div>
        <div />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <form action={formAction} style={{ width: 380, maxWidth: '100%' }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Iniciar sesión</div>
          <div style={{ fontSize: 14, color: '#5b6472', marginTop: 6 }}>Ingresa con tu cuenta del sistema</div>

          <div style={{ marginTop: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Usuario</label>
            <input
              name="email" type="email" required placeholder="admin@mileniummotos.pe"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #e3e6ec', borderRadius: 11, fontSize: 14.5, outline: 'none' }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Contraseña</label>
            <input
              name="password" type="password" required placeholder="••••••••"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #e3e6ec', borderRadius: 11, fontSize: 14.5, outline: 'none' }}
            />
          </div>

          {errorMessage && (
            <div style={{ marginTop: 14, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{ width: '100%', marginTop: 24, padding: 14, background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            {isPending ? 'Ingresando…' : 'Ingresar al sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
