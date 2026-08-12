import { createSupabaseClients } from "../../src/lib/supabaseClientFactory";

describe("Supabase client configuration", () => {
    function clientFactory() {
        return jest.fn()
            .mockReturnValueOnce({ name: "worksheet" })
            .mockReturnValueOnce({ name: "insights" }) as never;
    }

    it("UT-LOGIN-U01-01 prefers an explicit publishable key", () => {
        const factory = clientFactory();

        const clients = createSupabaseClients({
            url: "https://example.supabase.co",
            publishableKey: "publishable-key",
            anonKey: "legacy-anon-key",
            useStubs: false,
        }, factory);

        expect(clients.worksheetSupabase).toEqual({ name: "worksheet" });
        expect(clients.insightsSupabase).toEqual({ name: "insights" });
        expect(factory).toHaveBeenNthCalledWith(1, "https://example.supabase.co", "publishable-key", {
            auth: {
                storageKey: "dial-worksheet-auth",
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        });
        expect(factory).toHaveBeenNthCalledWith(2, "https://example.supabase.co", "publishable-key", expect.objectContaining({
            auth: expect.objectContaining({ storageKey: "dial-insights-auth" }),
        }));
    });

    it("UT-LOGIN-U01-02 falls back to the legacy anon key", () => {
        const factory = clientFactory();

        createSupabaseClients({ url: "https://example.supabase.co", anonKey: "legacy-anon-key", useStubs: false }, factory);

        expect(factory).toHaveBeenCalledTimes(2);
        expect(factory).toHaveBeenNthCalledWith(1, "https://example.supabase.co", "legacy-anon-key", expect.any(Object));
        expect(factory).toHaveBeenNthCalledWith(2, "https://example.supabase.co", "legacy-anon-key", expect.any(Object));
    });

    it("UT-LOGIN-U01-04 rejects a missing URL outside stub mode", () => {
        const factory = clientFactory();

        expect(() => createSupabaseClients({ publishableKey: "key", useStubs: false }, factory)).toThrow(
            "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.",
        );
        expect(factory).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U01-05 rejects missing supported keys outside stub mode", () => {
        const factory = clientFactory();

        expect(() => createSupabaseClients({ url: "https://example.supabase.co", useStubs: false }, factory)).toThrow(
            "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.",
        );
        expect(factory).not.toHaveBeenCalled();
    });
});
