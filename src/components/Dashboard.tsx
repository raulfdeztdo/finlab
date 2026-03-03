'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisResult } from '@/lib/types';
import { DEFAULT_SYMBOL } from '@/lib/config/symbols';
import SignalGauge from './SignalGauge';
import TradeSetupPanel from './TradeSetupPanel';
import TimeframeTable from './TimeframeTable';
import SessionClock from './SessionClock';
import SymbolSelector from './SymbolSelector';
import MTAPanel from './MTAPanel';
import PriceHeader from './PriceHeader';
import ScalpingRecommendations from './ScalpingRecommendations';
import ScheduleConfig from './ScheduleConfig';
import UserManagement from './UserManagement';
import HistoryPanel from './HistoryPanel';
import { RefreshCw, AlertTriangle, Loader2, Activity, Settings, LogOut, Users, History, Bell, BellOff, Menu, X as XIcon } from 'lucide-react';

interface UserInfo {
  id: number;
  username: string;
  role: string;
}

const DEFAULT_SCHEDULE = {
  startHour: 8,
  endHour: 1, // next day
  intervalMinutes: 15,
};

function loadSchedule() {
  if (typeof window === 'undefined') return DEFAULT_SCHEDULE;
  try {
    const saved = localStorage.getItem('finlab_schedule');
    return saved ? JSON.parse(saved) : DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

function saveSchedule(config: typeof DEFAULT_SCHEDULE) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('finlab_schedule', JSON.stringify(config));
  }
}

function isInSchedule(startHour: number, endHour: number, timezone: string): boolean {
  const now = new Date();
  const madridTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentHour = madridTime.getHours();
  const currentMinute = madridTime.getMinutes();
  const currentDecimal = currentHour + currentMinute / 60;

  if (endHour <= startHour) {
    // Crosses midnight: e.g., 8:00 to 1:00
    return currentDecimal >= startHour || currentDecimal < endHour;
  } else {
    return currentDecimal >= startHour && currentDecimal < endHour;
  }
}

async function sendDesktopNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'finlab-action',
    });
  }
}

const CACHE_KEY = 'finlab_last_analysis';

function loadCachedAnalysis(): AnalysisResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveCachedAnalysis(data: AnalysisResult) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full - ignore
    }
  }
}

