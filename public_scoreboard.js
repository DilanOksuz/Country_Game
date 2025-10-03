// public_scoreboard.js

const LS_USERS = "users";
const LS_LAST_MODE = "cg:lastMode";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function normalizeUserStats(u) {
  const s = (u && u.stats) || {};
  const best = s.best || {};
  const gp = s.gamesPlayed || {};
  return {
    ...u,
    username: String(u?.username ?? "").trim(),
    createdAt: u?.createdAt || "",
    stats: {
      best: {
        easy: safeNumber(best.easy, 0),
        medium: safeNumber(best.medium, 0),
        hard: safeNumber(best.hard, 0),
      },
      gamesPlayed: {
        easy: safeNumber(gp.easy, 0),
        medium: safeNumber(gp.medium, 0),
        hard: safeNumber(gp.hard, 0),
      },
    },
  };
}

function readUsers() {
  const arr = readJSON(LS_USERS, []);
  return (Array.isArray(arr) ? arr : []).map(normalizeUserStats);
}

function dedupeUsers(users) {
  const map = new Map();
  for (const u of users) {
    const key = (u.username || "").toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, u);
      continue;
    }
    const merged = { ...prev };
    merged.stats.best.easy = Math.max(prev.stats.best.easy, u.stats.best.easy);
    merged.stats.best.medium = Math.max(
      prev.stats.best.medium,
      u.stats.best.medium
    );
    merged.stats.best.hard = Math.max(prev.stats.best.hard, u.stats.best.hard);

    merged.stats.gamesPlayed.easy = Math.max(
      prev.stats.gamesPlayed.easy,
      u.stats.gamesPlayed.easy
    );
    merged.stats.gamesPlayed.medium = Math.max(
      prev.stats.gamesPlayed.medium,
      u.stats.gamesPlayed.medium
    );
    merged.stats.gamesPlayed.hard = Math.max(
      prev.stats.gamesPlayed.hard,
      u.stats.gamesPlayed.hard
    );

    const tPrev = new Date(prev.createdAt || 0).getTime() || 0;
    const tCur = new Date(u.createdAt || 0).getTime() || 0;
    if (tCur > tPrev) merged.createdAt = u.createdAt;

    map.set(key, merged);
  }
  return Array.from(map.values());
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const modeButtonsWrap = document.getElementById("modeButtons");
const scoreboardEl = document.getElementById("scoreboard");

if (modeButtonsWrap && scoreboardEl) {
  let mode = localStorage.getItem(LS_LAST_MODE) || "medium";
  setActiveModeButton(mode);
  render(mode);

  modeButtonsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    mode = btn.dataset.mode;
    localStorage.setItem(LS_LAST_MODE, mode);
    setActiveModeButton(mode);
    render(mode);
  });
}

function setActiveModeButton(mode) {
  const btns = modeButtonsWrap.querySelectorAll("button[data-mode]");
  btns.forEach((b) => {
    if (b.dataset.mode === mode) b.classList.add("active");
    else b.classList.remove("active");
  });
}

function render(selectedMode) {
  const users = dedupeUsers(readUsers());

  let rows = users.map((u) => {
    const best = safeNumber(u.stats?.best?.[selectedMode], 0);
    const played = safeNumber(u.stats?.gamesPlayed?.[selectedMode], 0);
    return {
      username: u.username || "-",
      best,
      played,
      createdAt: u.createdAt || "",
    };
  });

  rows = rows.filter((r) => r.best > 0);

  rows.sort((a, b) => {
    if (b.best !== a.best) return b.best - a.best;
    if (b.played !== a.played) return b.played - a.played;
    const ta = new Date(a.createdAt || 0).getTime() || 0;
    const tb = new Date(b.createdAt || 0).getTime() || 0;
    if (tb !== ta) return tb - ta;
    return a.username.localeCompare(b.username, "tr");
  });

  const top = rows.slice(0, 10);

  if (!top.length) {
    scoreboardEl.innerHTML = "<p>Bu mod için henüz skor yok.</p>";
    return;
  }

  const html = [
    "<ul class='score-list'>",
    ...top.map(
      (r, i) =>
        `<li>
          <span class="rank">#${i + 1}</span>
          <span class="user">${escapeHtml(r.username)}</span>
          <span class="score">${r.best}</span>
        </li>`
    ),
    "</ul>",
  ].join("");

  scoreboardEl.innerHTML = html;
}
