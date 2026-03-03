import { SymbolConfig } from '@/lib/types';

// ============================================
// Symbol Configurations
// ============================================

export const SYMBOLS: Record<string, SymbolConfig> = {
  XAUUSD: {
    symbol: 'XAU/USD',
    displayName: 'XAUUSD',
    description: 'Gold / US Dollar',
    pipValue: 0.01,
    decimals: 2,
    category: 'commodity',
  },
  // Add more symbols here:
  // EURUSD: {
  //   symbol: 'EUR/USD',
  //   displayName: 'EURUSD',
  //   description: 'Euro / US Dollar',
  //   pipValue: 0.0001,
  //   decimals: 5,
  //   category: 'forex',
  // },
  // BTCUSD: {
  //   symbol: 'BTC/USD',
  //   displayName: 'BTCUSD',
  //   description: 'Bitcoin / US Dollar',
  //   pipValue: 0.01,
  //   decimals: 2,
  //   category: 'crypto',
  // },
};

export const DEFAULT_SYMBOL = 'XAUUSD';

export function getSymbolConfig(symbol: string): SymbolConfig {
  return SYMBOLS[symbol] || SYMBOLS[DEFAULT_SYMBOL];
}

export function getAvailableSymbols(): string[] {
  return Object.keys(SYMBOLS);
}
