// ============================================
// FinLab - Core TypeScript Types
// ============================================

// --- Timeframes ---
export type Timeframe = '5min' | '15min' | '30min' | '1h' | '4h';

export const TIMEFRAMES: Timeframe[] = ['5min', '15min', '30min', '1h', '4h'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '5min': '5M',
  '15min': '15M',
  '30min': '30M',
  '1h': '1H',
  '4h': '4H',
};

// --- OHLCV Data ---
export interface OHLCV {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// --- Symbol Configuration ---
export interface SymbolConfig {
  symbol: string;         // TwelveData symbol format e.g. "XAU/USD"
  displayName: string;    // Display name e.g. "XAUUSD"
  description: string;    // e.g. "Gold / US Dollar"
  pipValue: number;       // Value of one pip movement
  decimals: number;       // Price decimal places
  category: 'commodity' | 'forex' | 'index' | 'crypto';
}

// --- Signal Types ---
export type SignalDirection = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export type IndicatorSignal = 1 | 0 | -1; // 1=buy, 0=neutral, -1=sell

export interface IndicatorResult {
  name: string;
  value: number | string;
  signal: IndicatorSignal;
  details?: string;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  indicators: Record<string, IndicatorResult>;
  overallSignal: IndicatorSignal;
}

export interface SignalScore {
  raw: number;           // Raw weighted score
  normalized: number;    // 0-100 percentage
  direction: SignalDirection;
  confidence: string;    // 'STRONG' | 'MODERATE' | 'WEAK'
}

export interface TradeSetup {
  direction: SignalDirection;
  score: SignalScore;
  entryZone: { min: number; max: number };
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward1: number;
  riskReward2: number;
  atr: number;
}

// --- Dashboard Data ---
export interface MarketData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  lastUpdated: string;
  candles: Record<Timeframe, OHLCV[]>;
}

export interface AnalysisResult {
  symbol: string;
  timestamp: string;
  marketData: MarketData;
  timeframeAnalysis: Record<Timeframe, TimeframeAnalysis>;
  overallSignal: SignalScore;
  tradeSetup: TradeSetup;
  mtaAlignment: {
    trend4h: IndicatorSignal;
    confirmation1h: IndicatorSignal;
    signal15m: IndicatorSignal;
    entry5m: IndicatorSignal;
    aligned: boolean;
  };
  sessionInfo: SessionInfo;
  scalpingAnalysis: ScalpingAnalysis;
}

// --- Session Info ---
export interface SessionInfo {
  currentSession: 'asian' | 'london' | 'ny_overlap' | 'ny' | 'closed';
  sessionLabel: string;
  isOptimalScalping: boolean;
  nextUpdate: string;
  isMarketHours: boolean;
  isWeekend: boolean;
}

// --- Indicator Configuration ---
export interface IndicatorConfig {
  rsi: Record<Timeframe, { period: number; overbought: number; oversold: number }>;
  macd: Record<Timeframe, { fast: number; slow: number; signal: number }>;
  bollinger: Record<Timeframe, { period: number; stdDev: number }>;
  ema: { periods: number[] };
  stochastic: Record<Timeframe, { kPeriod: number; dPeriod: number; smooth: number }>;
  atr: { period: number };
  adx: { period: number };
  ichimoku: Record<Timeframe, { conversionPeriod: number; basePeriod: number; spanPeriod: number; displacement: number }>;
}

// --- Cache ---
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// --- API Responses ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  lastUpdated?: string;
}

// --- Pivot Points ---
export interface PivotPoints {
  pp: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

// --- Scalping Recommendations ---
export type RecommendationType = 'bounce_long' | 'bounce_short' | 'breakout_long' | 'breakout_short' | 'wait';
export type ZoneType = 'support' | 'resistance' | 'pivot' | 'ema' | 'bollinger' | 'ichimoku';
export type UrgencyLevel = 'alta' | 'media' | 'baja';

export interface InterestZone {
  price: number;
  type: ZoneType;
  label: string;
  strength: number; // 1-5
}

export interface ScalpingRecommendation {
  type: RecommendationType;
  direction: 'LONG' | 'SHORT' | 'ESPERAR';
  title: string;
  description: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  urgency: UrgencyLevel;
  confidence: number; // 0-100
  reasons: string[];
}

export interface ScalpingAnalysis {
  zones: InterestZone[];
  recommendations: ScalpingRecommendation[];
  marketBias: 'alcista' | 'bajista' | 'neutral';
  volatilityState: 'alta' | 'normal' | 'baja';
  bestSession: boolean; // true si estamos en sesión óptima para scalping
  summary: string;
}
