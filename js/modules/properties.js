// ===== PROPERTIES MODULE =====
import { t } from './constants.js';
import { properties, residents, esc, genId, todayStr, showConfirm, propDoc } from './utils.js';
import { getFreeSpots } from './residents.js';

export let propSelectMode = false;
export let selectedPropIds = new Set();
export let propPage = 1;
export let propPageSize = 10;

export function goPropPage(p) { propPage = p; renderProperties(); }
export function changePropPageSize(v) { propPageSize = parseInt(v); propPage = 1; renderProperties(); }

function getResidentsOnProp(p) {
    return residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && (r.housingType || 'hostel') === p.housingType);
}

export function renderProperties() {
    const list = document.getElementById('prop-list');
    const props = properties();
    if (!props.length) { list.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text4);font-size:13px">' + t('noProps') + '</div>'; return; }
    let h = '';
    if (propSelectMode) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;margin-bottom:4px">' +
            '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--text2)"><input type="checkbox" class="sel-check" id="sel-all-props" onchange="toggleSelectAllProps()" ' + (selectedPropIds.size === props.length ? 'checked' : '') + '> ' + t('selectAll') + '</label>' +
            '<span style="font-size:12px;color:var(--accent);font-weight:700">' + (selectedPropIds.size > 0 ? selectedPropIds.size + ' ' + t('selected') : '') + '</span>' +
            (selectedPropIds.size > 0 ? '<button class="btn btn-secondary" onclick="deleteSelectedProps()" style="font-size:11px;padding:4px 10px;color:var(--red)">' + t('deleteSelected') + '</button>' : '') +
            '<button class="btn btn-secondary" onclick="cancelPropSelect()" style="font-size:11px;padding:4px 10px">✕</button>' +
            '</div>';
    }
    // Pagination
    const totalItems = props.length;
    const totalPages = Math.ceil(totalItems / propPageSize);
    if (propPage > totalPages) propPage = totalPages;
    if (propPage < 1) propPage = 1;
    const startIdx = (propPage - 1) * propPageSize;
    const paged = props.slice(startIdx, startIdx + propPageSize);

    h += paged.map(p => {
        const occ = getResidentsOnProp(p).length;
        const free = Math.max(0, (p.spots || 0) - occ);
        const isFull = free === 0 && occ > 0;
        return '<div class="prop-card" style="display:flex;align-items:center;gap:8px">' +
            (propSelectMode ? '<input type="checkbox" class="sel-check" data-pid="' + p.id + '" ' + (selectedPropIds.has(p.id) ? 'checked' : '') + ' onchange="togglePropItem(\'' + p.id + '\',this)" style="flex-shrink:0">' : '') +
            '<div style="flex:1"><div class="prop-name">' + esc(p.city) + ' · ' + esc(p.address) + '</div>' +
            '<div class="prop-meta">' + t(p.housingType || 'hostel') + '</div></div>' +
            '<div class="prop-spots">' +
            '<span class="prop-spot-tag total">' + (p.spots || 0) + ' ' + t('spots') + '</span>' +
            '<span class="prop-spot-tag ' + (isFull ? 'full' : 'free') + '">' + free + ' ' + t('freeSpots') + '</span>' +
            '</div><div class="prop-actions">' +
            '<button class="btn-sm" onclick="openPropForm(\'' + p.id + '\')">✏️</button>' +
            '<button class="btn-sm danger" onclick="deleteProp(\'' + p.id + '\')">🗑</button>' +
            '</div></div>';
    }).join('');
    // Property pagination
    if (totalPages > 1 || totalItems > 10) {
        h += '<div class="pagination" style="padding:8px 0">';
        if (totalPages > 1) {
            h += '<button class="pg-btn" onclick="goPropPage(' + (propPage - 1) + ')"' + (propPage === 1 ? ' disabled' : '') + '>&lsaquo;</button>';
            let start = Math.max(1, propPage - 2), end = Math.min(totalPages, propPage + 2);
            if (start > 1) { h += '<button class="pg-btn" onclick="goPropPage(1)">1</button>'; if (start > 2) h += '<span class="pg-dots">…</span>'; }
            for (let i = start; i <= end; i++) h += '<button class="pg-btn' + (i === propPage ? ' active' : '') + '" onclick="goPropPage(' + i + ')">' + i + '</button>';
            if (end < totalPages) { if (end < totalPages - 1) h += '<span class="pg-dots">…</span>'; h += '<button class="pg-btn" onclick="goPropPage(' + totalPages + ')">' + totalPages + '</button>'; }
            h += '<button class="pg-btn" onclick="goPropPage(' + (propPage + 1) + ')"' + (propPage === totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
        }
        h += '<span class="pg-info">' + (startIdx + 1) + '–' + Math.min(startIdx + propPageSize, totalItems) + ' / ' + totalItems + '</span>';
        h += '<select class="pg-select" onchange="changePropPageSize(this.value)">';
        [10, 50, 100].forEach(n => { h += '<option value="' + n + '"' + (propPageSize === n ? ' selected' : '') + '>' + n + '</option>'; });
        h += '</select></div>';
    }
    list.innerHTML = h;
}

