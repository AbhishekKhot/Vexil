import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, orgName);
      navigate('/projects');
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Vexil</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">Feature Flag Management</p>
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-5">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Create account</h2>
          {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded">{error}</p>}
          {[
            { label: 'Organization name', value: orgName, set: setOrgName, type: 'text', required: true },
            { label: 'Your name', value: name, set: setName, type: 'text', required: true },
            { label: 'Email', value: email, set: setEmail, type: 'email', required: true },
            { label: 'Password', value: password, set: setPassword, type: 'password', required: true },
          ].map(({ label, value, set, type, required }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              <input type={type} value={value} onChange={(e) => set(e.target.value)} required={required}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
