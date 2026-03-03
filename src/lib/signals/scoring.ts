import {
  Timeframe, TimeframeAnalysis, SignalScore, SignalDirection,
  TradeSetup, IndicatorSignal, OHLCV, AnalysisResult,
  MarketData, SessionInfo, ScalpingAnalysis, InterestZone,
  ScalpingRecommendation,
} from '@/lib/types';
import { SIGNAL_WEIGHTS, MAX_WEIGHTED_SCORE, SIGNAL_THRESHOLDS, SCHEDULE_CONFIG } from '@/lib/config/indicators';
import { calculateAllIndicators, getATRValue, getPivotPoints } from '@/lib/indicators/calculator';
import { fetchAllTimeframes, getCurrentPrice, getLastCacheTimestamp } from '@/lib/api/twelvedata';
import { getSymbolConfig } from '@/lib/config/symbols';

// ============================================
// Multi-Timeframe Analysis (MTA)
// ============================================

function getMTAAlignment(analyses: Record<Timeframe, TimeframeAnalysis>): {
  trend4h: IndicatorSignal;
  confirmation1h: IndicatorSignal;
  signal15m: IndicatorSignal;
  entry5m: IndicatorSignal;
  aligned: boolean;
} {
  const trend4h = analyses['4h']?.overallSignal ?? 0;
  const confirmation1h = analyses['1h']?.overallSignal ?? 0;
  const signal15m = analyses['15min']?.overallSignal ?? 0;
  const entry5m = analyses['5min']?.overallSignal ?? 0;

  // Aligned means all non-zero signals point in the same direction
  const nonZero = [trend4h, confirmation1h, signal15m, entry5m].filter(s => s !== 0);
  const allBullish = nonZero.every(s => s === 1);
  const allBearish = nonZero.every(s => s === -1);
  const aligned = nonZero.length >= 3 && (allBullish || allBearish);

  return { trend4h, confirmation1h, signal15m, entry5m, aligned };
}

// ============================================
// Weighted Signal Scoring
// ============================================

