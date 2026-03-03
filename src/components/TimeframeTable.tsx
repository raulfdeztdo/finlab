'use client';

import { TimeframeAnalysis, Timeframe, IndicatorSignal } from '@/lib/types';
import { TIMEFRAME_LABELS } from '@/lib/types';

interface TimeframeTableProps {
  analyses: Record<Timeframe, TimeframeAnalysis>;
}

const INDICATOR_ORDER = [
  { key: 'ema', label: 'EMA (9/21/50)' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'bollinger', label: 'Bollinger' },
  { key: 'stochastic', label: 'Estocástico' },
  { key: 'adx', label: 'ADX / DI' },
  { key: 'ichimoku', label: 'Ichimoku' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'pivots', label: 'Pivotes' },
  { key: 'atr', label: 'ATR' },
];

const TIMEFRAMES: Timeframe[] = ['5min', '15min', '30min', '1h', '4h'];

function SignalCell({ signal, value, details }: { signal: IndicatorSignal; value: number | string; details?: string }) {
  const bgColor = signal === 1
    ? 'bg-accent-green/15 text-accent-green'
    : signal === -1
      ? 'bg-accent-red/15 text-accent-red'
      : 'bg-muted-bg text-muted';

  const icon = signal === 1 ? '\u25B2' : signal === -1 ? '\u25BC' : '\u25CF';

  return (
    <td className={`px-3 py-2.5 text-center text-xs font-mono ${bgColor}`}>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px]">{icon}</span>
        <span className="font-medium">{typeof value === 'number' ? value.toFixed(1) : value}</span>
        {details && <span className="text-[9px] opacity-70">{details}</span>}
      </div>
    </td>
  );
}

function OverallRow({ analyses }: { analyses: Record<Timeframe, TimeframeAnalysis> }) {
  return (
    <tr className="border-t-2 border-accent-blue/30">
      <td className="px-3 py-3 text-sm font-bold text-accent-blue">GENERAL</td>
      {TIMEFRAMES.map(tf => {
        const signal = analyses[tf]?.overallSignal ?? 0;
        const bgColor = signal === 1
          ? 'bg-accent-green/20 text-accent-green'
          : signal === -1
            ? 'bg-accent-red/20 text-accent-red'
            : 'bg-muted-bg text-muted';
        const label = signal === 1 ? 'ALCISTA' : signal === -1 ? 'BAJISTA' : 'NEUTRAL';
        return (
          <td key={tf} className={`px-3 py-3 text-center text-xs font-bold ${bgColor}`}>
            {label}
          </td>
        );
      })}
    </tr>
  );
}

export default function TimeframeTable({ analyses }: TimeframeTableProps) {
  return (
    <div className="rounded-xl bg-card border border-card-border overflow-hidden">
      <div className="px-6 py-4 border-b border-card-border">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
          Análisis Multi-Temporal
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase w-36">
                Indicador
              </th>
              {TIMEFRAMES.map(tf => (
                <th key={tf} className="px-3 py-3 text-center text-xs font-medium text-muted uppercase">
                  {TIMEFRAME_LABELS[tf]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {INDICATOR_ORDER.map(({ key, label }) => (
              <tr key={key} className="hover:bg-muted-bg/30 transition-colors">
                <td className="px-3 py-2.5 text-sm font-medium text-foreground/80">
                  {label}
                </td>
                {TIMEFRAMES.map(tf => {
                  const indicator = analyses[tf]?.indicators?.[key];
                  if (!indicator) {
                    return (
                      <td key={tf} className="px-3 py-2.5 text-center text-xs text-muted">
                        --
                      </td>
                    );
                  }
                  return (
                    <SignalCell
                      key={tf}
                      signal={indicator.signal}
                      value={indicator.value}
                      details={indicator.details}
                    />
                  );
                })}
              </tr>
            ))}
            <OverallRow analyses={analyses} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
