import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../utils/cn';

interface Flag {
  id: string;
  key: string;
  description?: string;
  type: string;
}

interface Environment {
  id: string;
  name: string;
  apiKey: string;
}

interface FlagConfig {
  id?: string;
  isEnabled: boolean;
  rules?: any;
}

interface ConfigState {
  isEnabled: boolean;
  rules: string;
  saving: boolean;
  saved: boolean;
  expanded: boolean;
  originalConfig: FlagConfig | null;
}

const ENV_COLOR_MAP: Record<string, { badge: string; dot: string }> = {
  production: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  prod: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  staging: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  stage: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  development: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  dev: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

const getEnvStyle = (name: string) =>
  ENV_COLOR_MAP[name.toLowerCase()] ?? { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };

export const FlagConfigurePage = () => {
  const { projectId, flagId } = useParams<{ projectId: string; flagId: string }>();
  const navigate = useNavigate();

  const [flag, setFlag] = useState<Flag | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [configMap, setConfigMap] = useState<Record<string, ConfigState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!projectId || !flagId) return;
    try {
      setLoading(true);
      const [flagRes, envRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}/flags/${flagId}`),
        apiClient.get(`/projects/${projectId}/environments`),
      ]);
      setFlag(flagRes.data);
      const envs: Environment[] = envRes.data;
      setEnvironments(envs);

      // For each environment, try to load the flag config
      const configEntries = await Promise.all(
        envs.map(async (env) => {
          try {
            const res = await apiClient.get(`/projects/${projectId}/environments/${env.id}/flags/${flagId}`);
            const cfg: FlagConfig = res.data;
            return [
              env.id,
              {
                isEnabled: cfg.isEnabled ?? false,
                rules: cfg.rules ? JSON.stringify(cfg.rules, null, 2) : '{}',
                saving: false,
                saved: false,
                expanded: false,
                originalConfig: cfg,
              } as ConfigState,
            ];
          } catch {
            // Config doesn't exist yet — default state
            return [
              env.id,
              {
                isEnabled: false,
                rules: '{}',
                saving: false,
                saved: false,
                expanded: false,
                originalConfig: null,
              } as ConfigState,
            ];
          }
        })
      );
      setConfigMap(Object.fromEntries(configEntries));
    } catch {
      setError('Failed to load flag configuration data.');
    } finally {
      setLoading(false);
    }
  }, [projectId, flagId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateConfigField = (envId: string, updates: Partial<ConfigState>) => {
    setConfigMap((prev) => ({
      ...prev,
      [envId]: { ...prev[envId], ...updates },
    }));
  };

  const handleToggle = (envId: string) => {
    updateConfigField(envId, { isEnabled: !configMap[envId].isEnabled, saved: false });
  };

  const handleSave = async (envId: string) => {
    const cfg = configMap[envId];
    let parsedRules: any = {};
    try {
      parsedRules = JSON.parse(cfg.rules || '{}');
    } catch {
      alert('Invalid JSON in rules editor. Please fix before saving.');
      return;
    }

    updateConfigField(envId, { saving: true });
    try {
      await apiClient.put(`/projects/${projectId}/environments/${envId}/flags/${flagId}`, {
        isEnabled: cfg.isEnabled,
        rules: parsedRules,
      });
      updateConfigField(envId, { saving: false, saved: true });
      setTimeout(() => updateConfigField(envId, { saved: false }), 2500);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save configuration.');
      updateConfigField(envId, { saving: false });
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto bg-red-50 text-red-600 p-5 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5" /> {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full">
      {/* Back */}
      <button
        onClick={() => navigate(`/projects/${projectId}/flags`)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors w-fit group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Flags
      </button>

      {/* Flag Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 font-mono">{flag?.key}</h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {flag?.type}
          </span>
        </div>
        {flag?.description && <p className="text-slate-500 mt-1">{flag.description}</p>}
        <p className="text-sm text-slate-400 mt-1">Toggle this flag on/off per environment and optionally configure targeting rules.</p>
      </div>

      {environments.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white/60 rounded-2xl border border-slate-100 py-16 text-slate-400">
          <ToggleLeft className="w-14 h-14 mb-4 opacity-40" />
          <p className="font-semibold text-lg">No Environments</p>
          <p className="text-sm mt-1">Create environments first to configure this flag.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {environments.map((env) => {
            const cfg = configMap[env.id];
            if (!cfg) return null;
            const envStyle = getEnvStyle(env.name);

            return (
              <div
                key={env.id}
                className={cn(
                  'bg-white border rounded-2xl transition-all duration-200 overflow-hidden',
                  cfg.isEnabled ? 'border-primary-200 shadow-md shadow-primary-50' : 'border-slate-200'
                )}
              >
                {/* Card Header */}
                <div className="flex items-center gap-4 p-5">
                  {/* Status dot */}
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.isEnabled ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-slate-300')} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{env.name}</span>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', envStyle.badge)}>
                        {env.name.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{env.apiKey}</p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(env.id)}
                    className="focus:outline-none transition-all"
                    title={cfg.isEnabled ? 'Disable flag' : 'Enable flag'}
                  >
                    {cfg.isEnabled ? (
                      <ToggleRight className="w-10 h-10 text-primary-600 hover:text-primary-700 transition-colors" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-300 hover:text-slate-400 transition-colors" />
                    )}
                  </button>

                  {/* Rules expander */}
                  <button
                    onClick={() => updateConfigField(env.id, { expanded: !cfg.expanded })}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Toggle rules editor"
                  >
                    {cfg.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Save button */}
                  <button
                    onClick={() => handleSave(env.id)}
                    disabled={cfg.saving}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                      cfg.saved
                        ? 'bg-green-500 text-white'
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm disabled:opacity-60'
                    )}
                  >
                    {cfg.saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {cfg.saved ? 'Saved!' : cfg.saving ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {/* Rules Editor (Expandable) */}
                {cfg.expanded && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Targeting Rules (JSON)
                    </label>
                    <textarea
                      rows={8}
                      value={cfg.rules}
                      onChange={(e) => updateConfigField(env.id, { rules: e.target.value, saved: false })}
                      className="w-full font-mono text-xs bg-slate-900 text-green-400 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y leading-relaxed"
                      spellCheck={false}
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      Define targeting rules as a JSON object. Saved with the flag toggle state above.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
