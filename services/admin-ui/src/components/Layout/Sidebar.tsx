import { NavLink } from 'react-router-dom';
import { Settings, Folder, LogOut, User } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { icon: Folder, label: 'Projects', to: '/projects' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

export const Sidebar = () => {
  const { user, organization, logout } = useAuth();

  return (
    <div className="w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300">
      <div className="h-16 flex items-center px-6 font-bold text-xl text-white tracking-tight border-b border-slate-800 bg-slate-900/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center mr-3 shadow-lg shadow-primary-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        Vexil
      </div>
      
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all group duration-200",
              isActive 
                ? "bg-primary-600 text-white shadow-md" 
                : "hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon className={cn("w-5 h-5 mr-3 flex-shrink-0 transition-transform group-hover:scale-110", "opacity-80")} />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
            <User className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{organization?.name}</p>
          </div>
        </div>
        
        <button
          onClick={logout}
          className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign out
        </button>
      </div>
    </div>
  );
};
