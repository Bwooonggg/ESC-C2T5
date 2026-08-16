import type { SupabaseClient } from "@supabase/supabase-js";
import { insightsSupabase, worksheetSupabase } from "../lib/supabaseClients";
import { USE_STUBS } from "../config/stubs";

export type Credentials = { email: string; password: string };
export type AuthService = "worksheet" | "insights";

export function getAuthClient(service: AuthService): SupabaseClient {
    return service === "worksheet" ? worksheetSupabase : insightsSupabase;
}

export function login(service: AuthService, { email, password }: Credentials) {
    return getAuthClient(service).auth.signInWithPassword({ email, password });
}

export function logout(service: AuthService) {
    if (USE_STUBS) return Promise.resolve({ error: null });
    return getAuthClient(service).auth.signOut({ scope: "local" });
}

/** Returns the current browser session's access token for a protected API call. */
export async function getAccessToken(service: AuthService): Promise<string> {
    if (USE_STUBS) return "preview-token";
    const { data, error } = await getAuthClient(service).auth.getSession();

    if (error) {
        throw new Error("Unable to read the authenticated session.");
    }

    if (!data.session?.access_token) {
        throw new Error("Authentication required.");
    }

    return data.session.access_token;
}
