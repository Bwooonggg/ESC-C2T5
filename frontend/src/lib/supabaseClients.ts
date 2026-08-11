import { createClient } from "@supabase/supabase-js";
import { USE_STUBS } from "../config/stubs";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? (USE_STUBS ? "https://stub.supabase.co" : undefined);
const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.VITE_SUPABASE_ANON_KEY
    ?? (USE_STUBS ? "stub-publishable-key" : undefined);

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.",
    );
}

function createAuthClient(storageKey: string) {
    return createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
            storageKey,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    });
}

export const worksheetSupabase = createAuthClient("dial-worksheet-auth");
export const insightsSupabase = createAuthClient("dial-insights-auth");
