import { NextRequest, NextResponse } from 'next/server';
import { runFullAnalysis } from '@/lib/signals/scoring';
import { DEFAULT_SYMBOL } from '@/lib/config/symbols';
import { getSession, findUserById, logApiRequest, logSuggestedActions } from '@/lib/db';
import { appendTrades, appendCandles5min } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || DEFAULT_SYMBOL;
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Get authenticated user (optional - don't block if not authenticated)
    let userId: number | undefined;
    try {
      const sessionId = request.cookies.get('session')?.value;
      if (sessionId) {
        const session = getSession(sessionId);
        if (session) {
          const user = findUserById(session.user_id);
          if (user) userId = user.id;
        }
      }
    } catch {
      // DB not ready yet or session invalid - continue without user
    }

    console.log(`[API] Analysis request: ${symbol} (refresh: ${forceRefresh})`);

    const analysis = await runFullAnalysis(symbol, forceRefresh);
    const durationMs = Date.now() - startTime;

    // Log to database
    try {
      const requestId = logApiRequest({
        userId,
        symbol,
        requestType: forceRefresh ? 'refresh' : 'auto',
        responseStatus: 'success',
        durationMs,
        cached: !forceRefresh,
      });

      // Log suggested actions
      if (analysis.scalpingAnalysis && analysis.scalpingAnalysis.recommendations.length > 0) {
        logSuggestedActions(requestId, {
          symbol,
          actions: analysis.scalpingAnalysis.recommendations.map(rec => ({
            actionType: rec.type,
            direction: rec.direction,
            title: rec.title,
            entryPrice: rec.entry || undefined,
            stopLoss: rec.stopLoss || undefined,
            takeProfit: rec.takeProfit || undefined,
            riskReward: rec.riskReward || undefined,
            confidence: rec.confidence || undefined,
            urgency: rec.urgency,
            reasons: rec.reasons,
          })),
          overallSignalDirection: analysis.overallSignal.direction,
          overallSignalScore: analysis.overallSignal.normalized,
          marketBias: analysis.scalpingAnalysis.marketBias,
          volatilityState: analysis.scalpingAnalysis.volatilityState,
        });
      }
    } catch (dbError) {
      console.error('[API] DB logging error (non-fatal):', dbError);
    }

    // Write to weekly CSV files (non-fatal)
    try {
      // Append detected trades (only actionable ones, not 'wait')
      if (analysis.scalpingAnalysis && analysis.scalpingAnalysis.recommendations.length > 0) {
        appendTrades(
          symbol,
          analysis.scalpingAnalysis.recommendations,
          analysis.overallSignal.direction,
          analysis.overallSignal.normalized,
          analysis.timestamp
        );
      }

      // Append 5min candles for backtesting
      if (analysis.marketData?.candles?.['5min']?.length > 0) {
        appendCandles5min(analysis.marketData.candles['5min']);
      }
    } catch (csvError) {
      console.error('[API] CSV writing error (non-fatal):', csvError);
    }

    return NextResponse.json({
      success: true,
      data: analysis,
      cached: !forceRefresh,
      lastUpdated: analysis.timestamp,
    });
  } catch (error) {
    console.error('[API] Analysis error:', error);

    // Log error to database
    try {
      const searchParams = request.nextUrl.searchParams;
      const symbol = searchParams.get('symbol') || DEFAULT_SYMBOL;
      logApiRequest({
        symbol,
        requestType: 'error',
        responseStatus: 'error',
      });
    } catch {
      // Ignore DB errors during error logging
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
