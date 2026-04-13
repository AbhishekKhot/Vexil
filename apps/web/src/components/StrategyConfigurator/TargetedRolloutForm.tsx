import { useState } from 'react';

interface Rule {
  attribute: string;
  operator: string;
  value: string;
}

interface Props {
  config: { percentage?: number; rules?: Rule[] };
  onChange: (c: unknown) => void;
}

const OPERATORS = ['eq', 'neq', 'contains', 'not_contains', 'gt', 'lt', 'in'];

export default function TargetedRolloutForm({ config, onChange }: Props) {
  const rules: Rule[] = config.rules ?? [];

  const addRule = () =>
    onChange({ ...config, rules: [...rules, { attribute: '', operator: 'eq', value: '' }] });

  const updateRule = (i: number, field: keyof Rule, val: string) => {
    const next = rules.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    onChange({ ...config, rules: next });
  };

  const removeRule = (i: number) =>
    onChange({ ...config, rules: rules.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Rollout percentage: <span className="font-bold">{config.percentage ?? 0}%</span>
        </label>
        <input
          type="range" min={0} max={100}
          value={config.percentage ?? 0}
          onChange={(e) => onChange({ ...config, percentage: Number(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Targeting rules (AND)</span>
          <button type="button" onClick={addRule}
            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">
            + Add rule
          </button>
        </div>
        {rules.map((rule, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input placeholder="attribute" value={rule.attribute}
              onChange={(e) => updateRule(i, 'attribute', e.target.value)}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <select value={rule.operator}
              onChange={(e) => updateRule(i, 'operator', e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input placeholder="value" value={rule.value}
              onChange={(e) => updateRule(i, 'value', e.target.value)}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            <button type="button" onClick={() => removeRule(i)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm px-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
