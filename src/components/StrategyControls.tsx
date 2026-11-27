import type { CSSProperties } from 'react';
import { defaultStrategy, strategyAxes } from '../services/strategies';
import type { StrategyParameters } from '../types';

interface Props {
  parameters: StrategyParameters;
  onChange: (parameters: StrategyParameters) => void;
}

export default function StrategyControls({ parameters, onChange }: Props) {
  return (
    <div className="sliders">
      {strategyAxes.map(axis => {
        const value = parameters[axis.key] ?? defaultStrategy[axis.key];
        return (
          <div className="slider" key={axis.key}>
            <div className="slider-head">
              <span className="slider-label">{axis.label}</span>
              <output className="slider-value">{value}</output>
            </div>
            <input className="slider-input" type="range" min={0} max={100} step={5} aria-label={axis.label}
              value={value} style={{ '--fill': `${value}%` } as CSSProperties}
              onChange={event => onChange({ ...parameters, [axis.key]: Number(event.target.value) })} />
            <div className="slider-ends">
              <span>{axis.low}</span>
              <span>{axis.high}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
