import { NextResponse } from 'next/server';
import { getSessionInfo } from '@/lib/signals/scoring';
import { clearCache } from '@/lib/api/twelvedata';

export const dynamic = 'force-dynamic';

// GET: Return current session info and schedule status
export async function GET() {
  try {
    const sessionInfo = getSessionInfo();
    return NextResponse.json({
      success: true,
      data: sessionInfo,
    });
  } catch (error) {
    console.error('[API] Session info error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session info' },
      { status: 500 }
    );
  }
}

// POST: Force clear cache (for manual refresh)
export async function POST() {
  try {
    clearCache();
    return NextResponse.json({
      success: true,
      message: 'Cache cleared',
    });
  } catch (error) {
    console.error('[API] Cache clear error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
