'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MovementRow } from '@/db/queries';
import { reverseMovement } from '../inventario/movementActions';

const TYPE_COLORS: Record<string, [string, string, string]> = {
  ingreso: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  salida: ['#fbf3d6', '#8a6a12', '#d4a813'],
  ajuste: ['#fde8e8', '#c0322f', '#E23B3B'],
};

const FILTERS = ['Todos', 'ingreso', 'salida', 'ajuste'] as const;
const FILTER_LABELS: Record<string, string> = { Todos: 'Todos', ingreso: 'Ingreso', salida: 'Salida', ajuste: 'Ajuste' };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MovimientosView({
  movements, year, month, currentYear,
}: {
  movements: MovementRow[]; year: number; month: number; currentYear: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todos');
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voidedIds = useMemo(
    () => new Set(movements.map((m) => m.reversesMovementId).filter((x): x is string => x !== null)),
    [movements]
  );

  const filtered = useMemo(
    () => (filter === 'Todos' ? movements : movements.filter((m) => m.type === filter)),
    [movements, filter]
  );

  function goToDate(newYear: number, newMonth: number) {
    router.push(`/movimientos?year=${newYear}&month=${newMonth}`);
  }

  async function handleReverse(m: MovementRow) {
    if (!confirm(`¿Anular este movimiento (${m.qty >= 0 ? '+' : '−'}${Math.abs(m.qty)} u. · ${m.partDescription})? Se registrará un movimiento inverso; el original queda en el historial.`)) return;
    setError(null);
    setReversingId(m.id);
    const result = await reverseMovement(m.id);
    setReversingId(null);
    if ('error' in result) { setError(result.error); return; }
    router.refresh();
  }

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', padding: '26px 28px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <select
            value={month}
            onChange={(e) => goToDate(year, Number(e.target.value))}
            style={selectStyle}
            aria-label="Mes"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => goToDate(Number(e.target.value), month)}
            style={selectStyle}
            aria-label="Año"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              style={{
                padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#1F56D6' : '#fff', color: filter === f ? '#fff' : '#5b6472',
                border: filter === f ? '1px solid #1F56D6' : '1px solid #e3e6ec',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 28px 40px' }}>
        {error && (
          <div style={{ marginBottom: 14, fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {error}
          </div>
        )}
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '8px 24px 18px' }}>
          {filtered.map((m) => {
            const colors = TYPE_COLORS[m.type];
            const isVoided = voidedIds.has(m.id);
            const isReversal = m.reversesMovementId !== null;
            const canReverse = !isVoided && !isReversal;
            return (
              <div key={m.id} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f3f4f7', opacity: isVoided ? 0.55 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: colors[0], color: colors[1] }}>
                      {FILTER_LABELS[m.type]}
                    </span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, textDecoration: isVoided ? 'line-through' : 'none' }}>
                      <span style={{ color: m.qty >= 0 ? '#1b7a47' : '#c0322f' }}>{m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u.</span> {m.partDescription}
                    </span>
                    {isVoided && <span style={{ fontSize: 11, fontWeight: 700, color: '#c0322f' }}>ANULADO</span>}
                    {isReversal && <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6a12' }}>ANULACIÓN</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                    {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                  </div>
                  {m.comment && (
                    <div style={{ fontSize: 12.5, color: '#8a93a3', fontStyle: 'italic', marginTop: 4 }}>{m.comment}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flex: 'none', fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>{new Date(m.createdAt).toLocaleString('es-PE')}</div>
                  <div style={{ color: '#8a93a3', marginTop: 2 }}>por {m.userEmail}</div>
                </div>
                {canReverse ? (
                  <button
                    onClick={() => handleReverse(m)} disabled={reversingId === m.id}
                    style={{ flex: 'none', padding: '7px 13px', borderRadius: 8, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 12, color: '#5b6472', cursor: reversingId === m.id ? 'default' : 'pointer' }}
                  >
                    {reversingId === m.id ? '…' : 'Anular'}
                  </button>
                ) : (
                  <span style={{ flex: 'none', width: 66 }} />
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin movimientos para este filtro.</div>}
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5, background: '#fff', cursor: 'pointer' };
