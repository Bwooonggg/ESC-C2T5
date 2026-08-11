import { supabase } from "../lib/supabaseClient";

export type Credentials = { email: string; password: string };

export function signup({ email, password }: Credentials) {
    return supabase.auth.signUp({ email, password });
}

export function login({ email, password }: Credentials) {
    return supabase.auth.signInWithPassword({ email, password });
}

export function logout() {
    return supabase.auth.signOut();
}

/** Returns the current browser session's access token for a protected API call. */
export async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error("Unable to read the authenticated session.");
    }

    if (!data.session?.access_token) {
        throw new Error("Authentication required.");
    }

    return data.session.access_token;
}
