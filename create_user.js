const STORAGE_KEY = "users";

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}
//salt eklememizin amacı şu ki, iki kullanıcı aynı parolayı secerlerse aynı hash uygulanıp da aynı şekilde datasette saklanmasın.
function generateSalt(length = 16) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

//asyn:asenkron calısıp promise dondurur.
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createUserForm");
  const backBtn = document.getElementById("backBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "Login_Page.html";
    });
  }

  // Göster/Gizle butonları
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
    });
    saveUsers(users);

    usernameEl.value = "";
    passEl.value = "";
    pass2El.value = "";

    alert("Kullanıcı başarıyla kaydedildi!");
  });
});
