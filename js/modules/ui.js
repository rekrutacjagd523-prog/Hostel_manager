// ===== UI RENDER MODULE =====
import { t, HTYPES } from './constants.js';
import { residents, properties, cur, fmtUi, todayStr, esc, daysBetween, daysLabel } from './utils.js';
import { calcCurrentPayment, buildRateHistory } from './rate-history.js';
import { renderProperties } from './properties.js';
import { selectMode, selectedIds } from './residents.js';

export let currentFilter = 'active';
export let pageSize = 10;
export let currentPage = 1;
export let groupByProp = false;

export function setCurrentFilter(f) { currentFilter = f; }
export function setCurrentPage(p) { currentPage = p; }

export function setFilter(f, btn) {
    currentFilter = f; currentPage = 1;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._currentFilter = f;
    render();
}

export function goPage(p) { currentPage = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
export function changePageSize(v) { pageSize = parseInt(v); currentPage = 1; render(); }

export function toggleGroupByProp() {
    groupByProp = !groupByProp;
    const cb = document.getElementById('ff-group-prop');
    if (cb) cb.checked = groupByProp;
    render();
}

let activeFilterType = null;
export function setFilterType(type) {
    const types = ['name', 'type', 'prop', 'group'];
    activeFilterType = (activeFilterType === type) ? null : type;
    // If activating group filter - sync groupByProp state
    if (activeFilterType === 'group') {
        // just show the panel
    } else if (type === 'group' && activeFilterType === null) {
        // deactivated group - reset groupByProp view
        groupByProp = false;
        const cb = document.getElementById('ff-group-prop');
        if (cb) cb.checked = false;
        render();
    }
    types.forEach(t => {
        const btn = document.getElementById('ftype-' + t);
        const panel = document.getElementById('ftype-panel-' + t);
        const isActive = activeFilterType === t;
        if (btn) {
            btn.style.background = isActive ? 'var(--accent)' : '';
            btn.style.color = isActive ? '#fff' : '';
            btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border3)';
        }
        if (panel) panel.style.display = isActive ? 'block' : 'none';
    });
    if (activeFilterType && activeFilterType !== 'group') render();
}

export function clearFilters() {
    // Reset active filter
    activeFilterType = null;
    const types = ['name', 'type', 'prop', 'group'];
    types.forEach(t => {
        const btn = document.getElementById('ftype-' + t);
        const panel = document.getElementById('ftype-panel-' + t);
        if (btn) { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = 'var(--border3)'; }
        if (panel) panel.style.display = 'none';
    });
    // Reset field values
    const nm = document.getElementById('ff-name'); if (nm) nm.value = '';
    const ct = document.getElementById('ff-city'); if (ct) ct.value = '';
    const ad = document.getElementById('ff-addr'); if (ad) ad.value = '';
    // Reset type checkboxes
    document.querySelectorAll('#ff-types input[type=checkbox]').forEach(cb => cb.checked = true);
    // Reset group
    groupByProp = false;
    const gb = document.getElementById('ff-group-prop'); if (gb) gb.checked = false;
    render();
}

