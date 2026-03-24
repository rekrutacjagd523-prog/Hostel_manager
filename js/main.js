// ===== MAIN ENTRY POINT =====
// Load Roboto font for PDF Cyrillic/Polish support
(function () {
    fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf')
        .then(r => r.arrayBuffer())
        .then(buf => {
            let binary = ''; const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            window._robotoFont = btoa(binary);
        }).catch(() => { console.warn('Could not load Roboto font for PDF'); });
})();

// Import Firebase API first (handles auth state changes)
import './modules/firebase-api.js';

import { CURRENCIES, HTYPES, t } from './modules/constants.js';
import {
    settings, residents, properties, cur,
    fmtUi, fmtPdf, fmtDate, todayStr, esc, daysBetween, daysLabel,
    genId, resName, showConfirm, cleanForFirebase, resDoc, propDoc
} from './modules/utils.js';
import { buildRateHistory, calcPaymentWithHistory, calcCurrentPayment } from './modules/rate-history.js';
import { render, updateUI, setFilter, goPage, changePageSize, toggleSection, restoreCollapsed, toggleGroupByProp, renderCheckoutForecast, setFilterType, clearFilters } from './modules/ui.js';
import {
    openForm, closeForm, editResident, saveResident, checkOut, deleteResident,
    showHistory, removeRateSeg, onPropSelect, selectMode, selectedIds,
    toggleSelectMode, cancelSelect, toggleSelectItem, toggleSelectAll,
    deleteSelected, checkoutSelected, getFreeSpots, onRoomSelect
} from './modules/residents.js';
import {
    renderProperties, openPropForm, closePropForm, saveProp, deleteProp,
    propSelectMode, togglePropSelect, cancelPropSelect, togglePropItem, toggleSelectAllProps,
    deleteSelectedProps, goPropPage, changePropPageSize,
    openRoomForm, closeRoomForm, saveRoom, deleteRoom
} from './modules/properties.js';
import {
    applyTheme, getThemePref, toggleTheme, setThemeOption, initTheme,
    openSettings, closeSettings, previewCurrency, applyLangImmediate, saveSettings,
    renderFieldManager, deleteFieldValue, renderMembers, removeMember,
    inviteUser, confirmExitOverlay, initMouseTrack
} from './modules/settings.js';
import {
    openReport, closeReport, refreshReport, setPeriod,
    showExportDialog, selectExportOpt, doExport,
    importCSV, downloadCSVTemplate
} from './modules/report-export.js';
import {
    switchAuthLang, togglePassVis, switchAuthTab, doLogin, doRegister,
    doGoogle, doForgotPass, toggleUserMenu, doLogout, doSwitchAccount,
    onUserLoggedIn, onUserLoggedOut, initAuthEvents
} from './modules/auth.js';
import { isPro, canAddResident, canAddProperty, showUpgradeModal, openSubscription, getPlanLabel, getPlanStyle, applyReferralCode, checkStripeReturn } from './modules/subscription.js';
import {
    expSelectMode, renderFinSummary, renderExpenses, openExpenseForm, closeExpenseForm,
    saveExpense, deleteExpense, setFinCategoryFilter, setFinPropFilter,
    goFinPage, changeFinPageSize, toggleExpSelect, cancelExpSelect,
    toggleExpItem, toggleSelectAllExp, deleteSelectedExp
} from './modules/finance.js';
import {
    renderBookings, openBookingForm, closeBookingForm, saveBooking, deleteBooking,
    setBookingStatus, checkInBooking, onBookPropSelect, setBookStatusFilter,
    setBookViewMode, goCalMonth, goBookPage, changeBookPageSize,
    toggleBookSelect, cancelBookSelect, toggleBookItem, toggleSelectAllBooks, deleteSelectedBooks
} from './modules/bookings.js';

// ===== LONG PRESS SELECTION LOGIC =====
let _pressTimer = null;
let _pressTarget = null;
let _isScrolling = false;

function clearPressTimer() {
    if (_pressTimer) { clearTimeout(_pressTimer); _pressTimer = null; }
    _pressTarget = null;
}

