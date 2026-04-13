import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface Project { id: string; name: string; description?: string; createdAt: string; }

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.listProjects()
      .then((p) => setProjects(p as Project[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createProject(name, desc || undefined);
      setName(''); setDesc(''); setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
          + New project
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 space-y-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">New project</h3>
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-3">
            <button type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-gray-500 dark:text-gray-400 px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-lg">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md dark:hover:shadow-gray-900 transition-shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
              {p.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.description}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Created {new Date(p.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
