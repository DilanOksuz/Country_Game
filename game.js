const LIST_URL =
  "https://restcountries.com/v3.1/all?fields=cca2,name,capital,population,flags";

const LS_USERS = "users";
const LS_USER_GAMES_PREFIX = "cg:games:"; // cg:games:<username>

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function defaultStats() {
  return {
    best: { easy: 0, medium: 0, hard: 0 },
    gamesPlayed: { easy: 0, medium: 0, hard: 0 },
  };
}
function normalizeUserStats(u) {
  const s = u.stats || {};
  const best = s.best || {};
  const gp = s.gamesPlayed || {};
  return {
    ...u,
    stats: {
      best: {
        easy: Number.isFinite(best.easy) ? best.easy : 0,
        medium: Number.isFinite(best.medium) ? best.medium : 0,
        hard: Number.isFinite(best.hard) ? best.hard : 0,
      },
      gamesPlayed: {
        easy: Number.isFinite(gp.easy) ? gp.easy : 0,
        medium: Number.isFinite(gp.medium) ? gp.medium : 0,
        hard: Number.isFinite(gp.hard) ? gp.hard : 0,
      },
    },
  };
}
function readUsers() {
  const arr = readJSON(LS_USERS, []);
  const fixed = (arr || []).map(normalizeUserStats);
  writeJSON(LS_USERS, fixed);
  return fixed;
}
function saveUsers(users) {
  writeJSON(LS_USERS, users);
}
function findUserByName(users, name) {
  const n = String(name).trim().toLowerCase();
  return users.find((u) => u.username.toLowerCase() === n) || null;
}

function getCurrentUsername() {
  return localStorage.getItem("current_user") || null;
}

function readUserGames(username) {
  return readJSON(LS_USER_GAMES_PREFIX + username, []);
}
function saveUserGames(username, games) {
  writeJSON(LS_USER_GAMES_PREFIX + username, games);
}

function normalizeText(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
function isPopulationClose(guess, correct, tol = 0.1) {
  const g = Number(guess);
  if (!Number.isFinite(g)) return false;
  const min = correct * (1 - tol);
  const max = correct * (1 + tol);
  return g >= min && g <= max;
}
function scoreFor(qRes) {
  return (
    (qRes.nameOK ? 30 : 0) +
    (qRes.capitalOK ? 30 : 0) +
    (qRes.populationOK ? 40 : 0)
  );
}
function sampleK(arr, k) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(k, a.length));
}
function pick10ByDifficulty(countries, mode) {
  const sorted = [...countries].sort((a, b) => a.population - b.population);
  const n = sorted.length;
  const third = Math.max(1, Math.floor(n / 3));
  let pool;
  if (mode === "easy") pool = sorted.slice(-third);
  else if (mode === "hard") pool = sorted.slice(0, third);
  else pool = sorted;
  return sampleK(pool, 10);
}

const modeSel = document.getElementById("mode");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");

const playArea = document.getElementById("playArea");
const flagImg = document.getElementById("flagImg");

const form = document.getElementById("answerForm");
const nameInput = document.getElementById("guessName");
const capitalInput = document.getElementById("guessCapital");
const popInput = document.getElementById("guessPopulation");

const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const feedbackEl = document.getElementById("feedback");

const correctCard = document.getElementById("correctCard");
const correctFlag = document.getElementById("correctFlag");
const correctName = document.getElementById("correctName");
const correctCapital = document.getElementById("correctCapital");
const correctPopulation = document.getElementById("correctPopulation");

let allCountries = [];
let picks = [];
let idx = -1;
let totalScore = 0;
let mode = "medium";
let perQuestion = [];

async function fetchCountries() {
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error("REST Countries alınamadı: " + res.status);
  const data = await res.json();
  return data
    .map((c) => ({
      cca2: c.cca2,
      name: c.name?.common ?? "",
      capital: Array.isArray(c.capital) && c.capital.length ? c.capital[0] : "",
      population: Number(c.population) || 0,
      flag: c.flags?.png || c.flags?.svg || "",
    }))
    .filter((c) => c.cca2 && c.name && c.flag);
}

