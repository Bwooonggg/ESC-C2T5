import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export function ProtectedRoute({ children }: { children: ReactNode }) {
    // undefined = still checking; null = checked, no session.
    const [session, setSession] = useState<Session | null | undefined>(undefined);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Keep it updated if the user logs out in another tab, the token
        // refreshes, etc.
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    if (session === undefined) {
        return <p aria-busy="true">Loading…</p>; // avoid flashing a redirect before we know
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
