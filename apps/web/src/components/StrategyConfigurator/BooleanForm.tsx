interface Props {
  config: { value?: boolean };
  onChange: (c: { value: boolean }) => void;
}

export default function BooleanForm({ config, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Default value</label>
      <select
        className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={config.value === true ? 'true' : 'false'}
        onChange={(e) => onChange({ value: e.target.value === 'true' })}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
  );
}
