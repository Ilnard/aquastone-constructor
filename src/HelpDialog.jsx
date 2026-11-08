import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

/** Справка: как пользоваться конструктором. */
export default function HelpDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="request-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="request-dialog help-dialog" role="dialog" aria-modal="true" aria-label="Как пользоваться конструктором">
      <button type="button" className="request-close" onClick={onClose} aria-label="Закрыть"><X size={17}/></button>
      <p className="eyebrow">СПРАВКА</p>
      <h2>Как пользоваться конструктором</h2>
      <ol className="help-steps">
        <li><b>Выберите форму, материал и толщину</b> слева. Для кварца можно подобрать декор из каталога Avant.</li>
        <li><b>Нарисуйте столешницу.</b> Инструмент «Столешница» — зажмите кнопку мыши (или палец) на поле и протяните. Детали прилипают к краям соседних.</li>
        <li><b>Добавьте мойку, варочную панель и вырезы</b> — выберите инструмент и щёлкните по детали.</li>
        <li><b>Уточните размеры</b> — щёлкните по элементу и введите ширину, глубину и отступы в карточке «Свойства».</li>
        <li><b>Посмотрите раскрой.</b> Карта раскроя предлагает варианты без стыков и со стыками; стоимость пересчитывается сразу. Стык не ставится через мойку и вырезы, а слишком широкая деталь режется вдоль — основная полоса на всю ширину листа и доборная.</li>
        <li><b>Отправьте заявку</b> — менеджер проверит расчёт и свяжется с вами.</li>
      </ol>
      <div className="help-keys">
        <span><kbd>{mod}</kbd>+<kbd>Z</kbd> отменить</span>
        <span><kbd>{mod}</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> повторить</span>
        <span><kbd>Delete</kbd> удалить выбранное</span>
        <span><kbd>Esc</kbd> снять выделение</span>
      </div>
      <p className="request-lead">Проект сохраняется в этом браузере автоматически — можно закрыть страницу и вернуться позже.</p>
    </div>
  </div>;
}
