import { useEffect, useState } from "react";

const LARGE_TEXT_KEY = "dial-large-text";
const HIGH_CONTRAST_KEY = "dial-high-contrast";

function readPreference(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === "true";
    } catch {
        return false;
    }
}

export function AccessibilityControls() {
    const [largeText, setLargeText] = useState(() => readPreference(LARGE_TEXT_KEY));
    const [highContrast, setHighContrast] = useState(() => readPreference(HIGH_CONTRAST_KEY));

    useEffect(() => {
        document.documentElement.classList.toggle(LARGE_TEXT_KEY, largeText);
        try { window.localStorage.setItem(LARGE_TEXT_KEY, String(largeText)); } catch { /* Storage may be unavailable. */ }
    }, [largeText]);

    useEffect(() => {
        document.documentElement.classList.toggle(HIGH_CONTRAST_KEY, highContrast);
        try { window.localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast)); } catch { /* Storage may be unavailable. */ }
    }, [highContrast]);

    return (
        <div className="accessibility-menu" role="group" aria-label="Display settings">
            <button type="button" aria-pressed={largeText} onClick={() => setLargeText(!largeText)}>
                <span aria-hidden="true">A+</span><span className="accessibility-label">Larger text</span>
            </button>
            <button type="button" aria-pressed={highContrast} onClick={() => setHighContrast(!highContrast)}>
                <span className="contrast-icon" aria-hidden="true" /><span className="accessibility-label">High contrast</span>
            </button>
        </div>
    );
}