function setQuizEnabled(enabled) {
  nameInput.disabled = !enabled;
  capitalInput.disabled = !enabled;
  popInput.disabled = !enabled;
  submitBtn.disabled = !enabled;
}
function clearInputs() {
  nameInput.value = "";
  capitalInput.value = "";
  popInput.value = "";
}
function renderStatus() {
  progressEl.textContent = `${Math.max(0, idx + 1)} / 10`;
  scoreEl.textContent = String(totalScore);
}
function showCorrectCard(country) {
  correctFlag.src = country.flag;
  correctName.textContent = country.name || "-";
  correctCapital.textContent = country.capital || "-";
  correctPopulation.textContent = Number(country.population).toLocaleString(
    "tr-TR"
  );
  correctCard.style.display = "block";
}
function hideCorrectCard() {
  correctCard.style.display = "none";
  correctFlag.removeAttribute("src");
  correctName.textContent = "";
  correctCapital.textContent = "";
  correctPopulation.textContent = "";
}

function renderQuestion() {
  const c = picks[idx];
  flagImg.src = c.flag;
  flagImg.alt = "Bayrak";

  clearInputs();
  feedbackEl.textContent = "";
  hideCorrectCard();

  setQuizEnabled(true);
  submitBtn.disabled = false;
  nextBtn.disabled = true;

  renderStatus();
}

async function startGame() {
  const curUser = getCurrentUsername();
  if (!curUser) {
    alert("Önce giriş yapın / kullanıcı seçin.");
    return;
  }

  startBtn.disabled = true;
  restartBtn.disabled = true;
  submitBtn.disabled = true;
  nextBtn.disabled = true;
  feedbackEl.textContent = "Yükleniyor...";

  mode = modeSel.value || "choice";

  try {
    if (!allCountries.length) {
      allCountries = await fetchCountries();
    }
    picks = pick10ByDifficulty(allCountries, mode);
    idx = 0;
    totalScore = 0;
    perQuestion = [];

    feedbackEl.textContent = "";
    playArea.style.display = "block";
    modeSel.disabled = true;

    renderQuestion();
    restartBtn.disabled = false;
  } catch (err) {
    feedbackEl.textContent = "Hata: " + (err?.message || err);
    startBtn.disabled = false;
  }
}

function checkAnswer(e) {
  e.preventDefault();
  setQuizEnabled(false);

  const c = picks[idx];

  const nameOK = normalizeText(nameInput.value) === normalizeText(c.name);
  const capitalOK =
    normalizeText(capitalInput.value) === normalizeText(c.capital);
  const populationOK = isPopulationClose(popInput.value, c.population, 0.1);

  const gained = scoreFor({ nameOK, capitalOK, populationOK });
  totalScore += gained;

  const popTR = Number(c.population).toLocaleString("tr-TR");
  feedbackEl.innerHTML = `Sonuç: [Ad ${nameOK ? "✓" : "✗"}] [Başkent ${
    capitalOK ? "✓" : "✗"
  }] [Nüfus ${populationOK ? "✓" : "✗"}] (+${gained})`;

  showCorrectCard(c);

  submitBtn.disabled = true;
  nextBtn.disabled = false;
  renderStatus();

  perQuestion.push({
    index: idx,
    code: c.cca2,
    nameOK,
    capitalOK,
    populationOK,
    gained,
  });
}

function nextQuestion() {
  if (idx < 9) {
    idx++;
    renderQuestion();
  } else {
    endGame();
  }
}

function endGame() {
  const username = getCurrentUsername();
  if (!username) {
    alert("Aktif kullanıcı bulunamadı.");
    return;
  }

  const users = readUsers();
  const i = users.findIndex(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (i !== -1) {
    const u = normalizeUserStats(users[i]);
    if (totalScore > (u.stats.best[mode] ?? 0)) {
      u.stats.best[mode] = totalScore;
    }
    u.stats.gamesPlayed[mode] = (u.stats.gamesPlayed[mode] ?? 0) + 1;
    users[i] = u;
    saveUsers(users);
  }

  const games = readUserGames(username);
  games.push({
    playedAt: new Date().toISOString(),
    mode,
    totalScore,
    questions: perQuestion,
  });
  if (games.length > 50) games.splice(0, games.length - 50);
  saveUserGames(username, games);

  feedbackEl.innerHTML = `<strong>Tur bitti.</strong> Toplam skor: ${totalScore}. Mod: ${mode}.`;
  submitBtn.disabled = true;
  nextBtn.disabled = true;
  startBtn.disabled = false;
  modeSel.disabled = false;
  hideCorrectCard();
  playArea.style.display = "none"; // oyun alanını kapat
  renderStatus();
}

modeSel.addEventListener("change", () => {
  startBtn.disabled = false;
});

startBtn.addEventListener("click", startGame);
form.addEventListener("submit", checkAnswer);
nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", startGame);

setQuizEnabled(false);
submitBtn.disabled = true;
nextBtn.disabled = true;
renderStatus();
startBtn.disabled = true;
