declare const __USE_STUBS__: boolean;

/** Preview data is available only when explicitly enabled on localhost. */
export const USE_STUBS = (typeof __USE_STUBS__ === "undefined" ? false : __USE_STUBS__)
    && (globalThis.location?.hostname === "localhost"
        || globalThis.location?.hostname === "127.0.0.1");
