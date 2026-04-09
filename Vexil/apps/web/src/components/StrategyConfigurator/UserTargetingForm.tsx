import { useState } from 'react';

interface Props {
  config: { userIds?: string[]; fallthrough?: boolean; hashAttribute?: string };
  onChange: (c: unknown) => void;
}

export default function UserTargetingForm({ config, onChange }: Props) {
  const [input, setInput] = useState('');
  const userIds = config.userIds ?? [];
  const hashAttribute = config.hashAttribute ?? 'userId';

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !userIds.includes(trimmed)) {
      onChange({ ...config, userIds: [...userIds, trimmed], hashAttribute });
    }
    setInput('');
  };

  const remove = (id: string) =>
    onChange({ ...config, userIds: userIds.filter((u) => u !== id), hashAttribute });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hash attribute</label>
        <input
          placeholder="userId"
          value={hashAttribute}
          onChange={(e) => onChange({ ...config, userIds, hashAttribute: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Enter user ID and press Enter"
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="button" onClick={add}
          className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm hover:bg-indigo-700">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {userIds.map((id) => (
          <span key={id} className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs px-2 py-1 rounded-full">
            {id}
            <button type="button" onClick={() => remove(id)} className="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200">✕</button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="fallthrough"
          checked={config.fallthrough ?? false}
          onChange={(e) => onChange({ ...config, userIds, hashAttribute, fallthrough: e.target.checked })}
          className="rounded accent-indigo-600"
        />
        <label htmlFor="fallthrough" className="text-sm text-gray-700 dark:text-gray-300">
          Enable for non-listed users (fallthrough)
        </label>
      </div>
    </div>
  );
}
