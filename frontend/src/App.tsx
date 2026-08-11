import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ServiceLayout } from "./components/ServiceLayout";
import { DashboardApp } from "./pages/DashboardApp";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { ScreeningApp } from "./screening/ScreeningApp";
import { WorksheetApp } from "./worksheet/WorksheetApp";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/screening/*" element={<ServiceLayout title="Screening"><ScreeningApp /></ServiceLayout>} />
                <Route path="/worksheet/login" element={<LoginPage service="worksheet" />} />
                <Route path="/insights/login" element={<LoginPage service="insights" />} />
                <Route path="/worksheet/*" element={<ProtectedRoute service="worksheet"><ServiceLayout title="Worksheet Builder"><WorksheetApp /></ServiceLayout></ProtectedRoute>} />
                <Route path="/insights/*" element={<ProtectedRoute service="insights"><DashboardApp /></ProtectedRoute>} />
                <Route path="/access-denied/:service" element={<AccessDeniedPage />} />
                <Route path="/login" element={<Navigate to="/insights/login" replace />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}
