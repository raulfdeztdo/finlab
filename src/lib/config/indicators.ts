import { IndicatorConfig, Timeframe } from '@/lib/types';

// ============================================
// Indicator Parameters - Optimized for Scalping
// ============================================

export const INDICATOR_CONFIG: IndicatorConfig = {
  rsi: {
    '5min':  { period: 7,  overbought: 80, oversold: 20 },
    '15min': { period: 9,  overbought: 75, oversold: 25 },
    '30min': { period: 14, overbought: 70, oversold: 30 },
    '1h':    { period: 14, overbought: 70, oversold: 30 },
    '4h':    { period: 14, overbought: 70, oversold: 30 },
  },
  macd: {
    '5min':  { fast: 5,  slow: 13, signal: 1 },
    '15min': { fast: 8,  slow: 21, signal: 5 },
    '30min': { fast: 12, slow: 26, signal: 9 },
    '1h':    { fast: 12, slow: 26, signal: 9 },
    '4h':    { fast: 12, slow: 26, signal: 9 },
  },
  bollinger: {
    '5min':  { period: 14, stdDev: 1.5 },
    '15min': { period: 20, stdDev: 2.0 },
    '30min': { period: 20, stdDev: 2.0 },
    '1h':    { period: 20, stdDev: 2.0 },
    '4h':    { period: 20, stdDev: 2.5 },
  },
  ema: {
    periods: [9, 21, 50, 100, 200],
  },
  stochastic: {
    '5min':  { kPeriod: 5,  dPeriod: 3, smooth: 1 },
    '15min': { kPeriod: 14, dPeriod: 3, smooth: 3 },
    '30min': { kPeriod: 14, dPeriod: 3, smooth: 3 },
    '1h':    { kPeriod: 14, dPeriod: 3, smooth: 3 },
    '4h':    { kPeriod: 14, dPeriod: 3, smooth: 3 },
  },
  atr: { period: 14 },
  adx: { period: 14 },
  ichimoku: {
    '5min':  { conversionPeriod: 7,  basePeriod: 22, spanPeriod: 44, displacement: 22 },
    '15min': { conversionPeriod: 7,  basePeriod: 22, spanPeriod: 44, displacement: 22 },
    '30min': { conversionPeriod: 9,  basePeriod: 26, spanPeriod: 52, displacement: 26 },
    '1h':    { conversionPeriod: 9,  basePeriod: 26, spanPeriod: 52, displacement: 26 },
    '4h':    { conversionPeriod: 9,  basePeriod: 26, spanPeriod: 52, displacement: 26 },
  },
};

// --- Signal Weights ---
export const SIGNAL_WEIGHTS: Record<string, number> = {
  mta:        2.0,  // Multi-Timeframe Alignment
  ema:        1.5,  // EMA alignment
  adx:        1.5,  // ADX/DI trend strength
  rsi:        1.0,
  macd:       1.0,
  bollinger:  1.0,
  ichimoku:   1.0,
  pivots:     1.0,
  stochastic: 0.8,
  vwap:       0.8,
};

export const MAX_WEIGHTED_SCORE = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);

// --- Thresholds ---
export const SIGNAL_THRESHOLDS = {
  strong: 75,    // >= 75% → STRONG BUY/SELL
  moderate: 55,  // >= 55% → BUY/SELL
  neutral: 45,   // >= 45% → NEUTRAL (55% down to 45% is neutral zone)
};

// --- Schedule Configuration ---
export const SCHEDULE_CONFIG = {
  startHour: 8,    // 08:00 CET (default)
  endHour: 1,      // 01:00 CET (next day, default)
  intervalMinutes: 15, // Every 15 minutes
  timezone: 'Europe/Madrid',
};

// --- EMA Periods used in signal generation ---
export const EMA_FAST = 9;
export const EMA_MEDIUM = 21;
export const EMA_SLOW = 50;
export const EMA_TREND = 200;

// --- Minimum candles required per timeframe for reliable calculations ---
// After weekend filtering, we need at least 250 clean candles.
export const MIN_CANDLES: Record<Timeframe, number> = {
  '5min':  250,
  '15min': 250,
  '30min': 250,
  '1h':    250,
  '4h':    250,
};

// --- How many candles to REQUEST from TwelveData (pre-filter) ---
// 5min: 1500 raw → ~1000 after weekend filtering → keeps last 250 clean candles.
// Weekend filtering can remove ~30-35% of raw candles; 1500 gives a safe margin.
export const API_OUTPUT_SIZE: Record<Timeframe, number> = {
  '5min':  1500,
  '15min': 500,
  '30min': 400,
  '1h':    300,
  '4h':    300,
};
