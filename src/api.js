// Связь с сервером системы управления (aquastone-managment). Расчёт раскроя и стоимости выполняется там:
// цены и коэффициенты — в aquastone-managment/server/calc/pricing.js.
//
// Демо-версия для GitHub Pages собирается с VITE_LOCAL_CALC=true: тогда расчёт идёт прямо в браузере
// (копия модулей в src/calc/), а заявки не отправляются. В обычной сборке __LOCAL_CALC__ = false,
// и src/calc вместе с ценами в неё не попадает.
/* global __LOCAL_CALC__ */
export const LOCAL_CALC = typeof __LOCAL_CALC__ !== 'undefined' && __LOCAL_CALC__;

async function readJson(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

const offline = (error) => (error?.name === 'AbortError' ? error : new Error('Нет связи с сервером расчёта. Проверьте интернет и попробуйте ещё раз.'));

/** Материалы, толщины и листы. */
export async function fetchConfig() {
  if (LOCAL_CALC) {
    const { publicConfig } = await import('./calc/estimate.js');
    return publicConfig();
  }
  let response;
  try { response = await fetch('/api/calc/config'); } catch (error) { throw offline(error); }
  return readJson(response, 'Не удалось загрузить параметры расчёта.');
}

/** Раскрой и ориентир стоимости по эскизу: { material, thickness, form, variant, shapes }. */
export async function fetchEstimate(body, signal) {
  if (LOCAL_CALC) {
    const { calculateEstimate } = await import('./calc/estimate.js');
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = calculateEstimate(body);
    if (result.error) throw new Error(result.error);
    return result;
  }
  let response;
  try {
    response = await fetch('/api/calc/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (error) { throw offline(error); }
  return readJson(response, 'Не удалось посчитать стоимость. Попробуйте ещё раз.');
}

/** Отправка заявки в систему управления. */
export async function sendRequest(body) {
  if (LOCAL_CALC) throw new Error('Это демо-версия: заявки из неё не отправляются.');
  let response;
  try {
    response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch { throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'); }
  return readJson(response, 'Не удалось отправить заявку. Попробуйте ещё раз.');
}

/** Кто вошёл в систему управления (менеджер отправляет заявку без формы). В демо — никто. */
export async function fetchStaff() {
  if (LOCAL_CALC) return null;
  try {
    const response = await fetch('/api/auth/me');
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
