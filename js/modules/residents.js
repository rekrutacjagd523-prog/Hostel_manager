// ===== RESIDENTS MODULE =====
import { t } from './constants.js';
import { residents, properties, fmtUi, todayStr, showConfirm, cleanForFirebase, resDoc, propDoc, genId, esc, resName } from './utils.js';
import { buildRateHistory, calcPaymentWithHistory, calcCurrentPayment } from './rate-history.js';
import { canAddResident, showUpgradeModal } from './subscription.js';


export let selectMode = false;
export let selectedIds = new Set();

export function getFreeSpots(p) {
    const occ = residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && (r.housingType || 'hostel') === p.housingType).length;
    return Math.max(0, (p.spots || 0) - occ);
}

function populatePropSelect(selectedCity, selectedAddr, selectedType) {
    const sel = document.getElementById('f-prop');
    const props = properties();
    sel.innerHTML = '<option value="">— ' + t('selectProp') + ' —</option>' +
        props.map(p => {
            const free = getFreeSpots(p);
            const label = p.city + ' · ' + p.address + ' (' + t(p.housingType) + ') — ' + free + ' ' + t('freeSpots');
            const selected = (selectedCity === p.city && selectedAddr === p.address && (selectedType || 'hostel') === p.housingType) ? 'selected' : '';
            return '<option value="' + p.id + '" ' + selected + '>' + esc(label) + '</option>';
        }).join('') +
        '<option value="__add__">＋ ' + t('addProp') + '</option>';
    document.getElementById('prop-select-row').style.display = 'block';
    document.getElementById('f-type-wrap').style.display = props.length ? 'none' : 'block';
    onPropSelect();
}

export function onPropSelect() {
    const sel = document.getElementById('f-prop');
    const propId = sel.value;
    const info = document.getElementById('prop-spots-info');
    if (propId === '__add__') {
        sel.value = '';
        info.textContent = '';
        window.closePropForm && window.closePropForm();
        window.closeForm && window.closeForm();
        window.openPropForm && window.openPropForm();
        return;
    }
    if (propId) {
        const p = properties().find(x => x.id === propId);
        if (p) {
            document.getElementById('f-city').value = p.city;
            document.getElementById('f-address').value = p.address;
            document.getElementById('f-type').value = p.housingType;
            const free = getFreeSpots(p);
            info.textContent = free > 0 ? '' + free + ' ' + t('freeSpots') : '' + t('propFull');
            info.style.color = free > 0 ? 'var(--green)' : 'var(--red)';
            // Populate room dropdown
            const roomRow = document.getElementById('room-select-row');
            const roomSel = document.getElementById('f-room');
            if (p.rooms && p.rooms.length) {
                roomRow.style.display = 'block';
                const editId = document.getElementById('edit-id').value;
                const currentResident = editId ? residents().find(r => r.id === editId) : null;
                roomSel.innerHTML = '<option value="">— ' + t('unassigned') + ' —</option>' +
                    p.rooms.map(rm => {
                        const occ = residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && r.roomId === rm.id && r.id !== editId).length;
                        const free = Math.max(0, (rm.beds || 0) - occ);
                        const selected = currentResident && currentResident.roomId === rm.id ? ' selected' : '';
                        return '<option value="' + rm.id + '"' + selected + (free <= 0 ? ' disabled' : '') + '><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4l-6 16"/></svg> ' + esc(rm.name) + ' (F' + rm.floor + ') — ' + free + ' ' + t('freeBedsInRoom') + '</option>';
                    }).join('');
            } else {
                roomRow.style.display = 'none';
                roomSel.innerHTML = '<option value="">—</option>';
            }
        }
    } else {
        info.textContent = '';
        document.getElementById('room-select-row').style.display = 'none';
    }
}