export function togglePropSelect() {
    propSelectMode = !propSelectMode;
    selectedPropIds.clear();
    if (window.render) window.render();
}

export function cancelPropSelect() { propSelectMode = false; selectedPropIds.clear(); if (window.render) window.render(); }

export function togglePropItem(id, cb) {
    if (cb.checked) selectedPropIds.add(id); else selectedPropIds.delete(id);
    renderProperties();
}

export function toggleSelectAllProps() {
    const all = document.getElementById('sel-all-props').checked;
    properties().forEach(p => { if (all) selectedPropIds.add(p.id); else selectedPropIds.delete(p.id); });
    renderProperties();
}

export function deleteSelectedProps() {
    const n = selectedPropIds.size; if (!n) return;
    let blocked = [];
    for (const id of selectedPropIds) {
        const p = properties().find(x => x.id === id);
        if (p) { const occ = getResidentsOnProp(p).length; if (occ > 0) blocked.push(p.city + ' · ' + p.address + ' (' + occ + ')'); }
    }
    if (blocked.length) {
        const el = document.createElement('div'); el.className = 'confirm-overlay';
        el.innerHTML = '<div class="confirm-box"><div class="confirm-icon">⚠️</div><div class="confirm-title">' + t('propHasResidents') + '</div><div class="confirm-msg">' + blocked.join('<br>') + '</div><div class="confirm-btns"><button class="c-ok" style="flex:none;padding:10px 40px">OK</button></div></div>';
        document.body.appendChild(el); el.querySelector('button').onclick = () => el.remove();
        return;
    }
    showConfirm('🗑', t('confirmDelete'), n + ' ' + t('properties').toLowerCase(), t('confirmYes'), 'c-danger', async () => {
        for (const id of selectedPropIds) { try { await window._fb.deleteDoc(propDoc(id)); } catch (e) { } }
        selectedPropIds.clear(); propSelectMode = false;
    });
}

export function openPropForm(id) {
    document.getElementById('prop-overlay').classList.remove('hidden');
    if (id) {
        const p = properties().find(x => x.id === id); if (!p) return;
        document.getElementById('prop-form-title').textContent = '🏢 ' + t('editProp');
        document.getElementById('prop-edit-id').value = id;
        document.getElementById('p-city').value = p.city || '';
        document.getElementById('p-address').value = p.address || '';
        document.getElementById('p-type').value = p.housingType || 'hostel';
        document.getElementById('p-spots').value = p.spots || 1;
    } else {
        document.getElementById('prop-form-title').textContent = '🏢 ' + t('newProp');
        document.getElementById('prop-edit-id').value = '';
        document.getElementById('p-city').value = '';
        document.getElementById('p-address').value = '';
        document.getElementById('p-type').value = 'hostel';
        document.getElementById('p-spots').value = 10;
    }
}

export function closePropForm() { document.getElementById('prop-overlay').classList.add('hidden'); }

export async function saveProp() {
    const city = document.getElementById('p-city').value.trim();
    const address = document.getElementById('p-address').value.trim();
    const type = document.getElementById('p-type').value;
    const spots = parseInt(document.getElementById('p-spots').value) || 1;
    if (!city || !address) return alert(t('city') + '!');
    const editId = document.getElementById('prop-edit-id').value;
    const data = { city, address, housingType: type, spots };
    try {
        if (editId) {
            const existing = properties().find(p => p.id === editId);
            if (existing) { const { id: _, ...old } = existing; Object.assign(data, { createdAt: old.createdAt }); }
            await window._fb.setDoc(propDoc(editId), data);
        } else {
            data.createdAt = new Date().toISOString();
            await window._fb.setDoc(propDoc(genId()), data);
        }
        closePropForm();
    } catch (e) { alert('Error: ' + e.message); }
}

export function deleteProp(id) {
    const p = properties().find(x => x.id === id); if (!p) return;
    const occ = getResidentsOnProp(p).length;
    if (occ > 0) {
        const el = document.createElement('div');
        el.className = 'confirm-overlay';
        el.innerHTML = '<div class="confirm-box"><div class="confirm-icon">⚠️</div><div class="confirm-title">' + t('propHasResidents') + '</div><div class="confirm-msg">' + occ + ' ' + t('residents').toLowerCase() + ': ' + getResidentsOnProp(p).map(r => window.resName ? window.resName(r) : r.firstName).join(', ') + '</div><div class="confirm-btns"><button class="c-ok" style="flex:none;padding:10px 40px">OK</button></div></div>';
        document.body.appendChild(el);
        el.querySelector('button').onclick = () => el.remove();
        el.onclick = (e) => { if (e.target === el) el.remove(); };
        return;
    }
    showConfirm('🗑', t('confirmDelete'), t('confirmDeleteMsg'), '🗑', 'c-danger', async () => {
        try { await window._fb.deleteDoc(propDoc(id)); } catch (e) { alert('Error: ' + e.message); }
    });
}
