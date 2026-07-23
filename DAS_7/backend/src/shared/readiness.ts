/** Cross-process readiness capability; infrastructure supplies the probe. */
export interface ReadinessProbe {
    check(): Promise<void>
}

