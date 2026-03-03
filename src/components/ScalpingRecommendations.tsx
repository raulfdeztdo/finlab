'use client';

import { ScalpingAnalysis, ScalpingRecommendation, InterestZone } from '@/lib/types';
import { Target, TrendingUp, TrendingDown, Clock, Zap, Shield, AlertTriangle, MapPin } from 'lucide-react';

interface ScalpingRecommendationsProps {
  analysis: ScalpingAnalysis;
  currentPrice: number;
}

const DIRECTION_COLORS = {
  LONG: { bg: 'bg-accent-green/10', border: 'border-accent-green/30', text: 'text-accent-green', icon: TrendingUp },
  SHORT: { bg: 'bg-accent-red/10', border: 'border-accent-red/30', text: 'text-accent-red', icon: TrendingDown },
  ESPERAR: { bg: 'bg-accent-yellow/10', border: 'border-accent-yellow/30', text: 'text-accent-yellow', icon: Clock },
};

const URGENCY_BADGES = {
  alta: { bg: 'bg-accent-red/20', text: 'text-accent-red', label: 'URGENTE' },
  media: { bg: 'bg-accent-yellow/20', text: 'text-accent-yellow', label: 'MEDIA' },
  baja: { bg: 'bg-muted-bg', text: 'text-muted', label: 'BAJA' },
};

const ZONE_COLORS: Record<string, string> = {
  support: 'text-accent-green',
  resistance: 'text-accent-red',
  pivot: 'text-accent-blue',
  ema: 'text-accent-purple',
  bollinger: 'text-accent-yellow',
  ichimoku: 'text-accent-blue',
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 70 ? 'bg-accent-green' :
                confidence >= 50 ? 'bg-accent-yellow' : 'bg-accent-red';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted w-8 text-right">{confidence}%</span>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: ScalpingRecommendation }) {
  const dirConfig = DIRECTION_COLORS[rec.direction];
  const urgency = URGENCY_BADGES[rec.urgency];
  const Icon = dirConfig.icon;
  const isWait = rec.type === 'wait';

  return (
    <div className={`rounded-lg border ${dirConfig.border} ${dirConfig.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${dirConfig.text}`} />
          <div>
            <h4 className={`text-sm font-bold ${dirConfig.text}`}>{rec.title}</h4>
            <p className="text-xs text-muted mt-0.5">{rec.description}</p>
          </div>
        </div>
        {!isWait && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${urgency.bg} ${urgency.text}`}>
            {urgency.label}
          </span>
        )}
      </div>

      {/* Trade levels */}
      {!isWait && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-background/50 rounded p-2 text-center">
            <p className="text-muted mb-1">Entrada</p>
            <p className={`font-mono font-bold ${dirConfig.text}`}>{rec.entry.toFixed(2)}</p>
          </div>
          <div className="bg-background/50 rounded p-2 text-center">
            <p className="text-muted mb-1">Stop Loss</p>
            <p className="font-mono font-bold text-accent-red">{rec.stopLoss.toFixed(2)}</p>
          </div>
          <div className="bg-background/50 rounded p-2 text-center">
            <p className="text-muted mb-1">Objetivo</p>
            <p className="font-mono font-bold text-accent-green">{rec.takeProfit.toFixed(2)}</p>
          </div>
          <div className="bg-background/50 rounded p-2 text-center">
            <p className="text-muted mb-1">R:R</p>
            <p className="font-mono font-bold text-accent-blue">1:{rec.riskReward}</p>
          </div>
        </div>
      )}

      {/* Confidence */}
      {!isWait && (
        <div>
          <p className="text-[10px] text-muted mb-1 uppercase">Confianza</p>
          <ConfidenceBar confidence={rec.confidence} />
        </div>
      )}

      {/* Reasons */}
      <div>
        <p className="text-[10px] text-muted mb-1 uppercase">Razones</p>
        <ul className="space-y-0.5">
          {rec.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
              <span className="text-accent-blue mt-0.5">•</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ZoneRow({ zone, currentPrice }: { zone: InterestZone; currentPrice: number }) {
  const distance = zone.price - currentPrice;
  const distPercent = (distance / currentPrice) * 100;
  const isAbove = distance > 0;
  const zoneColor = ZONE_COLORS[zone.type] || 'text-muted';

  return (
    <tr className="hover:bg-muted-bg/30 transition-colors text-xs">
      <td className="py-1.5 px-2">
        <div className="flex items-center gap-1.5">
          <MapPin className={`w-3 h-3 ${zoneColor}`} />
          <span className={`font-medium ${zoneColor}`}>{zone.label}</span>
        </div>
      </td>
      <td className="py-1.5 px-2 font-mono text-right">{zone.price.toFixed(2)}</td>
      <td className={`py-1.5 px-2 font-mono text-right ${isAbove ? 'text-accent-green' : 'text-accent-red'}`}>
        {isAbove ? '+' : ''}{distance.toFixed(2)} ({isAbove ? '+' : ''}{distPercent.toFixed(3)}%)
      </td>
      <td className="py-1.5 px-2 text-center">
        <div className="flex gap-0.5 justify-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < zone.strength ? 'bg-accent-blue' : 'bg-muted-bg'}`}
            />
          ))}
        </div>
      </td>
    </tr>
  );
}

export default function ScalpingRecommendations({ analysis, currentPrice }: ScalpingRecommendationsProps) {
  const biasColor = analysis.marketBias === 'alcista' ? 'text-accent-green'
    : analysis.marketBias === 'bajista' ? 'text-accent-red'
    : 'text-accent-yellow';

  const volIcon = analysis.volatilityState === 'alta' ? '⚡' : analysis.volatilityState === 'baja' ? '🔋' : '⚖️';

  return (
    <div className="rounded-xl bg-card border border-card-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-card-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent-blue" />
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
              Recomendaciones de Scalping
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {/* Market bias */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Sesgo:</span>
              <span className={`font-bold uppercase ${biasColor}`}>{analysis.marketBias}</span>
            </div>
            {/* Volatility */}
            <div className="flex items-center gap-1">
              <span className="text-muted">Vol:</span>
              <span>{volIcon} {analysis.volatilityState}</span>
            </div>
            {/* Best session badge */}
            {analysis.bestSession && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green font-medium">
                <Zap className="w-3 h-3" />
                Sesión Óptima
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <p className="mt-2 text-xs text-foreground/60 flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          {analysis.summary}
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recommendations */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Señales de Acción
          </h4>
          {analysis.recommendations.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} />
          ))}
        </div>

        {/* Right: Interest Zones */}
        <div>
          <h4 className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <MapPin className="w-3 h-3" />
            Zonas de Interés
          </h4>
          {analysis.zones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="py-1.5 px-2 text-left text-[10px] text-muted uppercase">Nivel</th>
                    <th className="py-1.5 px-2 text-right text-[10px] text-muted uppercase">Precio</th>
                    <th className="py-1.5 px-2 text-right text-[10px] text-muted uppercase">Distancia</th>
                    <th className="py-1.5 px-2 text-center text-[10px] text-muted uppercase">Fuerza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {analysis.zones.map((zone, i) => (
                    <ZoneRow key={i} zone={zone} currentPrice={currentPrice} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted py-4 text-center">Sin zonas de interés identificadas</p>
          )}
        </div>
      </div>
    </div>
  );
}
