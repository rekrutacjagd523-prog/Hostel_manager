// ===== BOOKINGS MODULE =====
import { t } from './constants.js';
import { properties, bookings, fmtUi, todayStr, showConfirm, bookDoc, genId, esc, resDoc } from './utils.js';
import { canAddBooking, showUpgradeModal } from './subscription.js';
import { getRoomOccupancy } from './properties.js';

const STATUS_COLORS = { pending: '#f59e0b', confirmed: 'var(--green)', cancelled: 'var(--text4)', checkedIn: 'var(--accent)' };
const STATUS_BG = { pending: 'rgba(245,158,11,.12)', confirmed: 'rgba(106,184,154,.12)', cancelled: 'rgba(150,150,150,.08)', checkedIn: 'rgba(232,168,56,.12)' };

export let bookSelectMode = false;
export let selectedBookIds = new Set();
export let bookPage = 1;
export let bookPageSize = 10;
let filterStatus = '';
let viewMode = 'list';
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();

export function goBookPage(p) { bookPage = p; renderBookings(); }
export function changeBookPageSize(v) { bookPageSize = parseInt(v); bookPage = 1; renderBookings(); }

export function setBookStatusFilter(status) {
    filterStatus = (filterStatus === status) ? '' : status;
    bookPage = 1;
    document.querySelectorAll('.book-status-tab').forEach(btn => {
        const isActive = btn.dataset.status === filterStatus;
        btn.style.background = isActive ? 'var(--accent)' : '';
        btn.style.color = isActive ? '#fff' : '';
        btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border3)';
    });
    renderBookings();
}

export function setBookViewMode(mode) {
    viewMode = mode;
    const listBtn = document.getElementById('btn-book-list');
    const calBtn = document.getElementById('btn-book-cal');
    if (listBtn) { listBtn.style.background = mode === 'list' ? 'var(--accent)' : ''; listBtn.style.color = mode === 'list' ? '#fff' : ''; }
    if (calBtn) { calBtn.style.background = mode === 'calendar' ? 'var(--accent)' : ''; calBtn.style.color = mode === 'calendar' ? '#fff' : ''; }
    renderBookings();
}

export function goCalMonth(offset) {
    calMonth += offset;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderBookings();
}

// ===== RENDER =====

export function renderBookings() {
    if (viewMode === 'calendar') {
        document.getElementById('calendar-container').style.display = 'block';
        document.getElementById('bookings-list').style.display = 'none';
        document.getElementById('booking-pagination').style.display = 'none';
        renderCalendar();
    } else {
        document.getElementById('calendar-container').style.display = 'none';
        document.getElementById('bookings-list').style.display = 'block';
        document.getElementById('booking-pagination').style.display = 'block';
        renderBookingList();
    }
}

