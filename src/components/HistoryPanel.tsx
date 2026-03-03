'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, X, TrendingUp, TrendingDown, Clock, Loader2, BarChart3 } from 'lucide-react';

interface HistoryPanelProps {
  onClose: () => void;
}

interface ActionRecord {
  id: number;
  symbol: string;
  action_type: string;
  direction: string;
  title: string;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: number | null;
  confidence: number | null;
  urgency: string | null;
  reasons: string | null;
  overall_signal_direction: string;
  overall_signal_score: number;
  market_bias: string;
  volatility_state: string;
  timestamp: string;
}

interface Stats {
  total_actions: number;
  long_count: number;
  short_count: number;
  wait_count: number;
  avg_confidence: number | null;
  avg_risk_reward: number | null;
}

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'actions' | 'stats'>('actions');

  const fetchData = useCallback(async () => {
    try {
      const [actionsRes, statsRes] = await Promise.all([
        fetch('/api/history?type=actions&limit=100'),
        fetch('/api/history?type=stats'),
      ]);
      const actionsData = await actionsRes.json();
      const statsData = await statsRes.json();

      if (actionsData.success) setActions(actionsData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const directionIcon = (dir: string) => {
    if (dir === 'LONG') return <TrendingUp className="w-3.5 h-3.5 text-accent-green" />;
    if (dir === 'SHORT') return <TrendingDown className="w-3.5 h-3.5 text-accent-red" />;
    return <Clock className="w-3.5 h-3.5 text-accent-yellow" />;
  };

  const directionColor = (dir: string) => {
    if (dir === 'LONG') return 'text-accent-green';
    if (dir === 'SHORT') return 'text-accent-red';
    return 'text-accent-yellow';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4 rounded-xl bg-card border border-card-border overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-bold">Historial de Acciones</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-card-border">
              <button
                onClick={() => setTab('actions')}
                className={`px-3 py-1 text-xs ${tab === 'actions' ? 'bg-accent-blue text-white' : 'bg-muted-bg text-muted hover:text-foreground'}`}
              >
                Acciones
              </button>
              <button
                onClick={() => setTab('stats')}
                className={`px-3 py-1 text-xs ${tab === 'stats' ? 'bg-accent-blue text-white' : 'bg-muted-bg text-muted hover:text-foreground'}`}
              >
                Estadísticas
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted-bg transition-colors">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
            </div>
          ) : tab === 'stats' ? (
            // Stats view
            stats ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted-bg/50 border border-card-border text-center">
                  <p className="text-2xl font-bold">{stats.total_actions}</p>
                  <p className="text-xs text-muted mt-1">Total Acciones (7d)</p>
                </div>
                <div className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/30 text-center">
                  <p className="text-2xl font-bold text-accent-green">{stats.long_count}</p>
                  <p className="text-xs text-muted mt-1">LONG</p>
                </div>
                <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/30 text-center">
                  <p className="text-2xl font-bold text-accent-red">{stats.short_count}</p>
                  <p className="text-xs text-muted mt-1">SHORT</p>
                </div>
                <div className="p-4 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30 text-center">
                  <p className="text-2xl font-bold text-accent-yellow">{stats.wait_count}</p>
                  <p className="text-xs text-muted mt-1">ESPERAR</p>
                </div>
                <div className="p-4 rounded-lg bg-muted-bg/50 border border-card-border text-center">
                  <p className="text-2xl font-bold text-accent-blue">{stats.avg_confidence ?? '-'}%</p>
                  <p className="text-xs text-muted mt-1">Confianza Media</p>
                </div>
                <div className="p-4 rounded-lg bg-muted-bg/50 border border-card-border text-center">
                  <p className="text-2xl font-bold text-accent-purple">1:{stats.avg_risk_reward ?? '-'}</p>
                  <p className="text-xs text-muted mt-1">R:R Medio</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted py-8">Sin datos disponibles</p>
            )
          ) : (
            // Actions list
            actions.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-muted mx-auto mb-3" />
                <p className="text-muted">No hay acciones registradas todavía</p>
                <p className="text-xs text-muted mt-1">Las acciones se registran con cada actualización</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actions.map(action => (
                  <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted-bg/30 border border-card-border hover:bg-muted-bg/50 transition-colors">
                    <div className="mt-0.5">{directionIcon(action.direction)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${directionColor(action.direction)}`}>
                          {action.title}
                        </span>
                        {action.confidence !== null && action.confidence > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted-bg text-muted">
                            {action.confidence}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{action.symbol}</span>
                        {action.entry_price && (
                          <span>Entrada: {action.entry_price.toFixed(2)}</span>
                        )}
                        {action.risk_reward && action.risk_reward > 0 && (
                          <span>R:R 1:{action.risk_reward.toFixed(1)}</span>
                        )}
                        <span className="ml-auto">
                          {new Date(action.timestamp).toLocaleString('es-ES', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
