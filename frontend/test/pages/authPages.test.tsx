import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const mockLogout = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../../src/api/auth", () => ({ logout: mockLogout }));
jest.mock("../../src/components/LoginForm", () => ({
    LoginForm: ({ service }: { service: string }) => <div data-testid="login-form">{service}</div>,
}));
jest.mock("../../src/components/DasLogo", () => ({ DasLogo: () => <svg aria-label="DAS logo" /> }));
jest.mock("../../src/components/AccessibilityControls", () => ({ AccessibilityControls: () => <div>Accessibility controls</div> }));
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
}));

import { AccessDeniedPage } from "../../src/pages/AccessDeniedPage";
import { LoginPage } from "../../src/pages/LoginPage";

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}</output>;
}

function renderDenied(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="/access-denied/:service?" element={<AccessDeniedPage />} /></Routes>
            <LocationProbe />
        </MemoryRouter>,
    );
}

describe("LoginPage", () => {
    it("UT-LOGIN-U08-01 renders Worksheet login copy and dependencies", () => {
        render(<MemoryRouter initialEntries={["/worksheet/login"]}><LoginPage service="worksheet" /></MemoryRouter>);

        expect(screen.getByText("Worksheet Builder")).toBeTruthy();
        expect(screen.getByText(/Teacher access/)).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "D.I.A.L home" })).toHaveAttribute("href", "/");
        expect(screen.getByLabelText("DAS logo")).toBeTruthy();
        expect(screen.getByText("Accessibility controls")).toBeTruthy();
        expect(screen.getByTestId("login-form")).toHaveTextContent("worksheet");
    });

    it("UT-LOGIN-U08-02 renders Insights login copy and dependencies", () => {
        render(<MemoryRouter initialEntries={["/insights/login"]}><LoginPage service="insights" /></MemoryRouter>);

        expect(screen.getByText("Parent Insight")).toBeTruthy();
        expect(screen.getByText(/Parent access/)).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "D.I.A.L home" })).toHaveAttribute("href", "/");
        expect(screen.getByLabelText("DAS logo")).toBeTruthy();
        expect(screen.getByText("Accessibility controls")).toBeTruthy();
        expect(screen.getByTestId("login-form")).toHaveTextContent("insights");
    });
});

describe("AccessDeniedPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLogout.mockResolvedValue({ error: null });
    });

    it("UT-LOGIN-U09-01 switches to a Worksheet account", async () => {
        const user = userEvent.setup();
        renderDenied("/access-denied/worksheet");

        await user.click(screen.getByRole("button", { name: "Sign out and use another account" }));

        expect(mockLogout).toHaveBeenCalledWith("worksheet");
        expect(mockNavigate).toHaveBeenCalledWith("/worksheet/login", { replace: true });
    });

    it("UT-LOGIN-U09-02 switches to an Insights account", async () => {
        const user = userEvent.setup();
        renderDenied("/access-denied/insights");

        await user.click(screen.getByRole("button", { name: "Sign out and use another account" }));

        expect(mockLogout).toHaveBeenCalledWith("insights");
        expect(mockNavigate).toHaveBeenCalledWith("/insights/login", { replace: true });
    });

    it("UT-LOGIN-U09-03 defaults an unsupported service safely", async () => {
        const user = userEvent.setup();
        renderDenied("/access-denied/unknown");

        await user.click(screen.getByRole("button", { name: "Sign out and use another account" }));

        expect(mockLogout).toHaveBeenCalledWith("insights");
        expect(mockNavigate).toHaveBeenCalledWith("/insights/login", { replace: true });
    });
});
