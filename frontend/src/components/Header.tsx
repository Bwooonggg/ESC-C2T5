import { Link } from "react-router-dom";
import { DasLogo } from "./DasLogo";
import { AccessibilityControls } from "./AccessibilityControls";
import styles from "./Header.module.css";

export type Page = "progress" | "email";

export function Header({
    parentName,
    page,
    onNavigate,
    onLogout,
}: {
    parentName: string | null;
    page: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
}) {
    return (
        <>
            <div className={styles.topBar} aria-hidden="true" />
            <header className={styles.header}>
                <Link className={styles.brand} to="/" aria-label="D.I.A.L home">
                    <DasLogo className={styles.logoImage} />
                    <div>
                        <p className={styles.title}>Parent Insight</p>
                        <p className={styles.subtitle}>Dyslexia Association of Singapore</p>
                    </div>
                </Link>
                <Link to="/" className={`${styles.navLink} all-services-link`}>All services</Link>

                <nav className={styles.nav} aria-label="Main">
                    <button
                        type="button"
                        className={`${styles.navLink} ${page === "progress" ? styles.navLinkActive : ""}`}
                        aria-current={page === "progress" ? "page" : undefined}
                        onClick={() => onNavigate("progress")}
                    >
                        Progress
                    </button>
                    <button
                        type="button"
                        className={`${styles.navLink} ${page === "email" ? styles.navLinkActive : ""}`}
                        aria-current={page === "email" ? "page" : undefined}
                        onClick={() => onNavigate("email")}
                    >
                        Email updates
                    </button>
                </nav>

                <AccessibilityControls />
                <p className={styles.signedIn}>
                    Signed in as{" "}
                    <span className={styles.signedInName}>{parentName ?? "…"}</span>
                </p>
                <button type="button" className={styles.logoutButton} onClick={onLogout}>
                    Log out
                </button>
            </header>
        </>
    );
}
