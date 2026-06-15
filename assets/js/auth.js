/**
 * EduPulse — School portal authentication (session)
 * Future: replace authenticate() backend with JWT / OAuth.
 */

const PortalAuth = {
  SESSION_KEY: 'edupulse_session_v1',

  login(username, password) {
    const result = EduStore.authenticateByUsername(username, password);
    if (!result.ok) return result;

    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(result.session));
    sessionStorage.removeItem('edupulse_role');
    EduStore.setActiveSchool(result.session.schoolId);
    EduStore.syncToEdupulse();
    return result;
  },

  logout(reason = 'signed_out') {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem('edupulse_role');
    return reason;
  },

  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.restoreSession();
  },

  restoreSession() {
    const session = this.getSession();
    if (!session?.userId) return null;

    const user = EduStore.getUser(session.userId);
    const school = EduStore.getSchool(session.schoolId);
    if (!user || user.status !== 'active' || !school) {
      this.logout('invalid');
      return null;
    }
    if (school.status === 'suspended' || school.status === 'inactive') {
      this.logout('school_inactive');
      return null;
    }

    EduStore.setActiveSchool(session.schoolId);
    EduStore.syncToEdupulse();
    return { ...session, name: user.name, email: user.email, roleId: user.roleId };
  },

  getRoleName(roleId) {
    return EDUPULSE.roles.find(r => r.id === roleId)?.name || roleId;
  }
};

/**
 * School portal shell — login gate visibility and sign-out UX.
 */
const PortalShell = {
  init() {
    EduStore.init();
    this.bindLoginForm();
    this.prefillFromUrl();

    const logoutReason = sessionStorage.getItem('edupulse_logout_reason');
    if (logoutReason) {
      this.showLoginMessage(logoutReason);
      sessionStorage.removeItem('edupulse_logout_reason');
    }

    if (PortalAuth.restoreSession()) {
      this.showApp();
      App.init();
    } else {
      this.showLogin();
    }
  },

  bindLoginForm() {
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin(e.target);
    });

    document.getElementById('login-gate')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fill-login]');
      if (!btn) return;
      e.preventDefault();
      document.getElementById('login-username').value = btn.dataset.username || '';
      document.getElementById('login-password').value = btn.dataset.password || '';
      document.getElementById('login-error').hidden = true;
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => this.handleLogout());
  },

  prefillFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const usernameEl = document.getElementById('login-username');
    if (!usernameEl) return;
    const u = params.get('u');
    const code = params.get('code');
    const schoolId = params.get('school');
    if (u) {
      usernameEl.value = u;
    } else if (code) {
      usernameEl.value = `0001@${code.toUpperCase()}`; // admin convenience for the demo
    } else if (schoolId) {
      const school = EduStore.getSchool(schoolId);
      if (school?.schoolCode) usernameEl.value = `0001@${school.schoolCode}`;
    }
  },

  handleLogin(form) {
    const username = form.username.value;
    const password = form.password.value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = form.querySelector('[type="submit"]');

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const result = PortalAuth.login(username, password);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';

    if (!result.ok) {
      errorEl.textContent = result.message;
      errorEl.hidden = false;
      return;
    }

    this.showApp();
    App.init();
  },

  handleLogout() {
    PortalAuth.logout();
    sessionStorage.setItem('edupulse_logout_reason', 'signed_out');
    window.location.href = 'prototype.html';
  },

  showLoginMessage(reason) {
    const el = document.getElementById('login-banner');
    if (!el) return;
    const messages = {
      signed_out: 'You have been signed out.',
      school_inactive: 'Your school account is inactive. Contact your administrator.',
      invalid: 'Your session expired. Please sign in again.'
    };
    el.textContent = messages[reason] || '';
    el.hidden = !messages[reason];
  },

  showLogin() {
    document.getElementById('login-gate').style.display = '';
    document.getElementById('app-shell').style.display = 'none';
    this.renderDemoCredentials();
  },

  showApp() {
    document.getElementById('login-gate').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    this.updateUserChrome();
  },

  updateUserChrome() {
    const session = PortalAuth.getSession();
    if (!session) return;

    const roleName = PortalAuth.getRoleName(session.roleId);
    const initial = session.name?.[0] || 'U';

    document.getElementById('topbar-user-name').textContent = session.name;
    document.getElementById('topbar-user-role').textContent = roleName;
    document.getElementById('topbar-user-avatar').textContent = initial;

    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRole = document.getElementById('sidebar-user-role');
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    if (sidebarName) sidebarName.textContent = session.name;
    if (sidebarRole) sidebarRole.textContent = roleName;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
  },

  renderDemoCredentials() {
    const container = document.getElementById('demo-credentials-body');
    if (!container) return;

    container.innerHTML = EduStore.getSchools().map(school => {
      const users = EduStore.getUsersForSchool(school.id);
      return `
        <div class="demo-cred-school">
          <div class="demo-cred-school-head">
            <strong>${school.name}</strong>
            <code class="school-code-pill">${school.schoolCode}</code>
          </div>
          <table class="demo-cred-table">
            <thead><tr><th>Role</th><th>Username</th><th>Password</th><th></th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${PortalAuth.getRoleName(u.roleId)}${u.roleId === 'parent' ? '<div class="text-xs text-muted">student no.</div>' : ''}</td>
                  <td><code>${u.username}</code></td>
                  <td><code>${u.password}</code></td>
                  <td><button type="button" class="btn btn-ghost btn-sm" data-fill-login data-username="${u.username}" data-password="${u.password}">Use</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');
  }
};
