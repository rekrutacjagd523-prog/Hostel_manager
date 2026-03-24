// ===== FIREBASE INITIALIZATION & AUTH =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, getDoc, deleteDoc,
    onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
    signOut, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp({
    apiKey: "AIzaSyDjmbPq-Cx3A8VBFh_Bw6ErEukZ5q68Frs",
    authDomain: "hostel-manager-8d837.firebaseapp.com",
    projectId: "hostel-manager-8d837",
    storageBucket: "hostel-manager-8d837.firebasestorage.app",
    messagingSenderId: "978903412838",
    appId: "1:978903412838:web:5723498b6ebe0244807da7"
});
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

window._fb = { db, auth, setDoc, getDoc, deleteDoc, doc, col: collection, googleProvider, signInWithPopup, signOut, sendPasswordResetEmail };
window._unsubs = [];

function startListening(uid) {
    window._unsubs.forEach(u => u()); window._unsubs = [];
    const resCol = collection(db, "users", uid, "residents");
    const propCol = collection(db, "users", uid, "properties");
    const settDoc = doc(db, "users", uid, "settings", "main");
    window._fb.settingsDoc = settDoc;
    window._fb.resCol = resCol;
    window._fb.propCol = propCol;

    const u1 = onSnapshot(query(resCol, orderBy("createdAt", "desc")), s => {
        window._residents = []; s.forEach(d => window._residents.push({ id: d.id, ...d.data() }));
        if (window.render) window.render();
    });
    const u2 = onSnapshot(settDoc, d => {
        if (d.exists()) window._settings = d.data();
        const _hlm = { RU: 'ru', PL: 'pl', UA: 'uk', EN: 'en', LT: 'lt' };
        if (window._settings && window._settings.lang) document.documentElement.lang = _hlm[window._settings.lang] || 'ru';
        if (window.render) { window.render(); if (typeof window.updateUI === 'function') window.updateUI(); if (window.renderFAQ) window.renderFAQ(); }
    });
    const u3 = onSnapshot(query(propCol, orderBy("createdAt", "desc")), s => {
        window._properties = []; s.forEach(d => window._properties.push({ id: d.id, ...d.data() }));
        if (window.render) window.render();
    });
    // Listen for workspace members
    const memCol = collection(db, "users", uid, "members");
    const u4 = onSnapshot(memCol, s => {
        window._members = []; s.forEach(d => window._members.push({ id: d.id, ...d.data() }));
    });
    // Listen for expenses
    const expCol = collection(db, "users", uid, "expenses");
    const u5 = onSnapshot(query(expCol, orderBy("date", "desc")), s => {
        window._expenses = []; s.forEach(d => window._expenses.push({ id: d.id, ...d.data() }));
        if (window.renderFinSummary) window.renderFinSummary();
        if (window.renderExpenses) window.renderExpenses();
    });
    window._fb.expCol = expCol;
    // Listen for bookings
    const bookCol = collection(db, "users", uid, "bookings");
    const u6 = onSnapshot(query(bookCol, orderBy("startDate", "desc")), s => {
        window._bookings = []; s.forEach(d => window._bookings.push({ id: d.id, ...d.data() }));
        if (window.renderBookings) window.renderBookings();
    });
    window._fb.bookCol = bookCol;
    window._unsubs.push(u1, u2, u3, u4, u5, u6);
}

function stopListening() {
    window._unsubs.forEach(u => u()); window._unsubs = [];
    window._residents = []; window._settings = { currency: 'PLN', lang: 'RU' };
    window._members = []; window._subscription = { plan: 'free' };
    window._expenses = []; window._bookings = [];
}


// Auth helpers
window._authLogin = async function (email, pass) {
    return signInWithEmailAndPassword(auth, email, pass);
};
window._authRegister = async function (email, pass, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    return cred;
};
window._authGoogle = async function () {
    return signInWithPopup(auth, googleProvider);
};
window._authLogout = async function () {
    stopListening();
    return signOut(auth);
};

// Save invite param BEFORE auth so it survives registration redirect
(function () {
    const p = new URLSearchParams(window.location.search);
    const inv = p.get('invite');
    if (inv) localStorage.setItem('hostel-pending-invite', inv);
})();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window._currentUser = user;
        // Check invite: URL param first, then pending from localStorage
        const params = new URLSearchParams(window.location.search);
        let inviteUid = params.get('invite') || localStorage.getItem('hostel-pending-invite');
        localStorage.removeItem('hostel-pending-invite');
        let workspaceUid = user.uid;
        if (inviteUid && inviteUid !== user.uid) {
            // Check if blocked
            let blocked = false;
            try {
                const bDoc = await getDoc(doc(db, "users", inviteUid, "blocked", user.uid));
                if (bDoc.exists()) blocked = true;
            } catch (e) { }
            if (blocked) {
                localStorage.removeItem('hostel-workspace-' + user.uid);
                workspaceUid = user.uid;
            } else {
                localStorage.setItem('hostel-workspace-' + user.uid, inviteUid);
                workspaceUid = inviteUid;
                window.history.replaceState({}, '', window.location.pathname);
            }
        } else {
            const saved = localStorage.getItem('hostel-workspace-' + user.uid);
            if (saved) {
                let blocked = false;
                try {
                    const bDoc = await getDoc(doc(db, "users", saved, "blocked", user.uid));
                    if (bDoc.exists()) blocked = true;
                } catch (e) { }
                if (blocked) {
                    localStorage.removeItem('hostel-workspace-' + user.uid);
                } else {
                    workspaceUid = saved;
                }
            }
        }
        window._workspaceUid = workspaceUid;
        // Always register as member if connected to someone else's workspace
        if (workspaceUid !== user.uid) {
            try {
                await setDoc(doc(db, "users", workspaceUid, "members", user.uid), {
                    email: user.email || '',
                    name: user.displayName || user.email?.split('@')[0] || '',
                    joinedAt: new Date().toISOString()
                }, { merge: true });
                // Small delay so Firestore propagates the member doc before listeners start
                await new Promise(r => setTimeout(r, 500));
            } catch (e) { console.warn('Member register:', e.message); }
        }
        startListening(workspaceUid);
        if (window.onUserLoggedIn) window.onUserLoggedIn(user);
    } else {
        window._currentUser = null;
        stopListening();
        if (window.onUserLoggedOut) window.onUserLoggedOut();
    }
});
