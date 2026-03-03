'use client';

import { MarketData } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceHeaderProps {
  data: MarketData;
}

export default function PriceHeader({ data }: PriceHeaderProps) {
  const isPositive = data.change > 0;
  const isNegative = data.change < 0;

  return (
    <div className="flex items-end gap-6">
      {/* Price */}
      <div>
        <p className="text-4xl font-bold tracking-tight">
          {data.currentPrice.toFixed(2)}
        </p>
      </div>

      {/* Change */}
      <div className="flex items-center gap-2 pb-1">
        {isPositive ? (
          <TrendingUp className="w-5 h-5 text-accent-green" />
        ) : isNegative ? (
          <TrendingDown className="w-5 h-5 text-accent-red" />
        ) : (
          <Minus className="w-5 h-5 text-muted" />
        )}
        <span className={`text-lg font-medium ${
          isPositive ? 'text-accent-green' : isNegative ? 'text-accent-red' : 'text-muted'
        }`}>
          {isPositive ? '+' : ''}{data.change.toFixed(2)} ({isPositive ? '+' : ''}{data.changePercent.toFixed(3)}%)
        </span>
      </div>

      {/* 24h Range */}
      <div className="pb-1 ml-auto flex items-center gap-4 text-sm text-muted">
        <div>
          <span className="text-xs">Mín. 24H</span>
          <p className="font-mono text-accent-red">{data.low24h.toFixed(2)}</p>
        </div>
        <div className="w-24 h-1.5 bg-muted-bg rounded-full relative">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent-red via-accent-yellow to-accent-green rounded-full"
            style={{
              width: data.high24h > data.low24h
                ? `${((data.currentPrice - data.low24h) / (data.high24h - data.low24h)) * 100}%`
                : '50%',
            }}
          />
        </div>
        <div>
          <span className="text-xs">Máx. 24H</span>
          <p className="font-mono text-accent-green">{data.high24h.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
