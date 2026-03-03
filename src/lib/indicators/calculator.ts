import {
  RSI, MACD, BollingerBands, EMA, Stochastic, ATR, ADX,
  IchimokuCloud, VWAP
} from 'technicalindicators';
import {
  OHLCV, Timeframe, IndicatorResult, IndicatorSignal,
  TimeframeAnalysis, PivotPoints,
} from '@/lib/types';
import { INDICATOR_CONFIG, EMA_FAST, EMA_MEDIUM, EMA_SLOW, EMA_TREND } from '@/lib/config/indicators';

// ============================================
// Indicator Calculation Engine
// ============================================

// --- Helper: Get arrays from OHLCV ---
function getCloses(candles: OHLCV[]): number[] {
  return candles.map(c => c.close);
}
function getHighs(candles: OHLCV[]): number[] {
  return candles.map(c => c.high);
}
function getLows(candles: OHLCV[]): number[] {
  return candles.map(c => c.low);
}
function getVolumes(candles: OHLCV[]): number[] {
  return candles.map(c => c.volume);
}

// ============================================
// 1. RSI
// ============================================
export function calculateRSI(candles: OHLCV[], timeframe: Timeframe): IndicatorResult {
  const config = INDICATOR_CONFIG.rsi[timeframe];
  const closes = getCloses(candles);

  const values = RSI.calculate({
    values: closes,
    period: config.period,
  });

  if (values.length === 0) {
    return { name: 'RSI', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : current;

  let signal: IndicatorSignal = 0;
  if (current <= config.oversold || (current > prev && current < 50 && prev <= config.oversold)) {
    signal = 1; // BUY: oversold or crossing up from oversold
  } else if (current >= config.overbought || (current < prev && current > 50 && prev >= config.overbought)) {
    signal = -1; // SELL: overbought or crossing down from overbought
  } else if (current > 50) {
    signal = 1; // Bullish momentum (above 50)
  } else if (current < 50) {
    signal = -1; // Bearish momentum (below 50)
  }

  return {
    name: 'RSI',
    value: Math.round(current * 100) / 100,
    signal,
    details: current >= config.overbought ? 'Sobrecompra' :
             current <= config.oversold ? 'Sobreventa' :
             current > 50 ? 'Alcista' : 'Bajista',
  };
}

// ============================================
// 2. MACD
// ============================================
export function calculateMACD(candles: OHLCV[], timeframe: Timeframe): IndicatorResult {
  const config = INDICATOR_CONFIG.macd[timeframe];
  const closes = getCloses(candles);

  const values = MACD.calculate({
    values: closes,
    fastPeriod: config.fast,
    slowPeriod: config.slow,
    signalPeriod: config.signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  if (values.length === 0) {
    return { name: 'MACD', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : current;

  const macdLine = current.MACD ?? 0;
  const signalLine = current.signal ?? 0;
  const histogram = current.histogram ?? 0;
  const prevHistogram = prev.histogram ?? 0;

  let signal: IndicatorSignal = 0;

  // MACD line crossing signal line
  if (macdLine > signalLine && histogram > 0) {
    signal = 1; // Bullish
  } else if (macdLine < signalLine && histogram < 0) {
    signal = -1; // Bearish
  }

  // Histogram direction change (early signal)
  if (histogram > prevHistogram && histogram > 0) {
    signal = 1; // Bullish momentum increasing
  } else if (histogram < prevHistogram && histogram < 0) {
    signal = -1; // Bearish momentum increasing
  }

  return {
    name: 'MACD',
    value: Math.round(histogram * 1000) / 1000,
    signal,
    details: histogram > 0 ? 'Alcista' : histogram < 0 ? 'Bajista' : 'Neutral',
  };
}

// ============================================
// 3. Bollinger Bands
// ============================================
export function calculateBollinger(candles: OHLCV[], timeframe: Timeframe): IndicatorResult {
  const config = INDICATOR_CONFIG.bollinger[timeframe];
  const closes = getCloses(candles);

  const values = BollingerBands.calculate({
    values: closes,
    period: config.period,
    stdDev: config.stdDev,
  });

  if (values.length === 0) {
    return { name: 'Bollinger', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const price = closes[closes.length - 1];

  const upper = current.upper;
  const middle = current.middle;
  const lower = current.lower;

  // Calculate %B
  const percentB = (price - lower) / (upper - lower);

  let signal: IndicatorSignal = 0;

  if (price <= lower || percentB <= 0.05) {
    signal = 1; // BUY: at or below lower band
  } else if (price >= upper || percentB >= 0.95) {
    signal = -1; // SELL: at or above upper band
  } else if (price > middle) {
    signal = 1; // Above middle = slight bullish
  } else if (price < middle) {
    signal = -1; // Below middle = slight bearish
  }

  return {
    name: 'Bollinger',
    value: Math.round(percentB * 100) / 100,
    signal,
    details: percentB >= 0.95 ? 'Banda Sup.' :
             percentB <= 0.05 ? 'Banda Inf.' :
             percentB > 0.5 ? 'Mitad Sup.' : 'Mitad Inf.',
  };
}

// ============================================
// 4. EMA (Multiple Periods)
// ============================================
export function calculateEMA(candles: OHLCV[]): IndicatorResult {
  const closes = getCloses(candles);
  const price = closes[closes.length - 1];

  const ema9 = EMA.calculate({ values: closes, period: EMA_FAST });
  const ema21 = EMA.calculate({ values: closes, period: EMA_MEDIUM });
  const ema50 = EMA.calculate({ values: closes, period: EMA_SLOW });
  const ema200 = EMA.calculate({ values: closes, period: EMA_TREND });

  const currentEma9 = ema9.length > 0 ? ema9[ema9.length - 1] : 0;
  const currentEma21 = ema21.length > 0 ? ema21[ema21.length - 1] : 0;
  const currentEma50 = ema50.length > 0 ? ema50[ema50.length - 1] : 0;
  const currentEma200 = ema200.length > 0 ? ema200[ema200.length - 1] : 0;

  // Signal based on EMA alignment
  let signal: IndicatorSignal = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  // EMA 9 > EMA 21 (short-term trend)
  if (currentEma9 > currentEma21) bullishCount++;
  else bearishCount++;

  // EMA 21 > EMA 50 (medium-term trend)
  if (currentEma21 > currentEma50) bullishCount++;
  else bearishCount++;

  // Price above EMA 50 (trend)
  if (price > currentEma50) bullishCount++;
  else bearishCount++;

  // Price above EMA 200 (major trend)
  if (currentEma200 > 0) {
    if (price > currentEma200) bullishCount++;
    else bearishCount++;
  }

  if (bullishCount >= 3) signal = 1;
  else if (bearishCount >= 3) signal = -1;

  return {
    name: 'EMA',
    value: `${Math.round(currentEma9 * 100) / 100}`,
    signal,
    details: signal === 1 ? 'Alineación Alcista' :
             signal === -1 ? 'Alineación Bajista' : 'Mixto',
  };
}

// ============================================
// 5. Stochastic
// ============================================
export function calculateStochastic(candles: OHLCV[], timeframe: Timeframe): IndicatorResult {
  const config = INDICATOR_CONFIG.stochastic[timeframe];
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const closes = getCloses(candles);

  const values = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: config.kPeriod,
    signalPeriod: config.dPeriod,
  });

  if (values.length === 0) {
    return { name: 'Estocástico', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const k = current.k;
  const d = current.d;

  let signal: IndicatorSignal = 0;

  if (k <= 20 && k > d) {
    signal = 1; // BUY: K crossing above D in oversold
  } else if (k >= 80 && k < d) {
    signal = -1; // SELL: K crossing below D in overbought
  } else if (k > d && k < 80) {
    signal = 1; // Bullish
  } else if (k < d && k > 20) {
    signal = -1; // Bearish
  }

  return {
    name: 'Stochastic',
    value: Math.round(k * 100) / 100,
    signal,
    details: k >= 80 ? 'Sobrecompra' :
             k <= 20 ? 'Sobreventa' :
             k > d ? 'Alcista' : 'Bajista',
  };
}

// ============================================
// 6. ATR
// ============================================
export function calculateATR(candles: OHLCV[]): IndicatorResult {
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const closes = getCloses(candles);

  const values = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: INDICATOR_CONFIG.atr.period,
  });

  if (values.length === 0) {
    return { name: 'ATR', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const prev = values.length > 5 ? values[values.length - 6] : current;

  // ATR is not directional but indicates volatility
  // Increasing ATR = increasing volatility
  let signal: IndicatorSignal = 0; // ATR doesn't give buy/sell, it's informational

  return {
    name: 'ATR',
    value: Math.round(current * 100) / 100,
    signal,
    details: current > prev * 1.2 ? 'Alta Volatilidad' :
             current < prev * 0.8 ? 'Baja Volatilidad' : 'Normal',
  };
}

// ============================================
// 7. ADX / DI
// ============================================
export function calculateADX(candles: OHLCV[]): IndicatorResult {
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const closes = getCloses(candles);

  const values = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: INDICATOR_CONFIG.adx.period,
  });

  if (values.length === 0) {
    return { name: 'ADX', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const adxValue = current.adx;
  const pdi = current.pdi; // +DI
  const mdi = current.mdi; // -DI

  let signal: IndicatorSignal = 0;

  if (adxValue >= 25) {
    // Trending market
    if (pdi > mdi) signal = 1;  // Bullish trend
    else signal = -1;            // Bearish trend
  }
  // If ADX < 25, market is ranging → signal stays neutral

  return {
    name: 'ADX',
    value: Math.round(adxValue * 100) / 100,
    signal,
    details: adxValue >= 40 ? 'Tendencia Fuerte' :
             adxValue >= 25 ? 'Tendencia' : 'Rango',
  };
}

// ============================================
// 8. Ichimoku Cloud
// ============================================
export function calculateIchimoku(candles: OHLCV[], timeframe: Timeframe): IndicatorResult {
  const config = INDICATOR_CONFIG.ichimoku[timeframe];
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const closes = getCloses(candles);

  const values = IchimokuCloud.calculate({
    high: highs,
    low: lows,
    conversionPeriod: config.conversionPeriod,
    basePeriod: config.basePeriod,
    spanPeriod: config.spanPeriod,
    displacement: config.displacement,
  });

  if (values.length === 0) {
    return { name: 'Ichimoku', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const current = values[values.length - 1];
  const price = closes[closes.length - 1];

  const tenkan = current.conversion;
  const kijun = current.base;
  const spanA = current.spanA;
  const spanB = current.spanB;

  let signal: IndicatorSignal = 0;
  let bullish = 0;
  let bearish = 0;

  // Price vs Cloud
  const cloudTop = Math.max(spanA, spanB);
  const cloudBottom = Math.min(spanA, spanB);

  if (price > cloudTop) bullish += 2;
  else if (price < cloudBottom) bearish += 2;

  // Tenkan vs Kijun
  if (tenkan > kijun) bullish++;
  else if (tenkan < kijun) bearish++;

  // Cloud color (future cloud)
  if (spanA > spanB) bullish++;
  else bearish++;

  if (bullish > bearish) signal = 1;
  else if (bearish > bullish) signal = -1;

  return {
    name: 'Ichimoku',
    value: price > cloudTop ? 'Encima' : price < cloudBottom ? 'Debajo' : 'En Nube',
    signal,
    details: signal === 1 ? 'Alcista' :
             signal === -1 ? 'Bajista' : 'Neutral',
  };
}

// ============================================
// 9. Pivot Points (Classic)
// ============================================
export function calculatePivots(candles: OHLCV[]): { result: IndicatorResult; pivots: PivotPoints } {
  // Use the previous day's data for daily pivots
  // We approximate by using the last 24+ candles for 1h, or appropriate for the TF
  if (candles.length < 2) {
    return {
      result: { name: 'Pivotes', value: 0, signal: 0, details: 'Datos insuficientes' },
      pivots: { pp: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 },
    };
  }

  // Find the high, low, close from the previous "session" (last ~24 candles or available)
  const lookback = Math.min(candles.length - 1, 100);
  const sessionCandles = candles.slice(-lookback - 1, -1);

  const high = Math.max(...sessionCandles.map(c => c.high));
  const low = Math.min(...sessionCandles.map(c => c.low));
  const close = sessionCandles[sessionCandles.length - 1].close;

  // Classic Pivot Points
  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const r2 = pp + (high - low);
  const r3 = high + 2 * (pp - low);
  const s1 = 2 * pp - high;
  const s2 = pp - (high - low);
  const s3 = low - 2 * (high - pp);

  const currentPrice = candles[candles.length - 1].close;

  let signal: IndicatorSignal = 0;

  // Price position relative to pivot
  if (currentPrice > pp) {
    if (currentPrice > r1) signal = 1; // Strong bullish, above R1
    else signal = 1; // Above PP = bullish bias
  } else {
    if (currentPrice < s1) signal = -1; // Strong bearish, below S1
    else signal = -1; // Below PP = bearish bias
  }

  // Check if near S/R levels (potential bounce)
  const tolerance = (high - low) * 0.02;
  let details = currentPrice > pp ? 'Sobre PP' : 'Bajo PP';
  if (Math.abs(currentPrice - r1) < tolerance) details = 'Cerca R1';
  if (Math.abs(currentPrice - r2) < tolerance) details = 'Cerca R2';
  if (Math.abs(currentPrice - s1) < tolerance) details = 'Cerca S1';
  if (Math.abs(currentPrice - s2) < tolerance) details = 'Cerca S2';

  return {
    result: {
      name: 'Pivotes',
      value: Math.round(pp * 100) / 100,
      signal,
      details,
    },
    pivots: {
      pp: Math.round(pp * 100) / 100,
      r1: Math.round(r1 * 100) / 100,
      r2: Math.round(r2 * 100) / 100,
      r3: Math.round(r3 * 100) / 100,
      s1: Math.round(s1 * 100) / 100,
      s2: Math.round(s2 * 100) / 100,
      s3: Math.round(s3 * 100) / 100,
    },
  };
}

// ============================================
// 10. VWAP
// ============================================
export function calculateVWAP(candles: OHLCV[]): IndicatorResult {
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const closes = getCloses(candles);
  const volumes = getVolumes(candles);

  // Check if we have meaningful volume data
  const hasVolume = volumes.some(v => v > 0);

  if (!hasVolume || candles.length < 10) {
    // Fallback: calculate a simple typical price average
    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const avg = typicalPrices.reduce((a, b) => a + b, 0) / typicalPrices.length;
    const price = closes[closes.length - 1];

    return {
      name: 'VWAP',
      value: Math.round(avg * 100) / 100,
      signal: price > avg ? 1 : price < avg ? -1 : 0,
      details: price > avg ? 'Sobre VWAP' : 'Bajo VWAP',
    };
  }

  const values = VWAP.calculate({
    high: highs,
    low: lows,
    close: closes,
    volume: volumes,
  });

  if (values.length === 0) {
    return { name: 'VWAP', value: 0, signal: 0, details: 'Datos insuficientes' };
  }

  const currentVWAP = values[values.length - 1];
  const price = closes[closes.length - 1];

  let signal: IndicatorSignal = 0;
  if (price > currentVWAP) signal = 1;
  else if (price < currentVWAP) signal = -1;

  return {
    name: 'VWAP',
    value: Math.round(currentVWAP * 100) / 100,
    signal,
    details: price > currentVWAP ? 'Sobre VWAP' : 'Bajo VWAP',
  };
}

// ============================================
// Calculate ALL indicators for a timeframe
// ============================================
export function calculateAllIndicators(
  candles: OHLCV[],
  timeframe: Timeframe
): TimeframeAnalysis {
  const indicators: Record<string, IndicatorResult> = {};

  console.log(`[Calculator] ${timeframe}: ${candles.length} candles received`);

  if (candles.length < 50) {
    // Not enough data for reliable calculations
    console.warn(`[Calculator] ${timeframe}: SKIPPED — only ${candles.length} candles (need ≥50)`);
    return {
      timeframe,
      indicators: {},
      overallSignal: 0,
    };
  }

  indicators.rsi = calculateRSI(candles, timeframe);
  indicators.macd = calculateMACD(candles, timeframe);
  indicators.bollinger = calculateBollinger(candles, timeframe);
  indicators.ema = calculateEMA(candles);
  indicators.stochastic = calculateStochastic(candles, timeframe);
  indicators.atr = calculateATR(candles);
  indicators.adx = calculateADX(candles);
  indicators.ichimoku = calculateIchimoku(candles, timeframe);
  indicators.pivots = calculatePivots(candles).result;
  indicators.vwap = calculateVWAP(candles);

  // Calculate overall signal for this timeframe
  const signals = Object.values(indicators)
    .filter(i => i.name !== 'ATR') // ATR is informational, not directional
    .map(i => i.signal);

  const buyCount = signals.filter(s => s === 1).length;
  const sellCount = signals.filter(s => s === -1).length;

  let overallSignal: IndicatorSignal = 0;
  if (buyCount > sellCount + 2) overallSignal = 1;
  else if (sellCount > buyCount + 2) overallSignal = -1;
  else if (buyCount > sellCount) overallSignal = 1;
  else if (sellCount > buyCount) overallSignal = -1;

  console.log(`[Calculator] ${timeframe}: OK — ${Object.keys(indicators).length} indicators, signal=${overallSignal} (buy=${buyCount} sell=${sellCount})`);

  return {
    timeframe,
    indicators,
    overallSignal,
  };
}

// --- Export ATR value for trade setup ---
export function getATRValue(candles: OHLCV[]): number {
  const result = calculateATR(candles);
  return typeof result.value === 'number' ? result.value : 0;
}

// --- Export Pivot Points for trade setup ---
export function getPivotPoints(candles: OHLCV[]): PivotPoints {
  return calculatePivots(candles).pivots;
}
