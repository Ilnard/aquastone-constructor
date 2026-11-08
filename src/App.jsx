import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Circle, Download, HelpCircle, Layers2, Loader2, Minus, MousePointer2, Plus, Redo2, RotateCcw, Scissors, Sparkles, Square, Trash2, Undo2, Waves, X } from 'lucide-react';
import { LOCAL_CALC, fetchConfig, fetchEstimate, fetchStaff } from './api.js';
import RequestDialog from './RequestDialog.jsx';
import HelpDialog from './HelpDialog.jsx';
import Menu from './Menu.jsx';
import { FORMS, FormIcon, formById } from './forms.jsx';
import DecorPicker from './DecorPicker.jsx';
import { DECORS, decorTitle } from './data/decors.js';

// Менеджер или директор, вошедший в систему управления (тот же сайт / тот же сервер /api), отправляет заявку без формы контактов.
const STAFF_ROLES = ['Директор', 'Менеджер'];
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '—';

// Подписи материалов для кнопок. Цены, толщины и размеры листов — на сервере (aquastone-managment/server/calc/pricing.js),
// конструктор получает их через /api/calc/config, а раскрой и стоимость — через /api/calc/estimate.
const MATERIALS = {
  quartz: { title: 'Кварцевый агломерат', short: 'Кварц', sub: 'Агломерат' },
  acrylic: { title: 'Акриловый камень', short: 'Акрил', sub: 'Искусственный камень' },
  compact: { title: 'Компакт-плита', short: 'Компакт', sub: 'HPL-панель' },
};
const CUTOUT_NAMES = { sink: 'мойка', hob: 'варочная панель', circle: 'круглый вырез', cutout: 'прямой вырез' };
const CUTOUT_TYPES = ['sink', 'hob', 'circle', 'cutout'];
const CUTOUT_SIZES = { sink: [540, 390], hob: [590, 510], circle: [420, 420], cutout: [600, 240] };
const INITIAL = [
  { id: 'a', type: 'rect', x: 170, y: 170, w: 2940, h: 620, name: 'Участок 1' },
  { id: 'b', type: 'rect', x: 2420, y: 790, w: 690, h: 1100, name: 'Участок 2' },
  { id: 'sink', type: 'sink', x: 420, y: 280, w: 540, h: 380, name: 'Мойка' },
  { id: 'hob', type: 'hob', x: 2070, y: 225, w: 590, h: 510, name: 'Варочная панель' },
];
const TOOLS = [['select', 'Выбор', MousePointer2], ['rect', 'Столешница', Square], ['sink', 'Мойка', Waves], ['hob', 'Варочная', Layers2], ['circle', 'Круглый вырез', Circle], ['cutout', 'Прямой вырез', Scissors]];
const SCALE = 0.31; // мм → единицы чертежа
const ORIGIN = { x: 85, y: 55 };
const uid = () => Math.random().toString(36).slice(2, 9);
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return `${n} ${a > 10 && a < 20 ? many : b === 1 ? one : b > 1 && b < 5 ? few : many}`; };
const money = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

// Черновик проекта хранится в этом браузере: параметры и эскиз переживают перезагрузку страницы.
const STORAGE_KEY = 'aquastone-constructor-v1';
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!d || typeof d !== 'object') return null;
    const shapes = Array.isArray(d.shapes) ? d.shapes.filter((s) => s && TOOLS.some((t) => t[0] === s.type) && [s.x, s.y, s.w, s.h].every(Number.isFinite)) : null;
    return {
      title: typeof d.title === 'string' ? d.title : '',
      form: FORMS.some((f) => f.id === d.form) ? d.form : null,
      material: MATERIALS[d.material] ? d.material : null,
      // Допустимые толщины придут с сервера — там же значение и проверится.
      thickness: MATERIALS[d.material] && Number.isFinite(d.thickness) ? d.thickness : null,
      decor: DECORS.some((x) => x.code === d.decor) ? d.decor : null,
      decorText: typeof d.decorText === 'string' ? d.decorText : '',
      shapes,
    };
  } catch { return null; }
}

const SNAP_DISTANCE = 48;
/** Прилипание детали к краям соседних деталей и выравнивание по их краям и центрам. */
function snapAndAlignRectangle(rect, others) {
  const { x, y } = rect;
  let bestX = SNAP_DISTANCE + 1;
  let bestY = SNAP_DISTANCE + 1;
  const considerX = (delta) => { if (Math.abs(delta) <= SNAP_DISTANCE && Math.abs(delta) < Math.abs(bestX)) bestX = delta; };
  const considerY = (delta) => { if (Math.abs(delta) <= SNAP_DISTANCE && Math.abs(delta) < Math.abs(bestY)) bestY = delta; };
  for (const other of others) {
    const otherRight = other.x + other.w;
    const otherBottom = other.y + other.h;
    const rectRight = x + rect.w;
    const rectBottom = y + rect.h;
    // Край к краю — когда детали перекрываются по другой оси.
    if (y < otherBottom && rectBottom > other.y) { considerX(other.x - rectRight); considerX(otherRight - x); }
    if (x < otherRight && rectRight > other.x) { considerY(other.y - rectBottom); considerY(otherBottom - y); }
    // Выравнивание: совпадающие края или центры на одной линии.
    [other.x - x, otherRight - rectRight, other.x + other.w / 2 - (x + rect.w / 2)].forEach(considerX);
    [other.y - y, otherBottom - rectBottom, other.y + other.h / 2 - (y + rect.h / 2)].forEach(considerY);
  }
  return {
    x: Math.max(0, Math.round(x + (Math.abs(bestX) <= SNAP_DISTANCE ? bestX : 0))),
    y: Math.max(0, Math.round(y + (Math.abs(bestY) <= SNAP_DISTANCE ? bestY : 0))),
  };
}

