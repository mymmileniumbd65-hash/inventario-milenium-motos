'use client';

import { useActionState, useEffect } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createPart, updatePart } from './partActions';
import type { ActionResult } from './actions';
import Modal from './Modal';
import Field, { inputStyle } from './FormField';

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

  useEffect(() => {
    if (result && 'success' in result) onSuccess();
  }, [result, onSuccess]);

  return (
    <Modal onClose={onClose} disableClose={isPending}>
      <form action={formAction}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>{part ? 'Editar repuesto' : 'Nuevo repuesto'}</div>

        <Field label="SKU">
          {(id) => <input id={id} name="sku" required maxLength={60} defaultValue={part?.sku} style={inputStyle} />}
        </Field>
        <Field label="Descripción">
          {(id) => <input id={id} name="description" required maxLength={200} defaultValue={part?.description} style={inputStyle} />}
        </Field>
        <Field label="Compatibilidad">
          {(id) => <input id={id} name="compat" maxLength={200} defaultValue={part?.compat} style={inputStyle} />}
        </Field>
        <Field label="Grupo">
          {(id) => (
            <select id={id} name="groupId" required defaultValue={part?.groupId} style={inputStyle}>
              <option value="" disabled>Selecciona un grupo</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Mínimo">
          {(id) => <input id={id} name="minStock" type="number" min={0} max={1_000_000} required defaultValue={part?.minStock ?? 0} style={inputStyle} />}
        </Field>

        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: isPending ? 'default' : 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
