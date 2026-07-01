'use client';

import { useActionState, useEffect } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createMovement } from './movementActions';
import type { ActionResult } from './actions';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createMovement(formData);
}

export default function MovementFormModal({ parts, onClose, onSuccess }: { parts: PartComputed[]; onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);

  useEffect(() => {
    if (result && 'success' in result) onSuccess();
  }, [result, onSuccess]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Registrar movimiento</div>

        <Field label="Repuesto">
          <select name="partId" required style={inputStyle}>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.description}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select name="type" required style={inputStyle} defaultValue="ingreso">
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </Field>
        <Field label="Cantidad">
          <input name="qty" type="number" required style={inputStyle} placeholder="Ej. 10 (usa negativo solo para ajustes)" />
        </Field>
        <Field label="Origen">
          <input name="fromLocation" required style={inputStyle} placeholder="Proveedor Michelin" />
        </Field>
        <Field label="Destino">
          <input name="toLocation" required style={inputStyle} placeholder="Almacén" />
        </Field>
        <Field label="Código de referencia">
          <input name="referenceCode" required style={inputStyle} placeholder="OC-1234" />
        </Field>

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 };
