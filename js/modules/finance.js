// ===== FINANCE MODULE =====
import { t } from './constants.js';
import { residents, properties, expenses, fmtUi, todayStr, showConfirm, expDoc, genId, esc } from './utils.js';
import { calcCurrentPayment } from './rate-history.js';
import { canAddExpense, showUpgradeModal } from './subscription.js';

const CATEGORIES = ['utilities', 'supplies', 'repairs', 'salary', 'other'];

export let expSelectMode = false;
export let selectedExpIds = new Set();
export let finPage = 1;
export let finPageSize = 10;
let filterCategory = '';
let filterPropId = '';

export function goFinPage(p) { finPage = p; renderExpenses(); }
export function changeFinPageSize(v) { finPageSize = parseInt(v); finPage = 1; renderExpenses(); }

export function setFinCategoryFilter(cat) {
    filterCategory = (filterCategory === cat) ? '' : cat;
    finPage = 1;
    // Update filter tab styles
    document.querySelectorAll('.fin-cat-tab').forEach(btn => {
        const isActive = btn.dataset.cat === filterCategory;
        btn.style.background = isActive ? 'var(--accent)' : '';
        btn.style.color = isActive ? '#fff' : '';
        btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border3)';
    });
    renderExpenses();
}

export function setFinPropFilter(propId) {
    filterPropId = propId;
    finPage = 1;
    renderExpenses();
}

// ===== CALCULATIONS =====

export function calcProjectedIncome() {
    return residents().filter(r => !r.checkOutDate).reduce((s, r) => s + (r.monthlyRate || 0), 0);
}

export function calcActualIncome() {
    return expenses().filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
}

export function calcTotalExpenses() {
    return expenses().filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
}

export function calcNetProfit() {
    return calcActualIncome() - calcTotalExpenses();
}

// ===== RENDER SUMMARY =====

export function renderFinSummary() {
    const el = document.getElementById('fin-summary');
    if (!el) return;
    const projected = calcProjectedIncome();
    const actual = calcActualIncome();
    const totalExp = calcTotalExpenses();
    const net = calcNetProfit();
    const netColor = net >= 0 ? 'var(--green)' : 'var(--red)';
    el.innerHTML =
        '<div class="fin-stat"><div class="fin-stat-icon" style="background:rgba(106,184,154,.1);color:var(--green)">📊</div><div><div class="fin-stat-value">' + fmtUi(projected) + '</div><div class="fin-stat-label" id="lbl-projected-income">' + t('projectedIncome') + '</div></div></div>' +
        '<div class="fin-stat"><div class="fin-stat-icon" style="background:rgba(232,168,56,.15);color:var(--accent)">💰</div><div><div class="fin-stat-value">' + fmtUi(actual) + '</div><div class="fin-stat-label" id="lbl-actual-income">' + t('actualIncome') + '</div></div></div>' +
        '<div class="fin-stat"><div class="fin-stat-icon" style="background:rgba(212,85,85,.1);color:var(--red)">📉</div><div><div class="fin-stat-value">' + fmtUi(totalExp) + '</div><div class="fin-stat-label" id="lbl-total-expenses">' + t('totalExpenses') + '</div></div></div>' +
        '<div class="fin-stat"><div class="fin-stat-icon" style="background:rgba(176,154,218,.1);color:var(--purple)">💎</div><div><div class="fin-stat-value" style="color:' + netColor + '">' + fmtUi(net) + '</div><div class="fin-stat-label" id="lbl-net-profit">' + t('netProfit') + '</div></div></div>';
}

// ===== RENDER EXPENSES LIST =====

