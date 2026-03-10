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

import { CURRENCIES, HTYPES } from './modules/constants.js';
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
    deleteSelected, checkoutSelected, getFreeSpots
} from './modules/residents.js';
import {
    renderProperties, openPropForm, closePropForm, saveProp, deleteProp,
    togglePropSelect, cancelPropSelect, togglePropItem, toggleSelectAllProps,
    deleteSelectedProps, goPropPage, changePropPageSize
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
import { isPro, canAddResident, canAddProperty, showUpgradeModal, openSubscription, getPlanLabel, getPlanStyle, applyReferralCode } from './modules/subscription.js';

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
};

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
}

