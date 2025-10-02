const LS_USERS = "users";
const LS_LAST_MODE = "cg:lastMode";

// --------- helpers ----------
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
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
  return (arr || []).map(normalizeUserStats);
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------- DOM refs ----------
const modeButtonsWrap = document.getElementById("modeButtons");
const scoreboardEl = document.getElementById("scoreboard");

// remember last choice
let mode = localStorage.getItem(LS_LAST_MODE) || "medium";

// initial render
render(mode);

// mode buttons
modeButtonsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn) return;
  mode = btn.dataset.mode; // "easy" | "medium" | "hard"
  localStorage.setItem(LS_LAST_MODE, mode);
  render(mode);
});

// --------- render ----------
function render(selectedMode) {
  const users = readUsers();

  const rows = users
    .map((u) => {
      const score = u.stats?.best?.[selectedMode] ?? 0;
      const played = u.stats?.gamesPlayed?.[selectedMode] ?? 0;
      return {
        username: u.username,
        best: Number(score) || 0,
        played: Number(played) || 0,
      };
    })
    .filter((r) => r.best > 0);

  rows.sort((a, b) => {
    if (b.best !== a.best) return b.best - a.best;
    if (b.played !== a.played) return b.played - a.played;
    return a.username.localeCompare(b.username, "tr");
  });

  const top = rows.slice(0, 10);

  if (!top.length) {
    scoreboardEl.innerHTML = "<p>Bu mod için henüz skor yok.</p>";
    return;
  }

  const table = [
    "<table border='1' cellpadding='6'>",
    "<thead><tr><th>#</th><th>Kullanıcı</th><th>En İyi Skor</th><th>Oynanan (Mod)</th></tr></thead>",
    "<tbody>",
    ...top.map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(r.username)}</td><td>${
          r.best
        }</td><td>${r.played}</td></tr>`
    ),
    "</tbody>",
    "</table>",
  ].join("");

  scoreboardEl.innerHTML = table;
}
