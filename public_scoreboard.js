function storage(action, key, value = null) {
  if (action === set) {
    localStorage.setItem(key, value);
    console.log("$key = $value kaydedildi.");
  }
  if (action === get) {
  }
}
