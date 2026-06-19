const loginView = document.querySelector("#loginView");
const portalView = document.querySelector("#portalView");
const homePage = document.querySelector("#homePage");
const degreesPage = document.querySelector("#degreesPage");
const infoPages = document.querySelectorAll("[data-info-page]");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const studentName = document.querySelector("#studentName");
const seatNum = document.querySelector("#seatNum");
const studentId = document.querySelector("#studentId");
const logoutButton = document.querySelector("#logoutButton");
const refreshDegrees = document.querySelector("#refreshDegrees");
const openDegreesButton = document.querySelector("#openDegreesButton");
const semesterTabs = document.querySelector("#semesterTabs");
const semesterContent = document.querySelector("#semesterContent");
const homeButtons = document.querySelectorAll("[data-go-home]");
const pageOpeners = document.querySelectorAll("[data-open-page]");

let semesters = [];
let activeSemester = 1;
let currentStudent = null;

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showPortal(student) {
  currentStudent = student;
  studentName.textContent = student.name || "Student";
  seatNum.textContent = student.pass || "SN";
  studentId.textContent = student.id || "ID";
  loginView.classList.add("hidden");
  portalView.classList.remove("hidden");
  routeTo(window.location.pathname, false);
}

function showLogin() {
  currentStudent = null;
  portalView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function routeTo(path, pushState = true) {
  if (!currentStudent && path !== "/home") return;

  const isDegrees = path === "/degrees";
  const matchingInfoPage = Array.from(infoPages).find((page) => page.dataset.infoPage === path);
  const isHome = path === "/" || path === "/home" || (!isDegrees && !matchingInfoPage);

  homePage.classList.toggle("hidden", !isHome);
  degreesPage.classList.toggle("hidden", !isDegrees);
  infoPages.forEach((page) => {
    page.classList.toggle("hidden", page !== matchingInfoPage);
  });

  if (pushState) {
    history.pushState({}, "", isHome ? "/" : path);
  }

  if (isDegrees) {
    loadDegrees();
  }
}

function statusClass(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail") || normalized.includes("retake") || normalized.includes("review")) return "danger";
  if (normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("incomplete")) return "warn";
  return "";
}

function renderSemesterTabs() {
  semesterTabs.innerHTML = semesters
    .map((semester) => {
      const count = semester.subjects.length;
      return `
        <button class="semester-tab ${semester.number === activeSemester ? "is-active" : ""}" data-semester="${semester.number}" type="button">
          Semester ${semester.number}${count ? ` (${count})` : ""}
        </button>
      `;
    })
    .join("");
}

function renderSemesterContent() {
  const semester = semesters.find((item) => item.number === activeSemester);

  if (!semester || semester.subjects.length === 0) {
    semesterContent.innerHTML = `
      <div class="empty-state">
        No default subjects have been added for semester ${activeSemester} yet.
      </div>
    `;
    return;
  }

  const rows = semester.subjects
    .map(
      (subject) => `
        <tr>
          <td>${escapeHtml(subject.subjectCode)}</td>
          <td>
            <strong>${escapeHtml(subject.subjectName)}</strong>
            ${subject.isDefault ? '<small class="row-note">Default row</small>' : '<small class="row-note row-note-live">Updated from grades file</small>'}
          </td>
          <td>${escapeHtml(subject.creditHours)}</td>
          <td>${escapeHtml(subject.score)}</td>
          <td>${escapeHtml(subject.grade)}</td>
          <td><span class="status-pill ${statusClass(subject.status)}">${escapeHtml(subject.status || "Recorded")}</span></td>
          <td>${escapeHtml(subject.notes || "")}</td>
        </tr>
      `
    )
    .join("");

  semesterContent.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Subject</th>
            <th>Hours</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadDegrees() {
  semesterContent.innerHTML = `<div class="empty-state">Loading degree records...</div>`;
  const data = await requestJson("/api/degrees");
  semesters = data.semesters;
  renderSemesterTabs();
  renderSemesterContent();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  try {
    const formData = new FormData(loginForm);
    const data = await requestJson("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    loginForm.reset();
    showPortal(data.student);
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/logout", { method: "POST" });
  history.pushState({}, "", "/");
  showLogin();
});

refreshDegrees.addEventListener("click", loadDegrees);
openDegreesButton.addEventListener("click", () => routeTo("/degrees"));

homeButtons.forEach((button) => {
  button.addEventListener("click", () => routeTo("/"));
});

pageOpeners.forEach((button) => {
  button.addEventListener("click", () => routeTo(button.dataset.openPage));
});

semesterTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".semester-tab");
  if (!button) return;
  activeSemester = Number(button.dataset.semester);
  renderSemesterTabs();
  renderSemesterContent();
});

window.addEventListener("popstate", () => {
  if (currentStudent) routeTo(window.location.pathname, false);
});

requestJson("/api/me")
  .then((data) => showPortal(data.student))
  .catch(showLogin);
