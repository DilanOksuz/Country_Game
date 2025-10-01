const LIST_URL = "https://restcountries.com/v3.1/all?fields=cca2";
const DETAILS_URL = (codes) =>
  `https://restcountries.com/v3.1/alpha?codes=${codes.join(
    ","
  )}&fields=cca2,name,capital,population,flags`;

const container = document.getElementById("flags");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");

const LS_PICKS = "flags:picks";
const LS_INDEX = "flags:index";

/* --- Yardımcılar --- */
function sampleK(arr, k) {
  // DİKKAT: orijinal kodda object spread ile kopyalama hatası vardı.
  const a = arr.slice(); // güvenli kopya
  // Fisher–Yates'in k elemanlık kısmını uygula (son k konumu karıştır)
  for (let i = a.length - 1; i >= a.length - k; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(-k);
}

function safeCapital(cap) {
  return Array.isArray(cap) && cap.length ? cap[0] : "Yok";
}

function preload(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("Geçersiz resim"));
    const im = new Image();
    im.onload = () => resolve();
    im.onerror = reject;
    im.src = src;
  });
}

function toCardHTML(c, i, total) {
  const pop = Number(c.population || 0).toLocaleString("tr-TR");
  return `
    <div style="display:flex;gap:12px;align-items:center;border:1px solid #ddd;border-radius:10px;padding:12px">
      <img src="${c.flag}" alt="${
    c.name
  }" width="160" style="max-width:45%;height:auto;border-radius:6px" />
      <div>
        <h3 style="margin:0 0 6px">${c.name}</h3>
        <p style="margin:0">Başkent: ${c.capital}</p>
        <p style="margin:4px 0 0">Nüfus: ${pop}</p>
        <small style="color:#666">${i + 1} / ${total}</small>
      </div>
    </div>
  `;
}

function savePicks(picks) {
  localStorage.setItem(LS_PICKS, JSON.stringify(picks));
}

function loadPicks() {
  try {
    return JSON.parse(localStorage.getItem(LS_PICKS) || "null");
  } catch {
    return null;
  }
}

function saveIndex(i) {
  localStorage.setItem(LS_INDEX, String(i));
}

function loadIndex() {
  const raw = localStorage.getItem(LS_INDEX);
  return raw == null ? -1 : parseInt(raw, 10);
}

/* --- Veri çekme --- */
async function fetchTenCountries() {
  const listRes = await fetch(LIST_URL);
  if (!listRes.ok) throw new Error("Kod listesi alınamadı: " + listRes.status);
  const list = await listRes.json();

  const codes = sampleK(
    list.map((x) => x.cca2),
    10
  );

  const detRes = await fetch(DETAILS_URL(codes));
  if (!detRes.ok) throw new Error("Detaylar alınamadı: " + detRes.status);
  const details = await detRes.json();

  const byCode = new Map(details.map((c) => [c.cca2, c]));
  const ordered = codes.map((code) => byCode.get(code)).filter(Boolean);

  return ordered.map((c) => ({
    code: c.cca2,
    name: c.name?.common || "-",
    capital: safeCapital(c.capital),
    population: c.population ?? 0,
    // DİKKAT: doğru alan 'flags', 'flag' değil
    flag: c.flags?.png || c.flags?.svg || "",
  }));
}

/* --- Akış --- */
async function createNewSet() {
  container.textContent = "Yükleniyor...";
  nextBtn.disabled = true;
  restartBtn.style.display = "none";

  try {
    const picks = await fetchTenCountries();

    // ilk resmi önden yüklemeye çalış (opsiyonel)
    if (picks[0]?.flag) {
      try {
        await preload(picks[0].flag);
      } catch {
        /* görmezden gel */
      }
    }

    savePicks(picks);
    saveIndex(-1);
    container.textContent = "Ülkeler hazır.";
    gotoNext(); // hemen ilkini göster
  } catch (err) {
    container.textContent = "Bir hata oluştu: " + (err?.message || err);
    nextBtn.disabled = false;
    restartBtn.style.display = "inline-block";
  }
}

function renderAt(index) {
  const picks = loadPicks() || [];
  const total = picks.length;
  if (!total) {
    container.textContent = "Liste boş görünüyor.";
    nextBtn.disabled = false;
    restartBtn.style.display = "inline-block";
    return;
  }
  if (index < 0 || index >= total) {
    container.innerHTML = `
      <div style="padding:12px;border:1px dashed #aaa;border-radius:10px">
        <strong>Tüm kartlar bitti.</strong><br/>Yeni bir set başlatabilirsiniz.
      </div>`;
    nextBtn.disabled = true;
    restartBtn.style.display = "inline-block";
    return;
  }
  const c = picks[index];
  container.innerHTML = toCardHTML(c, index, total);
  nextBtn.disabled = false;
  restartBtn.style.display = "none";
}

function gotoNext() {
  const cur = loadIndex();
  const picks = loadPicks() || [];
  const next = cur + 1;
  saveIndex(next);
  renderAt(next);

  // bir sonraki kartın bayrağını önden yükle (küçük optimizasyon)
  if (picks[next + 1]?.flag) {
    preload(picks[next + 1].flag).catch(() => {});
  }
}

function restartSet() {
  // tamamen yeni 10 ülke çek
  createNewSet();
}

function restoreState() {
  const picks = loadPicks();
  if (!Array.isArray(picks) || !picks.length) {
    createNewSet();
    return;
  }
  let i = loadIndex();
  if (i < 0) {
    i = 0;
    saveIndex(i);
  }
  renderAt(i);
}

/* --- Olaylar ve başlangıç --- */
nextBtn?.addEventListener("click", gotoNext);
restartBtn?.addEventListener("click", restartSet);

// Uygulamayı başlat
restoreState();
