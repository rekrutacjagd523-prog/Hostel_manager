// ===== SETTINGS MODULE =====
import { t } from './constants.js';
import { residents, showConfirm, esc, resName } from './utils.js';
import { closeForm } from './residents.js';
import { closePropForm } from './properties.js';
import { closeReport } from './report-export.js';

export function getThemePref() { return localStorage.getItem('hostel-theme') || 'dark'; }

export function applyTheme(th) {
    let actual = th;
    if (th === 'auto') actual = window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
    if (actual === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-btn').textContent = actual === 'light' ? '☀️' : '🌙';
}

function updateThemeOptions() {
    const th = getThemePref();
    document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('theme-opt-' + th);
    if (el) el.classList.add('active');
}

export function toggleTheme() {
    const c = getThemePref();
    const next = c === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hostel-theme', next);
    applyTheme(next);
    updateThemeOptions();
}

export function setThemeOption(th) {
    localStorage.setItem('hostel-theme', th);
    applyTheme(th);
    updateThemeOptions();
}

export function openSettings() {
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.getElementById('s-currency').value = (window._settings || {}).currency || 'PLN';
    document.getElementById('s-lang').value = (window._settings || {}).lang || 'PL';
    previewCurrency(); renderFieldManager(); updateThemeOptions(); renderMembers();
}

export function closeSettings() { document.getElementById('settings-overlay').classList.add('hidden'); }

export function previewCurrency() {
    const { CURRENCIES } = window._CURRENCIES ? { CURRENCIES: window._CURRENCIES } : { CURRENCIES: { PLN: { symbolU: 'zł' }, EUR: { symbolU: '€' }, USD: { symbolU: '$' } } };
    const val = document.getElementById('s-currency').value;
    const c = (window._CURRENCIES || { PLN: { symbolU: 'zł' }, EUR: { symbolU: '€' }, USD: { symbolU: '$' } })[val];
    document.getElementById('currency-preview').textContent = '600.00 ' + (c ? c.symbolU : '');
}

export function applyLangImmediate(lang) {
    window._settings = Object.assign({}, window._settings || {}, { lang: lang });
    const htmlLangMap = { RU: 'ru', PL: 'pl', UA: 'uk', EN: 'en', LT: 'lt' };
    const htmlLang = htmlLangMap[lang] || 'pl';
    document.documentElement.lang = htmlLang;
    // Update lang attribute on all date inputs so browser placeholder updates
    document.querySelectorAll('input[type="date"]').forEach(el => {
        el.setAttribute('lang', htmlLang);
        // Force re-render by toggling type
        const val = el.value;
        el.type = 'text';
        el.type = 'date';
        el.value = val;
    });
    if (window.updateUI) window.updateUI();
}

export function confirmExitOverlay(type) {
    const msgs = { settings: t('exitSettings'), props: t('exitProps'), resident: t('exitResident'), report: t('exitReport') };
    const closeFns = { settings: closeSettings, props: closePropForm, resident: closeForm, report: closeReport };
    showConfirm('❓', '', msgs[type] || '', t('confirmYes'), 'c-ok', () => { closeFns[type](); });
}

export async function saveSettings() {
    try {
        await window._fb.setDoc(window._fb.settingsDoc, {
            currency: document.getElementById('s-currency').value,
            lang: document.getElementById('s-lang').value
        });
        closeSettings();
        if (window.updateUI) window.updateUI();
        if (window.render) window.render();
    } catch (e) { alert('Error: ' + e.message); }
}

export function renderFieldManager() {
    const all = residents();
    const cities = [...new Set(all.map(r => r.city).filter(Boolean))].sort();
    const addrs = [...new Set(all.map(r => r.address).filter(Boolean))].sort();
    const el = document.getElementById('field-manager');
    let h = '<div class="fm-label">' + t('city') + '</div>';
    h += cities.length ? cities.map(c => '<span class="fm-tag">' + esc(c) + ' <button onclick="deleteFieldValue(\'city\',\'' + c.replace(/'/g, "\\'") + '\')">×</button></span>').join('') : '<span style="font-size:11px;color:#4a4a5a">—</span>';
    h += '<div class="fm-label">' + t('addr') + '</div>';
    h += addrs.length ? addrs.map(a => '<span class="fm-tag">' + esc(a) + ' <button onclick="deleteFieldValue(\'address\',\'' + a.replace(/'/g, "\\'") + '\')">×</button></span>').join('') : '<span style="font-size:11px;color:#4a4a5a">—</span>';
    el.innerHTML = h;
}

export function deleteFieldValue(field, value) {
    const activeRes = residents().filter(r => !r.checkOutDate && r[field] === value);
    if (activeRes.length > 0) {
        const el = document.createElement('div');
        el.className = 'confirm-overlay';
        el.innerHTML = '<div class="confirm-box"><div class="confirm-icon">⚠️</div><div class="confirm-title">' + t('propHasResidents') + '</div><div class="confirm-msg">' + activeRes.length + ' ' + t('residents').toLowerCase() + ': ' + activeRes.map(r => resName(r)).join(', ') + '</div><div class="confirm-btns"><button class="c-ok" style="flex:none;padding:10px 40px">OK</button></div></div>';
        document.body.appendChild(el);
        el.querySelector('button').onclick = () => el.remove();
        el.onclick = (e) => { if (e.target === el) el.remove(); };
        return;
    }
    showConfirm('🗑', t('confirmDelete'), '"' + value + '" — ' + t('confirmDeleteMsg'), t('confirmYes'), 'c-danger', async () => {
        const fb = window._fb;
        const { resDoc, cleanForFirebase } = await import('./utils.js');
        for (const r of residents().filter(x => x[field] === value)) {
            const data = cleanForFirebase(r); data[field] = '';
            await fb.setDoc(resDoc(r.id), data);
        }
        renderFieldManager();
    });
}

export function renderMembers() {
    const members = window._members || [];
    const section = document.getElementById('members-section');
    const isOwner = !window._workspaceUid || window._workspaceUid === window._currentUser?.uid;
    if (isOwner) {
        section.style.display = 'block';
    } else if (!members.length) {
        section.style.display = 'none'; return;
    } else {
        section.style.display = 'block';
    }
    const list = document.getElementById('members-list');
    if (!members.length) {
        list.innerHTML = '<div style="font-size:12px;color:var(--text4);padding:4px 0">' + t('noMembers') + '</div>';
        return;
    }
    list.innerHTML = members.map(m => {
        const date = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface);border-radius:8px;margin-bottom:4px">' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.name || m.email || '?') + '</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + esc(m.email || '') + ' · ' + date + '</div>' +
            '</div>' +
            (isOwner ? '<button class="btn-sm danger" onclick="removeMember(\'' + m.id + '\')" title="' + t('confirmDelete') + '">✕</button>' : '') +
            '</div>';
    }).join('');
}

export function removeMember(memberId) {
    showConfirm('👤', t('confirmDelete'), t('confirmDeleteMsg'), t('confirmYes'), 'c-danger', async () => {
        try {
            const ownerUid = window._workspaceUid || window._currentUser.uid;
            const member = (window._members || []).find(m => m.id === memberId);
            if (member) {
                await window._fb.setDoc(window._fb.doc(window._fb.db, 'users', ownerUid, 'members', memberId), {
                    removed: true, removedAt: new Date().toISOString()
                }, { merge: true });
            }
            await window._fb.deleteDoc(window._fb.doc(window._fb.db, 'users', ownerUid, 'members', memberId));
            await window._fb.setDoc(window._fb.doc(window._fb.db, 'users', ownerUid, 'blocked', memberId), {
                email: member?.email || '', removedAt: new Date().toISOString()
            });
            renderMembers();
        } catch (e) { console.error('Remove member error:', e); }
    });
}

export function inviteUser() {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.innerHTML = '<div class="confirm-box" style="text-align:left">' +
        '<div style="text-align:center"><div class="confirm-icon">👤+</div><div class="confirm-title">' + t('inviteTitle') + '</div></div>' +
        '<div class="confirm-msg" style="text-align:center">' + t('inviteMsg') + '</div>' +
        '<input class="auth-field" type="email" id="invite-email" placeholder="Email" style="text-align:left;margin-bottom:8px">' +
        '<div id="invite-status" style="font-size:12px;min-height:18px;margin-bottom:8px"></div>' +
        '<div class="confirm-btns">' +
        '<button class="c-cancel" id="inv-cancel">' + t('confirmNo') + '</button>' +
        '<button class="c-ok" id="inv-send">' + t('inviteSend') + '</button>' +
        '</div></div>';
    document.body.appendChild(el);
    el.querySelector('#inv-cancel').onclick = () => el.remove();
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    el.querySelector('#inv-send').onclick = async () => {
        const email = el.querySelector('#invite-email').value.trim();
        const status = el.querySelector('#invite-status');
        if (!email) { status.textContent = '❌ Email!'; status.style.color = 'var(--red)'; return; }
        const uid = window._workspaceUid || window._currentUser.uid;
        const link = window.location.origin + '?invite=' + uid;
        try { await navigator.clipboard.writeText(link); } catch (e) { }
        status.innerHTML = '✅ ' + t('inviteCopied') + '<br><code style="font-size:10px;word-break:break-all;color:var(--accent)">' + link + '</code>';
        status.style.color = 'var(--green)';
        el.querySelector('#inv-send').style.display = 'none';
    };
    el.querySelector('#invite-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('#inv-send').click(); });
}

export function initTheme() {
    applyTheme(getThemePref());
    window.matchMedia('(prefers-color-scheme:light)').addEventListener('change', () => {
        if (getThemePref() === 'auto') applyTheme('auto');
    });
}

// Track mousedown for overlay clicks
export function initMouseTrack() {
    document.addEventListener('mousedown', function (e) { window._mouseDownTarget = e.target; });
}
