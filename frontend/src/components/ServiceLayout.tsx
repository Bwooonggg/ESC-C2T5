import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DasLogo } from "./DasLogo";
import { AccessibilityControls } from "./AccessibilityControls";

export function ServiceLayout({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="service-page">
            <header className="service-bar">
                <Link className="service-brand" to="/" aria-label="D.I.A.L home"><DasLogo className="service-logo" /><strong>D.I.A.L</strong></Link>
                <span>{title}</span>
                <AccessibilityControls />
                <Link className="all-services-link" to="/">All services</Link>
            </header>
            {children}
        </div>
    );
}
