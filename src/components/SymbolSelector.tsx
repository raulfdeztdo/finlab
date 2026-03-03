'use client';

import { getAvailableSymbols } from '@/lib/config/symbols';
import { SYMBOLS } from '@/lib/config/symbols';

interface SymbolSelectorProps {
  selected: string;
  onChange: (symbol: string) => void;
}

export default function SymbolSelector({ selected, onChange }: SymbolSelectorProps) {
  const symbols = getAvailableSymbols();

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="bg-muted-bg border border-card-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-blue cursor-pointer"
    >
      {symbols.map(s => (
        <option key={s} value={s}>
          {SYMBOLS[s].displayName} - {SYMBOLS[s].description}
        </option>
      ))}
    </select>
  );
}
