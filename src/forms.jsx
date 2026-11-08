import React from 'react';

/**
 * Формы столешницы для выбора в конструкторе.
 * Коэффициенты стоимости форм хранятся на сервере: aquastone-managment/server/calc/pricing.js (раздел forms).
 */
export const FORMS = [
  { id: 'straight', title: 'Прямая' },
  { id: 'l-shaped', title: 'Г-образная' },
  { id: 'u-shaped', title: 'П-образная' },
  { id: 'island', title: 'Остров' },
  { id: 'island-1-leg', title: 'Остров с 1 ногой' },
  { id: 'island-2-legs', title: 'Остров с 2 ногами' },
];

export const formById = (id) => FORMS.find((form) => form.id === id) || FORMS[0];

/** Схематичные иконки: прямая, Г, П и остров — вид сверху (линия — стена); острова с ногами — вид спереди (столешница и боковые опоры). */
export function FormIcon({ id }) {
  const top = { className: 'form-icon-slab' };
  const shapes = {
    straight: <><path d="M2 3h44" className="form-icon-wall"/><rect x="4" y="4" width="40" height="9" rx="1.5" {...top}/></>,
    'l-shaped': <path d="M4 4h9v15h31v9H4z" {...top}/>,
    'u-shaped': <path d="M4 4h9v15h22V4h9v24H4z" {...top}/>,
    island: <><rect x="6" y="7" width="36" height="16" rx="1.5" {...top}/><path d="M2 3h44" className="form-icon-wall"/></>,
    'island-1-leg': <><rect x="4" y="7" width="40" height="5" rx="1" {...top}/><rect x="38" y="12" width="6" height="16" className="form-icon-leg"/><rect x="8" y="12" width="26" height="12" className="form-icon-cabinet"/></>,
    'island-2-legs': <><rect x="4" y="7" width="40" height="5" rx="1" {...top}/><rect x="4" y="12" width="6" height="16" className="form-icon-leg"/><rect x="38" y="12" width="6" height="16" className="form-icon-leg"/><rect x="13" y="12" width="22" height="12" className="form-icon-cabinet"/></>,
  };
  return <svg className="form-icon" viewBox="0 0 48 30" aria-hidden="true">{shapes[id]}</svg>;
}
