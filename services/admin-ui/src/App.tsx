import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalLayout } from './components/Layout/GlobalLayout';
import { ProjectsDashboard } from './pages/Projects/ProjectsDashboard';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        
        <Route element={<GlobalLayout />}>
          <Route path="/projects" element={<ProjectsDashboard />} />
          <Route path="/projects/:projectId" element={<div className="text-xl font-bold">Project Environments & Flags Coming Soon...</div>} />
          
          <Route path="/segments" element={<div className="text-xl font-bold">Global Segments Coming Soon...</div>} />
          <Route path="/settings" element={<div className="text-xl font-bold">System Settings...</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
