import { useNavigate, useParams } from "react-router-dom";
import { logout, type AuthService } from "../api/auth";

export function AccessDeniedPage() {
    const { service = "insights" } = useParams();
    const selected = service === "worksheet" ? "worksheet" : "insights";
    const navigate = useNavigate();
    async function switchAccount() {
        await logout(selected as AuthService);
        navigate(`/${selected}/login`, { replace: true });
    }
    return <main className="message-page"><p>403</p><h1>Access denied</h1><p>This account cannot access the requested service.</p><button onClick={switchAccount}>Sign out and use another account</button></main>;
}
