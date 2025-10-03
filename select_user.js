const STORAGE_KEY = "users";
const REDIRECT_URL = "Home_Page.html";

// -------- Helpers --------
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

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function readUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const fixed = raw.map((u) => normalizeUserStats(u));
    saveUsers(fixed);
    return fixed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function findUserByName(users, name) {
  const n = String(name).trim().toLowerCase();
  return users.find((u) => u.username.toLowerCase() === n) || null;
}

// -------- DOM --------
const searchInput = document.getElementById("searchInput");
const userList = document.getElementById("userList");
const emptyState = document.getElementById("emptyState");

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const selectedUserLabel = document.getElementById("selectedUserLabel");
const passwordInput = document.getElementById("passwordInput");
const togglePwBtn = document.getElementById("togglePwBtn");
const loginBtn = document.getElementById("loginBtn");
const backBtn = document.getElementById("backBtn");

// -------- State --------
let allUsers = [];
let filteredUsers = [];
let selectedUsername = null;

// -------- UI helpers --------
// Sadece 'is-open' sınıfını kullanıyoruz (CSS'in zaten hazır)
function showLoginCard(show) {
  loginCard.classList.toggle("is-open", !!show);
  loginCard.setAttribute("aria-hidden", String(!show));
  passwordInput.disabled = !show;
  loginBtn.disabled = !show;

  if (show) {
    setTimeout(() => passwordInput.focus(), 0);
  } else {
    passwordInput.value = "";
    selectedUserLabel.textContent = "—";
    selectedUsername = null;
  }
}

function renderList(list) {
  userList.innerHTML = "";

  if (!list.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.forEach((u) => {
    const li = document.createElement("li");

    // <li> tıklanabilir olsun ya da istersen içine button koyabilirsin
    li.textContent = u.username;
    li.tabIndex = 0;

    const handleSelect = () => {
      selectedUsername = u.username;
      selectedUserLabel.textContent = selectedUsername;
      showLoginCard(true); // kartı aç
      loginCard.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    li.addEventListener("click", handleSelect);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    });

    userList.appendChild(li);
  });
}

function applyFilter() {
  const q = searchInput.value.trim().toLowerCase();
  filteredUsers = !q
    ? [...allUsers]
    : allUsers.filter((u) => u.username.toLowerCase().includes(q));
  renderList(filteredUsers);
}

// -------- Events --------
togglePwBtn.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    togglePwBtn.textContent = "Gizle";
    togglePwBtn.setAttribute("aria-label", "Şifreyi gizle");
  } else {
    passwordInput.type = "password";
    togglePwBtn.textContent = "Göster";
    togglePwBtn.setAttribute("aria-label", "Şifreyi göster");
  }
});

backBtn.addEventListener("click", () => {
  // Sadece kartı kapatmak istersen:
  // showLoginCard(false);
  // Geri sayfasına dönmek istersen:
  window.location.href = "Login_Page.html";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedUsername) {
    alert("Lütfen listeden bir kullanıcı seçin.");
    return;
  }
  const pwd = passwordInput.value.trim();
  if (!pwd) {
    alert("Lütfen şifrenizi girin.");
    return;
  }

  const user = findUserByName(allUsers, selectedUsername);
  if (!user) {
    alert("Kullanıcı bulunamadı.");
    return;
  }

  const hashed = await hashPassword(pwd, user.salt);
  if (hashed !== user.password) {
    alert("Şifre hatalı.");
    passwordInput.select();
    return;
  }

  localStorage.setItem("current_user", user.username);
  const url = new URL(REDIRECT_URL, window.location.href);
  url.searchParams.set("user", user.username);
  window.location.href = url.toString();
});

function updateBestScore(username, mode, score) {
  const valid = ["easy", "medium", "hard"];
  if (!valid.includes(mode)) throw new Error("Geçersiz mod: " + mode);

  const users = readUsers();
  const idx = users.findIndex(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
  if (idx === -1) return false;

  const u = normalizeUserStats(users[idx]);
  if (typeof score === "number" && score > (u.stats.best[mode] ?? 0)) {
    u.stats.best[mode] = score;
  }
  u.stats.gamesPlayed[mode] = (u.stats.gamesPlayed[mode] ?? 0) + 1;

  users[idx] = u;
  saveUsers(users);
  return true;
}

(function init() {
  allUsers = readUsers();
  filteredUsers = [...allUsers];
  renderList(filteredUsers);

  showLoginCard(false);

  searchInput.addEventListener("input", applyFilter);
})();
