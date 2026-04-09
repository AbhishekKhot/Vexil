interface Variant { key: string; value: unknown; weight: number; }

interface Props {
  config: { variants?: Variant[]; hashAttribute?: string };
  onChange: (c: unknown) => void;
}

export default function AbTestForm({ config, onChange }: Props) {
  const variants: Variant[] = config.variants ?? [
    { key: 'control', value: false, weight: 50 },
    { key: 'treatment', value: true, weight: 50 },
  ];
  const hashAttribute = config.hashAttribute ?? 'userId';

  const update = (i: number, field: keyof Variant, val: unknown) => {
    const next = variants.map((v, idx) => (idx === i ? { ...v, [field]: val } : v));
    onChange({ ...config, variants: next, hashAttribute });
  };

  const add = () =>
    onChange({ ...config, variants: [...variants, { key: 'variant-' + Date.now(), value: true, weight: 0 }], hashAttribute });

  const remove = (i: number) =>
    onChange({ ...config, variants: variants.filter((_, idx) => idx !== i), hashAttribute });

  const total = variants.reduce((sum, v) => sum + (v.weight || 0), 0);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hash attribute</label>
        <input
          placeholder="userId"
          value={hashAttribute}
          onChange={(e) => onChange({ ...config, variants, hashAttribute: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Variants <span className={total !== 100 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>({total}% total)</span>
        </span>
        <button type="button" onClick={add}
          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">
          + Add variant
        </button>
      </div>
      {variants.map((v, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input placeholder="key" value={v.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          <input placeholder="value" value={String(v.value)}
            onChange={(e) => update(i, 'value', e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          <input type="number" min={0} max={100} placeholder="weight %"
            value={v.weight}
            onChange={(e) => update(i, 'weight', Number(e.target.value))}
            className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          <button type="button" onClick={() => remove(i)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm px-1">✕</button>
        </div>
      ))}
    </div>
  );
}
