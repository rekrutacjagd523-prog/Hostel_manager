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
import './modules/firebase-api.js?v=3';

import { CURRENCIES, HTYPES, t } from './modules/constants.js?v=3';
window.t = t;
import {
    settings, residents, properties, cur,
    fmtUi, fmtPdf, fmtDate, todayStr, esc, daysBetween, daysLabel,
    genId, resName, showConfirm, cleanForFirebase, resDoc, propDoc
} from './modules/utils.js?v=3';
import { buildRateHistory, calcPaymentWithHistory, calcCurrentPayment } from './modules/rate-history.js?v=3';
import { render, updateUI, setFilter, goPage, changePageSize, toggleSection, restoreCollapsed, toggleGroupByProp, renderCheckoutForecast, setFilterType, clearFilters } from './modules/ui.js?v=3';
import {
    openForm, closeForm, editResident, saveResident, checkOut, deleteResident,
    showHistory, removeRateSeg, onPropSelect, selectMode, selectedIds,
    toggleSelectMode, cancelSelect, toggleSelectItem, toggleSelectAll,
    deleteSelected, checkoutSelected, getFreeSpots, onRoomSelect
} from './modules/residents.js?v=3';
import {
    renderProperties, openPropForm, closePropForm, saveProp, deleteProp,
    propSelectMode, togglePropSelect, cancelPropSelect, togglePropItem, toggleSelectAllProps,
    deleteSelectedProps, goPropPage, changePropPageSize,
    openRoomForm, closeRoomForm, saveRoom, deleteRoom
} from './modules/properties.js?v=3';
import {
    applyTheme, getThemePref, toggleTheme, setThemeOption, initTheme,
    openSettings, closeSettings, previewCurrency, applyLangImmediate, saveSettings,
    renderFieldManager, deleteFieldValue, renderMembers, removeMember,
    inviteUser, confirmExitOverlay, initMouseTrack
} from './modules/settings.js?v=3';
import {
    openReport, closeReport, refreshReport, setPeriod,
    showExportDialog, selectExportOpt, doExport,
    importCSV, downloadCSVTemplate
} from './modules/report-export.js?v=3';
import {
    switchAuthLang, togglePassVis, switchAuthTab, doLogin, doRegister,
    doGoogle, doForgotPass, toggleUserMenu, doLogout, doSwitchAccount,
    onUserLoggedIn, onUserLoggedOut, initAuthEvents
} from './modules/auth.js?v=3';
import { isPro, canAddResident, canAddProperty, showUpgradeModal, openSubscription, getPlanLabel, getPlanStyle, applyReferralCode, checkStripeReturn } from './modules/subscription.js?v=3';
import {
    expSelectMode, renderFinSummary, renderExpenses, openExpenseForm, closeExpenseForm,
    saveExpense, deleteExpense, setFinCategoryFilter, setFinPropFilter,
    goFinPage, changeFinPageSize, toggleExpSelect, cancelExpSelect,
    toggleExpItem, toggleSelectAllExp, deleteSelectedExp
} from './modules/finance.js?v=3';
import {
    renderBookings, openBookingForm, closeBookingForm, saveBooking, deleteBooking,
    setBookingStatus, checkInBooking, onBookPropSelect, setBookStatusFilter,
    setBookViewMode, goCalMonth, goBookPage, changeBookPageSize,
    toggleBookSelect, cancelBookSelect, toggleBookItem, toggleSelectAllBooks, deleteSelectedBooks
} from './modules/bookings.js?v=3';

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
            toggleSelectMode(targetId);
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
          '<button onclick="closeArchiveModal();window.editResident && window.editResident(\'' + r.id + '\')" style="background:none;border:1px solid var(--border2);border-radius:8px;padding:5px 10px;cursor:pointer;color:var(--text2);font-size:12px;font-family:inherit">' +
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


