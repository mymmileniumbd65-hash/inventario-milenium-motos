'use client';

import { useMemo, useRef, useState } from 'react';
import type { PartComputed } from '@/lib/inventory';
import { filterParts } from './partSearch';

function labelOf(p: { sku: string; description: string }): string {
  return `${p.sku} · ${p.description}`;
}

export default function PartCombobox({ parts, name }: { parts: PartComputed[]; name: string }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => filterParts(parts, query), [parts, query]);

  function select(p: PartComputed) {
    setSelectedId(p.id);
    setQuery(labelOf(p));
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) {
        e.preventDefault();
        select(matches[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative' }}
      onBlur={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <input
        type="text"
        value={query}
        placeholder="Buscar por SKU o nombre…"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setSelectedId(''); setHighlight(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 }}
      />
      <input type="hidden" name={name} value={selectedId} />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, background: '#fff', border: '1px solid #e3e6ec', borderRadius: 9, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(20,26,38,0.12)' }}>
          {matches.length === 0 && (
            <div style={{ padding: '9px 12px', fontSize: 13.5, color: '#8a93a3' }}>Sin coincidencias.</div>
          )}
          {matches.map((p, i) => (
            <div
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
              onMouseEnter={() => setHighlight(i)}
              style={{ padding: '9px 12px', fontSize: 13.5, cursor: 'pointer', background: i === highlight ? '#eef3fd' : '#fff' }}
            >
              {labelOf(p)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
