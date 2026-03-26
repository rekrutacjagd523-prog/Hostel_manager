// ===== PROPERTIES MODULE =====
import { t } from './constants.js';
import { properties, residents, esc, genId, todayStr, showConfirm, propDoc } from './utils.js';
import { getFreeSpots } from './residents.js';
import { canAddProperty, showUpgradeModal } from './subscription.js';


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
    if (!props.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="building-2" style="width:48px;height:48px;opacity:0.5"></i></div><div class="empty-state-title">' + t('noProps') + '</div><div class="empty-state-desc">Stwórz swój pierwszy obiekt, aby móc przypisywać do niego lokatorów.</div><button class="btn btn-primary" onclick="openPropForm()" style="margin:0 auto"><i data-lucide="plus" style="width:14px;height:14px"></i> ' + t('addProp') + '</button></div>'; if (window.lucide) window.lucide.createIcons(); return; }
    let h = '';
    if (propSelectMode) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;margin-bottom:4px">' +
            '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--text2)"><input type="checkbox" class="sel-check" id="sel-all-props" onchange="toggleSelectAllProps()" ' + (selectedPropIds.size === props.length ? 'checked' : '') + '> ' + t('selectAll') + '</label>' +
            '<span style="font-size:12px;color:var(--accent);font-weight:700" id="prop-sel-count">' + (selectedPropIds.size > 0 ? selectedPropIds.size + ' ' + t('selected') : '') + '</span>' +
            '<button class="btn btn-secondary" onclick="deleteSelectedProps()" id="btn-del-sel-props" style="display:' + (selectedPropIds.size > 0 ? 'inline-block' : 'none') + ';font-size:11px;padding:4px 10px;color:var(--red)">' + t('deleteSelected') + '</button>' +
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
        return '<div class="prop-card longpress-prop" data-id="' + p.id + '" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;' + (propSelectMode ? 'cursor:pointer' : '') + '" ' + (propSelectMode ? 'onclick="if(event.target.type!==\'checkbox\'){const cb=this.querySelector(\'.sel-check\');if(cb){cb.checked=!cb.checked;togglePropItem(\'' + p.id + '\',cb);}}"' : '') + '>' +
            (propSelectMode ? '<input type="checkbox" class="sel-check" data-pid="' + p.id + '" ' + (selectedPropIds.has(p.id) ? 'checked' : '') + ' onchange="togglePropItem(\'' + p.id + '\',this)" style="flex-shrink:0">' : '') +
            '<div style="flex:1"><div class="prop-name">' + esc(p.city) + ' · ' + esc(p.address) + '</div>' +
            '<div class="prop-meta">' + t(p.housingType || 'hostel') + '</div></div>' +
            '<div class="prop-spots">' +
            '<span class="prop-spot-tag total">' + (p.spots || 0) + ' ' + t('spots') + '</span>' +
            '<span class="prop-spot-tag ' + (isFull ? 'full' : 'free') + '">' + free + ' ' + t('freeSpots') + '</span>' +
            '</div><div class="prop-actions" onclick="event.stopPropagation()">' +
            '<button class="btn-sm" onclick="openPropForm(\'' + p.id + '\')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
            '<button class="btn-sm danger" onclick="deleteProp(\'' + p.id + '\')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>' +
            '</div>' + // close prop-actions
            // Room mini-list
            (p.rooms && p.rooms.length ?
                '<div class="room-list" style="width:100%;margin-top:6px;border-top:1px solid var(--border2);padding-top:6px">' +
                p.rooms.map(rm => {
                    const roomOcc = getRoomOccupancy(p.id, rm.id);
                    const roomFree = Math.max(0, (rm.beds || 0) - roomOcc);
                    return '<div class="room-chip" onclick="event.stopPropagation();openRoomForm(\'' + p.id + '\',\'' + rm.id + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--surface2);border-radius:6px;font-size:11px;cursor:pointer;margin:2px">' +
                        '<span><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4l-6 16"/></svg> ' + esc(rm.name) + '</span>' +
                        '<span style="color:var(--text4)">F' + rm.floor + '</span>' +
                        '<span style="color:' + (roomFree > 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + roomOcc + '/' + rm.beds + '</span>' +
                        '</div>';
                }).join('') +
                '<button class="room-chip" onclick="event.stopPropagation();openRoomForm(\'' + p.id + '\')" style="display:inline-flex;align-items:center;gap:2px;padding:3px 8px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;margin:2px">+ ' + t('addRoom').replace('+ ', '') + '</button>' +
                '</div>' :
                '<div style="width:100%;margin-top:4px"><button class="room-chip" onclick="event.stopPropagation();openRoomForm(\'' + p.id + '\')" style="display:inline-flex;align-items:center;gap:2px;padding:3px 8px;background:var(--surface2);border:1px dashed var(--border3);border-radius:6px;font-size:11px;cursor:pointer;margin:2px;color:var(--text3)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4l-6 16"/></svg> ' + t('addRoom') + '</button></div>'
            ) +
            '</div>'; // close prop-card
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
    if (window.lucide) window.lucide.createIcons();
}

