import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const mockWorksheetClient = { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } };
const mockInsightsClient = { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } };
const mockGetAuthClient = jest.fn((service: string) => service === "worksheet" ? mockWorksheetClient : mockInsightsClient);

jest.mock("../../src/api/auth", () => ({ getAuthClient: mockGetAuthClient }));
jest.mock("../../src/config/stubs", () => ({ USE_STUBS: false }));
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    Navigate: ({ to, state }: { to: string; state?: unknown }) => <output data-testid="redirect">{JSON.stringify({ to, state })}</output>,
}));

import { ProtectedRoute } from "../../src/components/ProtectedRoute";

function RouteState() {
    const location = useLocation();
    return <output data-testid="route-state">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}

function subscription() {
    return { unsubscribe: jest.fn() };
}

function activeSession() {
    return { access_token: "token" } as never;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
    return { promise, resolve };
}

function renderProtected(service: "worksheet" | "insights", path = `/${service}/progress`) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="*" element={<ProtectedRoute service={service}><p>Protected child</p></ProtectedRoute>} />
            </Routes>
        </MemoryRouter>,
    );
}

function configureClient(client: typeof mockWorksheetClient, session: unknown = activeSession()) {
    const eventSubscription = subscription();
    client.auth.getSession.mockResolvedValue({ data: { session } });
    client.auth.onAuthStateChange.mockReturnValue({ data: { subscription: eventSubscription } });
    return eventSubscription;
}

describe("ProtectedRoute", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("UT-LOGIN-U07-02 renders loading while the initial session is unresolved", () => {
        const pending = deferred<{ data: { session: unknown } }>();
        mockInsightsClient.auth.getSession.mockReturnValue(pending.promise);
        mockInsightsClient.auth.onAuthStateChange.mockReturnValue({ data: { subscription: subscription() } });
        renderProtected("insights");

        expect(screen.getByText("Loading…")).toHaveAttribute("aria-busy", "true");
        expect(mockInsightsClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });

    it("UT-LOGIN-U07-03 renders children for an active session", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");

        expect(await screen.findByText("Protected child")).toBeTruthy();
    });

    it("UT-LOGIN-U07-04 redirects an absent session with its requested path", async () => {
        configureClient(mockInsightsClient, null);
        renderProtected("insights", "/insights/progress");

        await waitFor(() => expect(screen.getByTestId("redirect")).toHaveTextContent('"to":"/insights/login"'));
        expect(screen.getByTestId("redirect")).toHaveTextContent('"from":"/insights/progress"');
        expect(screen.queryByText("Protected child")).toBeNull();
    });

    it("UT-LOGIN-U07-05 redirects when an auth callback reports sign-out", async () => {
        configureClient(mockWorksheetClient);
        renderProtected("worksheet");
        await screen.findByText("Protected child");
        const callback = mockWorksheetClient.auth.onAuthStateChange.mock.calls[0][0] as (_event: string, session: unknown) => void;

        act(() => callback("SIGNED_OUT", null));

        await waitFor(() => expect(screen.getByTestId("redirect")).toHaveTextContent('"to":"/worksheet/login"'));
    });

    it("UT-LOGIN-U07-06 clears an authorization failure when a new session arrives", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");
        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 403 } })));
        await waitFor(() => expect(screen.getByTestId("redirect")).toHaveTextContent('"to":"/access-denied/insights"'));
        const callback = mockInsightsClient.auth.onAuthStateChange.mock.calls[0][0] as (_event: string, session: unknown) => void;
        act(() => callback("SIGNED_IN", activeSession()));

        await screen.findByText("Protected child");
    });

    it("UT-LOGIN-U07-07 redirects a matching 401 failure to login", async () => {
        configureClient(mockWorksheetClient);
        renderProtected("worksheet");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "worksheet", status: 401 } })));

        await waitFor(() => expect(screen.getByTestId("redirect")).toHaveTextContent('"to":"/worksheet/login"'));
    });

    it("UT-LOGIN-U07-08 redirects a matching 403 failure to access denied", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 403 } })));

        await waitFor(() => expect(screen.getByTestId("redirect")).toHaveTextContent('"to":"/access-denied/insights"'));
    });

    it("UT-LOGIN-U07-09 ignores an auth failure for the other service", async () => {
        configureClient(mockWorksheetClient);
        renderProtected("worksheet");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 403 } })));

        expect(screen.getByText("Protected child")).toBeTruthy();
    });

    it("UT-LOGIN-U07-10 leaves children visible for an unsupported status", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 500 } })));

        expect(screen.getByText("Protected child")).toBeTruthy();
    });

    it("UT-LOGIN-U07-11 cleans up its subscription and event listener on unmount", async () => {
        const unsubscribe = configureClient(mockWorksheetClient);
        const removeListener = jest.spyOn(window, "removeEventListener");
        const view = renderProtected("worksheet");
        await screen.findByText("Protected child");

        view.unmount();

        expect(unsubscribe.unsubscribe).toHaveBeenCalledTimes(1);
        expect(removeListener).toHaveBeenCalledWith("dial:auth-failure", expect.any(Function));
        removeListener.mockRestore();
    });

    it("UT-LOGIN-U07-12 ignores a session that resolves after unmount", async () => {
        const pending = deferred<{ data: { session: unknown } }>();
        mockWorksheetClient.auth.getSession.mockReturnValue(pending.promise);
        mockWorksheetClient.auth.onAuthStateChange.mockReturnValue({ data: { subscription: subscription() } });
        const view = renderProtected("worksheet");
        expect(screen.getByText("Loading…")).toBeTruthy();

        view.unmount();
        await act(async () => { pending.resolve({ data: { session: activeSession() } }); await pending.promise; });

        expect(screen.queryByText("Protected child")).toBeNull();
    });

    it("UT-LOGIN-U07-13 cleans up the old service before activating a new one", async () => {
        const worksheetSubscription = configureClient(mockWorksheetClient);
        const insightsSubscription = configureClient(mockInsightsClient);
        const view = renderProtected("worksheet");
        await screen.findByText("Protected child");

        view.rerender(
            <MemoryRouter initialEntries={["/insights/progress"]}>
                <Routes><Route path="*" element={<ProtectedRoute service="insights"><p>Protected child</p></ProtectedRoute>} /></Routes>
            </MemoryRouter>,
        );

        await waitFor(() => expect(mockGetAuthClient).toHaveBeenCalledWith("insights"));
        expect(worksheetSubscription.unsubscribe).toHaveBeenCalledTimes(1);
        expect(insightsSubscription.unsubscribe).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U07-14 leaves children visible for status 400", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 400 } })));

        expect(screen.getByText("Protected child")).toBeTruthy();
    });

    it("UT-LOGIN-U07-15 leaves children visible for status 402", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 402 } })));

        expect(screen.getByText("Protected child")).toBeTruthy();
    });

    it("UT-LOGIN-U07-16 leaves children visible for status 404", async () => {
        configureClient(mockInsightsClient);
        renderProtected("insights");
        await screen.findByText("Protected child");

        act(() => window.dispatchEvent(new CustomEvent("dial:auth-failure", { detail: { service: "insights", status: 404 } })));

        expect(screen.getByText("Protected child")).toBeTruthy();
    });
});