export function openForm(id) {
    document.getElementById('form-overlay').classList.remove('hidden');
    // Apply correct lang to date inputs inside the form
    const htmlLangMap = { RU: 'ru', PL: 'pl', UA: 'uk', EN: 'en', LT: 'lt' };
    const lang = (window._settings || {}).lang || 'PL';
    const htmlLang = htmlLangMap[lang] || 'pl';
    document.querySelectorAll('#form-overlay input[type="date"]').forEach(el => {
        el.setAttribute('lang', htmlLang);
    });
    const rcs = document.getElementById('rate-change-section');
    if (id) {
        const r = residents().find(x => x.id === id); if (!r) return;
        document.getElementById('form-title').textContent = t('editR');
        document.getElementById('edit-id').value = id;
        document.getElementById('f-firstname').value = r.firstName || r.fullName || '';
        document.getElementById('f-lastname').value = r.lastName || '';
        document.getElementById('f-address').value = r.address || '';
        document.getElementById('f-city').value = r.city || '';
        document.getElementById('f-type').value = r.housingType || 'hostel';
        document.getElementById('f-date').value = r.checkInDate;
        document.getElementById('f-rate').value = r.monthlyRate;
        document.getElementById('f-rate-new').value = '';
        document.getElementById('f-rate-from').value = todayStr();
        document.getElementById('f-senior').checked = r.isSenior || false;
        document.getElementById('f-planned-out').value = r.plannedCheckOut || '';
        rcs.style.display = 'block';
        renderRateHistoryInForm(r);
        populatePropSelect(r.city, r.address, r.housingType || 'hostel');
        // Set room after prop select populates
        setTimeout(() => {
            const roomSel = document.getElementById('f-room');
            if (roomSel && r.roomId) roomSel.value = r.roomId;
        }, 50);
    } else {
        document.getElementById('form-title').textContent = t('newR');
        document.getElementById('edit-id').value = '';
        document.getElementById('f-firstname').value = '';
        document.getElementById('f-lastname').value = '';
        document.getElementById('f-address').value = '';
        document.getElementById('f-city').value = '';
        document.getElementById('f-type').value = 'hostel';
        document.getElementById('f-date').value = todayStr();
        document.getElementById('f-rate').value = '0';
        document.getElementById('f-senior').checked = false;
        document.getElementById('f-planned-out').value = '';
        rcs.style.display = 'none';
        document.getElementById('rate-history-box').innerHTML = '';
        populatePropSelect('', '', '');
        document.getElementById('f-room').value = '';
        document.getElementById('room-select-row').style.display = 'none';
    }
}

export function closeForm() { document.getElementById('form-overlay').classList.add('hidden'); }
export function editResident(id) { openForm(id); }

function renderRateHistoryInForm(r) {
    const history = buildRateHistory(r);
    const box = document.getElementById('rate-history-box');
    if (history.length <= 1) { box.innerHTML = ''; return; }
    let h = '<div class="rh-box"><div class="rh-title">' + t('rateHist') + '</div>';
    history.forEach((seg, i) => {
        const nextFrom = history[i + 1] ? history[i + 1].from : null;
        const label = window.fmtDate ? window.fmtDate(seg.from) : seg.from;
        const labelEnd = nextFrom ? (window.fmtDate ? window.fmtDate(nextFrom) : nextFrom) : '...';
        h += '<div class="rh-row"><div><strong>' + fmtUi(seg.rate) + '</strong>/мес.<div class="hist-period">' + label + ' → ' + labelEnd + '</div></div>' +
            (i > 0 ? '<button class="rh-del" onclick="removeRateSeg(\'' + r.id + '\',' + i + ')" title="Удалить">×</button>' : '') +
            '</div>';
    });
    h += '</div>';
    box.innerHTML = h;
}

export async function removeRateSeg(id, idx) {
    if (!confirm('Удалить эту ставку из истории?')) return;
    const r = residents().find(x => x.id === id); if (!r) return;
    const history = buildRateHistory(r).filter((_, i) => i !== idx);
    const cleanData = cleanForFirebase(r);
    cleanData.rateHistory = history;
    cleanData.monthlyRate = history[history.length - 1].rate;
    await window._fb.setDoc(resDoc(id), cleanData);
}

async function applyGroupRate(nr, fromDate, city, address, housingType, excludeId) {
    const fb = window._fb;
    const sameHousing = residents().filter(r =>
        r.id !== excludeId && !r.checkOutDate &&
        r.city === city && r.address === address && r.housingType === housingType
    );
    for (const r of sameHousing) {
        let hist = buildRateHistory(r);
        hist = hist.filter(s => s.from < fromDate);
        hist.push({ rate: nr, from: fromDate });
        hist.sort((a, b) => a.from.localeCompare(b.from));
        const data = cleanForFirebase(r);
        data.monthlyRate = hist[hist.length - 1].rate;
        data.rateHistory = hist;
        await fb.setDoc(resDoc(r.id), data);
    }
    return sameHousing.length;
}

