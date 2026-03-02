// ===== REPORT & EXPORT MODULE =====
import { t } from './constants.js';
import { residents, properties, cur, fmtUi, todayStr, esc } from './utils.js';
import { calcPaymentWithHistory, buildRateHistory } from './rate-history.js';

let reportPeriod = 'all';

export function getReportPeriod() { return reportPeriod; }

function getPeriodRange() {
    const now = new Date(); const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let from = null, to = todayEnd;
    if (reportPeriod === 'week') { from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0); }
    else if (reportPeriod === 'month') { from = new Date(now); from.setMonth(from.getMonth() - 1); from.setHours(0, 0, 0, 0); }
    else if (reportPeriod === 'year') { from = new Date(now); from.setFullYear(from.getFullYear() - 1); from.setHours(0, 0, 0, 0); }
    else if (reportPeriod === 'custom') {
        const fv = document.getElementById('period-from').value; const tv = document.getElementById('period-to').value;
        if (fv) from = new Date(fv + 'T00:00:00'); if (tv) to = new Date(tv + 'T23:59:59');
    }
    return { from, to };
}

function getPeriodLabel() {
    if (reportPeriod === 'all') return t('allTime');
    if (reportPeriod === 'week') return t('week');
    if (reportPeriod === 'month') return t('month');
    if (reportPeriod === 'year') return t('year');
    const { from, to } = getPeriodRange();
    const fd = from ? new Date(from).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '...';
    const td = to ? new Date(to).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '...';
    return fd + ' — ' + td;
}

function filterByPeriod(list) {
    const { from, to } = getPeriodRange();
    return list.filter(r => {
        const ci = new Date(r.checkInDate + 'T00:00:00');
        const co = r.checkOutDate ? new Date(r.checkOutDate + 'T23:59:59') : new Date();
        if (from && co < from) return false; if (to && ci > to) return false; return true;
    });
}

function calcPayInPeriod(r) {
    const { from, to } = getPeriodRange();
    const pStart = from ? from.toISOString().split('T')[0] : r.checkInDate;
    const pEnd = to ? to.toISOString().split('T')[0] : (r.checkOutDate || todayStr());
    const rStart = r.checkInDate > pStart ? r.checkInDate : pStart;
    const rEnd = (r.checkOutDate && r.checkOutDate < pEnd) ? r.checkOutDate : pEnd;
    return calcPaymentWithHistory(r, rStart, rEnd);
}

function daysBetween(s, e) {
    const a = new Date(s), b = e ? new Date(e) : new Date();
    return Math.max(0, Math.ceil((b - a) / 86400000));
}

function getResidentsOnProp(p) {
    return residents().filter(r => !r.checkOutDate && r.city === p.city && r.address === p.address && (r.housingType || 'hostel') === p.housingType);
}

export function setPeriod(p, btn) {
    reportPeriod = p;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    p === 'custom' ? document.getElementById('custom-dates').classList.add('visible') : document.getElementById('custom-dates').classList.remove('visible');
    refreshReport();
}

export function openReport() {
    document.getElementById('report-overlay').classList.remove('hidden');
    reportPeriod = 'all';
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.period-btn').classList.add('active');
    document.getElementById('custom-dates').classList.remove('visible');
    refreshReport();
}

