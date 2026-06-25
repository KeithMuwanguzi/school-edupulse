/**
 * SkulPulse Uganda — Mock Data Layer
 * Maps 1:1 to future API entities. Use as dev reference.
 *
 * Student / performance / fee data is generated deterministically from a
 * seeded PRNG so the demo is rich and "alive" but stable across reloads.
 * Aggregations live in `Analytics` and power dashboards + AI insights.
 */

const SKULPULSE = {
  /** Active tenant — populated by SkulStore.syncToSkulpulse() */
  school: {
    id: "sch-001",
    name: "Loading…",
    subscribedModules: ["core"],
    billingModel: "module-based"
  },

  /** All tenants summary — populated by SkulStore */
  platformSchools: [],

  academicYears: [
    { id: "ay-2024", label: "2024", status: "archived", terms: 3 },
    { id: "ay-2025", label: "2025", status: "active", terms: 3 },
    { id: "ay-2026", label: "2026", status: "upcoming", terms: 3 }
  ],

  terms: {
    "ay-2024": [
      { id: "t1-2024", label: "Term 1", dates: "Feb 5 – May 3, 2024", status: "closed" },
      { id: "t2-2024", label: "Term 2", dates: "May 27 – Aug 23, 2024", status: "closed" },
      { id: "t3-2024", label: "Term 3", dates: "Sep 16 – Dec 6, 2024", status: "closed" }
    ],
    "ay-2025": [
      { id: "t1-2025", label: "Term 1", dates: "Feb 3 – May 2, 2025", status: "closed" },
      { id: "t2-2025", label: "Term 2", dates: "May 26 – Aug 22, 2025", status: "active" },
      { id: "t3-2025", label: "Term 3", dates: "Sep 15 – Dec 5, 2025", status: "upcoming" }
    ],
    "ay-2026": [
      { id: "t1-2026", label: "Term 1", dates: "Feb 2 – May 1, 2026", status: "upcoming" },
      { id: "t2-2026", label: "Term 2", dates: "May 25 – Aug 21, 2026", status: "upcoming" },
      { id: "t3-2026", label: "Term 3", dates: "Sep 14 – Dec 4, 2026", status: "upcoming" }
    ]
  },

  billing: {
    model: "module-based",
    period: "term",
    currency: "UGX",
    platformBaseFee: 100000,
    note: "Term invoice = platform base fee + sum of each subscribed module. No per-student charges."
  },

  modules: [
    { id: "core", name: "Core Platform", icon: "🏠", category: "base", price: 0, description: "Dashboard, users, academic year isolation, audit logs (requires platform base fee)" },
    { id: "students", name: "Student Management", icon: "👨‍🎓", category: "academic", price: 150000, description: "Enrollment, profiles, class placement, guardians" },
    { id: "teachers", name: "Teacher & Staff", icon: "👩‍🏫", category: "academic", price: 120000, description: "Staff records, qualifications, subject assignments" },
    { id: "academics", name: "Academic Structure", icon: "📚", category: "academic", price: 100000, description: "Classes, streams, subjects, UNEB curriculum mapping" },
    { id: "assessment", name: "Assessment & Grading", icon: "📝", category: "academic", price: 180000, description: "Continuous assessment, exams, grade computation" },
    { id: "reportcards", name: "Report Cards & Transcripts", icon: "📄", category: "operations", price: 200000, description: "Term reports, parent portal, PDF export, transcripts" },
    { id: "attendance", name: "Attendance", icon: "✅", category: "academic", price: 80000, description: "Daily roll call, absence alerts, analytics" },
    { id: "finance", name: "Finance & Fees", icon: "💰", category: "operations", price: 250000, description: "Fee structures, invoicing, MTN/Airtel MoMo, bursar reports" },
    { id: "communication", name: "Communication Hub", icon: "📱", category: "operations", price: 150000, description: "SMS, email, in-app messaging, announcements" },
    { id: "ai-analytics", name: "AI Performance Analytics", icon: "🤖", category: "intelligence", price: 350000, description: "At-risk prediction, performance forecasting, intervention suggestions" },
    { id: "admissions", name: "Admissions Pipeline", icon: "📋", category: "operations", price: 120000, description: "Online applications, interview scheduling, enrollment workflow" },
    { id: "timetable", name: "Timetable", icon: "🗓️", category: "operations", price: 100000, description: "Class schedules, room allocation, conflict detection" },
    { id: "library", name: "Library", icon: "📖", category: "addon", price: 60000, description: "Catalogue, lending, overdue tracking" },
    { id: "transport", name: "Transport", icon: "🚌", category: "addon", price: 80000, description: "Routes, vehicles, student pickup tracking" },
    { id: "hostel", name: "Boarding & Hostel", icon: "🏨", category: "addon", price: 90000, description: "Dormitory allocation, roll call, meal plans" },
    { id: "hr-payroll", name: "HR & Payroll", icon: "💼", category: "addon", price: 200000, description: "Leave, payroll, NSSF, PAYE compliance" },
    { id: "inventory", name: "Inventory & Assets", icon: "📦", category: "addon", price: 70000, description: "Stock, lab equipment, asset tracking" },
    { id: "moes-reporting", name: "MoES Compliance Reports", icon: "🏛️", category: "operations", price: 100000, description: "Ministry-ready exports, EMIS sync" }
  ],

  /** Example module combinations for pitch page — not fixed plans */
  exampleModuleSets: [
    {
      id: "academic-core",
      name: "Academic core",
      modules: ["core", "students", "teachers", "academics", "assessment", "attendance"],
      description: "Enrollment through grading and attendance"
    },
    {
      id: "full-operations",
      name: "Full operations",
      modules: ["core", "students", "teachers", "academics", "assessment", "reportcards", "attendance", "finance", "communication", "admissions", "timetable", "moes-reporting"],
      description: "Academic core plus fees, reports, and parent access"
    },
    {
      id: "with-ai",
      name: "Operations + AI",
      modules: ["core", "students", "teachers", "academics", "assessment", "reportcards", "attendance", "finance", "communication", "ai-analytics"],
      description: "Full operations subset with predictive analytics"
    }
  ],

  roles: [
    { id: "platform-admin", name: "Platform Admin", description: "SkulPulse super admin — manages all schools" },
    { id: "school-admin", name: "School Administrator", description: "Full access to subscribed modules" },
    { id: "deputy-head", name: "Deputy Head Teacher", description: "Academic oversight, limited admin" },
    { id: "teacher", name: "Teacher", description: "Classes, assessment, attendance" },
    { id: "bursar", name: "Bursar / Accountant", description: "Finance module access" },
    { id: "parent", name: "Parent / Guardian", description: "Report cards, fees, communication" },
    { id: "student", name: "Student", description: "Own records, timetable, assignments" }
  ],

  rbacPermissions: [
    { id: "view", label: "View" },
    { id: "create", label: "Create" },
    { id: "edit", label: "Edit" },
    { id: "delete", label: "Delete" },
    { id: "approve", label: "Approve" },
    { id: "export", label: "Export" }
  ],

  rbacMatrix: {
    "school-admin": { students: ["view","create","edit","delete","export"], teachers: ["view","create","edit","delete"], assessment: ["view","create","edit","approve","export"], finance: ["view","create","edit","approve","export"], "ai-analytics": ["view","export"] },
    "deputy-head": { students: ["view","edit"], teachers: ["view"], assessment: ["view","approve","export"], "ai-analytics": ["view"] },
    teacher: { students: ["view"], assessment: ["view","create","edit"], attendance: ["view","create","edit"] },
    bursar: { students: ["view"], finance: ["view","create","edit","export"] },
    parent: { "reportcards": ["view"], finance: ["view"], communication: ["view"] },
    student: { assessment: ["view"], timetable: ["view"] }
  },

  /* ---- The entities below are GENERATED — see DataEngine.build() ---- */
  classes: [],
  students: [],
  teachers: [],
  subjects: [],
  assessments: [],
  feeRecords: [],
  aiInsights: [],

  reportCardSample: null,

  announcements: [
    { id: "ann-1", title: "Term 2 Mid-Term Break", date: "2025-06-28", audience: "All", priority: "normal" },
    { id: "ann-2", title: "UCE Mock Exams Schedule Released", date: "2025-07-01", audience: "S.4", priority: "high" },
    { id: "ann-3", title: "PTA Meeting — 5th July", date: "2025-07-05", audience: "Parents", priority: "normal" },
    { id: "ann-4", title: "Science Fair entries due Friday", date: "2025-06-20", audience: "S.1–S.3", priority: "normal" }
  ],

  auditLog: [
    { time: "2025-06-13 09:42", user: "Admin — Okello", action: "Published report cards for S.4 West", module: "reportcards" },
    { time: "2025-06-13 09:15", user: "Dr. Nsubuga", action: "Entered Mathematics scores — Mid-Term 1", module: "assessment" },
    { time: "2025-06-12 16:30", user: "Bursar — Namuli", action: "Recorded MTN MoMo payment UGX 850,000", module: "finance" },
    { time: "2025-06-12 14:00", user: "Admin — Okello", action: "Switched active term to Term 2, 2025", module: "core" },
    { time: "2025-06-11 11:20", user: "System", action: "AI flagged 3 at-risk students in S.3 South", module: "ai-analytics" }
  ],

  admissionsPipeline: [
    { id: "ADM-001", name: "Kato Junior", appliedClass: "S.1", status: "application", date: "2025-05-10", score: null },
    { id: "ADM-002", name: "Nalwoga Patricia", appliedClass: "S.1", status: "application", date: "2025-05-12", score: null },
    { id: "ADM-003", name: "Wasswa Elijah", appliedClass: "S.5", status: "interview", date: "2025-05-15", score: 72 },
    { id: "ADM-004", name: "Nakimuli Shamim", appliedClass: "S.1", status: "interview", date: "2025-05-16", score: 80 },
    { id: "ADM-005", name: "Musinguzi Ivan", appliedClass: "S.5", status: "accepted", date: "2025-05-01", score: 85 },
    { id: "ADM-006", name: "Auma Rebecca", appliedClass: "S.1", status: "accepted", date: "2025-05-03", score: 88 },
    { id: "ADM-007", name: "Ayebare Joan", appliedClass: "S.1", status: "enrolled", date: "2025-04-20", score: 91 },
    { id: "ADM-008", name: "Tumusiime Mark", appliedClass: "S.5", status: "enrolled", date: "2025-04-22", score: 79 }
  ],

  /** Live dashboard headline stats — kept for compatibility, augmented by Analytics */
  dashboardStats: {
    "school-admin": { students: 1247, teachers: 68, classes: 32, feeCollection: 78, attendanceToday: 94.2, atRiskStudents: 23 },
    teacher: { myClasses: 2, students: 77, pendingMarks: 12, attendanceToday: 96 },
    parent: { children: 1, feeBalance: 0, unreadMessages: 2, latestReport: "Term 1, 2025" },
    bursar: { collected: 485000000, outstanding: 142000000, overdueAccounts: 89, todayPayments: 12 }
  }
};

