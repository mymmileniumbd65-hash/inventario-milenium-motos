'use client';

import { useEffect, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import type { MovementRow } from '@/db/queries';

export default function PartDrawer({ part, onClose }: { part: PartComputed; onClose: () => void }) {
  const [history, setHistory] = useState<MovementRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/parts/${part.id}/movements`)
      .then((res) => res.json())
      .then((data: MovementRow[]) => { if (!cancelled) setHistory(data); });
    return () => { cancelled = true; };
  }, [part.id]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 620, maxWidth: '94vw', background: '#fff', zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #eef1f5' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8a93a3' }}>{part.groupName} › {part.sku}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{part.description}</div>
          <button onClick={onClose} style={{ position: 'absolute', top: 22, right: 26, width: 36, height: 36, border: '1px solid #eef1f5', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 26px 8px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <StatBox label="Stock" value={String(part.stock)} />
          <StatBox label="Mínimo" value={String(part.minStock)} />
          <StatBox label="Rotación" value={part.rotationDays !== null ? `${part.rotationDays} d` : '—'} />
          <StatBox label="Compat." value={part.compat} />
        </div>
        <div style={{ padding: '14px 26px 6px', fontSize: 13.5, fontWeight: 800 }}>Movimientos de este SKU</div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 26px 20px' }}>
          {history === null && <div style={{ color: '#8a93a3', fontSize: 13 }}>Cargando…</div>}
          {history?.length === 0 && <div style={{ color: '#8a93a3', fontSize: 13 }}>Sin movimientos registrados todavía.</div>}
          {history?.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: '1px solid #f3f4f7' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700, color: h.qty >= 0 ? '#1b7a47' : '#c0322f', width: 60 }}>
                {h.qty >= 0 ? '+' : '−'}{Math.abs(h.qty)}
              </span>
              <div style={{ flex: 1, fontSize: 12.5, color: '#5b6472' }}>{h.fromLocation} → {h.toLocation} · {h.referenceCode}</div>
              <div style={{ textAlign: 'right', fontSize: 11.5 }}>
                <div style={{ fontWeight: 700 }}>{new Date(h.createdAt).toLocaleDateString('es-PE')}</div>
                <div style={{ color: '#8a93a3' }}>por {h.userEmail}</div>
              </div>
            </div>
          ))}
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
