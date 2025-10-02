const STORAGE_KEY = "users";

// ---- Stats şablonu ----
function defaultStats() {
  return {
    best: { easy: 0, medium: 0, hard: 0 },
    gamesPlayed: { easy: 0, medium: 0, hard: 0 },
  };
}

// ---- Güvenli kayıt/okuma ----
function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function readUsers() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    // Migrasyon: stats yoksa ekle
    const fixed = arr.map((u) => normalizeUserStats(u));
    return fixed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
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

// ---- Salt & Hash ----
function generateSalt(length = 16) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- UI bağlama ----
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createUserForm");
  const backBtn = document.getElementById("backBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "Login_Page.html";
    });
  }

  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "Gizle";
        btn.setAttribute("aria-label", "Şifreyi gizle");
      } else {
        input.type = "password";
        btn.textContent = "Göster";
        btn.setAttribute("aria-label", "Şifreyi göster");
      }
    });
  });

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameEl = form.querySelector("[name='user_name']");
    const passEl = document.getElementById("Users_Password");
    const pass2El = document.getElementById("Users_Password_Comfirm");

    const username = (usernameEl?.value || "").trim();
    const password = (passEl?.value || "").trim();
    const passwordConfirm = (pass2El?.value || "").trim();

    if (!username || !password || !passwordConfirm) {
      alert("Lütfen tüm alanları doldurun!");
      return;
    }
    if (password !== passwordConfirm) {
      alert("Şifreler eşleşmiyor!");
      return;
    }

    const users = readUsers();
    const exists = users.some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) {
      alert("Bu kullanıcı adı zaten kayıtlı!");
      return;
    }

    const salt = generateSalt();
    const hashedPassword = await hashPassword(password, salt);

    users.push({
      username,
      password: hashedPassword,
      salt,
      createdAt: new Date().toISOString(),
      stats: defaultStats(), // <<< ÖNEMLİ: mod-bazlı skorlar burada başlatılıyor
    });

    saveUsers(users);

    usernameEl.value = "";
    passEl.value = "";
    pass2El.value = "";

    alert("Kullanıcı başarıyla kaydedildi!");
  });
});
