'use client';

import { useActionState, useEffect, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { createMovement } from './movementActions';
import type { ActionResult } from './actions';
import PartCombobox from './PartCombobox';
import Modal from './Modal';
import Field, { inputStyle } from './FormField';

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return createMovement(formData);
}

const ORIGEN_PLACEHOLDER: Record<string, string> = {
  ingreso: 'Proveedor',
  salida: 'Cliente',
  ajuste: 'Proveedor o Cliente',
};

export default function MovementFormModal({ parts, onClose, onSuccess }: { parts: PartComputed[]; onClose: () => void; onSuccess: () => void }) {
  const [result, formAction, isPending] = useActionState(action, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [type, setType] = useState('ingreso');

  useEffect(() => {
    if (result && 'success' in result) onSuccess();
  }, [result, onSuccess]);

  return (
    <Modal onClose={onClose} disableClose={isPending}>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!new FormData(e.currentTarget).get('partId')) {
            e.preventDefault();
            setLocalError('Selecciona un repuesto de la lista');
          } else {
            setLocalError(null);
          }
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 18 }}>Registrar movimiento</div>

        <Field label="Repuesto">
          {() => <PartCombobox parts={parts} name="partId" />}
        </Field>
        <Field label="Tipo">
          {(id) => (
            <select id={id} name="type" required style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ingreso">Ingreso</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          )}
        </Field>
        <Field label="Cantidad">
          {(id) => <input id={id} name="qty" type="number" required max={1_000_000} style={inputStyle} placeholder="Ej. 10 (usa negativo solo para ajustes)" />}
        </Field>
        <Field label="Origen">
          {(id) => <input id={id} name="fromLocation" required maxLength={200} style={inputStyle} placeholder={ORIGEN_PLACEHOLDER[type]} />}
        </Field>
        <Field label="Código de referencia">
          {(id) => <input id={id} name="referenceCode" required maxLength={60} style={inputStyle} placeholder="OC-1234" />}
        </Field>
        <Field label="Comentarios (opcional)">
          {(id) => <textarea id={id} name="comment" maxLength={2000} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Detalles adicionales sobre este movimiento…" />}
        </Field>

        {localError && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {localError}
          </div>
        )}
        {result && 'error' in result && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {result.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', cursor: isPending ? 'default' : 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={isPending} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#1F56D6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isPending ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
