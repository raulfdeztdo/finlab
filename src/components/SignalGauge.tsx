'use client';

import { SignalScore, SignalDirection } from '@/lib/types';

interface SignalGaugeProps {
  score: SignalScore;
}

const DIRECTION_CONFIG: Record<SignalDirection, { label: string; color: string; glowClass: string }> = {
  STRONG_BUY:  { label: 'COMPRA FUERTE',  color: '#10b981', glowClass: 'glow-green' },
  BUY:         { label: 'COMPRA',          color: '#34d399', glowClass: 'glow-green' },
  NEUTRAL:     { label: 'NEUTRAL',         color: '#f59e0b', glowClass: 'glow-yellow' },
  SELL:        { label: 'VENTA',           color: '#f87171', glowClass: 'glow-red' },
  STRONG_SELL: { label: 'VENTA FUERTE',    color: '#ef4444', glowClass: 'glow-red' },
};

export default function SignalGauge({ score }: SignalGaugeProps) {
  const config = DIRECTION_CONFIG[score.direction];
  const circumference = 2 * Math.PI * 45; // radius = 45
  const progress = (score.normalized / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div className={`flex flex-col items-center p-6 rounded-xl bg-card border border-card-border ${config.glowClass}`}>
      <h3 className="text-sm font-medium text-muted mb-4 uppercase tracking-wider">Señal</h3>

      {/* Gauge SVG */}
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={config.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="gauge-animate transition-all duration-1000"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: config.color }}>
            {score.normalized}%
          </span>
        </div>
      </div>

      {/* Direction label */}
      <div
        className="mt-4 px-4 py-2 rounded-full text-sm font-bold tracking-wide"
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
        }}
      >
        {config.label}
      </div>

      {/* Confidence */}
      <p className="mt-2 text-xs text-muted">
        Confianza: {score.confidence === 'STRONG' ? 'ALTA' : score.confidence === 'MODERATE' ? 'MODERADA' : 'BAJA'}
      </p>
    </div>
  );
}
