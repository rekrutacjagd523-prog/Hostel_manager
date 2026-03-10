// ===== SUBSCRIPTION MODULE =====
import { t } from './constants.js';
import { residents, properties } from './utils.js';

// Limits
export const FREE_LIMITS = { residents: 10, properties: 3 };

// Check plan
export function isPro() {
  // Plan is stored in _settings (Firestore users/{uid}/settings/main)
  const s = window._settings || {};
  if (s.plan !== 'pro') return false;
  if (s.validUntil && new Date(s.validUntil) < new Date()) return false;
  return true;
}

export function canAddResident() {
  if (isPro()) return true;
  const active = residents().filter(r => !r.checkOutDate).length;
  return active < FREE_LIMITS.residents;
}

export function canAddProperty() {
  if (isPro()) return true;
  return properties().length < FREE_LIMITS.properties;
}

// ---- Upgrade Modal ----
export function showUpgradeModal(reason) {
  // Remove existing if any
  const old = document.getElementById('upgrade-overlay');
  if (old) old.remove();

  const activeCount = residents().filter(r => !r.checkOutDate).length;
  const propCount = properties().length;
  const isResLimit = reason === 'residents';
  const pm = t('perMonth');

  const el = document.createElement('div');
  el.id = 'upgrade-overlay';
  el.className = 'confirm-overlay';
  el.style.cssText = 'z-index:300;backdrop-filter:blur(8px)';
  el.innerHTML = `
    <div style="
      background:var(--modal-bg);
      border-radius:20px;
      padding:0;
      width:100%;
      max-width:520px;
      border:1px solid rgba(232,168,56,.2);
      overflow:hidden;
      box-shadow:0 24px 60px rgba(0,0,0,.5)
    ">
      <!-- Header -->
      <div style="
        background:linear-gradient(135deg,#1a1535,#0d1a2e);
        padding:28px 28px 24px;
        text-align:center;
        border-bottom:1px solid rgba(255,255,255,.06)
      ">
        <div style="font-size:40px;margin-bottom:8px">🚀</div>
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">${t('upgradeToPro')}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.5)">
          ${isResLimit
      ? `${t('limitResidents')} (${activeCount}/${FREE_LIMITS.residents})`
      : `${t('limitProps')} (${propCount}/${FREE_LIMITS.properties})`}
        </div>
      </div>

      <!-- Plans -->
      <div style="display:flex;gap:12px;padding:20px 20px 0">

        <!-- Free card -->
        <div style="
          flex:1;padding:16px;border-radius:12px;
          border:1px solid var(--border3);
          background:var(--surface2)
        ">
          <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">🆓 Standard</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:12px">$0<span style="font-size:12px;color:var(--text3)">${pm}</span></div>
          <div style="font-size:12px;color:var(--text3);display:flex;flex-direction:column;gap:6px">
            <div>✅ ${t('residents')}: <b style="color:var(--text)">${FREE_LIMITS.residents}</b></div>
            <div>✅ ${t('properties')}: <b style="color:var(--text)">${FREE_LIMITS.properties}</b></div>
            <div>✅ ${t('report')}</div>
            <div style="color:var(--text4)">❌ ${t('unlimited')}</div>
          </div>
          <div style="
            margin-top:14px;padding:8px;border-radius:8px;
            background:var(--surface);text-align:center;
            font-size:12px;font-weight:600;color:var(--text3)
          ">${t('currentPlan')}</div>
        </div>

        <!-- Pro card -->
        <div style="
          flex:1;padding:16px;border-radius:12px;
          border:2px solid var(--accent);
          background:linear-gradient(135deg,rgba(232,168,56,.08),rgba(212,136,58,.04));
          position:relative;overflow:hidden
        ">
          <div style="
            position:absolute;top:10px;right:-22px;
            background:var(--accent);color:#000;
            font-size:10px;font-weight:800;
            padding:3px 28px;transform:rotate(45deg)
          ">HOT</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:8px">⭐ Pro</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:12px;color:var(--accent)">
            $19.99<span style="font-size:12px;color:var(--text3)">${pm}</span>
          </div>
          <div style="font-size:12px;color:var(--text3);display:flex;flex-direction:column;gap:6px">
            <div>✅ <b style="color:var(--text)">${t('unlimited')}</b> ${t('residents').toLowerCase()}</div>
            <div>✅ <b style="color:var(--text)">${t('unlimited')}</b> ${t('properties').toLowerCase()}</div>
            <div>✅ ${t('report')}</div>
            <div>✅ ${t('prioritySupport')}</div>
          </div>
          <button id="btn-subscribe" onclick="openSubscription()" style="
            margin-top:14px;width:100%;padding:10px;border-radius:8px;
            border:none;cursor:pointer;font-family:inherit;
            font-size:13px;font-weight:700;
            background:linear-gradient(135deg,#e8a838,#d4883a);
            color:#0d0d14;transition:opacity .2s
          " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ⭐ ${t('subscribe')} — $19.99
          </button>
        </div>
      </div>

      <!-- Referral code -->
      <div style="padding:0 20px 4px">
        <div style="
          border-top:1px solid rgba(255,255,255,.06);
          padding-top:16px;
          display:flex;gap:8px;align-items:center
        ">
          <input id="ref-code-input" type="text" placeholder="${t('refCode')}"
            style="
              flex:1;padding:9px 12px;border-radius:8px;border:1px solid var(--border3);
              background:var(--surface2);color:var(--text);font-family:inherit;
              font-size:13px;outline:none;letter-spacing:.5px
            "
            onkeydown="if(event.key==='Enter') applyReferralCode(this.value)"
          />
          <button onclick="applyReferralCode(document.getElementById('ref-code-input').value)" style="
            padding:9px 16px;border-radius:8px;border:none;cursor:pointer;
            font-family:inherit;font-size:13px;font-weight:700;
            background:var(--surface);color:var(--text2);transition:opacity .2s
          " onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'">→</button>
        </div>
        <div id="ref-code-status" style="font-size:12px;min-height:16px;margin-top:6px;text-align:center"></div>
      </div>

      <!-- Footer -->
      <div style="display:flex;justify-content:center;padding:10px 20px 20px">
        <button onclick="document.getElementById('upgrade-overlay').remove()" style="
          background:transparent;border:none;cursor:pointer;
          font-family:inherit;font-size:13px;color:var(--text3);
          text-decoration:underline;padding:4px 8px
        ">${t('stayFree')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
}



export function openSubscription() {
  // ===== STRIPE PLACEHOLDER =====
  // Заменить URL ниже на ваш Stripe Payment Link после настройки:
  // const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/XXXXXXXXXXXXXXXX';
  // const email = window._currentUser?.email || '';
  // window.location.href = STRIPE_PAYMENT_LINK + '?prefilled_email=' + encodeURIComponent(email);

  // Пока показываем заглушку
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.style.zIndex = '400';
  el.innerHTML = `
    <div class="confirm-box" style="text-align:center">
      <div class="confirm-icon">🔧</div>
      <div class="confirm-title">Stripe не настроен</div>
      <div class="confirm-msg">
        Добавьте ваш <b>Stripe Payment Link</b> в файл<br>
        <code style="font-size:11px;background:var(--surface);padding:2px 6px;border-radius:4px">
          js/modules/subscription.js
        </code><br><br>
        Найдите строку:<br>
        <code style="font-size:11px;color:var(--accent)">STRIPE_PAYMENT_LINK</code>
      </div>
      <div class="confirm-btns">
        <button class="c-ok" onclick="this.closest('.confirm-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
}

