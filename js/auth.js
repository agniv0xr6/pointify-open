import {
    db, DEFAULT_PASSWORD, resetDatabase,
    loadRecoveryCodes, issueRecoveryCodes, verifyRecoveryCode, spendRecoveryCode
} from './db.js';

const SESSION_KEY = 'pointify_session_v1';
const LOCK_KEY = 'pointify_login_lock_v1';

// Phase 2.5: a replacement password must be at least this long.
const MIN_PASSWORD_LENGTH = 6;

// D3 (final): exactly three roles. These two tables are the single source of
// truth for access control. applyRBAC(), checkPermission(), checkCapability(),
// switchView() and the mutation handlers in settings.js / inventory.js all read
// them, so the nav, the router and the guards can never drift apart.
//
// VIEW_ACCESS  -> which screens a role may open   (deny-by-default)
// CAPABILITIES -> which writes a role may perform (deny-by-default)
const VIEW_ACCESS = {
    admin: ['pos', 'inventory', 'reports', 'settings'],
    manager: ['pos', 'inventory', 'reports'],
    cashier: ['pos', 'reports']
};

// Matches the existing UI and the rule stated at inventory.js:157
// ("Managers can ADD, but NOT EDIT"): view-settings (store settings + user
// management) is admin-only, and product writes are split so a manager can
// create stock but not rewrite or delete what is already on the shelf.
const CAPABILITY_ACCESS = {
    admin: ['settings:write', 'users:write', 'products:create', 'products:edit', 'products:delete'],
    manager: ['products:create'],
    cashier: []
};

