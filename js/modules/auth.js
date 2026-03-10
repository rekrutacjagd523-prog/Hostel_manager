// ===== AUTHENTICATION UI =====
import { at, t } from './constants.js';
import { showConfirm } from './utils.js';

function showAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

function authErrorMsg(code) {
    const m = {
        'auth/invalid-email': t('authBadEmail'),
        'auth/user-not-found': t('authNotFound'),
        'auth/wrong-password': t('authWrongPass'),
        'auth/invalid-credential': t('authInvalidCred'),
        'auth/email-already-in-use': t('authEmailUsed'),
        'auth/weak-password': t('authWeakPass'),
        'auth/too-many-requests': t('authTooMany')
    };
    return m[code] || t('authError') + ': ' + code;
}

export function switchAuthLang() {
    const tabs = document.querySelectorAll('.auth-tab');
    tabs[0].textContent = at('login');
    tabs[1].textContent = at('register');
    document.getElementById('auth-email').placeholder = at('email');
    document.getElementById('auth-pass').placeholder = at('pass');
    document.getElementById('auth-name').placeholder = at('name');
    document.getElementById('auth-reg-email').placeholder = at('email');
    document.getElementById('auth-reg-pass').placeholder = at('passHint');
    document.querySelector('#auth-login-form .auth-btn').textContent = at('login');
    document.getElementById('auth-forgot').textContent = at('forgot');
    document.querySelector('#auth-register-form .auth-btn').textContent = at('createAcc');
    document.querySelector('.auth-divider span').textContent = at('or');
    document.getElementById('auth-google-text').textContent = at('google');
    document.getElementById('auth-footer').textContent = at('footer');
    document.querySelector('.auth-subtitle').textContent = at('sub');
    localStorage.setItem('hostel-auth-lang', document.getElementById('auth-lang').value);
}

export function togglePassVis(id, btn) {
    const inp = document.getElementById(id);
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}

export function switchAuthTab(tab, btn) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('auth-login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('auth-error').textContent = '';
}

export async function doLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if (!email || !pass) return showAuthError(at('enterEmail'));
    try { await window._authLogin(email, pass); }
    catch (e) { showAuthError(authErrorMsg(e.code)); }
}

export async function doRegister() {
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-reg-email').value.trim();
    const pass = document.getElementById('auth-reg-pass').value;
    if (!email || !pass) return showAuthError(at('fillAll'));
    if (pass.length < 6) return showAuthError(at('passMin'));
    try { await window._authRegister(email, pass, name); }
    catch (e) { showAuthError(authErrorMsg(e.code)); }
}

export async function doGoogle() {
    try { await window._authGoogle(); }
    catch (e) {
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/unauthorized-domain') {
            showAuthError(at('googleBrowser'));
        } else {
            showAuthError(authErrorMsg(e.code));
        }
    }
}

export function doForgotPass() {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.innerHTML = '<div class="confirm-box">' +
        '<div class="confirm-icon">🔑</div>' +
        '<div class="confirm-title">' + at('forgot') + '</div>' +
        '<div class="confirm-msg">' + at('forgotMsg') + '</div>' +
        '<input class="auth-field" type="email" id="reset-email" placeholder="Email" style="margin-bottom:12px;text-align:left">' +
        '<div id="reset-status" style="font-size:12px;min-height:18px;margin-bottom:8px"></div>' +
        '<div class="confirm-btns">' +
        '<button class="c-cancel" id="reset-cancel">' + at('cancel') + '</button>' +
        '<button class="c-ok" id="reset-send">' + at('forgotSend') + '</button>' +
        '</div></div>';
    document.body.appendChild(el);
    el.querySelector('#reset-cancel').onclick = () => el.remove();
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    const emailInput = el.querySelector('#reset-email');
    const loginEmail = document.getElementById('auth-email').value.trim();
    if (loginEmail) emailInput.value = loginEmail;
    emailInput.focus();
    el.querySelector('#reset-send').onclick = async () => {
        const email = emailInput.value.trim();
        const status = el.querySelector('#reset-status');
        if (!email) { status.textContent = '❌ ' + at('enterEmail'); status.style.color = 'var(--red)'; return; }
        try {
            const { sendPasswordResetEmail } = window._fb;
            const auth = window._fb.auth;
            await sendPasswordResetEmail(auth, email);
            status.textContent = '✅ ' + at('forgotSent') + ' ' + email;
            status.style.color = 'var(--green)';
            el.querySelector('#reset-send').style.display = 'none';
            el.querySelector('#reset-cancel').textContent = 'OK';
        } catch (e) {
            console.error('Reset email error:', e);
            status.textContent = '❌ ' + (e.message || authErrorMsg(e.code));
            status.style.color = 'var(--red)';
        }
    };
    emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('#reset-send').click(); });
}

export function toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('user-menu');
    const badge = document.getElementById('user-badge');
    menu.classList.toggle('open');
    if (menu.classList.contains('open') && badge) {
        const rect = badge.getBoundingClientRect();
        menu.style.top = (rect.bottom + 6) + 'px';
        menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
    }
}

export async function doLogout() {
    document.getElementById('user-menu').classList.remove('open');
    await window._authLogout();
}

export async function doSwitchAccount() {
    document.getElementById('user-menu').classList.remove('open');
    await window._authLogout();
    setTimeout(() => { document.getElementById('auth-email').focus(); }, 300);
}

export function onUserLoggedIn(user) {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    const name = user.displayName || user.email.split('@')[0];
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').textContent = (name[0] || '?').toUpperCase();
    document.getElementById('um-name').textContent = name;
    document.getElementById('um-email').textContent = user.email || '';
    // Apply auth lang to app settings if first time
    const authLang = localStorage.getItem('hostel-auth-lang');
    if (authLang && (!window._settings || !window._settings.lang)) {
        window._fb.setDoc(window._fb.settingsDoc, { currency: 'PLN', lang: authLang }, { merge: true }).catch(() => { });
    }
    // Show workspace indicator if viewing someone else's data
    if (window._workspaceUid && window._workspaceUid !== user.uid) {
        const badge = document.querySelector('.conn-status');
        if (badge) badge.innerHTML = '☁ ' + t('sharedLabel');
    }
    if (window.render) window.render();
    if (window.updateUI) window.updateUI();
    if (window.restoreCollapsed) window.restoreCollapsed();
}

export function onUserLoggedOut() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-pass').value = '';
    document.getElementById('auth-error').textContent = '';
}

export function initAuthEvents() {
    // Restore auth lang from localStorage
    const saved = localStorage.getItem('hostel-auth-lang');
    if (saved) {
        const el = document.getElementById('auth-lang');
        if (el) { el.value = saved; switchAuthLang(); }
    }

    // Close user menu on outside click
    document.addEventListener('click', function () {
        document.getElementById('user-menu')?.classList.remove('open');
    });

    // Handle Enter key in auth fields
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            if (document.getElementById('auth-login-form').style.display !== 'none') {
                if (document.activeElement.id === 'auth-email' || document.activeElement.id === 'auth-pass') doLogin();
            }
            if (document.getElementById('auth-register-form').style.display !== 'none') {
                if (['auth-name', 'auth-reg-email', 'auth-reg-pass'].includes(document.activeElement.id)) doRegister();
            }
        }
    });
}
