import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";

jest.mock("../src/components/ProtectedRoute", () => ({
    ProtectedRoute: ({ service, children }: { service: string; children: React.ReactNode }) => <div data-testid="protected" data-service={service}>{children}</div>,
}));
jest.mock("../src/components/ServiceLayout", () => ({
    ServiceLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));
jest.mock("../src/pages/LoginPage", () => ({ LoginPage: ({ service }: { service: string }) => <div data-testid="login-page">{service}</div> }));
jest.mock("../src/pages/DashboardApp", () => ({ DashboardApp: () => <div>dashboard</div> }));
jest.mock("../src/worksheet/WorksheetApp", () => ({ WorksheetApp: () => <div>worksheet app</div> }));
jest.mock("../src/pages/HomePage", () => ({ HomePage: () => <div>home</div> }));
jest.mock("../src/pages/NotFoundPage", () => ({ NotFoundPage: () => <div>not found</div> }));
jest.mock("../src/pages/AccessDeniedPage", () => ({ AccessDeniedPage: () => <div>access denied</div> }));
jest.mock("../src/screening/ScreeningApp", () => ({ ScreeningApp: () => <div>screening</div> }));

import App from "../src/App";

function renderAt(path: string) {
    window.history.replaceState({}, "", path);
    return render(<App />);
}

describe("App route composition", () => {
    afterEach(() => window.history.replaceState({}, "", "/"));

    it("UT-LOGIN-U10-01 replaces the legacy login URL", async () => {
        renderAt("/login");

        await waitFor(() => expect(screen.getByTestId("login-page")).toHaveTextContent("insights"));
        expect(window.location.pathname).toBe("/insights/login");
    });

    it("UT-LOGIN-U10-02 selects Worksheet login without mounting protection", () => {
        renderAt("/worksheet/login");

        expect(screen.getByTestId("login-page")).toHaveTextContent("worksheet");
        expect(screen.queryByTestId("protected")).toBeNull();
    });

    it("UT-LOGIN-U10-03 selects Insights login without mounting protection", () => {
        renderAt("/insights/login");

        expect(screen.getByTestId("login-page")).toHaveTextContent("insights");
        expect(screen.queryByTestId("protected")).toBeNull();
    });

    it("UT-LOGIN-U10-04 wraps Worksheet routes in Worksheet protection", () => {
        renderAt("/worksheet");

        expect(screen.getByTestId("protected")).toHaveAttribute("data-service", "worksheet");
        expect(screen.getByText("worksheet app")).toBeTruthy();
    });

    it("UT-LOGIN-U10-05 wraps Insights routes in Insights protection", () => {
        renderAt("/insights");

        expect(screen.getByTestId("protected")).toHaveAttribute("data-service", "insights");
        expect(screen.getByText("dashboard")).toBeTruthy();
    });
});
