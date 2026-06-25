/**
 * SkulPulse — Shared client store (localStorage)
 * Single source of truth for schools and module subscriptions.
 * Both /admin and /prototype read and write through here.
 */

const SkulStore = {
  STORAGE_KEY: 'skulpulse_store_v1',

  SEED_SCHOOLS: [
    {
      id: 'sch-001',
      name: "St. Mary's College Kisubi",
      motto: 'Da Pacem Domine',
      district: 'Wakiso',
      region: 'Central',
      level: 'Secondary (O & A Level)',
      emisCode: 'UPE-SEC-2847',
      phone: '+256 414 123 456',
      email: 'admin@smack.ac.ug',
      contactName: 'Okello James',
      contactPhone: '+256 772 100 001',
      billingModel: 'module-based',
      subscribedModules: ['core', 'students', 'teachers', 'academics', 'assessment', 'reportcards', 'attendance', 'finance', 'communication', 'ai-analytics', 'admissions', 'timetable'],
      status: 'active',
      onboardedAt: '2023-02-01',
      notes: 'Flagship secondary — full module stack except add-ons.',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      academicCalendar: 'uganda-3-term',
      schoolCode: 'SMACK'
    },
    {
      id: 'sch-002',
      name: 'Gayaza High School',
      motto: 'Never Give Up',
      district: 'Wakiso',
      region: 'Central',
      level: 'Secondary (O & A Level)',
      emisCode: 'UPE-SEC-1102',
      phone: '+256 414 222 333',
      email: 'admin@gayaza.ac.ug',
      contactName: 'Head Teacher Office',
      contactPhone: '+256 701 222 333',
      billingModel: 'module-based',
      subscribedModules: 'all',
      status: 'active',
      onboardedAt: '2022-08-10',
      notes: 'Enterprise-style — all catalog modules enabled.',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      academicCalendar: 'uganda-3-term',
      schoolCode: 'GAYAZA'
    },
    {
      id: 'sch-003',
      name: 'Mengo Senior School',
      motto: 'Education for Service',
      district: 'Kampala',
      region: 'Central',
      level: 'Secondary (O & A Level)',
      emisCode: 'UPE-SEC-0891',
      phone: '+256 414 333 444',
      email: 'info@mengoss.ac.ug',
      contactName: 'Sarah Nambi',
      contactPhone: '+256 782 333 444',
      billingModel: 'module-based',
      subscribedModules: ['core', 'students', 'teachers', 'academics', 'assessment', 'attendance'],
      status: 'active',
      onboardedAt: '2024-01-15',
      notes: 'Academic core only — upsell finance & reports next term.',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      academicCalendar: 'uganda-3-term',
      schoolCode: 'MENGO'
    },
    {
      id: 'sch-004',
      name: 'Namilyango College',
      motto: 'Unity and Progress',
      district: 'Mukono',
      region: 'Central',
      level: 'Secondary (O & A Level)',
      emisCode: 'UPE-SEC-0456',
      phone: '+256 414 555 666',
      email: 'bursar@namilyango.sc.ug',
      contactName: 'David Ssebunya',
      contactPhone: '+256 756 555 666',
      billingModel: 'module-based',
      subscribedModules: ['core', 'students', 'teachers', 'academics', 'assessment', 'reportcards', 'attendance', 'finance', 'communication', 'admissions', 'timetable'],
      status: 'trial',
      onboardedAt: '2025-05-01',
      notes: 'Trial ends Term 2 — pending AI module decision.',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      academicCalendar: 'uganda-3-term',
      schoolCode: 'NAMLNG'
    }
  ],

  /** Default portal accounts per role — password pattern: {SCHOOLCODE}@{suffix} */
  USER_ROLE_TEMPLATES: [
    { key: 'admin', roleId: 'school-admin', emailLocal: 'admin', label: 'Administrator' },
    { key: 'deputy', roleId: 'deputy-head', emailLocal: 'deputy', label: 'Deputy head' },
    { key: 'teacher', roleId: 'teacher', emailLocal: 'teacher', label: 'Teacher' },
    { key: 'bursar', roleId: 'bursar', emailLocal: 'bursar', label: 'Bursar' },
    { key: 'parent', roleId: 'parent', emailLocal: 'parent', label: 'Parent' }
  ],

  /** Realistic names/emails for seed schools (prototype demo) */
  SEED_USER_PROFILES: {
    'sch-001': {
      admin: { name: 'Okello James', email: 'admin@smack.ac.ug', password: 'SMACK@admin' },
      deputy: { name: 'Mrs. Apio Christine', email: 'deputy@smack.ac.ug', password: 'SMACK@deputy' },
      teacher: { name: 'Dr. Nsubuga Emmanuel', email: 'e.nsubuga@smack.ac.ug', password: 'SMACK@teacher' },
      bursar: { name: 'Namuli Sarah', email: 'bursar@smack.ac.ug', password: 'SMACK@bursar' },
      parent: { name: 'Namukasa James', email: 'parent@smack.ac.ug', password: 'SMACK@parent' }
    },
    'sch-002': {
      admin: { name: 'Head Teacher Office', email: 'admin@gayaza.ac.ug', password: 'GAYAZA@admin' },
      deputy: { name: 'Ms. Nabukeera Ruth', email: 'deputy@gayaza.ac.ug', password: 'GAYAZA@deputy' },
      teacher: { name: 'Mrs. Kizza Prossy', email: 'teacher@gayaza.ac.ug', password: 'GAYAZA@teacher' },
      bursar: { name: 'Finance Office', email: 'bursar@gayaza.ac.ug', password: 'GAYAZA@bursar' },
      parent: { name: 'Guardian Account', email: 'parent@gayaza.ac.ug', password: 'GAYAZA@parent' }
    },
    'sch-003': {
      admin: { name: 'Sarah Nambi', email: 'admin@mengoss.ac.ug', password: 'MENGO@admin' },
      deputy: { name: 'Mr. Ssebunya David', email: 'deputy@mengoss.ac.ug', password: 'MENGO@deputy' },
      teacher: { name: 'Ms. Akello Grace', email: 'teacher@mengoss.ac.ug', password: 'MENGO@teacher' },
      bursar: { name: 'Office Bursar', email: 'bursar@mengoss.ac.ug', password: 'MENGO@bursar' },
      parent: { name: 'Parent Demo', email: 'parent@mengoss.ac.ug', password: 'MENGO@parent' }
    },
    'sch-004': {
      admin: { name: 'David Ssebunya', email: 'bursar@namilyango.sc.ug', password: 'NAMLNG@admin' },
      deputy: { name: 'Rev. Fr. Housemaster', email: 'deputy@namilyango.sc.ug', password: 'NAMLNG@deputy' },
      teacher: { name: 'Mr. Okello Peter', email: 'teacher@namilyango.sc.ug', password: 'NAMLNG@teacher' },
      bursar: { name: 'Accounts Office', email: 'accounts@namilyango.sc.ug', password: 'NAMLNG@bursar' },
      parent: { name: 'Old Boy Parent', email: 'parent@namilyango.sc.ug', password: 'NAMLNG@parent' }
    }
  },

  _state: null,

  init() {
    const saved = this._load();
    if (saved && saved.schools?.length) {
      this._state = saved;
      this._migrate();
    } else {
      this._state = this._createSeedState();
      this._persist();
    }
    this._applyUrlSchool();
    this.syncToSkulpulse();
    return this._state;
  },

  _migrate() {
    let changed = false;
    if (!this._state.version || this._state.version < 2) {
      this._state.version = 2;
      changed = true;
    }
    this._state.schools.forEach(s => {
      if (!s.schoolCode) {
        s.schoolCode = this._deriveSchoolCode(s.name, s.id);
        changed = true;
      }
    });
    if (!this._state.users?.length) {
      this._state.users = this.buildAllSeedUsers(this._state.schools);
      changed = true;
    }
    // Backfill username login identity for stores seeded before v3.
    if (this._state.version < 3) {
      (this._state.users || []).forEach(u => {
        const code = u.schoolCode || this.getSchool(u.schoolId)?.schoolCode || 'SCHOOL';
        if (!u.loginId) u.loginId = this.loginIdFor(u.roleId, code);
        u.username = `${u.loginId}@${code}`;
      });
      this._state.version = 3;
      changed = true;
    }
    if (changed) this._persist();
  },

  _createSeedState() {
    const schools = JSON.parse(JSON.stringify(this.SEED_SCHOOLS));
    return {
      version: 3,
      activeSchoolId: 'sch-001',
      schools,
      users: this.buildAllSeedUsers(schools),
      platformAudit: [
        { id: 'pa-1', time: '2025-06-13 08:00', actor: 'Platform Admin', schoolId: null, action: 'Store initialized from seed data' },
        { id: 'pa-2', time: '2025-06-12 14:30', actor: 'Platform Admin', schoolId: 'sch-004', action: 'Onboarded Namilyango College (trial)' },
        { id: 'pa-3', time: '2025-06-10 11:00', actor: 'Platform Admin', schoolId: 'sch-001', action: 'Added AI Analytics module' }
      ]
    };
  },

  _load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  _persist() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._state));
    this.syncToSkulpulse();
  },

  _applyUrlSchool() {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school');
    if (schoolId && this.getSchool(schoolId)) {
      this._state.activeSchoolId = schoolId;
      this._persist();
    }
  },

  _deriveSchoolCode(name, schoolId) {
    const seed = this.SEED_SCHOOLS.find(s => s.id === schoolId);
    if (seed?.schoolCode) return seed.schoolCode;
    let base = (name || 'SCHOOL').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase() || 'SCHOOL';
    let code = base;
    let n = 1;
    while (this._state?.schools?.some(s => s.schoolCode === code && s.id !== schoolId)) {
      code = `${base}${n++}`;
    }
    return code;
  },

  _generateSchoolCode(name) {
    let base = (name || 'SCHOOL').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase() || 'SCHOOL';
    let code = base;
    let n = 1;
    while (this._state.schools.some(s => s.schoolCode === code)) {
      code = `${base}${n++}`;
    }
    return code;
  },

  _emailDomain(school) {
    if (school.email?.includes('@')) return school.email.split('@')[1];
    return `${school.schoolCode.toLowerCase()}.school.ug`;
  },

  buildAllSeedUsers(schools) {
    const list = schools || this._state?.schools || this.SEED_SCHOOLS;
    return list.flatMap(s => this.buildDefaultUsers(s));
  },

  /** Fixed staff login numbers; parents log in with a student number. */
  STAFF_LOGIN_IDS: { 'school-admin': '0001', 'deputy-head': '0002', teacher: '0003', bursar: '0004' },

  /** Deterministic 7-digit "student number" used as a parent's login id. */
  _parentLoginId(code) {
    let h = 0;
    for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
    return String(2200000 + (h % 700000));
  },

  /** Resolve the login id (before the @) for a user role within a school. */
  loginIdFor(roleId, code) {
    return this.STAFF_LOGIN_IDS[roleId] || this._parentLoginId(code);
  },

  buildDefaultUsers(school, profileOverrides = null) {
    const code = school.schoolCode || this._deriveSchoolCode(school.name, school.id);
    const domain = this._emailDomain({ ...school, schoolCode: code });
    const overrides = profileOverrides || this.SEED_USER_PROFILES[school.id] || {};

    return this.USER_ROLE_TEMPLATES.map(t => {
      const custom = overrides[t.key] || {};
      const email = custom.email || `${t.emailLocal}@${domain}`;
      const loginId = custom.loginId || this.loginIdFor(t.roleId, code);
      return {
        id: `usr-${school.id}-${t.roleId}`,
        schoolId: school.id,
        schoolCode: code,
        loginId,
        username: `${loginId}@${code}`,
        email,
        password: custom.password || `${code}@${t.key}`,
        roleId: t.roleId,
        name: custom.name || `${school.name} ${t.label}`,
        status: 'active',
        createdAt: school.onboardedAt || new Date().toISOString().slice(0, 10),
        lastLoginAt: null
      };
    });
  },

  getSchoolByCode(schoolCode) {
    const code = (schoolCode || '').trim().toUpperCase();
    return this._state.schools.find(s => s.schoolCode?.toUpperCase() === code) || null;
  },

  getUsers() {
    return [...(this._state.users || [])];
  },

  getUser(id) {
    return this._state.users?.find(u => u.id === id) || null;
  },

  getUsersForSchool(schoolId) {
    return this.getUsers().filter(u => u.schoolId === schoolId);
  },

  authenticate(schoolCode, email, password) {
    const school = this.getSchoolByCode(schoolCode);
    if (!school) {
      return { ok: false, error: 'INVALID_SCHOOL', message: 'School code not recognized. Check with your administrator.' };
    }
    if (school.status === 'suspended' || school.status === 'inactive') {
      return { ok: false, error: 'SCHOOL_INACTIVE', message: 'This school portal is not active. Contact SkulPulse support.' };
    }

    const emailNorm = (email || '').trim().toLowerCase();
    const user = this._state.users.find(u =>
      u.schoolId === school.id &&
      u.email.toLowerCase() === emailNorm &&
      u.status === 'active'
    );

    if (!user || user.password !== password) {
      return { ok: false, error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' };
    }

    user.lastLoginAt = new Date().toISOString();
    this._state.activeSchoolId = school.id;
    this._audit(`Signed in (${user.roleId})`, school.id, user.name);
    this._persist();

    return {
      ok: true,
      session: {
        userId: user.id,
        schoolId: school.id,
        schoolCode: school.schoolCode,
        roleId: user.roleId,
        name: user.name,
        email: user.email,
        issuedAt: Date.now()
      },
      user,
      school
    };
  },

  /**
   * Single-field login: username is `ID@SCHOOLCODE`.
   * The school comes from the code, the role from the matched account —
   * so the portal routes itself (parents land on the parent portal, etc.).
   */
  authenticateByUsername(username, password) {
    const raw = String(username || '').trim();
    const at = raw.lastIndexOf('@');
    if (at < 1 || at === raw.length - 1) {
      return { ok: false, error: 'INVALID_FORMAT', message: 'Use the format ID@SCHOOLCODE — e.g. 0001@GAYAZA.' };
    }
    const idPart = raw.slice(0, at).trim();
    const code = raw.slice(at + 1).trim();

    const school = this.getSchoolByCode(code);
    if (!school) {
      return { ok: false, error: 'INVALID_SCHOOL', message: `School "${code}" not recognised. Check the part after the @.` };
    }
    if (school.status === 'suspended' || school.status === 'inactive') {
      return { ok: false, error: 'SCHOOL_INACTIVE', message: 'This school portal is not active. Contact SkulPulse support.' };
    }

    const user = this._state.users.find(u =>
      u.schoolId === school.id &&
      (u.loginId || '').toLowerCase() === idPart.toLowerCase() &&
      u.status === 'active'
    );

    if (!user || user.password !== password) {
      return { ok: false, error: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect.' };
    }

    user.lastLoginAt = new Date().toISOString();
    this._state.activeSchoolId = school.id;
    this._audit(`Signed in (${user.roleId})`, school.id, user.name);
    this._persist();

    return {
      ok: true,
      session: {
        userId: user.id,
        schoolId: school.id,
        schoolCode: school.schoolCode,
        roleId: user.roleId,
        name: user.name,
        email: user.email,
        username: user.username || `${user.loginId}@${school.schoolCode}`,
        loginId: user.loginId,
        issuedAt: Date.now()
      },
      user,
      school
    };
  },

  _normalizeModules(moduleIds) {
    let ids = moduleIds === 'all'
      ? SKULPULSE.modules.map(m => m.id)
      : Array.isArray(moduleIds) ? [...moduleIds] : [];
    if (!ids.includes('core')) ids.unshift('core');
    return [...new Set(ids)];
  },

  _nextSchoolId() {
    const nums = this._state.schools
      .map(s => parseInt(s.id.replace('sch-', ''), 10))
      .filter(n => !isNaN(n));
    const next = (Math.max(0, ...nums) + 1).toString().padStart(3, '0');
    return `sch-${next}`;
  },

  _audit(action, schoolId = null, actor = 'Platform Admin') {
    const entry = {
      id: `pa-${Date.now()}`,
      time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor,
      schoolId,
      action
    };
    this._state.platformAudit.unshift(entry);
    if (this._state.platformAudit.length > 100) this._state.platformAudit.pop();
  },

  syncToSkulpulse() {
    if (typeof SKULPULSE === 'undefined') return;
    const active = this.getActiveSchool();
    if (active) {
      SKULPULSE.school = { ...active, subscribedModules: this._normalizeModules(active.subscribedModules) };
    }
    SKULPULSE.platformSchools = this._state.schools.map(s => ({
      id: s.id,
      name: s.name,
      district: s.district,
      subscribedModules: s.subscribedModules,
      status: s.status
    }));
  },

  getState() { return this._state; },

  getSchools() { return [...this._state.schools]; },

  getSchool(id) {
    return this._state.schools.find(s => s.id === id) || null;
  },

  getActiveSchoolId() { return this._state.activeSchoolId; },

  getActiveSchool() {
    return this.getSchool(this._state.activeSchoolId) || this._state.schools[0] || null;
  },

  setActiveSchool(id) {
    if (!this.getSchool(id)) return false;
    this._state.activeSchoolId = id;
    this._persist();
    return true;
  },

  createSchool(payload) {
    const id = this._nextSchoolId();
    const schoolCode = (payload.schoolCode?.trim().toUpperCase()) || this._generateSchoolCode(payload.name);
    if (this.getSchoolByCode(schoolCode)) {
      return { error: 'DUPLICATE_CODE', message: 'School code already in use.' };
    }

    const school = {
      id,
      name: payload.name?.trim() || 'New School',
      motto: payload.motto?.trim() || '',
      district: payload.district?.trim() || '',
      region: payload.region || 'Central',
      level: payload.level || 'Secondary (O & A Level)',
      emisCode: payload.emisCode?.trim() || '',
      phone: payload.phone?.trim() || '',
      email: payload.email?.trim() || '',
      contactName: payload.contactName?.trim() || '',
      contactPhone: payload.contactPhone?.trim() || '',
      billingModel: 'module-based',
      subscribedModules: this._normalizeModules(payload.subscribedModules || ['core']),
      status: payload.status || 'trial',
      onboardedAt: new Date().toISOString().slice(0, 10),
      notes: payload.notes?.trim() || '',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      academicCalendar: 'uganda-3-term',
      schoolCode
    };

    const adminProfile = {
      admin: {
        name: payload.contactName?.trim() || `${school.name} Administrator`,
        email: payload.adminEmail?.trim() || payload.email?.trim() || `admin@${this._emailDomain(school)}`,
        password: payload.adminPassword || `${schoolCode}@admin`
      }
    };

    this._state.schools.push(school);
    const users = this.buildDefaultUsers(school, adminProfile);
    if (!this._state.users) this._state.users = [];
    this._state.users.push(...users);
    this._audit(`Onboarded ${school.name} (${school.status}) · code ${schoolCode}`, id);
    this._persist();
    return { school, users, adminUser: users.find(u => u.roleId === 'school-admin') };
  },

  updateSchool(id, patch, actor = 'Platform Admin') {
    const idx = this._state.schools.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const prev = this._state.schools[idx];
    this._state.schools[idx] = { ...prev, ...patch, id: prev.id };
    if (patch.subscribedModules !== undefined) {
      this._state.schools[idx].subscribedModules = this._normalizeModules(patch.subscribedModules);
    }
    this._audit(`Updated profile for ${prev.name}`, id, actor);
    this._persist();
    return this._state.schools[idx];
  },

  setSchoolModules(id, moduleIds, actor = 'Platform Admin') {
    const school = this.getSchool(id);
    if (!school) return null;
    const normalized = this._normalizeModules(moduleIds);
    const added = normalized.filter(m => !resolveModuleIds(school.subscribedModules).includes(m));
    const removed = resolveModuleIds(school.subscribedModules).filter(m => !normalized.includes(m) && m !== 'core');
    school.subscribedModules = normalized;
    if (added.length) this._audit(`Enabled modules: ${added.join(', ')}`, id, actor);
    if (removed.length) this._audit(`Disabled modules: ${removed.join(', ')}`, id, actor);
    this._persist();
    return school;
  },

  setSchoolStatus(id, status) {
    return this.updateSchool(id, { status });
  },

  deleteSchool(id) {
    if (this._state.schools.length <= 1) return false;
    const school = this.getSchool(id);
    if (!school) return false;
    this._state.schools = this._state.schools.filter(s => s.id !== id);
    this._state.users = (this._state.users || []).filter(u => u.schoolId !== id);
    if (this._state.activeSchoolId === id) {
      this._state.activeSchoolId = this._state.schools[0].id;
    }
    this._audit(`Removed school ${school.name}`, null);
    this._persist();
    return true;
  },

  resetToSeed() {
    this._state = this._createSeedState();
    this._persist();
    this._audit('Reset all data to seed defaults', null);
  },

  getPlatformAudit(limit = 50) {
    return this._state.platformAudit.slice(0, limit);
  },

  getSchoolModuleIds(school) {
    if (!school) return ['core'];
    return resolveModuleIds(school.subscribedModules);
  },

  schoolHasModule(school, moduleId) {
    return this.getSchoolModuleIds(school).includes(moduleId);
  },

  getTotalTermRevenue() {
    return this._state.schools.reduce((sum, s) => sum + calculateTermBill(s.subscribedModules), 0);
  },

  getModulePresets() {
    return SKULPULSE.exampleModuleSets || [];
  }
};
