import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { COLLECTIONS, DECORS, PRODUCT_BASE, decorImage, decorTitle } from './data/decors.js';

/**
 * Выбор декора кварца по каталогу Avant Quartz: коллекции, поиск по коду и названию, сетка текстур.
 * Декор только записывается в расчёт и заявку — детали на эскизе не окрашиваются.
 */
export default function DecorPicker({ value, onChange }) {
  const [collection, setCollection] = useState('Все');
  const [query, setQuery] = useState('');
  const [broken, setBroken] = useState(() => new Set());
  const selected = DECORS.find((d) => d.code === value) || null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DECORS.filter((d) => (collection === 'Все' || d.collection === collection) && (!q || `${d.code} ${d.name}`.toLowerCase().includes(q)));
  }, [collection, query]);

  return <div className="decor-picker">
    <div className="decor-tabs" role="tablist" aria-label="Коллекции Avant Quartz">
      {['Все', ...COLLECTIONS].map((name) => <button key={name} type="button" role="tab" aria-selected={collection === name} className={collection === name ? 'active' : ''} onClick={() => setCollection(name)}>{name}</button>)}
    </div>
    <label className="decor-search"><Search size={13}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Код или название, например 7400"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={12}/></button>}</label>
    <div className="decor-swatches">
      {shown.map((d) => <button key={d.code} type="button" className={`decor-swatch ${d.code === value ? 'chosen' : ''}`} title={decorTitle(d)} aria-label={decorTitle(d)} aria-pressed={d.code === value} onClick={() => onChange(d.code === value ? null : d.code)}>
        {broken.has(d.code) ? <span className="decor-swatch-fallback">{d.code}</span> : <img src={decorImage(d)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((set) => new Set(set).add(d.code))}/>}
        {!broken.has(d.code) && <span className="decor-swatch-code">{d.code}</span>}
        {d.code === value && <span className="decor-check"><Check size={11}/></span>}
      </button>)}
      {!shown.length && <p className="decor-empty">Ничего не найдено</p>}
    </div>
    <div className="decor-caption">
      {selected ? <>
        <strong>{selected.code} {selected.name}</strong><span>{selected.collection}</span>
        <a href={PRODUCT_BASE + selected.page} target="_blank" rel="noreferrer">на сайте ↗</a>
      </> : <span className="decor-none">Декор не выбран — можно уточнить с менеджером</span>}
    </div>
  </div>;
}
