// ===== UI RENDER MODULE =====
import { t, HTYPES } from './constants.js';
import { residents, properties, cur, fmtUi, todayStr, esc, daysBetween, daysLabel } from './utils.js';
import { calcCurrentPayment, buildRateHistory } from './rate-history.js';
import { renderProperties } from './properties.js';
import { selectMode, selectedIds } from './residents.js';

export let currentFilter = 'active';
export let pageSize = 10;
export let currentPage = 1;

export function setCurrentFilter(f) { currentFilter = f; }
export function setCurrentPage(p) { currentPage = p; }

// Generate a consistent color from a string (for avatar backgrounds)
function avatarColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

export function setFilter(f, btn) {
    currentFilter = f; currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._currentFilter = f;
    render();
}

export function goPage(p) { currentPage = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
export function changePageSize(v) { pageSize = parseInt(v); currentPage = 1; render(); }

export function render() {
    // Onboarding: show wizard on first login when workspace is empty
    if (window._resLoaded && window._propsLoaded && !window._onboardingDone) {
        window._onboardingDone = true;
        const seenStr = 'hostel-onboarding-' + (window._workspaceUid || 'local');
        if (properties().length === 0 && residents().length === 0 && !localStorage.getItem(seenStr)) {
            const overlay = document.getElementById('onboarding-overlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                localStorage.setItem(seenStr, '1');
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    const c = cur();
    document.getElementById('stat-currency-icon').textContent = c.symbolU;
    const all = residents();
    const cities = [...new Set(all.map(r => r.city).filter(Boolean))].sort();
    const addrs = [...new Set(all.map(r => r.address).filter(Boolean))].sort();
    document.getElementById('dl-city').innerHTML = cities.map(c => '<option value="' + esc(c) + '">').join('');
    document.getElementById('dl-addr').innerHTML = addrs.map(a => '<option value="' + esc(a) + '">').join('');
    const fcEl = document.getElementById('ff-city'), fv = fcEl.value;
    fcEl.innerHTML = '<option value="">—</option>' + cities.map(c => '<option>' + esc(c) + '</option>').join(''); fcEl.value = fv;
    const faEl = document.getElementById('ff-addr'), av = faEl.value;
    faEl.innerHTML = '<option value="">—</option>' + addrs.map(a => '<option>' + esc(a) + '</option>').join(''); faEl.value = av;
    const ftEl = document.getElementById('ff-types');
    if (!ftEl.children.length) ftEl.innerHTML = HTYPES.map(h => '<label class="fp-check"><input type="checkbox" checked onchange="render()" data-ht="' + h + '"> ' + t(h) + '</label>').join('');
    else ftEl.querySelectorAll('.fp-check').forEach((e, i) => { e.lastChild.textContent = ' ' + t(HTYPES[i]); });
    const checkedTypes = []; ftEl.querySelectorAll('input:checked').forEach(i => checkedTypes.push(i.dataset.ht));
    const active = all.filter(r => !r.checkOutDate);
    document.getElementById('stat-active').textContent = active.length;
    document.getElementById('stat-total').textContent = all.length;
    const totalOwed = active.reduce((s, r) => s + calcCurrentPayment(r), 0);
    document.getElementById('stat-owed').textContent = fmtUi(totalOwed);
    const filtered = all.filter(r => {
        if (currentFilter === 'active') return !r.checkOutDate;
        if (currentFilter === 'checkedOut') return !!r.checkOutDate;
        return true;
    }).filter(r => {
        if (fcEl.value && r.city !== fcEl.value) return false;
        if (faEl.value && r.address !== faEl.value) return false;
        if (!checkedTypes.includes(r.housingType || 'hostel')) return false;
        const nameQ = (document.getElementById('ff-name').value || '').toLowerCase().trim();
        if (nameQ) {
            const full = ((r.firstName || '') + ' ' + (r.lastName || '')).toLowerCase();
            if (!full.includes(nameQ)) return false;
        }
        return true;
    });
    const list = document.getElementById('residents-list');
    if (!filtered.length) {
        const isFiltered = fcEl.value || faEl.value || document.getElementById('ff-name').value;
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="users" style="width:48px;height:48px;opacity:0.5"></i></div>' +
            '<div class="empty-state-title">' + t('noData') + '</div>' +
            '<div class="empty-state-desc">' + (currentFilter === 'active' && !isFiltered ? 'Dodaj pierwszego lokatora, aby rozpocząć zarządzanie.' : 'Brak danych spełniających kryteria.') + '</div>' +
            (currentFilter === 'active' && !isFiltered ? '<button class="btn btn-primary" onclick="openForm()" style="margin:0 auto"><i data-lucide="user-plus" style="width:14px;height:14px"></i> ' + t('addBtn') + '</button>' : '') +
            '</div>';
        document.getElementById('pagination-bar').innerHTML = '';
        if (window.lucide) window.lucide.createIcons();
        renderProperties(); return;
    }
    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const startIdx = (currentPage - 1) * pageSize;
    const paged = filtered.slice(startIdx, startIdx + pageSize);
    list.innerHTML = paged.map(r => {
        const isA = !r.checkOutDate;
        const pay = calcCurrentPayment(r);
        const history = buildRateHistory(r);
        const hasMulti = history.length > 1;
        const nameStr = (r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '');
        const initial = (r.firstName || r.fullName || r.lastName || '?')[0].toUpperCase();
        const bg = avatarColor(nameStr || r.id);
        return '<div class="card fade-in' + (isA ? '' : ' inactive') + '" style="display:flex;align-items:flex-start;gap:12px">' +
            (selectMode ? '<input type="checkbox" class="sel-check item-check" data-id="' + r.id + '" ' + (selectedIds.has(r.id) ? 'checked' : '') + ' onchange="toggleSelectItem(\'' + r.id + '\',this)" style="margin-top:10px;flex-shrink:0">' : '') +
            '<div class="avatar" style="background:' + bg + ';margin-top:2px">' + esc(initial) + '</div>' +
            '<div style="flex:1;min-width:0"><div class="card-top"><div>' +
            '<div class="card-name">' + esc(nameStr) + '</div>' +
            '<div class="card-meta">' + (r.city ? esc(r.city) : '') + (r.address ? ' · ' + esc(r.address) : '') + '</div>' +
            '</div><div class="card-payment"><div class="card-amount">' + fmtUi(pay) + '</div>' +
            '<div class="card-amount-label">' + t('topay') + '</div></div></div>' +
            '<div class="card-bottom"><div class="card-tags">' +
            '<span class="tag">' + (window.fmtDate ? window.fmtDate(r.checkInDate) : r.checkInDate) + (r.checkOutDate ? ' → ' + (window.fmtDate ? window.fmtDate(r.checkOutDate) : r.checkOutDate) : '') + '</span>' +
            '<span class="tag' + (isA ? ' days-active' : '') + '">' + daysLabel(r) + '</span>' +
            '<span class="tag">' + fmtUi(r.monthlyRate) + '/' + t('rate').split('/')[1] + '</span>' +
            (hasMulti ? '<span class="tag multi-rate">' + history.length + ' ' + t('rateCount') + '</span>' : '') +
            '<span class="tag type">' + t(r.housingType || 'hostel') + '</span>' +
            '</div><div class="card-actions">' +
            (hasMulti ? '<button class="btn-sm info" onclick="showHistory(\'' + r.id + '\')" title="' + t('rateHist') + '"><i data-lucide="clipboard-list" style="width:14px;height:14px"></i></button>' : '') +
            '<button class="btn-sm" onclick="editResident(\'' + r.id + '\')"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>' +
            (isA ? '<button class="btn-sm warn" onclick="checkOut(\'' + r.id + '\')"><i data-lucide="log-out" style="width:14px;height:14px"></i></button>' : '') +
            '<button class="btn-sm danger" onclick="deleteResident(\'' + r.id + '\')"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>' +
            '</div></div></div></div>';
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Render pagination bar
    const pgBar = document.getElementById('pagination-bar');
    if (totalPages <= 1 && totalItems <= 10) { pgBar.innerHTML = ''; renderProperties(); return; }
    let pg = '';
    if (totalPages > 1) {
        pg += '<button class="pg-btn" onclick="goPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>&lsaquo;</button>';
        let start = Math.max(1, currentPage - 2), end = Math.min(totalPages, currentPage + 2);
        if (start > 1) { pg += '<button class="pg-btn" onclick="goPage(1)">1</button>'; if (start > 2) pg += '<span class="pg-dots">…</span>'; }
        for (let i = start; i <= end; i++) { pg += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" onclick="goPage(' + i + ')">' + i + '</button>'; }
        if (end < totalPages) { if (end < totalPages - 1) pg += '<span class="pg-dots">…</span>'; pg += '<button class="pg-btn" onclick="goPage(' + totalPages + ')">' + totalPages + '</button>'; }
        pg += '<button class="pg-btn" onclick="goPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
    }
    pg += '<span class="pg-info">' + (startIdx + 1) + '–' + Math.min(startIdx + pageSize, totalItems) + ' / ' + totalItems + '</span>';
    pg += '<select class="pg-select" onchange="changePageSize(this.value)">';
    [10, 50, 100].forEach(n => { pg += '<option value="' + n + '"' + (pageSize === n ? ' selected' : '') + '>' + n + '</option>'; });
    pg += '</select>';
    pgBar.innerHTML = pg;
    renderProperties();
}

export function updateUI() {
    document.getElementById('hdr-sub').textContent = t('sub');
    document.getElementById('lbl-residents').textContent = t('residents');
    document.getElementById('lbl-owed').textContent = t('owed');
    document.getElementById('lbl-total').textContent = t('total');
    document.getElementById('tab-active').textContent = t('active');
    document.getElementById('tab-out').textContent = t('out');
    document.getElementById('tab-all').textContent = t('all');
    document.getElementById('lbl-search').textContent = t('searchName');
    document.getElementById('lbl-city').textContent = t('city');
    document.getElementById('lbl-addr').textContent = t('addr');
    document.getElementById('lbl-htype').textContent = t('htype');
    document.getElementById('lbl-fname').textContent = t('fname');
    document.getElementById('lbl-lname').textContent = t('lname');
    document.getElementById('lbl-ftype').textContent = t('htype');
    document.getElementById('lbl-fcheckin').textContent = t('checkin');
    document.getElementById('lbl-frate').textContent = t('rate');
    document.getElementById('lbl-rate-change').textContent = t('rateChange');
    document.getElementById('f-rate-new').placeholder = t('newRate');
    document.getElementById('btn-fcancel').textContent = t('cancel');
    document.getElementById('btn-fsave').textContent = t('accept');
    const btnReport = document.getElementById('btn-report-lbl');
    if (btnReport) btnReport.textContent = t('report');
    document.getElementById('lbl-settings').textContent = t('settings');
    document.getElementById('lbl-currency').textContent = t('currency');
    document.getElementById('lbl-example').textContent = t('example');
    const fmEl = document.getElementById('lbl-fieldmgr');
    const isHidden = document.getElementById('field-manager').classList.contains('rpt-hidden');
    fmEl.innerHTML = t('fieldmgr') + ' <span style="font-size:11px;color:var(--text4)">' + (isHidden ? '▶' : '▼') + '</span>';
    document.getElementById('lbl-data').textContent = t('dataLabel');
    document.getElementById('btn-import').textContent = t('importCSV');
    document.getElementById('btn-invite').textContent = t('inviteBtn');
    document.getElementById('lbl-sel-all').textContent = t('selectAll');
    document.getElementById('lbl-sel-prop').textContent = t('selProps');
    document.getElementById('lbl-sel-res').textContent = t('selRes');
    const memEl = document.getElementById('lbl-members');
    const memHidden = document.getElementById('members-list').classList.contains('rpt-hidden');
    memEl.innerHTML = t('members') + ' <span style="font-size:11px;color:var(--text4)">' + (memHidden ? '▶' : '▼') + '</span>';
    document.getElementById('pb-all').textContent = t('allTime');
    document.getElementById('pb-week').textContent = t('week');
    document.getElementById('pb-month').textContent = t('month');
    document.getElementById('pb-year').textContent = t('year');
    document.getElementById('pb-custom').textContent = t('custom');
    document.getElementById('btn-rclose').textContent = t('cancel');
    document.getElementById('btn-scancel').textContent = t('cancel');
    document.getElementById('btn-ssave').textContent = t('accept');
    const btnAdd = document.getElementById('btn-add-lbl');
    if (btnAdd) btnAdd.textContent = t('addBtn');
    document.getElementById('lbl-theme').textContent = t('theme');
    document.getElementById('um-switch').textContent = t('switchAcc');
    document.getElementById('um-logout').textContent = t('logout');
    document.getElementById('lbl-properties').textContent = t('properties');
    document.getElementById('lbl-residents-section').textContent = t('residents');
    document.getElementById('lbl-select-prop').textContent = t('selectProp');
    document.getElementById('lbl-prop-city').textContent = t('city');
    document.getElementById('lbl-prop-addr').textContent = t('addr');
    document.getElementById('lbl-prop-type').textContent = t('htype');
    document.getElementById('opt-hostel').textContent = t('hostel');
    document.getElementById('opt-apartment').textContent = t('apartment');
    document.getElementById('opt-house').textContent = t('house');
    document.getElementById('opt-room').textContent = t('room');
    document.getElementById('lbl-prop-spots').textContent = t('spots');
    document.getElementById('btn-prop-cancel').textContent = t('cancel');
    document.getElementById('btn-prop-save').textContent = t('accept');
    document.getElementById('btn-generate').textContent = t('generate');
    const opts = document.querySelectorAll('#f-type option');
    HTYPES.forEach((h, i) => { if (opts[i]) opts[i].textContent = t(h); });
    if (window.lucide) window.lucide.createIcons();
    render();
}

export function toggleSection(section) {
    const key = 'hostel-collapsed-' + section;
    if (section === 'props') {
        const el = document.getElementById('prop-list');
        const title = document.getElementById('prop-section-title');
        const toggle = document.getElementById('toggle-props');
        el.classList.toggle('collapsed');
        title.classList.toggle('collapsed');
        toggle.textContent = el.classList.contains('collapsed') ? '▶' : '▼';
        localStorage.setItem(key, el.classList.contains('collapsed') ? '1' : '0');
    } else if (section === 'residents') {
        const el = document.getElementById('residents-section');
        const toggle = document.getElementById('toggle-residents');
        el.classList.toggle('collapsed');
        toggle.textContent = el.classList.contains('collapsed') ? '▶' : '▼';
        localStorage.setItem(key, el.classList.contains('collapsed') ? '1' : '0');
    }
}

export function restoreCollapsed() {
    if (localStorage.getItem('hostel-collapsed-props') === '1') {
        document.getElementById('prop-list').classList.add('collapsed');
        document.getElementById('prop-section-title').classList.add('collapsed');
        document.getElementById('toggle-props').textContent = '▶';
    }
    if (localStorage.getItem('hostel-collapsed-residents') === '1') {
        document.getElementById('residents-section').classList.add('collapsed');
        document.getElementById('toggle-residents').textContent = '▶';
    }
}
