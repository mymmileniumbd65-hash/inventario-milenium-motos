'use client';

import { useId } from 'react';

// Generates a stable id and wires it to the label via htmlFor, so clicking the
// label focuses the field and screen readers announce it correctly.
export default function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children(id)}
    </div>
  );
}

export const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e3e6ec', borderRadius: 9, fontSize: 13.5 };
