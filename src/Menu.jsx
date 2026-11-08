import React, { useEffect, useRef, useState } from 'react';

/** Кнопка «···» с выпадающим меню. items: [{ label, onClick, danger? } | 'divider']. */
export default function Menu({ label = 'Ещё', className = 'more-button', items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return <div className="menu-root" ref={root}>
    <button type="button" className={className} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>···</button>
    {open && <div className={`menu-popup ${align}`} role="menu">
      {items.map((item, i) => item === 'divider'
        ? <div key={i} className="menu-divider" />
        : <button key={item.label} type="button" role="menuitem" className={item.danger ? 'danger' : ''} onClick={() => { setOpen(false); item.onClick(); }}>{item.label}</button>)}
    </div>}
  </div>;
}
