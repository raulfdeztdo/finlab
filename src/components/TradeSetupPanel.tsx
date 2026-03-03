'use client';

import { TradeSetup } from '@/lib/types';

interface TradeSetupPanelProps {
  setup: TradeSetup;
  currentPrice: number;
}

export default function TradeSetupPanel({ setup, currentPrice }: TradeSetupPanelProps) {
  const isBuy = setup.direction === 'STRONG_BUY' || setup.direction === 'BUY';
  const isSell = setup.direction === 'STRONG_SELL' || setup.direction === 'SELL';
  const isNeutral = setup.direction === 'NEUTRAL';

  const dirColor = isBuy ? 'text-accent-green' : isSell ? 'text-accent-red' : 'text-accent-yellow';

  return (
    <div className="p-6 rounded-xl bg-card border border-card-border">
      <h3 className="text-sm font-medium text-muted mb-4 uppercase tracking-wider">Configuración de Trade</h3>

      {isNeutral ? (
        <div className="text-center py-8">
          <p className="text-accent-yellow text-lg font-medium">Sin Configuración Clara</p>
          <p className="text-muted text-sm mt-2">Las señales son contradictorias. Espera alineación.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Price */}
          <div className="text-center">
            <p className="text-xs text-muted">Precio Actual</p>
            <p className="text-2xl font-bold">{currentPrice.toFixed(2)}</p>
          </div>

          {/* Entry Zone */}
          <div className="flex justify-between items-center py-2 border-t border-card-border">
            <span className="text-sm text-muted">Zona de Entrada</span>
            <span className={`text-sm font-mono font-medium ${dirColor}`}>
              {setup.entryZone.min.toFixed(2)} - {setup.entryZone.max.toFixed(2)}
            </span>
          </div>

          {/* Stop Loss */}
          <div className="flex justify-between items-center py-2 border-t border-card-border">
            <span className="text-sm text-muted">Stop Loss</span>
            <span className="text-sm font-mono font-medium text-accent-red">
              {setup.stopLoss.toFixed(2)}
            </span>
          </div>

          {/* Take Profit 1 */}
          <div className="flex justify-between items-center py-2 border-t border-card-border">
            <span className="text-sm text-muted">Objetivo 1</span>
            <span className="text-sm font-mono font-medium text-accent-green">
              {setup.takeProfit1.toFixed(2)}
              <span className="text-xs text-muted ml-1">(1:{setup.riskReward1})</span>
            </span>
          </div>

          {/* Take Profit 2 */}
          <div className="flex justify-between items-center py-2 border-t border-card-border">
            <span className="text-sm text-muted">Objetivo 2</span>
            <span className="text-sm font-mono font-medium text-accent-green">
              {setup.takeProfit2.toFixed(2)}
              <span className="text-xs text-muted ml-1">(1:{setup.riskReward2})</span>
            </span>
          </div>

          {/* ATR */}
          <div className="flex justify-between items-center py-2 border-t border-card-border">
            <span className="text-sm text-muted">ATR (15M)</span>
            <span className="text-sm font-mono">{setup.atr.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
