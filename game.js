// ============================
// Bayrak Tahmin Oyunu - game.js
// ============================

const LIST_URL =
  "https://restcountries.com/v3.1/all?fields=cca2,name,capital,population,flags";

const LS_USERS = "users";
const LS_USER_GAMES_PREFIX = "cg:games:"; // cg:games:<username>
const LS_LAST_GAME = "cg:lastGameCountries"; // Son seçilen 10 ülke
const LS_LAST_MODE = "cg:lastMode"; // son seçilen zorluk (buton için)

// ---------- LocalStorage yardımcıları ----------
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

// ---------- Kullanıcı istatistikleri ----------
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

// ---------- Oyun geçmişi ----------
function readUserGames(username) {
  return readJSON(LS_USER_GAMES_PREFIX + username, []);
}
function saveUserGames(username, games) {
  writeJSON(LS_USER_GAMES_PREFIX + username, games);
}

// ---------- Metin/puan yardımcıları ----------
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

// ---------- Nüfusa göre zorluk eşikleri ----------
const POP_EASY_MIN = 50_000_000; // Kolay: ≥ 50M
const POP_MED_MIN = 1_000_000; // Orta: 1M – 49,999,999
// Zor: < 1M

function pick10ByDifficulty(countries, mode) {
  // Geçersiz/0 nüfusluları süz
  const valid = countries.filter(
    (c) => Number.isFinite(c.population) && c.population > 0
  );

  const easyPool = valid.filter((c) => c.population >= POP_EASY_MIN);
  const mediumPool = valid.filter(
    (c) => c.population >= POP_MED_MIN && c.population < POP_EASY_MIN
  );
  const hardPool = valid.filter((c) => c.population < POP_MED_MIN);

  // Öncelik sırası modu göre
  let priority;
  if (mode === "easy") priority = [easyPool, mediumPool, hardPool];
  else if (mode === "hard") priority = [hardPool, mediumPool, easyPool];
  else priority = [mediumPool, easyPool, hardPool]; // default: medium

  // Havuzlardan sırayla örnekle, toplam 10 benzersiz ülke
  const picked = [];
  const seen = new Set();

  for (const pool of priority) {
    const remaining = pool.filter((c) => !seen.has(c.cca2));
    const take = Math.min(10 - picked.length, remaining.length);
    if (take > 0) {
      const chunk = sampleK(remaining, take);
      chunk.forEach((c) => {
        picked.push(c);
        seen.add(c.cca2);
      });
    }
    if (picked.length >= 10) break;
  }

  // Hâlâ 10’dan az ise tüm valid’den tamamla (çok küçük veri seti vb.)
  if (picked.length < 10) {
    const filler = sampleK(
      valid.filter((c) => !seen.has(c.cca2)),
      10 - picked.length
    );
    filler.forEach((c) => {
      picked.push(c);
      seen.add(c.cca2);
    });
  }

  return picked.slice(0, 10);
}

// ---------- DOM ----------
const modeButtonsWrap = document.getElementById("modeButtons");
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

// ---------- Oyun durumu ----------
let allCountries = [];
let picks = [];
let idx = -1;
let totalScore = 0;
let mode = localStorage.getItem(LS_LAST_MODE) || "medium";
let perQuestion = [];

// ---------- UI yardımcıları ----------
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
function markActiveModeButton() {
  const btns = modeButtonsWrap.querySelectorAll(".mode-btn");
  btns.forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

// ---------- Tarih/Yardımcılar ----------
function fmtDate(s) {
  try {
    return new Date(s).toLocaleString("tr-TR");
  } catch {
    return s || "-";
  }
}

// ---------- Son 10 oyun (kullanıcı) ----------
function renderLast10(username) {
  const host = document.getElementById("last10");
  if (!host) return;

  const games = readUserGames(username) || [];

  games.sort((a, b) => {
    const ta = new Date(a.playedAt).getTime() || 0;
    const tb = new Date(b.playedAt).getTime() || 0;
    return tb - ta;
  });

  const last10 = games.slice(0, 10);

  if (!last10.length) {
    host.innerHTML = "<p>Henüz oyun geçmişi yok.</p>";
    return;
  }

  const html = [
    "<table border='1' cellpadding='6'>",
    "<thead><tr><th>#</th><th>Tarih</th><th>Mod</th><th>Skor</th></tr></thead>",
    "<tbody>",
    ...last10.map((g, i) => {
      const modeLabel =
        g.mode === "easy" ? "Kolay" : g.mode === "hard" ? "Zor" : "Orta";
      return `<tr>
        <td>${i + 1}</td>
        <td>${fmtDate(g.playedAt)}</td>
        <td>${modeLabel}</td>
        <td>${g.totalScore}</td>
      </tr>`;
    }),
    "</tbody>",
    "</table>",
  ].join("");

  host.innerHTML = html;
}
function showLast10Section(show) {
  const sec = document.getElementById("last10Section");
  if (!sec) return;
  sec.style.display = show ? "block" : "none";
}

// ---------- Veri çekme ----------
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

// ---------- Oyun akışı ----------
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

  showLast10Section(false); // yeni oyunda geçmişi gizle

  // UI kilitle
  [startBtn, restartBtn, submitBtn, nextBtn].forEach(
    (b) => (b.disabled = true)
  );
  feedbackEl.textContent = "Yükleniyor...";

  try {
    if (!allCountries.length) {
      allCountries = await fetchCountries();
    }

    // 10 ülke seç
    picks = pick10ByDifficulty(allCountries, mode);

    writeJSON(LS_LAST_GAME, {
      mode,
      savedAt: new Date().toISOString(),
      countries: picks,
    });

    // oyun state reset
    idx = 0;
    totalScore = 0;
    perQuestion = [];

    feedbackEl.textContent = "";
    playArea.style.display = "block";

    renderQuestion();
    restartBtn.disabled = false;
  } catch (err) {
    feedbackEl.textContent = "Hata: " + (err?.message || err);
  } finally {
    startBtn.disabled = false; // başlat tekrar aktif
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
  hideCorrectCard();
  playArea.style.display = "none";
  renderStatus();

  // Oyun biter bitmez son 10 oyunu göster
  showLast10Section(true);
  renderLast10(username);
}

// ---------- Zorluk butonları ----------
modeButtonsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  mode = btn.dataset.mode; // easy | medium | hard
  localStorage.setItem(LS_LAST_MODE, mode);
  // görsel aktiflik için class ekliyorsan burada yönetebilirsin (CSS’siz de çalışır)
});

// ---------- Olay bağlama ----------
startBtn.addEventListener("click", startGame);
form.addEventListener("submit", checkAnswer);
nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", startGame);

// ---------- İlk kurulum ----------
setQuizEnabled(false);
submitBtn.disabled = true;
nextBtn.disabled = true;
renderStatus();