/* ============================================================
   DETERMINISTIC DATA ENGINE
   ============================================================ */

const DataEngine = (() => {
  // Seeded PRNG (mulberry32) — stable output across reloads.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v) => Math.round(v);
  const ri = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const pk = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  const FIRST_M = ["Okello", "Mukasa", "Ssempijja", "Wasswa", "Tumusiime", "Mugisha", "Kato", "Opio", "Byaruhanga", "Ssekandi", "Lubega", "Kirabo", "Mwesigwa", "Ojok", "Kakembo", "Ssali", "Bwambale", "Aine"];
  const FIRST_F = ["Akello", "Nabukeera", "Atuhaire", "Namukasa", "Nakato", "Auma", "Kemigisha", "Nalwoga", "Birungi", "Achan", "Nakimuli", "Asiimwe", "Nakanwagi", "Apio", "Namatovu", "Kabanda", "Nansubuga", "Amongin"];
  const SUR = ["Sarah", "Daniel", "Faith", "Brian", "Mercy", "Joan", "Ivan", "Patricia", "Emmanuel", "Grace", "Peter", "Christine", "Samuel", "Ruth", "David", "Shamim", "Mark", "Esther", "Henry", "Diana", "Robert", "Prossy", "Elijah", "Rebecca"];

  const GUARD_SUR = ["Namukasa", "Mukasa", "Atuhaire", "Ssempijja", "Okello", "Nabukeera", "Tumusiime", "Mugisha", "Birungi", "Lubega", "Asiimwe", "Kabanda"];
  const GUARD_FIRST = ["James", "Grace", "Peter", "Alice", "Robert", "Sarah", "John", "Mary", "Paul", "Susan", "Joseph", "Esther"];

  const ROOMS = ["Block A", "Block B", "Block C", "Block D", "Block E"];

  // Residence / health / contact pools
  const HOUSES = ["Kizito", "Lwanga", "Mukasa", "Kiwanuka", "Bakanja", "Gonza"];
  const ROUTES = ["Kampala Road", "Entebbe Road", "Jinja Road", "Bombo Road", "Gayaza Road", "Masaka Road"];
  const STOPS = ["Wandegeya", "Ntinda", "Najjera", "Kireka", "Nansana", "Kyaliwajjala", "Bweyogerere", "Kasangati"];
  const BLOOD = ["O+", "O+", "O+", "A+", "A+", "B+", "O-", "AB+", "A-", "B-"];
  const RELATIONS = ["Father", "Mother", "Mother", "Guardian", "Uncle", "Aunt", "Grandparent"];
  const DISTRICTS = ["Kampala", "Wakiso", "Mukono", "Jinja", "Mbarara", "Gulu", "Masaka", "Mbale", "Fort Portal"];
  const ALLERGIES = ["None", "None", "None", "None", "Penicillin", "Peanuts", "Dust / pollen", "Lactose"];
  const CONDITIONS = ["None", "None", "None", "None", "Asthma", "Sickle cell trait", "Mild epilepsy", "Short-sightedness"];
  const DIET = ["Standard", "Standard", "Standard", "Vegetarian", "No pork", "Gluten-free"];
  const CONDUCT = ["Excellent", "Excellent", "Good", "Good", "Fair"];

  // O-Level subjects (S.1–S.4) and A-Level combinations (S.5–S.6)
  const O_SUBJECTS = ["Mathematics", "English", "Physics", "Chemistry", "Biology", "Geography", "History", "CRE"];
  const A_SCIENCE = ["Mathematics", "Physics", "Chemistry", "Biology"];
  const A_ARTS = ["History", "Geography", "Economics", "Literature"];

  const CLASS_DEFS = [
    { id: "cls-s1n", name: "S.1 North", level: "S.1", stream: "General", n: 9 },
    { id: "cls-s1s", name: "S.1 South", level: "S.1", stream: "General", n: 8 },
    { id: "cls-s2e", name: "S.2 East", level: "S.2", stream: "General", n: 8 },
    { id: "cls-s2w", name: "S.2 West", level: "S.2", stream: "General", n: 8 },
    { id: "cls-s3s", name: "S.3 South", level: "S.3", stream: "Sciences", n: 8 },
    { id: "cls-s3n", name: "S.3 North", level: "S.3", stream: "Arts", n: 7 },
    { id: "cls-s4w", name: "S.4 West", level: "S.4", stream: "Sciences", n: 9 },
    { id: "cls-s4e", name: "S.4 East", level: "S.4", stream: "Arts", n: 7 },
    { id: "cls-s5sc", name: "S.5 Sciences", level: "S.5", stream: "Sciences", n: 6 },
    { id: "cls-s5ar", name: "S.6 Arts", level: "S.6", stream: "Arts", n: 6 },
    { id: "cls-s6sc", name: "S.6 Sciences", level: "S.6", stream: "Sciences", n: 6 },
    { id: "cls-s6ar", name: "S.5 Arts", level: "S.5", stream: "Arts", n: 6 }
  ];

  const TEACHERS = [
    { id: "TCH-001", name: "Dr. Nsubuga Emmanuel", subject: "Mathematics", qualification: "PhD Mathematics", classes: ["S.4 West", "S.6 Sciences"], email: "e.nsubuga@smack.ac.ug", phone: "+256 712 000 111", status: "active" },
    { id: "TCH-002", name: "Ms. Nakato Rebecca", subject: "English", qualification: "MA Education", classes: ["S.2 East", "S.4 West"], email: "r.nakato@smack.ac.ug", phone: "+256 702 000 222", status: "active" },
    { id: "TCH-003", name: "Mr. Okori Samuel", subject: "Physics", qualification: "BSc Physics", classes: ["S.4 West", "S.6 Sciences"], email: "s.okori@smack.ac.ug", phone: "+256 782 000 333", status: "active" },
    { id: "TCH-004", name: "Mrs. Apio Christine", subject: "Biology", qualification: "MSc Biology", classes: ["S.3 South", "S.6 Sciences"], email: "c.apio@smack.ac.ug", phone: "+256 752 000 444", status: "on-leave" },
    { id: "TCH-005", name: "Mr. Lubega Henry", subject: "Chemistry", qualification: "BSc Chemistry", classes: ["S.4 West", "S.5 Sciences"], email: "h.lubega@smack.ac.ug", phone: "+256 772 000 555", status: "active" },
    { id: "TCH-006", name: "Ms. Birungi Diana", subject: "Geography", qualification: "BA Geography", classes: ["S.3 North", "S.5 Arts"], email: "d.birungi@smack.ac.ug", phone: "+256 701 000 666", status: "active" },
    { id: "TCH-007", name: "Mr. Ssekandi Paul", subject: "History", qualification: "BA Education", classes: ["S.4 East", "S.6 Arts"], email: "p.ssekandi@smack.ac.ug", phone: "+256 782 000 777", status: "active" },
    { id: "TCH-008", name: "Mrs. Asiimwe Susan", subject: "Economics", qualification: "BA Economics", classes: ["S.5 Arts", "S.6 Arts"], email: "s.asiimwe@smack.ac.ug", phone: "+256 752 000 888", status: "active" },
    { id: "TCH-009", name: "Mr. Mwesigwa John", subject: "Mathematics", qualification: "BSc Education", classes: ["S.1 North", "S.2 East"], email: "j.mwesigwa@smack.ac.ug", phone: "+256 772 000 999", status: "active" },
    { id: "TCH-010", name: "Ms. Nansubuga Esther", subject: "Literature", qualification: "MA Literature", classes: ["S.5 Arts", "S.6 Arts"], email: "e.nansubuga@smack.ac.ug", phone: "+256 701 001 000", status: "active" },
    { id: "TCH-011", name: "Mr. Kato Robert", subject: "English", qualification: "BA Education", classes: ["S.1 South", "S.3 North"], email: "r.kato@smack.ac.ug", phone: "+256 712 001 111", status: "active" },
    { id: "TCH-012", name: "Mrs. Kemigisha Grace", subject: "Biology", qualification: "BSc Education", classes: ["S.1 North", "S.2 West"], email: "g.kemigisha@smack.ac.ug", phone: "+256 782 001 222", status: "active" }
  ];

  const SUBJECTS = [
    { id: "sub-math", name: "Mathematics", code: "MATH", level: "O & A", category: "Core", unebCode: "456/1" },
    { id: "sub-eng", name: "English", code: "ENG", level: "O-Level", category: "Core", unebCode: "112/1" },
    { id: "sub-phy", name: "Physics", code: "PHY", level: "O & A", category: "Sciences", unebCode: "535/1" },
    { id: "sub-chem", name: "Chemistry", code: "CHE", level: "O & A", category: "Sciences", unebCode: "545/1" },
    { id: "sub-bio", name: "Biology", code: "BIO", level: "O & A", category: "Sciences", unebCode: "553/1" },
    { id: "sub-geo", name: "Geography", code: "GEO", level: "O & A", category: "Arts", unebCode: "273/1" },
    { id: "sub-hist", name: "History", code: "HIST", level: "O & A", category: "Arts", unebCode: "241/1" },
    { id: "sub-cre", name: "CRE", code: "CRE", level: "O-Level", category: "Arts", unebCode: "223/1" },
    { id: "sub-eco", name: "Economics", code: "ECO", level: "A-Level", category: "Arts", unebCode: "220/1" },
    { id: "sub-lit", name: "Literature", code: "LIT", level: "A-Level", category: "Arts", unebCode: "210/1" }
  ];

  const ASSESSMENTS = [
    { id: "asm-001", name: "Mid-Term Test 1", type: "Continuous Assessment", subject: "Mathematics", class: "S.4 West", date: "2025-06-15", maxScore: 100, status: "published" },
    { id: "asm-002", name: "End of Term Exam", type: "Examination", subject: "All Subjects", class: "S.4 West", date: "2025-08-10", maxScore: 100, status: "draft" },
    { id: "asm-003", name: "Weekly Quiz", type: "Quiz", subject: "English", class: "S.2 East", date: "2025-06-20", maxScore: 20, status: "published" },
    { id: "asm-004", name: "Mid-Term Test 1", type: "Continuous Assessment", subject: "Physics", class: "S.6 Sciences", date: "2025-06-18", maxScore: 100, status: "published" },
    { id: "asm-005", name: "Practical Assessment", type: "Practical", subject: "Chemistry", class: "S.5 Sciences", date: "2025-06-22", maxScore: 50, status: "draft" }
  ];

  function subjectsForClass(cls) {
    if (cls.level === "S.5" || cls.level === "S.6") {
      return cls.stream === "Arts" ? A_ARTS : A_SCIENCE;
    }
    return O_SUBJECTS;
  }

  function gradeFromScore(s) {
    if (s >= 80) return { grade: "A", remark: "Excellent", point: 1 };
    if (s >= 70) return { grade: "B", remark: "Very good", point: 2 };
    if (s >= 60) return { grade: "C", remark: "Good", point: 3 };
    if (s >= 50) return { grade: "D", remark: "Fair", point: 4 };
    return { grade: "E", remark: "Needs work", point: 6 };
  }

  function divisionFromAverage(avg, level) {
    const aLevel = level === "S.5" || level === "S.6";
    if (aLevel) {
      const points = clamp(round((avg - 35) / 3.5), 0, 20);
      let band;
      if (points >= 16) band = "A";
      else if (points >= 12) band = "B";
      else if (points >= 8) band = "C";
      else if (points >= 5) band = "D";
      else band = "E";
      return { label: `${points} points`, points, band };
    }
    let label;
    if (avg >= 75) label = "Division 1";
    else if (avg >= 62) label = "Division 2";
    else if (avg >= 52) label = "Division 3";
    else if (avg >= 42) label = "Division 4";
    else label = "Fail risk";
    return { label, points: null, band: label };
  }

  function fullName(rng, gender) {
    const first = gender === "F" ? pk(rng, FIRST_F) : pk(rng, FIRST_M);
    return `${first} ${pk(rng, SUR)}`;
  }

  function ageForLevel(rng, level, yearOffset) {
    const base = { "S.1": 13, "S.2": 14, "S.3": 15, "S.4": 16, "S.5": 17, "S.6": 18 };
    return (base[level] || 15) + ri(rng, -1, 1) + yearOffset;
  }

  function yearLabel(yearId) { return (yearId.match(/(\d{4})/) || [])[1] || "2025"; }
  function termNum(termId) { return parseInt((termId.match(/t(\d)/) || [])[1] || "2", 10); }

  /** Stable enrolment-progression nudge: cohorts improve term-on-term; older years sit lower. */
  function periodFactor(yearId, termId) {
    const yf = { "ay-2024": -4, "ay-2025": 0, "ay-2026": 3 }[yearId] || 0;
    const tf = { 1: -2, 2: 0, 3: 2 }[termNum(termId)] || 0;
    return yf + tf;
  }

  /* ---- Stable per-year roster (identity, residence, health, contacts) ---- */
  function buildRoster(yearId) {
    const rng = mulberry32(hashStr("roster|" + yearId));
    const yr = yearLabel(yearId);
    const yearOffset = parseInt(yr, 10) - 2025;
    const students = [];
    const classesMeta = [];
    let seq = 1;

    CLASS_DEFS.forEach((cdef) => {
      const subjectNames = subjectsForClass(cdef);
      classesMeta.push({
        id: cdef.id, name: cdef.name, level: cdef.level, stream: cdef.stream,
        students: cdef.n, classTeacher: pk(rng, TEACHERS).name, room: `${pk(rng, ROOMS)} - ${String(ri(rng, 1, 14)).padStart(2, "0")}`
      });

      for (let i = 0; i < cdef.n; i++) {
        const gender = rng() < 0.5 ? "F" : "M";
        const ability = clamp(round(58 + (rng() - 0.42) * 46), 30, 96);     // stable trait
        const attendanceBase = clamp(round(96 - Math.max(0, (62 - ability)) * 0.5 - rng() * 8), 58, 100);
        const subjectBias = subjectNames.map(() => round((rng() - 0.5) * 18)); // stable per-subject strength
        const boarder = rng() < 0.55;
        const route = pk(rng, ROUTES);

        students.push({
          id: `STU-${yr}-${String(1000 + seq).slice(1)}`,
          seed: hashStr(`${yearId}|${cdef.id}|${i}`),
          name: fullName(rng, gender),
          class: cdef.name, classId: cdef.id, level: cdef.level, stream: cdef.stream,
          gender, age: ageForLevel(rng, cdef.level, yearOffset),
          guardian: `${pk(rng, GUARD_SUR)} ${pk(rng, GUARD_FIRST)}`,
          guardianRelation: pk(rng, RELATIONS),
          guardianPhone: `+256 7${ri(rng, 0, 9)}${ri(rng, 0, 9)} ${ri(rng, 100, 999)} ${ri(rng, 100, 999)}`,
          homeDistrict: pk(rng, DISTRICTS),
          admissionDate: `${parseInt(yr, 10) - (["S.1","S.2","S.3","S.4","S.5","S.6"].indexOf(cdef.level))}-02-0${ri(rng, 1, 5)}`,
          photo: null,
          lin: `LIN-${ri(rng, 1000000, 9999999)}`,
          ability, attendanceBase, subjectNames, subjectBias,
          residence: boarder
            ? { type: "Boarder", house: `${pk(rng, HOUSES)} House`, dorm: `Dorm ${pk(rng, ["A","B","C","D"])}`, bed: `Bed ${ri(rng, 1, 32)}` }
            : { type: "Day", transport: rng() < 0.6 ? "School bus" : "Private", route, stop: pk(rng, STOPS), pickup: `${ri(rng, 6, 7)}:${pk(rng, ["00","15","30","45"])} AM` },
          health: {
            bloodGroup: pk(rng, BLOOD), allergies: pk(rng, ALLERGIES), condition: pk(rng, CONDITIONS),
            diet: pk(rng, DIET), immunized: rng() > 0.05, nurseVisits: ri(rng, 0, 4),
            lastCheckup: `${yr}-0${ri(rng, 2, 5)}-${String(ri(rng, 1, 28)).padStart(2, "0")}`
          }
        });
        seq++;
      }
    });
    return { students, classesMeta };
  }

  /* ---- Per-(year,term) performance layer over a stable roster ---- */
  function buildPeriod(yearId, termId) {
    const { students: roster, classesMeta } = getRoster(yearId);
    const salt = hashStr(yearId + "|" + termId);
    const pf = periodFactor(yearId, termId);

    const students = roster.map((st) => {
      const rng = mulberry32((st.seed ^ salt) >>> 0);
      const ability = clamp(round(st.ability + pf + (rng() - 0.5) * 6), 22, 98);
      const attendanceRate = clamp(round(st.attendanceBase + pf * 0.4 + (rng() - 0.5) * 6), 55, 100);
      const slope = round((rng() - 0.5) * 16);

      const subjects = st.subjectNames.map((subName, si) => {
        const a3 = clamp(ability + st.subjectBias[si] + round((rng() - 0.5) * 6), 18, 99);
        const a1 = clamp(a3 - slope, 18, 99);
        const a2 = clamp(round((a1 + a3) / 2) + round((rng() - 0.5) * 5), 18, 99);
        const current = a3;
        const g = gradeFromScore(current);
        return { name: subName, scores: [a1, a2, a3], current, ca: clamp(round(current * 0.4), 0, 40), exam: clamp(round(current * 0.6), 0, 60), grade: g.grade, point: g.point, remark: g.remark, trend: current - a1 };
      });

      const current = round(subjects.reduce((s, x) => s + x.current, 0) / subjects.length);
      const first = round(subjects.reduce((s, x) => s + x.scores[0], 0) / subjects.length);
      const prev = round(subjects.reduce((s, x) => s + x.scores[1], 0) / subjects.length);
      const delta = current - prev;
      const division = divisionFromAverage(current, st.level);

      let riskScore = 0;
      if (current < 50) riskScore += 3; else if (current < 60) riskScore += 2; else if (current < 68) riskScore += 1;
      if (delta <= -5) riskScore += 2; else if (delta < 0) riskScore += 1;
      if (attendanceRate < 75) riskScore += 2; else if (attendanceRate < 85) riskScore += 1;
      const riskLevel = riskScore >= 4 ? "high" : riskScore >= 2 ? "medium" : "low";

      return {
        ...st, subjects, average: current, firstAverage: first, prevAverage: prev, delta,
        attendanceRate, riskLevel, riskScore, division: division.label, divisionBand: division.band,
        status: riskLevel === "high" ? "at-risk" : "active"
      };
    });

    // Class rank + aggregates
    const classes = classesMeta.map((c) => ({ ...c }));
    classes.forEach((c) => {
      const r = students.filter((s) => s.classId === c.id).sort((a, b) => b.average - a.average);
      r.forEach((s, idx) => { s.position = idx + 1; s.classSize = r.length; });
      c.students = r.length;
      c.average = r.length ? round(r.reduce((s, x) => s + x.average, 0) / r.length) : 0;
      c.attendance = r.length ? round(r.reduce((s, x) => s + x.attendanceRate, 0) / r.length) : 0;
      c.atRisk = r.filter((s) => s.riskLevel === "high").length;
      c.topStudent = r[0]?.name || "—";
    });

    const yr = yearLabel(yearId);
    const feeRecords = students.map((s) => {
      const rng = mulberry32((s.seed ^ salt ^ 0x9e37) >>> 0);
      const termFee = 600000 + ["S.1","S.2","S.3","S.4","S.5","S.6"].indexOf(s.level) * 60000 + (s.stream === "Sciences" ? 80000 : 0);
      const roll = rng();
      let paid, status, method, lastPayment;
      const methods = ["MTN MoMo", "Airtel Money", "Bank Transfer", "Cash"];
      if (roll < 0.52) { paid = termFee; status = "paid"; }
      else if (roll < 0.78) { paid = round(termFee * (0.4 + rng() * 0.4)); status = "partial"; }
      else if (roll < 0.9) { paid = round(termFee * (0.1 + rng() * 0.2)); status = "overdue"; }
      else { paid = 0; status = "unpaid"; }
      method = paid > 0 ? pk(rng, methods) : null;
      const tn = termNum(termId);
      lastPayment = paid > 0 ? `${yr}-${String(tn === 1 ? ri(rng, 2, 4) : tn === 3 ? ri(rng, 9, 11) : ri(rng, 5, 7)).padStart(2, "0")}-${String(ri(rng, 1, 28)).padStart(2, "0")}` : null;
      return { id: `FEE-${s.id.slice(-4)}`, studentId: s.id, student: s.name, class: s.class, level: s.level, termFee, paid, balance: termFee - paid, status, lastPayment, method };
    });

    const aiInsights = students
      .filter((s) => s.riskLevel !== "low" || s.average >= 82)
      .sort((a, b) => b.riskScore - a.riskScore || a.average - b.average)
      .map((s) => buildInsight(s));

    const termLabel = (SKULPULSE.terms[yearId] || []).find((t) => t.id === termId)?.label || "Term 2";
    const flagship = students.filter((s) => s.class === "S.4 West").sort((a, b) => a.position - b.position)[0] || students[0];
    const reportCardSample = flagship ? buildReportCard(flagship, termLabel, yr) : null;

    return { students, classes, feeRecords, aiInsights, reportCardSample };
  }

  function buildInsight(s) {
    const factors = [];
    const recs = [];
    const weakest = [...s.subjects].sort((a, b) => a.current - b.current)[0];
    const declining = [...s.subjects].filter((x) => x.trend <= -6).sort((a, b) => a.trend - b.trend)[0];

    if (s.riskLevel === "low") {
      factors.push(`Consistent top performer — ${s.average}% average`);
      factors.push(`Strong in ${[...s.subjects].sort((a, b) => b.current - a.current)[0].name}`);
      factors.push(`Attendance ${s.attendanceRate}%`);
      recs.push("Consider advanced/scholarship track");
      recs.push(`${s.division} highly likely — maintain momentum`);
    } else {
      if (declining) factors.push(`${declining.name} dropped ${Math.abs(declining.trend)}% over 3 assessments`);
      if (s.attendanceRate < 85) factors.push(`Attendance ${s.attendanceRate}% — below target`);
      if (weakest.current < 55) factors.push(`${weakest.name} at ${weakest.current}% (lowest subject)`);
      if (s.delta < 0) factors.push(`Term average down ${Math.abs(s.delta)} points`);
      if (!factors.length) factors.push(`Average ${s.average}% — borderline, monitor closely`);

      recs.push(`Assign peer tutor for ${weakest.name}`);
      if (s.attendanceRate < 85) recs.push("Schedule parent meeting on attendance");
      recs.push(s.riskLevel === "high" ? "Weekly progress check-ins" : "Targeted revision sessions");
    }

    const aLevel = s.level === "S.5" || s.level === "S.6";
    return {
      studentId: s.id,
      studentName: s.name,
      class: s.class,
      level: s.level,
      riskLevel: s.riskLevel,
      predictedGrade: s.subjects.length ? gradeFromScore(s.average).grade : "—",
      currentAverage: s.average,
      attendanceRate: s.attendanceRate,
      delta: s.delta,
      trend: s.delta >= 3 ? "improving" : s.delta <= -3 ? "declining" : "stable",
      sparkline: averageSeries(s),
      subjects: s.subjects.map((x) => ({ name: x.name, current: x.current, trend: x.trend })),
      factors,
      recommendations: recs,
      predictedUACE: aLevel ? s.division : null,
      predictedUCE: aLevel ? null : `${s.division}${s.riskLevel === "high" ? " (at current trajectory)" : ""}`
    };
  }

  function averageSeries(s) {
    const a = s.subjects;
    return [0, 1, 2].map((i) => round(a.reduce((sum, x) => sum + x.scores[i], 0) / a.length));
  }

  function buildReportCard(s, termLabel, yr) {
    const present = round((s.attendanceRate / 100) * 62);
    return {
      student: s.name,
      studentId: s.id,
      class: s.class,
      term: `${termLabel}, ${yr}`,
      academicYear: yr,
      position: s.position,
      totalStudents: s.classSize,
      attendance: { present, total: 62, percentage: s.attendanceRate },
      conduct: s.average >= 70 ? "Excellent" : s.average >= 55 ? "Good" : "Fair",
      teacherComment: s.average >= 75
        ? `${s.name.split(" ")[0]} continues to excel. Strong, consistent work — encourage leadership roles.`
        : `${s.name.split(" ")[0]} is capable. With steady revision the grades will rise further.`,
      headTeacherComment: s.average >= 75 ? "Outstanding performance. Keep it up." : "A promising term. Stay focused.",
      grades: s.subjects.map((x) => ({ subject: x.name, ca: x.ca, exam: x.exam, total: x.current, grade: x.grade, remark: x.remark })),
      average: s.average,
      aggregate: s.subjects.reduce((sum, x) => sum + x.point, 0)
    };
  }

  // ---- caches & public API ----
  const _rosters = {};
  const _periods = {};
  function getRoster(yearId) { return _rosters[yearId] || (_rosters[yearId] = buildRoster(yearId)); }
  function getPeriod(yearId, termId) {
    const k = `${yearId}|${termId}`;
    return _periods[k] || (_periods[k] = buildPeriod(yearId, termId));
  }

  /** Swap SKULPULSE entity arrays to the requested academic period. */
  function setPeriod(yearId, termId) {
    const d = getPeriod(yearId, termId);
    SKULPULSE.students = d.students;
    SKULPULSE.classes = d.classes;
    SKULPULSE.feeRecords = d.feeRecords;
    SKULPULSE.aiInsights = d.aiInsights;
    SKULPULSE.reportCardSample = d.reportCardSample;
    SKULPULSE.activePeriod = { yearId, termId };
    // refresh headline stats from the live dataset
    const sa = Analytics.schoolAverage();
    const fin = Analytics.finance();
    SKULPULSE.dashboardStats["school-admin"] = {
      students: 1247, teachers: SKULPULSE.teachers.length, classes: SKULPULSE.classes.length,
      feeCollection: fin.rate, attendanceToday: sa.attendance, atRiskStudents: sa.atRisk, average: sa.average
    };
    return d;
  }

  return { setPeriod, getPeriod, getRoster, gradeFromScore, statics: { teachers: TEACHERS, subjects: SUBJECTS, assessments: ASSESSMENTS } };
})();

