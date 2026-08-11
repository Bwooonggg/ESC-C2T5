import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthClient, type AuthService } from "../api/auth";
import { USE_STUBS } from "../config/stubs";

export function ProtectedRoute({ service, children }: { service: AuthService; children: ReactNode }) {
    const [session, setSession] = useState<Session | null | undefined>(undefined);
    const [authorizationFailure, setAuthorizationFailure] = useState<number | null>(null);
    const location = useLocation();

    useEffect(() => {
        if (USE_STUBS) return;
        const client = getAuthClient(service);
        let mounted = true;
        void client.auth.getSession().then(({ data }) => {
            if (mounted) setSession(data.session);
        });
        const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            if (nextSession) setAuthorizationFailure(null);
        });
        const handleApiFailure = (event: Event) => {
            const detail = (event as CustomEvent<{ service: AuthService; status: number }>).detail;
            if (detail.service === service) setAuthorizationFailure(detail.status);
        };
        window.addEventListener("dial:auth-failure", handleApiFailure);
        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
            window.removeEventListener("dial:auth-failure", handleApiFailure);
        };
    }, [service]);

    if (USE_STUBS) return <>{children}</>;
    if (session === undefined) return <p className="route-status" aria-busy="true">Loading…</p>;
    if (authorizationFailure === 403) return <Navigate to={`/access-denied/${service}`} replace />;
    if (authorizationFailure === 401) return <Navigate to={`/${service}/login`} replace />;
    if (!session) {
        return <Navigate to={`/${service}/login`} state={{ from: location.pathname }} replace />;
    }
    return <>{children}</>;
}