export function renderExpenses() {
    const list = document.getElementById('expenses-list');
    if (!list) return;
    const all = expenses();
    let filtered = all;
    if (filterCategory) filtered = filtered.filter(e => e.category === filterCategory);
    if (filterPropId) filtered = filtered.filter(e => e.propertyId === filterPropId);

    if (!filtered.length) {
        list.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text4);font-size:13px">' + t('noExpenses') + '</div>';
        document.getElementById('fin-pagination').innerHTML = '';
        return;
    }

    let h = '';
    if (expSelectMode) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;margin-bottom:4px">' +
            '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--text2)"><input type="checkbox" class="sel-check" id="sel-all-exp" onchange="toggleSelectAllExp()" ' + (selectedExpIds.size === filtered.length ? 'checked' : '') + '> ' + t('selectAll') + '</label>' +
            '<span style="font-size:12px;color:var(--accent);font-weight:700" id="exp-sel-count">' + (selectedExpIds.size > 0 ? selectedExpIds.size + ' ' + t('selected') : '') + '</span>' +
            '<button class="btn btn-secondary" onclick="deleteSelectedExp()" id="btn-del-sel-exp" style="display:' + (selectedExpIds.size > 0 ? 'inline-block' : 'none') + ';font-size:11px;padding:4px 10px;color:var(--red)">' + t('deleteSelected') + '</button>' +
            '<button class="btn btn-secondary" onclick="cancelExpSelect()" style="font-size:11px;padding:4px 10px">✕</button>' +
            '</div>';
    }

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / finPageSize);
    if (finPage > totalPages) finPage = totalPages;
    if (finPage < 1) finPage = 1;
    const startIdx = (finPage - 1) * finPageSize;
    const paged = filtered.slice(startIdx, startIdx + finPageSize);

    h += paged.map(e => {
        const isIncome = e.type === 'income';
        const amountColor = isIncome ? 'var(--green)' : 'var(--red)';
        const sign = isIncome ? '+' : '-';
        const catLabel = e.category ? t(e.category === 'other' ? 'otherCat' : e.category) : '';
        const prop = e.propertyId ? properties().find(p => p.id === e.propertyId) : null;
        const propLabel = prop ? esc(prop.city) + ' · ' + esc(prop.address) : '';
        const dateLabel = window.fmtDate ? window.fmtDate(e.date) : e.date;
        return '<div class="prop-card longpress-exp" data-eid="' + e.id + '" style="' + (expSelectMode ? 'cursor:pointer' : '') + '" ' +
            (expSelectMode ? 'onclick="if(event.target.type!==\'checkbox\'){const cb=this.querySelector(\'.sel-check\');if(cb){cb.checked=!cb.checked;toggleExpItem(\'' + e.id + '\',cb);}}"' : '') + '>' +
            (expSelectMode ? '<input type="checkbox" class="sel-check" data-eid="' + e.id + '" ' + (selectedExpIds.has(e.id) ? 'checked' : '') + ' onchange="toggleExpItem(\'' + e.id + '\',this)" style="flex-shrink:0">' : '') +
            '<div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:center"><div class="prop-name">' + esc(e.description || '—') + '</div>' +
            '<div style="font-weight:700;font-size:15px;color:' + amountColor + '">' + sign + fmtUi(e.amount || 0) + '</div></div>' +
            '<div class="prop-meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
            '<span class="tag">' + dateLabel + '</span>' +
            '<span class="tag type">' + (isIncome ? t('income') : t('expense')) + '</span>' +
            (catLabel ? '<span class="tag">' + catLabel + '</span>' : '') +
            (propLabel ? '<span class="tag">' + propLabel + '</span>' : '') +
            '</div></div>' +
            '<div class="prop-actions" onclick="event.stopPropagation()">' +
            '<button class="btn-sm" onclick="openExpenseForm(\'' + e.id + '\')">✏️</button>' +
            '<button class="btn-sm danger" onclick="deleteExpense(\'' + e.id + '\')">🗑</button>' +
            '</div></div>';
    }).join('');

    list.innerHTML = h;

    // Pagination
    const pgBar = document.getElementById('fin-pagination');
    if (totalPages <= 1 && totalItems <= 10) { pgBar.innerHTML = ''; return; }
    let pg = '';
    if (totalPages > 1) {
        pg += '<button class="pg-btn" onclick="goFinPage(' + (finPage - 1) + ')"' + (finPage === 1 ? ' disabled' : '') + '>&lsaquo;</button>';
        let start = Math.max(1, finPage - 2), end = Math.min(totalPages, finPage + 2);
        if (start > 1) { pg += '<button class="pg-btn" onclick="goFinPage(1)">1</button>'; if (start > 2) pg += '<span class="pg-dots">…</span>'; }
        for (let i = start; i <= end; i++) pg += '<button class="pg-btn' + (i === finPage ? ' active' : '') + '" onclick="goFinPage(' + i + ')">' + i + '</button>';
        if (end < totalPages) { if (end < totalPages - 1) pg += '<span class="pg-dots">…</span>'; pg += '<button class="pg-btn" onclick="goFinPage(' + totalPages + ')">' + totalPages + '</button>'; }
        pg += '<button class="pg-btn" onclick="goFinPage(' + (finPage + 1) + ')"' + (finPage === totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
    }
    pg += '<span class="pg-info">' + (startIdx + 1) + '–' + Math.min(startIdx + finPageSize, totalItems) + ' / ' + totalItems + '</span>';
    pg += '<select class="pg-select" onchange="changeFinPageSize(this.value)">';
    [10, 50, 100].forEach(n => { pg += '<option value="' + n + '"' + (finPageSize === n ? ' selected' : '') + '>' + n + '</option>'; });
    pg += '</select>';
    pgBar.innerHTML = pg;
}

// ===== CRUD =====

