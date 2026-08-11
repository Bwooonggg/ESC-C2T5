import { useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login, logout, type AuthService } from "../api/auth";
import { getCurrentParent } from "../api/client";
import styles from "../pages/AuthPage.module.css";

export function LoginForm({ service }: { service: AuthService }) {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [event.target.name]: event.target.value });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const result = await login(service, form);
            if (result.error) throw result.error;
            if (service === "insights") await getCurrentParent();
            const requestedPath = (location.state as { from?: string } | null)?.from;
            navigate(requestedPath?.startsWith(`/${service}`) ? requestedPath : `/${service}`, { replace: true });
        } catch {
            await logout(service);
            setError("Unable to sign in with those credentials or access this service.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? "Logging in…" : "Log in"}
            </button>
        </form>
    );
}