export function togglePropSelect() {
    propSelectMode = !propSelectMode;
    selectedPropIds.clear();
    renderProperties();
}

export function cancelPropSelect() { propSelectMode = false; selectedPropIds.clear(); renderProperties(); }

export function togglePropItem(id, cb) {
    if (cb.checked) selectedPropIds.add(id); else selectedPropIds.delete(id);
    updatePropSelCount();
}

export function toggleSelectAllProps() {
    const all = document.getElementById('sel-all-props').checked;
    properties().forEach(p => { if (all) selectedPropIds.add(p.id); else selectedPropIds.delete(p.id); });
    document.querySelectorAll('.prop-card .sel-check').forEach(cb => {
        if (cb.id !== 'sel-all-props') cb.checked = all;
    });
    updatePropSelCount();
}

function updatePropSelCount() {
    const n = selectedPropIds.size;
    const countEl = document.getElementById('prop-sel-count');
    if (countEl) countEl.textContent = n > 0 ? n + ' ' + t('selected') : '';
    const delBtn = document.getElementById('btn-del-sel-props');
    if (delBtn) delBtn.style.display = n > 0 ? 'inline-block' : 'none';
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
        el.innerHTML = '<div class="confirm-box"><div class="confirm-icon"></div><div class="confirm-title">' + t('propHasResidents') + '</div><div class="confirm-msg">' + blocked.join('<br>') + '</div><div class="confirm-btns"><button class="c-ok" style="flex:none;padding:10px 40px">OK</button></div></div>';
        document.body.appendChild(el); el.querySelector('button').onclick = () => el.remove();
        return;
    }
    showConfirm('', t('confirmDelete'), n + ' ' + t('properties').toLowerCase(), t('confirmYes'), 'c-danger', async () => {
        for (const id of selectedPropIds) { try { await window._fb.deleteDoc(propDoc(id)); } catch (e) { } }
        selectedPropIds.clear(); propSelectMode = false;
    });
}

export function openPropForm(id) {
    document.getElementById('prop-overlay').classList.remove('hidden');
    if (id) {
        const p = properties().find(x => x.id === id); if (!p) return;
        document.getElementById('prop-form-title').textContent = '' + t('editProp');
        document.getElementById('prop-edit-id').value = id;
        document.getElementById('p-city').value = p.city || '';
        document.getElementById('p-address').value = p.address || '';
        document.getElementById('p-type').value = p.housingType || 'hostel';
        document.getElementById('p-spots').value = p.spots || 1;
    } else {
        document.getElementById('prop-form-title').textContent = '' + t('newProp');
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
    // Subscription limit check for new properties
    if (!editId && !canAddProperty()) {
        return showUpgradeModal('properties');
    }
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
        el.innerHTML = '<div class="confirm-box"><div class="confirm-icon"></div><div class="confirm-title">' + t('propHasResidents') + '</div><div class="confirm-msg">' + occ + ' ' + t('residents').toLowerCase() + ': ' + getResidentsOnProp(p).map(r => window.resName ? window.resName(r) : r.firstName).join(', ') + '</div><div class="confirm-btns"><button class="c-ok" style="flex:none;padding:10px 40px">OK</button></div></div>';
        document.body.appendChild(el);
        el.querySelector('button').onclick = () => el.remove();
        el.onclick = (e) => { if (e.target === el) el.remove(); };
        return;
    }
    showConfirm('', t('confirmDelete'), t('confirmDeleteMsg'), '', 'c-danger', async () => {
        try { await window._fb.deleteDoc(propDoc(id)); } catch (e) { alert('Error: ' + e.message); }
    });
}

