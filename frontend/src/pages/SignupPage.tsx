import { Link } from "react-router-dom";
import { SignupForm } from "../components/SignupForm";
import styles from "./AuthPage.module.css";

export function SignupPage() {
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
                <h1 className={styles.heading}>Create an account</h1>
                <SignupForm />
                <p className={styles.switchLine}>
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
}
