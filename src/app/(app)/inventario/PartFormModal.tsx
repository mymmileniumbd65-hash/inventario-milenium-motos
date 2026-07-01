'use client';

import { useActionState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createPart, updatePart } from './partActions';
import type { ActionResult } from './actions';

export default function PartFormModal({
  groups, part, onClose, onSuccess,
}: {
  groups: { id: string; name: string }[];
  part: PartComputed | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
    return part ? updatePart(part.id, formData) : createPart(formData);
  }
  const [result, formAction, isPending] = useActionState(action, null);

  if (result && 'success' in result) {
    onSuccess();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form action={formAction} style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440 }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>{part ? 'Editar repuesto' : 'Nuevo repuesto'}</div>

        <Field label="SKU">
          <input name="sku" required defaultValue={part?.sku} style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <input name="description" required defaultValue={part?.description} style={inputStyle} />
        </Field>
        <Field label="Compatibilidad">
          <input name="compat" defaultValue={part?.compat} style={inputStyle} />
        </Field>
        <Field label="Grupo">
          <select name="groupId" required defaultValue={part?.groupId} style={inputStyle}>
            <option value="" disabled>Selecciona un grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Mínimo">
          <input name="minStock" type="number" min={0} required defaultValue={part?.minStock ?? 0} style={inputStyle} />
        </Field>

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Guardar'}
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
