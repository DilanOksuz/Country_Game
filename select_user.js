const STORAGE_KEY = "users";
const REDIRECT_URL = "Home_Page.html";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

(function init() {
  allUsers = readUsers();
  filteredUsers = [...allUsers];
  renderList(filteredUsers);

  const hasUsers = allUsers.length > 0;
  loginBtn.disabled = !hasUsers;
  passwordInput.disabled = !hasUsers;

  searchInput.addEventListener("input", applyFilter);
})();