/* ============================================================
   ANALYTICS — aggregations powering charts & AI insights
   ============================================================ */

const Analytics = {
  all() { return SKULPULSE.students || []; },

  byLevel() {
    const order = ["S.1", "S.2", "S.3", "S.4", "S.5", "S.6"];
    const map = {};
    this.all().forEach((s) => {
      (map[s.level] ||= []).push(s);
    });
    return order.filter((l) => map[l]).map((level) => {
      const roster = map[level];
      return {
        level,
        count: roster.length,
        average: Math.round(roster.reduce((a, s) => a + s.average, 0) / roster.length),
        attendance: Math.round(roster.reduce((a, s) => a + s.attendanceRate, 0) / roster.length),
        atRisk: roster.filter((s) => s.riskLevel === "high").length
      };
    });
  },

  byClass(level = null) {
    return (SKULPULSE.classes || [])
      .filter((c) => !level || c.level === level)
      .map((c) => ({
        id: c.id, name: c.name, level: c.level, stream: c.stream,
        count: c.students, average: c.average, attendance: c.attendance, atRisk: c.atRisk
      }));
  },

  riskDistribution(filterFn = null) {
    const set = filterFn ? this.all().filter(filterFn) : this.all();
    return {
      high: set.filter((s) => s.riskLevel === "high").length,
      medium: set.filter((s) => s.riskLevel === "medium").length,
      low: set.filter((s) => s.riskLevel === "low").length,
      total: set.length
    };
  },

  divisionForecast(filterFn = null) {
    const set = (filterFn ? this.all().filter(filterFn) : this.all());
    const map = {};
    set.forEach((s) => { map[s.division] = (map[s.division] || 0) + 1; });
    const order = ["Division 1", "Division 2", "Division 3", "Division 4", "Fail risk"];
    return order.filter((d) => map[d]).map((d) => ({ label: d, value: map[d] }));
  },

  subjectAverages(level) {
    const set = this.all().filter((s) => s.level === level);
    const map = {};
    set.forEach((s) => s.subjects.forEach((sub) => {
      (map[sub.name] ||= []).push(sub.current);
    }));
    return Object.entries(map).map(([name, arr]) => ({
      name, average: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), count: arr.length
    })).sort((a, b) => b.average - a.average);
  },

  /** Heatmap: class (rows) × subject (cols) average scores, for one level */
  subjectHeatmap(level) {
    const classes = this.byClass(level);
    const subjectSet = new Set();
    this.all().filter((s) => s.level === level).forEach((s) => s.subjects.forEach((x) => subjectSet.add(x.name)));
    const subjects = [...subjectSet];
    const rows = classes.map((c) => {
      const roster = this.all().filter((s) => s.classId === c.id);
      const values = subjects.map((subName) => {
        const vals = roster.flatMap((s) => s.subjects.filter((x) => x.name === subName).map((x) => x.current));
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      });
      return { label: c.name, values };
    });
    return { subjects, rows };
  },

  gradeDistribution(filterFn = null) {
    const set = filterFn ? this.all().filter(filterFn) : this.all();
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    set.forEach((s) => s.subjects.forEach((x) => { counts[x.grade] = (counts[x.grade] || 0) + 1; }));
    return counts;
  },

  topPerformers(n = 5, filterFn = null) {
    const set = filterFn ? this.all().filter(filterFn) : this.all();
    return [...set].sort((a, b) => b.average - a.average).slice(0, n);
  },

  watchlist(n = 6) {
    return [...this.all()].sort((a, b) => b.riskScore - a.riskScore || a.average - b.average)
      .filter((s) => s.riskLevel !== "low").slice(0, n);
  },

  attendanceTrend() {
    // Synthesised weekly trend converging on current school attendance.
    const base = this.schoolAverage().attendance;
    const weeks = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
    const seed = [base - 4, base - 2, base - 3, base - 1, base, base + 1, base - 1, base];
    return weeks.map((w, i) => ({ label: w, value: Math.max(70, Math.min(99, seed[i])) }));
  },

  performanceTrend() {
    // School-wide average across the three recorded assessments + projection.
    const set = this.all();
    const pts = [0, 1, 2].map((i) =>
      Math.round(set.reduce((a, s) => a + s.subjects.reduce((x, y) => x + y.scores[i], 0) / s.subjects.length, 0) / set.length)
    );
    return pts;
  },

  schoolAverage() {
    const set = this.all();
    if (!set.length) return { average: 0, attendance: 0, atRisk: 0 };
    return {
      average: Math.round(set.reduce((a, s) => a + s.average, 0) / set.length),
      attendance: Math.round(set.reduce((a, s) => a + s.attendanceRate, 0) / set.length),
      atRisk: set.filter((s) => s.riskLevel === "high").length
    };
  },

  finance() {
    const recs = SKULPULSE.feeRecords || [];
    const billed = recs.reduce((a, r) => a + r.termFee, 0);
    const collected = recs.reduce((a, r) => a + r.paid, 0);
    const outstanding = billed - collected;
    const byMethod = {};
    recs.forEach((r) => { if (r.method && r.paid) byMethod[r.method] = (byMethod[r.method] || 0) + r.paid; });
    const byStatus = { paid: 0, partial: 0, overdue: 0, unpaid: 0 };
    recs.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    return {
      billed, collected, outstanding,
      rate: billed ? Math.round((collected / billed) * 100) : 0,
      overdueCount: recs.filter((r) => r.status === "overdue" || r.status === "unpaid").length,
      byMethod, byStatus, count: recs.length
    };
  }
};