export async function saveResident() {
    const fn = document.getElementById('f-firstname').value.trim();
    const ln = document.getElementById('f-lastname').value.trim();
    const date = document.getElementById('f-date').value;
    const rate = parseFloat(document.getElementById('f-rate').value) || 0;
    if (!fn || !date) return alert(t('fname') + '!');
    const fb = window._fb;
    const editId = document.getElementById('edit-id').value;
    const newRateVal = document.getElementById('f-rate-new').value;
    const newRateFrom = document.getElementById('f-rate-from').value;
    const city = document.getElementById('f-city').value.trim();
    const address = document.getElementById('f-address').value.trim();
    const housingType = document.getElementById('f-type').value;
    const isSenior = document.getElementById('f-senior').checked;
    const plannedCheckOut = document.getElementById('f-planned-out').value || null;
    const roomId = document.getElementById('f-room').value || null;

    // Subscription limit check for new residents
    if (!editId) {
        if (!canAddResident()) {
            return showUpgradeModal('residents');
        }
        const prop = properties().find(p => p.city === city && p.address === address && p.housingType === housingType);
        if (prop && getFreeSpots(prop) <= 0) {
            return showConfirm('', t('propFull'), city + ' · ' + address, t('confirmNo'), 'c-cancel', () => { });
        }
    }

    if (editId) {
        const existing = residents().find(r => r.id === editId);
        if (!existing) return;
        let history = buildRateHistory(existing);
        let groupRateApplied = false;

        if (newRateVal && newRateFrom) {
            const nr = parseFloat(newRateVal);
            if (nr > 0 && newRateFrom >= existing.checkInDate) {
                history = history.filter(s => s.from < newRateFrom);
                history.push({ rate: nr, from: newRateFrom });
                history.sort((a, b) => a.from.localeCompare(b.from));
                const count = await applyGroupRate(nr, newRateFrom, city, address, housingType, editId);
                if (count > 0) groupRateApplied = true;
            }
        } else if (rate !== existing.monthlyRate) {
            history[history.length - 1].rate = rate;
        }

        const data = cleanForFirebase(existing);
        data.firstName = fn; data.lastName = ln; data.fullName = fn + (ln ? ' ' + ln : '');
        data.address = address; data.city = city; data.housingType = housingType;
        data.checkInDate = date; data.monthlyRate = history[history.length - 1].rate; data.rateHistory = history;
        data.isSenior = isSenior; data.plannedCheckOut = plannedCheckOut;
        data.roomId = roomId;
        try {
            await fb.setDoc(resDoc(editId), data);
            closeForm();
            if (groupRateApplied) {
                const count = residents().filter(r => r.id !== editId && !r.checkOutDate && r.city === city && r.address === address && r.housingType === housingType).length;
                alert('Ставка обновлена для ' + count + ' жильцов на этом жилье');
            }
        } catch (e) { alert('Error: ' + e.message); }
    } else {
        const history = [{ rate, from: date }];
        const data = {
            firstName: fn, lastName: ln, fullName: fn + (ln ? ' ' + ln : ''),
            address, city, housingType,
            checkInDate: date, monthlyRate: rate, rateHistory: history,
            checkOutDate: null, createdAt: new Date().toISOString(),
            isSenior, plannedCheckOut, roomId
        };
        try { const id = genId(); await fb.setDoc(resDoc(id), data); closeForm(); }
        catch (e) { alert('Error: ' + e.message); }
    }
}

