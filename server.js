const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const readXlsxFile = require("read-excel-file/node");
const config = require("./config/columns");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-secret-before-online-deployment";
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const portalStats = {
  totalLogins: 0,
  uniqueStudentIds: new Set(),
  activeSessions: new Map()
};

app.use(express.json());
app.set("trust proxy", 1);
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.session.student) {
    markSessionActive(req);
  }
  next();
});

function markSessionActive(req) {
  portalStats.activeSessions.set(req.sessionID, {
    studentId: req.session.student.id,
    name: req.session.student.name,
    lastSeen: Date.now()
  });
}

function cleanupActiveSessions() {
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  portalStats.activeSessions.forEach((sessionInfo, sessionId) => {
    if (sessionInfo.lastSeen < cutoff) {
      portalStats.activeSessions.delete(sessionId);
    }
  });
}

function resolveDataFile(primaryPath, fallbackPath) {
  const primary = path.join(__dirname, primaryPath);
  const fallback = path.join(__dirname, fallbackPath);
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  throw new Error(`Missing data file. Expected ${primaryPath} or ${fallbackPath}.`);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(text);
}

function readCsvRows(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] || "");

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

async function readXlsxRows(filePath) {
  const rows = await readXlsxFile(filePath);
  const headers = (rows[0] || []).map(text);

  return rows.slice(1).map((values) =>
    headers.reduce((row, header, index) => {
      if (header) row[header] = text(values[index]);
      return row;
    }, {})
  );
}

async function readSheetRows(primaryPath, fallbackPath) {
  const filePath = resolveDataFile(primaryPath, fallbackPath);
  if (filePath.toLowerCase().endsWith(".csv")) {
    return readCsvRows(filePath);
  }
  return readXlsxRows(filePath);
}

function text(value) {
  return String(value ?? "").trim();
}

function getColumn(row, columnName) {
  return text(row[columnName]);
}

async function loadStudents() {
  const c = config.credentialsColumns;
  const rows = await readSheetRows(config.files.credentials, config.files.credentialsFallback);
  return rows.map((row) => ({
    id: getColumn(row, c.studentId),
    name: getColumn(row, c.name),
    email: getColumn(row, c.email).toLowerCase(),
    password: getColumn(row, c.password),
    seatNumber: getColumn(row, c.seatNumber),
    className: getColumn(row, c.className),
    currentSemester: getColumn(row, c.currentSemester),
    academicYear: getColumn(row, c.academicYear)
  }));
}

async function countDegreeRows() {
  const rows = await readSheetRows(config.files.degrees, config.files.degreesFallback);
  return rows.length;
}

async function loadDegreesForStudent(studentId) {
  const c = config.degreesColumns;
  const rows = await readSheetRows(config.files.degrees, config.files.degreesFallback);
  return rows
    .filter((row) => getColumn(row, c.studentId) === studentId)
    .map((row) => ({
      semester: Number(getColumn(row, c.semester)) || 0,
      subjectCode: getColumn(row, c.subjectCode),
      subjectName: getColumn(row, c.subjectName),
      creditHours: getColumn(row, c.creditHours),
      score: getColumn(row, c.score),
      grade: getColumn(row, c.grade),
      status: getColumn(row, c.status),
      notes: getColumn(row, c.notes)
    }))
    .sort((a, b) => a.semester - b.semester || a.subjectCode.localeCompare(b.subjectCode));
}

async function loadDefaultSubjects() {
  const c = config.defaultSubjectColumns;
  const rows = await readSheetRows(config.files.defaultSubjects, config.files.defaultSubjectsFallback);
  return rows
    .map((row) => ({
      semester: Number(getColumn(row, c.semester)) || 0,
      subjectCode: getColumn(row, c.subjectCode),
      subjectName: getColumn(row, c.subjectName),
      creditHours: getColumn(row, c.creditHours),
      score: getColumn(row, c.score) || "Not added",
      grade: getColumn(row, c.grade) || "Not added",
      status: getColumn(row, c.status) || "Waiting for result",
      notes: getColumn(row, c.notes)
    }))
    .filter((row) => row.semester >= 1 && row.semester <= 10 && row.subjectCode)
    .sort((a, b) => a.semester - b.semester || a.subjectCode.localeCompare(b.subjectCode));
}

function mergeDefaultSubjectsWithStudentDegrees(defaultSubjects, studentDegrees) {
  const mergedByKey = new Map();

  defaultSubjects.forEach((subject) => {
    mergedByKey.set(`${subject.semester}-${subject.subjectCode}`, {
      ...subject,
      isDefault: true
    });
  });

  studentDegrees.forEach((subject) => {
    const key = `${subject.semester}-${subject.subjectCode}`;
    const existing = mergedByKey.get(key) || {};
    mergedByKey.set(key, {
      ...existing,
      ...subject,
      isDefault: false
    });
  });

  return Array.from(mergedByKey.values()).sort(
    (a, b) => a.semester - b.semester || a.subjectCode.localeCompare(b.subjectCode)
  );
}

function requireLogin(req, res, next) {
  if (!req.session.student) {
    return res.status(401).json({ message: "Please sign in first." });
  }
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.post("/api/login", asyncRoute(async (req, res) => {
  const email = text(req.body.email).toLowerCase();
  const password = text(req.body.password);
  const student = (await loadStudents()).find((item) => item.email === email && item.password === password);

  if (!student) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  req.session.student = {
    id: student.id,
    name: student.name,
    email: student.email,
    seatNumber: student.password || "SN",
    className: student.className || "Fifth",
    currentSemester: student.currentSemester || "2nd",
    academicYear: student.academicYear || "2025/2026"
  };
  portalStats.totalLogins += 1;
  portalStats.uniqueStudentIds.add(student.id);
  markSessionActive(req);

  res.json({ student: req.session.student });
}));

app.post("/api/logout", (req, res) => {
  portalStats.activeSessions.delete(req.sessionID);
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", requireLogin, (req, res) => {
  res.json({
    student: req.session.student,
    collegeName: config.collegeName
  });
});

app.get("/api/degrees", requireLogin, asyncRoute(async (req, res) => {
  const defaultSubjects = await loadDefaultSubjects();
  const studentDegrees = await loadDegreesForStudent(req.session.student.id);
  const rows = mergeDefaultSubjectsWithStudentDegrees(defaultSubjects, studentDegrees);
  const semesters = Array.from({ length: 10 }, (_, index) => {
    const semesterNumber = index + 1;
    return {
      number: semesterNumber,
      subjects: rows.filter((row) => row.semester === semesterNumber)
    };
  });

  res.json({ semesters });
}));

app.get("/api/stats", requireLogin, asyncRoute(async (req, res) => {
  cleanupActiveSessions();
  const students = await loadStudents();
  const defaultSubjects = await loadDefaultSubjects();
  const gradeRows = await countDegreeRows();

  res.json({
    onlineUsers: portalStats.activeSessions.size,
    totalLogins: portalStats.totalLogins,
    uniqueStudentsLoggedIn: portalStats.uniqueStudentIds.size,
    registeredStudents: students.length,
    defaultSubjects: defaultSubjects.length,
    gradeRows,
    activeWindowMinutes: ACTIVE_WINDOW_MS / 60000,
    updatedAt: new Date().toISOString()
  });
}));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "The portal could not read the student data files." });
});

app.listen(PORT, () => {
  console.log(`${config.collegeName} portal is running on port ${PORT}`);
});
