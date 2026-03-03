import fs from 'fs';
import path from 'path';
import { OHLCV, ScalpingRecommendation } from '@/lib/types';

// ============================================
// CSV Manager — Weekly trade logs & candle data
// ============================================

const DATA_DIR = path.join(process.cwd(), 'data', 'csv');

// Ensure the CSV directory exists
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// --- Week key: YYYY-Www (ISO week, Mon=1..Sun=7) ---
function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday (ISO week definition)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Monday of the current ISO week
function getWeekMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// Friday of the current ISO week
function getWeekFriday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 4;
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// ============================================
// Trades CSV — one row per detected signal
// ============================================

const TRADES_HEADER = 'timestamp,symbol,direction,type,title,entry,stop_loss,take_profit,risk_reward,confidence,urgency,reasons,signal_direction,signal_score\n';

function getTradesPath(weekKey: string): string {
  return path.join(DATA_DIR, `trades_${weekKey}.csv`);
}

export function appendTrades(
  symbol: string,
  recommendations: ScalpingRecommendation[],
  signalDirection: string,
  signalScore: number,
  timestamp: string = new Date().toISOString()
): void {
  ensureDir();
  const weekKey = getWeekKey(new Date(timestamp));
  const filePath = getTradesPath(weekKey);

  // Create file with header if it doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, TRADES_HEADER, 'utf-8');
  }

  const actionable = recommendations.filter(r => r.type !== 'wait');
  if (actionable.length === 0) return;

  const lines = actionable.map(r => {
    const reasons = r.reasons.join(' | ').replace(/,/g, ';');
    return `${timestamp},${symbol},${r.direction},${r.type},${r.title.replace(/,/g, ';')},${r.entry},${r.stopLoss},${r.takeProfit},${r.riskReward},${r.confidence},${r.urgency},"${reasons}",${signalDirection},${signalScore}`;
  });

  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

// ============================================
// Candles CSV — 5min OHLCV data
// ============================================

const CANDLES_HEADER = 'datetime,open,high,low,close,volume\n';

function getCandlesPath(weekKey: string): string {
  return path.join(DATA_DIR, `candles_5min_${weekKey}.csv`);
}

export function appendCandles5min(candles: OHLCV[]): void {
  ensureDir();
  if (!candles || candles.length === 0) return;

  const weekKey = getWeekKey();
  const filePath = getCandlesPath(weekKey);

  // Read existing datetimes to avoid duplicates
  const existingDatetimes = new Set<string>();
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(1); // skip header
    for (const line of lines) {
      if (line.trim()) {
        existingDatetimes.add(line.split(',')[0]);
      }
    }
  } else {
    fs.writeFileSync(filePath, CANDLES_HEADER, 'utf-8');
  }

  // Only append candles we don't already have
  const newCandles = candles.filter(c => !existingDatetimes.has(c.datetime));
  if (newCandles.length === 0) return;

  const lines = newCandles.map(c =>
    `${c.datetime},${c.open},${c.high},${c.low},${c.close},${c.volume}`
  );

  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  console.log(`[CSV] Appended ${newCandles.length} new 5min candles to ${weekKey}`);
}

// ============================================
// Read CSV data for backtesting
// ============================================

export interface TradeRecord {
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

export interface CandleRecord {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseTradeCsv(content: string): TradeRecord[] {
  const lines = content.split('\n').slice(1); // skip header
  const trades: TradeRecord[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Handle quoted fields (reasons may contain commas)
    const match = line.match(/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),"?([^"]*)"?,([^,]*),([^,]*)$/);
    if (!match) continue;

    trades.push({
      timestamp: match[1],
      symbol: match[2],
      direction: match[3],
      type: match[4],
      title: match[5],
      entry: parseFloat(match[6]),
      stopLoss: parseFloat(match[7]),
      takeProfit: parseFloat(match[8]),
      riskReward: parseFloat(match[9]),
      confidence: parseInt(match[10]),
      urgency: match[11],
      reasons: match[12],
      signalDirection: match[13],
      signalScore: parseFloat(match[14]),
    });
  }

  return trades;
}

function parseCandleCsv(content: string): CandleRecord[] {
  const lines = content.split('\n').slice(1);
  const candles: CandleRecord[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 6) continue;

    candles.push({
      datetime: parts[0],
      open: parseFloat(parts[1]),
      high: parseFloat(parts[2]),
      low: parseFloat(parts[3]),
      close: parseFloat(parts[4]),
      volume: parseFloat(parts[5]),
    });
  }

  return candles;
}