function daysBetweenDates(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function renderCheckoutForecast() {
    const block = document.getElementById('forecast-block');
    if (!block) return;
    const today = todayStr();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const upcoming = residents()
        .filter(r => !r.checkOutDate && r.plannedCheckOut && r.plannedCheckOut >= today && r.plannedCheckOut <= cutoffStr)
        .sort((a, b) => a.plannedCheckOut.localeCompare(b.plannedCheckOut));
    if (!upcoming.length) { block.style.display = 'none'; return; }
    block.style.display = 'block';
    const urgentColor = d => d <= 3 ? 'var(--red)' : d <= 7 ? '#f59e0b' : 'var(--text3)';
    block.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border3);border-radius:12px;padding:12px 16px;">
            <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:8px">${t('checkoutSoon')} (${upcoming.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${upcoming.map(r => {
        const days = daysBetweenDates(today, r.plannedCheckOut);
        const name = (r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '');
        return `<div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border-radius:8px;padding:6px 10px;font-size:12px">
                        <span>${esc(name)}</span>
                        <span style="font-weight:700;color:${urgentColor(days)}">${days} ${t('forecastDays')}</span>
                        <button onclick="editResident('${r.id}')" style="background:none;border:none;cursor:pointer;padding:0;font-size:12px;color:var(--text3)">✏️</button>
                    </div>`;
    }).join('')}
            </div>
        </div>`;
}

function renderGrouped() {
    const list = document.getElementById('residents-list');
    const pgBar = document.getElementById('pagination-bar');
    pgBar.innerHTML = '';
    const active = residents().filter(r => !r.checkOutDate);
    // Group by city+address
    const groups = {};
    active.forEach(r => {
        const key = (r.city || '') + '||' + (r.address || '');
        if (!groups[key]) groups[key] = { city: r.city, address: r.address, items: [] };
        groups[key].items.push(r);
    });
    const keys = Object.keys(groups);
    if (!keys.length) { list.innerHTML = '<div class=\"empty\">👥<br><br>' + t('noData') + '</div>'; return; }
    let h = '';
    keys.forEach(key => {
        const g = groups[key];
        const total = g.items.reduce((s, r) => s + calcCurrentPayment(r), 0);
        const propLabel = (g.city || '') + (g.address ? ' · ' + g.address : '') || '—';
        const gid = 'grp-' + key.replace(/[^a-z0-9]/gi, '_');
        h += `<div style=\"background:var(--surface);border:1px solid var(--border3);border-radius:12px;margin-bottom:10px;overflow:hidden\">`;
        h += `<div onclick=\"document.getElementById('${gid}').classList.toggle('collapsed')\" style=\"display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;user-select:none\">`;
        h += `<div><div style=\"font-size:13px;font-weight:700\">${esc(propLabel)}</div><div style=\"font-size:11px;color:var(--text3)\">${g.items.length} ${t('residents').toLowerCase()}</div></div>`;
        h += `<div style=\"text-align:right\"><div style=\"font-size:14px;font-weight:700;color:var(--accent)\">${fmtUi(total)}</div><div style=\"font-size:11px;color:var(--text3)\">${t('propTotal')}</div></div>`;
        h += `</div>`;
        h += `<div id=\"${gid}\" style=\"border-top:1px solid var(--border3)\">`;
        g.items.forEach(r => {
            const pay = calcCurrentPayment(r);
            const name = (r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '');
            h += `<div class=\"longpress-card\" data-id=\"${r.id}\" style=\"display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border2);${selectMode ? 'cursor:pointer' : ''}\" ${selectMode ? `onclick="if(event.target.type!=='checkbox'){const cb=this.querySelector('.sel-check');if(cb){cb.checked=!cb.checked;toggleSelectItem('${r.id}',cb);}}"` : ''}>`;
            if (selectMode) h += `<input type="checkbox" class="sel-check item-check" data-id="${r.id}" ${selectedIds.has(r.id) ? 'checked' : ''} onchange="toggleSelectItem('${r.id}',this)" style="margin-right:8px;flex-shrink:0">`;
            h += `<div style=\"display:flex;align-items:center;gap:6px;font-size:13px\">${r.isSenior ? '<span style=\"color:#f59e0b\">⭐</span>' : ''}<span>${esc(name)}</span>${r.plannedCheckOut ? '<span style=\"font-size:11px;color:var(--accent)\">🚪 ' + (window.fmtDate ? window.fmtDate(r.plannedCheckOut) : r.plannedCheckOut) + '</span>' : ''}</div>`;
            h += `<div style=\"display:flex;align-items:center;gap:10px\" onclick=\"event.stopPropagation()\"><span style=\"font-weight:700;font-size:13px\">${fmtUi(pay)}</span><button class=\"btn-sm\" onclick=\"editResident('${r.id}')\">${r.isSenior ? '⭐' : '✏️'}</button><button class=\"btn-sm warn\" onclick=\"checkOut('${r.id}')\">↪</button></div>`;
            h += `</div>`;
        });
        h += `</div></div>`;
    });
    list.innerHTML = h;
}