// Failed-login backoff. Offline single-device app, so this is stored in
// localStorage and is best-effort: if storage is unavailable the lock is
// skipped (availability wins over security on a point-of-sale).
const LOCK_FAIL_THRESHOLD = 5;
const LOCK_BASE_MS = 15000;
const LOCK_CAP_MS = 5 * 60 * 1000;

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.bindEvents();
        this.init();
    }

    // --- Session -------------------------------------------------------------

    // D2 / Phase 2.5: an account must change its password when it is explicitly
    // flagged, or when it is still carrying the temporary bootstrap password.
    // (The password check means existing databases are covered without a migration.)
    needsPasswordChange(user) {
        if (!user) return false;
        return user.mustChangePassword === true || user.password === DEFAULT_PASSWORD;
    }

    // The persisted session never carries the password: anything that reads
    // sessionStorage (including other scripts on the page) only ever sees
    // id / username / name / role / mustChangePassword.
    toSession(user) {
        if (!user || user.id === undefined || user.id === null) return null;
        return {
            id: user.id,
            username: user.username,
            name: user.name || user.username,
            role: user.role,
            mustChangePassword: this.needsPasswordChange(user)
        };
    }

    async init() {
        let restored = false;
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) {
                restored = await this.restoreSession(raw);
            }
        } catch (e) {
            console.error('Auth Init Error', e);
            this.clearSession();
        }

        if (!restored) {
            this.showLogin();
        }
        // Watchdog signal: the app has rendered a screen it can act on.
        window.__pointifyReady = true;
    }

    // The stored blob is only a *key*: the authoritative role always comes back
    // from IndexedDB. Hand-editing sessionStorage therefore cannot escalate
    // privileges, and a user who was deleted while the tab was open is logged
    // out immediately instead of continuing as a ghost session.
    async restoreSession(raw) {
        let session = null;
        try {
            session = JSON.parse(raw);
        } catch (e) {
            session = null;
        }

        if (!session || session.id === undefined || session.id === null) {
            this.clearSession();
            return false;
        }

        let user = null;
        try {
            user = await db.get('users', session.id);
        } catch (e) {
            console.error('Session restore failed', e);
            this.clearSession();
            return false;
        }

        if (!user) {
            this.clearSession();
            return false;
        }

        this.currentUser = this.toSession(user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.currentUser));

        // D2 / Phase 2.5: a restored session must not open the app while the
        // account is still on the default password.
        if (this.currentUser.mustChangePassword) {
            this.requirePasswordChange();
        } else {
            this.onLoginSuccess();
        }
        return true;
    }

    clearSession() {
        this.currentUser = null;
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) { /* storage unavailable */ }
    }

    // --- UI ------------------------------------------------------------------

    showLogin() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');

        // Always come back to the username/password panel
        const loginPanel = document.getElementById('login-panel');
        const changePanel = document.getElementById('force-change-panel');
        const resetPanel = document.getElementById('reset-panel');
        if (loginPanel) loginPanel.classList.remove('hidden');
        if (changePanel) changePanel.classList.add('hidden');
        if (resetPanel) resetPanel.classList.add('hidden');
        const recoveryPanel = document.getElementById('recovery-panel');
        if (recoveryPanel) recoveryPanel.classList.add('hidden');
    }

    // Swaps which panel of the auth screen is showing. A class method (not a
    // closure in bindEvents) so async openers like openRecoveryPanel() can use
    // it too.
    showAuthPanel(id) {
        ['login-panel', 'force-change-panel', 'reset-panel', 'recovery-panel']
            .forEach(panelId => {
                const el = document.getElementById(panelId);
                if (el) el.classList.toggle('hidden', panelId !== id);
            });
    }

    // --- Recovery (non-destructive) -------------------------------------------

    // Opens the recovery panel with the account list freshly loaded, so a user
    // created after the page was last painted still appears.
    async openRecoveryPanel() {
        const sel = document.getElementById('rec-account');
        if (sel) {
            sel.innerHTML = '<option value="">Choose an account...</option>';
            try {
                const users = await db.getAll('users');
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = String(u.id);
                    opt.textContent = `${u.username} (${u.role})`;
                    sel.appendChild(opt);
                });
            } catch (e) {
                console.error('Could not load accounts for recovery', e);
            }
        }
        const err = document.getElementById('rec-error');
        if (err) err.classList.add('hidden');
        this.showAuthPanel('recovery-panel');
    }

    // Resets ONE account's credentials using one backup code. Products, sales,
    // reports and settings are never read or written here - that is the whole
    // point of the feature, so the guarantees are structural, not advisory.
    async submitRecovery(e) {
        e.preventDefault();
        const fail = msg => {
            const el = document.getElementById('rec-error');
            if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        };

        const lockedFor = this.lockRemainingMs();
        if (lockedFor > 0) {
            fail(`Too many attempts. Try again in ${Math.ceil(lockedFor / 1000)} seconds.`);
            return;
        }

        const code = document.getElementById('rec-code').value.trim();
        const accountSel = document.getElementById('rec-account');
        const newUsername = document.getElementById('rec-username').value.trim();
        const newPassword = document.getElementById('rec-password').value;
        const confirm = document.getElementById('rec-confirm').value;

        if (!code) { fail('Enter one of your backup codes.'); return; }
        if (!accountSel || !accountSel.value) { fail('Choose the account to recover.'); return; }
        if (!newUsername) { fail('Enter a username.'); return; }
        if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
            fail(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (newPassword !== confirm) { fail('Passwords do not match.'); return; }

        // Verify BEFORE spending. A typo must not burn one of the owner's five.
        const valid = await verifyRecoveryCode(code);
        if (!valid) {
            this.registerFailure();
            const wait = this.lockRemainingMs();
            fail(wait > 0
                ? `That code is not valid. Locked for ${Math.ceil(wait / 1000)} seconds.`
                : 'That code is not valid.');
            return;
        }

        const id = Number(accountSel.value);
        let record = null;
        try { record = await db.get('users', id); } catch (err) { record = null; }
        if (!record) { fail('That account no longer exists.'); return; }

        record.username = newUsername;
        record.password = newPassword;
        record.mustChangePassword = false;

        try {
            await db.put('users', record);
        } catch (err) {
            fail('That username is already taken. Choose another.');
            return;
        }

        // The credentials saved successfully, so now - and only now - the code
        // is spent. A failed save leaves all five intact.
        await spendRecoveryCode(code);
        this.resetLock();

        ['rec-code', 'rec-username', 'rec-password', 'rec-confirm'].forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) el.value = '';
        });

        this.showLogin();
        const note = document.getElementById('login-error');
        if (note) {
            note.textContent = `Account recovered. Sign in as "${newUsername}".`;
            note.classList.remove('hidden', 'text-red-600', 'bg-red-50', 'border-red-100');
            note.classList.add('text-emerald-600', 'bg-emerald-50', 'border-emerald-100');
        }
    }

    // --- Backup codes ---------------------------------------------------------

    // Called on every successful sign-in. Issues a set only if none exist, so
    // the modal appears exactly once per device unless the owner regenerates.
    async ensureBackupCodes() {
        try {
            const existing = await loadRecoveryCodes();
            if (existing.length > 0) return;
            this.showBackupCodes(await issueRecoveryCodes());
        } catch (e) {
            console.error('Could not issue backup codes', e);
        }
    }

    showBackupCodes(codes) {
        const modal = document.getElementById('backup-codes-modal');
        const list = document.getElementById('backup-codes-list');
        const confirmBox = document.getElementById('backup-confirmed');
        const cont = document.getElementById('backup-continue');
        if (!modal || !list) return;

        this.pendingCodes = codes;
        list.innerHTML = codes.map(code =>
            `<div class="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span class="font-mono font-bold tracking-widest text-slate-900 text-lg">${code}</span>
            </div>`).join('');

        const copied = document.getElementById('backup-copied');
        if (copied) copied.classList.add('hidden');
        if (confirmBox) confirmBox.checked = false;
        if (cont) cont.disabled = true;
        modal.classList.remove('hidden');
    }

    // Clipboard API needs a secure context; 192.168.x.x over plain http is not
    // one, which is exactly how a till on a LAN gets reached from a phone.
    async copyText(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) { /* fall through to the legacy path */ }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    // D2 / Phase 2.5: hold the user on the auth screen - the app shell is never
    // opened - until a replacement password has been saved.
    requirePasswordChange() {
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');

        const loginPanel = document.getElementById('login-panel');
        const changePanel = document.getElementById('force-change-panel');
        const resetPanel = document.getElementById('reset-panel');
        if (loginPanel) loginPanel.classList.add('hidden');
        if (changePanel) changePanel.classList.remove('hidden');
        if (resetPanel) resetPanel.classList.add('hidden');

        const errorMsg = document.getElementById('change-error');
        if (errorMsg) errorMsg.classList.add('hidden');

        ['fc-current', 'fc-new', 'fc-confirm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    showLoginError(errorMsg, text) {
        if (!errorMsg) return;
        errorMsg.textContent = text;
        errorMsg.classList.remove('hidden');
    }

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Phase 2.5: forced password change panel
        const changeForm = document.getElementById('force-change-form');
        if (changeForm) {
            changeForm.addEventListener('submit', (e) => this.handleForceChange(e));
        }

        const cancelBtn = document.getElementById('fc-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.logout());
        }

        // Locked-out recovery. A single-device POS has no server, so a forgotten
        // password has no reset path. This panel wipes the local database and
        // reloads; db.seed() then rebuilds the bootstrap admin. Typing RESET is
        // required because the login screen is reachable by anyone at the till.
        const resetPanel = document.getElementById('reset-panel');
        const resetInput = document.getElementById('reset-confirm-input');
        const resetConfirm = document.getElementById('reset-confirm');
        const resetCancel = document.getElementById('reset-cancel');
        const resetError = document.getElementById('reset-error');

        const forgotBtn = document.getElementById('forgot-password');
        if (forgotBtn) forgotBtn.addEventListener('click', () => this.openRecoveryPanel());
        if (resetCancel) resetCancel.addEventListener('click', () => this.showAuthPanel('login-panel'));

        // --- Screen lock --------------------------------------------------
        ['lock-btn', 'mobile-lock-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => this.lockScreen());
        });
        const unlockForm = document.getElementById('unlock-form');
        if (unlockForm) unlockForm.addEventListener('submit', (e) => this.unlockScreen(e));
        const lockSignout = document.getElementById('lock-signout');
        if (lockSignout) lockSignout.addEventListener('click', () => {
            // Leaving through the lock screen is still a real sign-out.
            const screen = document.getElementById('lock-screen');
            if (screen) screen.classList.add('hidden');
            this.logout();
        });
        // Escape closes nothing here on purpose: the lock must not be
        // dismissable without the password.

        // --- Recovery (non-destructive) -----------------------------------
        const recoveryForm = document.getElementById('recovery-form');
        if (recoveryForm) {
            recoveryForm.addEventListener('submit', (e) => this.submitRecovery(e));
        }
        const recCancel = document.getElementById('rec-cancel');
        if (recCancel) recCancel.addEventListener('click', () => this.showAuthPanel('login-panel'));
        const recToReset = document.getElementById('rec-to-reset');
        if (recToReset) recToReset.addEventListener('click', () => this.showAuthPanel('reset-panel'));

        // --- Backup codes modal -------------------------------------------
        const backupConfirmed = document.getElementById('backup-confirmed');
        const backupContinue = document.getElementById('backup-continue');
        if (backupConfirmed && backupContinue) {
            backupConfirmed.addEventListener('change', () => {
                backupContinue.disabled = !backupConfirmed.checked;
            });
        }
        if (backupContinue) {
            backupContinue.addEventListener('click', () => {
                const modal = document.getElementById('backup-codes-modal');
                if (modal) modal.classList.add('hidden');
                this.pendingCodes = null;
            });
        }
        const backupCopy = document.getElementById('backup-copy');
        if (backupCopy) {
            backupCopy.addEventListener('click', async () => {
                const ok = await this.copyText((this.pendingCodes || []).join('\n'));
                const note = document.getElementById('backup-copied');
                if (note) {
                    note.textContent = ok ? 'Copied to clipboard' : 'Could not copy - write them down manually';
                    note.classList.toggle('text-emerald-600', ok);
                    note.classList.toggle('text-red-600', !ok);
                    note.classList.remove('hidden');
                }
            });
        }

        if (resetInput && resetConfirm) {
            resetInput.addEventListener('input', () => {
                resetConfirm.disabled = resetInput.value.trim() !== 'RESET';
                if (resetError) resetError.classList.add('hidden');
            });
        }

        if (resetConfirm) {
            resetConfirm.addEventListener('click', async () => {
                if (!resetInput || resetInput.value.trim() !== 'RESET') {
                    if (resetError) {
                        resetError.textContent = 'Type RESET exactly to confirm.';
                        resetError.classList.remove('hidden');
                    }
                    return;
                }
                resetConfirm.disabled = true;
                resetConfirm.textContent = 'Erasing...';
                await this.factoryReset();
            });
        }
    }

    // Wipe the local database and reload. db.seed() recreates the bootstrap
    // admin, so this is the recovery path when the password is forgotten.
    async factoryReset() {
        try { await resetDatabase(); } catch (e) { console.error('Reset failed', e); }
        try { localStorage.removeItem(LOCK_KEY); } catch (e) { /* storage unavailable */ }
        try { sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
        window.location.reload();
    }

    // --- Login lock ----------------------------------------------------------

    lockRemainingMs() {
        try {
            const lock = JSON.parse(localStorage.getItem(LOCK_KEY)) || {};
            return Math.max(0, (Number(lock.until) || 0) - Date.now());
        } catch (e) {
            return 0;
        }
    }

    registerFailure() {
        try {
            const lock = JSON.parse(localStorage.getItem(LOCK_KEY)) || {};
            const fails = (Number(lock.fails) || 0) + 1;
            let until = 0;
            if (fails >= LOCK_FAIL_THRESHOLD) {
                const over = fails - LOCK_FAIL_THRESHOLD;
                const wait = Math.min(LOCK_CAP_MS, LOCK_BASE_MS * Math.pow(2, over));
                until = Date.now() + wait;
            }
            localStorage.setItem(LOCK_KEY, JSON.stringify({ fails, until }));
        } catch (e) { /* storage unavailable */ }
    }

    resetLock() {
        try {
            localStorage.setItem(LOCK_KEY, JSON.stringify({ fails: 0, until: 0 }));
        } catch (e) { /* storage unavailable */ }
    }

    // --- Login ---------------------------------------------------------------

    async handleLogin(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');

        if (!usernameInput || !passwordInput) {
            // Inline form error, not a blocking alert() over the login screen.
            this.showLoginError(errorMsg, 'Please enter both username and password');
            return;
        }

        const lockedFor = this.lockRemainingMs();
        if (lockedFor > 0) {
            this.showLoginError(errorMsg, `Too many attempts. Try again in ${Math.ceil(lockedFor / 1000)} seconds.`);
            return;
        }

        try {
            const user = await this.authenticate(usernameInput, passwordInput);

            if (user) {
                this.resetLock();
                this.currentUser = this.toSession(user);
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.currentUser));
                if (errorMsg) errorMsg.classList.add('hidden');

                // D2 / Phase 2.5: never open the app on the default password
                if (this.currentUser.mustChangePassword) {
                    this.requirePasswordChange();
                } else {
                    this.onLoginSuccess();
                }
            } else {
                this.registerFailure();
                const wait = this.lockRemainingMs();
                this.showLoginError(
                    errorMsg,
                    wait > 0
                        ? `Invalid username or password. Locked for ${Math.ceil(wait / 1000)} seconds.`
                        : 'Invalid username or password.'
                );
            }
        } catch (err) {
            console.error('Login error:', err);
            this.showLoginError(errorMsg, 'System error during login.');
        }
    }

    async authenticate(username, password) {
        // NOTE: credentials are stored and compared in plaintext.
        // Hashing is deliberately NOT introduced here: it would need Web Crypto
        // (unavailable on file:// or plain-http LAN hosting) plus a migration of
        // db.seed(), add-user and profile-update. Tracked as an open decision.
        const allUsers = await db.getAll('users');
        const user = allUsers.find(u => u.username === username && u.password === password);
        // Only ever hand back the safe projection.
        return user ? this.toSession(user) : null;
    }

    // D2 / Phase 2.5: the only path that clears the change-password requirement.
    // The app shell stays closed until this succeeds, and a session restore
    // re-runs the same check, so reloading or clearing sessionStorage is not a bypass.
    async handleForceChange(e) {
        e.preventDefault();

        const currentInput = document.getElementById('fc-current');
        const nextInput = document.getElementById('fc-new');
        const confirmInput = document.getElementById('fc-confirm');
        const errorMsg = document.getElementById('change-error');

        const fail = (text) => {
            if (!errorMsg) return;
            errorMsg.textContent = text;
            errorMsg.classList.remove('hidden');
        };

        if (!this.currentUser || this.currentUser.id === undefined || this.currentUser.id === null) {
            this.clearSession();
            this.showLogin();
            return;
        }

        const lockedFor = this.lockRemainingMs();
        if (lockedFor > 0) {
            fail(`Too many attempts. Try again in ${Math.ceil(lockedFor / 1000)} seconds.`);
            return;
        }

        const current = currentInput ? currentInput.value : '';
        const next = nextInput ? nextInput.value : '';
        const confirm = confirmInput ? confirmInput.value : '';

        try {
            // Always re-read: the session blob is only a key.
            const record = await db.get('users', this.currentUser.id);
            if (!record) {
                this.clearSession();
                this.showLogin();
                return;
            }

            if (record.password !== current) {
                this.registerFailure();
                const wait = this.lockRemainingMs();
                fail(wait > 0
                    ? `Current password is incorrect. Locked for ${Math.ceil(wait / 1000)} seconds.`
                    : 'Current password is incorrect.');
                return;
            }

            if (!next || next.length < MIN_PASSWORD_LENGTH) {
                fail(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
                return;
            }

            if (next === current) {
                fail('New password must be different from the current one.');
                return;
            }

            if (next !== confirm) {
                fail('Passwords do not match.');
                return;
            }

            record.password = next;
            record.mustChangePassword = false;
            await db.put('users', record);

            this.resetLock();
            this.currentUser = this.toSession(record);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.currentUser));

            if (currentInput) currentInput.value = '';
            if (nextInput) nextInput.value = '';
            if (confirmInput) confirmInput.value = '';

            this.onLoginSuccess();
        } catch (err) {
            console.error('Password change failed:', err);
            fail('Could not save the new password. Try again.');
        }
    }

    renderIdentity() {
        if (!this.currentUser) return;
        const nameEl = document.getElementById('user-name');
        const roleEl = document.getElementById('user-role');
        const avEl = document.getElementById('user-avatar');

        if (nameEl) nameEl.textContent = this.currentUser.name || this.currentUser.username;
        if (roleEl) roleEl.textContent = (this.currentUser.role || 'user').toUpperCase();
        if (avEl) avEl.textContent = (this.currentUser.name || this.currentUser.username)[0].toUpperCase();
    }

    // Called by settings.js after a profile edit so the header, the nav and the
    // router all see the new name/role without a page reload.
    syncSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            this.currentUser = raw ? JSON.parse(raw) : null;
        } catch (e) {
            this.currentUser = null;
        }

        if (!this.currentUser) {
            this.showLogin();
            return;
        }

        this.renderIdentity();
        this.applyRBAC();

        // Fail-closed: if the stored blob still says a change is required, put the
        // user back on the auth screen instead of leaving the app open.
        if (this.currentUser.mustChangePassword) this.requirePasswordChange();
    }

    onLoginSuccess() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');

        if (this.currentUser) {
            this.renderIdentity();
            this.applyRBAC();
            window.showToast(`Welcome back, ${this.currentUser.username}`);
        }

        if (window.switchView) window.switchView('pos');

        // Make sure the owner has backup codes. No-ops once a set exists.
        this.ensureBackupCodes();
    }

    // --- Screen lock (D7) -----------------------------------------------------
    //
    // Covers the app without ending the session: the till owner can step away
    // and come back to exactly where they were, rather than signing out and
    // losing the cart, the open report, the unsaved form. Re-entering the
    // account password is the only way past it.

    lockScreen() {
        if (!this.currentUser) return;
        const screen = document.getElementById('lock-screen');
        if (!screen) return;

        const name = this.currentUser.name || this.currentUser.username;
        const nameEl = document.getElementById('lock-name');
        const avEl = document.getElementById('lock-avatar');
        if (nameEl) nameEl.textContent = name;
        if (avEl) avEl.textContent = (name || '?')[0].toUpperCase();

        // Blank the field every time, so the previous attempt is not left on
        // screen for whoever walks up next.
        const pw = document.getElementById('lock-password');
        if (pw) pw.value = '';
        const err = document.getElementById('lock-error');
        if (err) err.classList.add('hidden');

        screen.classList.remove('hidden');
        // Focus after the frame, otherwise some browsers ignore it on a
        // freshly-shown overlay.
        requestAnimationFrame(() => { if (pw) pw.focus(); });
    }

    async unlockScreen(e) {
        e.preventDefault();
        const pwEl = document.getElementById('lock-password');
        const errEl = document.getElementById('lock-error');
        const fail = msg => {
            if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
        };

        const lockedFor = this.lockRemainingMs();
        if (lockedFor > 0) {
            fail(`Too many attempts. Try again in ${Math.ceil(lockedFor / 1000)} seconds.`);
            return;
        }

        const password = pwEl ? pwEl.value : '';
        if (!password) { fail('Enter your password.'); return; }

        // Read the real record, not the session projection - the session never
        // carries the password.
        let record = null;
        try { record = await db.get('users', this.currentUser.id); } catch (err) { record = null; }
        if (!record) { fail('Account not found. Sign out and back in.'); return; }

        if (record.password !== password) {
            // Same backoff as the login screen, so the lock cannot be used to
            // guess a password faster than the login could.
            this.registerFailure();
            const wait = this.lockRemainingMs();
            fail(wait > 0
                ? `Wrong password. Locked for ${Math.ceil(wait / 1000)} seconds.`
                : 'Wrong password.');
            return;
        }

        this.resetLock();
        const screen = document.getElementById('lock-screen');
        if (screen) screen.classList.add('hidden');
        if (pwEl) pwEl.value = '';
    }

    logout() {
        this.clearSession();

        if (window.posModule) {
            window.posModule.reset();
        }

        this.showLogin();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        const errorMsg = document.getElementById('login-error');
        if (errorMsg) errorMsg.classList.add('hidden');
    }

    // --- Access control ------------------------------------------------------

    viewsFor(role) {
        return VIEW_ACCESS[role] || VIEW_ACCESS.cashier;
    }

    capabilitiesFor(role) {
        return CAPABILITY_ACCESS[role] || [];
    }

    applyRBAC() {
        if (!this.currentUser) return;
        const allowed = this.viewsFor(this.currentUser.role);

        document.querySelectorAll('[data-view]').forEach(item => {
            const view = item.dataset.view;
            item.classList.toggle('hide', !allowed.includes(view));
        });
    }

    // Global permission check for the router
    checkPermission(view) {
        if (!this.currentUser) return false;
        return this.viewsFor(this.currentUser.role).includes(view);
    }

    // Capability check for mutating handlers (settings / users / products)
    checkCapability(capability) {
        if (!this.currentUser) return false;
        return this.capabilitiesFor(this.currentUser.role).includes(capability);
    }
}

// Export singleton
export const auth = new AuthSystem();

// Expose permission checks for the router in app.html and for the mutation
// handlers in settings.js / inventory.js.
window.checkPermission = (view) => auth.checkPermission(view);
window.hasCapability = (capability) => auth.checkCapability(capability);
window.syncAuthSession = () => auth.syncSession();
// Single projection for "write the session blob" anywhere else in the app, so
// the password is never persisted and mustChangePassword is always recomputed.
window.sessionFromUser = (user) => auth.toSession(user);
window.logout = () => auth.logout();
// Settings shows the same modal the first-login flow uses.
window.showBackupCodes = codes => auth.showBackupCodes(codes);
window.copyPointifyText = text => auth.copyText(text);