function handlePressStart(e) {
    if (e.touches && e.touches.length > 1) return;
    if (e.button && e.button !== 0) return;
    _isScrolling = false;

    const card = e.target.closest('.longpress-card');
    const expCard = e.target.closest('.longpress-exp');
    const propCard = e.target.closest('.prop-card');

    if (card && !selectMode) {
        _pressTarget = { type: 'res', id: card.dataset.id };
    } else if (expCard && !expSelectMode) {
        _pressTarget = { type: 'exp', id: expCard.dataset.eid };
    } else if (propCard && !propSelectMode) {
        _pressTarget = { type: 'prop', id: propCard.dataset.id };
    } else {
        return;
    }

    _pressTimer = setTimeout(() => {
        if (!_pressTarget || _isScrolling) return;
        if (navigator.vibrate) navigator.vibrate(50);

        const targetId = _pressTarget.id;

        if (_pressTarget.type === 'res') {
            toggleSelectMode();
            setTimeout(() => {
                const cb = document.querySelector(`.sel-check[data-id="${targetId}"]`);
                if (cb) { cb.checked = true; toggleSelectItem(targetId, cb); }
            }, 50);
        } else if (_pressTarget.type === 'exp') {
            toggleExpSelect();
            setTimeout(() => {
                const cb = document.querySelector(`.sel-check[data-eid="${targetId}"]`);
                if (cb) { cb.checked = true; toggleExpItem(targetId, cb); }
            }, 50);
        } else if (_pressTarget.type === 'prop') {
            togglePropSelect();
            setTimeout(() => {
                const cb = document.querySelector(`.sel-check[data-pid="${targetId}"]`);
                if (cb) { cb.checked = true; togglePropItem(targetId, cb); }
            }, 50);
        }
        _pressTarget = null;
    }, 500);
}

document.addEventListener('mousedown', handlePressStart);
document.addEventListener('touchstart', handlePressStart, { passive: true });
document.addEventListener('mouseup', clearPressTimer);
document.addEventListener('mouseleave', clearPressTimer);
document.addEventListener('touchend', clearPressTimer);
document.addEventListener('touchcancel', clearPressTimer);
document.addEventListener('scroll', () => { _isScrolling = true; clearPressTimer(); }, true);
document.addEventListener('touchmove', () => { _isScrolling = true; clearPressTimer(); }, { passive: true });

// ===== EXPOSE EVERYTHING TO WINDOW (for inline HTML handlers) =====
window._CURRENCIES = CURRENCIES;

// Utils
window.fmtDate = fmtDate;
window.daysBetween = daysBetween;
window.resName = resName;

// State
window._residents = window._residents || [];
window._settings = window._settings || { currency: 'PLN', lang: 'RU' };
window._properties = window._properties || [];
window._subscription = window._subscription || { plan: 'free' };
window._currentFilter = 'active';
window._expenses = window._expenses || [];
window._bookings = window._bookings || [];

// UI
window.render = render;
window.updateUI = updateUI;
window.setFilter = (f, btn) => { window._currentFilter = f; setFilter(f, btn); };
window.goPage = goPage;
window.changePageSize = changePageSize;
window.toggleSection = toggleSection;
window.restoreCollapsed = restoreCollapsed;
window.toggleGroupByProp = toggleGroupByProp;
window.renderCheckoutForecast = renderCheckoutForecast;
window.setFilterType = setFilterType;
window.clearFilters = clearFilters;

// Finance
window.renderFinSummary = renderFinSummary;
window.renderExpenses = renderExpenses;
window.openExpenseForm = openExpenseForm;
window.closeExpenseForm = closeExpenseForm;
window.saveExpense = saveExpense;
window.deleteExpense = deleteExpense;
window.setFinCategoryFilter = setFinCategoryFilter;
window.setFinPropFilter = setFinPropFilter;
window.goFinPage = goFinPage;
window.changeFinPageSize = changeFinPageSize;
window.toggleExpSelect = toggleExpSelect;
window.cancelExpSelect = cancelExpSelect;
window.toggleExpItem = toggleExpItem;
window.toggleSelectAllExp = toggleSelectAllExp;
window.deleteSelectedExp = deleteSelectedExp;

// Residents
window.openForm = openForm;
window.closeForm = closeForm;
window.editResident = editResident;
window.saveResident = saveResident;
window.checkOut = checkOut;
window.deleteResident = deleteResident;
window.showHistory = showHistory;
window.removeRateSeg = removeRateSeg;
window.onPropSelect = onPropSelect;
window.onRoomSelect = onRoomSelect;
window.toggleSelectMode = toggleSelectMode;
window.cancelSelect = cancelSelect;
window.toggleSelectItem = toggleSelectItem;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelected = deleteSelected;
window.checkoutSelected = checkoutSelected;

