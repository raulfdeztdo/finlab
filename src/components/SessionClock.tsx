'use client';

import { SessionInfo } from '@/lib/types';
import { Clock, Zap, Moon } from 'lucide-react';

interface SessionClockProps {
  session: SessionInfo;
  lastUpdated: string;
}

const SESSION_COLORS: Record<string, string> = {
  asian: 'text-accent-purple',
  london: 'text-accent-blue',
  ny_overlap: 'text-accent-green',
  ny: 'text-accent-yellow',
  closed: 'text-muted',
};

export default function SessionClock({ session, lastUpdated }: SessionClockProps) {
  const sessionColor = SESSION_COLORS[session.currentSession] || 'text-muted';

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="flex items-center gap-6 text-sm">
      {/* Session */}
      <div className="flex items-center gap-2">
        {session.isMarketHours ? (
          <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-accent-red" />
        )}
        <span className={`font-medium ${sessionColor}`}>
          {session.sessionLabel}
        </span>
      </div>

      {/* Optimal Scalping */}
      {session.isOptimalScalping && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green text-xs font-medium">
          <Zap className="w-3 h-3" />
          Scalping Óptimo
        </div>
      )}

      {/* Last Updated */}
      <div className="flex items-center gap-1.5 text-muted">
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs">
          Actualizado: {formatTime(lastUpdated)}
        </span>
      </div>

      {/* Next Update */}
      <div className="text-xs text-muted">
        Próximo: {formatTime(session.nextUpdate)}
      </div>
    </div>
  );
}
