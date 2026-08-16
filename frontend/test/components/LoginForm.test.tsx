import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockGetCurrentParent = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../../src/api/auth", () => ({
    login: mockLogin,
    logout: mockLogout,
}));
jest.mock("../../src/api/client", () => ({
    getCurrentParent: mockGetCurrentParent,
}));
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
}));

import { LoginForm } from "../../src/components/LoginForm";

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}</output>;
}

function renderForm(service: "worksheet" | "insights", from?: string) {
    return render(
        <MemoryRouter initialEntries={[{ pathname: `/${service}/login`, state: from ? { from } : null }]}>
            <LoginForm service={service} />
            <LocationProbe />
        </MemoryRouter>,
    );
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>, password = "secret") {
    await user.type(screen.getByPlaceholderText("Email"), "user@example.com");
    await user.type(screen.getByPlaceholderText("Password"), password);
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe("LoginForm", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLogout.mockResolvedValue({ error: null });
        mockGetCurrentParent.mockResolvedValue({ parent: {}, students: [] });
    });

    it("UT-LOGIN-U06-01 exposes the initial login controls", () => {
        renderForm("worksheet");

        const email = screen.getByPlaceholderText("Email") as HTMLInputElement;
        const password = screen.getByPlaceholderText("Password") as HTMLInputElement;
        expect(email).toMatchObject({ name: "email", type: "email", required: true, value: "" });
        expect(password).toMatchObject({ name: "password", type: "password", required: true, value: "" });
        expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    });

    it("UT-LOGIN-U06-02 stores edits to both credential fields", async () => {
        const user = userEvent.setup();
        renderForm("worksheet");

        await fillCredentials(user);

        expect(screen.getByPlaceholderText("Email")).toHaveValue("user@example.com");
        expect(screen.getByPlaceholderText("Password")).toHaveValue("secret");
    });

    it("UT-LOGIN-U06-03 exposes a pending submission state", async () => {
        const pending = deferred<{ error: null }>();
        mockLogin.mockReturnValue(pending.promise);
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
        pending.resolve({ error: null });
        await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    });

    it("UT-LOGIN-U06-04 sends successful Worksheet users to their root", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/worksheet", { replace: true }));
        expect(mockGetCurrentParent).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U06-05 validates Insights users before redirecting", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("insights");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/insights", { replace: true }));
        expect(mockGetCurrentParent).toHaveBeenCalledTimes(1);
    });

    it("UT-LOGIN-U06-06 preserves an Insights requested path", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("insights", "/insights/child/s1");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/insights/child/s1", { replace: true }));
    });

    it("UT-LOGIN-U06-07 rejects a requested path for another service", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("worksheet", "/insights");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/worksheet", { replace: true }));
    });

    it("UT-LOGIN-U06-08 displays a generic error for a resolved auth failure", async () => {
        mockLogin.mockResolvedValue({ error: new Error("bad credentials") });
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await screen.findByText("Unable to sign in with those credentials or access this service.");
        expect(mockLogout).toHaveBeenCalledWith("worksheet");
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    });

    it("UT-LOGIN-U06-09 displays the same error for a rejected login", async () => {
        mockLogin.mockRejectedValue(new Error("network unavailable"));
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await screen.findByText("Unable to sign in with those credentials or access this service.");
        expect(mockLogout).toHaveBeenCalledWith("worksheet");
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U06-10 signs Insights out when parent authorization fails", async () => {
        mockLogin.mockResolvedValue({ error: null });
        mockGetCurrentParent.mockRejectedValue(new Error("403"));
        const user = userEvent.setup();
        renderForm("insights");
        await fillCredentials(user);

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await screen.findByText("Unable to sign in with those credentials or access this service.");
        expect(mockLogout).toHaveBeenCalledWith("insights");
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U06-11 clears a prior error while a retry is pending", async () => {
        mockLogin.mockResolvedValueOnce({ error: new Error("bad credentials") });
        const retry = deferred<{ error: null }>();
        mockLogin.mockReturnValueOnce(retry.promise);
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);
        await user.click(screen.getByRole("button", { name: "Log in" }));
        await screen.findByText("Unable to sign in with those credentials or access this service.");

        await user.click(screen.getByRole("button", { name: "Log in" }));
        expect(screen.queryByText("Unable to sign in with those credentials or access this service.")).toBeNull();
        expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
        retry.resolve({ error: null });
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/worksheet", { replace: true }));
    });

    it("UT-LOGIN-U06-12 ignores repeated clicks while the button is disabled", async () => {
        const pending = deferred<{ error: null }>();
        mockLogin.mockReturnValue(pending.promise);
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user);
        const submit = screen.getByRole("button", { name: "Log in" });

        await user.click(submit);
        await user.click(screen.getByRole("button", { name: "Logging in…" }));

        expect(mockLogin).toHaveBeenCalledTimes(1);
        pending.resolve({ error: null });
        await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    });

    it("UT-LOGIN-U06-13 accepts a requested service root", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("insights", "/insights");
        await fillCredentials(user);
        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/insights", { replace: true }));
    });

    it("UT-LOGIN-U06-14 rejects a path one character short of the service prefix", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("insights", "/insight");
        await fillCredentials(user);
        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/insights", { replace: true }));
    });

    it("UT-LOGIN-U06-15 accepts the current prefix-collision behavior", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("insights", "/insights-old");
        await fillCredentials(user);
        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/insights-old", { replace: true }));
    });

    it("UT-LOGIN-U06-16 lets browser required validation block an empty email", async () => {
        const user = userEvent.setup();
        renderForm("worksheet");
        await user.type(screen.getByPlaceholderText("Password"), "secret");

        await user.click(screen.getByRole("button", { name: "Log in" }));

        expect(mockLogin).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U06-17 lets browser required validation block an empty password", async () => {
        const user = userEvent.setup();
        renderForm("worksheet");
        await user.type(screen.getByPlaceholderText("Email"), "user@example.com");

        await user.click(screen.getByRole("button", { name: "Log in" }));

        expect(mockLogin).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U06-18 forwards a one-character password unchanged", async () => {
        mockLogin.mockResolvedValue({ error: null });
        const user = userEvent.setup();
        renderForm("worksheet");
        await fillCredentials(user, "x");

        await user.click(screen.getByRole("button", { name: "Log in" }));

        await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("worksheet", { email: "user@example.com", password: "x" }));
    });
});
