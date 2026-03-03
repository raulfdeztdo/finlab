'use client';

import { AnalysisResult } from '@/lib/types';
import { IndicatorSignal } from '@/lib/types';

interface MTAPanelProps {
  mta: AnalysisResult['mtaAlignment'];
}

function AlignmentDot({ signal, label }: { signal: IndicatorSignal; label: string }) {
  const color = signal === 1
    ? 'bg-accent-green text-accent-green'
    : signal === -1
      ? 'bg-accent-red text-accent-red'
      : 'bg-muted text-muted';

  const textColor = signal === 1
    ? 'text-accent-green'
    : signal === -1
      ? 'text-accent-red'
      : 'text-muted';

  const bgColor = signal === 1
    ? 'bg-accent-green'
    : signal === -1
      ? 'bg-accent-red'
      : 'bg-muted';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full ${bgColor}`} />
      <span className={`text-[10px] font-medium ${textColor}`}>{label}</span>
    </div>
  );
}

export default function MTAPanel({ mta }: MTAPanelProps) {
  return (
    <div className="p-6 rounded-xl bg-card border border-card-border">
      <h3 className="text-sm font-medium text-muted mb-4 uppercase tracking-wider">
        Alineación Multi-Temporal
      </h3>

      <div className="flex items-center justify-between px-4">
        <AlignmentDot signal={mta.trend4h} label="4H Tendencia" />
        <div className="flex-1 h-px bg-card-border mx-2" />
        <AlignmentDot signal={mta.confirmation1h} label="1H Confirm." />
        <div className="flex-1 h-px bg-card-border mx-2" />
        <AlignmentDot signal={mta.signal15m} label="15M Señal" />
        <div className="flex-1 h-px bg-card-border mx-2" />
        <AlignmentDot signal={mta.entry5m} label="5M Entrada" />
      </div>

      <div className="mt-4 text-center">
        {mta.aligned ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-green/15 text-accent-green text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
            Alineado - Alta Probabilidad
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-yellow/15 text-accent-yellow text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
            No Alineado - Precaución
          </span>
        )}
      </div>
    </div>
  );
}