export function render() {
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
    renderCheckoutForecast();
    if (groupByProp) { renderGrouped(); renderProperties(); return; }
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
        list.innerHTML = '<div class="empty">👥<br><br>' + t('noData') + '</div>';
        document.getElementById('pagination-bar').innerHTML = '';
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
        const resNameVal = (r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '');
        return '<div class="card longpress-card' + (isA ? '' : ' inactive') + '" data-id="' + r.id + '" style="display:flex;align-items:flex-start;gap:8px;' + (selectMode ? 'cursor:pointer' : '') + '" ' + (selectMode ? 'onclick="if(event.target.type!==\'checkbox\'){const cb=this.querySelector(\'.sel-check\');if(cb){cb.checked=!cb.checked;toggleSelectItem(\'' + r.id + '\',cb);}}" ' : '') + '>' + (selectMode ? '<input type="checkbox" class="sel-check item-check" data-id="' + r.id + '" ' + (selectedIds.has(r.id) ? 'checked' : '') + ' onchange="toggleSelectItem(\'' + r.id + '\',this)" style="margin-top:4px;flex-shrink:0">' : '') + '<div style="flex:1"><div class="card-top"><div>' +
            '<div class="card-name">' + (r.isSenior ? '<span style="color:#f59e0b;margin-right:4px" title="' + t('seniorRole') + '">⭐</span>' : '') + esc(resNameVal) + '</div>' +
            '<div class="card-meta">' + (r.city ? esc(r.city) : '') + (r.address ? ' · ' + esc(r.address) : '') + '</div>' +
            '</div><div class="card-payment"><div class="card-amount">' + fmtUi(pay) + '</div>' +
            '<div class="card-amount-label">' + t('topay') + '</div></div></div>' +
            '<div class="card-bottom"><div class="card-tags">' +
            '<span class="tag">' + (window.fmtDate ? window.fmtDate(r.checkInDate) : r.checkInDate) + (r.checkOutDate ? ' → ' + (window.fmtDate ? window.fmtDate(r.checkOutDate) : r.checkOutDate) : '') + '</span>' +
            '<span class="tag' + (isA ? ' days-active' : '') + '">' + daysLabel(r) + '</span>' +
            '<span class="tag">' + fmtUi(r.monthlyRate) + '/' + t('rate').split('/')[1] + '</span>' +
            (hasMulti ? '<span class="tag multi-rate">' + history.length + ' ' + t('rateCount') + '</span>' : '') +
            (r.plannedCheckOut && isA ? '<span class="tag" style="color:var(--accent);border-color:var(--accent)">🚪 ' + (window.fmtDate ? window.fmtDate(r.plannedCheckOut) : r.plannedCheckOut) + '</span>' : '') +
            '<span class="tag type">' + t(r.housingType || 'hostel') + '</span>' +
            '</div><div class="card-actions" onclick="event.stopPropagation()">' +
            (hasMulti ? '<button class="btn-sm info" onclick="showHistory(\'' + r.id + '\')" title="' + t('rateHist') + '">📋</button>' : '') +
            '<button class="btn-sm" onclick="editResident(\'' + r.id + '\')">' + (r.isSenior ? '⭐' : '✏️') + '</button>' +
            (isA ? '<button class="btn-sm warn" onclick="checkOut(\'' + r.id + '\')">' + '↪' + '</button>' : '') +
            '<button class="btn-sm danger" onclick="deleteResident(\'' + r.id + '\')">🗑</button>' +
            '</div></div></div></div>';
    }).join('');


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
    document.getElementById('tab-filter').textContent = t('filter');
    document.getElementById('lbl-search').textContent = t('searchName');
    document.getElementById('lbl-city').textContent = t('city');
    document.getElementById('lbl-addr').textContent = t('addr');
    document.getElementById('lbl-htype').textContent = t('htype');
    document.getElementById('lbl-fname').textContent = t('fname');
    document.getElementById('lbl-lname').textContent = t('lname');
    document.getElementById('lbl-ftype').textContent = t('htype');
    document.getElementById('lbl-fcheckin').textContent = t('checkin');
    document.getElementById('lbl-frate').textContent = t('rate');
    const poEl = document.getElementById('lbl-planned-out'); if (poEl) poEl.textContent = t('plannedOut');
    const srEl = document.getElementById('lbl-senior'); if (srEl) srEl.textContent = '⭐ ' + t('seniorRole').replace('⭐ ', '');
    const gpEl = document.getElementById('lbl-group-prop'); if (gpEl) gpEl.textContent = '🏢 ' + t('groupByProp');
    const fn = document.getElementById('lbl-ftype-name'); if (fn) fn.textContent = t('ftypeName');
    const ft = document.getElementById('lbl-ftype-type'); if (ft) ft.textContent = t('ftypeType');
    const fp = document.getElementById('lbl-ftype-prop'); if (fp) fp.textContent = t('ftypeProp');
    const fg = document.getElementById('lbl-ftype-group'); if (fg) fg.textContent = t('ftypeGroup');
    const fc = document.getElementById('lbl-clear-filters'); if (fc) fc.textContent = t('clearFilters');
    document.getElementById('lbl-rate-change').textContent = t('rateChange');
    document.getElementById('f-rate-new').placeholder = t('newRate');
    document.getElementById('btn-fcancel').textContent = t('cancel');
    document.getElementById('btn-fsave').textContent = t('accept');
    document.getElementById('btn-report').textContent = t('report');
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
    document.getElementById('btn-del-sel').textContent = t('deleteSelected');
    document.getElementById('btn-co-sel').textContent = t('checkoutSel');
    document.getElementById('lbl-sel-prop').textContent = t('selProps');
    document.getElementById('lbl-sel-res').textContent = t('selRes');
    const memEl = document.getElementById('lbl-members');
    const memHidden = document.getElementById('members-list').classList.contains('rpt-hidden');
    memEl.innerHTML = '👥 ' + t('members') + ' <span style="font-size:11px;color:var(--text4)">' + (memHidden ? '▶' : '▼') + '</span>';
    document.getElementById('lbl-report').textContent = t('report');
    document.getElementById('pb-all').textContent = t('allTime');
    document.getElementById('pb-week').textContent = t('week');
    document.getElementById('pb-month').textContent = t('month');
    document.getElementById('pb-year').textContent = t('year');
    document.getElementById('pb-custom').textContent = t('custom');
    document.getElementById('btn-rclose').textContent = t('cancel');
    document.getElementById('btn-scancel').textContent = t('cancel');
    document.getElementById('btn-ssave').textContent = t('accept');
    document.getElementById('btn-add').textContent = t('addBtn');
    document.getElementById('lbl-theme').textContent = t('theme');
    document.getElementById('um-switch').textContent = t('switchAcc');
    document.getElementById('um-logout').textContent = t('logout');
    document.getElementById('lbl-properties').textContent = t('properties');
    document.getElementById('lbl-residents-section').textContent = t('residents');
    document.getElementById('btn-add-prop').textContent = t('addProp');
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
