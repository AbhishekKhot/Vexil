import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import GlobalLayout from './components/Layout/GlobalLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ProjectsDashboard from './pages/projects/ProjectsDashboard';
import ProjectDetail from './pages/projects/ProjectDetail';
import FlagsTab from './pages/flags/FlagsTab';
import FlagConfigurePage from './pages/flags/FlagConfigurePage';
import EnvironmentsTab from './pages/environments/EnvironmentsTab';
import SegmentsTab from './pages/segments/SegmentsTab';
import AnalyticsTab from './pages/analytics/AnalyticsTab';
import AuditLogTab from './pages/auditlogs/AuditLogTab';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/" element={
        <RequireAuth>
          <GlobalLayout />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectsDashboard />} />
        <Route path="projects/:projectId" element={<ProjectDetail />}>
          <Route index element={<FlagsTab />} />
          <Route path="environments" element={<EnvironmentsTab />} />
          <Route path="segments" element={<SegmentsTab />} />
          <Route path="analytics" element={<AnalyticsTab />} />
          <Route path="audit-logs" element={<AuditLogTab />} />
        </Route>
        <Route path="projects/:projectId/flags/:flagId" element={<FlagConfigurePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
