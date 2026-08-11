/** Set by index.html only for an explicitly enabled localhost preview. */
const previewGlobal = globalThis as typeof globalThis & { __DIAL_USE_STUBS__?: boolean };
export const USE_STUBS = previewGlobal.__DIAL_USE_STUBS__ === true;
