import { Link } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import styles from "./AuthPage.module.css";

export function LoginPage() {
    return (
        <div className={styles.page}>
            <div className={styles.brand}>
                <span className={styles.logo} aria-hidden="true">DAS</span>
                <div>
                    <p className={styles.title}>Parent Insight</p>
                    <p className={styles.subtitle}>Dyslexia Association of Singapore</p>
                </div>
            </div>

            <div className={styles.card}>
                <h1 className={styles.heading}>Log in</h1>
                <LoginForm />
                <p className={styles.switchLine}>
                    Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
