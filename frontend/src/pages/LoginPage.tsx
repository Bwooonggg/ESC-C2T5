import { Link } from "react-router-dom";
import type { AuthService } from "../api/auth";
import { LoginForm } from "../components/LoginForm";
import { DasLogo } from "../components/DasLogo";
import { AccessibilityControls } from "../components/AccessibilityControls";
import styles from "./AuthPage.module.css";

const labels = {
    worksheet: { title: "Worksheet Builder", audience: "Teacher access" },
    insights: { title: "Parent Insight", audience: "Parent access" },
} as const;

export function LoginPage({ service }: { service: AuthService }) {
    const label = labels[service];
    return (
        <div className={styles.page}>
            <div className={styles.accessibility}><AccessibilityControls /></div>
            <Link className={styles.brand} to="/" aria-label="D.I.A.L home">
                <DasLogo className={styles.logoImage} />
                <div><p className={styles.title}>{label.title}</p><p className={styles.subtitle}>Dyslexia Association of Singapore</p></div>
            </Link>
            <div className={styles.card}>
                <h1 className={styles.heading}>Log in</h1>
                <p>{label.audience}. Accounts are provided by an administrator.</p>
                <LoginForm service={service} />
                <p className={styles.switchLine}><Link to="/">Return to D.I.A.L home</Link></p>
            </div>
        </div>
    );
}
