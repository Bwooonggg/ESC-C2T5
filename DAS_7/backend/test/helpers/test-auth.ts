import { createClient } from '@supabase/supabase-js';

export interface TestUserSession {
    accessToken: string;
    authUserId: string;
}

/**
 * Signs in a pre-created Supabase Auth user with the anon key and returns a real
 * access token — integration suites exercise the same verification path as the browser.
 * The users are provisioned by hand in the dashboard; this never creates anything.
 */
export async function signInTestUser(email: string, password: string): Promise<TestUserSession> {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error('signInTestUser needs SUPABASE_URL and SUPABASE_ANON_KEY in the environment');
    }

    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        throw new Error(`Could not sign in test user ${email}: ${error.message}`);
    }
    if (!data.session || !data.user) {
        throw new Error(`Sign-in for test user ${email} returned no session`);
    }

    return { accessToken: data.session.access_token, authUserId: data.user.id };
}
