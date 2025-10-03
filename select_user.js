const STORAGE_KEY = "users";
const REDIRECT_URL = "Home_Page.html";

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
    // Migrasyon: stats eksikse tamamla
    const fixed = raw.map((u) => normalizeUserStats(u));
    // (İsteğe bağlı) geri yaz: veriyi normalize halde saklamak istersen
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

const searchInput = document.getElementById("searchInput");
const userList = document.getElementById("userList");
const emptyState = document.getElementById("emptyState");

const loginForm = document.getElementById("loginForm");
const selectedUserLabel = document.getElementById("selectedUserLabel");
const passwordInput = document.getElementById("passwordInput");
const togglePwBtn = document.getElementById("togglePwBtn");
const loginBtn = document.getElementById("loginBtn");
const backBtn = document.getElementById("backBtn");

let allUsers = [];
let filteredUsers = [];
let selectedUsername = null;

function renderList(list) {
  userList.innerHTML = "";

  if (!list.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.forEach((u) => {
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = u.username;
    btn.dataset.username = u.username;

    btn.addEventListener("click", () => {
      selectedUsername = u.username;
      selectedUserLabel.textContent = selectedUsername;
      loginBtn.disabled = false;
      passwordInput.focus();
    });

    li.appendChild(btn);
    userList.appendChild(li);
  });
}

function applyFilter() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    filteredUsers = [...allUsers];
  } else {
    filteredUsers = allUsers.filter((u) =>
      u.username.toLowerCase().includes(q)
    );
  }
  renderList(filteredUsers);
}

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

  const u = normalizeUserStats(users[idx]); // stats garanti olsun
  // En iyi skor
  if (typeof score === "number" && score > (u.stats.best[mode] ?? 0)) {
    u.stats.best[mode] = score;
  }
  // Oynanan oyun sayısı (mod-bazlı)
  u.stats.gamesPlayed[mode] = (u.stats.gamesPlayed[mode] ?? 0) + 1;

  users[idx] = u;
  saveUsers(users);
  return true;
}

(function init() {
  allUsers = readUsers();
  filteredUsers = [...allUsers];
  renderList(filteredUsers);

  const hasUsers = allUsers.length > 0;
  loginBtn.disabled = !hasUsers;
  passwordInput.disabled = !hasUsers;

  searchInput.addEventListener("input", applyFilter);
})();
