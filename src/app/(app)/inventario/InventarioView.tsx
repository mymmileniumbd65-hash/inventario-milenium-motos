'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PartComputed } from '@/lib/inventory';
import PartDrawer from './PartDrawer';
import MovementFormModal from './MovementFormModal';
import PartFormModal from './PartFormModal';
import GroupManagerModal from './GroupManagerModal';

const STATUS_COLORS: Record<string, [string, string, string]> = {
  Disponible: ['#e7f6ee', '#1b7a47', '#1f9d57'],
  'Stock bajo': ['#fdeede', '#b3640f', '#e8870f'],
  Agotado: ['#fde8e8', '#c0322f', '#E23B3B'],
  Exceso: ['#e8eefc', '#1846B3', '#1F56D6'],
};

export default function InventarioView({ groups, parts }: { groups: { id: string; name: string }[]; parts: PartComputed[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedPart, setSelectedPart] = useState<PartComputed | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState<PartComputed | 'new' | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
      if (!q) return true;
      return `${p.description} ${p.sku} ${p.groupName} ${p.compat}`.toLowerCase().includes(q);
    });
  }, [parts, query, groupFilter]);

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f6f7f9', padding: '26px 28px 16px', display: 'flex', gap: 12 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar repuesto, SKU o grupo…"
          style={{ flex: 1, maxWidth: 320, padding: '10px 12px', border: '1px solid #eef1f5', borderRadius: 10, fontSize: 13.5 }}
        />
        <select
          value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #eef1f5', borderRadius: 10, fontSize: 13.5 }}
        >
          <option value="all">Todos los grupos</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={() => setShowGroupManager(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          Grupos
        </button>
        <button onClick={() => setShowPartForm('new')} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Repuesto
        </button>
        <button onClick={() => setShowMovementForm(true)} style={{ padding: '10px 16px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          + Registrar ingreso
        </button>
      </div>

      <div style={{ padding: '0 28px 40px' }}>
        <div style={{ fontSize: 13, color: '#5b6472', marginBottom: 14 }}>
          <b>{filtered.length}</b> SKUs · <b>{filtered.reduce((s, p) => s + p.stock, 0)}</b> unidades
        </div>

        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fbfbfc' }}>
                <th style={thStyle}>SKU / Repuesto</th>
                <th style={thStyle}>Grupo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Stock</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Mín</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Rotación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const colors = STATUS_COLORS[p.status];
                return (
                  <tr key={p.id} onClick={() => setSelectedPart(p)} style={{ cursor: 'pointer' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{p.description}</div>
                      <div style={{ fontSize: 11.5, color: '#8a93a3', fontFamily: 'IBM Plex Mono, monospace' }}>{p.sku}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#5b6472', background: '#f1f3f6', padding: '3px 9px', borderRadius: 7 }}>{p.groupName}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>{p.stock}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#8a93a3' }}>{p.minStock}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: colors[0], color: colors[1] }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[2] }} />
                        {p.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{p.rotationDays !== null ? `${p.rotationDays} d` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#8a93a3' }}>Sin resultados para tu búsqueda.</div>}
        </div>
      </div>

      {selectedPart && (
        <PartDrawer
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onEdit={(p) => { setSelectedPart(null); setShowPartForm(p); }}
          onDeleted={() => { setSelectedPart(null); refresh(); }}
          onChanged={refresh}
        />
      )}
      {showMovementForm && (
        <MovementFormModal
          parts={parts}
          onClose={() => setShowMovementForm(false)}
          onSuccess={() => { setShowMovementForm(false); refresh(); }}
        />
      )}
      {showPartForm && (
        <PartFormModal
          groups={groups}
          part={showPartForm === 'new' ? null : showPartForm}
          onClose={() => setShowPartForm(null)}
          onSuccess={() => { setShowPartForm(null); refresh(); }}
        />
      )}
      {showGroupManager && (
        <GroupManagerModal
          groups={groups}
          onClose={() => setShowGroupManager(false)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a93a3', padding: '13px 16px', borderBottom: '1px solid #eef1f5' };
const tdStyle: React.CSSProperties = { padding: '13px 16px', borderBottom: '1px solid #f3f4f7' };
