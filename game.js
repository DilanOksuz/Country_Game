const API = "https://restcountries.com/v3.1/all?fields=flags";
const gridEl = document.getElementById("grid");

async function init() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("API Hatası: " + res.status);
    const data = await res.json();

    gridEl.innerHTML = data
      .map((country) => {
        const flagSrc = country?.flags?.svg || country?.flags?.png;
        const alt = country?.flags?.alt || "Bayrak";
        return `<img src="${flagSrc}" alt="${alt}" style="width:120px; height:auto; border:1px solid #ccc; margin:4px;">`;
      })
      .join("");
  } catch (err) {
    console.error("Veri alınırken hata oluştu:", err);
    gridEl.innerHTML = "<p> Bayraklar yüklenemedi.</p>";
  }
}

init();
