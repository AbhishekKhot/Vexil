import { NavLink, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '', label: 'Flags', end: true },
  { to: 'environments', label: 'Environments' },
  { to: 'segments', label: 'Segments' },
  { to: 'analytics', label: 'Analytics' },
  { to: 'audit-logs', label: 'Audit Logs' },
];

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Sidebar() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-56 shrink-0 bg-gray-900 dark:bg-gray-950 text-white flex flex-col h-screen border-r border-gray-800">
      <div className="px-5 py-4 border-b border-gray-700 dark:border-gray-800 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">Vexil</span>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {projectId && (
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={label}
              to={`/projects/${projectId}${to ? `/${to}` : ''}`}
              end={end}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 hover:text-white'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {!projectId && (
        <div className="flex-1 px-3 py-4">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                'block px-3 py-2 rounded-md text-sm font-medium',
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 hover:text-white'
              )
            }
          >
            Projects
          </NavLink>
        </div>
      )}

      <div className="px-5 py-4 border-t border-gray-700 dark:border-gray-800 text-sm text-gray-400">
        <p className="truncate">{user?.name}</p>
        <button
          onClick={logout}
          className="mt-1 text-xs text-gray-500 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
