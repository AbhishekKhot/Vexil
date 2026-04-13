interface Props {
  config: { percentage?: number; hashAttribute?: string };
  onChange: (c: { percentage: number; hashAttribute: string }) => void;
}

export default function RolloutForm({ config, onChange }: Props) {
  const percentage = config.percentage ?? 50;
  const hashAttribute = config.hashAttribute ?? 'userId';

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hash attribute</label>
        <input
          placeholder="userId"
          value={hashAttribute}
          onChange={(e) => onChange({ percentage, hashAttribute: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Rollout percentage: <span className="font-bold">{percentage}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={percentage}
          onChange={(e) => onChange({ percentage: Number(e.target.value), hashAttribute })}
          className="w-full accent-indigo-600"
        />
      </div>
    </div>
  );
}