function renderBookingList() {
    const list = document.getElementById('bookings-list');
    if (!list) return;
    let all = bookings();
    if (filterStatus) all = all.filter(b => b.status === filterStatus);

    if (!all.length) {
        list.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text4);font-size:13px">' + t('noBookings') + '</div>';
        document.getElementById('booking-pagination').innerHTML = '';
        return;
    }

    const totalItems = all.length;
    const totalPages = Math.ceil(totalItems / bookPageSize);
    if (bookPage > totalPages) bookPage = totalPages;
    if (bookPage < 1) bookPage = 1;
    const startIdx = (bookPage - 1) * bookPageSize;
    const paged = all.slice(startIdx, startIdx + bookPageSize);

    let h = paged.map(b => {
        const sc = STATUS_COLORS[b.status] || 'var(--text3)';
        const sb = STATUS_BG[b.status] || '';
        const prop = b.propId ? properties().find(p => p.id === b.propId) : null;
        const room = prop && prop.rooms && b.roomId ? prop.rooms.find(r => r.id === b.roomId) : null;
        const statusLabel = b.status === 'pending' ? t('bkPending') : b.status === 'confirmed' ? t('bkConfirmed') : b.status === 'cancelled' ? t('bkCancelled') : t('bkCheckedIn');
        const dateLabel = (window.fmtDate ? window.fmtDate(b.startDate) : b.startDate) + ' → ' + (window.fmtDate ? window.fmtDate(b.endDate) : b.endDate);
        return '<div class="prop-card" style="border-left:3px solid ' + sc + '">' +
            '<div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div class="prop-name">' + esc(b.guestName || '—') + '</div>' +
            (b.amount ? '<div style="font-weight:700;font-size:14px;color:var(--accent)">' + fmtUi(b.amount) + '</div>' : '') +
            '</div>' +
            '<div class="prop-meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
            '<span class="tag">' + dateLabel + '</span>' +
            '<span class="tag" style="background:' + sb + ';color:' + sc + ';font-weight:600;border-color:' + sc + '">' + statusLabel + '</span>' +
            (prop ? '<span class="tag">' + esc(prop.city) + ' · ' + esc(prop.address) + '</span>' : '') +
            (room ? '<span class="tag">🚪 ' + esc(room.name) + '</span>' : '') +
            (b.phone ? '<span class="tag">📞 ' + esc(b.phone) + '</span>' : '') +
            '</div>' +
            (b.notes ? '<div style="font-size:11px;color:var(--text3);margin-top:4px">' + esc(b.notes) + '</div>' : '') +
            '</div>' +
            '<div class="prop-actions" style="display:flex;flex-direction:column;gap:4px">' +
            '<button class="btn-sm" onclick="openBookingForm(\'' + b.id + '\')">✏️</button>' +
            (b.status === 'pending' ? '<button class="btn-sm" style="color:var(--green)" onclick="setBookingStatus(\'' + b.id + '\',\'confirmed\')" title="' + t('confirmBooking') + '">✓</button>' : '') +
            (b.status === 'confirmed' ? '<button class="btn-sm" style="color:var(--accent)" onclick="checkInBooking(\'' + b.id + '\')" title="' + t('checkInBooking') + '"></button>' : '') +
            ((b.status === 'pending' || b.status === 'confirmed') ? '<button class="btn-sm" style="color:var(--red)" onclick="setBookingStatus(\'' + b.id + '\',\'cancelled\')" title="' + t('cancelBooking') + '">✕</button>' : '') +
            '<button class="btn-sm danger" onclick="deleteBooking(\'' + b.id + '\')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>' +
            '</div></div>';
    }).join('');
    list.innerHTML = h;

    // Pagination
    const pgBar = document.getElementById('booking-pagination');
    if (totalPages <= 1 && totalItems <= 10) { pgBar.innerHTML = ''; return; }
    let pg = '';
    if (totalPages > 1) {
        pg += '<button class="pg-btn" onclick="goBookPage(' + (bookPage - 1) + ')"' + (bookPage === 1 ? ' disabled' : '') + '>&lsaquo;</button>';
        let start = Math.max(1, bookPage - 2), end = Math.min(totalPages, bookPage + 2);
        if (start > 1) { pg += '<button class="pg-btn" onclick="goBookPage(1)">1</button>'; if (start > 2) pg += '<span class="pg-dots">…</span>'; }
        for (let i = start; i <= end; i++) pg += '<button class="pg-btn' + (i === bookPage ? ' active' : '') + '" onclick="goBookPage(' + i + ')">' + i + '</button>';
        if (end < totalPages) { if (end < totalPages - 1) pg += '<span class="pg-dots">…</span>'; pg += '<button class="pg-btn" onclick="goBookPage(' + totalPages + ')">' + totalPages + '</button>'; }
        pg += '<button class="pg-btn" onclick="goBookPage(' + (bookPage + 1) + ')"' + (bookPage === totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
    }
    pg += '<span class="pg-info">' + (startIdx + 1) + '–' + Math.min(startIdx + bookPageSize, totalItems) + ' / ' + totalItems + '</span>';
    pgBar.innerHTML = pg;
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon=0

    const monthNames = { RU: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'], PL: ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'], UA: ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'], EN: ['January','February','March','April','May','June','July','August','September','October','November','December'], LT: ['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis'] };
    const lang = (window._settings && window._settings.lang) || 'RU';
    const mName = (monthNames[lang] || monthNames.EN)[calMonth];
    const todayDate = todayStr();
    const dayNames = [t('monShort'), t('tueShort'), t('wedShort'), t('thuShort'), t('friShort'), t('satShort'), t('sunShort')];

    // Get bookings for this month
    const monthStart = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-01';
    const monthEnd = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(daysInMonth).padStart(2, '0');
    const monthBookings = bookings().filter(b => b.status !== 'cancelled' && b.startDate <= monthEnd && b.endDate >= monthStart);

    let h = '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-bottom:4px">' +
        '<button class="btn btn-secondary" onclick="goCalMonth(-1)" style="padding:4px 12px;font-size:14px">' + t('prevMonth') + '</button>' +
        '<div style="font-weight:700;font-size:15px">' + mName + ' ' + calYear + '</div>' +
        '<button class="btn btn-secondary" onclick="goCalMonth(1)" style="padding:4px 12px;font-size:14px">' + t('nextMonth') + '</button>' +
        '</div>';

    h += '<div class="cal-grid">';
    // Day headers
    dayNames.forEach(d => { h += '<div class="cal-header">' + d + '</div>'; });

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) h += '<div class="cal-day empty"></div>';

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const isToday = dateStr === todayDate;
        const dayBookings = monthBookings.filter(b => b.startDate <= dateStr && b.endDate >= dateStr);

        h += '<div class="cal-day' + (isToday ? ' today' : '') + '">';
        h += '<div class="cal-day-num' + (isToday ? ' today' : '') + '">' + d + '</div>';
        dayBookings.slice(0, 3).forEach(b => {
            const sc = STATUS_COLORS[b.status] || 'var(--text3)';
            h += '<div class="cal-booking" style="border-left-color:' + sc + ';background:' + (STATUS_BG[b.status] || '') + '" onclick="openBookingForm(\'' + b.id + '\')" title="' + esc(b.guestName) + '">' + esc(b.guestName || '—').substring(0, 12) + '</div>';
        });
        if (dayBookings.length > 3) h += '<div style="font-size:9px;color:var(--text4);text-align:center">+' + (dayBookings.length - 3) + '</div>';
        h += '</div>';
    }
    h += '</div>';
    container.innerHTML = h;
}

