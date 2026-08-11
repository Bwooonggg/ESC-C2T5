import { useEffect, useState } from "react";
import { getPreferences, savePreferences } from "../api/client";
import bannerStyles from "../components/StudentBanner.module.css";
import type { NotificationFrequency, NotificationPreference, Parent } from "../types/domain";
import styles from "./EmailUpdatesPage.module.css";

type Status =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready" };

const FREQUENCIES: NotificationFrequency[] = ["Weekly", "Fortnightly", "Monthly"];

// A deliberately invalid address, for exercising the save-validation path
// without having to type one in by hand each time.
const INVALID_EMAIL_SAMPLE = "not-an-email";

export function EmailUpdatesPage({ parent, childrenCount }: { parent: Parent; childrenCount: number }) {
    const [status, setStatus] = useState<Status>({ kind: "loading" });
    const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setStatus({ kind: "loading" });

        getPreferences(parent.parentId)
            .then((result) => {
                if (cancelled) return;
                setPrefs(result);
                setStatus({ kind: "ready" });
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setStatus({
                    kind: "error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to load email preferences.",
                });
            });

        return () => {
            cancelled = true;
        };
    }, [parent.parentId]);

    async function handleSave() {
        if (!prefs) return;
        setSaving(true);
        setSaveError(null);
        setSaved(false);

        try {
            const result = await savePreferences(parent.parentId, prefs);
            setPrefs(result);
            setSaved(true);
        } catch (error) {
            setSaveError(
                error instanceof Error ? error.message : "Unable to save email preferences.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={styles.page}>
            <section className={bannerStyles.banner}>
                <div className={bannerStyles.identity}>
                    <h1 className={bannerStyles.name}>Email updates</h1>
                    <div className={bannerStyles.meta}>
                        <div>
                            <p className={bannerStyles.metaLabel}>Account</p>
                            <p className={bannerStyles.metaValue}>{parent.name}</p>
                        </div>
                        <div>
                            <p className={bannerStyles.metaLabel}>Children</p>
                            <p className={bannerStyles.metaValue}>{childrenCount}</p>
                        </div>
                    </div>
                </div>
            </section>

            {status.kind === "loading" && <p aria-busy="true">Loading email preferences…</p>}

            {status.kind === "error" && <p role="alert">{status.message}</p>}

            {status.kind === "ready" && prefs && (
                <div className={styles.card}>
                    <h2 className={styles.heading}>How we keep you posted</h2>
                    <p className={styles.intro}>
                        We can email you a short written summary of your children's progress.
                        It covers every child on your account and is sent on a schedule — not
                        the moment new scores are recorded.
                    </p>

                    <div className={styles.toggleBox}>
                        <input
                            type="checkbox"
                            id="notify-enabled"
                            checked={prefs.enabled}
                            onChange={(event) =>
                                setPrefs({ ...prefs, enabled: event.target.checked })
                            }
                        />
                        <label htmlFor="notify-enabled">
                            <p className={styles.toggleTitle}>Send me progress emails</p>
                            <p className={styles.toggleHint}>
                                Turn this off and nothing is sent. Your other settings are kept.
                            </p>
                        </label>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="notify-frequency" className={styles.fieldLabel}>
                            How often
                        </label>
                        <select
                            id="notify-frequency"
                            value={prefs.frequency}
                            onChange={(event) =>
                                setPrefs({
                                    ...prefs,
                                    frequency: event.target.value as NotificationFrequency,
                                })
                            }
                        >
                            {FREQUENCIES.map((frequency) => (
                                <option key={frequency} value={frequency}>
                                    {frequency}
                                </option>
                            ))}
                        </select>
                        <p className={styles.fieldHint}>
                            Approximate — emails go out on the next scheduled run after the
                            interval passes.
                        </p>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="notify-email" className={styles.fieldLabel}>
                            Send to
                        </label>
                        <input
                            type="email"
                            id="notify-email"
                            value={prefs.recipientEmail}
                            onChange={(event) =>
                                setPrefs({ ...prefs, recipientEmail: event.target.value })
                            }
                        />
                        <p className={styles.fieldHint}>
                            Saved in lower case, so this may look slightly different after you
                            save.
                        </p>
                    </div>

                    <div className={styles.buttonRow}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() =>
                                setPrefs({ ...prefs, recipientEmail: INVALID_EMAIL_SAMPLE })
                            }
                        >
                            Try an invalid email
                        </button>
                    </div>

                    {saveError && (
                        <p className={`${styles.status} ${styles.statusError}`} role="alert">
                            {saveError}
                        </p>
                    )}
                    {saved && !saveError && (
                        <p className={`${styles.status} ${styles.statusOk}`}>Saved.</p>
                    )}
                </div>
            )}
        </div>
    );
}