/* ---- Build the default period now (browser only; safe if no window) ---- */
(function bootstrapData() {
  // Period-independent entities
  SKULPULSE.teachers = DataEngine.statics.teachers;
  SKULPULSE.subjects = DataEngine.statics.subjects;
  SKULPULSE.assessments = DataEngine.statics.assessments;
  // Default to the active term (Term 2, 2025)
  DataEngine.setPeriod("ay-2025", "t2-2025");
})();

/** Resolve module IDs — "all" expands to full catalog */
function resolveModuleIds(moduleIds) {
  if (moduleIds === "all") return SKULPULSE.modules.map(m => m.id);
  return moduleIds;
}

/** Sum module prices + platform base fee for a term invoice */
function calculateTermBill(moduleIds) {
  const ids = resolveModuleIds(moduleIds);
  const moduleTotal = SKULPULSE.modules
    .filter(m => ids.includes(m.id))
    .reduce((sum, m) => sum + m.price, 0);
  return SKULPULSE.billing.platformBaseFee + moduleTotal;
}

function formatUGX(amount) {
  if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (amount >= 1000) return `UGX ${Math.round(amount / 1000)}K`;
  return `UGX ${amount.toLocaleString()}`;
}

function getModuleBreakdown(moduleIds) {
  const ids = resolveModuleIds(moduleIds);
  const lines = SKULPULSE.modules.filter(m => ids.includes(m.id) && m.price > 0);
  return {
    baseFee: SKULPULSE.billing.platformBaseFee,
    modules: lines,
    moduleTotal: lines.reduce((s, m) => s + m.price, 0),
    total: calculateTermBill(ids)
  };
}
