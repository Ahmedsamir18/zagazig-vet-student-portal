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
const className = document.querySelector("#className");
const currentSemester = document.querySelector("#currentSemester");
const academicYear = document.querySelector("#academicYear");
const logoutButton = document.querySelector("#logoutButton");
const refreshDegrees = document.querySelector("#refreshDegrees");
const refreshStats = document.querySelector("#refreshStats");
const openDegreesButton = document.querySelector("#openDegreesButton");
const semesterTabs = document.querySelector("#semesterTabs");
const semesterContent = document.querySelector("#semesterContent");
const homeButtons = document.querySelectorAll("[data-go-home]");
const pageOpeners = document.querySelectorAll("[data-open-page]");

// GAME START: remove this block with the game HTML and CSS blocks to delete the game.
const gameBoard = document.querySelector("#gameBoard");
const restartGame = document.querySelector("#restartGame");
const gameMoves = document.querySelector("#gameMoves");
const gameMatches = document.querySelector("#gameMatches");
const gameMessage = document.querySelector("#gameMessage");
const gamePairs = [
  { pair: "anatomy", text: "Anatomy", match: "Body structures" },
  { pair: "surgery", text: "Surgery", match: "Operating room" },
  { pair: "microbiology", text: "Microbiology", match: "Bacteria" },
  { pair: "pharmacology", text: "Pharmacology", match: "Medicines" },
  { pair: "pathology", text: "Pathology", match: "Disease changes" },
  { pair: "nutrition", text: "Nutrition", match: "Animal feed" }
];
let gameCards = [];
let flippedCards = [];
let matchedPairs = 0;
let moveCount = 0;
let gameLocked = false;
// GAME END

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
  seatNum.textContent = student.seatNumber || "password";
  studentId.textContent = student.id || "ID";
  className.textContent = student.className || "Fifth class";
  currentSemester.textContent = student.currentSemester || "Second semester";
  academicYear.textContent = student.academicYear || "2025/2026";
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

  if (isHome) {
    loadStats();
  }

  if (path === "/game") {
    startGame();
  }
}

function setStat(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

async function loadStats() {
  const note = document.querySelector("#statsUpdatedAt");
  try {
    const stats = await requestJson("/api/stats");
    setStat("onlineUsers", stats.onlineUsers);
    setStat("totalLogins", stats.totalLogins);
    setStat("uniqueStudentsLoggedIn", stats.uniqueStudentsLoggedIn);
    setStat("registeredStudents", stats.registeredStudents);
    setStat("defaultSubjects", stats.defaultSubjects);
    setStat("gradeRows", stats.gradeRows);
    if (note) {
      const updated = new Date(stats.updatedAt);
      note.textContent = `Last updated ${updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Online means active in the last ${stats.activeWindowMinutes} minutes.`;
    }
  } catch (error) {
    if (note) note.textContent = "Stats are not available right now.";
  }
}

function statusClass(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail") || normalized.includes("retake") || normalized.includes("review")) return "danger";
  if (normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("incomplete")) return "warn";
  return "";
}

// GAME START: remove this block with the game HTML and CSS blocks to delete the game.
function shuffleCards(cards) {
  return [...cards].sort(() => Math.random() - 0.5);
}

function buildGameCards() {
  return shuffleCards(
    gamePairs.flatMap((item) => [
      { pair: item.pair, text: item.text },
      { pair: item.pair, text: item.match }
    ])
  );
}

function updateGameStatus(message) {
  if (gameMoves) gameMoves.textContent = moveCount;
  if (gameMatches) gameMatches.textContent = matchedPairs;
  if (gameMessage) gameMessage.textContent = message;
}

function renderGameBoard() {
  if (!gameBoard) return;
  gameBoard.innerHTML = gameCards
    .map(
      (card, index) => `
        <button class="game-card ${card.matched ? "is-matched" : ""} ${card.flipped ? "is-flipped" : ""}" data-card-index="${index}" type="button">
          <span class="game-card-face game-card-back">?</span>
          <span class="game-card-face game-card-front">${escapeHtml(card.text)}</span>
        </button>
      `
    )
    .join("");
}

function startGame() {
  if (!gameBoard) return;
  gameCards = buildGameCards().map((card) => ({ ...card, flipped: false, matched: false }));
  flippedCards = [];
  matchedPairs = 0;
  moveCount = 0;
  gameLocked = false;
  updateGameStatus("Choose two cards to start.");
  renderGameBoard();
}

function flipGameCard(index) {
  if (gameLocked || !gameCards[index] || gameCards[index].flipped || gameCards[index].matched) return;

  gameCards[index].flipped = true;
  flippedCards.push(index);
  renderGameBoard();

  if (flippedCards.length < 2) {
    updateGameStatus("Choose one more card.");
    return;
  }

  moveCount += 1;
  const [firstIndex, secondIndex] = flippedCards;
  const firstCard = gameCards[firstIndex];
  const secondCard = gameCards[secondIndex];

  if (firstCard.pair === secondCard.pair) {
    firstCard.matched = true;
    secondCard.matched = true;
    matchedPairs += 1;
    flippedCards = [];
    updateGameStatus(matchedPairs === gamePairs.length ? "Great work. You matched every pair." : "Nice match. Keep going.");
    renderGameBoard();
    return;
  }

  gameLocked = true;
  updateGameStatus("Not a match. Try another pair.");
  setTimeout(() => {
    firstCard.flipped = false;
    secondCard.flipped = false;
    flippedCards = [];
    gameLocked = false;
    updateGameStatus("Choose two cards.");
    renderGameBoard();
  }, 750);
}
// GAME END

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
refreshStats.addEventListener("click", loadStats);
openDegreesButton.addEventListener("click", () => routeTo("/degrees"));

homeButtons.forEach((button) => {
  button.addEventListener("click", () => routeTo("/"));
});

pageOpeners.forEach((button) => {
  button.addEventListener("click", () => routeTo(button.dataset.openPage));
});

// GAME START: remove this block with the game HTML and CSS blocks to delete the game.
if (restartGame) {
  restartGame.addEventListener("click", startGame);
}

if (gameBoard) {
  gameBoard.addEventListener("click", (event) => {
    const card = event.target.closest("[data-card-index]");
    if (!card) return;
    flipGameCard(Number(card.dataset.cardIndex));
  });
}
// GAME END

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