export function refreshReport() {
    const c = cur(); const pl = getPeriodLabel();
    document.getElementById('period-info').textContent = t('period') + ': ' + pl + ' | ' + c.code + ' (' + c.symbolU + ')';
    const af = filterByPeriod(residents());
    const active = af.filter(r => !r.checkOutDate); const out = af.filter(r => r.checkOutDate);
    const tA = active.reduce((s, r) => s + calcPayInPeriod(r), 0); const tO = out.reduce((s, r) => s + calcPayInPeriod(r), 0);
    let h = '';
    if (active.length) {
        h += '<div class="report-section"><h4 style="cursor:pointer;user-select:none" onclick="this.nextElementSibling.classList.toggle(\'rpt-hidden\');this.querySelector(\'span\').textContent=this.nextElementSibling.classList.contains(\'rpt-hidden\')?\'▶\':\'▼\'">' + t('curLabel') + ' (' + active.length + ') <span style="font-size:11px;color:var(--text4)">▼</span></h4><div class="report-table">' +
            '<div class="report-header"><span style="flex:2">' + t('fname') + '</span><span style="flex:1">' + t('days') + '</span><span style="flex:1">' + t('rate') + '</span><span style="flex:1;text-align:right">' + t('topay') + '</span></div>';
        active.forEach(r => {
            const p = calcPayInPeriod(r); const hist = buildRateHistory(r);
            h += '<div class="report-row"><span style="flex:2;font-weight:600">' + esc((r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '')) + '</span>' +
                '<span style="flex:1;color:#8a8a9a">' + daysBetween(r.checkInDate, r.checkOutDate) + ' ' + t('days') + '</span>' +
                '<span style="flex:1;color:#8a8a9a">' + (hist.length > 1 ? '<span style="color:#e8a838">×' + hist.length + '</span>' : fmtUi(r.monthlyRate)) + '</span>' +
                '<span style="flex:1;text-align:right;font-weight:700;color:#e8a838">' + fmtUi(p) + '</span></div>';
        }); h += '</div></div>';
    }
    if (out.length) {
        h += '<div class="report-section"><h4 style="cursor:pointer;user-select:none" onclick="this.nextElementSibling.classList.toggle(\'rpt-hidden\');this.querySelector(\'span\').textContent=this.nextElementSibling.classList.contains(\'rpt-hidden\')?\'▶\':\'▼\'">' + t('outLabel') + ' (' + out.length + ') <span style="font-size:11px;color:var(--text4)">▼</span></h4><div class="report-table">' +
            '<div class="report-header"><span style="flex:2">' + t('fname') + '</span><span style="flex:1">' + t('days') + '</span><span style="flex:1;text-align:right">' + t('totalLabel') + '</span></div>';
        out.forEach(r => {
            const p = calcPayInPeriod(r);
            h += '<div class="report-row"><span style="flex:2;font-weight:600">' + esc((r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '')) + '</span>' +
                '<span style="flex:1;color:#8a8a9a">' + daysBetween(r.checkInDate, r.checkOutDate) + ' ' + t('days') + '</span>' +
                '<span style="flex:1;text-align:right;font-weight:700;color:#6ab89a">' + fmtUi(p) + '</span></div>';
        }); h += '</div></div>';
    }
    if (!af.length) h = '<div class="empty">' + t('noData') + '</div>';
    const props = properties();
    if (props.length) {
        h += '<div class="report-section"><h4 style="cursor:pointer;user-select:none" onclick="this.nextElementSibling.classList.toggle(\'rpt-hidden\');this.querySelector(\'span\').textContent=this.nextElementSibling.classList.contains(\'rpt-hidden\')?\'▶\':\'▼\'">🏢 ' + t('propReport') + ' <span style="font-size:11px;color:var(--text4)">▼</span></h4><div class="report-table">' +
            '<div class="report-header"><span style="flex:2">' + t('properties') + '</span><span style="flex:1">' + t('htype') + '</span><span style="flex:1;text-align:center">' + t('totalSpots') + '</span><span style="flex:1;text-align:center">' + t('occupied') + '</span><span style="flex:1;text-align:center">' + t('freeSpots') + '</span></div>';
        let totalS = 0, totalO = 0;
        props.forEach(p => {
            const occ = getResidentsOnProp(p).length; const free = Math.max(0, (p.spots || 0) - occ);
            totalS += (p.spots || 0); totalO += occ;
            h += '<div class="report-row"><span style="flex:2;font-weight:600">' + esc(p.city) + ' · ' + esc(p.address) + '</span>' +
                '<span style="flex:1;color:var(--text3)">' + t(p.housingType || 'hostel') + '</span>' +
                '<span style="flex:1;text-align:center">' + (p.spots || 0) + '</span>' +
                '<span style="flex:1;text-align:center;color:var(--accent)">' + occ + '</span>' +
                '<span style="flex:1;text-align:center;color:' + (free > 0 ? 'var(--green)' : 'var(--red)') + '">' + free + '</span></div>';
        });
        h += '<div class="report-row" style="font-weight:700;border-top:2px solid var(--border)"><span style="flex:2">' + t('totalLabel') + '</span><span style="flex:1"></span><span style="flex:1;text-align:center">' + totalS + '</span><span style="flex:1;text-align:center;color:var(--accent)">' + totalO + '</span><span style="flex:1;text-align:center;color:var(--green)">' + (totalS - totalO) + '</span></div>';
        h += '</div></div>';
    }
    h += '<div class="report-total">' + t('curLabel') + ': <span style="color:#e8a838">' + fmtUi(tA) + '</span> &nbsp;|&nbsp; ' + t('outLabel') + ': <span style="color:#6ab89a">' + fmtUi(tO) + '</span> &nbsp;|&nbsp; ' + t('totalLabel') + ': <span style="color:var(--text);font-size:16px">' + fmtUi(tA + tO) + '</span></div>';
    document.getElementById('report-content').innerHTML = h;
}