export function readWeekTrades(weekKey?: string): TradeRecord[] {
  ensureDir();
  const key = weekKey || getWeekKey();
  const filePath = getTradesPath(key);
  if (!fs.existsSync(filePath)) return [];
  return parseTradeCsv(fs.readFileSync(filePath, 'utf-8'));
}

export function readWeekCandles(weekKey?: string): CandleRecord[] {
  ensureDir();
  const key = weekKey || getWeekKey();
  const filePath = getCandlesPath(key);
  if (!fs.existsSync(filePath)) return [];
  return parseCandleCsv(fs.readFileSync(filePath, 'utf-8'));
}

// ============================================
// Backtesting Engine
// ============================================

export interface TradeResult {
  trade: TradeRecord;
  outcome: 'win' | 'loss' | 'open';
  exitPrice: number;
  exitDatetime: string;
  pnlPoints: number;
  duration: string; // human readable
  hitTP: boolean;
  hitSL: boolean;
}

export interface BacktestResult {
  weekKey: string;
  weekRange: string; // "2026-03-02 → 2026-03-06"
  totalTrades: number;
  wins: number;
  losses: number;
  openTrades: number;
  winRate: number;      // percentage
  totalPnlPoints: number;
  avgPnlPoints: number;
  avgConfidence: number;
  avgRiskReward: number;
  bestTrade: TradeResult | null;
  worstTrade: TradeResult | null;
  tradeResults: TradeResult[];
  byDirection: {
    LONG: { total: number; wins: number; losses: number; winRate: number };
    SHORT: { total: number; wins: number; losses: number; winRate: number };
  };
  byType: Record<string, { total: number; wins: number; losses: number; winRate: number }>;
}

