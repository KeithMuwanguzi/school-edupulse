/**
 * EduPulse — Platform admin portal
 * Onboards schools, assigns modules, shares localStorage store with school demo.
 */

const AdminApp = {
  currentScreen: 'dashboard',
  selectedSchoolId: null,
  navGroupOpen: { system: false },
  onboardDraft: null,

  init() {
    EduStore.init();
    this.bindEvents();
    this.applyRouteFromUrl();
    this.renderNav();
    this.renderScreen(this.currentScreen);
  },

  bindEvents() {
    document.getElementById('admin-nav')?.addEventListener('click', (e) => {
      const groupToggle = e.target.closest('[data-nav-group-toggle]');
      if (groupToggle) {
        e.preventDefault();
        const id = groupToggle.dataset.navGroupToggle;
        this.navGroupOpen[id] = !this.navGroupOpen[id];
        document.querySelector(`[data-nav-group="${id}"]`)?.classList.toggle('collapsed', !this.navGroupOpen[id]);
        return;
      }
      const nav = e.target.closest('[data-screen]');
      if (nav?.dataset.screen) {
        e.preventDefault();
        this.navigate(nav.dataset.screen);
        document.querySelector('.sidebar')?.classList.remove('open');
      }
    });

    document.querySelector('.sidebar-toggle')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('open');
    });

    document.getElementById('admin-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('admin-modal-dismiss')?.addEventListener('click', () => this.closeModal());
    document.getElementById('admin-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'admin-modal-backdrop') this.closeModal();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === EduStore.STORAGE_KEY) {
        EduStore.init();
        this.renderScreen(this.currentScreen);
        this.showToast('Store updated from another tab');
      }
    });

    document.getElementById('admin-screen')?.addEventListener('click', (e) => {
      const openSchool = e.target.closest('[data-open-school]');
      if (openSchool) {
        e.preventDefault();
        this.openSchool(openSchool.dataset.openSchool);
        return;
      }
      const editModules = e.target.closest('[data-edit-modules]');
      if (editModules) {
        e.preventDefault();
        this.openSchool(editModules.dataset.editModules, 'modules');
        return;
      }
      const openPortal = e.target.closest('[data-open-portal]');
      if (openPortal) {
        e.preventDefault();
        this.openSchoolPortal(openPortal.dataset.openPortal);
        return;
      }
      const applyPreset = e.target.closest('[data-apply-preset]');
      if (applyPreset) {
        e.preventDefault();
        this.applyPreset(applyPreset.dataset.applyPreset);
        return;
      }
      if (e.target.id === 'save-school-modules') {
        e.preventDefault();
        this.saveSchoolModules();
      }
    });

    document.getElementById('admin-screen')?.addEventListener('change', (e) => {
      if (e.target.matches('[data-module-toggle]')) {
        this.onModuleToggleChange(e.target);
      }
      if (e.target.id === 'school-search') {
        this.renderSchools(e.target.value);
      }
    });

    document.getElementById('admin-screen')?.addEventListener('input', (e) => {
      if (e.target.closest('#onboard-form') || e.target.closest('#school-edit-form')) {
        this.updateLiveBillPreview(e.target.closest('form'));
      }
    });

    document.getElementById('admin-screen')?.addEventListener('submit', (e) => {
      if (e.target.id === 'onboard-form') {
        e.preventDefault();
        this.submitOnboard(e.target);
      }
      if (e.target.id === 'school-edit-form') {
        e.preventDefault();
        this.submitSchoolEdit(e.target);
      }
    });
  },

  applyRouteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school');
    const screen = params.get('screen');
    if (schoolId && EduStore.getSchool(schoolId)) {
      this.selectedSchoolId = schoolId;
      this.currentScreen = 'school-detail';
    } else if (screen) {
      this.currentScreen = screen;
    }
  },

  pushUrl() {
    const params = new URLSearchParams();
    if (this.currentScreen === 'school-detail' && this.selectedSchoolId) {
      params.set('school', this.selectedSchoolId);
    } else if (this.currentScreen !== 'dashboard') {
      params.set('screen', this.currentScreen);
    }
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  },

  navigate(screen, schoolId = null) {
    this.currentScreen = screen;
    if (schoolId) this.selectedSchoolId = schoolId;
    if (screen !== 'school-detail') this.selectedSchoolId = schoolId || this.selectedSchoolId;
    this.renderNav();
    this.renderScreen(screen);
    this.pushUrl();
  },

  openSchool(id, focus = null) {
    this.navigate('school-detail', id);
    if (focus === 'modules') {
      requestAnimationFrame(() => {
        document.querySelector('[data-module-picker="edit-modules"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  },

  openSchoolPortal(id) {
    EduStore.setActiveSchool(id);
    const school = EduStore.getSchool(id);
    const qs = school?.schoolCode ? `?code=${encodeURIComponent(school.schoolCode)}` : `?school=${encodeURIComponent(id)}`;
    window.open(`../prototype.html${qs}`, '_blank');
  },

  renderNav() {
    document.querySelectorAll('#admin-nav [data-screen]').forEach(el => {
      el.classList.toggle('active', el.dataset.screen === this.currentScreen ||
        (this.currentScreen === 'school-detail' && el.dataset.screen === 'schools'));
    });

    const titles = {
      dashboard: 'Dashboard',
      schools: 'Schools',
      onboard: 'Onboard school',
      'school-detail': 'School detail',
      billing: 'Billing',
      catalog: 'Module catalog',
      audit: 'Audit log',
      settings: 'Settings'
    };
    const bc = document.getElementById('admin-breadcrumb');
    if (bc) bc.innerHTML = `<strong>${titles[this.currentScreen] || 'Admin'}</strong>`;
  },

  renderScreen(screen) {
    const container = document.getElementById('admin-screen');
    if (!container) return;

    const renderers = {
      dashboard: () => this.renderDashboard(),
      schools: () => this.renderSchools(),
      onboard: () => this.renderOnboard(),
      'school-detail': () => this.renderSchoolDetail(this.selectedSchoolId),
      billing: () => this.renderBilling(),
      catalog: () => this.renderCatalog(),
      audit: () => this.renderAudit(),
      settings: () => this.renderSettings()
    };

    container.innerHTML = renderers[screen]?.() || '<p>Screen not found.</p>';
    container.querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = Icons[el.dataset.icon] || '';
    });
  },

  getSchools() {
    return EduStore.getSchools();
  },

  statusBadge(status) {
    const map = { active: 'success', trial: 'warning', suspended: 'danger', inactive: 'muted' };
    return `<span class="badge badge-${map[status] || 'muted'} badge-dot">${status}</span>`;
  },

  moduleCountLabel(subscribedModules) {
    const ids = resolveModuleIds(subscribedModules).filter(id => id !== 'core');
    return ids.length === EDUPULSE.modules.length - 1 ? 'All modules' : `${ids.length} modules`;
  },

  renderDashboard() {
    const schools = this.getSchools();
    const active = schools.filter(s => s.status === 'active').length;
    const trial = schools.filter(s => s.status === 'trial').length;
    const revenue = EduStore.getTotalTermRevenue();
    const audit = EduStore.getPlatformAudit(8);

    return `
      <div class="page-header">
        <div>
          <h1>Platform overview</h1>
          <p>Onboard schools and control which modules each tenant can access in the school portal.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" onclick="AdminApp.navigate('onboard')">Onboard school</button>
        </div>
      </div>

      <div class="kpi-strip">
        <div class="kpi-item"><div class="kpi-label">Schools</div><div class="kpi-value">${schools.length}</div><div class="kpi-meta">${active} active · ${trial} trial</div></div>
        <div class="kpi-item"><div class="kpi-label">Term revenue</div><div class="kpi-value">${formatUGX(revenue)}</div><div class="kpi-meta">Module + base fees</div></div>
        <div class="kpi-item"><div class="kpi-label">Catalog modules</div><div class="kpi-value">${EDUPULSE.modules.length}</div><div class="kpi-meta">Per-term pricing</div></div>
        <div class="kpi-item"><div class="kpi-label">Storage</div><div class="kpi-value">local</div><div class="kpi-meta">Shared with school demo</div></div>
      </div>

      ${typeof Charts !== 'undefined' ? `
      <div class="grid grid-2 gap-3" style="margin-top:0.875rem">
        <div class="panel">
          <div class="panel-head"><h3>Term revenue by school</h3><span class="text-xs text-muted">UGX millions</span></div>
          <div class="chart-body">${Charts.bars({
            data: schools.map((s) => ({ label: (s.schoolCode || s.name.slice(0, 5)), value: +(calculateTermBill(s.subscribedModules) / 1000000).toFixed(2) })),
            max: Math.max(...schools.map((s) => calculateTermBill(s.subscribedModules) / 1000000)), format: (v) => v + 'M'
          })}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Module adoption</h3><span class="text-xs text-muted">schools subscribed</span></div>
          <div class="chart-body">${Charts.hbars({
            data: EDUPULSE.modules.filter((m) => m.id !== 'core')
              .map((m) => ({ label: m.name.split(' ')[0], value: schools.filter((s) => resolveModuleIds(s.subscribedModules).includes(m.id)).length, color: Charts.scoreColor(60) }))
              .sort((a, b) => b.value - a.value).slice(0, 7),
            max: schools.length, format: (v) => v
          })}</div>
        </div>
      </div>` : ''}

      <div class="grid grid-2 gap-3" style="margin-top:0.875rem">
        <div class="panel">
          <div class="panel-head"><h3>Tenants</h3><button class="btn btn-ghost btn-sm" onclick="AdminApp.navigate('schools')">View all</button></div>
          <div class="panel-body panel-body-flush table-wrap">
            <table>
              <thead><tr><th>School</th><th>Modules</th><th>Term bill</th><th></th></tr></thead>
              <tbody>
                ${schools.map(s => `
                  <tr>
                    <td><div class="font-medium">${s.name}</div><div class="text-xs text-muted">${s.district || '—'}</div></td>
                    <td>${this.moduleCountLabel(s.subscribedModules)}</td>
                    <td>${formatUGX(calculateTermBill(s.subscribedModules))}</td>
                    <td class="text-right">
                      <button class="btn btn-ghost btn-sm" data-open-school="${s.id}">Manage</button>
                      <button class="btn btn-ghost btn-sm" data-edit-modules="${s.id}">Modules</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Recent activity</h3><button class="btn btn-ghost btn-sm" onclick="AdminApp.navigate('audit')">Full log</button></div>
          <div class="panel-body panel-body-flush">
            <table><tbody>
              ${audit.map(a => {
                const school = a.schoolId ? EduStore.getSchool(a.schoolId) : null;
                return `<tr><td><div class="text-sm">${a.action}</div><div class="text-xs text-muted">${a.time} · ${school ? school.name : 'Platform'}</div></td></tr>`;
              }).join('')}
            </tbody></table>
          </div>
        </div>
      </div>

      <div class="notice notice-brand" style="margin-top:0.875rem">
        <div class="notice-body">
          <div class="notice-title">How simulation works</div>
          <div class="notice-text">Changes here update <code>localStorage</code> immediately. Open the school portal with <strong>Open portal</strong> on any school — sidebar and module locks reflect that school's subscription.</div>
        </div>
      </div>`;
  },

  renderSchools(filter = '') {
    const q = filter.trim().toLowerCase();
    const schools = this.getSchools().filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.district?.toLowerCase().includes(q) || s.emisCode?.toLowerCase().includes(q)
    );

    return `
      <div class="page-header">
        <div><h1>Schools</h1><p>${this.getSchools().length} tenants · module access per school</p></div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" onclick="AdminApp.navigate('onboard')">Onboard school</button>
        </div>
      </div>

      <div class="toolbar" style="margin-bottom:0.75rem">
        <input type="search" id="school-search" class="input" placeholder="Search name, district, EMIS…" value="${filter.replace(/"/g, '&quot;')}" style="max-width:280px">
      </div>

      <div class="panel">
        <div class="panel-body panel-body-flush table-wrap">
          <table>
            <thead>
              <tr>
                <th>School</th>
                <th>Code</th>
                <th>Status</th>
                <th>Modules</th>
                <th>Term bill</th>
                <th>Onboarded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${schools.length ? schools.map(s => `
                <tr>
                  <td>
                    <div class="font-medium">${s.name}</div>
                    <div class="text-xs text-muted">${s.district || '—'} · ${s.level || ''}</div>
                  </td>
                  <td><code class="school-code-pill">${s.schoolCode || '—'}</code></td>
                  <td>${this.statusBadge(s.status)}</td>
                  <td>${this.moduleCountLabel(s.subscribedModules)}</td>
                  <td>${formatUGX(calculateTermBill(s.subscribedModules))}</td>
                  <td class="text-xs text-muted">${s.onboardedAt || '—'}</td>
                  <td class="text-right table-actions">
                    <button class="btn btn-ghost btn-sm" data-open-school="${s.id}">Manage</button>
                    <button class="btn btn-ghost btn-sm" data-edit-modules="${s.id}">Modules</button>
                    <button class="btn btn-secondary btn-sm" data-open-portal="${s.id}">Portal</button>
                  </td>
                </tr>`).join('') : '<tr><td colspan="7" class="text-muted text-sm">No schools match your search.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  renderOnboard() {
    const defaultModules = ['core', 'students', 'teachers', 'academics', 'assessment', 'attendance'];
    return `
      <div class="page-header">
        <div><h1>Onboard school</h1><p>Create a tenant and choose modules — the school portal will only show what you enable.</p></div>
      </div>

      <form id="onboard-form" class="grid grid-2 gap-3 onboard-layout">
        <div class="stack gap-3">
          <div class="panel">
            <div class="panel-head"><h3>School profile</h3></div>
            <div class="panel-body stack">
              <label class="field"><span class="field-label">School name *</span><input class="input" name="name" required placeholder="e.g. Bishop's SS Namirembe"></label>
              <label class="field"><span class="field-label">School code</span><input class="input" name="schoolCode" placeholder="Auto-generated if blank" autocapitalize="characters"><span class="text-xs text-muted">Unique login identifier — e.g. NAMIRE. Staff use this to sign in.</span></label>
              <label class="field"><span class="field-label">Motto</span><input class="input" name="motto" placeholder="Optional"></label>
              <div class="grid grid-2 gap-2">
                <label class="field"><span class="field-label">District</span><input class="input" name="district" placeholder="Kampala"></label>
                <label class="field"><span class="field-label">Region</span>
                  <select class="input" name="region">
                    <option>Central</option><option>Eastern</option><option>Northern</option><option>Western</option>
                  </select>
                </label>
              </div>
              <label class="field"><span class="field-label">Level</span>
                <select class="input" name="level">
                  <option>Secondary (O & A Level)</option>
                  <option>Primary</option>
                  <option>Mixed (P.1 – S.6)</option>
                </select>
              </label>
              <label class="field"><span class="field-label">EMIS code</span><input class="input" name="emisCode" placeholder="UPE-SEC-0000"></label>
              <div class="grid grid-2 gap-2">
                <label class="field"><span class="field-label">Phone</span><input class="input" name="phone" placeholder="+256 …"></label>
                <label class="field"><span class="field-label">Email</span><input class="input" name="email" type="email" placeholder="admin@school.ac.ug"></label>
              </div>
              <div class="grid grid-2 gap-2">
                <label class="field"><span class="field-label">Contact name</span><input class="input" name="contactName"></label>
                <label class="field"><span class="field-label">Contact phone</span><input class="input" name="contactPhone"></label>
              </div>
              <label class="field"><span class="field-label">Status</span>
                <select class="input" name="status">
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                </select>
              </label>
              <label class="field"><span class="field-label">Notes</span><textarea class="input" name="notes" rows="2" placeholder="Internal notes"></textarea></label>
            </div>
          </div>
        </div>

        <div class="stack gap-3">
          ${this.renderPresetBar()}
          ${this.renderModulePicker(defaultModules, 'onboard-modules')}
          <div class="panel bill-preview" id="live-bill-preview">
            ${this.renderBillPreview(defaultModules)}
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn btn-primary">Create school</button>
            <button type="button" class="btn btn-secondary" onclick="AdminApp.navigate('schools')">Cancel</button>
          </div>
        </div>
      </form>`;
  },

  renderPortalAccessPanel(school) {
    const users = EduStore.getUsersForSchool(school.id);
    return `
      <div class="panel">
        <div class="panel-head">
          <h3>Portal access</h3>
          <code class="school-code-pill">${school.schoolCode}</code>
        </div>
        <div class="panel-body">
          <p class="text-sm text-muted" style="margin-bottom:0.75rem">Sign-in is a single username <code>ID@${school.schoolCode}</code> — the role decides the portal. Parents use a student number. Production will hash passwords and issue accounts via invite.</p>
          <div class="table-wrap">
            <table class="text-sm">
              <thead><tr><th>Role</th><th>Name</th><th>Username</th><th>Password</th><th></th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>${PortalAuth.getRoleName(u.roleId)}${u.roleId === 'parent' ? '<div class="text-xs text-muted">student no.</div>' : ''}</td>
                    <td>${u.name}</td>
                    <td><code>${u.username}</code></td>
                    <td><code>${u.password}</code></td>
                    <td><a class="btn btn-ghost btn-sm" href="../prototype.html?u=${encodeURIComponent(u.username)}" target="_blank" rel="noopener">Login page</a></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  renderSchoolDetail(id) {
    const school = EduStore.getSchool(id);
    if (!school) {
      return `<div class="notice notice-danger"><div class="notice-body"><div class="notice-title">School not found</div><div class="notice-text"><button class="btn btn-secondary btn-sm" onclick="AdminApp.navigate('schools')">Back to schools</button></div></div></div>`;
    }

    const moduleIds = resolveModuleIds(school.subscribedModules);

    return `
      <div class="page-header">
        <div>
          <h1>${school.name}</h1>
          <p><code class="school-code-pill">${school.schoolCode}</code> · ${school.district || '—'} · ${school.level || ''} · ${this.statusBadge(school.status)}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" data-open-portal="${school.id}">Open school portal</button>
          <button class="btn btn-ghost btn-sm" onclick="AdminApp.navigate('schools')">Back</button>
        </div>
      </div>

      <div class="grid grid-2 gap-3 school-detail-layout">
        <div class="stack gap-3">
          <form id="school-edit-form" class="panel">
            <div class="panel-head"><h3>Profile</h3></div>
            <div class="panel-body stack">
              <input type="hidden" name="id" value="${school.id}">
              <label class="field"><span class="field-label">School name</span><input class="input" name="name" value="${this.esc(school.name)}" required></label>
              <label class="field"><span class="field-label">Motto</span><input class="input" name="motto" value="${this.esc(school.motto || '')}"></label>
              <div class="grid grid-2 gap-2">
                <label class="field"><span class="field-label">District</span><input class="input" name="district" value="${this.esc(school.district || '')}"></label>
                <label class="field"><span class="field-label">Region</span>
                  <select class="input" name="region">${['Central','Eastern','Northern','Western'].map(r =>
                    `<option ${school.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </label>
              </div>
              <label class="field"><span class="field-label">EMIS</span><input class="input" name="emisCode" value="${this.esc(school.emisCode || '')}"></label>
              <div class="grid grid-2 gap-2">
                <label class="field"><span class="field-label">Phone</span><input class="input" name="phone" value="${this.esc(school.phone || '')}"></label>
                <label class="field"><span class="field-label">Email</span><input class="input" name="email" value="${this.esc(school.email || '')}"></label>
              </div>
              <label class="field"><span class="field-label">Status</span>
                <select class="input" name="status">
                  ${['active','trial','suspended','inactive'].map(st =>
                    `<option value="${st}" ${school.status === st ? 'selected' : ''}>${st}</option>`).join('')}
                </select>
              </label>
              <label class="field"><span class="field-label">Notes</span><textarea class="input" name="notes" rows="2">${this.esc(school.notes || '')}</textarea></label>
              <button type="submit" class="btn btn-primary btn-sm">Save profile</button>
            </div>
          </form>

          ${this.renderPortalAccessPanel(school)}

          <div class="panel">
            <div class="panel-head"><h3>Danger zone</h3></div>
            <div class="panel-body stack">
              <button type="button" class="btn btn-danger btn-sm" onclick="AdminApp.confirmDeleteSchool('${school.id}')" ${this.getSchools().length <= 1 ? 'disabled' : ''}>Delete school</button>
            </div>
          </div>
        </div>

        <div class="stack gap-3">
          ${this.renderPresetBar()}
          ${this.renderModulePicker(moduleIds, 'edit-modules')}
          <div class="panel bill-preview" id="live-bill-preview">
            ${this.renderBillPreview(moduleIds)}
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="save-school-modules">Save modules</button>
          <p class="text-xs text-muted">Toggles save immediately · use Save to refresh after external changes</p>
          <div class="notice notice-brand">
            <div class="notice-body">
              <div class="notice-text text-sm">Portal URL: <code>prototype.html?code=${school.schoolCode}</code> — users sign in with school code + email + password.</div>
            </div>
          </div>
        </div>
      </div>`;
  },

  renderBilling() {
    const schools = this.getSchools();
    const total = EduStore.getTotalTermRevenue();
    const base = EDUPULSE.billing.platformBaseFee * schools.length;

    return `
      <div class="page-header">
        <div><h1>Term billing</h1><p>Module-based invoices per school · no student-count fees</p></div>
      </div>

      <div class="kpi-strip">
        <div class="kpi-item"><div class="kpi-label">Total this term</div><div class="kpi-value">${formatUGX(total)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Platform base</div><div class="kpi-value">${formatUGX(base)}</div><div class="kpi-meta">${schools.length} × ${formatUGX(EDUPULSE.billing.platformBaseFee)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Module fees</div><div class="kpi-value">${formatUGX(total - base)}</div></div>
      </div>

      <div class="panel" style="margin-top:0.875rem">
        <div class="panel-head"><h3>Invoices by school</h3></div>
        <div class="panel-body panel-body-flush table-wrap">
          <table>
            <thead><tr><th>School</th><th>Status</th><th>Line items</th><th>Total</th><th></th></tr></thead>
            <tbody>
              ${schools.map(s => {
                const breakdown = getModuleBreakdown(s.subscribedModules);
                return `<tr>
                  <td><div class="font-medium">${s.name}</div></td>
                  <td>${this.statusBadge(s.status)}</td>
                  <td class="text-xs text-muted">${breakdown.modules.length} modules + base</td>
                  <td>${formatUGX(breakdown.total)}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="AdminApp.showInvoice('${s.id}')">View</button>
                    <button class="btn btn-ghost btn-sm" data-edit-modules="${s.id}">Edit modules</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  renderCatalog() {
    const categories = [...new Set(EDUPULSE.modules.map(m => m.category))];
    return `
      <div class="page-header">
        <div><h1>Module catalog</h1><p>Reference pricing — assign via school onboarding or detail screens</p></div>
      </div>
      ${categories.map(cat => `
        <div class="panel" style="margin-bottom:0.75rem">
          <div class="panel-head"><h3>${cat}</h3><span class="text-xs text-muted">Per term · UGX</span></div>
          <div class="panel-body">
            <div class="module-grid">
              ${EDUPULSE.modules.filter(m => m.category === cat).map(m => `
                <div class="module-tile">
                  <div class="module-tile-head"><h4>${m.name}</h4><span class="badge badge-muted">${m.id}</span></div>
                  <p>${m.description}</p>
                  <div class="module-tile-price">${m.price ? formatUGX(m.price) : 'Included with base'}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>`).join('')}`;
  },

  renderAudit() {
    const entries = EduStore.getPlatformAudit(100);
    return `
      <div class="page-header">
        <div><h1>Platform audit log</h1><p>Onboarding, module changes, and admin actions</p></div>
      </div>
      <div class="panel">
        <div class="panel-body panel-body-flush table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Actor</th><th>School</th><th>Action</th></tr></thead>
            <tbody>
              ${entries.map(a => {
                const school = a.schoolId ? EduStore.getSchool(a.schoolId) : null;
                return `<tr>
                  <td class="text-xs text-muted">${a.time}</td>
                  <td>${a.actor}</td>
                  <td>${school ? school.name : '—'}</td>
                  <td>${a.action}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  renderSettings() {
    return `
      <div class="page-header">
        <div><h1>Settings</h1><p>Prototype data controls</p></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Demo data</h3></div>
        <div class="panel-body stack">
          <p class="text-sm text-muted">Reset restores four seed schools (SMACK, Gayaza, Mengo, Namilyango) with their original module sets. This clears custom onboarded schools.</p>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.confirmReset()">Reset to seed data</button>
        </div>
      </div>
      <div class="panel" style="margin-top:0.75rem">
        <div class="panel-head"><h3>Store</h3></div>
        <div class="panel-body">
          <p class="text-sm"><strong>Key:</strong> <code>${EduStore.STORAGE_KEY}</code></p>
          <p class="text-sm text-muted" style="margin-top:0.5rem">School portal reads the same key. Use two browser tabs — admin + prototype — to simulate platform vs school views.</p>
        </div>
      </div>`;
  },

  renderPresetBar() {
    const presets = EduStore.getModulePresets();
    return `
      <div class="panel panel-compact">
        <div class="panel-head"><h3>Quick presets</h3></div>
        <div class="panel-body preset-bar">
          ${presets.map(p => `
            <button type="button" class="btn btn-secondary btn-sm" data-apply-preset="${p.id}" title="${this.esc(p.description)}">${p.name}</button>
          `).join('')}
          <button type="button" class="btn btn-ghost btn-sm" data-apply-preset="all">All modules</button>
        </div>
      </div>`;
  },

  renderModulePicker(selectedIds, groupName) {
    const selected = new Set(resolveModuleIds(selectedIds));
    const byCategory = {};
    EDUPULSE.modules.forEach(m => {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(m);
    });

    return `
      <div class="panel" data-module-picker="${groupName}">
        <div class="panel-head">
          <h3>Module subscription</h3>
          <span class="text-xs text-muted">Core is always on · click to toggle</span>
        </div>
        <div class="panel-body module-picker-body">
          ${Object.entries(byCategory).map(([cat, mods]) => `
            <div class="module-picker-category">
              <div class="module-picker-cat-label">${cat}</div>
              <div class="module-picker-grid">
                ${mods.map(m => {
                  const checked = selected.has(m.id);
                  const disabled = m.id === 'core';
                  return `
                    <label class="module-picker-card ${checked ? 'selected' : ''} ${disabled ? 'locked' : ''}">
                      <input type="checkbox" data-module-toggle data-module-id="${m.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
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

  renderBillPreview(moduleIds) {
    const breakdown = getModuleBreakdown(moduleIds);
    return `
      <div class="panel-head"><h3>Term estimate</h3><span class="font-medium">${formatUGX(breakdown.total)}</span></div>
      <div class="panel-body panel-body-flush">
        <table class="text-sm">
          <tbody>
            <tr><td>Platform base fee</td><td class="text-right">${formatUGX(EDUPULSE.billing.platformBaseFee)}</td></tr>
            ${breakdown.modules.filter(m => m.id !== 'core').map(m =>
              `<tr><td>${m.name}</td><td class="text-right">${formatUGX(m.price)}</td></tr>`
            ).join('')}
            <tr class="bill-total-row"><td><strong>Total per term</strong></td><td class="text-right"><strong>${formatUGX(breakdown.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>`;
  },

  getSelectedModulesFromPicker(picker = null) {
    const el = picker || document.querySelector('[data-module-picker]');
    if (!el) return ['core'];
    const boxes = el.querySelectorAll('[data-module-toggle]:checked');
    const ids = Array.from(boxes).map(b => b.dataset.moduleId);
    return resolveModuleIds(ids.length ? ids : ['core']);
  },

  getSelectedModulesFromForm(form) {
    if (!form) return this.getSelectedModulesFromPicker();
    return this.getSelectedModulesFromPicker(form.querySelector('[data-module-picker]'));
  },

  getActiveModulePickerName() {
    if (this.currentScreen === 'school-detail') return 'edit-modules';
    if (this.currentScreen === 'onboard') return 'onboard-modules';
    return null;
  },

  getActiveModulePicker() {
    const name = this.getActiveModulePickerName();
    return name
      ? document.querySelector(`[data-module-picker="${name}"]`)
      : document.querySelector('[data-module-picker]');
  },

  updateLiveBillPreview(pickerOrForm) {
    const preview = document.getElementById('live-bill-preview');
    if (!preview) return;

    let picker = null;
    if (pickerOrForm?.matches?.('[data-module-picker]')) picker = pickerOrForm;
    else if (pickerOrForm?.querySelector) picker = pickerOrForm.querySelector('[data-module-picker]');
    else picker = this.getActiveModulePicker();

    preview.innerHTML = this.renderBillPreview(this.getSelectedModulesFromPicker(picker));
  },

  onModuleToggleChange(input) {
    const picker = input.closest('[data-module-picker]');
    const card = input.closest('.module-picker-card');
    card?.classList.toggle('selected', input.checked);
    this.updateLiveBillPreview(picker);

    if (this.currentScreen === 'school-detail' && this.selectedSchoolId) {
      const ids = this.getSelectedModulesFromPicker(picker);
      EduStore.setSchoolModules(this.selectedSchoolId, ids, 'Platform Admin');
      this.showToast('Modules saved');
    }
  },

  applyPreset(presetId) {
    let modules;
    if (presetId === 'all') {
      modules = EDUPULSE.modules.map(m => m.id);
    } else {
      const preset = EDUPULSE.exampleModuleSets.find(p => p.id === presetId);
      modules = preset ? preset.modules : ['core'];
    }

    const picker = this.getActiveModulePicker();
    if (!picker) return;

    picker.querySelectorAll('[data-module-toggle]').forEach(box => {
      if (box.dataset.moduleId === 'core') return;
      box.checked = modules.includes(box.dataset.moduleId);
      box.closest('.module-picker-card')?.classList.toggle('selected', box.checked);
    });

    this.updateLiveBillPreview(picker);

    if (this.currentScreen === 'school-detail' && this.selectedSchoolId) {
      EduStore.setSchoolModules(this.selectedSchoolId, modules, 'Platform Admin');
      this.showToast('Preset applied and saved');
    } else if (this.currentScreen === 'onboard') {
      this.showToast('Preset applied');
    }
  },

  saveSchoolModules() {
    if (!this.selectedSchoolId) return;
    const picker = this.getActiveModulePicker();
    const ids = this.getSelectedModulesFromPicker(picker);
    EduStore.setSchoolModules(this.selectedSchoolId, ids, 'Platform Admin');
    this.showToast('Modules saved');
    this.renderScreen('school-detail');
  },

  submitOnboard(form) {
    const fd = new FormData(form);
    const modules = this.getSelectedModulesFromForm(form);
    const result = EduStore.createSchool({
      name: fd.get('name'),
      schoolCode: fd.get('schoolCode'),
      motto: fd.get('motto'),
      district: fd.get('district'),
      region: fd.get('region'),
      level: fd.get('level'),
      emisCode: fd.get('emisCode'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      contactName: fd.get('contactName'),
      contactPhone: fd.get('contactPhone'),
      status: fd.get('status'),
      notes: fd.get('notes'),
      subscribedModules: modules
    });

    if (result?.error) {
      this.showToast(result.message);
      return;
    }

    const { school, adminUser } = result;
    this.showToast(`${school.name} onboarded · code ${school.schoolCode}`);
    this.openModal('School created — portal credentials', `
      <p class="text-sm text-muted">Share the admin username and password. Five demo accounts were created (admin, deputy, teacher, bursar, parent) — each signs in with a single <code>ID@${school.schoolCode}</code> username.</p>
      <div class="kpi-strip" style="margin:0.75rem 0">
        <div class="kpi-item"><div class="kpi-label">School code</div><div class="kpi-value" style="font-size:var(--text-lg)"><code>${school.schoolCode}</code></div></div>
        <div class="kpi-item"><div class="kpi-label">Admin username</div><div class="kpi-value" style="font-size:var(--text-sm)"><code>${adminUser.username}</code></div></div>
        <div class="kpi-item"><div class="kpi-label">Password</div><div class="kpi-value" style="font-size:var(--text-sm)"><code>${adminUser.password}</code></div></div>
      </div>
      <a class="btn btn-primary btn-sm" href="../prototype.html?u=${encodeURIComponent(adminUser.username)}" target="_blank" rel="noopener">Open login page</a>
    `);
    this.openSchool(school.id);
  },

  submitSchoolEdit(form) {
    const fd = new FormData(form);
    const id = fd.get('id');
    EduStore.updateSchool(id, {
      name: fd.get('name'),
      motto: fd.get('motto'),
      district: fd.get('district'),
      region: fd.get('region'),
      emisCode: fd.get('emisCode'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      status: fd.get('status'),
      notes: fd.get('notes')
    });
    this.showToast('Profile saved');
    this.renderScreen('school-detail');
    this.renderNav();
  },

  confirmDeleteSchool(id) {
    const school = EduStore.getSchool(id);
    if (!school) return;
    if (confirm(`Delete ${school.name}? This cannot be undone.`)) {
      if (EduStore.deleteSchool(id)) {
        this.showToast('School removed');
        this.navigate('schools');
      } else {
        this.showToast('Cannot delete the last school');
      }
    }
  },

  confirmReset() {
    if (confirm('Reset all schools to seed data? Custom schools will be lost.')) {
      EduStore.resetToSeed();
      this.selectedSchoolId = null;
      this.showToast('Seed data restored');
      this.navigate('dashboard');
    }
  },

  showInvoice(schoolId) {
    const school = EduStore.getSchool(schoolId);
    if (!school) return;
    const breakdown = getModuleBreakdown(school.subscribedModules);
    this.openModal(`${school.name} — Term invoice`, `
      <p class="text-sm text-muted" style="margin-bottom:0.75rem">${school.district} · ${school.status}</p>
      <table class="text-sm" style="width:100%">
        <tbody>
          <tr><td>Platform base</td><td class="text-right">${formatUGX(EDUPULSE.billing.platformBaseFee)}</td></tr>
          ${breakdown.modules.filter(m => m.id !== 'core').map(m =>
            `<tr><td>${m.name}</td><td class="text-right">${formatUGX(m.price)}</td></tr>`
          ).join('')}
          <tr><td><strong>Total</strong></td><td class="text-right"><strong>${formatUGX(breakdown.total)}</strong></td></tr>
        </tbody>
      </table>`);
  },

  openModal(title, body, footerHtml) {
    document.getElementById('admin-modal-title').textContent = title;
    document.getElementById('admin-modal-body').innerHTML = body;
    const foot = document.getElementById('admin-modal-footer');
    if (footerHtml !== undefined) foot.innerHTML = footerHtml;
    document.getElementById('admin-modal-backdrop').classList.add('open');
  },

  closeModal() {
    document.getElementById('admin-modal-backdrop')?.classList.remove('open');
  },

  showToast(message, duration = 2800) {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }
};
