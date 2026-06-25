/**
 * SkulPulse Uganda — Prototype App Controller
 * Route IDs map 1:1 to future app routes.
 */

const App = {
  currentRole: 'school-admin',
  currentUser: null,
  currentScreen: 'dashboard',
  currentYear: 'ay-2025',
  currentTerm: 't2-2025',
  navGroupOpen: { academic: true, operations: true, addons: false, admin: false },
  aiScope: 'all',     // 'all' | level id (S.1…) for AI analytics grouping
  studentFilter: { q: '', class: 'all', status: 'all' },
  selectedStudentId: null,
  studentTab: 'overview',

  init() {
    if (!document.getElementById('app-shell')) return;

    const session = PortalAuth.restoreSession();
    if (!session) return;

    this.currentUser = session;
    this.currentRole = session.roleId;

    SkulStore.init();
    this.syncSchoolContext();
    this.applyPeriod();

    this.bindEvents();
    this.renderSidebar();
    this.navigate('dashboard');
    this.updateContext();
    this.updateSchoolChrome();
    PortalShell.updateUserChrome();

    const school = SkulStore.getActiveSchool();
    const codeEl = document.getElementById('banner-school-code');
    if (codeEl && school?.schoolCode) codeEl.textContent = school.schoolCode;

    this.showToast(`Welcome, ${session.name}`, 3500);
  },

  syncSchoolContext() {
    SkulStore.syncToSkulpulse();
  },

  /** Swap the dataset to the selected academic year + term (real isolation). */
  applyPeriod() {
    if (typeof DataEngine !== 'undefined' && DataEngine.setPeriod) {
      DataEngine.setPeriod(this.currentYear, this.currentTerm);
    }
  },

  updateSchoolChrome() {
    const el = document.getElementById('topbar-school');
    if (el && SKULPULSE.school) el.textContent = SKULPULSE.school.name;
    const statusEl = document.getElementById('school-status-badge');
    if (statusEl && SKULPULSE.school) {
      const st = SKULPULSE.school.status || 'active';
      statusEl.className = `badge badge-${st === 'active' ? 'success' : st === 'trial' ? 'warning' : 'danger'} badge-dot`;
      statusEl.textContent = st;
    }
  },

  getSubscribedModules() {
    return resolveModuleIds(SKULPULSE.school?.subscribedModules || ['core']);
  },

  getSchoolId() {
    return this.currentUser?.schoolId || SkulStore.getActiveSchoolId();
  },

  getAuditActor() {
    return this.currentUser?.name || 'School user';
  },

  canManageSchool() {
    return this.currentRole === 'school-admin';
  },

  esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  },

  /* ---- presentation helpers ---- */
  avatarClass(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return `av${h % 6}`;
  },

  initials(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
  },

  trendBadge(delta, suffix = ' pts') {
    if (delta == null || delta === 0) return `<span class="trend" style="color:var(--text-muted)">±0${suffix}</span>`;
    const up = delta > 0;
    const arrow = up
      ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l5-5 5 5"/></svg>'
      : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5l5 5 5-5"/></svg>';
    return `<span class="trend ${up ? 'trend-up' : 'trend-down'}">${arrow}${up ? '+' : ''}${delta}${suffix}</span>`;
  },

  riskPill(level) {
    return `<span class="risk-pill ${level}">${level}</span>`;
  },

  /** Animate every [data-count] number from 0 → target after a render. */
  animateCounters() {
    const els = document.querySelectorAll('#screen-container [data-count]');
    els.forEach((el) => {
      const target = parseFloat(el.dataset.count);
      if (isNaN(target)) return;
      const dur = 750;
      const dec = el.dataset.dec ? parseInt(el.dataset.dec, 10) : 0;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = (target * eased).toFixed(dec);
        el.textContent = `${prefix}${Number(val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = `${prefix}0${suffix}`;
      requestAnimationFrame(step);
    });
  },

  bindEvents() {
    document.getElementById('year-selector')?.addEventListener('change', (e) => {
      this.currentYear = e.target.value;
      // Jump to the active term of that year (else first term)
      const terms = SKULPULSE.terms[this.currentYear] || [];
      this.currentTerm = (terms.find(t => t.status === 'active') || terms[0])?.id || this.currentTerm;
      this.applyPeriod();
      this.updateTermSelector();
      const yr = SKULPULSE.academicYears.find(y => y.id === this.currentYear);
      this.showToast(`Switched to ${e.target.options[e.target.selectedIndex].text}${yr?.status === 'archived' ? ' (archived — read-only)' : ''}. Roster, scores and fees are fully isolated per year.`, 3800);
      if (this.currentScreen === 'student-profile') this.navigate('students');
      else this.renderScreen(this.currentScreen);
    });

    document.getElementById('term-selector')?.addEventListener('change', (e) => {
      this.currentTerm = e.target.value;
      this.applyPeriod();
      this.showToast(`Active term: ${e.target.options[e.target.selectedIndex].text}. Showing this term's records only.`);
      if (this.currentScreen === 'student-profile') this.navigate('students');
      else this.renderScreen(this.currentScreen);
    });

    document.querySelector('.sidebar-toggle')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('open');
    });

    window.addEventListener('storage', (e) => {
      if (e.key === SkulStore.STORAGE_KEY) {
        SkulStore.init();
        this.syncSchoolContext();
        this.renderSidebar();
        this.updateSchoolChrome();
        this.renderScreen(this.currentScreen);
        this.showToast('School data updated');
      }
    });

    document.addEventListener('click', (e) => {
      const groupToggle = e.target.closest('[data-nav-group-toggle]');
      if (groupToggle) {
        e.preventDefault();
        this.toggleNavGroup(groupToggle.dataset.navGroupToggle);
        return;
      }
      const navItem = e.target.closest('[data-screen]');
      if (navItem && navItem.dataset.screen) {
        e.preventDefault();
        this.navigate(navItem.dataset.screen);
        document.querySelector('.sidebar')?.classList.remove('open');
        return;
      }
      const presetBtn = e.target.closest('[data-portal-apply-preset]');
      if (presetBtn) {
        e.preventDefault();
        this.applyModulePreset(presetBtn.dataset.portalApplyPreset);
        return;
      }
      const aiScopeBtn = e.target.closest('[data-ai-scope]');
      if (aiScopeBtn) {
        e.preventDefault();
        this.aiScope = aiScopeBtn.dataset.aiScope;
        this.renderScreen('ai-analytics');
        return;
      }
      const studentStatusBtn = e.target.closest('[data-student-status]');
      if (studentStatusBtn) {
        e.preventDefault();
        this.studentFilter.status = studentStatusBtn.dataset.studentStatus;
        this.renderScreen('students');
        return;
      }
      const openClass = e.target.closest('[data-open-class]');
      if (openClass) {
        e.preventDefault();
        this.studentFilter = { q: '', class: openClass.dataset.openClass, status: 'all' };
        this.navigate('students');
        return;
      }
      const openStudent = e.target.closest('[data-open-student]');
      if (openStudent) {
        e.preventDefault();
        this.openStudentProfile(openStudent.dataset.openStudent);
        return;
      }
      const studentTab = e.target.closest('[data-student-tab]');
      if (studentTab) {
        e.preventDefault();
        this.studentTab = studentTab.dataset.studentTab;
        this.renderScreen('student-profile');
      }
    });

    const sc = document.getElementById('screen-container');
    sc?.addEventListener('input', (e) => {
      if (e.target.id === 'student-search') {
        this.studentFilter.q = e.target.value;
        this.refreshStudentTable();
      }
    });
    sc?.addEventListener('change', (e) => {
      if (e.target.id === 'student-class-filter') {
        this.studentFilter.class = e.target.value;
        this.refreshStudentTable();
      }
    });

    document.getElementById('screen-container')?.addEventListener('submit', (e) => {
      if (e.target.id === 'school-settings-form') {
        e.preventDefault();
        this.saveSchoolSettings(e.target);
      }
    });

    document.getElementById('screen-container')?.addEventListener('change', (e) => {
      if (e.target.matches('[data-portal-module-toggle]')) {
        this.onPortalModuleToggle(e.target);
      }
    });
  },

  saveSchoolSettings(form) {
    if (!this.canManageSchool()) {
      this.showToast('Only school administrators can edit settings');
      return;
    }

    const fd = new FormData(form);
    const updated = SkulStore.updateSchool(this.getSchoolId(), {
      name: fd.get('name'),
      motto: fd.get('motto'),
      district: fd.get('district'),
      region: fd.get('region'),
      level: fd.get('level'),
      emisCode: fd.get('emisCode'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      contactName: fd.get('contactName'),
      contactPhone: fd.get('contactPhone'),
      notes: fd.get('notes'),
      academicCalendar: fd.get('academicCalendar'),
      currency: fd.get('currency'),
      timezone: fd.get('timezone')
    }, this.getAuditActor());

    if (!updated) {
      this.showToast('Could not save settings');
      return;
    }

    this.syncSchoolContext();
    this.updateSchoolChrome();
    PortalShell.updateUserChrome();
    this.showToast('School settings saved');
    this.renderScreen('settings');
  },

  getPortalModuleIdsFromDom() {
    const boxes = document.querySelectorAll('[data-portal-module-toggle]:checked');
    const ids = Array.from(boxes).map(b => b.dataset.moduleId);
    return resolveModuleIds(ids.length ? ids : ['core']);
  },

  onPortalModuleToggle(input) {
    if (!this.canManageSchool()) return;

    input.closest('.module-picker-card')?.classList.toggle('selected', input.checked);
    this.updatePortalBillPreview();

    SkulStore.setSchoolModules(this.getSchoolId(), this.getPortalModuleIdsFromDom(), this.getAuditActor());
    this.syncSchoolContext();
    this.renderSidebar();
    this.showToast('Module subscription updated');
  },

  applyModulePreset(presetId) {
    if (!this.canManageSchool()) {
      this.showToast('Only school administrators can change modules');
      return;
    }

    let modules;
    if (presetId === 'all') {
      modules = SKULPULSE.modules.map(m => m.id);
    } else {
      const preset = SKULPULSE.exampleModuleSets.find(p => p.id === presetId);
      modules = preset ? preset.modules : ['core'];
    }

    document.querySelectorAll('[data-portal-module-toggle]').forEach(box => {
      if (box.dataset.moduleId === 'core') return;
      box.checked = modules.includes(box.dataset.moduleId);
      box.closest('.module-picker-card')?.classList.toggle('selected', box.checked);
    });

    SkulStore.setSchoolModules(this.getSchoolId(), modules, this.getAuditActor());
    this.syncSchoolContext();
    this.renderSidebar();
    this.updatePortalBillPreview();
    this.showToast('Preset applied');
  },

  updatePortalBillPreview() {
    const preview = document.getElementById('portal-bill-preview');
    if (!preview) return;
    preview.innerHTML = this.renderBillPreviewBody(this.getPortalModuleIdsFromDom());
  },

  renderBillPreviewBody(moduleIds) {
    const breakdown = getModuleBreakdown(moduleIds);
    return `
      <table class="text-sm" style="width:100%">
        <tbody>
          <tr><td>Platform base fee</td><td class="text-right">${formatUGX(SKULPULSE.billing.platformBaseFee)}</td></tr>
          ${breakdown.modules.filter(m => m.id !== 'core').map(m =>
            `<tr><td>${m.name}</td><td class="text-right">${formatUGX(m.price)}</td></tr>`
          ).join('')}
          <tr class="bill-total-row"><td><strong>Total per term</strong></td><td class="text-right"><strong>${formatUGX(breakdown.total)}</strong></td></tr>
        </tbody>
      </table>`;
  },

  renderPortalModulePicker(selectedIds, editable) {
    const selected = new Set(resolveModuleIds(selectedIds));
    const byCategory = {};
    SKULPULSE.modules.forEach(m => {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(m);
    });

    return `
      <div class="panel" id="school-modules-panel">
        <div class="panel-head">
          <h3>Module subscription</h3>
          <span class="text-xs text-muted">${editable ? 'Changes apply immediately' : 'View only'}</span>
        </div>
        <div class="panel-body module-picker-body">
          ${Object.entries(byCategory).map(([cat, mods]) => `
            <div class="module-picker-category">
              <div class="module-picker-cat-label">${cat}</div>
              <div class="module-picker-grid">
                ${mods.map(m => {
                  const checked = selected.has(m.id);
                  const disabled = m.id === 'core' || !editable;
                  return `
                    <label class="module-picker-card ${checked ? 'selected' : ''} ${m.id === 'core' ? 'locked' : ''} ${!editable ? 'readonly' : ''}">
                      <input type="checkbox" data-portal-module-toggle data-module-id="${m.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                      <div class="module-picker-card-inner">
                        <div class="module-picker-card-head">
                          <span class="font-medium text-sm">${m.name}</span>
                          <span class="text-xs text-muted">${m.price ? formatUGX(m.price) : 'Base'}</span>
                        </div>
                        <p class="text-xs text-muted">${m.description}</p>
                      </div>
                    </label>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  renderPortalPresetBar(editable) {
    if (!editable) return '';
    const presets = SkulStore.getModulePresets();
    return `
      <div class="panel panel-compact">
        <div class="panel-head"><h3>Quick presets</h3></div>
        <div class="panel-body preset-bar">
          ${presets.map(p => `
            <button type="button" class="btn btn-secondary btn-sm" data-portal-apply-preset="${p.id}" title="${this.esc(p.description)}">${p.name}</button>
          `).join('')}
          <button type="button" class="btn btn-ghost btn-sm" data-portal-apply-preset="all">All modules</button>
        </div>
      </div>`;
  },

  renderPortalUsersPanel(schoolId) {
    const users = SkulStore.getUsersForSchool(schoolId);
    return `
      <div class="panel">
        <div class="panel-head"><h3>Portal accounts</h3><span class="text-xs text-muted">Simulated logins</span></div>
        <div class="panel-body panel-body-flush table-wrap">
          <table class="text-sm">
            <thead><tr><th>Role</th><th>Name</th><th>Email</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${PortalAuth.getRoleName(u.roleId)}</td>
                  <td>${this.esc(u.name)}</td>
                  <td><code>${this.esc(u.email)}</code></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <p class="text-xs text-muted" style="padding:0.75rem">User provisioning will be managed here in production.</p>
        </div>
      </div>`;
  },


  toggleNavGroup(groupId) {
    this.navGroupOpen[groupId] = !this.navGroupOpen[groupId];
    const el = document.querySelector(`[data-nav-group="${groupId}"]`);
    el?.classList.toggle('collapsed', !this.navGroupOpen[groupId]);
  },

  getNavGroups() {
    if (this.currentRole === 'parent') {
      return [{
        id: 'primary',
        collapsible: false,
        items: [
          { screen: 'dashboard', label: 'Home', icon: 'dashboard', module: 'core' },
          { screen: 'report-cards', label: 'Reports', icon: 'reportcards', module: 'reportcards' },
          { screen: 'finance', label: 'Fees', icon: 'finance', module: 'finance' },
          { screen: 'communication', label: 'Messages', icon: 'communication', module: 'communication' }
        ]
      }];
    }

    if (this.currentRole === 'bursar') {
      return [{
        id: 'primary',
        collapsible: false,
        items: [
          { screen: 'dashboard', label: 'Home', icon: 'dashboard', module: 'core' },
          { screen: 'students', label: 'Students', icon: 'students', module: 'students' },
          { screen: 'finance', label: 'Fees', icon: 'finance', module: 'finance' },
          { screen: 'communication', label: 'Messages', icon: 'communication', module: 'communication' }
        ]
      }];
    }

    if (this.currentRole === 'teacher') {
      return [{
        id: 'primary',
        collapsible: false,
        items: [
          { screen: 'dashboard', label: 'Home', icon: 'dashboard', module: 'core' },
          { screen: 'students', label: 'Students', icon: 'students', module: 'students' },
          { screen: 'academic-structure', label: 'Classes', icon: 'academics', module: 'academics' },
          { screen: 'assessment', label: 'Grades', icon: 'assessment', module: 'assessment' },
          { screen: 'attendance', label: 'Attendance', icon: 'attendance', module: 'attendance' },
          { screen: 'timetable', label: 'Timetable', icon: 'timetable', module: 'timetable' },
          { screen: 'communication', label: 'Messages', icon: 'communication', module: 'communication' }
        ]
      }];
    }

    if (this.currentRole === 'platform-admin') {
      return [
        {
          id: 'primary',
          collapsible: false,
          items: [{ screen: 'dashboard', label: 'Home', icon: 'dashboard', module: 'core' }]
        },
        {
          id: 'platform',
          collapsible: false,
          items: [
            { screen: 'platform-schools', label: 'Schools', icon: 'schools', module: 'core' },
            { screen: 'platform-billing', label: 'Billing', icon: 'billing', module: 'core' },
            { screen: 'modules', label: 'Modules', icon: 'modules', module: 'core' }
          ]
        }
      ];
    }

    const addonModules = ['library', 'transport', 'hostel', 'hr-payroll', 'inventory', 'moes-reporting'];

    const allGroups = [
      {
        id: 'primary',
        collapsible: false,
        items: [{ screen: 'dashboard', label: 'Home', icon: 'dashboard', module: 'core' }]
      },
      {
        id: 'academic',
        label: 'Academic',
        collapsible: true,
        items: [
          { screen: 'students', label: 'Students', icon: 'students', module: 'students' },
          { screen: 'teachers', label: 'Staff', icon: 'teachers', module: 'teachers' },
          { screen: 'admissions', label: 'Admissions', icon: 'admissions', module: 'admissions' },
          { screen: 'academic-structure', label: 'Classes', icon: 'academics', module: 'academics' },
          { screen: 'assessment', label: 'Grades', icon: 'assessment', module: 'assessment' },
          { screen: 'report-cards', label: 'Reports', icon: 'reportcards', module: 'reportcards' },
          { screen: 'timetable', label: 'Timetable', icon: 'timetable', module: 'timetable' },
          { screen: 'attendance', label: 'Attendance', icon: 'attendance', module: 'attendance' },
          { screen: 'ai-analytics', label: 'AI insights', icon: 'ai', module: 'ai-analytics' }
        ]
      },
      {
        id: 'operations',
        label: 'Operations',
        collapsible: true,
        items: [
          { screen: 'finance', label: 'Fees', icon: 'finance', module: 'finance' },
          { screen: 'communication', label: 'Messages', icon: 'communication', module: 'communication' }
        ]
      },
      {
        id: 'addons',
        label: 'Add-ons',
        collapsible: true,
        subscribedOnly: true,
        items: [
          { screen: 'library', label: 'Library', icon: 'library', module: 'library' },
          { screen: 'transport', label: 'Transport', icon: 'transport', module: 'transport' },
          { screen: 'hostel', label: 'Hostel', icon: 'hostel', module: 'hostel' }
        ]
      },
      {
        id: 'admin',
        label: 'Settings',
        collapsible: true,
        roles: ['school-admin'],
        items: [
          { screen: 'modules', label: 'Modules', icon: 'modules', module: 'core' },
          { screen: 'rbac', label: 'Access', icon: 'rbac', module: 'core' },
          { screen: 'academic-years', label: 'Calendar', icon: 'calendar', module: 'core' },
          { screen: 'audit-log', label: 'Audit', icon: 'audit', module: 'core' },
          { screen: 'settings', label: 'School', icon: 'settings', module: 'core' }
        ]
      }
    ];

    const roleScreens = {
      parent: ['dashboard', 'report-cards', 'finance', 'communication'],
      student: ['dashboard', 'assessment', 'timetable', 'communication'],
      teacher: ['dashboard', 'students', 'academic-structure', 'assessment', 'report-cards', 'timetable', 'attendance', 'ai-analytics', 'communication'],
      bursar: ['dashboard', 'students', 'finance', 'communication'],
      'deputy-head': ['dashboard', 'students', 'teachers', 'admissions', 'academic-structure', 'assessment', 'report-cards', 'timetable', 'attendance', 'ai-analytics', 'communication']
    };

    const allowed = roleScreens[this.currentRole];

    return allGroups
      .filter(group => !group.roles || group.roles.includes(this.currentRole))
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (allowed && !allowed.includes(item.screen)) return false;
          if (group.subscribedOnly && !this.getSubscribedModules().includes(item.module)) return false;
          if (addonModules.includes(item.module) && !this.getSubscribedModules().includes(item.module)) return false;
          if (!this.getSubscribedModules().includes(item.module) && item.module !== 'core') return false;
          return this.hasModuleAccess(item.module);
        })
      }))
      .filter(group => group.items.length > 0);
  },

  /** Flat list for breadcrumb lookup */
  getNavItems() {
    return this.getNavGroups().flatMap(g => g.items);
  },

  getRoleName() {
    return SKULPULSE.roles.find(r => r.id === this.currentRole)?.name || this.currentRole;
  },

  hasModuleAccess(moduleId) {
    if (moduleId === 'core') return true;
    const subscribed = this.getSubscribedModules();
    if (!subscribed.includes(moduleId)) return false;

    const matrix = SKULPULSE.rbacMatrix[this.currentRole];
    if (!matrix) return this.currentRole === 'school-admin';
    return matrix[moduleId]?.length > 0 || ['students', 'teachers', 'academics'].includes(moduleId) && this.currentRole === 'school-admin';
  },

  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    const groups = this.getNavGroups();
    nav.innerHTML = groups.map(group => {
      const itemsHtml = group.items.map(item => `
        <button class="nav-item" data-screen="${item.screen}" data-module="${item.module}">
          <span class="nav-icon">${icon(item.icon)}</span>
          <span>${item.label}</span>
        </button>`).join('');

      if (!group.collapsible) {
        return `<div class="nav-group" data-nav-group="${group.id}"><div class="nav-group-items">${itemsHtml}</div></div>`;
      }

      const collapsed = !this.navGroupOpen[group.id];
      return `
        <div class="nav-group ${collapsed ? 'collapsed' : ''}" data-nav-group="${group.id}">
          <button type="button" class="nav-group-toggle" data-nav-group-toggle="${group.id}">
            <span>${group.label}</span>
            <span class="chevron icon">${Icons.chevron}</span>
          </button>
          <div class="nav-group-items">${itemsHtml}</div>
        </div>`;
    }).join('');

    const userEl = document.getElementById('sidebar-user');
    if (userEl && this.currentUser) {
      const initial = this.currentUser.name?.[0] || 'U';
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      const avatarEl = document.getElementById('sidebar-user-avatar');
      if (nameEl) nameEl.textContent = this.currentUser.name;
      if (roleEl) roleEl.textContent = this.getRoleName();
      if (avatarEl) avatarEl.textContent = initial;
    }
  },

  updateContext() {
    const yearSel = document.getElementById('year-selector');
    const termSel = document.getElementById('term-selector');
    if (yearSel) {
      yearSel.innerHTML = SKULPULSE.academicYears.map(y =>
        `<option value="${y.id}" ${y.id === this.currentYear ? 'selected' : ''}>${y.label}</option>`
      ).join('');
    }
    this.updateTermSelector();
  },

  updateTermSelector() {
    const termSel = document.getElementById('term-selector');
    if (!termSel) return;
    const terms = SKULPULSE.terms[this.currentYear] || [];
    termSel.innerHTML = terms.map(t =>
      `<option value="${t.id}" ${t.id === this.currentTerm ? 'selected' : ''}>${t.label.replace('Term ', 'T')}</option>`
    ).join('');
  },

  navigate(screen) {
    this.currentScreen = screen;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.screen === screen);
    });

    const navItems = this.getNavItems();
    const currentItem = navItems.find(i => i.screen === screen);
    const module = screen === 'student-profile' ? 'students'
      : currentItem?.module || document.querySelector(`[data-screen="${screen}"]`)?.dataset.module || 'core';
    const subscribed = this.getSubscribedModules().includes(module);
    const hasAccess = this.hasModuleAccess(module);

    // keep "Students" highlighted while viewing a profile
    if (screen === 'student-profile') {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.screen === 'students'));
    }

    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
      if (screen === 'student-profile') {
        const s = SKULPULSE.students.find(x => x.id === this.selectedStudentId);
        breadcrumb.innerHTML = `<a href="#" onclick="App.navigate('students');return false" style="color:var(--text-muted)">Students</a> <span class="text-faint">/</span> <strong>${s ? this.esc(s.name) : 'Student'}</strong>`;
      } else {
        breadcrumb.innerHTML = `<strong>${currentItem?.label || screen}</strong>`;
      }
    }

    this.renderScreen(screen, !subscribed, !hasAccess && subscribed);
  },

  renderScreen(screen, moduleLocked = false, accessDenied = false) {
    const container = document.getElementById('screen-container');
    if (!container) return;

    const year = SKULPULSE.academicYears.find(y => y.id === this.currentYear);
    const term = (SKULPULSE.terms[this.currentYear] || []).find(t => t.id === this.currentTerm);
    const ctx = `<div class="context-pill">${icon('calendar')} ${year?.label} · ${term?.label} <span class="text-faint">· scoped data</span></div>`;

    let content = '';
    const renderers = {
      'dashboard': () => this.renderDashboard(),
      'students': () => this.renderStudents(),
      'teachers': () => this.renderTeachers(),
      'admissions': () => this.renderAdmissions(),
      'academic-structure': () => this.renderAcademicStructure(),
      'assessment': () => this.renderAssessment(),
      'report-cards': () => this.renderReportCards(),
      'timetable': () => this.renderTimetable(),
      'attendance': () => this.renderAttendance(),
      'ai-analytics': () => this.renderAIAnalytics(),
      'student-profile': () => this.renderStudentProfile(),
      'finance': () => this.renderFinance(),
      'communication': () => this.renderCommunication(),
      'library': () => this.renderAddon('Library', 'library', 'Catalogue management, lending, overdue alerts'),
      'transport': () => this.renderAddon('Transport', 'transport', 'Routes, vehicles, student pickup tracking'),
      'hostel': () => this.renderAddon('Boarding & Hostel', 'hostel', 'Dormitory allocation, roll call, meal plans'),
      'modules': () => this.renderModules(),
      'rbac': () => this.renderRBAC(),
      'academic-years': () => this.renderAcademicYears(),
      'audit-log': () => this.renderAuditLog(),
      'settings': () => this.renderSettings(),
      'platform-schools': () => this.renderPlatformSchools(),
      'platform-billing': () => this.renderPlatformBilling()
    };

    content = (renderers[screen] || (() => '<div class="empty-state"><p>Screen not found</p></div>'))();

    if (moduleLocked) {
      content = this.wrapLocked(content, 'Module not subscribed', 'Your school has not added this module. Subscribe from the Subscriptions screen to enable it.');
    } else if (accessDenied) {
      content = this.wrapLocked(content, 'Access denied', 'Your role does not have permission for this module. Contact your school administrator.');
    }

    container.innerHTML = ctx + content;
    this.animateCounters();
  },

  wrapLocked(content, title, message) {
    return `<div class="module-locked panel"><div class="module-locked-content">${content}</div>
      <div class="module-lock-overlay"><div class="lock-icon">${icon('lock')}</div><h3>${title}</h3><p class="text-secondary">${message}</p>
      <button class="btn btn-primary btn-sm" style="margin-top:0.75rem" onclick="App.navigate('modules')">Manage modules</button></div></div>`;
  },

  metricCard(label, value, opts = {}) {
    const accent = opts.accent ? ` accent-${opts.accent}` : '';
    const ico = opts.icon ? `<span class="metric-ico${accent}">${icon(opts.icon)}</span>` : '';
    const countAttrs = opts.raw ? '' :
      `data-count="${opts.count != null ? opts.count : value}" data-dec="${opts.dec || 0}" data-prefix="${opts.prefix || ''}" data-suffix="${opts.suffix || ''}"`;
    const valHtml = opts.raw ? value : `<span ${countAttrs}>${value}</span>`;
    const foot = opts.foot ? `<div class="metric-foot">${opts.foot}</div>` : '';
    return `<div class="metric-card${accent}">
      <div class="metric-top"><span class="metric-label">${label}</span>${ico}</div>
      <div class="metric-value">${valHtml}</div>${foot}</div>`;
  },

  renderDashboard() {
    const role = this.currentRole;

    if (role === 'parent') return this.renderParentDashboard();
    if (role === 'platform-admin') {
      return `<div class="notice notice-brand"><div class="notice-body"><div class="notice-title">Platform administration</div><div class="notice-text">Use the <a href="admin/index.html">SkulPulse Admin Portal</a> to onboard schools and manage modules.</div></div></div>`;
    }
    if (role === 'bursar') return this.renderBursarDashboard();
    if (role === 'teacher') return this.renderTeacherDashboard();
    return this.renderAdminDashboard();
  },

  renderAdminDashboard() {
    const sa = Analytics.schoolAverage();
    const risk = Analytics.riskDistribution();
    const fin = Analytics.finance();
    const trend = Analytics.performanceTrend();
    const proj = Math.min(99, trend[trend.length - 1] + 2);
    const classes = Analytics.byClass();
    const watch = Analytics.watchlist(5);
    const top = Analytics.topPerformers(5);
    const att = Analytics.attendanceTrend();
    const enrolled = SKULPULSE.students.length;

    const lineChart = Charts.line({
      values: [...trend, proj], labels: ['Test 1', 'Test 2', 'Test 3', 'Projected'],
      min: Math.min(...trend) - 6, max: Math.max(...trend, proj) + 6
    });
    const riskDonut = Charts.donut({
      segments: [
        { label: 'On track', value: risk.low, color: 'oklch(0.6 0.13 155)' },
        { label: 'Monitor', value: risk.medium, color: 'oklch(0.72 0.14 75)' },
        { label: 'At risk', value: risk.high, color: 'oklch(0.6 0.17 28)' }
      ],
      centerValue: risk.total, centerLabel: 'students'
    });
    const classBars = Charts.bars({
      data: classes.map((c) => ({ label: c.name.replace('S.', 'S'), value: c.average, highlight: c.average === Math.max(...classes.map((x) => x.average)) })),
      max: 100, format: (v) => v
    });
    const feeGauge = Charts.gauge({ value: fin.rate, label: 'collected', format: (v) => v + '%' });

    return `
      <div class="page-header reveal">
        <div><h1>Dashboard</h1><p>${SKULPULSE.school.name} · Term 2, 2025 · live overview</p></div>
        <div class="page-actions"><button class="btn btn-secondary btn-sm">${icon('download')} Export</button><button class="btn btn-primary btn-sm" onclick="App.navigate('ai-analytics')">${icon('ai')} AI insights</button></div>
      </div>

      <div class="metric-grid">
        ${this.metricCard('Enrolled students', '1247', { icon: 'students', count: 1247, foot: `<span class="text-muted">${enrolled} on active roster</span>` })}
        ${this.metricCard('School average', sa.average, { icon: 'chart', suffix: '%', accent: 'blue', foot: this.trendBadge(trend[2] - trend[0]) + '<span class="text-muted">vs Test 1</span>' })}
        ${this.metricCard('Attendance today', sa.attendance, { icon: 'attendance', suffix: '%', foot: `<span class="text-muted">${att[att.length - 1].value}% term avg</span>` })}
        ${this.metricCard('At-risk students', risk.high, { icon: 'alert', accent: 'red', foot: `<span class="text-muted">${risk.medium} to monitor</span>` })}
      </div>

      ${this.renderClassPanel(classes)}

      <div class="dash-grid cols-21 reveal-2" style="margin-top:0.75rem">
        <div class="panel panel-hero">
          <div class="panel-head"><h3>Performance trend</h3><span class="badge badge-brand">CA + Exam blend</span></div>
          <div class="chart-body">${lineChart}<p class="chart-cap">School-wide average across the term's assessments, with next-test projection</p></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Risk overview</h3><button class="btn btn-ghost btn-sm" onclick="App.navigate('ai-analytics')">Details</button></div>
          <div class="chart-body">${riskDonut}</div>
        </div>
      </div>

      <div class="dash-grid cols-2 reveal-3" style="margin-top:0.75rem">
        <div class="panel">
          <div class="panel-head"><h3>Average score by class</h3><span class="text-xs text-muted">out of 100</span></div>
          <div class="chart-body">${classBars}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Fee collection</h3><button class="btn btn-ghost btn-sm" onclick="App.navigate('finance')">Finance</button></div>
          <div class="chart-body" style="text-align:center">${feeGauge}
            <div class="tile-row" style="margin-top:0.5rem">
              <div class="tile"><div class="tv" data-count="${Math.round(fin.collected / 1000000)}" data-prefix="UGX " data-suffix="M">UGX ${Math.round(fin.collected / 1000000)}M</div><div class="tl">Collected</div></div>
              <div class="tile"><div class="tv" data-count="${fin.overdueCount}">${fin.overdueCount}</div><div class="tl">Overdue accounts</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-grid cols-2 gap-3" style="margin-top:0.75rem">
        <div class="panel">
          <div class="panel-head"><h3>${icon('alert')} Watchlist</h3><span class="badge badge-danger">${risk.high} high</span></div>
          <div class="panel-body panel-body-flush">
            <table><tbody>
              ${watch.map((s) => `<tr>
                <td><div class="flex items-center gap-2">
                  <div class="avatar ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>
                  <div><div class="font-medium">${s.name}</div><div class="text-xs text-muted">${s.class} · avg ${s.average}%</div></div>
                </div></td>
                <td style="text-align:center">${Charts.sparkline(this.studentSeries(s))}</td>
                <td style="text-align:right">${this.riskPill(s.riskLevel)}</td>
                <td style="text-align:right"><button class="btn btn-ghost btn-sm" onclick="App.openStudentProfile('${s.id}')">Open</button></td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>🏆 Top performers</h3><button class="btn btn-ghost btn-sm" onclick="App.navigate('students')">All students</button></div>
          <div class="panel-body panel-body-flush">
            <table><tbody>
              ${top.map((s, i) => `<tr>
                <td style="width:1.5rem;text-align:center;font-weight:700;color:var(--text-faint)">${i + 1}</td>
                <td><div class="flex items-center gap-2">
                  <div class="avatar ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>
                  <div><div class="font-medium">${s.name}</div><div class="text-xs text-muted">${s.class}</div></div>
                </div></td>
                <td style="text-align:right"><span class="badge badge-success">${s.average}%</span></td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;
  },

  studentSeries(s) {
    if (!s.subjects?.length) return [s.firstAverage || 0, s.prevAverage || 0, s.average || 0];
    return [0, 1, 2].map((i) => Math.round(s.subjects.reduce((a, x) => a + x.scores[i], 0) / s.subjects.length));
  },

  /** Per-class breakdown table — the meaningful, actionable view (click to drill in). */
  renderClassPanel(classes) {
    const schoolAvg = Math.round(classes.reduce((a, c) => a + c.average, 0) / (classes.length || 1));
    const maxAvg = Math.max(100, ...classes.map((c) => c.average));
    const rows = classes.map((c) => {
      const vs = c.average - schoolAvg;
      const barColor = Charts.scoreColor(c.average);
      return `<tr class="clickable-row" data-open-class="${c.name}">
        <td><div class="font-medium">${c.name}</div><div class="text-xs text-muted">${c.level} · ${c.stream}</div></td>
        <td style="text-align:center">${c.students}</td>
        <td>
          <div class="flex items-center gap-2">
            <div class="bar-mini" style="flex:1;min-width:70px"><span style="width:${(c.average / maxAvg * 100).toFixed(0)}%;background:${barColor}"></span></div>
            <strong style="font-variant-numeric:tabular-nums;width:2.4rem;text-align:right">${c.average}%</strong>
          </div>
        </td>
        <td style="text-align:right">${this.trendBadge(vs, '')}</td>
        <td style="text-align:center">${c.attendance}%</td>
        <td style="text-align:center">${c.atRisk ? `<span class="risk-pill high">${c.atRisk}</span>` : '<span class="text-muted">0</span>'}</td>
        <td class="text-muted">${c.topStudent}</td>
        <td style="text-align:right"><span class="text-xs" style="color:var(--brand)">View ${icon('chevron')}</span></td>
      </tr>`;
    }).join('');
    return `
      <div class="panel reveal-2" style="margin-top:0.75rem">
        <div class="panel-head"><h3>${icon('academics')} Class performance</h3><span class="text-xs text-muted">click a class to view its students · avg vs school ${schoolAvg}%</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Class</th><th style="text-align:center">Students</th><th>Average</th><th style="text-align:right">vs school</th><th style="text-align:center">Attendance</th><th style="text-align:center">At-risk</th><th>Top student</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  },

  renderTeacherDashboard() {
    const myClasses = ['S.4 West', 'S.6 Sciences'];
    const roster = SKULPULSE.students.filter((s) => myClasses.includes(s.class));
    const avg = Math.round(roster.reduce((a, s) => a + s.average, 0) / (roster.length || 1));
    const atRisk = roster.filter((s) => s.riskLevel === 'high').length;
    const classBars = Charts.bars({
      data: myClasses.map((c) => {
        const r = SKULPULSE.students.filter((s) => s.class === c);
        return { label: c.replace('S.', 'S'), value: Math.round(r.reduce((a, s) => a + s.average, 0) / (r.length || 1)) };
      }), max: 100
    });
    const watch = roster.filter((s) => s.riskLevel !== 'low').sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

    return `
      <div class="page-header reveal"><div><h1>My dashboard</h1><p>${this.currentUser?.name || 'Teacher'} · ${myClasses.join(' · ')}</p></div></div>
      <div class="metric-grid">
        ${this.metricCard('My classes', myClasses.length, { icon: 'academics' })}
        ${this.metricCard('My students', roster.length, { icon: 'students', accent: 'blue' })}
        ${this.metricCard('Class average', avg, { icon: 'chart', suffix: '%' })}
        ${this.metricCard('Need attention', atRisk, { icon: 'alert', accent: 'red' })}
      </div>
      <div class="dash-grid cols-2 reveal-2">
        <div class="panel"><div class="panel-head"><h3>Average by my class</h3></div><div class="chart-body">${classBars}</div></div>
        <div class="panel"><div class="panel-head"><h3>Students to support</h3><span class="badge badge-warning">${watch.length}</span></div>
          <div class="panel-body panel-body-flush"><table><tbody>
            ${watch.map((s) => `<tr>
              <td><div class="flex items-center gap-2"><div class="avatar ${this.avatarClass(s.name)}">${this.initials(s.name)}</div><div><div class="font-medium">${s.name}</div><div class="text-xs text-muted">${s.class}</div></div></div></td>
              <td style="text-align:center">${Charts.sparkline(this.studentSeries(s))}</td>
              <td style="text-align:right">${this.riskPill(s.riskLevel)}</td>
            </tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>`;
  },

  renderBursarDashboard() {
    const fin = Analytics.finance();
    const methodSegs = Object.entries(fin.byMethod).map(([k, v], i) => ({ label: k, value: Math.round(v / 1000000), color: Charts.PALETTE[i % Charts.PALETTE.length] }));
    const statusDonut = Charts.donut({
      segments: [
        { label: 'Paid', value: fin.byStatus.paid, color: 'oklch(0.6 0.13 155)' },
        { label: 'Partial', value: fin.byStatus.partial, color: 'oklch(0.72 0.14 75)' },
        { label: 'Overdue', value: fin.byStatus.overdue, color: 'oklch(0.6 0.17 28)' },
        { label: 'Unpaid', value: fin.byStatus.unpaid, color: 'var(--surface-2)' }
      ], centerValue: fin.rate + '%', centerLabel: 'collected'
    });
    return `
      <div class="page-header reveal"><div><h1>Finance overview</h1><p>${this.currentUser?.name || 'Bursar'} · Term 2, 2025</p></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm" onclick="App.navigate('finance')">Open finance</button></div></div>
      <div class="metric-grid">
        ${this.metricCard('Collected', Math.round(fin.collected / 1000000), { icon: 'finance', prefix: 'UGX ', suffix: 'M' })}
        ${this.metricCard('Outstanding', Math.round(fin.outstanding / 1000000), { icon: 'billing', prefix: 'UGX ', suffix: 'M', accent: 'amber' })}
        ${this.metricCard('Collection rate', fin.rate, { icon: 'chart', suffix: '%', accent: 'blue' })}
        ${this.metricCard('Overdue accounts', fin.overdueCount, { icon: 'alert', accent: 'red' })}
      </div>
      <div class="dash-grid cols-2 reveal-2">
        <div class="panel"><div class="panel-head"><h3>Payment status</h3></div><div class="chart-body">${statusDonut}</div></div>
        <div class="panel"><div class="panel-head"><h3>Collected by method</h3><span class="text-xs text-muted">UGX millions</span></div>
          <div class="chart-body">${Charts.hbars({ data: methodSegs, format: (v) => 'UGX ' + v + 'M' })}</div></div>
      </div>`;
  },

  parentChild() {
    const id = SKULPULSE.reportCardSample?.studentId;
    return SKULPULSE.students.find((s) => s.id === id) || SKULPULSE.students.find((s) => s.class === 'S.4 West') || SKULPULSE.students[0];
  },

  renderParentDashboard() {
    const child = this.parentChild();
    const fee = SKULPULSE.feeRecords.find((f) => f.studentId === child.id) || { balance: 0, termFee: 1, paid: 1, status: 'paid' };
    const series = this.studentSeries(child);
    const subjBars = Charts.bars({ data: child.subjects.slice(0, 6).map((x) => ({ label: x.name.slice(0, 4), value: x.current })), max: 100 });
    return `
      <div class="page-header reveal"><div><h1>${this.currentUser?.name || 'Parent'}</h1><p>${child.name} · ${child.class} · position ${child.position} of ${child.classSize}${this.currentUser?.loginId ? ` · student no. <code>${this.currentUser.loginId}</code>` : ''}</p></div></div>
      <div class="metric-grid">
        ${this.metricCard('Average score', child.average, { icon: 'chart', suffix: '%', foot: this.trendBadge(child.delta) })}
        ${this.metricCard('Class position', child.position, { icon: 'reportcards', accent: 'blue', foot: `<span class="text-muted">of ${child.classSize}</span>` })}
        ${this.metricCard('Attendance', child.attendanceRate, { icon: 'attendance', suffix: '%' })}
        ${this.metricCard('Fee balance', fee.balance === 0 ? 'Clear' : Math.round(fee.balance / 1000), fee.balance === 0 ? { icon: 'finance', raw: true } : { icon: 'finance', prefix: 'UGX ', suffix: 'K', accent: 'amber' })}
      </div>
      <div class="dash-grid cols-2 reveal-2">
        <div class="panel"><div class="panel-head"><h3>${child.name.split(' ')[0]}'s progress</h3><span class="badge ${child.delta >= 0 ? 'badge-success' : 'badge-warning'}">${child.delta >= 0 ? 'Improving' : 'Watch'}</span></div>
          <div class="chart-body">${Charts.line({ values: series, labels: ['Test 1', 'Test 2', 'Test 3'], min: Math.min(...series) - 8, max: Math.max(...series) + 8 })}</div></div>
        <div class="panel"><div class="panel-head"><h3>Subject scores</h3></div><div class="chart-body">${subjBars}</div></div>
      </div>
      <div class="grid grid-2 gap-3" style="margin-top:0.75rem">
        <div class="panel"><div class="panel-head"><h3>Quick actions</h3></div><div class="panel-body stack">
          <button class="btn btn-primary" onclick="App.navigate('report-cards')">View report card</button>
          <button class="btn btn-secondary" onclick="App.navigate('finance')">Pay fees</button>
          <button class="btn btn-secondary" onclick="App.navigate('communication')">Message teachers</button>
        </div></div>
        <div class="panel"><div class="panel-head"><h3>Announcements</h3></div><div class="panel-body panel-body-flush"><table><tbody>
          ${SKULPULSE.announcements.map(a => `<tr><td><div class="font-medium text-sm">${a.title}</div><div class="text-xs text-muted">${a.date}</div></td></tr>`).join('')}
        </tbody></table></div></div>
      </div>`;
  },

  getFilteredStudents() {
    const f = this.studentFilter;
    const q = (f.q || '').trim().toLowerCase();
    return SKULPULSE.students.filter((s) => {
      if (f.class !== 'all' && s.class !== f.class) return false;
      if (f.status === 'at-risk' && s.riskLevel !== 'high') return false;
      if (f.status === 'active' && s.riskLevel === 'high') return false;
      if (q && !(`${s.name} ${s.id} ${s.lin} ${s.class}`.toLowerCase().includes(q))) return false;
      return true;
    });
  },

  studentRows(list) {
    if (!list.length) return '<tr><td colspan="7" class="text-muted text-sm" style="padding:1rem">No students match.</td></tr>';
    return list.map((s) => {
      const fee = SKULPULSE.feeRecords.find((f) => f.studentId === s.id);
      const feeBadge = fee ? `<span class="badge ${fee.status === 'paid' ? 'badge-success' : fee.status === 'overdue' || fee.status === 'unpaid' ? 'badge-danger' : 'badge-warning'}">${fee.status}</span>` : '—';
      return `<tr>
        <td><div class="flex items-center gap-2"><div class="avatar ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>
          <div><div class="font-medium">${s.name}</div><div class="text-xs text-muted font-mono">${s.id}</div></div></div></td>
        <td>${s.class}<div class="text-xs text-muted">${s.stream}</div></td>
        <td><div class="flex items-center gap-2"><strong style="font-variant-numeric:tabular-nums">${s.average}%</strong>${Charts.sparkline(this.studentSeries(s), { width: 60, height: 22 })}</div></td>
        <td>${s.attendanceRate}%</td>
        <td>${feeBadge}</td>
        <td>${this.riskPill(s.riskLevel)}</td>
        <td style="text-align:right"><button class="btn btn-ghost btn-sm" onclick="App.openStudentProfile('${s.id}')">Open</button></td>
      </tr>`;
    }).join('');
  },

  refreshStudentTable() {
    const tbody = document.getElementById('student-tbody');
    if (tbody) tbody.innerHTML = this.studentRows(this.getFilteredStudents());
    const count = document.getElementById('student-count');
    if (count) count.textContent = this.getFilteredStudents().length;
  },

  renderStudents() {
    const list = this.getFilteredStudents();
    const f = this.studentFilter;
    const statusBtns = [['all', 'All'], ['active', 'On track'], ['at-risk', 'At risk']].map(([v, l]) =>
      `<button data-student-status="${v}" class="${f.status === v ? 'active' : ''}">${l}</button>`).join('');
    return `
      <div class="page-header reveal"><div><h1>Students</h1><p><span id="student-count">${list.length}</span> on roster · live academic & fee status</p></div>
        <div class="page-actions"><button class="btn btn-secondary btn-sm">${icon('download')} Export</button><button class="btn btn-primary btn-sm">${icon('plus')} Enroll</button></div></div>
      <div class="panel reveal-2">
        <div class="toolbar">
          <input id="student-search" class="input" style="max-width:240px" placeholder="Search name, ID, LIN…" value="${this.esc(f.q)}">
          <select id="student-class-filter" class="input form-select" style="max-width:160px">
            <option value="all">All classes</option>
            ${SKULPULSE.classes.map((c) => `<option value="${c.name}" ${f.class === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <div class="segmented" style="margin-left:auto">${statusBtns}</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Class</th><th>Average</th><th>Attendance</th><th>Fees</th><th>Risk</th><th></th></tr></thead>
          <tbody id="student-tbody">${this.studentRows(list)}</tbody>
        </table></div>
      </div>`;
  },

  renderTeachers() {
    return `
      <div class="page-header"><div><h1>Teachers & staff</h1></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">${icon('plus')} Add staff</button></div></div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Name</th><th>Subject</th><th>Classes</th><th>Status</th><th></th></tr></thead>
        <tbody>${SKULPULSE.teachers.map(t => `<tr>
          <td class="font-mono text-muted">${t.id}</td><td>${t.name}</td><td>${t.subject}</td>
          <td class="text-secondary">${t.classes.join(', ')}</td>
          <td><span class="badge ${t.status==='active'?'badge-success badge-dot':'badge-warning'}">${t.status}</span></td>
          <td><button class="btn btn-ghost btn-sm">Edit</button></td>
        </tr>`).join('')}</tbody></table></div></div>`;
  },

  renderAdmissions() {
    return `
      <div class="page-header"><div><h1>Admissions</h1></div>
        <div class="page-actions"><button class="btn btn-secondary btn-sm">Public form</button><button class="btn btn-primary btn-sm">${icon('plus')} Application</button></div></div>
      <div class="kanban">${['application','interview','accepted','enrolled'].map(status => {
        const labels = { application: 'Applications', interview: 'Interview', accepted: 'Accepted', enrolled: 'Enrolled' };
        const items = SKULPULSE.admissionsPipeline.filter(a => a.status === status);
        return `<div class="kanban-column"><h4>${labels[status]} (${items.length})</h4>
          ${items.map(a => `<div class="kanban-card"><strong>${a.name}</strong><div class="text-xs text-muted">${a.appliedClass} · ${a.date}</div>${a.score ? `<div class="badge badge-brand" style="margin-top:0.5rem">Score: ${a.score}</div>` : ''}</div>`).join('')}
        </div>`;
      }).join('')}</div>`;
  },

  renderAcademicStructure() {
    return `
      <div class="page-header"><div><h1>Academic structure</h1></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">${icon('plus')} Class</button></div></div>
      <div class="tabs"><button class="tab active">Classes</button><button class="tab">Subjects</button><button class="tab">Curriculum</button></div>
      <div class="grid grid-2 gap-3">
        <div class="panel"><div class="panel-head"><h3>Classes</h3></div><div class="panel-body panel-body-flush table-wrap"><table>
          <thead><tr><th>Class</th><th>Students</th><th>Teacher</th><th>Room</th></tr></thead>
          <tbody>${SKULPULSE.classes.map(c => `<tr><td><div class="font-medium">${c.name}</div><div class="text-xs text-muted">${c.stream}</div></td><td>${c.students}</td><td>${c.classTeacher}</td><td class="text-muted">${c.room}</td></tr>`).join('')}</tbody>
        </table></div></div>
        <div class="panel"><div class="panel-head"><h3>Subjects</h3><span class="text-xs text-muted">UNEB</span></div><div class="panel-body panel-body-flush table-wrap"><table>
          <thead><tr><th>Subject</th><th>Code</th><th>Category</th></tr></thead>
          <tbody>${SKULPULSE.subjects.map(s => `<tr><td>${s.name}</td><td class="font-mono text-muted">${s.unebCode}</td><td>${s.category}</td></tr>`).join('')}</tbody>
        </table></div></div>
      </div>`;
  },

  renderAssessment() {
    return `
      <div class="page-header"><div><h1>Assessment</h1></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">${icon('plus')} New assessment</button></div></div>
      <div class="panel" style="margin-bottom:0.75rem"><div class="panel-body">
        <div class="flex gap-3" style="flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:160px"><label class="form-label">Grading</label>
          <select class="form-control form-select"><option>CA 40% + Exam 60%</option></select></div>
          <div class="form-group" style="margin:0;flex:1;min-width:160px"><label class="form-label">Scale</label>
          <select class="form-control form-select"><option>A–E (UNEB)</option></select></div>
        </div></div></div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Assessment</th><th>Type</th><th>Class</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${SKULPULSE.assessments.map(a => `<tr><td>${a.name}</td><td class="text-secondary">${a.type}</td><td>${a.class}</td><td class="text-muted">${a.date}</td>
          <td><span class="badge ${a.status==='published'?'badge-success badge-dot':'badge-warning'}">${a.status}</span></td>
          <td><button class="btn btn-ghost btn-sm">Marks</button></td></tr>`).join('')}</tbody></table></div></div>`;
  },

  renderReportCards() {
    const rc = SKULPULSE.reportCardSample;
    const isParent = this.currentRole === 'parent';
    return `
      <div class="page-header"><div><h1>Report cards</h1></div>
        <div class="page-actions">${isParent ? '' : '<button class="btn btn-secondary btn-sm">Generate</button><button class="btn btn-primary btn-sm">Publish</button>'}</div></div>
      ${!isParent ? `<div class="panel" style="margin-bottom:0.75rem"><div class="toolbar">
        <select class="form-control form-select"><option>S.4 West</option></select>
        <select class="form-control form-select"><option>Term 2, 2025</option></select>
      </div></div>` : ''}
      <div class="dash-grid cols-21 reveal" style="margin-bottom:0.75rem">
        <div class="panel"><div class="panel-head"><h3>Subject performance</h3><span class="text-xs text-muted">${rc.student}</span></div>
          <div class="chart-body">${Charts.bars({ data: rc.grades.map((g) => ({ label: g.subject.slice(0, 4), value: g.total, color: Charts.scoreColor(g.total) })), max: 100 })}</div></div>
        <div class="panel"><div class="panel-head"><h3>Summary</h3></div>
          <div class="chart-body" style="text-align:center">${Charts.ring({ value: rc.average, label: rc.average + '%', size: 110 })}
            <div class="tile-row" style="margin-top:0.625rem">
              <div class="tile"><div class="tv">${rc.position}<span class="text-sm text-muted">/${rc.totalStudents}</span></div><div class="tl">Position</div></div>
              <div class="tile"><div class="tv">${rc.aggregate}</div><div class="tl">Aggregate</div></div>
            </div>
          </div></div>
      </div>
      <div class="report-card-preview reveal-2">
        <div class="report-card-header">
          <h2>${SKULPULSE.school.name}</h2>
          <p style="opacity:0.85;margin-top:0.25rem">${SKULPULSE.school.motto}</p>
          <h3 style="margin-top:1rem">TERMINAL REPORT — ${rc.term}</h3>
        </div>
        <div class="report-card-body">
          <div class="grid grid-2 gap-4" style="margin-bottom:1.5rem">
            <div><strong>Student:</strong> ${rc.student}<br><strong>ID:</strong> ${rc.studentId}<br><strong>Class:</strong> ${rc.class}</div>
            <div><strong>Position:</strong> ${rc.position} of ${rc.totalStudents}<br><strong>Attendance:</strong> ${rc.attendance.present}/${rc.attendance.total} (${rc.attendance.percentage}%)<br><strong>Conduct:</strong> ${rc.conduct}</div>
          </div>
          <table class="grade-table" style="width:100%;margin-bottom:1.5rem"><thead><tr><th>Subject</th><th>CA (/40)</th><th>Exam (/60)</th><th>Total</th><th>Grade</th><th>Remark</th></tr></thead>
            <tbody>${rc.grades.map(g => `<tr><td>${g.subject}</td><td>${g.ca}</td><td>${g.exam}</td><td>${g.total}</td><td><strong>${g.grade}</strong></td><td>${g.remark}</td></tr>`).join('')}
            <tr style="font-weight:700;background:var(--surface-1)"><td colspan="3">Average</td><td>${rc.average}</td><td colspan="2">Aggregate: ${rc.aggregate}</td></tr>
          </tbody></table>
          <p><strong>Class Teacher's Comment:</strong> ${rc.teacherComment}</p>
          <p style="margin-top:0.75rem"><strong>Head Teacher's Comment:</strong> ${rc.headTeacherComment}</p>
          <div class="flex gap-2" style="margin-top:1rem">
            <button class="btn btn-primary btn-sm" onclick="window.print()">Print / PDF</button>
            ${isParent ? '<button class="btn btn-secondary btn-sm">Email</button>' : ''}
          </div>
        </div>
      </div>`;
  },

  renderTimetable() {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const periods = ['8:00','9:00','10:00','11:00','12:00','2:00','3:00'];
    const subjects = ['Math','English','Physics','Biology','History','Chemistry','PE','CRE'];
    return `
      <div class="page-header"><div><h1>Timetable</h1></div>
        <div class="page-actions"><select class="form-control form-select" style="width:auto;height:1.75rem"><option>S.4 West</option></select><button class="btn btn-secondary btn-sm">Edit</button></div></div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Time</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${periods.map((p,i) => `<tr><td><strong>${p}</strong></td>${days.map((_,j) => `<td>${subjects[(i+j)%subjects.length]}<div class="text-xs text-muted">Rm D-0${(j%3)+1}</div></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div></div>`;
  },

  renderAttendance() {
    const sa = Analytics.schoolAverage();
    const chronic = SKULPULSE.students.filter((s) => s.attendanceRate < 80).length;
    const absent = Math.round(SKULPULSE.students.length * (1 - sa.attendance / 100));
    const trend = Charts.line({
      values: Analytics.attendanceTrend().map((p) => p.value), labels: Analytics.attendanceTrend().map((p) => p.label),
      min: 70, max: 100
    });
    const classBars = Charts.bars({ data: Analytics.byClass().map((c) => ({ label: c.name.replace('S.', 'S'), value: c.attendance })), max: 100 });
    const roster = SKULPULSE.students.filter((s) => s.class === 'S.4 West');

    return `
      <div class="page-header reveal"><div><h1>Attendance</h1><p>Term 2, 2025 · ${SKULPULSE.school.name}</p></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">Take roll</button><button class="btn btn-secondary btn-sm">Alert parents</button></div></div>
      <div class="metric-grid">
        ${this.metricCard('Attendance today', sa.attendance, { icon: 'attendance', suffix: '%' })}
        ${this.metricCard('Present', SKULPULSE.students.length - absent, { icon: 'students', accent: 'blue' })}
        ${this.metricCard('Absent today', absent, { icon: 'alert', accent: 'amber' })}
        ${this.metricCard('Chronic absentees', chronic, { icon: 'alert', accent: 'red', foot: `<span class="text-muted">below 80% this term</span>` })}
      </div>
      <div class="dash-grid cols-21 reveal-2">
        <div class="panel panel-hero"><div class="panel-head"><h3>Weekly attendance trend</h3><span class="badge badge-brand">Term 2</span></div><div class="chart-body">${trend}</div></div>
        <div class="panel"><div class="panel-head"><h3>By class</h3></div><div class="chart-body">${classBars}</div></div>
      </div>
      <div class="panel reveal-3" style="margin-top:0.75rem"><div class="panel-head"><h3>S.4 West roll call</h3><span class="text-xs text-muted">13 Jun 2025</span></div><div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Status</th><th>Time in</th><th>Term rate</th><th>Remarks</th></tr></thead>
        <tbody>${roster.map((s) => {
          const absentToday = s.attendanceRate < 78;
          return `<tr>
            <td><div class="flex items-center gap-2"><div class="avatar ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>${s.name}</div></td>
            <td>${absentToday ? '<span class="badge badge-danger">Absent</span>' : '<span class="badge badge-success badge-dot">Present</span>'}</td>
            <td>${absentToday ? '—' : '7:' + (35 + (s.age % 20)) + ' AM'}</td>
            <td>${s.attendanceRate}%</td>
            <td class="text-muted">${absentToday ? 'Parent notified by SMS' : '—'}</td>
          </tr>`;
        }).join('')}</tbody></table></div></div>`;
  },

  renderAIAnalytics() {
    const scope = this.aiScope;
    const levels = Analytics.byLevel().map((l) => l.level);
    const filterFn = scope === 'all' ? null : (s) => s.level === scope;

    const risk = Analytics.riskDistribution(filterFn);
    const divisions = Analytics.divisionForecast(filterFn);
    const classData = Analytics.byClass(scope === 'all' ? null : scope);
    // Flagged cards: in the overview show only high-priority; drill into a level for the full high+medium list.
    const insights = SKULPULSE.aiInsights.filter((i) => {
      if (i.riskLevel === 'low') return false;
      return scope === 'all' ? i.riskLevel === 'high' : i.level === scope;
    });

    const divColors = {
      'Division 1': 'oklch(0.58 0.13 155)', 'Division 2': 'oklch(0.66 0.13 130)',
      'Division 3': 'oklch(0.72 0.14 75)', 'Division 4': 'oklch(0.68 0.15 45)', 'Fail risk': 'oklch(0.6 0.17 28)'
    };

    const riskDonut = Charts.donut({
      segments: [
        { label: 'On track', value: risk.low, color: 'oklch(0.6 0.13 155)' },
        { label: 'Monitor', value: risk.medium, color: 'oklch(0.72 0.14 75)' },
        { label: 'At risk', value: risk.high, color: 'oklch(0.6 0.17 28)' }
      ], centerValue: risk.total, centerLabel: 'students', size: 150
    });
    const atRiskBars = Charts.bars({
      data: classData.map((c) => ({ label: c.name.replace('S.', 'S'), value: c.atRisk, highlight: c.atRisk === Math.max(1, ...classData.map((x) => x.atRisk)) && c.atRisk > 0 })),
      max: Math.max(1, ...classData.map((c) => c.atRisk)), height: 150
    });
    const divDonut = Charts.donut({
      segments: divisions.map((d) => ({ label: d.label.replace('Division ', 'Div '), value: d.value, color: divColors[d.label] || 'var(--c1)' })),
      centerValue: risk.total, centerLabel: 'forecast', size: 150
    });

    // Secondary analysis: heatmap for a level, or level comparison for "all"
    let secondary;
    if (scope === 'all') {
      const byLevel = Analytics.byLevel();
      const subjAgg = {};
      SKULPULSE.students.forEach((s) => s.subjects.forEach((x) => { (subjAgg[x.name] ||= []).push(x.current); }));
      const subjBars = Object.entries(subjAgg).map(([name, arr]) => ({ label: name, value: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }))
        .sort((a, b) => b.value - a.value);
      secondary = `
        <div class="dash-grid cols-2" style="margin-top:0.75rem">
          <div class="panel"><div class="panel-head"><h3>Average by level</h3><span class="text-xs text-muted">S.1 – S.6</span></div>
            <div class="chart-body">${Charts.bars({ data: byLevel.map((l) => ({ label: l.level, value: l.average })), max: 100 })}</div></div>
          <div class="panel"><div class="panel-head"><h3>Subject performance (school-wide)</h3></div>
            <div class="chart-body">${Charts.hbars({ data: subjBars.map((b) => ({ ...b, color: Charts.scoreColor(b.value) })), max: 100, format: (v) => v + '%' })}</div></div>
        </div>`;
    } else {
      const hm = Analytics.subjectHeatmap(scope);
      const subjAvg = Analytics.subjectAverages(scope);
      secondary = `
        <div class="dash-grid cols-21" style="margin-top:0.75rem">
          <div class="panel"><div class="panel-head"><h3>${scope} subject heatmap</h3><span class="text-xs text-muted">class × subject avg</span></div>
            <div class="chart-body">${Charts.heatmap(hm)}<p class="chart-cap">Darker green = stronger; amber/red = needs intervention</p></div></div>
          <div class="panel"><div class="panel-head"><h3>${scope} subjects</h3></div>
            <div class="chart-body">${Charts.hbars({ data: subjAvg.map((s) => ({ label: s.name, value: s.average, color: Charts.scoreColor(s.average) })), max: 100, format: (v) => v + '%' })}</div></div>
        </div>`;
    }

    // Group flagged students by class
    const groups = {};
    insights.forEach((i) => { (groups[i.class] ||= []).push(i); });
    const orderedClasses = (SKULPULSE.classes || []).map((c) => c.name).filter((n) => groups[n]);
    const groupsHtml = orderedClasses.map((cls) => {
      const items = groups[cls].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.riskLevel] - { high: 0, medium: 1, low: 2 }[b.riskLevel]));
      const high = items.filter((i) => i.riskLevel === 'high').length;
      return `
        <div class="group-head">
          <h3>${cls}</h3>
          <div class="group-meta">
            ${high ? `<span class="badge badge-danger">${high} at risk</span>` : ''}
            <span class="badge badge-muted">${items.length} flagged</span>
          </div>
        </div>
        <div class="stack gap-3" style="margin-bottom:1rem">${items.map((i) => this.renderInsightCard(i)).join('')}</div>`;
    }).join('');

    const scopeBtns = ['all', ...levels].map((l) =>
      `<button data-ai-scope="${l}" class="${scope === l ? 'active' : ''}">${l === 'all' ? 'All levels' : l}</button>`
    ).join('');

    return `
      <div class="page-header reveal"><div><h1>AI analytics</h1><p>Early-warning model · attendance, assessment momentum & peer benchmarks</p></div>
        <div class="page-actions"><button class="btn btn-secondary btn-sm">${icon('download')} Export</button><button class="btn btn-primary btn-sm" onclick="App.showToast('Re-running model on latest scores…', 2500)">${icon('ai')} Run analysis</button></div></div>

      <div class="notice notice-brand"><span class="notice-icon">${icon('ai')}</span><div class="notice-body"><div class="notice-title">${risk.high} high-priority · ${risk.medium} to monitor${scope === 'all' ? ' across the school' : ' in ' + scope}</div><div class="notice-text">The model scores every student on grade trend, attendance and subject gaps, then predicts UCE/UACE outcomes and suggests interventions — before results day. ${scope === 'all' ? 'Showing high-priority students — pick a level below to see everyone flagged.' : ''}</div></div></div>

      <div class="flex items-center justify-between" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
        <div class="segmented">${scopeBtns}</div>
        <span class="text-xs text-muted">Filtering by level of study</span>
      </div>

      <div class="dash-grid cols-3 reveal-2">
        <div class="panel"><div class="panel-head"><h3>Risk distribution</h3></div><div class="chart-body">${riskDonut}</div></div>
        <div class="panel"><div class="panel-head"><h3>At-risk by class</h3></div><div class="chart-body">${atRiskBars}</div></div>
        <div class="panel"><div class="panel-head"><h3>Predicted divisions</h3></div><div class="chart-body">${divDonut}</div></div>
      </div>

      ${secondary}

      <div class="section-title" style="margin:1.25rem 0 0.75rem"><span class="dot"></span>${scope === 'all' ? 'High-priority students by class' : 'Flagged students by class · ' + scope}</div>
      ${groupsHtml || '<div class="empty-state"><p>🎉 No students flagged in this scope — everyone is on track.</p></div>'}`;
  },

  renderInsightCard(i) {
    const series = i.sparkline || [];
    const subjBars = (i.subjects || []).map((x) => ({ label: x.name.slice(0, 4), value: x.current, color: Charts.scoreColor(x.current) }));
    const pred = i.predictedUACE || i.predictedUCE || '—';
    return `
      <div class="insight-card">
        <div class="insight-head ${i.riskLevel}">
          <div class="avatar avatar-lg ${this.avatarClass(i.studentName)}">${this.initials(i.studentName)}</div>
          <div style="flex:1;min-width:0">
            <div class="font-medium">${i.studentName}</div>
            <div class="text-xs text-muted">${i.class} · ${i.level} · ${i.studentId}</div>
          </div>
          ${this.riskPill(i.riskLevel)}
          <span class="badge badge-brand">${pred}</span>
        </div>
        <div class="insight-body">
          <div class="insight-metrics">
            <div class="insight-metric"><div class="v">${i.currentAverage}%</div><div class="l">Average</div></div>
            <div class="insight-metric"><div class="v">${i.attendanceRate}%</div><div class="l">Attendance</div></div>
            <div class="insight-metric"><div class="v">${this.trendBadge(i.delta)}</div><div class="l">Term trend</div></div>
            <div class="insight-metric"><div class="v">${i.predictedGrade}</div><div class="l">Predicted grade</div></div>
            <div style="margin-left:auto;text-align:right"><div class="l text-xs text-muted">Trajectory</div>${Charts.sparkline(series, { width: 96, height: 30 })}</div>
          </div>
          <div class="grid grid-2 gap-3">
            <div><div class="text-xs font-medium text-muted" style="margin-bottom:0.375rem">Why flagged</div><div class="chip-list">${i.factors.map((f) => `<div class="chip-line">${f}</div>`).join('')}</div></div>
            <div><div class="text-xs font-medium text-muted" style="margin-bottom:0.375rem">Recommended actions</div><div class="chip-list">${i.recommendations.map((r) => `<div class="chip-line rec">${r}</div>`).join('')}</div></div>
          </div>
          ${subjBars.length ? `<div style="margin-top:0.75rem"><div class="text-xs font-medium text-muted" style="margin-bottom:0.25rem">Subject breakdown</div>${Charts.bars({ data: subjBars, max: 100, height: 120 })}</div>` : ''}
        </div>
      </div>`;
  },

  renderFinance() {
    const isParent = this.currentRole === 'parent';
    if (isParent) {
      const child = this.parentChild();
      const fee = SKULPULSE.feeRecords.find((f) => f.studentId === child.id) || { termFee: 1, paid: 1, balance: 0, status: 'paid' };
      const pct = Math.round((fee.paid / fee.termFee) * 100);
      return `
        <div class="page-header reveal"><div><h1>Fees</h1><p>${child.name} · ${child.class}</p></div></div>
        <div class="metric-grid">
          ${this.metricCard('Term fee', Math.round(fee.termFee / 1000), { icon: 'finance', prefix: 'UGX ', suffix: 'K' })}
          ${this.metricCard('Paid', Math.round(fee.paid / 1000), { icon: 'attendance', prefix: 'UGX ', suffix: 'K', accent: 'blue' })}
          ${this.metricCard('Balance', fee.balance === 0 ? 'Clear' : Math.round(fee.balance / 1000), fee.balance === 0 ? { icon: 'finance', raw: true } : { icon: 'alert', prefix: 'UGX ', suffix: 'K', accent: 'amber' })}
        </div>
        <div class="panel reveal-2"><div class="panel-head"><h3>Payment progress</h3><span class="badge ${pct >= 100 ? 'badge-success' : 'badge-warning'}">${pct}% paid</span></div>
          <div class="panel-body">
            <div class="bar-mini" style="margin-bottom:0.875rem"><span style="width:${pct}%"></span></div>
            <div class="text-sm text-muted" style="margin-bottom:0.75rem">Pay securely — funds reflect instantly on the school ledger.</div>
            <div class="flex gap-2" style="flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="App.showToast('MTN MoMo prompt sent to your phone…', 3000)">📱 MTN MoMo</button>
              <button class="btn btn-secondary btn-sm" onclick="App.showToast('Airtel Money prompt sent…', 3000)">📱 Airtel Money</button>
              <button class="btn btn-secondary btn-sm">🏦 Bank transfer</button>
            </div>
          </div></div>`;
    }

    const fin = Analytics.finance();
    const statusDonut = Charts.donut({
      segments: [
        { label: 'Paid', value: fin.byStatus.paid, color: 'oklch(0.6 0.13 155)' },
        { label: 'Partial', value: fin.byStatus.partial, color: 'oklch(0.72 0.14 75)' },
        { label: 'Overdue', value: fin.byStatus.overdue, color: 'oklch(0.6 0.17 28)' },
        { label: 'Unpaid', value: fin.byStatus.unpaid, color: 'var(--surface-2)' }
      ], centerValue: fin.rate + '%', centerLabel: 'collected'
    });
    const methodBars = Object.entries(fin.byMethod).map(([k, v], i) => ({ label: k, value: Math.round(v / 1000000), color: Charts.PALETTE[i % Charts.PALETTE.length] }));
    const recs = [...SKULPULSE.feeRecords].sort((a, b) => b.balance - a.balance);

    return `
      <div class="page-header reveal"><div><h1>Finance</h1><p>Term 2, 2025 · ${fin.count} student accounts</p></div>
        <div class="page-actions"><button class="btn btn-secondary btn-sm">${icon('download')} Receipts</button><button class="btn btn-primary btn-sm">${icon('plus')} Payment</button></div></div>
      <div class="metric-grid">
        ${this.metricCard('Collected', Math.round(fin.collected / 1000000), { icon: 'finance', prefix: 'UGX ', suffix: 'M', foot: `<span class="text-muted">${fin.rate}% of billed</span>` })}
        ${this.metricCard('Outstanding', Math.round(fin.outstanding / 1000000), { icon: 'billing', prefix: 'UGX ', suffix: 'M', accent: 'amber' })}
        ${this.metricCard('Billed', Math.round(fin.billed / 1000000), { icon: 'chart', prefix: 'UGX ', suffix: 'M', accent: 'blue' })}
        ${this.metricCard('Overdue accounts', fin.overdueCount, { icon: 'alert', accent: 'red' })}
      </div>
      <div class="dash-grid cols-2 reveal-2">
        <div class="panel"><div class="panel-head"><h3>Payment status</h3></div><div class="chart-body">${statusDonut}</div></div>
        <div class="panel"><div class="panel-head"><h3>Collected by method</h3><span class="text-xs text-muted">UGX millions</span></div><div class="chart-body">${Charts.hbars({ data: methodBars, format: (v) => 'UGX ' + v + 'M' })}</div></div>
      </div>
      <div class="panel reveal-3" style="margin-top:0.75rem"><div class="panel-head"><h3>Student accounts</h3><span class="text-xs text-muted">highest balance first</span></div>
        <div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Class</th><th>Term fee</th><th>Paid</th><th>Balance</th><th>Status</th><th>Method</th></tr></thead>
        <tbody>${recs.map(f => `<tr><td>${f.student}</td><td>${f.class}</td><td>${formatUGX(f.termFee)}</td><td>${formatUGX(f.paid)}</td><td>${formatUGX(f.balance)}</td>
          <td><span class="badge ${f.status==='paid'?'badge-success':f.status==='overdue'||f.status==='unpaid'?'badge-danger':'badge-warning'}">${f.status}</span></td>
          <td class="text-muted">${f.method || '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
  },

  renderCommunication() {
    return `
      <div class="page-header"><div><h1>Communication</h1></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">${icon('plus')} Message</button></div></div>
      <div class="grid grid-2 gap-3">
        <div class="panel"><div class="panel-head"><h3>SMS</h3><span class="badge badge-muted">2,400 left</span></div><div class="panel-body">
          <div class="form-group"><label class="form-label">To</label><select class="form-control form-select"><option>Parents · S.4</option><option>All parents</option></select></div>
          <div class="form-group"><label class="form-label">Message</label><textarea class="form-control" rows="3">Term 2 report cards are now on the parent portal.</textarea></div>
          <button class="btn btn-primary btn-sm" onclick="App.showToast('SMS sent (demo)')">Send</button>
        </div></div>
        <div class="panel"><div class="panel-head"><h3>Announcements</h3></div><div class="panel-body panel-body-flush"><table><tbody>
          ${SKULPULSE.announcements.map(a => `<tr><td><div class="font-medium text-sm">${a.title}</div><div class="text-xs text-muted">${a.date} · ${a.audience}</div></td><td><span class="badge ${a.priority==='high'?'badge-danger':'badge-muted'}">${a.priority}</span></td></tr>`).join('')}
        </tbody></table></div></div>
      </div>`;
  },

  renderAddon(name, iconName, desc) {
    return `
      <div class="page-header"><div><h1>${name}</h1><p class="text-sm text-muted">${desc}</p></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm" onclick="App.navigate('modules')">Subscribe</button></div></div>
      <div class="empty-state"><div class="empty-state-icon">${icon(iconName)}</div><h3>Module not active</h3><p>Available on higher plans.</p></div>`;
  },

  moduleIcon(id) {
    const map = { core: 'dashboard', 'ai-analytics': 'ai', reportcards: 'reportcards', 'hr-payroll': 'billing', 'moes-reporting': 'audit' };
    return icon(map[id] || (Icons[id] ? id : 'layers'));
  },

  renderModules() {
    const subscribed = this.getSubscribedModules();
    const breakdown = getModuleBreakdown(subscribed);
    const editable = this.canManageSchool();
    const paidCount = breakdown.modules.filter(m => m.id !== 'core').length;

    return `
      <div class="page-header">
        <div>
          <h1>Subscriptions</h1>
          <p class="text-sm text-muted">Module-based billing per term · no student limits</p>
        </div>
        ${editable ? '' : '<div class="page-actions"><span class="badge badge-muted">View only</span></div>'}
      </div>

      ${!editable ? `<div class="notice notice-brand" style="margin-bottom:0.75rem"><div class="notice-body"><div class="notice-text text-sm">Only school administrators can add or remove modules. Contact your admin if you need changes.</div></div></div>` : ''}

      <div class="grid grid-2 gap-3 school-edit-layout">
        <div class="stack gap-3">
          ${this.renderPortalPresetBar(editable)}
          ${this.renderPortalModulePicker(subscribed, editable)}
        </div>
        <div class="stack gap-3">
          <div class="panel bill-preview">
            <div class="panel-head"><h3>Term estimate</h3><span class="badge badge-brand">${paidCount} modules</span></div>
            <div class="panel-body" id="portal-bill-preview">${this.renderBillPreviewBody(subscribed)}</div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>How billing works</h3></div>
            <div class="panel-body">
              <ul class="text-sm text-secondary" style="padding-left:1rem;display:grid;gap:0.375rem;margin:0">
                <li>Platform base fee required each term</li>
                <li>Enable or disable modules — sidebar updates immediately</li>
                <li>Changes sync with the platform admin portal</li>
                <li>Student count does not affect pricing</li>
              </ul>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Current invoice</h3></div>
            <div class="panel-body panel-body-flush">
              <table class="text-sm">
                <tbody>
                  <tr><td>Platform base</td><td class="text-right">${formatUGX(breakdown.baseFee)}</td></tr>
                  ${breakdown.modules.filter(m => m.id !== 'core').map(m =>
                    `<tr><td>${m.name}</td><td class="text-right">${formatUGX(m.price)}</td></tr>`
                  ).join('')}
                  <tr class="bill-total-row"><td><strong>Total</strong></td><td class="text-right"><strong>${formatUGX(breakdown.total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  },

  renderRBAC() {
    const modules = ['students','teachers','assessment','finance','reportcards','ai-analytics','attendance'];
    const roles = ['school-admin','deputy-head','teacher','bursar','parent'];
    return `
      <div class="page-header"><div><h1>Roles & Permissions</h1><p>Control who can access what within your subscribed modules</p></div>
        <div class="page-actions"><button class="btn btn-primary">+ Custom Role</button></div></div>
      <div class="card"><div class="card-body"><p class="text-sm text-secondary" style="margin-bottom:1rem">RBAC is scoped to subscribed modules only. Users cannot access modules the school hasn't paid for, regardless of role.</p></div>
      <div class="table-wrap"><table class="rbac-matrix"><thead><tr><th>Module / Role</th>${roles.map(r=>`<th>${SKULPULSE.roles.find(x=>x.id===r)?.name.split(' ')[0]}</th>`).join('')}</tr></thead>
        <tbody>${modules.map(mod => `<tr><td>${mod}</td>${roles.map(role => {
          const perms = SKULPULSE.rbacMatrix[role]?.[mod] || [];
          return `<td style="text-align:center">${perms.length ? `<span class="badge badge-brand">${perms.length} perms</span>` : '<span class="text-muted">—</span>'}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div></div>
      <div class="card" style="margin-top:1rem"><div class="card-header"><h3>Permission Detail — Teacher Role</h3></div><div class="card-body table-wrap"><table>
        <thead><tr><th>Module</th>${SKULPULSE.rbacPermissions.map(p=>`<th>${p.label}</th>`).join('')}</tr></thead>
        <tbody><tr><td>Assessment</td>${SKULPULSE.rbacPermissions.map(p => `<td style="text-align:center"><input type="checkbox" ${['view','create','edit'].includes(p.id)?'checked':''} disabled /></td>`).join('')}</tr>
        <tr><td>Attendance</td>${SKULPULSE.rbacPermissions.map(p => `<td style="text-align:center"><input type="checkbox" ${['view','create','edit'].includes(p.id)?'checked':''} disabled /></td>`).join('')}</tr>
        <tr><td>Students</td>${SKULPULSE.rbacPermissions.map(p => `<td style="text-align:center"><input type="checkbox" ${p.id==='view'?'checked':''} disabled /></td>`).join('')}</tr>
      </tbody></table></div></div>`;
  },

  renderAcademicYears() {
    return `
      <div class="page-header"><div><h1>Academic Years & Terms</h1><p>Strict data isolation — no cross-year data mix-ups</p></div>
        <div class="page-actions"><button class="btn btn-primary">+ New Academic Year</button></div></div>
      <div class="notice notice-info"><span class="notice-icon">${icon('shield')}</span><div class="notice-body"><div class="notice-title">Data isolation</div><div class="notice-text">Each year and term keeps separate records. Archived years are read-only. Promotions copy forward without altering history.</div></div></div>
      <div class="timeline">${SKULPULSE.academicYears.map(y => `
        <div class="timeline-item"><div class="card"><div class="card-body">
          <div class="flex justify-between items-center"><h3>${y.label} <span class="badge ${y.status==='active'?'badge-success':y.status==='archived'?'badge-muted':'badge-info'}">${y.status}</span></h3>
          ${y.status==='active'?'<button class="btn btn-secondary btn-sm">Close Year</button>':''}</div>
          <div style="margin-top:1rem">${(SKULPULSE.terms[y.id]||[]).map(t => `
            <div class="flex justify-between items-center" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div><strong>${t.label}</strong><div class="text-xs text-muted">${t.dates}</div></div>
              <span class="badge ${t.status==='active'?'badge-success':t.status==='closed'?'badge-muted':'badge-info'}">${t.status}</span>
            </div>`).join('')}</div>
        </div></div>`).join('')}</div>`;
  },

  renderAuditLog() {
    return `
      <div class="page-header"><div><h1>Audit Log</h1><p>Complete trail of all actions for accountability</p></div>
        <div class="page-actions"><button class="btn btn-secondary">📥 Export Log</button></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th></tr></thead>
        <tbody>${SKULPULSE.auditLog.map(l => `<tr><td>${l.time}</td><td>${l.user}</td><td>${l.action}</td><td><span class="badge badge-muted">${l.module}</span></td></tr>`).join('')}</tbody></table></div></div>`;
  },

  renderSettings() {
    const school = SkulStore.getSchool(this.getSchoolId()) || SKULPULSE.school;
    const editable = this.canManageSchool();
    const regions = ['Central', 'Eastern', 'Northern', 'Western'];
    const levels = ['Secondary (O & A Level)', 'Primary', 'Mixed (P.1 – S.6)'];

    return `
      <div class="page-header">
        <div>
          <h1>School settings</h1>
          <p class="text-sm text-muted">Profile, preferences, and portal accounts for <code>${this.esc(school.schoolCode)}</code></p>
        </div>
        ${editable ? '' : '<div class="page-actions"><span class="badge badge-muted">View only</span></div>'}
      </div>

      ${!editable ? `<div class="notice notice-brand" style="margin-bottom:0.75rem"><div class="notice-body"><div class="notice-text text-sm">Only school administrators can edit these settings.</div></div></div>` : ''}

      <div class="grid grid-2 gap-3 school-edit-layout">
        <div class="stack gap-3">
          <form id="school-settings-form" class="panel">
            <div class="panel-head"><h3>School profile</h3></div>
            <div class="panel-body stack">
              <label class="field">
                <span class="field-label">School code</span>
                <input class="input" value="${this.esc(school.schoolCode)}" disabled>
                <span class="text-xs text-muted">Set at onboarding · used for sign-in</span>
              </label>
              <label class="field">
                <span class="field-label">School name *</span>
                <input class="input" name="name" value="${this.esc(school.name)}" required ${editable ? '' : 'disabled'}>
              </label>
              <label class="field">
                <span class="field-label">Motto</span>
                <input class="input" name="motto" value="${this.esc(school.motto || '')}" ${editable ? '' : 'disabled'}>
              </label>
              <div class="grid grid-2 gap-2">
                <label class="field">
                  <span class="field-label">District</span>
                  <input class="input" name="district" value="${this.esc(school.district || '')}" ${editable ? '' : 'disabled'}>
                </label>
                <label class="field">
                  <span class="field-label">Region</span>
                  <select class="input" name="region" ${editable ? '' : 'disabled'}>
                    ${regions.map(r => `<option ${school.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </label>
              </div>
              <label class="field">
                <span class="field-label">Level</span>
                <select class="input" name="level" ${editable ? '' : 'disabled'}>
                  ${levels.map(l => `<option ${school.level === l ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </label>
              <label class="field">
                <span class="field-label">EMIS code</span>
                <input class="input" name="emisCode" value="${this.esc(school.emisCode || '')}" ${editable ? '' : 'disabled'}>
              </label>
              <div class="grid grid-2 gap-2">
                <label class="field">
                  <span class="field-label">Phone</span>
                  <input class="input" name="phone" value="${this.esc(school.phone || '')}" ${editable ? '' : 'disabled'}>
                </label>
                <label class="field">
                  <span class="field-label">Email</span>
                  <input class="input" name="email" type="email" value="${this.esc(school.email || '')}" ${editable ? '' : 'disabled'}>
                </label>
              </div>
              <div class="grid grid-2 gap-2">
                <label class="field">
                  <span class="field-label">Primary contact</span>
                  <input class="input" name="contactName" value="${this.esc(school.contactName || '')}" ${editable ? '' : 'disabled'}>
                </label>
                <label class="field">
                  <span class="field-label">Contact phone</span>
                  <input class="input" name="contactPhone" value="${this.esc(school.contactPhone || '')}" ${editable ? '' : 'disabled'}>
                </label>
              </div>
              <label class="field">
                <span class="field-label">Internal notes</span>
                <textarea class="input" name="notes" rows="2" ${editable ? '' : 'disabled'}>${this.esc(school.notes || '')}</textarea>
              </label>
              ${editable ? '<button type="submit" class="btn btn-primary btn-sm">Save profile</button>' : ''}
            </div>
          </form>

          ${this.renderPortalUsersPanel(school.id)}
        </div>

        <div class="stack gap-3">
          <div class="panel">
            <div class="panel-head"><h3>Preferences</h3></div>
            <div class="panel-body stack">
              <label class="field">
                <span class="field-label">Academic calendar</span>
                <select class="input" name="academicCalendar" form="school-settings-form" ${editable ? '' : 'disabled'}>
                  <option value="uganda-3-term" ${school.academicCalendar === 'uganda-3-term' ? 'selected' : ''}>Uganda 3-term system</option>
                  <option value="custom" ${school.academicCalendar === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Currency</span>
                <select class="input" name="currency" form="school-settings-form" ${editable ? '' : 'disabled'}>
                  <option value="UGX" ${school.currency === 'UGX' ? 'selected' : ''}>UGX — Ugandan Shilling</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Timezone</span>
                <select class="input" name="timezone" form="school-settings-form" ${editable ? '' : 'disabled'}>
                  <option value="Africa/Kampala" ${school.timezone === 'Africa/Kampala' ? 'selected' : ''}>Africa/Kampala (EAT)</option>
                </select>
              </label>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Subscription summary</h3></div>
            <div class="panel-body">
              <p class="text-sm"><strong>${this.getSubscribedModules().filter(id => id !== 'core').length}</strong> active modules</p>
              <p class="text-sm text-muted" style="margin-top:0.25rem">Term bill: ${formatUGX(calculateTermBill(school.subscribedModules))}</p>
              ${editable ? '<button type="button" class="btn btn-secondary btn-sm" style="margin-top:0.75rem" onclick="App.navigate(\'modules\')">Manage modules</button>' : ''}
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Tenant info</h3></div>
            <div class="panel-body text-sm stack" style="gap:0.375rem">
              <div><span class="text-muted">Tenant ID</span><br><code>${school.id}</code></div>
              <div><span class="text-muted">Status</span><br>${school.status || 'active'}</div>
              <div><span class="text-muted">Onboarded</span><br>${school.onboardedAt || '—'}</div>
              <div><span class="text-muted">Billing model</span><br>${school.billingModel || 'module-based'}</div>
            </div>
          </div>
        </div>
      </div>`;
  },

  renderPlatformSchools() {
    return `
      <div class="page-header"><div><h1>All schools</h1><p class="text-sm text-muted">Module-based billing per school</p></div>
        <div class="page-actions"><button class="btn btn-primary btn-sm">${icon('plus')} Onboard</button></div></div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>School</th><th>District</th><th>Modules</th><th>Term bill</th><th>Status</th><th></th></tr></thead>
        <tbody>${SKULPULSE.platformSchools.map(s => {
          const ids = resolveModuleIds(s.subscribedModules);
          const count = ids.filter(id => id !== 'core').length;
          return `<tr><td>${s.name}</td><td class="text-muted">${s.district}</td><td>${count}</td><td>${formatUGX(calculateTermBill(ids))}</td>
            <td><span class="badge ${s.status==='active'?'badge-success badge-dot':'badge-warning'}">${s.status}</span></td>
            <td><button class="btn btn-ghost btn-sm">Manage</button></td></tr>`;
        }).join('')}</tbody></table></div></div>`;
  },

  renderPlatformBilling() {
    const invoices = SKULPULSE.platformSchools.map(s => ({
      school: s.name,
      modules: resolveModuleIds(s.subscribedModules).filter(id => id !== 'core').length,
      amount: calculateTermBill(s.subscribedModules),
      status: s.status === 'trial' ? 'pending' : 'paid'
    }));
    return `
      <div class="page-header"><div><h1>Billing</h1><p class="text-sm text-muted">Invoices derived from active modules</p></div></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Term revenue</div><div class="stat-value">${formatUGX(invoices.reduce((s, i) => s + i.amount, 0))}</div></div>
        <div class="stat-card"><div class="stat-label">Schools</div><div class="stat-value">${SKULPULSE.platformSchools.length}</div></div>
        <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${invoices.filter(i => i.status === 'pending').length}</div></div>
      </div>
      <div class="panel" style="margin-top:0.75rem"><div class="table-wrap"><table>
        <thead><tr><th>School</th><th>Modules</th><th>Amount</th><th>Status</th><th>Period</th></tr></thead>
        <tbody>${invoices.map(i => `<tr><td>${i.school}</td><td>${i.modules}</td><td>${formatUGX(i.amount)}</td>
          <td><span class="badge ${i.status==='paid'?'badge-success badge-dot':'badge-warning'}">${i.status}</span></td>
          <td class="text-muted">Term 2, 2025</td></tr>`).join('')}</tbody></table></div></div>`;
  },

  openStudentProfile(id) {
    this.selectedStudentId = id;
    this.studentTab = 'overview';
    this.navigate('student-profile');
  },

  renderStudentProfile() {
    const s = SKULPULSE.students.find((x) => x.id === this.selectedStudentId);
    if (!s) return `<div class="empty-state"><p>Student not found in this period.</p><button class="btn btn-secondary btn-sm" style="margin-top:0.5rem" onclick="App.navigate('students')">Back to students</button></div>`;

    const tabs = [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'academics', label: 'Academics', icon: 'assessment' },
      { id: 'finance', label: 'Finance', icon: 'finance' },
      { id: 'residence', label: 'Residence', icon: (s.residence?.type === 'Boarder' ? 'hostel' : 'transport') },
      { id: 'health', label: 'Health', icon: 'shield' },
      { id: 'guardian', label: 'Guardian', icon: 'user' },
      { id: 'attendance', label: 'Attendance', icon: 'attendance' },
      { id: 'documents', label: 'Documents', icon: 'audit' }
    ];
    if (!tabs.some((t) => t.id === this.studentTab)) this.studentTab = 'overview';
    const activeIdx = tabs.findIndex((t) => t.id === this.studentTab) + 1;
    const year = SKULPULSE.academicYears.find((y) => y.id === this.currentYear);
    const term = (SKULPULSE.terms[this.currentYear] || []).find((t) => t.id === this.currentTerm);

    const tabBar = tabs.map((t) =>
      `<button class="tab ${this.studentTab === t.id ? 'active' : ''}" data-student-tab="${t.id}">${icon(t.icon)} ${t.label}</button>`
    ).join('');

    return `
      <div class="profile-head reveal">
        <button class="btn btn-ghost btn-sm profile-back" onclick="App.navigate('students')">${icon('chevron')} Back</button>
        <div class="profile-head-divider"></div>
        <div class="avatar avatar-lg ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>
        <div class="profile-head-title">
          <div class="profile-name">${s.name}</div>
          <div class="profile-sub"><code class="font-mono">${s.id}</code> <span class="badge badge-muted">${s.level} · ${s.stream}</span> ${this.riskPill(s.riskLevel)}</div>
        </div>
        <div class="profile-head-meta">
          <span class="text-xs text-muted">${year?.label} · ${term?.label} · Tab ${activeIdx} of ${tabs.length}</span>
          <button class="btn btn-primary btn-sm" onclick="App.showToast('Edit mode — demo')">${icon('settings')} Edit</button>
        </div>
      </div>

      <div class="tabs profile-tabs reveal">${tabBar}</div>

      <div class="reveal-2">${this.renderStudentTab(s)}</div>`;
  },

  /** Read-only labelled field, styled like the reference banking UI. */
  pField(label, value, iconName, opts = {}) {
    const empty = value == null || value === '';
    const cls = `dl-value${empty ? ' empty' : ''}${opts.block ? ' block' : ''}`;
    const span = opts.span ? ' span-2' : '';
    return `<div class="dl-field${span}"><span class="dl-label">${iconName ? icon(iconName) : ''}${label}</span><div class="${cls}">${empty ? '—' : value}</div></div>`;
  },

  pSection(title, fieldsHtml) {
    return `<div class="dl-section"><div class="dl-section-title">${title}</div><div class="dl-grid">${fieldsHtml}</div></div>`;
  },

  /** Panel wrapper with id badge + optional Edit, matching the reference. */
  pPanel(title, iconName, bodyHtml, opts = {}) {
    const sid = this.selectedStudentId || '';
    const edit = opts.edit === false ? '' : `<button class="btn btn-primary btn-sm" onclick="App.showToast('Edit mode — demo')">${icon('settings')} Edit</button>`;
    const badge = opts.badge !== undefined ? opts.badge : `<span class="badge badge-muted head-id">${sid}</span>`;
    return `<div class="panel">
      <div class="panel-head"><h3>${iconName ? icon(iconName) + ' ' : ''}${title} ${badge}</h3>${edit}</div>
      <div class="panel-body">${bodyHtml}</div></div>`;
  },

  renderStudentTab(s) {
    const fee = SKULPULSE.feeRecords.find((f) => f.studentId === s.id) || { termFee: 0, paid: 0, balance: 0, status: '—', method: null, lastPayment: null };
    const series = this.studentSeries(s);
    const res = s.residence || {};
    const h = s.health || {};
    const F = (l, v, i, o) => this.pField(l, v, i, o);
    const S = (t, f) => this.pSection(t, f);
    const conduct = s.average >= 70 ? 'Excellent' : s.average >= 55 ? 'Good' : 'Fair';
    const sectionTitle = (t, badge = '') => `<div class="panel-head"><h3>${t}</h3>${badge}</div>`;

    switch (this.studentTab) {
      case 'overview':
        return `
          <div class="metric-grid">
            ${this.metricCard('Term average', s.average, { icon: 'chart', suffix: '%', foot: this.trendBadge(s.delta) + '<span class="text-muted">vs last test</span>' })}
            ${this.metricCard('Class position', s.position, { icon: 'reportcards', accent: 'blue', foot: `<span class="text-muted">of ${s.classSize}</span>` })}
            ${this.metricCard('Attendance', s.attendanceRate, { icon: 'attendance', suffix: '%' })}
            ${this.metricCard('Fee balance', fee.balance === 0 ? 'Clear' : Math.round(fee.balance / 1000), fee.balance === 0 ? { icon: 'finance', raw: true } : { icon: 'alert', prefix: 'UGX ', suffix: 'K', accent: 'amber' })}
          </div>
          ${this.pPanel('Student information', 'user',
            S('Identity',
              F('Student no.', s.id, 'audit') + F('Full name', s.name, 'user') + F('Class', s.class, 'academics') + F('Stream', s.stream)
            ) +
            S('Classification',
              F('Level of study', s.level) + F('Gender', s.gender === 'F' ? 'Female' : 'Male') + F('Age', s.age + ' years') + F('Residence', res.type)
            ) +
            S('Contact',
              F('Guardian', s.guardian, 'user') + F('Relationship', s.guardianRelation) + F('Mobile number', s.guardianPhone) + F('Home district', s.homeDistrict)
            ) +
            S('Details',
              F('LIN', s.lin) + F('Admission date', s.admissionDate, 'calendar') + F('Predicted division', s.division) + F('Conduct', conduct)
            )
          )}
          <div class="panel" style="margin-top:0.75rem">${sectionTitle('Progress this term', `<span class="badge badge-brand">Predicted ${s.division}</span>`)}
            <div class="chart-body">${Charts.line({ values: series, labels: ['Test 1', 'Test 2', 'Test 3'], height: 150, min: Math.min(...series) - 8, max: Math.max(...series) + 8 })}</div></div>`;

      case 'academics':
        return `
          <div class="panel">${sectionTitle('Subject scores', '<span class="text-xs text-muted">out of 100</span>')}
            <div class="chart-body">${Charts.bars({ data: s.subjects.map((x) => ({ label: x.name.slice(0, 4), value: x.current, color: Charts.scoreColor(x.current) })), max: 100, height: 150 })}</div></div>
          <div class="panel" style="margin-top:0.75rem">${sectionTitle('Subject breakdown', '<span class="text-xs text-muted">CA 40 · Exam 60</span>')}
            <div class="table-wrap"><table>
              <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Trend</th></tr></thead>
              <tbody>${s.subjects.map((x) => `<tr><td>${x.name}</td><td>${x.ca}</td><td>${x.exam}</td><td><strong>${x.current}</strong></td><td><span class="badge ${x.current >= 70 ? 'badge-success' : x.current >= 50 ? 'badge-warning' : 'badge-danger'}">${x.grade}</span></td><td>${this.trendBadge(x.trend, '')}</td></tr>`).join('')}
                <tr style="font-weight:700;background:var(--surface-1)"><td>Average</td><td colspan="2"></td><td>${s.average}</td><td colspan="2">${s.division}</td></tr>
              </tbody>
            </table></div></div>`;

      case 'finance': {
        const paidPct = fee.termFee ? Math.round((fee.paid / fee.termFee) * 100) : 0;
        const receipts = [];
        if (fee.paid > 0) {
          receipts.push({ date: fee.lastPayment, amount: Math.round(fee.paid * (fee.status === 'partial' ? 0.6 : 1)), method: fee.method });
          if (fee.status === 'partial') receipts.push({ date: fee.lastPayment, amount: fee.paid - Math.round(fee.paid * 0.6), method: 'Bank Transfer' });
        }
        const statusBadge = `<span class="badge ${paidPct >= 100 ? 'badge-success' : fee.status === 'overdue' || fee.status === 'unpaid' ? 'badge-danger' : 'badge-warning'}">${fee.status}</span>`;
        return this.pPanel('Fee account', 'finance',
          `<div class="bar-mini" style="margin-bottom:1.25rem"><span style="width:${paidPct}%;background:${paidPct >= 100 ? 'oklch(0.6 0.13 155)' : 'var(--brand)'}"></span></div>` +
          S('Billing',
            F('Term fee', formatUGX(fee.termFee), 'billing') + F('Amount paid', formatUGX(fee.paid)) + F('Balance', formatUGX(fee.balance)) + F('Payment status', `${paidPct}% paid`)
          ) +
          S('Last payment',
            F('Date', fee.lastPayment) + F('Method', fee.method) + F('Currency', 'UGX') + F('Standing', fee.status)
          ) +
          (receipts.length ? `<div class="dl-section-title">Payment history</div>${receipts.map((r) => `<div class="ledger-row"><span>${r.date || '—'} · ${r.method || '—'}</span><strong>${formatUGX(r.amount)}</strong></div>`).join('')}` : ''),
          { badge: statusBadge }
        );
      }

      case 'residence':
        return this.pPanel('Residence', res.type === 'Boarder' ? 'hostel' : 'transport',
          res.type === 'Boarder'
            ? S('Boarding', F('Status', 'Boarder') + F('House', res.house) + F('Dormitory', res.dorm) + F('Bed', res.bed)) +
              S('Logistics', F('Home district', s.homeDistrict) + F('Meal plan', h.diet || 'Standard'))
            : S('Day scholar', F('Status', 'Day scholar') + F('Transport', res.transport) + F('Route', res.route) + F('Drop / pickup stop', res.stop)) +
              S('Logistics', F('Pickup time', res.pickup) + F('Home district', s.homeDistrict)),
          { badge: `<span class="badge badge-muted">${res.type || '—'}</span>` }
        );

      case 'health':
        return this.pPanel('Health record', 'shield',
          S('Medical',
            F('Blood group', h.bloodGroup) + F('Allergies', h.allergies) + F('Chronic condition', h.condition) + F('Dietary needs', h.diet)
          ) +
          S('Care',
            F('Immunisation', h.immunized ? 'Up to date' : 'Due') + F('Nurse visits', h.nurseVisits + ' this term') + F('Last check-up', h.lastCheckup) + F('Emergency contact', s.guardian)
          ),
          { badge: h.immunized ? '<span class="badge badge-success">Immunised</span>' : '<span class="badge badge-warning">Immunisation due</span>' }
        );

      case 'guardian':
        return this.pPanel('Guardian & contacts', 'user',
          S('Primary guardian',
            F('Full name', s.guardian, 'user') + F('Relationship', s.guardianRelation) + F('Mobile number', s.guardianPhone) + F('Home district', s.homeDistrict)
          ) +
          S('Enrolment',
            F('Admission date', s.admissionDate, 'calendar') + F('Student number', s.id) + F('Class', s.class) + F('Conduct', conduct)
          ) +
          `<div class="panel-foot" style="margin:0.5rem -0.875rem -0.875rem;border-radius:0 0 var(--radius-lg) var(--radius-lg)"><button class="btn btn-secondary btn-sm" onclick="App.showToast('SMS drafted to guardian')">${icon('communication')} Message guardian</button></div>`
        );

      case 'attendance': {
        const rate = s.attendanceRate;
        const present = Math.round(rate / 100 * 62);
        return `
          <div class="metric-grid">
            ${this.metricCard('Term attendance', rate, { icon: 'attendance', suffix: '%' })}
            ${this.metricCard('Days present', present, { icon: 'students', accent: 'blue', foot: '<span class="text-muted">of 62</span>' })}
            ${this.metricCard('Days absent', 62 - present, { icon: 'alert', accent: 'amber' })}
            ${this.metricCard('Standing', rate >= 90 ? 'Good' : rate >= 80 ? 'Fair' : 'Concern', { icon: 'shield', raw: true })}
          </div>
          <div class="panel"><div class="chart-body" style="text-align:center">${Charts.ring({ value: rate, label: rate + '%', size: 120 })}<p class="chart-cap">Term attendance rate</p></div></div>`;
      }

      case 'documents':
        return this.pPanel('Documents', 'audit',
          `<div class="panel-body-flush"><table><tbody>
            ${[['Birth certificate', 'Verified'], ['Previous report card', 'On file'], ['Medical form', s.health?.immunized ? 'Complete' : 'Pending'], ['Admission letter', 'On file'], ['Photo ID', 'On file']].map(([d, st]) =>
              `<tr><td>${icon('reportcards')} ${d}</td><td style="text-align:right"><span class="badge ${st === 'Pending' ? 'badge-warning' : 'badge-success'}">${st}</span></td></tr>`).join('')}
          </tbody></table></div>`,
          { edit: false, badge: `<button class="btn btn-secondary btn-sm" onclick="App.showToast('Upload — demo')">${icon('plus')} Upload</button>` }
        );

      default:
        return '';
    }
  },

  showStudentDetail(id) {
    const s = SKULPULSE.students.find(x => x.id === id);
    if (!s) return;
    const fee = SKULPULSE.feeRecords.find((f) => f.studentId === id);
    const series = this.studentSeries(s);
    const subjBars = s.subjects.map((x) => ({ label: x.name.slice(0, 4), value: x.current, color: Charts.scoreColor(x.current) }));
    document.getElementById('modal-title').textContent = s.name;
    document.getElementById('modal-body').innerHTML = `
      <div class="flex items-center gap-3" style="margin-bottom:0.875rem">
        <div class="avatar avatar-lg ${this.avatarClass(s.name)}">${this.initials(s.name)}</div>
        <div style="flex:1">
          <div class="font-medium">${s.class} · ${s.stream}</div>
          <div class="text-xs text-muted font-mono">${s.id} · ${s.lin}</div>
        </div>
        ${this.riskPill(s.riskLevel)}
      </div>
      <div class="tile-row" style="margin-bottom:0.875rem">
        <div class="tile"><div class="tv">${s.average}%</div><div class="tl">Average ${this.trendBadge(s.delta)}</div></div>
        <div class="tile"><div class="tv">${s.position}<span class="text-sm text-muted">/${s.classSize}</span></div><div class="tl">Class position</div></div>
        <div class="tile"><div class="tv">${s.attendanceRate}%</div><div class="tl">Attendance</div></div>
        <div class="tile"><div class="tv">${s.division}</div><div class="tl">Predicted</div></div>
      </div>
      <div class="text-xs font-medium text-muted" style="margin-bottom:0.25rem">Progress trajectory</div>
      ${Charts.line({ values: series, labels: ['Test 1', 'Test 2', 'Test 3'], width: 420, height: 140, min: Math.min(...series) - 8, max: Math.max(...series) + 8 })}
      <div class="text-xs font-medium text-muted" style="margin:0.75rem 0 0.25rem">Subject scores</div>
      ${Charts.bars({ data: subjBars, max: 100, height: 130, width: 420 })}
      <div class="grid grid-2 gap-4 text-sm" style="margin-top:0.875rem">
        <div><strong>Guardian:</strong> ${s.guardian}<br><strong>Phone:</strong> ${s.guardianPhone}<br><strong>Admitted:</strong> ${s.admissionDate}</div>
        <div><strong>Term fee:</strong> ${fee ? formatUGX(fee.termFee) : '—'}<br><strong>Balance:</strong> ${fee ? formatUGX(fee.balance) : '—'}<br><strong>Fee status:</strong> ${fee ? fee.status : '—'}</div>
      </div>`;
    document.getElementById('modal-backdrop').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-backdrop')?.classList.remove('open');
  },

  showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};
