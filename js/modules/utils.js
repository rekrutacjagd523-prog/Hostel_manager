// ===== UTILITY FUNCTIONS =====
import { t } from './constants.js';
import { CURRENCIES } from './constants.js';

export function settings() { return window._settings || { currency: 'PLN', lang: 'EN' }; }
export function residents() { return window._residents || []; }
export function properties() { return window._properties || []; }
export function cur() { return CURRENCIES[settings().currency] || CURRENCIES.PLN; }

export function fmtNum(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    const sym = (window._settings && ({PLN:'zł',EUR:'€',USD:'$'})[window._settings.currency]) || 'zł';
    const parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.') + ' ' + sym;
}

export function fmtUi(a) { return a.toFixed(2) + ' ' + cur().symbolU; }
export function fmtPdf(a) { return a.toFixed(2) + ' ' + cur().symbol; }
export function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function todayStr() { return new Date().toISOString().split('T')[0]; }
export function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}
export function daysBetween(s, e) {
    const a = new Date(s), b = e ? new Date(e) : new Date();
    return Math.max(0, Math.ceil((b - a) / 86400000));
}
export function daysLabel(r) {
    const d = daysBetween(r.checkInDate, r.checkOutDate);
    if (!r.checkOutDate && d === 0) {
        const diff = Math.ceil((new Date(r.checkInDate) - new Date()) / 86400000);
        if (diff > 0) return '<span style="color:var(--accent)">⏳ ' + diff + ' ' + t('days') + '</span>';
    }
    return d + ' ' + t('days');
}
export function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
export function resName(r) { return (r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : ''); }

export function showConfirm(icon, title, msg, okText, okClass, onOk) {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    const isDelete = okClass === 'c-danger';
    el.innerHTML = '<div class="confirm-box"><div class="confirm-title">' + title + '</div>' + (msg ? '<div class="confirm-msg">' + msg + '</div>' : '') + '<div class="confirm-btns"><button class="c-cancel" id="c-no">' + t('confirmNo') + '</button><button class="' + (okClass || 'c-ok') + '" id="c-yes">' + (okText || t('confirmYes')) + '</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#c-no').onclick = () => el.remove();
    el.querySelector('#c-yes').onclick = () => { el.remove(); onOk(); };
    el.onclick = (e) => { if (e.target === el) el.remove(); };
}

// Helper: remove id from resident before saving to firebase
export function cleanForFirebase(r) {
    const { id, ...data } = r;
    return data;
}

// Helper: get resident doc ref for current user
export function resDoc(id) {
    const uid = window._workspaceUid || window._currentUser?.uid;
    return window._fb.doc(window._fb.db, 'users', uid, 'residents', id);
}

export function propDoc(id) {
    const uid = window._workspaceUid || window._currentUser?.uid;
    return window._fb.doc(window._fb.db, 'users', uid, 'properties', id);
}

export function expenses() { return window._expenses || []; }

export function expDoc(id) {
    const uid = window._workspaceUid || window._currentUser?.uid;
    return window._fb.doc(window._fb.db, 'users', uid, 'expenses', id);
}

export function getRoomsForProp(propId) {
    const p = properties().find(x => x.id === propId);
    return (p && p.rooms) ? p.rooms : [];
}

export function bookings() { return window._bookings || []; }
export function bookDoc(id) {
    const uid = window._workspaceUid || window._currentUser?.uid;
    return window._fb.doc(window._fb.db, 'users', uid, 'bookings', id);
}
