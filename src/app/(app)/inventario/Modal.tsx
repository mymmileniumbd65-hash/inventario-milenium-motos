'use client';

import { useEffect } from 'react';

// Shared modal shell: backdrop click + Escape both close (unless a mutation is
// in flight, via disableClose — closing then wouldn't cancel the pending
// server action, just hide it, so we block it instead), with dialog ARIA
// semantics and a max-width clamp so it never overflows a narrow viewport.
export default function Modal({
  onClose, disableClose = false, width = 440, children,
}: {
  onClose: () => void;
  disableClose?: boolean;
  width?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !disableClose) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, disableClose]);

  return (
    <div
      onClick={() => { if (!disableClose) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,38,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ background: '#fff', borderRadius: 16, padding: 28, width, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto' }}
      >
        {children}
      </div>
    </div>
  );
}
