import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalLayout } from './components/Layout/GlobalLayout';
import { ProjectsDashboard } from './pages/Projects/ProjectsDashboard';
import { ProjectDetail } from './pages/Projects/ProjectDetail';
import { EnvironmentsTab } from './pages/Environments/EnvironmentsTab';
import { FlagsTab } from './pages/Flags/FlagsTab';
import { FlagConfigurePage } from './pages/Flags/FlagConfigurePage';
import { SegmentsTab } from './pages/Segments/SegmentsTab';
import { AnalyticsTab } from './pages/Analytics/AnalyticsTab';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />

        <Route element={<GlobalLayout />}>
          {/* Projects */}
          <Route path="/projects" element={<ProjectsDashboard />} />

          {/* Project Detail: tabbed layout (environments / flags / segments / analytics) */}
          <Route path="/projects/:projectId" element={<ProjectDetail />}>
            <Route index element={<Navigate to="environments" replace />} />
            <Route path="environments" element={<EnvironmentsTab />} />
            <Route path="flags" element={<FlagsTab />} />
            <Route path="segments" element={<SegmentsTab />} />
            <Route path="analytics" element={<AnalyticsTab />} />
          </Route>

          {/* Flag Configure: env-matrix + rules editor (outside the tabbed layout) */}
          <Route path="/projects/:projectId/flags/:flagId/configure" element={<FlagConfigurePage />} />

          {/* Placeholder routes */}
          <Route path="/settings" element={<div className="text-xl font-bold text-slate-700 p-8">System Settings — Coming Soon</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
