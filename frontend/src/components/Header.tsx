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
                <div className={styles.brand}>
                    <span className={styles.logo} aria-hidden="true">DAS</span>
                    <div>
                        <p className={styles.title}>Parent Insight</p>
                        <p className={styles.subtitle}>Dyslexia Association of Singapore</p>
                    </div>
                </div>

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