export function openExpenseForm(id) {
    document.getElementById('fin-overlay').classList.remove('hidden');
    // Apply correct locale to date inputs
    const _hl = { RU: 'ru', PL: 'pl', UA: 'uk', EN: 'en', LT: 'lt' };
    const _dl = _hl[(window._settings || {}).lang || 'PL'] || 'pl';
    document.querySelectorAll('input[type="date"]').forEach(el => el.setAttribute('lang', _dl));

    if (id) {
        const e = expenses().find(x => x.id === id); if (!e) return;
        document.getElementById('fin-form-title').textContent = '💰 ' + t('editExpense');
        document.getElementById('fin-edit-id').value = id;
        document.getElementById('fin-type').value = e.type || 'expense';
        document.getElementById('fin-category').value = e.category || 'other';
        document.getElementById('fin-amount').value = e.amount || 0;
        document.getElementById('fin-date').value = e.date || todayStr();
        document.getElementById('fin-desc').value = e.description || '';
        document.getElementById('fin-prop').value = e.propertyId || '';
    } else {
        document.getElementById('fin-form-title').textContent = '💰 ' + t('newExpense');
        document.getElementById('fin-edit-id').value = '';
        document.getElementById('fin-type').value = 'expense';
        document.getElementById('fin-category').value = 'other';
        document.getElementById('fin-amount').value = '';
        document.getElementById('fin-date').value = todayStr();
        document.getElementById('fin-desc').value = '';
        document.getElementById('fin-prop').value = '';
    }
    // Populate property dropdown
    const sel = document.getElementById('fin-prop');
    const props = properties();
    sel.innerHTML = '<option value="">— ' + t('selectProp') + ' —</option>' +
        props.map(p => '<option value="' + p.id + '"' + (id && expenses().find(x => x.id === id)?.propertyId === p.id ? ' selected' : '') + '>' + esc(p.city + ' · ' + p.address) + '</option>').join('');
}

export function closeExpenseForm() { document.getElementById('fin-overlay').classList.add('hidden'); }

export async function saveExpense() {
    const type = document.getElementById('fin-type').value;
    const category = document.getElementById('fin-category').value;
    const amount = parseFloat(document.getElementById('fin-amount').value) || 0;
    const date = document.getElementById('fin-date').value;
    const description = document.getElementById('fin-desc').value.trim();
    const propertyId = document.getElementById('fin-prop').value || null;
    if (!amount || !date) return alert(t('expAmount') + '!');
    const editId = document.getElementById('fin-edit-id').value;
    if (!editId && !canAddExpense()) {
        return showUpgradeModal('expenses');
    }
    const data = { type, category, amount, date, description, propertyId };
    try {
        if (editId) {
            const existing = expenses().find(e => e.id === editId);
            if (existing) data.createdAt = existing.createdAt;
            await window._fb.setDoc(expDoc(editId), data);
        } else {
            data.createdAt = new Date().toISOString();
            await window._fb.setDoc(expDoc(genId()), data);
        }
        closeExpenseForm();
    } catch (e) { alert('Error: ' + e.message); }
}

export function deleteExpense(id) {
    showConfirm('🗑', t('confirmDelete'), t('confirmDeleteMsg'), t('confirmYes'), 'c-danger', async () => {
        try { await window._fb.deleteDoc(expDoc(id)); } catch (e) { alert('Error: ' + e.message); }
    });
}

// ===== SELECTION MODE =====

export function toggleExpSelect() {
    expSelectMode = !expSelectMode;
    selectedExpIds.clear();
    renderExpenses();
}

export function cancelExpSelect() { expSelectMode = false; selectedExpIds.clear(); renderExpenses(); }

export function toggleExpItem(id, cb) {
    if (cb.checked) selectedExpIds.add(id); else selectedExpIds.delete(id);
    updateExpSelCount();
}

export function toggleSelectAllExp() {
    const all = document.getElementById('sel-all-exp').checked;
    const exps = expenses();
    exps.forEach(e => { if (all) selectedExpIds.add(e.id); else selectedExpIds.delete(e.id); });
    document.querySelectorAll('.longpress-exp .sel-check').forEach(cb => {
        if (cb.id !== 'sel-all-exp') cb.checked = all;
    });
    updateExpSelCount();
}

function updateExpSelCount() {
    const n = selectedExpIds.size;
    const countEl = document.getElementById('exp-sel-count');
    if (countEl) countEl.textContent = n > 0 ? n + ' ' + t('selected') : '';
    const delBtn = document.getElementById('btn-del-sel-exp');
    if (delBtn) delBtn.style.display = n > 0 ? 'inline-block' : 'none';
}

export function deleteSelectedExp() {
    const n = selectedExpIds.size; if (!n) return;
    showConfirm('🗑', t('confirmDelete'), n + ' ' + t('expenses').toLowerCase(), t('confirmYes'), 'c-danger', async () => {
        for (const id of selectedExpIds) {
            try { await window._fb.deleteDoc(expDoc(id)); } catch (e) { }
        }
        selectedExpIds.clear(); expSelectMode = false;
    });
}