// Properties
window.renderProperties = renderProperties;
window.openPropForm = openPropForm;
window.closePropForm = closePropForm;
window.saveProp = saveProp;
window.deleteProp = deleteProp;
window.openRoomForm = openRoomForm;
window.closeRoomForm = closeRoomForm;
window.saveRoom = saveRoom;
window.deleteRoom = deleteRoom;
window.togglePropSelect = togglePropSelect;
window.cancelPropSelect = cancelPropSelect;
window.togglePropItem = togglePropItem;
window.toggleSelectAllProps = toggleSelectAllProps;
window.deleteSelectedProps = deleteSelectedProps;
window.goPropPage = goPropPage;
window.changePropPageSize = changePropPageSize;

// Settings & Theme
window.toggleTheme = toggleTheme;
window.setThemeOption = setThemeOption;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.previewCurrency = previewCurrency;
window.applyLangImmediate = applyLangImmediate;
window.saveSettings = saveSettings;
window.renderFieldManager = renderFieldManager;
window.deleteFieldValue = deleteFieldValue;
window.renderMembers = renderMembers;
window.removeMember = removeMember;
window.inviteUser = inviteUser;
window.confirmExitOverlay = confirmExitOverlay;

// Report & Export
window.openReport = openReport;
window.closeReport = closeReport;
window.refreshReport = refreshReport;
window.setPeriod = setPeriod;
window.showExportDialog = showExportDialog;
window.selectExportOpt = selectExportOpt;
window.doExport = doExport;
window.importCSV = importCSV;
window.downloadCSVTemplate = downloadCSVTemplate;

// Subscription
window.isPro = isPro;
window.openSubscription = openSubscription;
window.showUpgradeModal = showUpgradeModal;
window.applyReferralCode = applyReferralCode;
window.updatePlanBadge = function () {
    const badge = document.getElementById('plan-badge');
    if (!badge) return;
    const pro = isPro();
    badge.textContent = getPlanLabel();
    badge.style.cssText = 'display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;' + getPlanStyle();
    if (pro) badge.onclick = null;
    else badge.onclick = () => openSubscription();
};

// Bookings
window.renderBookings = renderBookings;
window.openBookingForm = openBookingForm;
window.closeBookingForm = closeBookingForm;
window.saveBooking = saveBooking;
window.deleteBooking = deleteBooking;
window.setBookingStatus = setBookingStatus;
window.checkInBooking = checkInBooking;
window.onBookPropSelect = onBookPropSelect;
window.setBookStatusFilter = setBookStatusFilter;
window.setBookViewMode = setBookViewMode;
window.goCalMonth = goCalMonth;
window.goBookPage = goBookPage;
window.changeBookPageSize = changeBookPageSize;
window.toggleBookSelect = toggleBookSelect;
window.cancelBookSelect = cancelBookSelect;
window.toggleBookItem = toggleBookItem;
window.toggleSelectAllBooks = toggleSelectAllBooks;
window.deleteSelectedBooks = deleteSelectedBooks;

// Auth
window.switchAuthLang = switchAuthLang;
window.togglePassVis = togglePassVis;
window.switchAuthTab = switchAuthTab;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doGoogle = doGoogle;
window.doForgotPass = doForgotPass;
window.toggleUserMenu = toggleUserMenu;
window.doLogout = doLogout;
window.doSwitchAccount = doSwitchAccount;
window.onUserLoggedIn = onUserLoggedIn;
window.onUserLoggedOut = onUserLoggedOut;

// ===== INITIALIZATION =====
initTheme();
initMouseTrack();
initAuthEvents();

// Patch onUserLoggedIn to also update plan badge after login
const _origLoggedIn = onUserLoggedIn;
window.onUserLoggedIn = function (user) {
    _origLoggedIn(user);
    // Give Firebase a moment to load subscription snapshot then update badge
    setTimeout(() => { if (window.updatePlanBadge) window.updatePlanBadge(); }, 1500);
    // Check if user just returned from Stripe payment
    setTimeout(() => checkStripeReturn(), 2000);
};

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
}


