'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Target, ShieldAlert, Clock, Award, Loader2 } from 'lucide-react';

interface TradeRecord {
  timestamp: string;
  symbol: string;
  direction: string;
  type: string;
  title: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  urgency: string;
  reasons: string;
  signalDirection: string;
  signalScore: number;
}

interface TradeResult {
  trade: TradeRecord;
  outcome: 'win' | 'loss' | 'open';
  exitPrice: number;
  exitDatetime: string;
  pnlPoints: number;
  duration: string;
  hitTP: boolean;
  hitSL: boolean;
}

interface DirectionStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface BacktestResult {
  weekKey: string;
  weekRange: string;
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number;
  totalPnlPoints: number;
  avgPnlPoints: number;
  avgConfidence: number;
  avgRiskReward: number;
  bestTrade: TradeResult | null;
  worstTrade: TradeResult | null;
  tradeResults: TradeResult[];
  byDirection: {
    LONG: DirectionStats;
    SHORT: DirectionStats;
  };
  byType: Record<string, DirectionStats>;
}

export default function BacktestingPanel() {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  const fetchBacktest = useCallback(async (week?: string) => {
    setLoading(true);
    try {
      const url = week ? `/api/backtesting?week=${week}` : '/api/backtesting';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setAvailableWeeks(json.availableWeeks || []);
        if (!selectedWeek && json.data?.weekKey) {
          setSelectedWeek(json.data.weekKey);
        }
      }
    } catch (err) {
      console.error('[BacktestingPanel] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => {
    fetchBacktest();
  }, []);

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
    fetchBacktest(week);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-card-border p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-accent-purple" />
          <h2 className="text-base font-semibold">Backtesting Semanal</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
          <span className="ml-2 text-sm text-muted">Cargando backtesting...</span>
        </div>
      </div>
    );
  }

  if (!data || data.totalTrades === 0) {
    return (
      <div className="bg-card rounded-xl border border-card-border p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-accent-purple" />
          <h2 className="text-base font-semibold">Backtesting Semanal</h2>
        </div>
        <p className="text-sm text-muted mt-3">
          No hay datos de backtesting disponibles. Los trades se registran automáticamente con cada análisis.
        </p>
      </div>
    );
  }

  const pnlColor = data.totalPnlPoints >= 0 ? 'text-accent-green' : 'text-accent-red';
  const winRateColor = data.winRate >= 60 ? 'text-accent-green' : data.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red';

  return (
    <div className="bg-card rounded-xl border border-card-border overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-muted-bg/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-accent-purple" />
          <h2 className="text-base font-semibold">Backtesting Semanal</h2>
          <span className="text-xs text-muted font-mono">{data.weekRange}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick stats in header */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className={winRateColor + ' font-semibold'}>{data.winRate}% WR</span>
            <span className="text-muted">|</span>
            <span className={pnlColor + ' font-semibold'}>{data.totalPnlPoints > 0 ? '+' : ''}{data.totalPnlPoints} pts</span>
            <span className="text-muted">|</span>
            <span className="text-muted">{data.totalTrades} trades</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-card-border px-4 sm:px-6 py-4 space-y-5">
          {/* Week selector */}
          {availableWeeks.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Semana:</span>
              <select
                value={selectedWeek}
                onChange={(e) => handleWeekChange(e.target.value)}
                className="text-xs bg-muted-bg border border-card-border rounded-lg px-2 py-1 text-foreground"
              >
                {availableWeeks.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={<Target className="w-4 h-4 text-accent-blue" />}
              label="Win Rate"
              value={`${data.winRate}%`}
              sub={`${data.wins}W / ${data.losses}L`}
              valueClass={winRateColor}
            />
            <KpiCard
              icon={data.totalPnlPoints >= 0 ? <TrendingUp className="w-4 h-4 text-accent-green" /> : <TrendingDown className="w-4 h-4 text-accent-red" />}
              label="PnL Total"
              value={`${data.totalPnlPoints > 0 ? '+' : ''}${data.totalPnlPoints} pts`}
              sub={`Media: ${data.avgPnlPoints > 0 ? '+' : ''}${data.avgPnlPoints}`}
              valueClass={pnlColor}
            />
            <KpiCard
              icon={<Award className="w-4 h-4 text-accent-yellow" />}
              label="Confianza Media"
              value={`${data.avgConfidence}%`}
              sub={`R:R medio: 1:${data.avgRiskReward}`}
            />
            <KpiCard
              icon={<Clock className="w-4 h-4 text-accent-purple" />}
              label="Trades Totales"
              value={String(data.totalTrades)}
              sub={data.openTrades > 0 ? `${data.openTrades} abiertos` : 'Todos cerrados'}
            />
          </div>

          {/* Direction breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DirectionCard direction="LONG" stats={data.byDirection.LONG} />
            <DirectionCard direction="SHORT" stats={data.byDirection.SHORT} />
          </div>

          {/* By type breakdown */}
          {Object.keys(data.byType).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Por tipo de operación</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(data.byType).map(([type, stats]) => (
                  <div key={type} className="bg-muted-bg/50 rounded-lg px-3 py-2">
                    <div className="text-xs text-muted capitalize">{type.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-semibold">{stats.total} trades</div>
                    <div className="text-xs">
                      <span className="text-accent-green">{stats.wins}W</span>
                      <span className="text-muted mx-1">/</span>
                      <span className="text-accent-red">{stats.losses}L</span>
                      <span className="text-muted ml-1">({stats.winRate}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best / Worst trades */}
          {(data.bestTrade || data.worstTrade) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.bestTrade && (
                <HighlightTradeCard label="Mejor operación" result={data.bestTrade} variant="best" />
              )}
              {data.worstTrade && (
                <HighlightTradeCard label="Peor operación" result={data.worstTrade} variant="worst" />
              )}
            </div>
          )}

          {/* Toggle individual trades */}
          <div>
            <button
              onClick={() => setShowTrades(t => !t)}
              className="flex items-center gap-2 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              {showTrades ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showTrades ? 'Ocultar operaciones individuales' : `Ver ${data.tradeResults.length} operaciones individuales`}
            </button>

            {showTrades && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border text-muted">
                      <th className="text-left py-2 pr-2 font-medium">Hora</th>
                      <th className="text-left py-2 pr-2 font-medium">Dir.</th>
                      <th className="text-left py-2 pr-2 font-medium">Tipo</th>
                      <th className="text-right py-2 pr-2 font-medium">Entrada</th>
                      <th className="text-right py-2 pr-2 font-medium">SL</th>
                      <th className="text-right py-2 pr-2 font-medium">TP</th>
                      <th className="text-right py-2 pr-2 font-medium">R:R</th>
                      <th className="text-right py-2 pr-2 font-medium">Conf.</th>
                      <th className="text-center py-2 pr-2 font-medium">Resultado</th>
                      <th className="text-right py-2 pr-2 font-medium">PnL</th>
                      <th className="text-right py-2 font-medium">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tradeResults.map((r, i) => (
                      <tr key={i} className="border-b border-card-border/50 hover:bg-muted-bg/30">
                        <td className="py-2 pr-2 font-mono text-muted whitespace-nowrap">
                          {formatTimestamp(r.trade.timestamp)}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`font-semibold ${r.trade.direction === 'LONG' ? 'text-accent-green' : 'text-accent-red'}`}>
                            {r.trade.direction}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-muted capitalize whitespace-nowrap">
                          {r.trade.type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">{r.trade.entry.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right font-mono text-accent-red">{r.trade.stopLoss.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right font-mono text-accent-green">{r.trade.takeProfit.toFixed(2)}</td>
                        <td className="py-2 pr-2 text-right">1:{r.trade.riskReward}</td>
                        <td className="py-2 pr-2 text-right">{r.trade.confidence}%</td>
                        <td className="py-2 pr-2 text-center">
                          <OutcomeBadge outcome={r.outcome} />
                        </td>
                        <td className={`py-2 pr-2 text-right font-mono font-semibold ${r.pnlPoints >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          {r.pnlPoints > 0 ? '+' : ''}{r.pnlPoints.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-muted whitespace-nowrap">{r.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function KpiCard({ icon, label, value, sub, valueClass = '' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-muted-bg/50 rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className={`text-lg sm:text-xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function DirectionCard({ direction, stats }: { direction: 'LONG' | 'SHORT'; stats: DirectionStats }) {
  const isLong = direction === 'LONG';
  const icon = isLong
    ? <TrendingUp className="w-4 h-4 text-accent-green" />
    : <TrendingDown className="w-4 h-4 text-accent-red" />;
  const color = isLong ? 'text-accent-green' : 'text-accent-red';
  const bgColor = isLong ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-red/5 border-accent-red/20';

  if (stats.total === 0) {
    return (
      <div className={`rounded-xl border p-3 ${bgColor}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-semibold ${color}`}>{direction}</span>
        </div>
        <p className="text-xs text-muted mt-1">Sin operaciones</p>
      </div>
    );
  }

  const closed = stats.wins + stats.losses;
  const barWidth = closed > 0 ? (stats.wins / closed) * 100 : 0;

  return (
    <div className={`rounded-xl border p-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-semibold ${color}`}>{direction}</span>
        </div>
        <span className="text-xs text-muted">{stats.total} trades</span>
      </div>
      {/* Win/loss bar */}
      <div className="w-full h-2 bg-accent-red/30 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full bg-accent-green rounded-full transition-all"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span><span className="text-accent-green font-semibold">{stats.wins}W</span> / <span className="text-accent-red font-semibold">{stats.losses}L</span></span>
        <span className="text-muted">{stats.winRate}% WR</span>
      </div>
    </div>
  );
}

function HighlightTradeCard({ label, result, variant }: {
  label: string;
  result: TradeResult;
  variant: 'best' | 'worst';
}) {
  const isBest = variant === 'best';
  const borderColor = isBest ? 'border-accent-green/20' : 'border-accent-red/20';
  const bgColor = isBest ? 'bg-accent-green/5' : 'bg-accent-red/5';
  const icon = isBest
    ? <Award className="w-4 h-4 text-accent-green" />
    : <ShieldAlert className="w-4 h-4 text-accent-red" />;

  return (
    <div className={`rounded-xl border p-3 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{result.trade.title}</div>
          <div className="text-xs text-muted mt-0.5">
            {result.trade.direction} | {result.trade.type.replace(/_/g, ' ')} | {result.duration}
          </div>
        </div>
        <div className={`text-lg font-bold ${result.pnlPoints >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {result.pnlPoints > 0 ? '+' : ''}{result.pnlPoints.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: 'win' | 'loss' | 'open' }) {
  if (outcome === 'win') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-green/15 text-accent-green text-[10px] font-semibold">WIN</span>;
  }
  if (outcome === 'loss') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-red/15 text-accent-red text-[10px] font-semibold">LOSS</span>;
  }
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-yellow/15 text-accent-yellow text-[10px] font-semibold">ABIERTO</span>;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('es-ES', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    });
  } catch {
    return ts;
  }
}