// Plan badge text
export function getPlanLabel() {
  return isPro() ? '⭐ Pro' : '🆓 Free';
}

export function getPlanStyle() {
  return isPro()
    ? 'background:rgba(232,168,56,.12);color:var(--accent);border:1px solid rgba(232,168,56,.3)'
    : 'background:var(--surface);color:var(--text3);border:1px solid var(--border3)';
}

// ---- Referral Code ----
export async function applyReferralCode(raw) {
  const code = (raw || '').trim().toLowerCase();
  const status = document.getElementById('ref-code-status');
  if (!status) return;

  if (!code) {
    status.style.color = 'var(--red)';
    status.textContent = t('refCodeEmpty');
    return;
  }

  // Expected: hostelmanager + current day of month (zero-padded, e.g. "09")
  const day = String(new Date().getDate()).padStart(2, '0');
  const expected = 'hostelmanager' + day;

  if (code !== expected) {
    status.style.color = 'var(--red)';
    status.textContent = t('refCodeInvalid');
    return;
  }

  try {
    const fb = window._fb;
    if (!fb || !fb.settingsDoc) throw new Error('Not ready');
    await fb.setDoc(fb.settingsDoc, { plan: 'pro', validUntil: null }, { merge: true });
    window._settings = Object.assign({}, window._settings || {}, { plan: 'pro', validUntil: null });
    status.style.color = 'var(--green)';
    status.textContent = t('refCodeSuccess');
    setTimeout(() => {
      document.getElementById('upgrade-overlay')?.remove();
      if (window.updatePlanBadge) window.updatePlanBadge();
      if (window.render) window.render();
    }, 1500);
  } catch (e) {
    status.style.color = 'var(--red)';
    status.textContent = t('refCodeError') + e.message;
  }
}
