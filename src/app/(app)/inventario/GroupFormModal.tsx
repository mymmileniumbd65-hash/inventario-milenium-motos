'use client';

import { useActionState, useEffect } from 'react';
import { createGroup } from './actions';
import type { ActionResult } from './actions';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createGroup(formData);
}

export default function GroupFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);

  useEffect(() => {
    if (result && 'success' in result) onSuccess();
  }, [result, onSuccess]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Nuevo grupo</div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nombre</label>
        <input name="name" required style={{ width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 }} placeholder="Ej. Amortiguadores" />

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
