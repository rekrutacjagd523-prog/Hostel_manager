// ===== SUBSCRIPTION MODULE =====
import { t } from './constants.js';
import { residents, properties, expenses, bookings } from './utils.js';

// Limits
export const FREE_LIMITS = { residents: 6, properties: 3, expenses: 50, bookings: 30 };

// Check plan
export function isPro() {
  const s = window._settings || {};
  if (s.plan !== 'pro' && s.plan !== 'premium') return false;
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

export function canAddExpense() {
  if (isPro()) return true;
  return expenses().length < FREE_LIMITS.expenses;
}

export function canAddBooking() {
  if (isPro()) return true;
  return bookings().filter(b => b.status !== 'cancelled').length < FREE_LIMITS.bookings;
}

// ---- Upgrade Modal ----
let _subBillingType = 'annual';
function subSetBilling(type) {
  _subBillingType = type;
  const isA = type === 'annual';
  // Pro prices — always show monthly price
  const ppv = document.getElementById('sub-price-pro-val');
  const ppb = document.getElementById('sub-price-pro-btn');
  if (ppv) ppv.textContent = isA ? '17' : '19.99';
  if (ppb) ppb.textContent = isA ? '17' : '19.99';
  // Premium prices — always show monthly price
  const rpv = document.getElementById('sub-price-prem-val');
  const rpb = document.getElementById('sub-price-prem-btn');
  if (rpv) rpv.textContent = isA ? '20' : '24.99';
  if (rpb) rpb.textContent = isA ? '20' : '24.99';
  // Annual notes
  const np = document.getElementById('sub-note-pro');
  const nrp = document.getElementById('sub-note-prem');
  if (np) np.innerHTML = isA ? '$204/yr · <s>$239.88</s>' : '';
  if (nrp) nrp.innerHTML = isA ? '$240/yr · <s>$299.88</s>' : '';
  // Toggle buttons
  const active = 'padding:5px 16px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--accent);color:#111;transition:all .2s';
  const inactive = 'padding:5px 16px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text2);transition:all .2s';
  const mb = document.getElementById('sub-btn-monthly');
  const ab = document.getElementById('sub-btn-annual');
  if (mb) mb.style.cssText = type === 'monthly' ? active : inactive;
  if (ab) ab.style.cssText = type === 'annual' ? active : inactive;
}
window.subSetBilling = subSetBilling;

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
      max-width:700px;
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
        <div style="font-size:40px;margin-bottom:8px"></div>
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">${t('choosePlan') || 'Choose your plan'}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.5)">
          ${isResLimit
      ? `${t('limitResidents')} (${activeCount}/${FREE_LIMITS.residents})`
      : `${t('limitProps')} (${propCount}/${FREE_LIMITS.properties})`}
        </div>
      </div>

      <!-- Billing toggle -->
      <div style="display:flex;justify-content:center;padding:16px 20px 0">
        <div style="display:inline-flex;align-items:center;gap:0;background:var(--surface2);border:1px solid var(--border2);border-radius:100px;padding:3px">
          <button id="sub-btn-monthly" onclick="subSetBilling('monthly')" style="padding:5px 16px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text2);transition:all .2s">
            ${t('perMonth').replace('/','') || 'mies.'}
          </button>
          <button id="sub-btn-annual" onclick="subSetBilling('annual')" style="padding:5px 16px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--accent);color:#111;transition:all .2s">
            ${t('annual') || 'Rok'} <span style="background:rgba(0,0,0,.15);color:#111;padding:1px 6px;border-radius:20px;font-size:10px;font-weight:700">-15%</span>
          </button>
        </div>
      </div>

      <!-- Plans -->
      <div style="display:flex;gap:10px;padding:12px 16px 0">

        <!-- Free card -->
        <div style="flex:1;padding:14px;border-radius:12px;border:1px solid var(--border3);background:var(--surface2);display:flex;flex-direction:column">
          <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:6px">Start</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:2px">$0<span style="font-size:11px;color:var(--text3)">${pm}</span></div>
          <div style="height:16px"></div>
          <div style="font-size:11px;color:var(--text3);display:flex;flex-direction:column;gap:5px;flex:1">
            <div><b style="color:var(--text)">${FREE_LIMITS.residents}</b> ${t('residents').toLowerCase()}</div>
            <div><b style="color:var(--text)">${FREE_LIMITS.properties}</b> ${t('properties').toLowerCase()}</div>
            <div><b style="color:var(--text)">1</b> ${t('user')}</div>
            <div>PDF</div>
          </div>
          <div style="margin-top:10px;padding:9px;border-radius:8px;background:var(--surface);text-align:center;font-size:12px;font-weight:600;color:var(--text3)">${t('currentPlan')}</div>
        </div>

        <!-- Pro card -->
        <div style="flex:1;padding:14px;border-radius:12px;border:2px solid var(--accent);background:linear-gradient(135deg,rgba(232,168,56,.08),rgba(212,136,58,.04));position:relative;overflow:hidden;display:flex;flex-direction:column">
          <div style="position:absolute;top:8px;right:-24px;background:var(--accent);color:#000;font-size:9px;font-weight:800;padding:2px 26px;transform:rotate(45deg)">HOT</div>
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px">Pro</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:2px;color:var(--accent)">$<span id="sub-price-pro-val">17</span><span style="font-size:11px;color:var(--text3)">${pm}</span></div>
          <div id="sub-note-pro" style="font-size:10px;color:var(--text3);margin-bottom:4px">$204/yr · <s>$239.88</s></div>
          <div style="font-size:11px;color:var(--text3);display:flex;flex-direction:column;gap:5px;flex:1">
            <div><b style="color:var(--text)">100</b> ${t('residents').toLowerCase()}</div>
            <div><b style="color:var(--text)">${t('unlimited')}</b> ${t('properties').toLowerCase()}</div>
            <div><b style="color:var(--text)">5</b> ${t('users')}</div>
            <div>PDF + Excel</div>
            <div>${t('prioritySupport')}</div>
          </div>
          <button onclick="document.getElementById('upgrade-overlay')?.remove(); openSubscription('pro');" style="margin-top:10px;width:100%;padding:9px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;background:linear-gradient(135deg,#e8a838,#d4883a);color:#0d0d14;transition:opacity .2s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">${t('subscribe')} — $<span id="sub-price-pro-btn">17</span>${pm}</button>
        </div>

        <!-- Premium card -->
        <div style="flex:1;padding:14px;border-radius:12px;border:1px solid rgba(139,92,246,.3);background:linear-gradient(135deg,rgba(139,92,246,.06),var(--surface2));display:flex;flex-direction:column">
          <div style="font-size:12px;font-weight:700;color:#a78bfa;margin-bottom:6px">Premium</div>
          <div style="font-size:22px;font-weight:800;margin-bottom:2px;color:#a78bfa">$<span id="sub-price-prem-val">20</span><span style="font-size:11px;color:var(--text3)">${pm}</span></div>
          <div id="sub-note-prem" style="font-size:10px;color:var(--text3);margin-bottom:4px">$240/yr · <s>$299.88</s></div>
          <div style="font-size:11px;color:var(--text3);display:flex;flex-direction:column;gap:5px;flex:1">
            <div><b style="color:var(--text)">${t('unlimited')}</b> ${t('residents').toLowerCase()}</div>
            <div><b style="color:var(--text)">${t('unlimited')}</b> ${t('properties').toLowerCase()}</div>
            <div><b style="color:var(--text)">${t('unlimited')}</b> ${t('users')}</div>
            <div>PDF + Excel</div>
            <div>${t('dedicatedSupport')}</div>
          </div>
          <button onclick="document.getElementById('upgrade-overlay')?.remove(); openSubscription('premium');" style="margin-top:10px;width:100%;padding:9px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;transition:opacity .2s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">${t('subscribe')} — $<span id="sub-price-prem-btn">20</span>${pm}</button>
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



// ===== STRIPE PAYMENT LINKS =====
const STRIPE_LINKS = {
  pro:     { monthly: 'https://buy.stripe.com/3cIaEQ4rL6LM183bPI0Fi00', annual: 'https://buy.stripe.com/7sY3co3nH4DE6sn5rk0Fi03' },
  premium: { monthly: 'https://buy.stripe.com/cNiaEQ9M57PQ3gb0700Fi04', annual: 'https://buy.stripe.com/7sYeV6f6p1rsg2X9HA0Fi05' }
};
const PLAN_PRICES = {
  pro:     { monthly: '19.99', annual: '17', annualTotal: '204' },
  premium: { monthly: '24.99', annual: '20', annualTotal: '240' }
};

export function openSubscription(planType = 'pro') {
  const email = window._currentUser?.email || '';
  const uid = window._workspaceUid || window._currentUser?.uid || '';
  const params = new URLSearchParams({ prefilled_email: email, client_reference_id: uid });
  const prices = PLAN_PRICES[planType] || PLAN_PRICES.pro;
  const isPrem = planType === 'premium';
  const planLabel = isPrem ? 'Premium' : 'Pro';
  const accentColor = isPrem ? '#a78bfa' : '#f59e0b';
  const btnBg = isPrem ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'linear-gradient(135deg,#e8a838,#d4883a)';
  const btnColor = isPrem ? '#fff' : '#0d0d14';

  let currentBilling = 'monthly';

  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.style.zIndex = '400';
  el.innerHTML = `
    <div style="
      background:var(--modal-bg);border-radius:20px;padding:0;
      width:100%;max-width:420px;border:1px solid rgba(232,168,56,.2);
      overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5);
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1535,#0d1a2e);padding:24px 28px 20px;text-align:center;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="font-size:36px;margin-bottom:8px"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${accentColor}" stroke="${accentColor}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">Upgrade to ${planLabel}</div>

        <!-- Billing toggle -->
        <div style="display:inline-flex;align-items:center;gap:0;margin:12px 0 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:100px;padding:3px">
          <button id="pay-btn-monthly" style="padding:6px 18px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:rgba(255,255,255,.5);transition:all .2s">
            ${t('perMonth').replace('/','') || 'mies.'}
          </button>
          <button id="pay-btn-annual" style="padding:6px 18px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--accent);color:#111;transition:all .2s">
            ${t('annual') || 'Rok'} <span style="background:rgba(0,0,0,.15);color:#111;padding:1px 6px;border-radius:20px;font-size:10px;font-weight:700">-15%</span>
          </button>
        </div>

        <div id="pay-price-line" style="font-size:22px;font-weight:800;color:${accentColor}">$${prices.annual}<span style="font-size:13px;color:rgba(255,255,255,.4)">/${t('perMonth').replace('/','') || 'mo.'}</span></div>
        <div id="pay-annual-note" style="font-size:12px;color:rgba(255,255,255,.4);margin-top:4px">$${prices.annualTotal}/yr · <s>$${(prices.monthly * 12).toFixed(2)}</s></div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:4px">Unlimited residents · properties · bookings</div>
      </div>

      <!-- Pay button -->
      <div style="padding:20px 24px 4px">
        <a id="inv-pay-link" href="#" target="_blank" rel="noopener"
          style="
            display:block;width:100%;padding:14px;border-radius:10px;
            background:${btnBg};
            color:${btnColor};font-weight:800;font-size:15px;
            text-decoration:none;text-align:center;
            transition:opacity .2s;box-sizing:border-box;
          "
          onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          💳 Pay with Stripe — <span id="pay-btn-price">$${prices.annual}/${t('perMonth').replace('/','') || 'mo.'}</span>
        </a>
        <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px">
          Apple Pay · Google Pay · Card
        </div>
      </div>

      <!-- Invoice checkbox -->
      <div style="padding:12px 24px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border-radius:8px;border:1px solid var(--border3);background:var(--surface2)">
          <input type="checkbox" id="inv-toggle" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
          <span style="font-size:13px;color:var(--text2)">I need an invoice / Potrzebuję fakturę</span>
        </label>
      </div>

      <!-- Invoice fields (hidden by default) -->
      <div id="inv-fields" style="display:none;padding:0 24px 4px">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Company name</label>
            <input id="inv-company" type="text" placeholder="Your company or full name"
              style="width:100%;padding:9px 12px;background:var(--field-bg);border:1px solid var(--border3);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(232,168,56,.4)'" onblur="this.style.borderColor='var(--border3)'">
          </div>
          <div style="display:flex;gap:10px">
            <div style="flex:1">
              <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">NIP / VAT</label>
              <input id="inv-nip" type="text" placeholder="PL1234567890"
                style="width:100%;padding:9px 12px;background:var(--field-bg);border:1px solid var(--border3);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
                onfocus="this.style.borderColor='rgba(232,168,56,.4)'" onblur="this.style.borderColor='var(--border3)'">
            </div>
            <div style="flex:1">
              <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Country</label>
              <input id="inv-country" type="text" placeholder="Poland"
                style="width:100%;padding:9px 12px;background:var(--field-bg);border:1px solid var(--border3);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
                onfocus="this.style.borderColor='rgba(232,168,56,.4)'" onblur="this.style.borderColor='var(--border3)'">
            </div>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Address</label>
            <input id="inv-address" type="text" placeholder="Street, city, postal code"
              style="width:100%;padding:9px 12px;background:var(--field-bg);border:1px solid var(--border3);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(232,168,56,.4)'" onblur="this.style.borderColor='var(--border3)'">
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:10px;margin-bottom:4px;padding:8px 12px;background:var(--surface2);border-radius:6px;border-left:3px solid rgba(232,168,56,.3)">
          💡 Saved to your account · sent to <b style="color:var(--text2)">${email}</b>
        </div>
      </div>

      <!-- Cancel -->
      <div style="padding:8px 24px 20px;text-align:center">
        <button onclick="this.closest('.confirm-overlay').remove()"
          style="background:transparent;border:none;color:var(--text3);font-size:13px;cursor:pointer;padding:8px;font-family:inherit">
          Cancel
        </button>
      </div>
    </div>
  `;

  const pm = t('perMonth').replace('/','') || 'mo.';
  const activeStyle = 'padding:6px 18px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--accent);color:#111;transition:all .2s';
  const inactiveStyle = 'padding:6px 18px;border-radius:100px;border:none;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:rgba(255,255,255,.5);transition:all .2s';

  const links = STRIPE_LINKS[planType] || STRIPE_LINKS.pro;

  const monthlyTotal = (prices.monthly * 12).toFixed(2);

  function updateBilling(type) {
    currentBilling = type;
    const isAnnual = type === 'annual';
    const price = isAnnual ? prices.annual : prices.monthly;
    const link = isAnnual ? links.annual : links.monthly;

    el.querySelector('#pay-price-line').innerHTML = `$${price}<span style="font-size:13px;color:rgba(255,255,255,.4)">/${pm}</span>`;
    el.querySelector('#pay-annual-note').innerHTML = isAnnual
      ? `$${prices.annualTotal}/yr · <s>$${monthlyTotal}</s>`
      : '';
    el.querySelector('#pay-btn-price').textContent = `$${price}/${pm}`;
    el.querySelector('#inv-pay-link').href = link + '?' + params.toString();
    el.querySelector('#pay-btn-monthly').style.cssText = isAnnual ? inactiveStyle : activeStyle;
    el.querySelector('#pay-btn-annual').style.cssText = isAnnual ? activeStyle : inactiveStyle;
  }

  // Init with the billing type selected on the upgrade modal
  updateBilling(_subBillingType || 'annual');

  // Billing toggle clicks
  el.querySelector('#pay-btn-monthly').addEventListener('click', () => updateBilling('monthly'));
  el.querySelector('#pay-btn-annual').addEventListener('click', () => updateBilling('annual'));

  // Toggle invoice fields
  el.querySelector('#inv-toggle').addEventListener('change', function () {
    el.querySelector('#inv-fields').style.display = this.checked ? 'block' : 'none';
  });

  // When Pay link is clicked — save invoice data if filled, then let <a> navigate
  el.querySelector('#inv-pay-link').addEventListener('click', async () => {
    const checked = el.querySelector('#inv-toggle').checked;
    if (checked && window._fb?.settingsDoc) {
      const company = el.querySelector('#inv-company').value.trim();
      const nip = el.querySelector('#inv-nip').value.trim();
      const country = el.querySelector('#inv-country').value.trim();
      const address = el.querySelector('#inv-address').value.trim();
      if (company || nip || address) {
        try {
          await window._fb.setDoc(window._fb.settingsDoc, {
            invoiceData: { company, nip, country, address, email }
          }, { merge: true });
        } catch (e) { console.warn('Invoice save:', e); }
      }
    }
    el.remove();
  });

  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// ===== HANDLE RETURN FROM STRIPE =====
// Call this on app load to check if user just paid
// Pro activation is handled server-side by Stripe webhook writing to Firestore.
// This function only shows a UI notification — it does NOT activate Pro.
export async function checkStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');

  if (payment !== 'success') return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  // Show "activating" toast — actual activation happens via Stripe webhook → Firestore
  showActivatingToast();

  // Wait for Firestore onSnapshot to pick up the server-side plan change
  try {
    const fb = window._fb;
    if (!fb || !fb.settingsDoc) {
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!window._fb?.settingsDoc) return;

    // Poll settings for up to 15s waiting for webhook to activate Pro
    let attempts = 0;
    const maxAttempts = 15;
    while (attempts < maxAttempts) {
      if (isPro()) break;
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    if (isPro()) {
      showProActivatedModal();
      if (window.render) window.render();
      if (window.updatePlanBadge) window.updatePlanBadge();
    } else {
      // Webhook may be delayed — user will see Pro once Firestore updates
      document.getElementById('pro-toast')?.remove();
      console.info('Waiting for Stripe webhook to activate Pro...');
    }
  } catch (e) {
    console.error('Stripe return error:', e);
  }
}

function showActivatingToast() {
  const toast = document.createElement('div');
  toast.id = 'pro-toast';
  toast.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:#1a1a2e;border:1px solid rgba(232,168,56,.3);
    color:var(--text);padding:12px 20px;border-radius:10px;
    font-size:14px;font-weight:600;z-index:500;
    box-shadow:0 8px 24px rgba(0,0,0,.4);
    display:flex;align-items:center;gap:8px;
  `;
  toast.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">⏳</span> Aktywacja Pro...';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showProActivatedModal() {
  document.getElementById('pro-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.style.zIndex = '400';
  el.innerHTML = `
    <div class="confirm-box" style="text-align:center;max-width:360px">
      <div style="font-size:52px;margin-bottom:12px"></div>
      <div class="confirm-title" style="font-size:20px">Pro aktywowany!</div>
      <div class="confirm-msg">
        Dziękujemy za zakup. Twój plan <b style="color:var(--accent)">Pro</b> jest już aktywny.<br>
        Enjoy unlimited everything! ✨
      </div>
      <div class="confirm-btns">
        <button class="c-ok" style="width:100%;padding:12px;font-size:15px"
          onclick="this.closest('.confirm-overlay').remove()">
          Świetnie! 
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// ===== MANAGE SUBSCRIPTION (Stripe Customer Portal) =====
const PORTAL_FUNCTION_URL = 'https://us-central1-hostel-manager-8d837.cloudfunctions.net/createPortalSession';

export async function openManageSubscription() {
  const uid = window._workspaceUid || window._currentUser?.uid || '';
  if (!uid) return;

  try {
    const res = await fetch(PORTAL_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
    const data = await res.json();
    if (data.url) {
      window.open(data.url, '_blank');
    } else {
      alert(data.error || 'Error opening subscription portal');
    }
  } catch (e) {
    console.error('Portal error:', e);
    alert('Could not open subscription management');
  }
}
window.openManageSubscription = openManageSubscription;

// Plan badge text
export function getPlanLabel() {
  const s = window._settings || {};
  if (s.plan === 'premium' && isPro()) return 'Premium';
  return isPro() ? 'Pro' : '🆓 Free';
}

export function getPlanStyle() {
  const s = window._settings || {};
  if (s.plan === 'premium' && isPro())
    return 'background:rgba(139,92,246,.12);color:#a78bfa;border:1px solid rgba(139,92,246,.3)';
  return isPro()
    ? 'background:rgba(232,168,56,.12);color:var(--accent);border:1px solid rgba(232,168,56,.3)'
    : 'background:var(--surface);color:var(--text3);border:1px solid var(--border3)';
}

// ---- Referral Code ----
// Referral codes are validated server-side via Firestore.
// The client sends the code; a Cloud Function or Firestore rule validates it.
export async function applyReferralCode(raw) {
  const code = (raw || '').trim();
  const status = document.getElementById('ref-code-status');
  if (!status) return;

  if (!code) {
    status.style.color = 'var(--red)';
    status.textContent = t('refCodeEmpty');
    return;
  }

  try {
    const fb = window._fb;
    if (!fb || !fb.settingsDoc) throw new Error('Not ready');
    const uid = window._workspaceUid || window._currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');

    // Write the code to a pending redemption doc — server validates and activates
    const redemptionDoc = fb.doc(fb.db, 'users', uid, 'referralRedemptions', Date.now().toString());
    await fb.setDoc(redemptionDoc, {
      code: code,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    });

    status.style.color = 'var(--accent)';
    status.textContent = t('refCodePending') || 'Verifying...';

    // Wait for server-side validation (onSnapshot on settings will update _settings.plan)
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      if (isPro()) break;
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    if (isPro()) {
      status.style.color = 'var(--green)';
      status.textContent = t('refCodeSuccess');
      setTimeout(() => {
        document.getElementById('upgrade-overlay')?.remove();
        if (window.updatePlanBadge) window.updatePlanBadge();
        if (window.render) window.render();
      }, 1500);
    } else {
      status.style.color = 'var(--red)';
      status.textContent = t('refCodeInvalid');
    }
  } catch (e) {
    status.style.color = 'var(--red)';
    status.textContent = (t('refCodeError') || 'Error: ') + e.message;
  }
}