/** Вырез, центр которого не лежит ни на одной детали столешницы. */
const isOutside = (cut, surfaces) => {
  const cx = cut.x + cut.w / 2, cy = cut.y + cut.h / 2;
  return !surfaces.some((s) => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h);
};

export default function App() {
  const draft = useMemo(loadDraft, []);
  const [title, setTitle] = useState(draft?.title || '');
  const [form, setForm] = useState(draft?.form ?? null);
  const [material, setMaterial] = useState(draft?.material ?? null);
  const [thickness, setThickness] = useState(draft?.thickness ?? null);
  const [decor, setDecor] = useState(draft?.decor ?? null);
  const [decorText, setDecorText] = useState(draft?.decorText || '');
  const [shapes, setShapes] = useState(draft?.shapes ?? INITIAL);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [tool, setTool] = useState('select');
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState('');
  const [variantId, setVariantId] = useState(null);
  const [staff, setStaff] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(draft ? new Date() : null);
  const [config, setConfig] = useState(null); // { materials: { quartz: { title, thickness: [20, 40], slab } }, forms, note }
  const [configError, setConfigError] = useState('');
  const [calc, setCalc] = useState(null); // ответ /api/calc/estimate для текущего эскиза
  const [calcState, setCalcState] = useState({ loading: false, error: '' });
  const svg = useRef(null);
  const drag = useRef(null);
  const toastTimer = useRef(0);
  const fileInput = useRef(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  useEffect(() => {
    let alive = true;
    fetchStaff().then((u) => {
      if (alive && u && (u.roles || []).some((r) => STAFF_ROLES.includes(r))) setStaff(u);
    });
    return () => { alive = false; };
  }, []);

  // Параметры материалов (толщины, листы) — с сервера. Без них расчёт недоступен.
  const [configAttempt, setConfigAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setConfigError('');
    fetchConfig().then((c) => { if (alive) setConfig(c); }).catch(() => {
      if (!alive) return;
      setConfigError('Нет связи с сервером расчёта. Проверьте интернет — попробуем ещё раз.');
      setTimeout(() => alive && setConfigAttempt((n) => n + 1), 5000);
    });
    return () => { alive = false; };
  }, [configAttempt]);
  const thicknessOptions = (key) => config?.materials?.[key]?.thickness || [];
  // Сохранённая в черновике толщина, которой больше нет в параметрах сервера, сбрасывается.
  useEffect(() => {
    if (!config || !material) return;
    const options = thicknessOptions(material);
    if (thickness != null && !options.includes(thickness)) setThickness(options.length === 1 ? options[0] : null);
    else if (thickness == null && options.length === 1) setThickness(options[0]);
  }, [config, material]);

  // Раскрой и стоимость считает сервер. Пересчёт — через 250 мс после последнего изменения эскиза.
  const calcKey = JSON.stringify([material, thickness, form, variantId, shapes.map(({ id, type, x, y, w, h }) => [id, type, Math.round(x), Math.round(y), Math.round(w), Math.round(h)])]);
  useEffect(() => {
    if (!config || !material) { setCalcState({ loading: false, error: '' }); return undefined; }
    const controller = new AbortController();
    setCalcState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      const body = { material, thickness, form, variant: variantId, shapes: shapes.map(({ id, type, name, x, y, w, h }) => ({ id, type, name, x, y, w, h })) };
      fetchEstimate(body, controller.signal)
        .then((result) => { setCalc({ ...result, key: calcKey }); setCalcState({ loading: false, error: '' }); })
        .catch((error) => { if (error.name !== 'AbortError') setCalcState({ loading: false, error: error.message }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [calcKey, config]);

  // Автосохранение в браузер (с небольшой задержкой, чтобы не писать на каждое движение мыши).
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, form, material, thickness, decor, decorText, shapes }));
        setSavedAt(new Date());
      } catch { /* хранилище недоступно — работаем без сохранения */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [title, form, material, thickness, decor, decorText, shapes]);

  const notify = useCallback((text, duration = 2600) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), duration);
  }, []);

  // ---------- Расчёт (ответ сервера) ----------
  const info = MATERIALS[material] || null;
  const calcFresh = Boolean(calc && calc.key === calcKey);
  // Пока сервер пересчитывает, показываем прошлый результат для этого же материала.
  const shown = calc && calc.material === material ? calc : null;
  const variants = shown?.variants || [];
  const result = variants.find((v) => v.id === (variantId || shown?.selected)) || variants[0] || { boards: [], seams: [], efficiency: 0 };
  const slab = shown?.slab || config?.materials?.[material]?.slab || { margin: 0, kerf: 0 };
  const surface = shapes.filter((s) => s.type === 'rect');
  const cutouts = shapes.filter((s) => s.type !== 'rect');
  const selectedShape = shapes.find((s) => s.id === selected);
  const area = surface.reduce((sum, s) => sum + s.w * s.h, 0) / 1e6;
  const formInfo = form ? formById(form) : null;
  const feasible = Boolean(shown?.feasible);
  const estimate = feasible ? shown.estimate : 0;
  const price = shown?.price;
  const calcPending = Boolean(info) && (calcState.loading || !calcFresh);

  // Обязательный выбор перед отправкой заявки: форма, материал, толщина.
  const missing = { form: !form, material: !material, thickness: !!material && thickness == null };
  const missingList = [missing.form && 'форму столешницы', missing.material && 'материал', missing.thickness && 'толщину'].filter(Boolean);
  const fieldError = (key) => showErrors && missing[key];
  const outside = cutouts.filter((c) => isOutside(c, surface));

  const decorInfo = material === 'quartz' ? DECORS.find((d) => d.code === decor) : null;
  const decorName = material === 'quartz' ? (decorInfo ? decorTitle(decorInfo) : '') : decorText.trim();

  // В заявку уходит только эскиз и параметры: площадь, раскрой и цену сервер посчитает сам.
  // summary и estimate здесь — для показа в окне заявки.
  const buildProject = () => ({
    title: title.trim(), form, formTitle: formInfo?.title || '', material, materialTitle: shown?.materialTitle || info.title, decor: decorName, decorCode: decorInfo?.code || '', thickness,
    variant: result.id || null,
    shapes: shapes.map(({ id, type, name, x, y, w, h }) => ({ id, type, name, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })),
    summary: shown?.summary || { area: Math.round(area * 100) / 100 },
    estimate,
  });

  const openRequest = () => {
    if (missingList.length) {
      setShowErrors(true);
      notify('Выберите ' + missingList.join(', '));
      const first = ['form', 'material', 'thickness'].find((k) => missing[k]);
      document.getElementById('field-' + first)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!surface.length) { notify('Сначала нарисуйте хотя бы одну деталь столешницы'); return; }
    if (outside.length) {
      setSelected(outside[0].id);
      notify(`«${outside[0].name}» не лежит на столешнице — перетащите его на деталь или удалите`, 4000);
      return;
    }
    if (calcState.error) { notify(calcState.error, 4000); return; }
    if (calcPending) { notify('Подождите секунду — считаем раскрой и стоимость'); return; }
    if (!feasible) { notify(shown?.note || 'Детали не помещаются на листы этого материала', 4500); return; }
    setRequestOpen(true);
  };

  // ---------- История (отменить / повторить) ----------
  // past — предыдущие состояния эскиза, future — отменённые. Текущее состояние — shapes.
  const pushHistory = (snapshot) => { setPast((p) => [...p.slice(-49), snapshot]); setFuture([]); };
  const commit = (next) => { pushHistory(shapesRef.current); setShapes(next); };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [shapesRef.current, ...f]);
    setShapes(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSelected(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, shapesRef.current]);
    setShapes(future[0]);
    setFuture((f) => f.slice(1));
    setSelected(null);
  };
  const update = (id, patch) => setShapes((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeSelected = () => { if (!selected) return; commit(shapes.filter((s) => s.id !== selected)); setSelected(null); };

  // Горячие клавиши: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z (или Ctrl+Y), Delete, Esc.
  const keysRef = useRef({});
  keysRef.current = { undo, redo, removeSelected };
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
      if (typing || document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'я')) { e.preventDefault(); if (e.shiftKey) keysRef.current.redo(); else keysRef.current.undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'н')) { e.preventDefault(); keysRef.current.redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); keysRef.current.removeSelected(); }
      else if (e.key === 'Escape') { setSelected(null); setTool('select'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Рисование и перемещение ----------
  const point = (e) => {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.current.getScreenCTM().inverse());
    return { x: (q.x - ORIGIN.x) / (SCALE * zoom), y: (q.y - ORIGIN.y) / (SCALE * zoom) };
  };
  const down = (e) => {
    const { x, y } = point(e);
    if (tool === 'select') { if (!e.target.closest('[data-shape]')) setSelected(null); return; }
    if (tool === 'rect') {
      drag.current = { kind: 'draw', id: uid(), startX: x, startY: y, before: shapesRef.current, name: `Участок ${surface.length + 1}` };
      svg.current.setPointerCapture(e.pointerId);
      return;
    }
    // Мойка, варочная панель или вырез — ставим центром в точку щелчка (в том числе прямо на деталь).
    const [w, h] = CUTOUT_SIZES[tool];
    const s = { id: uid(), type: tool, x: Math.max(0, Math.round(x - w / 2)), y: Math.max(0, Math.round(y - h / 2)), w, h, name: TOOLS.find((t) => t[0] === tool)?.[1] || 'Вырез' };
    commit([...shapes, s]);
    setSelected(s.id);
    setTool('select');
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.kind === 'draw') {
      const shape = { id: d.id, type: 'rect', name: d.name, x: Math.max(0, Math.round(Math.min(d.startX, p.x))), y: Math.max(0, Math.round(Math.min(d.startY, p.y))), w: Math.round(Math.abs(p.x - d.startX)), h: Math.round(Math.abs(p.y - d.startY)) };
      setShapes([...d.before, shape]);
      return;
    }
    const proposed = { x: Math.max(0, d.origX + p.x - d.startX), y: Math.max(0, d.origY + p.y - d.startY) };
    const others = d.before.filter((v) => v.type === 'rect' && v.id !== d.id);
    const pos = d.type === 'rect' ? snapAndAlignRectangle({ ...d, ...proposed }, others) : { x: Math.round(proposed.x), y: Math.round(proposed.y) };
    d.moved = d.moved || pos.x !== d.origX || pos.y !== d.origY;
    update(d.id, pos);
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.kind === 'draw') {
      const s = shapesRef.current.find((v) => v.id === d.id);
      if (s && s.w > 80 && s.h > 80) { pushHistory(d.before); setSelected(s.id); }
      else { setShapes(d.before); notify('Протяните мышью побольше — деталь должна быть больше 80 × 80 мм'); }
      return;
    }
    if (d.moved) pushHistory(d.before); // простой щелчок без сдвига в историю не попадает
  };
  const startMove = (e, s) => {
    if (tool !== 'select') return; // с инструментом рисования щелчок по детали обработает поле
    e.stopPropagation();
    e.preventDefault();
    setSelected(s.id);
    const p = point(e);
    drag.current = { kind: 'move', id: s.id, type: s.type, startX: p.x, startY: p.y, origX: s.x, origY: s.y, w: s.w, h: s.h, before: shapesRef.current };
    svg.current.setPointerCapture(e.pointerId);
  };

  // Поля «Свойства»: печатать можно свободно, в историю — одно изменение на поле.
  const fieldBefore = useRef(null);
  const editField = (key, raw) => {
    if (raw === '') return;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) return;
    update(selectedShape.id, { [key]: key === 'w' || key === 'h' ? Math.max(20, Math.min(20000, value)) : Math.max(0, Math.min(20000, value)) });
  };

  // ---------- Проект ----------
  const resetParams = () => { setForm(null); setMaterial(null); setThickness(null); setDecor(null); setDecorText(''); setShowErrors(false); notify('Параметры сброшены'); };
  const clearSketch = () => { commit([]); setSelected(null); setTool('rect'); notify('Эскиз очищен — нарисуйте столешницу'); };
  const loadExample = () => { commit(INITIAL); setSelected(null); };
  const startOver = () => { resetParams(); setTitle(''); commit(INITIAL); setSelected(null); setVariantId(null); notify('Начат новый расчёт'); };
  const exportProject = () => {
    const data = { app: 'aquastone-constructor', version: 1, title: title.trim(), form, material, thickness, decor, decorText, decorName, shapes };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = (title.trim() || 'aquastone-project').replace(/[\\/:*?"<>|]+/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify('Проект сохранён в файл — его можно открыть через «···» → «Открыть проект»');
  };
  const importProject = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const d = loadDraft();
      if (!d?.shapes) throw new Error();
      setTitle(d.title); setForm(d.form); setMaterial(d.material); setThickness(d.thickness); setDecor(d.decor); setDecorText(d.decorText);
      commit(d.shapes); setSelected(null); setVariantId(null);
      notify('Проект открыт');
    } catch { notify('Не удалось открыть файл — нужен файл проекта, сохранённый конструктором'); }
  };

  const chooseMaterial = (key) => {
    if (key === material) return;
    setMaterial(key);
    const options = thicknessOptions(key);
    setThickness(options.length === 1 ? options[0] : null);
    setVariantId(null);
  };
  const savedLabel = savedAt ? `Сохранено в браузере · ${savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Черновик';

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><div className="brand-name">AQUA<span>STONE</span></div><div className="brand-caption">WORKTOP STUDIO</div></div></div>
      <div className="project-breadcrumb">
        <span>Расчёт</span><span className="crumb-slash">/</span>
        <input className="project-title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Название, например «Кухня на Ленина»" aria-label="Название проекта" />
        <span className="saved-pill" title="Проект хранится только в этом браузере"><i />{savedLabel}</span>
        {LOCAL_CALC && <span className="demo-pill" title="Расчёт выполняется в браузере по демо-ценам, заявки не отправляются">Демо-версия</span>}
      </div>
      <div className="top-actions">
        <button type="button" className="icon-button" onClick={() => setHelpOpen(true)} title="Как пользоваться" aria-label="Как пользоваться"><HelpCircle size={18} /></button>
        {staff && <div className="staff-pill" title="Вы вошли в систему управления — заявки отправляются без контактов клиента"><span>Менеджер: <b>{staff.name}</b></span><div className="avatar staff">{initials(staff.name)}</div></div>}
        <button type="button" className="share-button" onClick={exportProject}><Download size={15} /> Экспорт проекта</button>
      </div>
    </header>

    <main className="workspace">
      <aside className="settings-panel">
        <div className="panel-title">
          <div><p className="eyebrow">КОНФИГУРАТОР</p><h1>Новая столешница</h1></div>
          <Menu label="Действия с проектом" items={[
            { label: 'Сбросить параметры', onClick: resetParams },
            { label: 'Начать новый расчёт', onClick: startOver, danger: true },
            'divider',
            { label: 'Сохранить проект в файл', onClick: exportProject },
            { label: 'Открыть проект из файла', onClick: () => fileInput.current?.click() },
          ]} />
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importProject(f); }} />
        </div>

        <div className="section-heading"><span>01</span><h2>Параметры изделия</h2><div className="heading-line" /></div>

        <div id="field-form" className={fieldError('form') ? 'has-error' : ''}>
          <label className="field-label">Форма столешницы</label>
          <div className="form-options" role="radiogroup" aria-label="Форма столешницы">
            {FORMS.map((f) => <button key={f.id} type="button" role="radio" aria-checked={form === f.id} className={`form-option ${form === f.id ? 'active' : ''}`} onClick={() => setForm(f.id)}>
              <FormIcon id={f.id} /><span>{f.title}</span>{form === f.id && <Check className="form-check" size={12} />}
            </button>)}
          </div>
          {fieldError('form') && <p className="field-error">Выберите форму столешницы</p>}
        </div>

        <div id="field-material" className={fieldError('material') ? 'has-error' : ''}>
          <label className="field-label form-material-label">Материал</label>
          <div className="material-options" role="radiogroup" aria-label="Материал">
            {Object.entries(MATERIALS).map(([key, v]) => <button key={key} type="button" role="radio" aria-checked={material === key} className={`material-option ${material === key ? 'active' : ''}`} onClick={() => chooseMaterial(key)}>
              <span className={`material-swatch ${key}`}><i /></span>
              <span className="material-meta"><strong>{v.short}</strong><small>{v.sub}</small></span>
              {material === key && <Check className="material-check" size={15} />}
            </button>)}
          </div>
          {fieldError('material') && <p className="field-error">Выберите материал</p>}
        </div>

        {material && <div className={`field-block thickness-block ${fieldError('thickness') ? 'has-error' : ''}`} id="field-thickness">
          <div className="field-top"><label className="field-label">Толщина</label></div>
          <div className="thickness-options" role="radiogroup" aria-label="Толщина">
            {!config && <span className="thickness-loading">{configError || 'Загружаем параметры…'}</span>}
            {thicknessOptions(material).map((value) => <button key={value} type="button" role="radio" aria-checked={thickness === value} className={`thickness-option ${thickness === value ? 'active' : ''}`} onClick={() => setThickness(value)}>{value} мм{thickness === value && <Check size={14} />}</button>)}
          </div>
          {thicknessOptions(material).length === 1 && <p className="decor-hint">{MATERIALS[material].title} выпускается только толщиной {thicknessOptions(material)[0]} мм.</p>}
          {fieldError('thickness') && <p className="field-error">Выберите толщину</p>}
        </div>}

        {material && <div className="field-block decor-block">
          <div className="field-top"><label className="field-label">Декор</label>{material === 'quartz' && <a className="text-action" href="https://avantstone.ru/shop/" target="_blank" rel="noreferrer">Каталог Avant ↗</a>}</div>
          {material === 'quartz'
            ? <DecorPicker value={decor} onChange={setDecor} />
            : <><input className="decor-text" value={decorText} onChange={(e) => setDecorText(e.target.value)} maxLength={60} placeholder="Название или код декора, если знаете" /><p className="decor-hint">Каталог декоров для этого материала пока не добавлен — декор можно уточнить с менеджером.</p></>}
        </div>}

        <div className="divider" />
        <div className="section-heading"><span>02</span><h2>Раскрой и стоимость</h2><div className="heading-line" /></div>
        <div className="summary-card">
          <div className="summary-top">
            <div className="summary-icon"><Scissors size={17} /></div>
            <div><strong>Предварительный расчёт</strong><small>По текущему эскизу</small></div>
            <button type="button" className={`tiny-info ${explainOpen ? 'active' : ''}`} onClick={() => setExplainOpen((v) => !v)} aria-expanded={explainOpen} title="Как считается стоимость" aria-label="Как считается стоимость"><HelpCircle size={15} /></button>
          </div>
          <div className="summary-row"><span>Форма</span><strong>{formInfo ? formInfo.title : 'не выбрана'}</strong></div>
          <div className="summary-row"><span>Материал</span><strong>{info ? info.title : 'не выбран'}</strong></div>
          <div className="summary-row"><span>Площадь деталей</span><strong>{area.toFixed(2)} м²</strong></div>
          <div className="summary-row"><span>Комплект заказа</span><strong>{feasible ? result.order?.label || '—' : '—'}</strong></div>
          <div className={`summary-row estimated ${calcPending ? 'pending' : ''}`}><span>Ориентир по стоимости</span><strong>{calcPending && <Loader2 className="spin" size={13} />}{info && feasible ? money(estimate) : '—'}</strong></div>
          {explainOpen && <div className="estimate-explain">
            {info && price && feasible ? <>
              <div><span>Материал: {String(shown.summary.purchasedArea).replace('.', ',')} м² листов × {money(price.pricePerM2)}{price.thicknessCoefficient !== 1 ? ` × ${String(price.thicknessCoefficient).replace('.', ',')} (толщина ${thickness} мм)` : ''}</span><b>{money(price.materialCost)}</b></div>
              {price.cutouts.map((line) => <div key={line.type}><span>{CUTOUT_NAMES[line.type] || line.type}: {line.count} × {money(line.price)}</span><b>{money(line.sum)}</b></div>)}
              {price.formCoefficient !== 1 && <div><span>Коэффициент формы «{shown.formTitle}»</span><b>× {String(price.formCoefficient).replace('.', ',')}</b></div>}
            </> : <div><span>Выберите материал и толщину — стоимость считается по площади закупаемых листов, цене материала, толщине и вырезам.</span></div>}
            <p>{shown?.priceNote || config?.note || 'Ориентир не включает доставку, монтаж и кромку — точную стоимость назовёт менеджер после замера.'}</p>
          </div>}
          {calcState.error
            ? <div className="summary-note error"><AlertTriangle size={13} />{calcState.error}</div>
            : <div className={`summary-note ${info && shown && !feasible ? 'error' : ''}`}>{info && shown && !feasible ? <AlertTriangle size={13} /> : <Sparkles size={13} />}{info ? (shown ? shown.note : 'Считаем раскрой…') : 'Выберите материал — раскрой и стоимость посчитаются по размерам его листов.'}</div>}
          {(shown?.warnings || []).map((w) => <div key={w} className="summary-note error"><AlertTriangle size={13} />{w}</div>)}
        </div>
        <div className="slab-spec" title="Размеры листов, которые нужно закупить под этот раскрой"><Layers2 size={15} /><span>Форматы листов</span><strong>{feasible ? result.order?.description || '—' : '—'}</strong></div>
        <div className="panel-footer">
          <button type="button" className="primary-cta" onClick={openRequest}><span>Отправить заявку на рассмотрение</span><ArrowRight size={17} /></button>
          <p>{LOCAL_CALC ? 'Демо-версия: расчёт по демо-ценам в браузере, заявки не отправляются' : staff ? `Заявка уйдёт в систему управления от имени: ${staff.name}` : 'Расчёт предварительный и требует подтверждения технологом'}</p>
        </div>
      </aside>

      <section className="design-area">
        <div className="design-head">
          <div className="design-title"><div className="breadcrumb-small">ПРОЕКТИРОВАНИЕ <span>/</span> ЭСКИЗ</div><h2>{title.trim() || 'Столешница'} <span>— вид сверху</span></h2></div>
          <div className="design-head-actions">
            <button type="button" className="outline-action" onClick={loadExample} title="Вернуть пример эскиза (можно отменить)"><RotateCcw size={14} /> Пример</button>
            <Menu label="Действия с эскизом" className="dots-action" items={[
              { label: 'Очистить эскиз', onClick: clearSketch, danger: true },
              { label: 'Вернуть пример', onClick: loadExample },
              'divider',
              { label: 'Как пользоваться', onClick: () => setHelpOpen(true) },
            ]} />
          </div>
        </div>
        <div className="canvas-frame">
          <div className="canvas-toolbar">
            <div className="tool-group">{TOOLS.map(([id, label, Icon]) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id} className={`tool-button ${tool === id ? 'selected' : ''}`} onClick={() => setTool(id)}><Icon size={17} /></button>)}</div>
            <div className="toolbar-separator" />
            <button type="button" className="undo-button" onClick={undo} disabled={!past.length} title="Отменить (Ctrl+Z)" aria-label="Отменить"><Undo2 size={16} /></button>
            <button type="button" className="undo-button" onClick={redo} disabled={!future.length} title="Повторить (Ctrl+Shift+Z)" aria-label="Повторить"><Redo2 size={16} /></button>
            <button type="button" className="undo-button" onClick={removeSelected} disabled={!selected} title="Удалить выбранное (Delete)" aria-label="Удалить выбранное"><Trash2 size={15} /></button>
            <div className="toolbar-spacer" />
            <span className="tool-hint">{tool === 'select' ? 'Перетаскивайте детали мышью' : tool === 'rect' ? 'Зажмите и протяните, чтобы нарисовать' : 'Щёлкните по детали, чтобы добавить'}</span>
            <div className="toolbar-separator" />
            <button type="button" className="undo-button" onClick={() => setZoom((z) => Math.min(1.35, z + 0.1))} title="Приблизить" aria-label="Приблизить"><Plus size={15} /></button>
            <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
            <button type="button" className="undo-button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Отдалить" aria-label="Отдалить"><Minus size={15} /></button>
          </div>
          <div className="canvas-viewport">
            <svg ref={svg} className={`blueprint tool-${tool}`} viewBox="0 0 1180 760" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <defs>
                <pattern id="minor" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e7e8e5" strokeWidth=".65" /></pattern>
                <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="url(#minor)" /><path d="M80 0H0V80" fill="none" stroke="#d9dcda" /></pattern>
              </defs>
              <rect width="1180" height="760" fill="url(#grid)" />
              <g transform={`translate(${ORIGIN.x} ${ORIGIN.y}) scale(${zoom})`}>
                {surface.map((s, i) => <g key={s.id} data-shape="surface" onPointerDown={(e) => startMove(e, s)} className="shape-group movable">
                  <rect x={s.x * SCALE} y={s.y * SCALE} width={s.w * SCALE} height={s.h * SCALE} rx="4" fill="#eceeeb" stroke={selected === s.id ? '#bd7b50' : '#9ca29c'} strokeWidth={selected === s.id ? 2 : 1.2} />
                  <text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h / 2) * SCALE + 4} className="surface-label">{s.name.toUpperCase()}</text>
                  <text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h / 2) * SCALE + 20} className="surface-sub-label">{Math.round(s.w)} × {Math.round(s.h)} мм</text>
                  <text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h / 2) * SCALE - 16} className="surface-number">{i + 1}</text>
                </g>)}
                {cutouts.map((s) => <g key={s.id} data-shape={s.type} onPointerDown={(e) => startMove(e, s)} className={`shape-group movable ${outside.includes(s) ? 'outside' : ''}`}>
                  {s.type === 'sink' && <><rect x={s.x * SCALE} y={s.y * SCALE} width={s.w * SCALE} height={s.h * SCALE} rx="23" fill="#aeb9b7" stroke="#798784" strokeWidth="2" /><rect x={(s.x + 22) * SCALE} y={(s.y + 22) * SCALE} width={(s.w - 44) * SCALE} height={(s.h - 44) * SCALE} rx="19" fill="#d6ddda" /><text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h - 38) * SCALE} className="cut-label">РАКОВИНА</text></>}
                  {s.type === 'hob' && <><rect x={s.x * SCALE} y={s.y * SCALE} width={s.w * SCALE} height={s.h * SCALE} rx="8" fill="#343937" stroke="#252a28" /><rect x={(s.x + 16) * SCALE} y={(s.y + 16) * SCALE} width={(s.w - 32) * SCALE} height={(s.h - 32) * SCALE} rx="5" fill="#3d4240" stroke="#656b67" />{[0.29, 0.71].flatMap((x) => [0.32, 0.68].map((y) => <circle key={x + ':' + y} cx={(s.x + s.w * x) * SCALE} cy={(s.y + s.h * y) * SCALE} r={Math.min(s.w, s.h) * 0.11 * SCALE} fill="none" stroke="#747a76" strokeWidth="2" />))}<text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h - 34) * SCALE} className="cut-label hob-label">ВАР. ПАНЕЛЬ</text></>}
                  {s.type === 'circle' && <><circle cx={(s.x + s.w / 2) * SCALE} cy={(s.y + s.h / 2) * SCALE} r={Math.min(s.w, s.h) / 2 * SCALE} fill="#e9ece8" stroke="#c5724c" strokeWidth="2" strokeDasharray="5 3" /><text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h / 2) * SCALE + 4} className="cut-label">КРУГ</text></>}
                  {s.type === 'cutout' && <><rect x={s.x * SCALE} y={s.y * SCALE} width={s.w * SCALE} height={s.h * SCALE} fill="#e9ece8" stroke="#c5724c" strokeWidth="2" strokeDasharray="5 3" /><text x={(s.x + s.w / 2) * SCALE} y={(s.y + s.h / 2) * SCALE + 4} className="cut-label">ВЫРЕЗ</text></>}
                  {selected === s.id && <rect x={s.x * SCALE - 4} y={s.y * SCALE - 4} width={s.w * SCALE + 8} height={s.h * SCALE + 8} rx="8" fill="none" stroke="#bc7851" strokeDasharray="4 3" />}
                </g>)}
                {info && calcFresh && feasible && (result.seams || []).map((seam, index) => <line key={index} x1={seam.x1 * SCALE} y1={seam.y1 * SCALE} x2={seam.x2 * SCALE} y2={seam.y2 * SCALE} className={`planned-seam ${seam.kind === 'along' ? 'along' : ''}`} />)}
              </g>
              {!shapes.length && <text x="590" y="380" className="canvas-empty">Выберите инструмент «Столешница» и протяните мышью по полю</text>}
              <text x="35" y="715" className="origin-label">● Рабочая область · мм</text>
            </svg>
            <div className="canvas-floating">
              <button type="button" onClick={() => setZoom(1)} title="Масштаб 100%" aria-label="Масштаб 100%">⌂</button>
              <button type="button" onClick={() => setZoom((z) => Math.min(1.35, z + 0.1))} title="Приблизить" aria-label="Приблизить"><Plus size={15} /></button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title="Отдалить" aria-label="Отдалить"><Minus size={15} /></button>
            </div>
          </div>
          <div className="canvas-status">
            <div><span className="status-dot" /> Все размеры в миллиметрах <span>·</span> Масштаб 1:10</div>
            <div><span>{plural(surface.length, 'деталь', 'детали', 'деталей')}</span><span>·</span><span>{plural(cutouts.length, 'вырез', 'выреза', 'вырезов')}</span>{outside.length > 0 && <><span>·</span><span className="status-warning">{plural(outside.length, 'вырез', 'выреза', 'вырезов')} вне столешницы</span></>}</div>
          </div>
        </div>

        <div className="lower-grid">
          <div className="inspector-card">
            <div className="card-head">
              <div><p className="eyebrow">СВОЙСТВА</p><h3>{selectedShape ? selectedShape.name : 'Выберите элемент на эскизе'}</h3></div>
              {selectedShape && <button type="button" className="danger-icon" onClick={removeSelected} title="Удалить" aria-label="Удалить"><Trash2 size={16} /></button>}
            </div>
            {selectedShape
              ? <div className="inspector-fields">
                {[['Ширина', 'w'], [selectedShape.type === 'rect' ? 'Глубина' : 'Высота', 'h'], ['Отступ X', 'x'], ['Отступ Y', 'y']].map(([label, key]) => <label key={key}>
                  <span>{label}</span>
                  <div><NumberField value={Math.round(selectedShape[key])} min={key === 'w' || key === 'h' ? 20 : 0}
                    onFocus={() => { fieldBefore.current = shapesRef.current; }}
                    onChange={(v) => editField(key, v)}
                    onCommit={() => { if (fieldBefore.current && fieldBefore.current !== shapesRef.current) pushHistory(fieldBefore.current); fieldBefore.current = null; }} /><small>мм</small></div>
                </label>)}
                {selectedShape.type !== 'rect' && outside.includes(selectedShape) && <p className="inspector-warning">Этот элемент не лежит на столешнице — перетащите его на деталь.</p>}
              </div>
              : <div className="empty-inspector"><span>↔</span><span>Кликните по детали, чтобы изменить размеры, или нарисуйте новый участок.</span></div>}
          </div>

          <div className="nesting-card">
            {!info && <div className="nesting-placeholder"><Layers2 size={18} /><span>Выберите материал — карта раскроя посчитается по размерам его листов</span></div>}
            {info && !shown && <div className="nesting-placeholder">{calcState.error ? <><AlertTriangle size={18} /><span>{calcState.error}</span></> : <><Loader2 className="spin" size={18} /><span>Считаем раскрой…</span></>}</div>}
            {info && shown && !feasible && <div className="nesting-placeholder"><AlertTriangle size={18} /><span>{shown.note}</span></div>}
            <div className="card-head nesting-head">
              <div><p className="eyebrow">КАРТА РАСКРОЯ</p><h3>Оптимизация слэба</h3></div>
              <div className="efficiency"><strong>{result.efficiency}%</strong><small>выход материала</small></div>
            </div>
            <div className={`variant-options ${calcPending ? 'pending' : ''}`}>{variants.map((v) => <button key={v.id} type="button" className={result.id === v.id ? 'active' : ''} onClick={() => setVariantId(v.id)}><strong>{v.label}</strong><small>{v.order.label} · длина стыков {Math.round(v.seamLength)} мм</small></button>)}</div>
            <div className={`slab-preview ${calcPending ? 'pending' : ''}`}>
              <div className={`slab-board-list ${result.boards.length > 1 ? 'multi' : ''}`}>
                {result.boards.map((board, boardIndex) => <div className="slab-board" key={boardIndex} style={{ aspectRatio: board.width + '/' + board.height }}>
                  <div className="slab-safe-zone" style={{ inset: `${slab.margin / board.height * 100}% ${slab.margin / board.width * 100}%` }} />
                  <span className="board-label">ЛИСТ {boardIndex + 1} · {board.format} · {board.width} × {board.height}</span>
                  {board.pieces.length === 0 && <span className="empty-board-label">Без деталей</span>}
                  {board.pieces.map((p) => <div key={p.id} className={p.rotated ? 'nest-piece rotated' : 'nest-piece'} title={`${p.label || p.tag}: ${p.w} × ${p.h} мм${p.rotated ? ' · поворот 90°' : ''}`} style={{ left: p.x / board.width * 100 + '%', top: p.y / board.height * 100 + '%', width: Math.max(2, p.w / board.width * 100) + '%', height: Math.max(3, p.h / board.height * 100) + '%' }}>
                    <span>{p.tag}{p.rotated && <small>↻</small>}</span>
                    {shapes.filter((c) => CUTOUT_TYPES.includes(c.type)).map((c) => {
                      const q = projectCutout(c, p);
                      return q && <i key={c.id} className={['nest-cutout', c.type === 'circle' ? 'round' : '', q.openLeft ? 'open-left' : '', q.openRight ? 'open-right' : '', q.openTop ? 'open-top' : '', q.openBottom ? 'open-bottom' : ''].filter(Boolean).join(' ')} title={c.name} style={{ left: (q.x - p.x) / p.w * 100 + '%', top: (q.y - p.y) / p.h * 100 + '%', width: q.w / p.w * 100 + '%', height: q.h / p.h * 100 + '%' }} />;
                    })}
                  </div>)}
                </div>)}
              </div>
              <div className="nest-legend"><span><i /> Детали столешницы</span><span><i /> Краевой запас</span><span><i className="kerf-key" /> Пропил {slab.kerf} мм</span></div>
            </div>
            {info && feasible && <div className="nesting-details">
              {result.boards.flatMap((b) => b.pieces).map((p) => <div key={p.id}><b>{p.tag}</b><span>{p.label || p.name}</span><small>{p.w} × {p.h} мм{p.rotated ? ' · ↻' : ''}</small></div>)}
            </div>}
            <div className="nesting-footer"><span>{calcPending ? <><Loader2 className="spin" size={13} /> Пересчитываем…</> : <><Check size={13} /> {LOCAL_CALC ? 'Расчёт выполнен в браузере (демо)' : 'Расчёт выполнен на сервере'}</>}</span>{info && feasible && <span>{result.note}</span>}</div>
          </div>
        </div>
      </section>
    </main>
    <div className="mobile-cta">
      <div><small>Ориентир</small><b>{calcPending && <Loader2 className="spin" size={13} />}{info && feasible ? money(estimate) : '—'}</b></div>
      <button type="button" className="primary-cta" onClick={openRequest}><span>Отправить заявку</span><ArrowRight size={17} /></button>
    </div>
    {requestOpen && <RequestDialog staff={staff} project={buildProject()} onClose={() => setRequestOpen(false)} />}
    {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button type="button" onClick={() => setToast('')} aria-label="Закрыть"><X size={14} /></button></div>}
  </div>;
}

/** Числовое поле: пока его редактируют, внешнее значение не перебивает ввод; пустое поле после ухода — прежнее значение. */
function NumberField({ value, min, onFocus, onChange, onCommit }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(value)); }, [value, focused]);
  return <input type="number" min={min} step="10" value={text}
    onFocus={() => { setFocused(true); onFocus(); }}
    onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
    onBlur={() => { setFocused(false); setText(String(value)); onCommit(); }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

/** Где вырез (мойка, панель, круг) окажется на детали в карте раскроя — с учётом поворота детали. */
function projectCutout(cutout, piece) {
  let bounds = { x: cutout.x, y: cutout.y, w: cutout.w, h: cutout.h };
  if (cutout.type === 'circle') {
    const diameter = Math.min(cutout.w, cutout.h);
    bounds = { x: cutout.x + (cutout.w - diameter) / 2, y: cutout.y + (cutout.h - diameter) / 2, w: diameter, h: diameter };
  }
  const x = Math.max(bounds.x, piece.sourceX);
  const y = Math.max(bounds.y, piece.sourceY);
  const right = Math.min(bounds.x + bounds.w, piece.sourceX + piece.sourceW);
  const bottom = Math.min(bounds.y + bounds.h, piece.sourceY + piece.sourceH);
  if (right <= x || bottom <= y) return null;
  const offsetX = x - piece.sourceX;
  const offsetY = y - piece.sourceY;
  const width = right - x;
  const height = bottom - y;
  const touchesLeft = Math.abs(x - piece.sourceX) < 1e-3;
  const touchesRight = Math.abs(right - (piece.sourceX + piece.sourceW)) < 1e-3;
  const touchesTop = Math.abs(y - piece.sourceY) < 1e-3;
  const touchesBottom = Math.abs(bottom - (piece.sourceY + piece.sourceH)) < 1e-3;
  if (piece.rotated) return { x: piece.x + piece.sourceH - offsetY - height, y: piece.y + offsetX, w: height, h: width, openLeft: touchesBottom, openRight: touchesTop, openTop: touchesLeft, openBottom: touchesRight };
  return { x: piece.x + offsetX, y: piece.y + offsetY, w: width, h: height, openLeft: touchesLeft, openRight: touchesRight, openTop: touchesTop, openBottom: touchesBottom };
}