export function closeReport() { document.getElementById('report-overlay').classList.add('hidden'); }

export function showExportDialog() {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.innerHTML = '<div class="confirm-box" style="max-width:380px;text-align:left">' +
        '<div style="text-align:center"><div class="confirm-icon">📋</div><div class="confirm-title">' + t('report') + '</div></div>' +
        '<div class="export-options">' +
        '<label class="export-opt selected" id="exp-opt-residents" onclick="selectExportOpt(this,\'residents\')">' +
        '<input type="radio" name="exp-type" value="residents" checked>' +
        '<div class="export-opt-icon">👥</div>' +
        '<div><div class="export-opt-text">' + t('residents') + ' ' + t('owed').toLowerCase() + '</div>' +
        '<div class="export-opt-desc">' + t('curLabel') + ', ' + t('outLabel').toLowerCase() + ', ' + t('topay') + '</div></div></label>' +
        '<label class="export-opt" id="exp-opt-props" onclick="selectExportOpt(this,\'props\')">' +
        '<input type="radio" name="exp-type" value="props">' +
        '<div class="export-opt-icon">🏢</div>' +
        '<div><div class="export-opt-text">' + t('properties') + '</div>' +
        '<div class="export-opt-desc">' + t('totalSpots') + ', ' + t('occupied') + ', ' + t('freeSpots') + '</div></div></label>' +
        '<label class="export-opt" id="exp-opt-all" onclick="selectExportOpt(this,\'all\')">' +
        '<input type="radio" name="exp-type" value="all">' +
        '<div class="export-opt-icon">📊</div>' +
        '<div><div class="export-opt-text">' + t('totalLabel') + '</div>' +
        '<div class="export-opt-desc">' + t('residents') + ' + ' + t('properties') + '</div></div></label>' +
        '</div>' +
        '<div class="export-formats">' +
        '<button class="btn btn-pdf" id="exp-pdf" onclick="doExport(\'pdf\')">📕 PDF</button>' +
        '<button class="btn btn-xml" id="exp-excel" onclick="doExport(\'excel\')">📗 Excel</button>' +
        '</div>' +
        '<div style="text-align:center;margin-top:12px"><button class="btn btn-cancel" id="exp-cancel">' + t('confirmNo') + '</button></div>' +
        '</div>';
    document.body.appendChild(el);
    el.querySelector('#exp-cancel').onclick = () => el.remove();
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    window._exportDialog = el;
}

export function selectExportOpt(label, type) {
    const el = window._exportDialog;
    if (!el) return;
    el.querySelectorAll('.export-opt').forEach(o => o.classList.remove('selected'));
    label.classList.add('selected');
    label.querySelector('input').checked = true;
}

export function doExport(format) {
    const el = window._exportDialog;
    if (!el) return;
    const type = el.querySelector('input[name="exp-type"]:checked').value;
    el.remove();
    if (format === 'pdf') exportPDFByType(type);
    else exportExcelByType(type);
}

