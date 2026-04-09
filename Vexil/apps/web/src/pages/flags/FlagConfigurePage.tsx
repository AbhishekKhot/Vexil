import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import StrategyConfigurator, { StrategyType } from '../../components/StrategyConfigurator';

// Defaults for each strategy — ensures required fields are always present when loading old configs
const strategyDefaults: Record<StrategyType, Record<string, unknown>> = {
  boolean: { value: false },
  rollout: { percentage: 50, hashAttribute: 'userId' },
  targeted_rollout: { percentage: 50, hashAttribute: 'userId', segments: [] },
  user_targeting: { userIds: [], fallthrough: false, hashAttribute: 'userId' },
  attribute_matching: { rules: [] },
  ab_test: { variants: [{ key: 'control', value: false, weight: 50 }, { key: 'treatment', value: true, weight: 50 }], hashAttribute: 'userId' },
  time_window: { start: '', end: '', value: true },
};

interface Environment { id: string; name: string; }
interface Flag { id: string; key: string; name: string; }

export default function FlagConfigurePage() {
  const { projectId, flagId } = useParams<{ projectId: string; flagId: string }>();
  const [flag, setFlag] = useState<Flag | null>(null);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState('');
  const [config, setConfig] = useState<{
    isEnabled: boolean;
    strategyType: StrategyType;
    strategyConfig: unknown;
    scheduledAt?: string;
  }>({
    isEnabled: false,
    strategyType: 'boolean',
    strategyConfig: { value: false },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId || !flagId) return;
    Promise.all([
      api.getFlag(projectId, flagId),
      api.listEnvironments(projectId),
    ]).then(([f, e]) => {
      setFlag(f as Flag);
      const envList = e as Environment[];
      setEnvs(envList);
      if (envList.length > 0) setSelectedEnv(envList[0].id);
    });
  }, [projectId, flagId]);

  useEffect(() => {
    if (!projectId || !flagId || !selectedEnv) return;
    api.getFlagConfig(projectId, selectedEnv, flagId)
      .then((c: any) => {
        if (c) {
          const type: StrategyType = c.strategyType ?? 'boolean';
          // Merge saved config over defaults so required fields (e.g. hashAttribute) are always present
          const strategyConfig = { ...strategyDefaults[type], ...(c.strategyConfig ?? {}) };
          setConfig({
            isEnabled: c.isEnabled ?? false,
            strategyType: type,
            strategyConfig,
            scheduledAt: c.scheduledAt ?? undefined,
          });
        }
      })
      .catch(() => {});
  }, [selectedEnv]);

  const save = async () => {
    if (!projectId || !flagId || !selectedEnv) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.setFlagConfig(projectId, selectedEnv, flagId, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Configure flag</h2>
      {flag && <p className="text-sm font-mono text-indigo-600 dark:text-indigo-400 mb-5">{flag.key}</p>}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
        <select value={selectedEnv} onChange={(e) => setSelectedEnv(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {envs.map((env) => (
            <option key={env.id} value={env.id}>{env.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
          <button
            onClick={() => setConfig((c) => ({ ...c, isEnabled: !c.isEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.isEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <StrategyConfigurator
          value={{ strategyType: config.strategyType, strategyConfig: config.strategyConfig }}
          onChange={({ strategyType, strategyConfig }) =>
            setConfig((c) => ({ ...c, strategyType, strategyConfig }))
          }
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Scheduled activation (optional)
          </label>
          <input
            type="datetime-local"
            value={config.scheduledAt ? config.scheduledAt.slice(0, 16) : ''}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              }))
            }
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

        <button onClick={save} disabled={saving}
          className="w-full bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save configuration'}
        </button>
      </div>
    </div>
  );
}