export function checkOut(id) {
    const r = residents().find(x => x.id === id); if (!r) return;

    // Create confirm with date picker
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.style.zIndex = '200';
    el.innerHTML = `
        <div class="confirm-box" style="max-width:360px">
            <div class="confirm-icon"></div>
            <div class="confirm-title">${t('confirmCheckout')}</div>
            <div class="confirm-msg">${t('confirmCheckoutMsg').replace('{name}', resName(r))}</div>
            <div style="margin-bottom:16px">
                <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">${t('checkOutDateLabel') || 'Check-out date'}</label>
                <input type="date" id="checkout-date-input" value="${todayStr()}"
                    max="${todayStr()}"
                    style="width:100%;padding:9px 12px;background:var(--field-bg);border:1px solid var(--border3);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box">
            </div>
            <div class="confirm-btns">
                <button class="c-cancel" onclick="this.closest('.confirm-overlay').remove()">${t('confirmNo')}</button>
                <button class="c-ok" id="checkout-confirm-btn">${t('confirmYes')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });

    el.querySelector('#checkout-confirm-btn').addEventListener('click', async () => {
        const dateVal = el.querySelector('#checkout-date-input').value || todayStr();
        el.remove();
        try {
            const data = cleanForFirebase(r); data.checkOutDate = dateVal;
            await window._fb.setDoc(resDoc(id), data);
        } catch (e) { alert('Error: ' + e.message); }
    });
}

export function deleteResident(id) {
    const r = residents().find(x => x.id === id);
    showConfirm('', t('confirmDelete'), t('confirmDeleteMsg'), t('confirmYes'), 'c-danger', async () => {
        try { await window._fb.deleteDoc(resDoc(id)); }
        catch (e) { alert('Error: ' + e.message); }
    });
}

export function showHistory(id) {
    const r = residents().find(x => x.id === id); if (!r) return;
    const history = buildRateHistory(r);
    document.getElementById('hist-title').textContent = t('rateHist') + ' — ' + resName(r);
    let h = '';
    history.forEach((seg, i) => {
        const nextFrom = history[i + 1] ? history[i + 1].from : (r.checkOutDate || null);
        const segEnd = nextFrom || todayStr();
        const days = window.daysBetween ? window.daysBetween(seg.from, nextFrom) : 0;
        const pay = calcPaymentWithHistory(r, seg.from, segEnd);
        h += '<div class="hist-row"><div>' +
            '<div style="font-weight:700;color:#e8a838">' + fmtUi(seg.rate) + '/мес.</div>' +
            '<div class="hist-period">' + (window.fmtDate ? window.fmtDate(seg.from) : seg.from) + ' → ' + (nextFrom ? (window.fmtDate ? window.fmtDate(nextFrom) : nextFrom) : '...') + ' (' + days + ' ' + t('days') + ')</div>' +
            '</div><div style="font-weight:700">' + fmtUi(pay) + '</div></div>';
    });
    const total = calcCurrentPayment(r);
    h += '<div style="margin-top:12px;padding:10px;background:rgba(232,168,56,.08);border-radius:6px;font-weight:700;text-align:center">' + t('totalLabel') + ': ' + fmtUi(total) + '</div>';
    document.getElementById('hist-content').innerHTML = h;
    document.getElementById('hist-overlay').classList.remove('hidden');
}

// ===== SELECTION MODE =====
export function toggleSelectMode(autoSelectId) {
    selectMode = !selectMode;
    window._selectMode = selectMode;
    selectedIds.clear();
    document.getElementById('select-bar').classList.toggle('active', selectMode);
    document.getElementById('sel-all').checked = false;
    updateSelCount();
    if (window.render) {
        window.render();
        // After render, auto-select the longpressed card
        if (autoSelectId) {
            requestAnimationFrame(() => {
                const cb = document.querySelector('.item-check[data-id="' + autoSelectId + '"]');
                if (cb) { cb.checked = true; toggleSelectItem(autoSelectId, cb); }
            });
        }
    }
}

export function cancelSelect() {
    selectMode = false; window._selectMode = false; selectedIds.clear();
    document.getElementById('select-bar').classList.remove('active');
    document.getElementById('sel-all').checked = false;
    if (window.render) window.render();
}

export function toggleSelectItem(id, cb) {
    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
    updateSelCount();
}

export function toggleSelectAll() {
    const all = document.getElementById('sel-all').checked;
    document.querySelectorAll('.item-check').forEach(cb => {
        cb.checked = all;
        if (all) selectedIds.add(cb.dataset.id); else selectedIds.delete(cb.dataset.id);
    });
    updateSelCount();
}

function updateSelCount() {
    const n = selectedIds.size;
    document.getElementById('sel-count').textContent = n > 0 ? n + ' ' + t('selected') : '';
    document.getElementById('btn-del-sel').style.display = n > 0 ? 'inline-block' : 'none';
    document.getElementById('btn-co-sel').style.display = (n > 0 && window._currentFilter === 'active') ? 'inline-block' : 'none';
}

export function deleteSelected() {
    const n = selectedIds.size; if (!n) return;
    showConfirm('', t('confirmDelete'), n + ' ' + t('residents').toLowerCase(), t('confirmYes'), 'c-danger', async () => {
        for (const id of selectedIds) {
            try { await window._fb.deleteDoc(resDoc(id)); } catch (e) { }
        }
        selectedIds.clear(); updateSelCount();
    });
}

export function checkoutSelected() {
    const n = selectedIds.size; if (!n) return;
    showConfirm('', t('confirmCheckout'), n + ' ' + t('residents').toLowerCase(), t('confirmYes'), 'c-ok', async () => {
        for (const id of selectedIds) {
            const r = residents().find(x => x.id === id);
            if (r && !r.checkOutDate) {
                const data = cleanForFirebase(r); data.checkOutDate = todayStr();
                try { await window._fb.setDoc(resDoc(id), data); } catch (e) { }
            }
        }
        selectedIds.clear(); updateSelCount();
    });
}

export function onRoomSelect() {
    const roomSel = document.getElementById('f-room');
    const roomId = roomSel.value;
    const info = document.getElementById('room-spots-info');
    if (!roomId) { info.textContent = ''; return; }
    const propId = document.getElementById('f-prop').value;
    const p = properties().find(x => x.id === propId);
    if (!p || !p.rooms) return;
    const room = p.rooms.find(r => r.id === roomId);
    if (!room) return;
    const editId = document.getElementById('edit-id').value;
    const occ = residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && r.roomId === roomId && r.id !== editId).length;
    const free = Math.max(0, (room.beds || 0) - occ);
    info.textContent = free > 0 ? '' + free + ' ' + t('freeBedsInRoom') : '' + t('roomFull');
    info.style.color = free > 0 ? 'var(--green)' : 'var(--red)';
}
