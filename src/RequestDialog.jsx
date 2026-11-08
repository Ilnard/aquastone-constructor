import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Phone, User, X } from 'lucide-react';
import { LOCAL_CALC, sendRequest } from './api.js';

const money = (n) => new Intl.NumberFormat('ru-RU').format(n || 0) + ' ₽';

/** Маска телефона: +7 (999) 888-77-66. Восьмёрку в начале считаем семёркой. */
export function formatPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits[0] !== '7') digits = '7' + digits;
  digits = digits.slice(0, 11);
  const p = digits.slice(1);
  let out = '+7';
  if (p.length) out += ' (' + p.slice(0, 3);
  if (p.length >= 3) out += ')';
  if (p.length > 3) out += ' ' + p.slice(3, 6);
  if (p.length > 6) out += '-' + p.slice(6, 8);
  if (p.length > 8) out += '-' + p.slice(8, 10);
  return out;
}

/**
 * «Отправить заявку на рассмотрение».
 * Клиент заполняет ФИО и телефон; менеджер или директор, вошедший в систему управления, — только подтверждает отправку.
 * Заявка попадает в раздел «Заявки» системы управления (POST /api/requests).
 */
export default function RequestDialog({ staff, project, onClose, onSent }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const phoneDigits = phone.replace(/\D/g, '');
  const valid = staff || (name.trim().length >= 2 && phoneDigits.length === 11);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      const body = staff ? { project } : { project, contact: { name: name.trim(), phone }, website };
      const result = await sendRequest(body);
      setSent(result); onSent?.(result);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return <div className="request-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className="request-dialog" role="dialog" aria-modal="true" aria-label="Отправить заявку на рассмотрение" onSubmit={submit}>
      <button type="button" className="request-close" onClick={onClose} aria-label="Закрыть"><X size={17}/></button>
      {sent ? <div className="request-done">
        <span className="request-done-icon"><Check size={24}/></span>
        <h2>{sent.id ? `Заявка №${sent.id} отправлена` : 'Заявка отправлена'}</h2>
        <p>{staff ? 'Она появилась в разделе «Заявки» системы управления.' : 'Менеджер AquaStone проверит расчёт и перезвонит вам, чтобы уточнить детали и договориться о замере.'}</p>
        <button type="button" className="primary-cta" onClick={onClose}><span>Готово</span></button>
      </div> : <>
        <p className="eyebrow">ЗАЯВКА НА РАССМОТРЕНИЕ</p>
        <h2>{staff ? 'Отправить расчёт в заявки' : 'Оставьте контакты'}</h2>
        <p className="request-lead">{staff ? <>Вы вошли как <b>{staff.name}</b>. Контакты клиента не нужны — заявка сохранится от вашего имени, клиента добавите при создании процесса.</> : 'Мы проверим расчёт и свяжемся с вами для уточнения деталей и замера.'}</p>
        <div className="request-summary">
          <div><span>Материал</span><b>{project.materialTitle}{project.thickness ? `, ${project.thickness} мм` : ''}</b></div>
          <div><span>Декор</span><b>{project.decor || 'не выбран'}</b></div>
          <div><span>Площадь</span><b>{String(project.summary.area).replace('.', ',')} м²</b></div>
          <div><span>Ориентир</span><b className="request-price">{money(project.estimate)}</b></div>
        </div>
        {LOCAL_CALC && <p className="request-error" role="note">Это демо-версия конструктора: расчёт выполнен в браузере по демо-ценам, заявки из неё не отправляются. Сохранить расчёт можно кнопкой «Экспорт проекта».</p>}
        {!staff && !LOCAL_CALC && <>
          <label className="request-field"><span>ФИО <i>*</i></span><div><User size={15}/><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" autoComplete="name" maxLength={120} required/></div></label>
          <label className="request-field"><span>Телефон <i>*</i></span><div><Phone size={15}/><input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="+7 (999) 888-77-66" inputMode="tel" autoComplete="tel" required/></div></label>
          <label className="request-trap" aria-hidden="true">Сайт<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}/></label>
          <p className="request-consent">Нажимая кнопку, вы соглашаетесь на обработку персональных данных для связи по этой заявке.</p>
        </>}
        {error && <p className="request-error" role="alert">{error}</p>}
        {!LOCAL_CALC && <button type="submit" className="primary-cta" disabled={!valid || busy}><span>{busy ? 'Отправляем…' : 'Отправить заявку на рассмотрение'}</span><ArrowRight size={17}/></button>}
        {LOCAL_CALC && <button type="button" className="primary-cta" onClick={onClose}><span>Понятно</span></button>}
      </>}
    </form>
  </div>;
}
