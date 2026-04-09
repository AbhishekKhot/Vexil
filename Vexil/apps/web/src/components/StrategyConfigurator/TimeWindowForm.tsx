interface Props {
  config: { start?: string; end?: string };
  onChange: (c: unknown) => void;
}

export default function TimeWindowForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start (UTC)</label>
        <input
          type="datetime-local"
          value={config.start ? config.start.slice(0, 16) : ''}
          onChange={(e) => onChange({ ...config, start: new Date(e.target.value).toISOString() })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End (UTC)</label>
        <input
          type="datetime-local"
          value={config.end ? config.end.slice(0, 16) : ''}
          onChange={(e) => onChange({ ...config, end: new Date(e.target.value).toISOString() })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
