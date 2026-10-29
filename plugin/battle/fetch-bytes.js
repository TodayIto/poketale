export function createFetchBytes(risuai) {
  return async url => {
    const response = await risuai.nativeFetch(url, { method: 'POST', body: '' });
    if (response.status !== 200) throw Object.assign(new Error(`nativeFetch HTTP ${response.status}: ${url}`), { status: response.status });
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error(`nativeFetch 빈 응답: ${url}`);
    return bytes;
  };
}
