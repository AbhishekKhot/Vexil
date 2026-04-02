import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { GlobalLayout } from './components/Layout/GlobalLayout';
import { ProjectsDashboard } from './pages/Projects/ProjectsDashboard';
import { ProjectDetail } from './pages/Projects/ProjectDetail';
import { EnvironmentsTab } from './pages/Environments/EnvironmentsTab';
import { FlagsTab } from './pages/Flags/FlagsTab';
import { FlagConfigurePage } from './pages/Flags/FlagConfigurePage';
import { SegmentsTab } from './pages/Segments/SegmentsTab';
import { AnalyticsTab } from './pages/Analytics/AnalyticsTab';
import { AuditLogTab } from './pages/AuditLogs/AuditLogTab';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<GlobalLayout />}>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              
              {/* Projects */}
              <Route path="/projects" element={<ProjectsDashboard />} />

              {/* Project Detail: tabbed layout */}
              <Route path="/projects/:projectId" element={<ProjectDetail />}>
                <Route index element={<Navigate to="environments" replace />} />
                <Route path="environments" element={<EnvironmentsTab />} />
                <Route path="flags" element={<FlagsTab />} />
                <Route path="segments" element={<SegmentsTab />} />
                <Route path="analytics" element={<AnalyticsTab />} />
                <Route path="activity" element={<AuditLogTab />} />
              </Route>

              {/* Flag Configure */}
              <Route path="/projects/:projectId/flags/:flagId/configure" element={<FlagConfigurePage />} />

              {/* Settings */}
              <Route path="/settings" element={<div className="text-xl font-bold text-slate-700 p-8">System Settings — Coming Soon</div>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
