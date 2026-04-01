import { useEffect, useState } from 'react';
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Flag, Users, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

const tabs = [
  { label: 'Environments', icon: Server, to: 'environments' },
  { label: 'Flags', icon: Flag, to: 'flags' },
  { label: 'Segments', icon: Users, to: 'segments' },
  { label: 'Analytics', icon: BarChart3, to: 'analytics' },
];

export const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        // Fetch from project list and find by ID (no single-project endpoint exists)
        const res = await apiClient.get('/projects');
        const found = res.data.find((p: Project) => p.id === projectId);
        if (!found) {
          setError('Project not found.');
        } else {
          setProject(found);
        }
      } catch {
        setError('Failed to load project details.');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-5 rounded-xl flex items-center gap-3 border border-red-100">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full">
      {/* Back nav */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors w-fit group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Projects
      </button>

      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{project?.name}</h1>
        {project?.description && (
          <p className="text-slate-500 mt-1 font-medium">{project.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          Project ID: <span className="font-mono text-slate-500">{project?.id}</span>
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-200',
                isActive
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )
            }
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <Outlet context={{ project, projectId }} />
      </div>
    </div>
  );
};