// ===== CRUD =====

export function openBookingForm(id) {
    document.getElementById('booking-overlay').classList.remove('hidden');
    // Apply correct locale to date inputs
    const _hl = { RU: 'ru', PL: 'pl', UA: 'uk', EN: 'en', LT: 'lt' };
    const _dl = _hl[(window._settings || {}).lang || 'PL'] || 'pl';
    document.querySelectorAll('input[type="date"]').forEach(el => el.setAttribute('lang', _dl));

    // Populate property dropdown
    const propSel = document.getElementById('bk-prop');
    const props = properties();
    propSel.innerHTML = '<option value="">— ' + t('selectProp') + ' —</option>' + props.map(p => '<option value="' + p.id + '">' + esc(p.city + ' · ' + p.address) + '</option>').join('');

    if (id) {
        const b = bookings().find(x => x.id === id); if (!b) return;
        document.getElementById('booking-form-title').textContent = '' + t('editBooking');
        document.getElementById('bk-edit-id').value = id;
        document.getElementById('bk-guest').value = b.guestName || '';
        document.getElementById('bk-phone').value = b.phone || '';
        document.getElementById('bk-prop').value = b.propId || '';
        onBookPropSelect();
        if (b.roomId) setTimeout(() => { document.getElementById('bk-room').value = b.roomId; }, 50);
        document.getElementById('bk-start').value = b.startDate || '';
        document.getElementById('bk-end').value = b.endDate || '';
        document.getElementById('bk-amount').value = b.amount || '';
        document.getElementById('bk-notes').value = b.notes || '';
        document.getElementById('bk-status').value = b.status || 'pending';
    } else {
        document.getElementById('booking-form-title').textContent = '' + t('newBooking');
        document.getElementById('bk-edit-id').value = '';
        document.getElementById('bk-guest').value = '';
        document.getElementById('bk-phone').value = '';
        document.getElementById('bk-prop').value = '';
        document.getElementById('bk-room').innerHTML = '<option value="">—</option>';
        document.getElementById('bk-room-row').style.display = 'none';
        document.getElementById('bk-start').value = todayStr();
        document.getElementById('bk-end').value = '';
        document.getElementById('bk-amount').value = '';
        document.getElementById('bk-notes').value = '';
        document.getElementById('bk-status').value = 'pending';
    }
}

export function closeBookingForm() { document.getElementById('booking-overlay').classList.add('hidden'); }

export function onBookPropSelect() {
    const propId = document.getElementById('bk-prop').value;
    const roomRow = document.getElementById('bk-room-row');
    const roomSel = document.getElementById('bk-room');
    if (!propId) { roomRow.style.display = 'none'; return; }
    const p = properties().find(x => x.id === propId);
    if (p && p.rooms && p.rooms.length) {
        roomRow.style.display = 'block';
        roomSel.innerHTML = '<option value="">— ' + t('unassigned') + ' —</option>' +
            p.rooms.map(rm => '<option value="' + rm.id + '">🚪 ' + esc(rm.name) + ' (F' + rm.floor + ', ' + rm.beds + ' ' + t('bedsShort') + ')</option>').join('');
    } else {
        roomRow.style.display = 'none';
        roomSel.innerHTML = '<option value="">—</option>';
    }
}

