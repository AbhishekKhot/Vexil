import { useState } from 'react';
import BooleanForm from './BooleanForm';
import RolloutForm from './RolloutForm';
import TargetedRolloutForm from './TargetedRolloutForm';
import UserTargetingForm from './UserTargetingForm';
import AttributeMatchingForm from './AttributeMatchingForm';
import AbTestForm from './AbTestForm';
import TimeWindowForm from './TimeWindowForm';

export type StrategyType =
  | 'boolean'
  | 'rollout'
  | 'targeted_rollout'
  | 'user_targeting'
  | 'attribute_matching'
  | 'ab_test'
  | 'time_window';

const STRATEGY_LABELS: Record<StrategyType, string> = {
  boolean: 'Boolean (Kill Switch)',
  rollout: 'Percentage Rollout',
  targeted_rollout: 'Targeted Rollout',
  user_targeting: 'User Targeting',
  attribute_matching: 'Attribute Matching',
  ab_test: 'A/B Test',
  time_window: 'Time Window',
};

interface Props {
  value: { strategyType: StrategyType; strategyConfig: unknown };
  onChange: (val: { strategyType: StrategyType; strategyConfig: unknown }) => void;
}

export default function StrategyConfigurator({ value, onChange }: Props) {
  const defaultConfig: Record<StrategyType, unknown> = {
    boolean: { value: false },
    rollout: { percentage: 50, hashAttribute: 'userId' },
    targeted_rollout: { percentage: 50, hashAttribute: 'userId', segments: [] },
    user_targeting: { userIds: [], fallthrough: false, hashAttribute: 'userId' },
    attribute_matching: { rules: [] },
    ab_test: { variants: [{ key: 'control', value: false, weight: 50 }, { key: 'treatment', value: true, weight: 50 }], hashAttribute: 'userId' },
    time_window: { start: '', end: '', value: true },
  };
  const setType = (t: StrategyType) => onChange({ strategyType: t, strategyConfig: defaultConfig[t] });
  const setConfig = (c: unknown) => onChange({ ...value, strategyConfig: c });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
        <select
          className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={value.strategyType}
          onChange={(e) => setType(e.target.value as StrategyType)}
        >
          {(Object.keys(STRATEGY_LABELS) as StrategyType[]).map((k) => (
            <option key={k} value={k}>{STRATEGY_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {value.strategyType === 'boolean' && (
        <BooleanForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'rollout' && (
        <RolloutForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'targeted_rollout' && (
        <TargetedRolloutForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'user_targeting' && (
        <UserTargetingForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'attribute_matching' && (
        <AttributeMatchingForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'ab_test' && (
        <AbTestForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
      {value.strategyType === 'time_window' && (
        <TimeWindowForm config={value.strategyConfig as any} onChange={setConfig} />
      )}
    </div>
  );
}
