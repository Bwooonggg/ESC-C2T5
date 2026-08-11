import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import styles from "../pages/AuthPage.module.css";

export function SignupForm() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [event.target.name]: event.target.value });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        const { error } = await signup(form);

        setSubmitting(false);
        if (error) {
            setError(error.message);
            return;
        }

        navigate("/login");
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
            />
            <input
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? "Signing up…" : "Sign up"}
            </button>
        </form>
    );
}
