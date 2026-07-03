'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { computeStock, computeRotationDays } from '@/lib/inventory';
import type { MovementRow } from '@/db/queries';
import { deletePart } from './partActions';
import { reverseMovement } from './movementActions';

export default function PartDrawer({
  part, onClose, onEdit, onDeleted, onChanged,
}: {
  part: PartComputed;
  onClose: () => void;
  onEdit: (part: PartComputed) => void;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<MovementRow[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/parts/${part.id}/movements`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: MovementRow[]) => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) { setHistory([]); setHistoryError(true); } });
    return () => { cancelled = true; };
  }, [part.id, reloadKey]);

  // Ids of movements that have been voided by a later reversal (present in this list).
  const voidedIds = useMemo(
    () => new Set((history ?? []).map((h) => h.reversesMovementId).filter((x): x is string => x !== null)),
    [history]
  );

  // Live stock/rotation recomputed from the loaded history, so the stat boxes stay
  // correct after a reversal without reopening the drawer. Falls back to the prop.
  const liveStock = history ? computeStock(history.map((h) => ({ id: h.id, type: h.type, qty: h.qty, createdAt: new Date(h.createdAt), reversesMovementId: h.reversesMovementId }))) : part.stock;
  const liveRotation = history ? computeRotationDays(history.map((h) => ({ id: h.id, type: h.type, qty: h.qty, createdAt: new Date(h.createdAt), reversesMovementId: h.reversesMovementId }))) : part.rotationDays;

  async function handleDelete() {
    if (!confirm(`¿Eliminar el repuesto ${part.sku}? Esta acción no se puede deshacer.`)) return;
    setDeleteError(null);
    setDeleting(true);
    const result = await deletePart(part.id);
    setDeleting(false);
    if ('error' in result) { setDeleteError(result.error); return; }
    onDeleted();
  }

  async function handleReverse(h: MovementRow) {
    if (!confirm(`¿Anular este movimiento (${h.qty >= 0 ? '+' : '−'}${Math.abs(h.qty)} u.)? Se registrará un movimiento inverso; el original queda en el historial.`)) return;
    setActionError(null);
    setReversingId(h.id);
    const result = await reverseMovement(h.id);
    setReversingId(null);
    if ('error' in result) { setActionError(result.error); return; }
    setReloadKey((k) => k + 1); // re-fetch this drawer's history
    onChanged();                // refresh the table / KPIs behind the drawer
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 620, maxWidth: '94vw', background: '#fff', zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #eef1f5' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8a93a3' }}>{part.groupName} › {part.sku}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{part.description}</div>
          <button onClick={onClose} style={{ position: 'absolute', top: 22, right: 26, width: 36, height: 36, border: '1px solid #eef1f5', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '16px 26px 0', display: 'flex', gap: 10 }}>
          <button onClick={() => onEdit(part)} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Editar
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #f3c6c6', background: '#fff', color: '#c0322f', fontWeight: 700, fontSize: 13, cursor: deleting ? 'default' : 'pointer' }}>
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
        {deleteError && (
          <div style={{ margin: '12px 26px 0', fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {deleteError}
          </div>
        )}
        <div style={{ padding: '16px 26px 8px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <StatBox label="Stock" value={String(liveStock)} />
          <StatBox label="Mínimo" value={String(part.minStock)} />
          <StatBox label="Rotación" value={liveRotation !== null ? `${liveRotation} d` : '—'} />
          <StatBox label="Compat." value={part.compat} />
        </div>
        <div style={{ padding: '14px 26px 6px', fontSize: 13.5, fontWeight: 800 }}>Movimientos de este SKU</div>
        {actionError && (
          <div style={{ margin: '0 26px 8px', fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {actionError}
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 26px 20px' }}>
          {history === null && <div style={{ color: '#8a93a3', fontSize: 13 }}>Cargando…</div>}
          {historyError && <div style={{ color: '#c0322f', fontSize: 13 }}>No se pudo cargar el historial. Refresca la página o vuelve a iniciar sesión.</div>}
          {history?.length === 0 && !historyError && <div style={{ color: '#8a93a3', fontSize: 13 }}>Sin movimientos registrados todavía.</div>}
          {history?.map((h) => {
            const isVoided = voidedIds.has(h.id);
            const isReversal = h.reversesMovementId !== null;
            const canReverse = !isVoided && !isReversal;
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid #f3f4f7', opacity: isVoided ? 0.55 : 1 }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: h.qty >= 0 ? '#1b7a47' : '#c0322f', width: 60, textDecoration: isVoided ? 'line-through' : 'none' }}>
                  {h.qty >= 0 ? '+' : '−'}{Math.abs(h.qty)}
                </span>
                <div style={{ flex: 1, fontSize: 12.5, color: '#5b6472' }}>
                  {h.fromLocation} → {h.toLocation} · {h.referenceCode}
                  {isVoided && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#c0322f' }}>ANULADO</span>}
                  {isReversal && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8a6a12' }}>ANULACIÓN</span>}
                  {h.comment && (
                    <div style={{ fontSize: 12, color: '#8a93a3', fontStyle: 'italic', marginTop: 3 }}>{h.comment}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.5, width: 120 }}>
                  <div style={{ fontWeight: 700 }}>{new Date(h.createdAt).toLocaleDateString('es-PE')}</div>
                  <div style={{ color: '#8a93a3' }}>por {h.userEmail}</div>
                </div>
                {canReverse ? (
                  <button
                    onClick={() => handleReverse(h)} disabled={reversingId === h.id}
                    style={{ flex: 'none', padding: '6px 11px', borderRadius: 8, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 12, color: '#5b6472', cursor: reversingId === h.id ? 'default' : 'pointer' }}
                  >
                    {reversingId === h.id ? '…' : 'Anular'}
                  </button>
                ) : (
                  <span style={{ flex: 'none', width: 62 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f6f7f9', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ fontSize: 11, color: '#8a93a3', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}
