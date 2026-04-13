import { useEffect, useState } from 'react';
import { useParams, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { cn } from '../../utils/cn';

interface Project { id: string; name: string; description?: string; }

const tabs = [
  { to: '', label: 'Flags', end: true },
  { to: 'environments', label: 'Environments' },
  { to: 'segments', label: 'Segments' },
  { to: 'analytics', label: 'Analytics' },
  { to: 'audit-logs', label: 'Audit Logs' },
];

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId)
      .then((p) => setProject(p as Project))
      .catch(() => navigate('/projects'));
  }, [projectId]);

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/projects')}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-2 flex items-center gap-1">
          ← All projects
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project?.name ?? '…'}</h1>
        {project?.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>}
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(({ to, label, end }) => (
          <NavLink
            key={label}
            to={`/projects/${projectId}${to ? `/${to}` : ''}`}
            end={end}
            className={({ isActive }) =>
              cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