function exportExcelByType(type) {
    const wb = XLSX.utils.book_new();
    if (type === 'residents' || type === 'all') {
        const af = filterByPeriod(residents()); const active = af.filter(r => !r.checkOutDate); const out = af.filter(r => r.checkOutDate);
        const rows = [[t('fname'), t('lname'), t('city'), t('addr'), t('htype'), t('checkin'), t('days'), t('rate'), t('topay'), 'Status']];
        active.forEach(r => { const p = calcPayInPeriod(r); rows.push([r.firstName || '', r.lastName || '', r.city || '', r.address || '', t(r.housingType || 'hostel'), r.checkInDate, daysBetween(r.checkInDate, r.checkOutDate), r.monthlyRate, p, t('curLabel')]); });
        out.forEach(r => { const p = calcPayInPeriod(r); rows.push([r.firstName || '', r.lastName || '', r.city || '', r.address || '', t(r.housingType || 'hostel'), r.checkInDate, daysBetween(r.checkInDate, r.checkOutDate), r.monthlyRate, p, t('outLabel')]); });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, t('residents').substring(0, 30) || 'Residents');
    }
    if (type === 'props' || type === 'all') {
        const props = properties();
        const propRows = [[t('city'), t('addr'), t('htype'), t('totalSpots'), t('occupied'), t('freeSpots')]];
        let totalS = 0, totalO = 0;
        props.forEach(p => {
            const occ = getResidentsOnProp(p).length; const free = Math.max(0, (p.spots || 0) - occ);
            totalS += (p.spots || 0); totalO += occ;
            propRows.push([p.city || '', p.address || '', t(p.housingType || 'hostel'), p.spots || 0, occ, free]);
        });
        propRows.push([t('totalLabel'), '', '', totalS, totalO, totalS - totalO]);
        const ws2 = XLSX.utils.aoa_to_sheet(propRows);
        XLSX.utils.book_append_sheet(wb, ws2, t('properties').substring(0, 30) || 'Properties');
    }
    XLSX.writeFile(wb, 'hostel_report_' + todayStr() + '.xlsx');
}

function exportPDFByType(type) {
    const c = cur(); const pl = getPeriodLabel();
    const af = filterByPeriod(residents()); const active = af.filter(r => !r.checkOutDate); const out = af.filter(r => r.checkOutDate);
    const tA = active.reduce((s, r) => s + calcPayInPeriod(r), 0);
    const tO = out.reduce((s, r) => s + calcPayInPeriod(r), 0);
    let h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hostel Report</title><style>' +
        'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;margin:24px;max-width:780px}' +
        'h1{font-size:20px;margin:0;color:#1a1a2e}h2{font-size:14px;margin:18px 0 6px;padding-bottom:4px;border-bottom:2px solid #e8a838;color:#333}' +
        'h3{font-size:13px;margin:14px 0 4px;color:#2d8f65}' +
        '.sub{font-size:11px;color:#888;margin:4px 0 20px}' +
        'table{width:100%;border-collapse:collapse;margin:8px 0 16px}' +
        'th{padding:6px 8px;text-align:left;font-size:11px;font-weight:700}' +
        'th.amber{background:#e8a838;color:#000}th.green{background:#6ab89a;color:#000}th.purple{background:#8b6fc0;color:#fff}' +
        'td{padding:5px 8px;border-bottom:1px solid #e8e8e8;font-size:11px}' +
        '.total-row td{font-weight:700;border-top:2px solid #ccc;border-bottom:none}' +
        '.summary{background:#fdf6e8;padding:10px 16px;border-radius:8px;margin-top:16px;font-size:13px;text-align:center}' +
        '.summary b{color:#d4883a}' +
        '@media print{body{margin:10mm}@page{margin:12mm}}' +
        '</style></head><body>';
    h += '<h1>Hostel Manager</h1><div class="sub">' + esc(pl) + ' | ' + c.code + '</div>';
    if (type === 'residents' || type === 'all') {
        if (active.length) {
            h += '<h2>' + t('curLabel') + ' (' + active.length + ')</h2><table><tr><th class="amber">' + t('fname') + ' ' + t('lname') + '</th><th class="amber">' + t('city') + '</th><th class="amber">' + t('checkin') + '</th><th class="amber">' + t('days') + '</th><th class="amber">' + t('topay') + '</th></tr>';
            active.forEach(r => { h += '<tr><td>' + esc((r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '')) + '</td><td>' + esc(r.city || '-') + '</td><td>' + (window.fmtDate ? window.fmtDate(r.checkInDate) : r.checkInDate) + '</td><td>' + daysBetween(r.checkInDate, r.checkOutDate) + '</td><td><b>' + fmtUi(calcPayInPeriod(r)) + '</b></td></tr>'; });
            h += '</table>';
        }
        if (out.length) {
            h += '<h3>' + t('outLabel') + ' (' + out.length + ')</h3><table><tr><th class="green">' + t('fname') + ' ' + t('lname') + '</th><th class="green">' + t('city') + '</th><th class="green">' + t('checkin') + '</th><th class="green">' + t('days') + '</th><th class="green">' + t('totalLabel') + '</th></tr>';
            out.forEach(r => { h += '<tr><td>' + esc((r.firstName || r.fullName || '') + (r.lastName ? ' ' + r.lastName : '')) + '</td><td>' + esc(r.city || '-') + '</td><td>' + (window.fmtDate ? window.fmtDate(r.checkInDate) : r.checkInDate) + '</td><td>' + daysBetween(r.checkInDate, r.checkOutDate) + '</td><td>' + fmtUi(calcPayInPeriod(r)) + '</td></tr>'; });
            h += '</table>';
        }
    }
    if (type === 'props' || type === 'all') {
        const props = properties();
        if (props.length) {
            h += '<h2>🏢 ' + t('propReport') + '</h2><table><tr><th class="purple">' + t('properties') + '</th><th class="purple">' + t('htype') + '</th><th class="purple">' + t('totalSpots') + '</th><th class="purple">' + t('occupied') + '</th><th class="purple">' + t('freeSpots') + '</th></tr>';
            let totalS = 0, totalO = 0;
            props.forEach(p => {
                const occ = getResidentsOnProp(p).length; const free = Math.max(0, (p.spots || 0) - occ);
                totalS += (p.spots || 0); totalO += occ;
                h += '<tr><td>' + esc(p.city) + ' · ' + esc(p.address) + '</td><td>' + t(p.housingType || 'hostel') + '</td><td style="text-align:center">' + (p.spots || 0) + '</td><td style="text-align:center">' + occ + '</td><td style="text-align:center">' + free + '</td></tr>';
            });
            h += '<tr class="total-row"><td>' + t('totalLabel') + '</td><td></td><td style="text-align:center">' + totalS + '</td><td style="text-align:center">' + totalO + '</td><td style="text-align:center">' + (totalS - totalO) + '</td></tr></table>';
        }
    }
    if (type === 'residents' || type === 'all') {
        h += '<div class="summary">' + t('curLabel') + ': <b>' + fmtUi(tA) + '</b> &nbsp;|&nbsp; ' + t('outLabel') + ': <b>' + fmtUi(tO) + '</b> &nbsp;|&nbsp; ' + t('totalLabel') + ': <b>' + fmtUi(tA + tO) + '</b></div>';
    }
    h += '</body></html>';
    const win = window.open('', '_blank', 'width=820,height=600');
    if (!win) { alert('Please allow pop-ups'); return; }
    win.document.write(h); win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
}

