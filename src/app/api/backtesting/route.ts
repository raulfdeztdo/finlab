import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, getAvailableWeeks } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weekKey = searchParams.get('week') || undefined;

    const result = runBacktest(weekKey);
    const availableWeeks = getAvailableWeeks();

    return NextResponse.json({
      success: true,
      data: result,
      availableWeeks,
    });
  } catch (error) {
    console.error('[API] Backtesting error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error en backtesting' },
      { status: 500 }
    );
  }
}
