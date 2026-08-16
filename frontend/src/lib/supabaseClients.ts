import { USE_STUBS } from "../config/stubs";
import { createSupabaseClients } from "./supabaseClientFactory";

export const { worksheetSupabase, insightsSupabase } = createSupabaseClients({
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    useStubs: USE_STUBS,
});