// ===== ROOM MANAGEMENT =====

function getRoomOccupancy(propId, roomId) {
    const p = properties().find(x => x.id === propId);
    if (!p) return 0;
    return residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && (r.housingType || 'hostel') === p.housingType && r.roomId === roomId).length;
}

export function openRoomForm(propId, roomId) {
    document.getElementById('room-overlay').classList.remove('hidden');
    document.getElementById('room-prop-id').value = propId;
    if (roomId) {
        const p = properties().find(x => x.id === propId);
        const room = p && p.rooms ? p.rooms.find(r => r.id === roomId) : null;
        if (!room) return;
        document.getElementById('room-form-title').textContent = t('editRoom');
        document.getElementById('room-edit-id').value = roomId;
        document.getElementById('r-name').value = room.name || '';
        document.getElementById('r-floor').value = room.floor || 1;
        document.getElementById('r-beds').value = room.beds || 1;
    } else {
        document.getElementById('room-form-title').textContent = t('addRoom');
        document.getElementById('room-edit-id').value = '';
        document.getElementById('r-name').value = '';
        document.getElementById('r-floor').value = 1;
        const prop = properties().find(x => x.id === propId);
        document.getElementById('r-beds').value = (prop && prop.spots) ? prop.spots : 2;
    }
}

export function closeRoomForm() { document.getElementById('room-overlay').classList.add('hidden'); }

export async function saveRoom() {
    const propId = document.getElementById('room-prop-id').value;
    const p = properties().find(x => x.id === propId);
    if (!p) return;
    const name = document.getElementById('r-name').value.trim();
    const floor = parseInt(document.getElementById('r-floor').value) || 1;
    const beds = parseInt(document.getElementById('r-beds').value) || 1;
    if (!name) return alert(t('roomName') + '!');
    const editId = document.getElementById('room-edit-id').value;
    let rooms = p.rooms ? [...p.rooms] : [];
    if (editId) {
        const idx = rooms.findIndex(r => r.id === editId);
        if (idx >= 0) rooms[idx] = { ...rooms[idx], name, floor, beds };
    } else {
        rooms.push({ id: genId(), name, floor, beds });
    }
    // Auto-update spots to sum of beds
    const totalBeds = rooms.reduce((s, r) => s + (r.beds || 0), 0);
    const data = { ...p };
    delete data.id;
    data.rooms = rooms;
    data.spots = totalBeds;
    try {
        await window._fb.setDoc(propDoc(propId), data);
        closeRoomForm();
    } catch (e) { alert('Error: ' + e.message); }
}

export function deleteRoom(propId, roomId) {
    showConfirm('', t('deleteRoom'), t('confirmDeleteRoom'), t('confirmYes'), 'c-danger', async () => {
        const p = properties().find(x => x.id === propId);
        if (!p) return;
        let rooms = p.rooms ? p.rooms.filter(r => r.id !== roomId) : [];
        const totalBeds = rooms.reduce((s, r) => s + (r.beds || 0), 0);
        const data = { ...p };
        delete data.id;
        data.rooms = rooms;
        data.spots = totalBeds;
        try {
            await window._fb.setDoc(propDoc(propId), data);
            // Clear roomId for residents in this room
            const resInRoom = residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && r.roomId === roomId);
            for (const r of resInRoom) {
                const rd = { ...r }; delete rd.id; rd.roomId = null;
                await window._fb.setDoc(window._fb.doc(window._fb.db, 'users', window._workspaceUid || window._currentUser?.uid, 'residents', r.id), rd);
            }
        } catch (e) { alert('Error: ' + e.message); }
    });
}

export { getRoomOccupancy };
