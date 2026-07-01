'use client';

import { useMemo, useState } from 'react';
import type { MovementRow } from '@/db/queries';

const TYPE_COLORS: Record<string, [string, string, string]> = {
  ingreso: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  salida: ['#fbf3d6', '#8a6a12', '#d4a813'],
  ajuste: ['#fde8e8', '#c0322f', '#E23B3B'],
};

const FILTERS = ['Todos', 'ingreso', 'salida', 'ajuste'] as const;
const FILTER_LABELS: Record<string, string> = { Todos: 'Todos', ingreso: 'Ingreso', salida: 'Salida', ajuste: 'Ajuste' };

export default function MovimientosView({ movements }: { movements: MovementRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todos');

  const filtered = useMemo(
    () => (filter === 'Todos' ? movements : movements.filter((m) => m.type === filter)),
    [movements, filter]
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
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
      <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '8px 24px 18px' }}>
        {filtered.map((m) => {
          const colors = TYPE_COLORS[m.type];
          return (
            <div key={m.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #f3f4f7' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: colors[0], color: colors[1] }}>
                    {FILTER_LABELS[m.type]}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>
                    <span style={{ color: m.qty >= 0 ? '#1b7a47' : '#c0322f' }}>{m.qty >= 0 ? '+' : '−'}{Math.abs(m.qty)} u.</span> {m.partDescription}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#5b6472', marginTop: 6 }}>
                  {m.fromLocation} → <b style={{ color: '#1b2230' }}>{m.toLocation}</b>{' '}
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, background: '#f1f3f6', padding: '2px 8px', borderRadius: 6 }}>{m.referenceCode}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none', fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>{new Date(m.createdAt).toLocaleString('es-PE')}</div>
                <div style={{ color: '#8a93a3', marginTop: 2 }}>por {m.userEmail}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin movimientos para este filtro.</div>}
      </div>
    </div>
  );
}