export async function saveBooking() {
    const guestName = document.getElementById('bk-guest').value.trim();
    const phone = document.getElementById('bk-phone').value.trim();
    const propId = document.getElementById('bk-prop').value || null;
    const roomId = document.getElementById('bk-room').value || null;
    const startDate = document.getElementById('bk-start').value;
    const endDate = document.getElementById('bk-end').value;
    const amount = parseFloat(document.getElementById('bk-amount').value) || 0;
    const notes = document.getElementById('bk-notes').value.trim();
    const status = document.getElementById('bk-status').value;
    if (!guestName || !startDate || !endDate) return alert(t('guestName') + ', ' + t('startDate') + ', ' + t('endDate') + '!');
    if (endDate < startDate) return alert(t('endDate') + ' < ' + t('startDate'));
    const editId = document.getElementById('bk-edit-id').value;
    if (!editId && !canAddBooking()) return showUpgradeModal('bookings');
    const data = { guestName, phone, propId, roomId, startDate, endDate, amount, notes, status };
    try {
        if (editId) {
            const existing = bookings().find(b => b.id === editId);
            if (existing) data.createdAt = existing.createdAt;
            await window._fb.setDoc(bookDoc(editId), data);
        } else {
            data.createdAt = new Date().toISOString();
            await window._fb.setDoc(bookDoc(genId()), data);
        }
        closeBookingForm();
    } catch (e) { alert('Error: ' + e.message); }
}

export function deleteBooking(id) {
    showConfirm('', t('confirmDelete'), t('confirmDeleteMsg'), t('confirmYes'), 'c-danger', async () => {
        try { await window._fb.deleteDoc(bookDoc(id)); } catch (e) { alert('Error: ' + e.message); }
    });
}

export async function setBookingStatus(id, status) {
    const b = bookings().find(x => x.id === id); if (!b) return;
    const data = { ...b }; delete data.id;
    data.status = status;
    try { await window._fb.setDoc(bookDoc(id), data); } catch (e) { alert('Error: ' + e.message); }
}

export async function checkInBooking(id) {
    const b = bookings().find(x => x.id === id); if (!b) return;
    const prop = b.propId ? properties().find(p => p.id === b.propId) : null;
    showConfirm('', t('checkInBooking'), esc(b.guestName) + ' → ' + (prop ? esc(prop.city + ' · ' + prop.address) : ''), t('confirmYes'), 'c-ok', async () => {
        try {
            // Create resident from booking
            const nameParts = (b.guestName || '').split(' ');
            const resData = {
                firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '',
                fullName: b.guestName || '',
                city: prop ? prop.city : '', address: prop ? prop.address : '',
                housingType: prop ? prop.housingType : 'hostel',
                checkInDate: b.startDate || todayStr(), monthlyRate: b.amount || 0,
                rateHistory: [{ rate: b.amount || 0, from: b.startDate || todayStr() }],
                checkOutDate: null, createdAt: new Date().toISOString(),
                isSenior: false, plannedCheckOut: b.endDate || null,
                roomId: b.roomId || null
            };
            const uid = window._workspaceUid || window._currentUser?.uid;
            await window._fb.setDoc(window._fb.doc(window._fb.db, 'users', uid, 'residents', genId()), resData);
            // Update booking status
            const bData = { ...b }; delete bData.id; bData.status = 'checkedIn';
            await window._fb.setDoc(bookDoc(id), bData);
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// ===== SELECTION =====

export function toggleBookSelect() { bookSelectMode = !bookSelectMode; selectedBookIds.clear(); renderBookings(); }
export function cancelBookSelect() { bookSelectMode = false; selectedBookIds.clear(); renderBookings(); }
export function toggleBookItem(id, cb) { if (cb.checked) selectedBookIds.add(id); else selectedBookIds.delete(id); }
export function toggleSelectAllBooks() {
    const all = document.getElementById('sel-all-books')?.checked;
    bookings().forEach(b => { if (all) selectedBookIds.add(b.id); else selectedBookIds.delete(b.id); });
    renderBookings();
}
export function deleteSelectedBooks() {
    const n = selectedBookIds.size; if (!n) return;
    showConfirm('', t('confirmDelete'), n + ' ' + t('bookings').toLowerCase(), t('confirmYes'), 'c-danger', async () => {
        for (const id of selectedBookIds) { try { await window._fb.deleteDoc(bookDoc(id)); } catch (e) { } }
        selectedBookIds.clear(); bookSelectMode = false;
    });
}