export function runBacktest(weekKey?: string): BacktestResult {
  const key = weekKey || getWeekKey();
  const trades = readWeekTrades(key);
  const candles = readWeekCandles(key);

  const monday = getWeekMonday();
  const friday = getWeekFriday();
  const weekRange = `${monday} → ${friday}`;

  if (trades.length === 0 || candles.length === 0) {
    return {
      weekKey: key,
      weekRange,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      openTrades: 0,
      winRate: 0,
      totalPnlPoints: 0,
      avgPnlPoints: 0,
      avgConfidence: 0,
      avgRiskReward: 0,
      bestTrade: null,
      worstTrade: null,
      tradeResults: [],
      byDirection: {
        LONG: { total: 0, wins: 0, losses: 0, winRate: 0 },
        SHORT: { total: 0, wins: 0, losses: 0, winRate: 0 },
      },
      byType: {},
    };
  }

  // Sort candles chronologically
  const sortedCandles = [...candles].sort((a, b) =>
    new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  // Evaluate each trade against subsequent candles
  const tradeResults: TradeResult[] = [];

  for (const trade of trades) {
    if (trade.entry <= 0) continue; // skip 'wait' trades that slipped through

    const tradeTime = new Date(trade.timestamp).getTime();

    // Get candles STRICTLY AFTER the trade signal.
    // The candle CSV contains historical data fetched from TwelveData at the
    // moment the trade was detected. Those candles cover hours/days BEFORE the
    // signal — they are NOT future price action. We must only evaluate candles
    // whose datetime is strictly later than the trade timestamp + 5 min buffer
    // (so we skip the candle during which the signal was generated).
    const BUFFER_MS = 5 * 60 * 1000; // 5 minutes — one candle period
    const futureCandles = sortedCandles.filter(c => {
      const cTime = new Date(c.datetime.includes('T') ? c.datetime : c.datetime.replace(' ', 'T')).getTime();
      return cTime > tradeTime + BUFFER_MS;
    });

    let outcome: 'win' | 'loss' | 'open' = 'open';
    let exitPrice = 0;
    let exitDatetime = '';
    let hitTP = false;
    let hitSL = false;

    const isLong = trade.direction === 'LONG';

    for (const candle of futureCandles) {
      if (isLong) {
        // LONG: SL hit if low <= stopLoss, TP hit if high >= takeProfit
        if (candle.low <= trade.stopLoss) {
          outcome = 'loss';
          exitPrice = trade.stopLoss;
          exitDatetime = candle.datetime;
          hitSL = true;
          break;
        }
        if (candle.high >= trade.takeProfit) {
          outcome = 'win';
          exitPrice = trade.takeProfit;
          exitDatetime = candle.datetime;
          hitTP = true;
          break;
        }
      } else {
        // SHORT: SL hit if high >= stopLoss, TP hit if low <= takeProfit
        if (candle.high >= trade.stopLoss) {
          outcome = 'loss';
          exitPrice = trade.stopLoss;
          exitDatetime = candle.datetime;
          hitSL = true;
          break;
        }
        if (candle.low <= trade.takeProfit) {
          outcome = 'win';
          exitPrice = trade.takeProfit;
          exitDatetime = candle.datetime;
          hitTP = true;
          break;
        }
      }
    }

    // If still open, use last candle close as current price
    if (outcome === 'open' && futureCandles.length > 0) {
      const lastCandle = futureCandles[futureCandles.length - 1];
      exitPrice = lastCandle.close;
      exitDatetime = lastCandle.datetime;
    }

    const pnlPoints = isLong
      ? Math.round((exitPrice - trade.entry) * 100) / 100
      : Math.round((trade.entry - exitPrice) * 100) / 100;

    // Duration
    let duration = '-';
    if (exitDatetime) {
      const diffMs = new Date(exitDatetime.includes('T') ? exitDatetime : exitDatetime.replace(' ', 'T')).getTime() - tradeTime;
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 60) {
        duration = `${diffMins}min`;
      } else {
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        duration = `${h}h ${m}min`;
      }
    }

    tradeResults.push({
      trade,
      outcome,
      exitPrice,
      exitDatetime,
      pnlPoints,
      duration,
      hitTP,
      hitSL,
    });
  }

  // Aggregate stats
  const wins = tradeResults.filter(r => r.outcome === 'win').length;
  const losses = tradeResults.filter(r => r.outcome === 'loss').length;
  const openTrades = tradeResults.filter(r => r.outcome === 'open').length;
  const closed = wins + losses;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100 * 10) / 10 : 0;

  const totalPnlPoints = Math.round(tradeResults.reduce((sum, r) => sum + r.pnlPoints, 0) * 100) / 100;
  const avgPnlPoints = closed > 0 ? Math.round((totalPnlPoints / closed) * 100) / 100 : 0;
  const avgConfidence = trades.length > 0
    ? Math.round(trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length * 10) / 10
    : 0;
  const avgRiskReward = trades.length > 0
    ? Math.round(trades.reduce((sum, t) => sum + t.riskReward, 0) / trades.length * 10) / 10
    : 0;

  const sorted = [...tradeResults].filter(r => r.outcome !== 'open').sort((a, b) => b.pnlPoints - a.pnlPoints);
  const bestTrade = sorted.length > 0 ? sorted[0] : null;
  const worstTrade = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  // By direction
  const byDirection = {
    LONG: { total: 0, wins: 0, losses: 0, winRate: 0 },
    SHORT: { total: 0, wins: 0, losses: 0, winRate: 0 },
  };
  for (const r of tradeResults) {
    const dir = r.trade.direction as 'LONG' | 'SHORT';
    if (dir !== 'LONG' && dir !== 'SHORT') continue;
    byDirection[dir].total++;
    if (r.outcome === 'win') byDirection[dir].wins++;
    if (r.outcome === 'loss') byDirection[dir].losses++;
  }
  byDirection.LONG.winRate = (byDirection.LONG.wins + byDirection.LONG.losses) > 0
    ? Math.round(byDirection.LONG.wins / (byDirection.LONG.wins + byDirection.LONG.losses) * 100 * 10) / 10 : 0;
  byDirection.SHORT.winRate = (byDirection.SHORT.wins + byDirection.SHORT.losses) > 0
    ? Math.round(byDirection.SHORT.wins / (byDirection.SHORT.wins + byDirection.SHORT.losses) * 100 * 10) / 10 : 0;

  // By type
  const byType: Record<string, { total: number; wins: number; losses: number; winRate: number }> = {};
  for (const r of tradeResults) {
    const t = r.trade.type;
    if (!byType[t]) byType[t] = { total: 0, wins: 0, losses: 0, winRate: 0 };
    byType[t].total++;
    if (r.outcome === 'win') byType[t].wins++;
    if (r.outcome === 'loss') byType[t].losses++;
  }
  for (const t of Object.keys(byType)) {
    const closed = byType[t].wins + byType[t].losses;
    byType[t].winRate = closed > 0 ? Math.round(byType[t].wins / closed * 100 * 10) / 10 : 0;
  }

  return {
    weekKey: key,
    weekRange,
    totalTrades: tradeResults.length,
    wins,
    losses,
    openTrades,
    winRate,
    totalPnlPoints,
    avgPnlPoints,
    avgConfidence,
    avgRiskReward,
    bestTrade,
    worstTrade,
    tradeResults,
    byDirection,
    byType,
  };
}

// ============================================
// List available weeks
// ============================================

export function getAvailableWeeks(): string[] {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR);
  const weeks = new Set<string>();
  for (const f of files) {
    const match = f.match(/trades_(\d{4}-W\d{2})\.csv/);
    if (match) weeks.add(match[1]);
  }
  return Array.from(weeks).sort().reverse();
}
