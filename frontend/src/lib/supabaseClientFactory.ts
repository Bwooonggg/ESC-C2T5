import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnvironment = {
    url?: string;
    publishableKey?: string;
    anonKey?: string;
    useStubs: boolean;
};

export function createSupabaseClients(
    environment: SupabaseEnvironment,
    clientFactory: typeof createClient = createClient,
): { worksheetSupabase: SupabaseClient; insightsSupabase: SupabaseClient } {
    const url = environment.url ?? (environment.useStubs ? "https://stub.supabase.co" : undefined);
    const key = environment.publishableKey
        ?? environment.anonKey
        ?? (environment.useStubs ? "stub-publishable-key" : undefined);

    if (!url || !key) {
        throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.");
    }

    const createAuthClient = (storageKey: string) => clientFactory(url, key, {
        auth: {
            storageKey,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    });

    return {
        worksheetSupabase: createAuthClient("dial-worksheet-auth"),
        insightsSupabase: createAuthClient("dial-insights-auth"),
    };
}