// ===== CSV IMPORT =====
export function importCSV() {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.innerHTML = '<div class="confirm-box" style="max-width:480px;text-align:left">' +
        '<div style="text-align:center"><div class="confirm-icon">📥</div><div class="confirm-title">' + t('importCSV') + '</div></div>' +
        '<div class="confirm-msg" style="text-align:center">' + t('importStep1') + '</div>' +
        '<div style="background:var(--surface);border-radius:8px;padding:10px 12px;margin:10px 0;font-family:monospace;font-size:11px;line-height:1.8;overflow-x:auto">' +
        '<div style="font-weight:700;color:var(--accent)">FirstName;LastName;City;Address;Type;CheckInDate;MonthlyRate</div>' +
        '<div style="color:var(--text3)">Ivan;Petrov;Gdansk;Sosnowa 5;hostel;22.02.2026;550</div>' +
        '<div style="color:var(--text3)">Anna;Kowal;Gdansk;Sosnowa 5;hostel;15.01.2026;600</div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:12px">' +
        '<div>• <b>Type:</b> hostel, apartment, house, room</div>' +
        '<div>• <b>CheckInDate:</b> DD.MM.YYYY ' + t('or') + ' YYYY-MM-DD</div>' +
        '<div>• <b>' + t('importDelim') + ':</b> ; (' + t('importDelimOr') + ' , ' + t('importDelimOr') + ' Tab)</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">' +
        '<button class="btn btn-secondary" onclick="downloadCSVTemplate()" style="font-size:12px">⬇ ' + t('importDownload') + '</button>' +
        '<button class="btn btn-primary" onclick="document.getElementById(\'csv-file2\').click()" style="font-size:12px">📂 ' + t('importUpload') + '</button>' +
        '</div>' +
        '<input type="file" id="csv-file2" accept=".csv,.txt" style="display:none">' +
        '<div id="import-status" style="font-size:12px;text-align:center;min-height:18px"></div>' +
        '<div style="text-align:center;margin-top:8px"><button class="btn btn-cancel" id="import-close">' + t('close') + '</button></div>' +
        '</div>';
    document.body.appendChild(el);
    el.querySelector('#import-close').onclick = () => el.remove();
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    el.querySelector('#csv-file2').onchange = async (ev) => {
        const status = el.querySelector('#import-status');
        status.textContent = '⏳ ...'; status.style.color = 'var(--text2)';
        try {
            const count = await processCSVFile(ev.target.files[0]);
            status.textContent = '✅ ' + t('importDone') + ': ' + count + ' ' + t('residents').toLowerCase();
            status.style.color = 'var(--green)';
            ev.target.value = '';
        } catch (e) {
            status.textContent = '❌ ' + e.message; status.style.color = 'var(--red)';
        }
    };
}