// ===== ARCHIVE MODAL =====
(function() {
  let archiveFilter = 'all';
  let archiveSort = { key: 'checkout', dir: -1 };
  let archivePage = 1;
  let archivePageSize = 10;

  window.setArchivePageSize = function(n) { archivePageSize = n; archivePage = 1; renderArchive(); };
  window.archiveGoPage = function(p) { archivePage = p; renderArchive(); };

  window.openArchiveModal = function() {
    const el = document.getElementById('archive-overlay');
    if (!el) return;
    el.classList.remove('hidden');
    const s = document.getElementById('archive-search');
    if (s) s.value = '';
    renderArchive();
    if (window.lucide) window.lucide.createIcons();
  };

  window.closeArchiveModal = function() {
    const el = document.getElementById('archive-overlay');
    if (el) el.classList.add('hidden');
  };

  window.setArchiveFilter = function(f, btn) {
    archiveFilter = f;
    document.querySelectorAll('#archive-overlay .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderArchive();
  };

  window.sortArchive = function(key) {
    if (archiveSort.key === key) archiveSort.dir *= -1;
    else { archiveSort.key = key; archiveSort.dir = -1; }
    renderArchive();
  };

  function sym() {
    return ({ PLN:'zł', EUR:'€', USD:'$' })[(window._settings||{}).currency] || 'zł';
  }

  function renderPaidCell(r) {
    const s = sym();
    if (r.paidAmount != null && r.paidAmount > 0) {
      return '<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--green)">' + r.paidAmount.toFixed(2) + ' ' + s + '</span>' +
        '<button onclick="editPaidAmount(\'' + r.id + '\',event)" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px" title="Змінити">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button></div>';
    }
    return '<button onclick="editPaidAmount(\'' + r.id + '\',event)" style="background:none;border:1px solid var(--border2);border-radius:6px;padding:3px 8px;cursor:pointer;color:var(--text3);font-size:11px;font-family:inherit">+ ' + (window._archiveI18n||{paid:'вказати'}).paid + '</button>';
  }

  window.editPaidAmount = function(id, event) {
    if (event) event.stopPropagation();
    const all = window._residents || [];
    const r = all.find(x => x.id === id);
    if (!r) return;
    const pay = window.calcCurrentPayment ? window.calcCurrentPayment(r) : 0;
    const s = sym();
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.style.zIndex = '9999';
    el.innerHTML = '<div class="confirm-box">' +
      '<div class="confirm-title">Фактично оплачено</div>' +
      '<div class="confirm-msg" style="margin-bottom:6px">' + (r.firstName||'') + ' ' + (r.lastName||'') + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Нараховано: <strong>' + pay.toFixed(2) + ' ' + s + '</strong></div>' +
      '<input type="number" id="paid-amount-input" class="field" value="' + (r.paidAmount != null ? r.paidAmount : '') + '" placeholder="0.00" min="0" step="0.01" style="width:100%;margin-bottom:4px">' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;text-align:left">Залиш порожнім щоб скинути</div>' +
      '<div class="confirm-btns"><button class="c-cancel" id="c-no">Скасувати</button><button class="c-ok" id="c-yes">Зберегти</button></div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#paid-amount-input').focus();
    el.querySelector('#c-no').onclick = () => el.remove();
    el.querySelector('#c-yes').onclick = async () => {
      const val = el.querySelector('#paid-amount-input').value.trim();
      el.remove();
      try {
        const resDoc = window._fb.doc(window._fb.db, 'users', window._currentUser.uid, 'residents', id);
        const data = Object.assign({}, r);
        delete data.id;
        data.paidAmount = val === '' ? null : parseFloat(val) || 0;
        await window._fb.setDoc(resDoc, data);
        renderArchive();
      } catch(e) { alert('Error: ' + e.message); }
    };
    el.onclick = (e) => { if (e.target === el) el.remove(); };
  };

  window.renderArchive = function() {
    const search = (document.getElementById('archive-search')?.value || '').toLowerCase();
    let list = (window._residents || []).filter(r => {
      if (archiveFilter === 'active') return !r.checkOutDate;
      if (archiveFilter === 'out') return !!r.checkOutDate;
      return true;
    });
    if (search) list = list.filter(r =>
      ((r.firstName||'') + ' ' + (r.lastName||'') + ' ' + (r.city||'') + ' ' + (r.address||''))
        .toLowerCase().includes(search)
    );

    list.sort((a, b) => {
      let va, vb;
      const name = r => ((r.firstName||'') + ' ' + (r.lastName||'')).toLowerCase();
      const calc = r => window.calcCurrentPayment ? window.calcCurrentPayment(r) : 0;
      const days = (ci, co) => {
        if (!ci) return 0;
        const d1 = new Date(ci), d2 = co ? new Date(co) : new Date();
        return Math.max(0, Math.round((d2 - d1) / 86400000));
      };
      if (archiveSort.key === 'name')     { va = name(a); vb = name(b); }
      else if (archiveSort.key === 'checkin')  { va = a.checkInDate || ''; vb = b.checkInDate || ''; }
      else if (archiveSort.key === 'checkout') { va = a.checkOutDate || '9999'; vb = b.checkOutDate || '9999'; }
      else if (archiveSort.key === 'days')     { va = days(a.checkInDate, a.checkOutDate); vb = days(b.checkInDate, b.checkOutDate); }
      else if (archiveSort.key === 'amount')   { va = calc(a); vb = calc(b); }
      else { va = ''; vb = ''; }
      return va < vb ? -archiveSort.dir : va > vb ? archiveSort.dir : 0;
    });

    ['name','checkin','checkout','days','amount'].forEach(k => {
      const el = document.getElementById('arch-sort-' + k);
      if (el) el.textContent = archiveSort.key === k ? (archiveSort.dir === 1 ? ' ↑' : ' ↓') : '';
    });

    const tbody = document.getElementById('archive-tbody');
    const empty = document.getElementById('archive-empty');
    const s = sym();
    if (!tbody) return;
    if (!list.length) { tbody.innerHTML = ''; if(empty) empty.style.display = 'block'; }
    else { if(empty) empty.style.display = 'none'; }

    const fmtD = d => {
      if (!d) return '—';
      if (window.fmtDate) return window.fmtDate(d);
      return d;
    };

    let totalSum = 0;
    tbody.innerHTML = list.map(r => {
      const isA = !r.checkOutDate;
      const pay = window.calcCurrentPayment ? window.calcCurrentPayment(r) : 0;
      totalSum += pay;
      const d1 = r.checkInDate ? new Date(r.checkInDate) : null;
      const d2 = r.checkOutDate ? new Date(r.checkOutDate) : new Date();
      const days = d1 ? Math.max(0, Math.round((d2 - d1) / 86400000)) : 0;
      const fullName = ((r.firstName||'') + ' ' + (r.lastName||'')).trim() || '?';
      const initial = fullName.charAt(0).toUpperCase();
      const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];
      const bg = colors[fullName.charCodeAt(0) % colors.length];
      const amountColor = isA ? 'var(--accent)' : 'var(--text2)';

      return '<tr style="border-bottom:1px solid var(--border);' + (!isA ? 'opacity:0.75' : '') + '">' +
        '<td style="padding:10px 20px"><div style="display:flex;align-items:center;gap:9px">' +
          '<div style="width:30px;height:30px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0">' + initial + '</div>' +
          '<div><div style="font-weight:600;color:var(--text)">' + fullName + '</div>' +
          (isA ? '<div style="font-size:10px;color:var(--green)">● ' + (window._archiveI18n||{active:'active'}).active + '</div>' : '<div style="font-size:10px;color:var(--text3)">' + (window._archiveI18n||{out:'checked out'}).out + '</div>') +
          '</div></div></td>' +
        '<td style="padding:10px 8px;color:var(--text3);font-size:12px">' + ((r.city||'') + (r.address ? ' · ' + r.address : '')) + '</td>' +
        '<td style="padding:10px 8px;font-size:12px">' + fmtD(r.checkInDate) + '</td>' +
        '<td style="padding:10px 8px;font-size:12px">' + fmtD(r.checkOutDate) + '</td>' +
        '<td style="padding:10px 8px;text-align:right;font-size:12px">' + days + '</td>' +
        '<td style="padding:10px 8px;text-align:right;white-space:nowrap"><div style="font-weight:700;color:' + amountColor + ';font-size:12px">' + pay.toFixed(2) + ' ' + s + '</div></td>' +
        '<td style="padding:10px 8px;text-align:right">' + renderPaidCell(r) + '</td>' +
        '<td style="padding:10px 20px 10px 8px;text-align:right">' +
          '<button onclick="closeArchiveModal();window.editResident && window.editResident(\'' + r.id + '\')" style="background:none;border:1px solid var(--border2);border-radius:8px;padding:5px 10px;cursor:pointer;color:var(--text2);font-size:12px;font-family:inherit">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ' + (window._archiveI18n||{edit:'Edit'}).edit + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    const ai = window._archiveI18n || {records:'записів', edit:'Редагувати', noData:'Немає записів'};
    // Pagination
    const total_count = list.length;
    const totalPages = Math.max(1, Math.ceil(total_count / archivePageSize));
    if (archivePage > totalPages) archivePage = totalPages;
    const start = (archivePage - 1) * archivePageSize;
    const pageList = list.slice(start, start + archivePageSize);

    // Re-render tbody with paginated list
    if (!pageList.length && total_count > 0) { archivePage = 1; renderArchive(); return; }

    let pagedTotalSum = 0;
    tbody.innerHTML = pageList.map(r => {
      const isA = !r.checkOutDate;
      const pay = window.calcCurrentPayment ? window.calcCurrentPayment(r) : 0;
      pagedTotalSum += pay;
      const d1 = r.checkInDate ? new Date(r.checkInDate) : null;
      const d2 = r.checkOutDate ? new Date(r.checkOutDate) : new Date();
      const days = d1 ? Math.max(0, Math.round((d2 - d1) / 86400000)) : 0;
      const fullName = ((r.firstName||'') + ' ' + (r.lastName||'')).trim() || '?';
      const initial = fullName.charAt(0).toUpperCase();
      const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];
      const bg = colors[fullName.charCodeAt(0) % colors.length];
      const amountColor = isA ? 'var(--accent)' : 'var(--text2)';
      return '<tr style="border-bottom:1px solid var(--border);' + (!isA ? 'opacity:0.75' : '') + '">' +
        '<td style="padding:10px 20px"><div style="display:flex;align-items:center;gap:9px">' +
          '<div style="width:30px;height:30px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0">' + initial + '</div>' +
          '<div><div style="font-weight:600;color:var(--text)">' + fullName + '</div>' +
          (isA ? '<div style="font-size:10px;color:var(--green)">● ' + (window._archiveI18n||{}).active + '</div>' : '<div style="font-size:10px;color:var(--text3)">' + (window._archiveI18n||{}).out + '</div>') +
          '</div></div></td>' +
        '<td style="padding:10px 8px;color:var(--text3);font-size:12px">' + ((r.city||'') + (r.address ? ' · ' + r.address : '')) + '</td>' +
        '<td style="padding:10px 8px;font-size:12px">' + fmtD(r.checkInDate) + '</td>' +
        '<td style="padding:10px 8px;font-size:12px">' + fmtD(r.checkOutDate) + '</td>' +
        '<td style="padding:10px 8px;text-align:right;font-size:12px">' + days + '</td>' +
        '<td style="padding:10px 8px;text-align:right;white-space:nowrap"><div style="font-weight:700;color:' + amountColor + ';font-size:12px">' + pay.toFixed(2) + ' ' + s + '</div></td>' +
        '<td style="padding:10px 8px;text-align:right">' + renderPaidCell(r) + '</td>' +
        '<td style="padding:10px 20px 10px 8px;text-align:right">' +
          '<button onclick="closeArchiveModal();window.editResident && window.editResident('' + r.id + '')" style="background:none;border:1px solid var(--border2);border-radius:8px;padding:5px 10px;cursor:pointer;color:var(--text2);font-size:12px;font-family:inherit">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ' + (window._archiveI18n||{edit:'Edit'}).edit + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    const countEl = document.getElementById('archive-count');
    const sumEl = document.getElementById('archive-total-sum');
    const emptyEl = document.getElementById('archive-empty');
    if (countEl) countEl.textContent = total_count + ' ' + (ai.records||'records');
    if (sumEl) sumEl.textContent = total_count ? totalSum.toFixed(2) + ' ' + s : '';
    if (emptyEl) emptyEl.textContent = ai.noData || 'No records';

    // Pagination controls
    let pgEl = document.getElementById('archive-pagination');
    if (!pgEl) {
      pgEl = document.createElement('div');
      pgEl.id = 'archive-pagination';
      pgEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 24px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px';
      const footer = document.querySelector('#archive-overlay .modal > div:last-child');
      if (footer) footer.parentNode.insertBefore(pgEl, footer);
    }
    const sizeBtn = (n) => '<button onclick="setArchivePageSize(' + n + ')" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);cursor:pointer;font-size:12px;font-family:inherit;background:' + (archivePageSize===n?'var(--accent)':'var(--surface)') + ';color:' + (archivePageSize===n?'#000':'var(--text2)') + '">' + n + '</button>';
    const navBtn = (p, label, disabled) => '<button onclick="archiveGoPage(' + p + ')" ' + (disabled?'disabled':'') + ' style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);cursor:pointer;font-size:12px;font-family:inherit;background:var(--surface);color:' + (disabled?'var(--text4)':'var(--text2)') + '">' + label + '</button>';
    pgEl.innerHTML =
      '<div style="display:flex;gap:4px;align-items:center"><span style="font-size:12px;color:var(--text3);margin-right:4px">Show:</span>' + sizeBtn(10) + sizeBtn(50) + sizeBtn(100) + '</div>' +
      '<div style="display:flex;gap:4px;align-items:center">' +
        navBtn(archivePage-1, '←', archivePage<=1) +
        '<span style="font-size:12px;color:var(--text3);padding:0 6px">' + archivePage + ' / ' + totalPages + '</span>' +
        navBtn(archivePage+1, '→', archivePage>=totalPages) +
      '</div>';

    if (window.lucide) window.lucide.createIcons();
  };
})();

// ===== STAT MODAL =====
window._paidMap = {};

window.openStatModal = function(type) {
  const all = window._residents || [];
  const active = all.filter(r => !r.checkOutDate);
  const body = document.getElementById('stat-modal-body');
  const title = document.getElementById('stat-modal-title');
  if (!body || !title) return;
  const cur = (window._settings && window._settings.currency) || 'PLN';
  const sym = ({PLN:'zł',EUR:'€',USD:'$'})[cur] || 'zł';
  const T = t;

  function fmtM(n) { return n.toFixed(2) + ' ' + sym; }
  function rName(r) { return ((r.firstName||'') + ' ' + (r.lastName||'')).trim() || '—'; }
  function calcPay(r) { return window.calcCurrentPayment ? window.calcCurrentPayment(r) : (r.monthlyRate||0); }
  function propLabel(r) {
    const p = (window._properties||[]).find(x => x.id === r.propertyId);
    return p ? (p.address || p.city || '—') : '—';
  }
  function groupByProp(list) {
    const map = {};
    list.forEach(r => { const k = propLabel(r); if (!map[k]) map[k] = []; map[k].push(r); });
    return map;
  }
  function propHeader(label, count, total, showTotal) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;' +
      'padding:8px 12px;background:var(--surface);border-radius:8px;margin:14px 0 6px;border:1px solid var(--border)">' +
      '<span style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">📍 ' + label + '</span>' +
      '<span style="font-size:12px;color:var(--text3)">' + count + (showTotal ? ' · <strong style="color:var(--accent)">' + fmtM(total) + '</strong>' : '') + '</span>' +
      '</div>';
  }
  function avatar(r, bg) {
    const i = ((r.firstName||'?')[0]+(r.lastName||'?')[0]).toUpperCase();
    return '<div style="width:30px;height:30px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">' + i + '</div>';
  }

  let html = '';

  if (type === 'residents') {
    title.textContent = T('active') || 'Aktywni';
    if (!active.length) { html = '<div style="text-align:center;padding:30px;color:var(--text3)">' + T('noData') + '</div>'; }
    else {
      const groups = groupByProp(active);
      Object.keys(groups).sort().forEach(addr => {
        const list = groups[addr];
        html += propHeader(addr, list.length, 0, false);
        list.forEach(r => {
          const pay = calcPay(r);
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 4px;border-bottom:1px solid var(--border)">' +
            '<div style="display:flex;align-items:center;gap:10px">' + avatar(r,'var(--accent)') +
            '<div><div style="font-weight:600;font-size:14px">' + rName(r) + '</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + fmtM(r.monthlyRate||0) + T('perMonth') + '</div></div></div>' +
            '<div style="font-weight:700;color:var(--accent)">' + fmtM(pay) + '</div></div>';
        });
      });
      const total = active.reduce((s,r)=>s+calcPay(r),0);
      html += '<div style="margin-top:14px;padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;display:flex;justify-content:space-between;font-weight:700">' +
        '<span>' + T('totalLabel') + ':</span><span style="color:var(--accent)">' + fmtM(total) + '</span></div>';
    }

  } else if (type === 'owed') {
    title.textContent = T('owed') || 'Do zapłaty';
    if (!active.length) { html = '<div style="text-align:center;padding:30px;color:var(--text3)">' + T('noData') + '</div>'; }
    else {
      const groups = groupByProp(active);
      Object.keys(groups).sort().forEach(addr => {
        const list = groups[addr].sort((a,b)=>calcPay(b)-calcPay(a));
        const groupTotal = list.reduce((s,r)=>s+calcPay(r),0);
        html += propHeader(addr, list.length, groupTotal, true);
        list.forEach(r => {
          const pay = calcPay(r);
          const paid = !!window._paidMap[r.id];
          const paidAt = window._paidMap[r.id];
          html += '<div id="paid-row-' + r.id + '" style="display:flex;justify-content:space-between;align-items:center;padding:9px 4px;border-bottom:1px solid var(--border);' + (paid?'opacity:0.55':'') + '">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
            '<label style="cursor:pointer"><input type="checkbox" ' + (paid?'checked':'') + ' onchange="window.togglePaid(\'' + r.id + '\',this.checked)" style="width:17px;height:17px;accent-color:#22c55e;cursor:pointer"></label>' +
            avatar(r, paid?'#22c55e':'var(--accent)') +
            '<div><div style="font-weight:600;font-size:14px' + (paid?';text-decoration:line-through':'') + '">' + rName(r) + '</div>' +
            '<div style="font-size:11px;color:var(--text3)">' + fmtM(r.monthlyRate||0) + T('perMonth') + (paidAt&&typeof paidAt==='string'?' · ✅ '+paidAt:'') + '</div></div></div>' +
            '<div style="font-weight:700;color:' + (paid?'#22c55e':'var(--accent)') + '">' + fmtM(pay) + '</div></div>';
        });
      });
      const total = active.reduce((s,r)=>s+calcPay(r),0);
      const paidTotal = active.filter(r=>window._paidMap[r.id]).reduce((s,r)=>s+calcPay(r),0);
      const paidLbls={PL:'Opłacono',UA:'Оплачено',RU:'Оплачено',EN:'Paid',LT:'Sumokėta'};
  const remLbls={PL:'Pozostało',UA:'Залишилось',RU:'Осталось',EN:'Remaining',LT:'Liko'};
  const uiLang=(window._settings&&window._settings.lang)||'PL';
  html += '<div style="margin-top:14px;padding:12px;background:rgba(245,158,11,0.1);border-radius:8px">' +
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px"><span>' + T('totalLabel') + ':</span><span style="color:var(--accent)">' + fmtM(total) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:#22c55e"><span>✅ ' + (paidLbls[uiLang]||'Paid') + ':</span><span>' + fmtM(paidTotal) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3)"><span>' + (remLbls[uiLang]||'Remaining') + ':</span><span>' + fmtM(total-paidTotal) + '</span></div></div>';
    }

  } else if (type === 'total') {
    title.textContent = T('total') + ' — ' + T('all');
    if (!all.length) { html = '<div style="text-align:center;padding:30px;color:var(--text3)">' + T('noData') + '</div>'; }
    else {
      const groups = groupByProp(all);
      Object.keys(groups).sort().forEach(addr => {
        const list = groups[addr];
        const gTotal = list.reduce((s,r)=>s+calcPay(r),0);
        html += propHeader(addr, list.length, gTotal, true);
        list.forEach(r => {
          const pay = calcPay(r);
          const isA = !r.checkOutDate;
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 4px;border-bottom:1px solid var(--border)">' +
            '<div style="display:flex;align-items:center;gap:10px">' + avatar(r,isA?'var(--accent)':'#4b5563') +
            '<div><div style="font-weight:600;font-size:14px">' + rName(r) +
            '<span style="margin-left:6px;font-size:10px;padding:2px 6px;border-radius:4px;background:' + (isA?'rgba(106,184,154,0.15)':'rgba(180,180,180,0.15)') + ';color:' + (isA?'var(--green)':'var(--text3)') + '">' +
            (isA?T('active'):T('out')) + '</span></div>' +
            '<div style="font-size:11px;color:var(--text3)">' + fmtM(r.monthlyRate||0) + T('perMonth') + '</div></div></div>' +
            '<div style="font-weight:700;color:' + (isA?'var(--accent)':'var(--text3)') + '">' + fmtM(pay) + '</div></div>';
        });
      });
      const totalAmt = all.reduce((s,r)=>s+calcPay(r),0);
      html += '<div style="margin-top:14px;padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;display:flex;justify-content:space-between;font-weight:700">' +
        '<span>' + T('totalLabel') + ':</span><span style="color:var(--accent)">' + fmtM(totalAmt) + '</span></div>';
    }
  }

  body.innerHTML = html;
  document.getElementById('stat-modal-overlay').classList.remove('hidden');
};

window.togglePaid = function(resId, checked) {
  if (checked) {
    const now = new Date();
    window._paidMap[resId] = now.toLocaleDateString('pl-PL', {day:'2-digit',month:'2-digit',year:'numeric'});
  } else {
    delete window._paidMap[resId];
  }
  window.openStatModal('owed');
};

window.closeStatModal = function() {
  const el = document.getElementById('stat-modal-overlay');
  if (el) el.classList.add('hidden');
};
