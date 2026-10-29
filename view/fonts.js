const loading = new Map();

export function loadFont(name, fallbackUrl) {
  if (!loading.has(name)) {

    const promise = import('embedded:fonts')
      .then(({ FONTS }) => new FontFace(name, Uint8Array.from(atob(FONTS[name]), c => c.charCodeAt(0))).load())
      .catch(error => (fallbackUrl ? new FontFace(name, `url("${fallbackUrl}")`).load() : Promise.reject(error)))
      .then(face => { document.fonts.add(face); });
    promise.catch(() => loading.delete(name));
    loading.set(name, promise);
  }
  return loading.get(name);
}