export function downloadCSVTemplate() {
    const header = 'FirstName;LastName;City;Address;Type;CheckInDate;MonthlyRate';
    const example = 'Ivan;Petrov;Gdansk;Sosnowa 5;hostel;22.02.2026;550';
    const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hostel_import_template.csv';
    a.click(); URL.revokeObjectURL(a.href);
}

async function processCSVFile(file) {
    if (!file) throw new Error('No file');
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV empty');
    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const parseLine = (line) => line.split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const header = parseLine(lines[0]).map(h => h.toLowerCase());
    const findCol = (names) => header.findIndex(h => names.some(n => h.includes(n)));
    const iFirst = findCol(['first', 'имя', "ім'я", 'imię', 'vardas', 'fname', 'name']);
    const iLast = findCol(['last', 'фамил', 'прізвищ', 'nazwisk', 'pavard', 'lname', 'surname']);
    const iCity = findCol(['city', 'город', 'місто', 'miasto', 'miestas']);
    const iAddr = findCol(['addr', 'адрес', 'адреса', 'adres']);
    const iType = findCol(['type', 'тип', 'tipas']);
    const iDate = findCol(['date', 'дата', 'data', 'checkin']);
    const iRate = findCol(['rate', 'оплат', 'ставк', 'opłat', 'mokėj', 'payment', 'price', 'цена', 'ціна', 'monthly']);
    let count = 0;
    const fb = window._fb;
    const { genId } = await import('./utils.js');
    for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 2) continue;
        let firstName = '', lastName = '';
        if (iFirst >= 0) { firstName = cols[iFirst] || ''; } else { firstName = cols[0] || ''; }
        if (iLast >= 0) { lastName = cols[iLast] || ''; } else if (iFirst < 0 && cols.length > 1) { lastName = cols[1] || ''; }
        if (!firstName && !lastName) continue;
        let dateStr = iDate >= 0 ? (cols[iDate] || '') : '';
        if (dateStr) {
            const m1 = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
            if (m1) dateStr = m1[3] + '-' + m1[2].padStart(2, '0') + '-' + m1[1].padStart(2, '0');
            const m2 = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (!m2) dateStr = todayStr();
        } else { dateStr = todayStr(); }
        let rate = 0;
        if (iRate >= 0) { rate = parseFloat((cols[iRate] || '0').replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0; }
        const data = {
            firstName, lastName,
            city: (iCity >= 0 ? cols[iCity] : ''),
            address: (iAddr >= 0 ? cols[iAddr] : ''),
            housingType: (iType >= 0 ? cols[iType] : 'hostel') || 'hostel',
            checkInDate: dateStr, monthlyRate: rate,
            createdAt: new Date().toISOString()
        };
        try { await fb.setDoc(fb.doc(fb.db, 'users', window._workspaceUid || window._currentUser.uid, 'residents', genId()), data); count++; }
        catch (e) { console.error('Import error row ' + i + ':', e); }
    }
    // Auto-create properties from imported data
    const propMap = new Map();
    const uid = window._currentUser.uid;
    residents().forEach(r => {
        if (r.city && r.address) {
            const key = r.city + '|' + r.address + '|' + (r.housingType || 'hostel');
            if (!propMap.has(key)) propMap.set(key, { city: r.city, address: r.address, housingType: r.housingType || 'hostel' });
        }
    });
    const existingProps = properties();
    for (const [key, val] of propMap) {
        const exists = existingProps.some(p => p.city === val.city && p.address === val.address && p.housingType === val.housingType);
        if (!exists) {
            try {
                await fb.setDoc(fb.doc(fb.db, 'users', uid, 'properties', (await import('./utils.js')).genId()), {
                    city: val.city, address: val.address, housingType: val.housingType,
                    spots: 20, createdAt: new Date().toISOString()
                });
            } catch (e) { console.error('Auto-create property error:', e); }
        }
    }
    return count;
}
