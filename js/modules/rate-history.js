// ===== RATE HISTORY & PAYMENT CALCULATION =====

export function buildRateHistory(r) {
    if (r.rateHistory && r.rateHistory.length > 0) {
        return [...r.rateHistory].sort((a, b) => a.from.localeCompare(b.from));
    }
    return [{ rate: r.monthlyRate, from: r.checkInDate }];
}

export function calcPaymentWithHistory(r, periodStart, periodEnd) {
    const end = periodEnd ? new Date(periodEnd) : new Date();
    const start = new Date(periodStart);
    const history = buildRateHistory(r);
    let total = 0;
    for (let i = 0; i < history.length; i++) {
        const segStart = new Date(history[i].from);
        const segEnd = i < history.length - 1 ? new Date(history[i + 1].from) : end;
        const s = segStart < start ? start : segStart;
        const e = segEnd > end ? end : segEnd;
        if (s < e) {
            const days = Math.ceil((e - s) / 86400000);
            total += Math.round((history[i].rate / 30) * days * 100) / 100;
        }
    }
    return Math.round(total * 100) / 100;
}

export function calcCurrentPayment(r) {
    return calcPaymentWithHistory(r, r.checkInDate, r.checkOutDate || null);
}
