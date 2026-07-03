'use client';

import { useState } from 'react';
import { createGroup, updateGroup, deleteGroup } from './actions';
import Modal from './Modal';

type Group = { id: string; name: string };

const NAME_MAX_LENGTH = 200;

export default function GroupManagerModal({
  groups, onClose, onChanged,
}: {
  groups: Group[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ error: string } | { success: true }>) {
    setError(null);
    setPending(true);
    const result = await fn();
    setPending(false);
    if ('error' in result) {
      setError(result.error);
      return false;
    }
    onChanged();
    return true;
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setError('El nombre del grupo es obligatorio.'); return; }
    const fd = new FormData();
    fd.set('name', name);
    if (await run(() => createGroup(fd))) setNewName('');
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) { setError('El nombre del grupo es obligatorio.'); return; }
    const fd = new FormData();
    fd.set('name', name);
    if (await run(() => updateGroup(id, fd))) setEditingId(null);
  }

  async function handleDelete(g: Group) {
    if (!confirm(`¿Eliminar el grupo "${g.name}"?`)) return;
    await run(() => deleteGroup(g.id));
  }

  return (
    <Modal onClose={onClose} disableClose={pending} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 16 }}>Gestionar grupos</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo grupo (ej. Amortiguadores)"
            aria-label="Nombre del nuevo grupo"
            maxLength={NAME_MAX_LENGTH}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 }}
          />
          <button onClick={handleCreate} disabled={pending} style={{ padding: '10px 16px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13.5, cursor: pending ? 'default' : 'pointer' }}>
            Crear
          </button>
        </div>

        {error && (
          <div style={{ margin: '4px 0 8px', fontSize: 13, color: '#c0322f', background: '#fde8e8', padding: '10px 12px', borderRadius: 9 }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', marginTop: 8, borderTop: '1px solid #f3f4f7' }}>
          {groups.length === 0 && <div style={{ padding: '16px 0', fontSize: 13, color: '#8a93a3' }}>Aún no hay grupos.</div>}
          {groups.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #f3f4f7' }}>
              {editingId === g.id ? (
                <>
                  <input
                    value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                    aria-label={`Editar nombre del grupo ${g.name}`}
                    maxLength={NAME_MAX_LENGTH}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid #e3e6ec', borderRadius: 8, fontSize: 13.5 }}
                  />
                  <button onClick={() => handleSaveEdit(g.id)} disabled={pending} style={{ padding: '7px 12px', background: '#1F56D6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Guardar</button>
                  <button onClick={() => setEditingId(null)} disabled={pending} style={{ padding: '7px 12px', background: '#fff', border: '1px solid #e3e6ec', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                  <button onClick={() => { setEditingId(g.id); setEditName(g.name); setError(null); }} disabled={pending} style={{ padding: '7px 12px', background: '#fff', border: '1px solid #e3e6ec', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => handleDelete(g)} disabled={pending} style={{ padding: '7px 12px', background: '#fff', border: '1px solid #f3c6c6', color: '#c0322f', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={onClose} disabled={pending} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e3e6ec', background: '#fff', fontWeight: 700, cursor: pending ? 'default' : 'pointer' }}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