function calculateWeightedScore(
  analyses: Record<Timeframe, TimeframeAnalysis>,
  mta: { aligned: boolean; trend4h: IndicatorSignal }
): SignalScore {
  let weightedSum = 0;

  // Use the 15min timeframe as the primary signal timeframe for scalping
  const primary = analyses['15min'];
  if (!primary || !primary.indicators) {
    return {
      raw: 0,
      normalized: 50,
      direction: 'NEUTRAL',
      confidence: 'WEAK',
    };
  }

  const indicators = primary.indicators;

  // Score each indicator
  for (const [key, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    if (key === 'mta') {
      // MTA signal based on alignment
      if (mta.aligned) {
        weightedSum += weight * mta.trend4h; // Direction of the trend
      }
      continue;
    }

    const indicator = indicators[key];
    if (indicator && indicator.signal !== 0) {
      weightedSum += weight * indicator.signal;
    }
  }

  // Normalize to 0-100 scale
  // weightedSum ranges from -MAX_WEIGHTED_SCORE to +MAX_WEIGHTED_SCORE
  const normalized = Math.round(((weightedSum + MAX_WEIGHTED_SCORE) / (2 * MAX_WEIGHTED_SCORE)) * 100);

  // Determine direction
  let direction: SignalDirection;
  if (normalized >= SIGNAL_THRESHOLDS.strong) {
    direction = 'STRONG_BUY';
  } else if (normalized >= SIGNAL_THRESHOLDS.moderate) {
    direction = 'BUY';
  } else if (normalized <= (100 - SIGNAL_THRESHOLDS.strong)) {
    direction = 'STRONG_SELL';
  } else if (normalized <= (100 - SIGNAL_THRESHOLDS.moderate)) {
    direction = 'SELL';
  } else {
    direction = 'NEUTRAL';
  }

  // Determine confidence
  let confidence: string;
  if (normalized >= SIGNAL_THRESHOLDS.strong || normalized <= (100 - SIGNAL_THRESHOLDS.strong)) {
    confidence = 'STRONG';
  } else if (normalized >= SIGNAL_THRESHOLDS.moderate || normalized <= (100 - SIGNAL_THRESHOLDS.moderate)) {
    confidence = 'MODERATE';
  } else {
    confidence = 'WEAK';
  }

  return {
    raw: Math.round(weightedSum * 100) / 100,
    normalized,
    direction,
    confidence,
  };
}

// ============================================
// Trade Setup Generation
// ============================================

function generateTradeSetup(
  score: SignalScore,
  candles: Record<Timeframe, OHLCV[]>,
  currentPrice: number
): TradeSetup {
  const atr5m = candles['5min']?.length > 0 ? getATRValue(candles['5min']) : 2;
  const atr15m = candles['15min']?.length > 0 ? getATRValue(candles['15min']) : 5;
  const pivots = candles['1h']?.length > 0 ? getPivotPoints(candles['1h']) : null;

  const atr = atr15m > 0 ? atr15m : atr5m;

  let entryMin: number, entryMax: number, stopLoss: number, tp1: number, tp2: number;

  if (score.direction === 'STRONG_BUY' || score.direction === 'BUY') {
    entryMin = currentPrice - atr * 0.2;
    entryMax = currentPrice + atr * 0.1;
    stopLoss = currentPrice - atr * 1.5;
    tp1 = pivots && pivots.r1 > currentPrice ? pivots.r1 : currentPrice + atr * 1.5;
    tp2 = pivots && pivots.r2 > currentPrice ? pivots.r2 : currentPrice + atr * 2.5;
  } else if (score.direction === 'STRONG_SELL' || score.direction === 'SELL') {
    entryMin = currentPrice - atr * 0.1;
    entryMax = currentPrice + atr * 0.2;
    stopLoss = currentPrice + atr * 1.5;
    tp1 = pivots && pivots.s1 < currentPrice ? pivots.s1 : currentPrice - atr * 1.5;
    tp2 = pivots && pivots.s2 < currentPrice ? pivots.s2 : currentPrice - atr * 2.5;
  } else {
    entryMin = currentPrice;
    entryMax = currentPrice;
    stopLoss = currentPrice;
    tp1 = currentPrice;
    tp2 = currentPrice;
  }

  const riskDistance = Math.abs(currentPrice - stopLoss);
  const rr1 = riskDistance > 0 ? Math.round((Math.abs(tp1 - currentPrice) / riskDistance) * 10) / 10 : 0;
  const rr2 = riskDistance > 0 ? Math.round((Math.abs(tp2 - currentPrice) / riskDistance) * 10) / 10 : 0;

  return {
    direction: score.direction,
    score,
    entryZone: {
      min: Math.round(entryMin * 100) / 100,
      max: Math.round(entryMax * 100) / 100,
    },
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit1: Math.round(tp1 * 100) / 100,
    takeProfit2: Math.round(tp2 * 100) / 100,
    riskReward1: rr1,
    riskReward2: rr2,
    atr: Math.round(atr * 100) / 100,
  };
}

// ============================================
// Session Info - Horarios Forex Reales
// ============================================

/**
 * Mercado Forex: Abre Domingo 23:00 CET → Cierra Viernes 23:00 CET
 * Sesiones en hora española (CET/CEST):
 *   - Asiática:       01:00 - 08:00
 *   - Londres:        08:00 - 14:30 (apertura 08:00-09:00 es óptima)
 *   - Solapamiento:   14:30 - 17:30 (Londres+NY, óptimo para scalping)
 *   - Nueva York:     14:30 - 22:00
 *   - Cerrado:        22:00 - 01:00 (entre sesiones) / Fin de semana
 *
 * DST: En verano (CEST, UTC+2) las sesiones se adelantan ~1h respecto a UTC.
 * Usamos `Europe/Madrid` para la conversión automática.
 */
export function getSessionInfo(): SessionInfo {
  const now = new Date();

  // Obtener componentes en hora de Madrid
  const madridFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_CONFIG.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = madridFormatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const weekday = get('weekday'); // Mon, Tue, ..., Sun
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const timeDecimal = hour + minute / 60; // e.g. 14.5 = 14:30

  // --- Detección de fin de semana ---
  // Forex cierra Viernes ~23:00 CET y abre Domingo ~23:00 CET
  let isWeekend = false;
  if (weekday === 'Sat') {
    isWeekend = true;
  } else if (weekday === 'Sun' && hour < 23) {
    isWeekend = true;
  } else if (weekday === 'Fri' && hour >= 23) {
    isWeekend = true;
  }

  // --- Determinar sesión actual ---
  let currentSession: SessionInfo['currentSession'];
  let sessionLabel: string;
  let isOptimalScalping = false;
  let isMarketHours = false;

  if (isWeekend) {
    currentSession = 'closed';
    sessionLabel = 'Fin de Semana';
    isMarketHours = false;
  } else if (timeDecimal >= 1 && timeDecimal < 8) {
    currentSession = 'asian';
    sessionLabel = 'Sesión Asiática';
    isMarketHours = true;
  } else if (timeDecimal >= 8 && timeDecimal < 9) {
    currentSession = 'london';
    sessionLabel = 'Apertura Londres';
    isOptimalScalping = true;
    isMarketHours = true;
  } else if (timeDecimal >= 9 && timeDecimal < 14.5) {
    currentSession = 'london';
    sessionLabel = 'Sesión Londres';
    isOptimalScalping = timeDecimal >= 9 && timeDecimal < 11;
    isMarketHours = true;
  } else if (timeDecimal >= 14.5 && timeDecimal < 17.5) {
    currentSession = 'ny_overlap';
    sessionLabel = 'Solapamiento Londres/NY';
    isOptimalScalping = true;
    isMarketHours = true;
  } else if (timeDecimal >= 17.5 && timeDecimal < 22) {
    currentSession = 'ny';
    sessionLabel = 'Sesión Nueva York';
    isMarketHours = true;
  } else {
    // 22:00 - 01:00 o 23:00+ domingo
    currentSession = 'closed';
    sessionLabel = 'Entre Sesiones';
    // Domingo >=23:00 cuenta como mercado abierto (recién abre)
    if (weekday === 'Sun' && hour >= 23) {
      sessionLabel = 'Apertura Semanal';
      isMarketHours = true;
    } else if (hour >= 22 || hour < 1) {
      isMarketHours = false;
    }
  }

  // --- Calcular próxima actualización (según intervalo configurado) ---
  const madridTime = new Date(now.toLocaleString('en-US', { timeZone: SCHEDULE_CONFIG.timezone }));
  const currentMinutes = madridTime.getMinutes();
  const interval = SCHEDULE_CONFIG.intervalMinutes;
  const minutesInSlot = currentMinutes % interval;
  const minutesUntilNext = minutesInSlot === 0 ? interval : (interval - minutesInSlot);

  const nextUpdate = new Date(madridTime);
  nextUpdate.setMinutes(nextUpdate.getMinutes() + minutesUntilNext, 0, 0);

  return {
    currentSession,
    sessionLabel,
    isOptimalScalping,
    nextUpdate: nextUpdate.toISOString(),
    isMarketHours,
    isWeekend,
  };
}

// ============================================
// Scalping Recommendations Engine
// ============================================

function generateScalpingAnalysis(
  candles: Record<Timeframe, OHLCV[]>,
  timeframeAnalysis: Record<Timeframe, TimeframeAnalysis>,
  currentPrice: number,
  score: SignalScore,
  sessionInfo: SessionInfo
): ScalpingAnalysis {
  const zones: InterestZone[] = [];
  const recommendations: ScalpingRecommendation[] = [];

  // --- 1. Identificar zonas de interés ---

  // Pivotes desde 1H
  const pivots1h = candles['1h']?.length > 0 ? getPivotPoints(candles['1h']) : null;
  if (pivots1h && pivots1h.pp > 0) {
    zones.push({ price: pivots1h.pp, type: 'pivot', label: 'Pivote Central', strength: 4 });
    zones.push({ price: pivots1h.r1, type: 'resistance', label: 'R1', strength: 3 });
    zones.push({ price: pivots1h.r2, type: 'resistance', label: 'R2', strength: 4 });
    zones.push({ price: pivots1h.s1, type: 'support', label: 'S1', strength: 3 });
    zones.push({ price: pivots1h.s2, type: 'support', label: 'S2', strength: 4 });
  }

  // EMAs como zonas dinámicas desde 15M
  const ema15m = timeframeAnalysis['15min']?.indicators?.ema;
  if (ema15m && typeof ema15m.value === 'string') {
    const emaVal = parseFloat(ema15m.value);
    if (emaVal > 0) {
      zones.push({ price: emaVal, type: 'ema', label: 'EMA 9 (15M)', strength: 2 });
    }
  }

  // Bollinger Bands desde 15M
  const boll15m = timeframeAnalysis['15min']?.indicators?.bollinger;
  if (boll15m && typeof boll15m.value === 'number') {
    const percentB = boll15m.value;
    // Estimar bandas superior/inferior basándose en %B y precio actual
    if (percentB > 0 && percentB < 1) {
      const bandwidth = currentPrice * 0.005; // aprox
      const lower = currentPrice - (percentB * bandwidth * 2);
      const upper = lower + bandwidth * 2;
      zones.push({ price: Math.round(upper * 100) / 100, type: 'bollinger', label: 'Banda Sup. Boll.', strength: 3 });
      zones.push({ price: Math.round(lower * 100) / 100, type: 'bollinger', label: 'Banda Inf. Boll.', strength: 3 });
    }
  }

  // ATR para calcular distancias
  const atr15m = candles['15min']?.length > 0 ? getATRValue(candles['15min']) : 5;
  const atr5m = candles['5min']?.length > 0 ? getATRValue(candles['5min']) : 2;
  const atr = atr15m > 0 ? atr15m : atr5m;

  // --- 2. Ordenar zonas por cercanía al precio ---
  zones.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  // --- 3. Detectar zonas de rebote cercanas ---
  const nearZones = zones.filter(z => Math.abs(z.price - currentPrice) < atr * 2);

  // Soportes cercanos por debajo
  const nearSupports = nearZones
    .filter(z => z.price < currentPrice && (z.type === 'support' || z.type === 'pivot'))
    .sort((a, b) => b.price - a.price);

  // Resistencias cercanas por encima
  const nearResistances = nearZones
    .filter(z => z.price > currentPrice && (z.type === 'resistance' || z.type === 'pivot'))
    .sort((a, b) => a.price - b.price);

  // --- 4. Indicadores clave para decisiones ---
  const rsi15m = timeframeAnalysis['15min']?.indicators?.rsi;
  const rsi5m = timeframeAnalysis['5min']?.indicators?.rsi;
  const stoch15m = timeframeAnalysis['15min']?.indicators?.stochastic;
  const adx15m = timeframeAnalysis['15min']?.indicators?.adx;
  const macd5m = timeframeAnalysis['5min']?.indicators?.macd;

  const rsiValue = typeof rsi15m?.value === 'number' ? rsi15m.value : 50;
  const rsi5mValue = typeof rsi5m?.value === 'number' ? rsi5m.value : 50;
  const stochValue = typeof stoch15m?.value === 'number' ? stoch15m.value : 50;
  const adxValue = typeof adx15m?.value === 'number' ? adx15m.value : 20;
  const isTrending = adxValue >= 25;

  // --- 5. Generar recomendaciones ---

  // Recomendación de rebote en soporte (LONG)
  if (nearSupports.length > 0 && rsiValue < 45) {
    const support = nearSupports[0];
    const distToSupport = currentPrice - support.price;
    const isNearSupport = distToSupport < atr * 0.8;

    if (isNearSupport || rsiValue < 35) {
      const reasons: string[] = [];
      const entry = support.price + atr * 0.1;
      const sl = support.price - atr * 0.8;
      const tp = currentPrice + atr * 1.2;
      const rr = Math.abs(tp - entry) / Math.abs(entry - sl);

      reasons.push(`Precio cerca de ${support.label} (${support.price.toFixed(2)})`);
      if (rsiValue < 35) reasons.push(`RSI 15M en sobreventa (${rsiValue.toFixed(1)})`);
      if (stochValue < 25) reasons.push(`Estocástico en sobreventa (${stochValue.toFixed(1)})`);
      if (rsi5mValue < 30) reasons.push(`RSI 5M en sobreventa (${rsi5mValue.toFixed(1)})`);
      if (macd5m?.signal === 1) reasons.push('MACD 5M alcista');

      let confidence = 40;
      if (rsiValue < 30) confidence += 15;
      if (stochValue < 20) confidence += 10;
      if (macd5m?.signal === 1) confidence += 10;
      if (support.strength >= 4) confidence += 10;
      if (score.direction === 'BUY' || score.direction === 'STRONG_BUY') confidence += 15;

      recommendations.push({
        type: 'bounce_long',
        direction: 'LONG',
        title: `Rebote Alcista en ${support.label}`,
        description: `El precio se acerca al soporte ${support.label}. Buscar entrada larga en zona de rebote con confirmación de indicadores.`,
        entry: Math.round(entry * 100) / 100,
        stopLoss: Math.round(sl * 100) / 100,
        takeProfit: Math.round(tp * 100) / 100,
        riskReward: Math.round(rr * 10) / 10,
        urgency: distToSupport < atr * 0.3 ? 'alta' : 'media',
        confidence: Math.min(confidence, 95),
        reasons,
      });
    }
  }

  // Recomendación de rebote en resistencia (SHORT)
  if (nearResistances.length > 0 && rsiValue > 55) {
    const resistance = nearResistances[0];
    const distToResistance = resistance.price - currentPrice;
    const isNearResistance = distToResistance < atr * 0.8;

    if (isNearResistance || rsiValue > 65) {
      const reasons: string[] = [];
      const entry = resistance.price - atr * 0.1;
      const sl = resistance.price + atr * 0.8;
      const tp = currentPrice - atr * 1.2;
      const rr = Math.abs(entry - tp) / Math.abs(sl - entry);

      reasons.push(`Precio cerca de ${resistance.label} (${resistance.price.toFixed(2)})`);
      if (rsiValue > 65) reasons.push(`RSI 15M en sobrecompra (${rsiValue.toFixed(1)})`);
      if (stochValue > 75) reasons.push(`Estocástico en sobrecompra (${stochValue.toFixed(1)})`);
      if (rsi5mValue > 70) reasons.push(`RSI 5M en sobrecompra (${rsi5mValue.toFixed(1)})`);
      if (macd5m?.signal === -1) reasons.push('MACD 5M bajista');

      let confidence = 40;
      if (rsiValue > 70) confidence += 15;
      if (stochValue > 80) confidence += 10;
      if (macd5m?.signal === -1) confidence += 10;
      if (resistance.strength >= 4) confidence += 10;
      if (score.direction === 'SELL' || score.direction === 'STRONG_SELL') confidence += 15;

      recommendations.push({
        type: 'bounce_short',
        direction: 'SHORT',
        title: `Rebote Bajista en ${resistance.label}`,
        description: `El precio se acerca a la resistencia ${resistance.label}. Buscar entrada corta en zona de rebote.`,
        entry: Math.round(entry * 100) / 100,
        stopLoss: Math.round(sl * 100) / 100,
        takeProfit: Math.round(tp * 100) / 100,
        riskReward: Math.round(rr * 10) / 10,
        urgency: distToResistance < atr * 0.3 ? 'alta' : 'media',
        confidence: Math.min(confidence, 95),
        reasons,
      });
    }
  }

  // Recomendación de ruptura (breakout) si hay tendencia fuerte
  if (isTrending && (score.direction === 'STRONG_BUY' || score.direction === 'STRONG_SELL')) {
    const isBullBreak = score.direction === 'STRONG_BUY';
    const reasons: string[] = [];

    reasons.push(`ADX fuerte: ${adxValue.toFixed(1)} (tendencia confirmada)`);
    reasons.push(`Señal general: ${isBullBreak ? 'COMPRA FUERTE' : 'VENTA FUERTE'}`);
    if (isBullBreak && rsiValue > 55) reasons.push(`RSI con momentum alcista (${rsiValue.toFixed(1)})`);
    if (!isBullBreak && rsiValue < 45) reasons.push(`RSI con momentum bajista (${rsiValue.toFixed(1)})`);

    const entry = currentPrice;
    const sl = isBullBreak ? currentPrice - atr * 1.2 : currentPrice + atr * 1.2;
    const tp = isBullBreak ? currentPrice + atr * 2.0 : currentPrice - atr * 2.0;
    const rr = Math.abs(tp - entry) / Math.abs(entry - sl);

    recommendations.push({
      type: isBullBreak ? 'breakout_long' : 'breakout_short',
      direction: isBullBreak ? 'LONG' : 'SHORT',
      title: isBullBreak ? 'Ruptura Alcista - Seguir Tendencia' : 'Ruptura Bajista - Seguir Tendencia',
      description: isBullBreak
        ? 'Tendencia alcista fuerte confirmada. Buscar entrada en pullback o continuación.'
        : 'Tendencia bajista fuerte confirmada. Buscar entrada en retroceso o continuación.',
      entry: Math.round(entry * 100) / 100,
      stopLoss: Math.round(sl * 100) / 100,
      takeProfit: Math.round(tp * 100) / 100,
      riskReward: Math.round(rr * 10) / 10,
      urgency: 'alta',
      confidence: Math.min(60 + (adxValue - 25) * 2, 90),
      reasons,
    });
  }

  // Si no hay recomendaciones claras → ESPERAR
  if (recommendations.length === 0) {
    const reasons: string[] = [];
    if (!isTrending) reasons.push(`ADX bajo (${adxValue.toFixed(1)}) - mercado en rango`);
    if (rsiValue > 40 && rsiValue < 60) reasons.push('RSI neutral - sin extremos');
    if (nearSupports.length === 0 && nearResistances.length === 0) reasons.push('Sin niveles clave cercanos');
    if (score.direction === 'NEUTRAL') reasons.push('Señales contradictorias');

    recommendations.push({
      type: 'wait',
      direction: 'ESPERAR',
      title: 'Sin Señal Clara - Esperar',
      description: 'No hay configuración de scalping favorable en este momento. Esperar a que se formen condiciones más claras.',
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      riskReward: 0,
      urgency: 'baja',
      confidence: 0,
      reasons,
    });
  }

  // Ordenar por confianza
  recommendations.sort((a, b) => b.confidence - a.confidence);

  // --- 6. Determinar sesgo del mercado ---
  const bias = score.normalized >= 60 ? 'alcista' as const
    : score.normalized <= 40 ? 'bajista' as const
    : 'neutral' as const;

  // --- 7. Estado de volatilidad ---
  const atrResult = timeframeAnalysis['15min']?.indicators?.atr;
  const volState = atrResult?.details === 'Alta Volatilidad' ? 'alta' as const
    : atrResult?.details === 'Baja Volatilidad' ? 'baja' as const
    : 'normal' as const;

  // --- 8. Resumen ---
  const topRec = recommendations[0];
  let summary: string;
  if (topRec.type === 'wait') {
    summary = 'Sin oportunidades claras de scalping. Paciencia.';
  } else {
    summary = `${topRec.title} | Confianza: ${topRec.confidence}% | R:R ${topRec.riskReward}:1`;
  }

  return {
    zones: zones.slice(0, 10), // Top 10 zonas más relevantes
    recommendations,
    marketBias: bias,
    volatilityState: volState,
    bestSession: sessionInfo.isOptimalScalping,
    summary,
  };
}

// ============================================
// Full Analysis Pipeline
// ============================================

export async function runFullAnalysis(
  symbolKey: string,
  forceRefresh = false
): Promise<AnalysisResult> {
  const config = getSymbolConfig(symbolKey);

  // 1. Fetch all timeframe data
  const candles = await fetchAllTimeframes(config.symbol, forceRefresh);

  // 2. Calculate indicators for each timeframe
  const timeframeAnalysis: Record<Timeframe, TimeframeAnalysis> = {
    '5min': calculateAllIndicators(candles['5min'] || [], '5min'),
    '15min': calculateAllIndicators(candles['15min'] || [], '15min'),
    '30min': calculateAllIndicators(candles['30min'] || [], '30min'),
    '1h': calculateAllIndicators(candles['1h'] || [], '1h'),
    '4h': calculateAllIndicators(candles['4h'] || [], '4h'),
  };

  // 3. Multi-Timeframe Analysis
  const mtaAlignment = getMTAAlignment(timeframeAnalysis);

  // 4. Calculate weighted score
  const overallSignal = calculateWeightedScore(timeframeAnalysis, mtaAlignment);

  // 5. Get current price
  const currentPrice = getCurrentPrice(candles);

  // 6. Generate trade setup
  const tradeSetup = generateTradeSetup(overallSignal, candles, currentPrice);

  // 7. Build market data
  const fiveMinCandles = candles['5min'] || [];
  const hourCandles = candles['1h'] || [];

  const previousClose = hourCandles.length > 1 ? hourCandles[hourCandles.length - 2].close : currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  // Find 24h high/low from 1h candles
  const last24h = hourCandles.slice(-24);
  const high24h = last24h.length > 0 ? Math.max(...last24h.map(c => c.high)) : currentPrice;
  const low24h = last24h.length > 0 ? Math.min(...last24h.map(c => c.low)) : currentPrice;

  const marketData: MarketData = {
    symbol: symbolKey,
    currentPrice,
    previousClose,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 1000) / 1000,
    high24h,
    low24h,
    lastUpdated: getLastCacheTimestamp(config.symbol) || new Date().toISOString(),
    candles,
  };

  // 8. Session info
  const sessionInfo = getSessionInfo();

  // 9. Scalping analysis
  const scalpingAnalysis = generateScalpingAnalysis(candles, timeframeAnalysis, currentPrice, overallSignal, sessionInfo);

  return {
    symbol: symbolKey,
    timestamp: new Date().toISOString(),
    marketData,
    timeframeAnalysis,
    overallSignal,
    tradeSetup,
    mtaAlignment,
    sessionInfo,
    scalpingAnalysis,
  };
}