export default function Dashboard({ user }: { user: UserInfo }) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(() => loadCachedAnalysis());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [countdown, setCountdown] = useState('');

  // Schedule
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [outsideSchedule, setOutsideSchedule] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const previousActionsRef = useRef<string>('');

  // Load schedule from localStorage
  useEffect(() => {
    setSchedule(loadSchedule());
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchAnalysis = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        await fetch('/api/signals', { method: 'POST' });
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await fetch(`/api/market-data?symbol=${symbol}&refresh=${refresh}`);
      const data = await res.json();

      if (data.success) {
        const newAnalysis = data.data as AnalysisResult;

        // Persist to localStorage so F5 restores last data without API call
        saveCachedAnalysis(newAnalysis);

        // Check for actionable signals and send notification
        if (notificationsEnabled && newAnalysis.scalpingAnalysis) {
          const recs = newAnalysis.scalpingAnalysis.recommendations;
          const actionable = recs.filter(r => r.type !== 'wait' && r.confidence >= 50);

          if (actionable.length > 0) {
            const actionsKey = actionable.map(a => `${a.type}-${a.direction}-${a.entry}`).join('|');
            if (actionsKey !== previousActionsRef.current) {
              previousActionsRef.current = actionsKey;
              const topAction = actionable[0];
              sendDesktopNotification(
                `Finlab - ${topAction.direction} ${symbol}`,
                `${topAction.title} | Confianza: ${topAction.confidence}% | R:R 1:${topAction.riskReward}`
              );
            }
          }
        }

        // Reload page to reflect new data (also re-runs server-side auth check)
        window.location.reload();
      } else {
        setError(data.error || 'Error al obtener datos');
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red');
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, notificationsEnabled]);

  // No initial fetch on mount - only auto-refresh and manual button trigger API calls
  // This prevents unnecessary API calls on F5/page refresh

  // Auto-refresh with configurable interval and schedule
  useEffect(() => {
    const timezone = 'Europe/Madrid';

    const interval = window.setInterval(() => {
      const now = new Date();
      const madridTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const minutes = madridTime.getMinutes();
      const seconds = madridTime.getSeconds();

      const inSchedule = isInSchedule(schedule.startHour, schedule.endHour, timezone);
      setOutsideSchedule(!inSchedule);

      if (!inSchedule) {
        setCountdown('Fuera de horario');
        return;
      }

      // Calculate time until next interval mark
      const intervalMins = schedule.intervalMinutes;
      const totalSecondsInSlot = (minutes % intervalMins) * 60 + seconds;
      const totalSecondsLeft = intervalMins * 60 - totalSecondsInSlot;
      const displayMinutes = Math.floor(totalSecondsLeft / 60);
      const displaySeconds = totalSecondsLeft % 60;

      setCountdown(`${displayMinutes}m ${displaySeconds}s`);

      // Auto-refresh at interval marks (first 5s of the minute)
      if (minutes % intervalMins === 0 && seconds < 5) {
        fetchAnalysis(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchAnalysis, schedule]);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const handleScheduleSave = (config: typeof DEFAULT_SCHEDULE) => {
    setSchedule(config);
    saveSchedule(config);
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') return;
      }
    }
    setNotificationsEnabled(!notificationsEnabled);
  };

  // Loading state (manual refresh triggered)
  if (loading && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-accent-blue animate-spin" />
          <p className="text-muted">Cargando datos de mercado...</p>
          <p className="text-xs text-muted">Obteniendo 5 temporalidades de TwelveData (~50s)</p>
        </div>
      </div>
    );
  }

  // Error state (no data at all)
  if (error && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border border-accent-red/30">
          <AlertTriangle className="w-12 h-12 text-accent-red" />
          <p className="text-accent-red font-medium">Error al cargar datos</p>
          <p className="text-sm text-muted max-w-md text-center">{error}</p>
          <button
            onClick={() => fetchAnalysis(true)}
            className="mt-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm hover:bg-accent-blue/80 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Waiting for first update (no data yet, not loading)
  if (!analysis) {
    return (
      <div className="min-h-screen bg-background">
        {/* Minimal header */}
        <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.location.reload()}
                title="Recargar página"
              >
                <Activity className="w-5 h-5 text-accent-blue" />
                <h1 className="text-lg font-bold">Finlab</h1>
              </div>
              <SymbolSelector selected={symbol} onChange={setSymbol} />
            </div>
            <div className="flex items-center gap-3">
              <div className={`text-xs font-mono ${outsideSchedule ? 'text-accent-yellow' : 'text-muted'}`}>
                {countdown}
              </div>
              <button
                onClick={() => fetchAnalysis(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs transition-colors disabled:opacity-50 hover:bg-accent-blue/80"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Obteniendo datos...' : 'Obtener Datos'}
              </button>
              <div className="flex items-center gap-2 pl-3 border-l border-card-border">
                <span className="text-xs text-muted">{user.username}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border border-card-border max-w-md text-center">
            <Activity className="w-12 h-12 text-accent-blue/40" />
            <h2 className="text-lg font-semibold">Esperando primera actualización</h2>
            <p className="text-sm text-muted">
              Pulsa &quot;Obtener Datos&quot; para realizar un análisis manual, o espera a la próxima actualización automática.
            </p>
            <div className="text-xs text-muted mt-2">
              Horario: {schedule.startHour.toString().padStart(2, '0')}:00 - {schedule.endHour.toString().padStart(2, '0')}:00 | Intervalo: cada {schedule.intervalMinutes} min
            </div>
            {refreshing && (
              <div className="flex items-center gap-2 mt-2 text-accent-blue">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Obteniendo datos de mercado (~50s)...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          {/* Main header row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo + Symbol (symbol hidden on mobile) */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => window.location.reload()}
                title="Recargar página"
              >
                <Activity className="w-5 h-5 text-accent-blue" />
                <h1 className="text-lg font-bold">Finlab</h1>
              </div>
              <div className="hidden md:block">
                <SymbolSelector selected={symbol} onChange={setSymbol} />
              </div>
            </div>

            {/* Right: desktop controls */}
            <div className="hidden md:flex items-center gap-2">
              <SessionClock
                session={analysis.sessionInfo}
                lastUpdated={analysis.timestamp}
              />
              <div className={`text-xs font-mono px-2 ${outsideSchedule ? 'text-accent-yellow' : 'text-muted'}`}>
                {countdown}
              </div>
              <button
                onClick={toggleNotifications}
                className={`p-1.5 rounded-lg transition-colors ${notificationsEnabled ? 'text-accent-green hover:bg-accent-green/10' : 'text-muted hover:bg-muted-bg'}`}
                title={notificationsEnabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
              >
                {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <button onClick={() => setShowSchedule(true)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted-bg transition-colors" title="Configurar horario">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted-bg transition-colors" title="Historial">
                <History className="w-4 h-4" />
              </button>
              {user.role === 'admin' && (
                <button onClick={() => setShowUsers(true)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted-bg transition-colors" title="Gestión de usuarios">
                  <Users className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => fetchAnalysis(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted-bg text-muted hover:text-foreground rounded-lg text-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
              <div className="flex items-center gap-2 pl-3 border-l border-card-border">
                <span className="text-xs text-muted hidden lg:inline">{user.username}</span>
                <button onClick={handleLogout} className="p-1.5 rounded-lg text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors" title="Cerrar sesión">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile: refresh + menu */}
            <div className="flex md:hidden items-center gap-1">
              <div className={`text-xs font-mono ${outsideSchedule ? 'text-accent-yellow' : 'text-muted'}`}>
                {countdown}
              </div>
              <button
                onClick={() => fetchAnalysis(true)}
                disabled={refreshing}
                className="p-1.5 rounded-lg bg-muted-bg text-muted hover:text-foreground transition-colors disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setMobileMenuOpen(o => !o)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted-bg transition-colors"
                title="Menú"
              >
                {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 border-t border-card-border">
              {/* Symbol + session info */}
              <div className="pt-3 pb-2 flex flex-col gap-3">
                <SymbolSelector selected={symbol} onChange={setSymbol} />
                <SessionClock session={analysis.sessionInfo} lastUpdated={analysis.timestamp} />
              </div>

              {/* Divider */}
              <div className="border-t border-card-border my-1" />

              {/* Action buttons — full width rows */}
              <div className="py-2 flex flex-col gap-1">
                <button
                  onClick={() => { toggleNotifications(); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    notificationsEnabled
                      ? 'text-accent-green bg-accent-green/10 hover:bg-accent-green/15'
                      : 'text-muted bg-transparent hover:bg-muted-bg hover:text-foreground'
                  }`}
                >
                  {notificationsEnabled ? <Bell className="w-4 h-4 shrink-0" /> : <BellOff className="w-4 h-4 shrink-0" />}
                  <span>{notificationsEnabled ? 'Notificaciones activas' : 'Notificaciones desactivadas'}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-normal ${notificationsEnabled ? 'bg-accent-green/20 text-accent-green' : 'bg-muted-bg text-muted'}`}>
                    {notificationsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => { setShowSchedule(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-muted-bg hover:text-foreground transition-colors"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Configurar horario</span>
                  <span className="ml-auto text-xs text-muted font-mono">
                    {schedule.startHour.toString().padStart(2,'0')}:00–{schedule.endHour.toString().padStart(2,'0')}:00
                  </span>
                </button>

                <button
                  onClick={() => { setShowHistory(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-muted-bg hover:text-foreground transition-colors"
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span>Historial de señales</span>
                </button>

                {user.role === 'admin' && (
                  <button
                    onClick={() => { setShowUsers(true); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-muted-bg hover:text-foreground transition-colors"
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Gestión de usuarios</span>
                    <span className="ml-auto text-xs bg-accent-blue/15 text-accent-blue px-1.5 py-0.5 rounded-md">admin</span>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-card-border my-1" />

              {/* User + logout */}
              <div className="py-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-accent-red hover:bg-accent-red/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Cerrar sesión</span>
                  <span className="ml-auto text-xs text-muted font-normal">{user.username}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && analysis && (
          <div className="bg-accent-red/10 border-t border-accent-red/20 px-4 sm:px-6 py-2 text-xs text-accent-red text-center">
            {error} - Mostrando últimos datos disponibles
          </div>
        )}

        {/* Weekend / market closed banner */}
        {!analysis.sessionInfo.isMarketHours && (
          <div className="bg-accent-yellow/10 border-t border-accent-yellow/20 px-4 sm:px-6 py-2 text-xs text-accent-yellow text-center">
            {analysis.sessionInfo.isWeekend
              ? 'Fin de semana - Mercado cerrado. Mostrando últimos datos disponibles'
              : 'Mercado cerrado - Mostrando últimos datos disponibles'}
          </div>
        )}

        {/* Outside schedule banner */}
        {outsideSchedule && analysis.sessionInfo.isMarketHours && (
          <div className="bg-accent-purple/10 border-t border-accent-purple/20 px-4 sm:px-6 py-2 text-xs text-accent-purple text-center">
            Fuera del horario ({schedule.startHour.toString().padStart(2, '0')}:00 - {schedule.endHour.toString().padStart(2, '0')}:00)
          </div>
        )}
      </header>

      {/* Main Content - Focused on Actions */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Price Header */}
        <PriceHeader data={analysis.marketData} />

        {/* Top Row: Signal + Trade Setup + MTA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SignalGauge score={analysis.overallSignal} />
          <TradeSetupPanel
            setup={analysis.tradeSetup}
            currentPrice={analysis.marketData.currentPrice}
          />
          <MTAPanel mta={analysis.mtaAlignment} />
        </div>

        {/* Scalping Recommendations - PROMINENT */}
        <ScalpingRecommendations
          analysis={analysis.scalpingAnalysis}
          currentPrice={analysis.marketData.currentPrice}
        />

        {/* Multi-Timeframe Table */}
        <TimeframeTable analyses={analysis.timeframeAnalysis} />
      </main>

      {/* Footer */}
      <footer className="border-t border-card-border mt-12 py-4">
        <div className="max-w-[1600px] mx-auto px-6 text-center text-xs text-muted">
          Finlab - Panel de Análisis Financiero | Datos de TwelveData | Solo con fines educativos, no es asesoramiento financiero
        </div>
      </footer>

      {/* Modals */}
      {showSchedule && (
        <ScheduleConfig
          startHour={schedule.startHour}
          endHour={schedule.endHour}
          intervalMinutes={schedule.intervalMinutes}
          onSave={handleScheduleSave}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {showUsers && user.role === 'admin' && (
        <UserManagement
          currentUser={user}
          onClose={() => setShowUsers(false)}
        />
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
