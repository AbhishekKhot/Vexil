import { useEffect, useState } from 'react';
import { Plus, LayoutGrid, Search, AlertCircle, Folder } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Link } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export const ProjectsDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Project Creation State
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/projects');
      setProjects(res.data);
    } catch (err) {
      setError('Failed to load projects. Ensure backend API is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      setCreating(true);
      const res = await apiClient.post('/projects', { name: newProjectName, description: newProjectDesc });
      setProjects([...projects, res.data]);
      setShowModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <LayoutGrid className="w-8 h-8 text-primary-500" />
            Projects Workspace
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your active applications and configurations.</p>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-semibold shadow-md hover:bg-slate-800 transition-all hover:shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create Project
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center gap-3 border border-red-100 font-medium">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Internal Content Area */}
      <div className="flex-1 glass rounded-2xl p-6 relative flex flex-col">
        <div className="flex justify-between mb-6">
          <div className="relative w-80">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400">
            <Folder className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No projects found</p>
            <p className="text-sm">Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
            {projects.map(project => (
              <Link 
                key={project.id} 
                to={`/projects/${project.id}`}
                className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-primary-300 transition-all block duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary-600 transition-colors">{project.name}</h3>
                <p className="text-slate-500 text-sm mt-3 line-clamp-2 leading-relaxed">
                  {project.description || 'No description provided. Click to manage environments, flags, and segments.'}
                </p>
                <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded inline-flex">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-semibold text-primary-600 group-hover:translate-x-1 transition-transform">
                    View setup &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal (Simplified for scope) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl scale-100 transition-transform">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Name</label>
                <input 
                  required
                  autoFocus
                  placeholder="e.g. Acme Web App"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50"
                />
              </div>
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea 
                  rows={3}
                  placeholder="What is this project for?"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-md disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
