'use client';

import { useState } from 'react';
import { Clock, X, Check } from 'lucide-react';

interface ScheduleConfigProps {
  startHour: number;
  endHour: number;
  intervalMinutes: number;
  onSave: (config: { startHour: number; endHour: number; intervalMinutes: number }) => void;
  onClose: () => void;
}

export default function ScheduleConfig({ startHour, endHour, intervalMinutes, onSave, onClose }: ScheduleConfigProps) {
  const [start, setStart] = useState(startHour);
  const [end, setEnd] = useState(endHour);
  const [interval, setInterval] = useState(intervalMinutes);

  const handleSave = () => {
    onSave({ startHour: start, endHour: end, intervalMinutes: interval });
    onClose();
  };

  // Generate hour options (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl bg-card border border-card-border overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-bold">Horario de Actualización</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted-bg transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-muted">
            Configura el periodo en el que la aplicación actualiza datos automáticamente.
            Fuera de este horario, no se realizarán actualizaciones automáticas.
          </p>

          {/* Start hour */}
          <div>
            <label className="block text-sm text-muted mb-1.5">Hora de inicio</label>
            <select
              value={start}
              onChange={e => setStart(parseInt(e.target.value))}
              className="w-full bg-muted-bg border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              {hours.map(h => (
                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>

          {/* End hour */}
          <div>
            <label className="block text-sm text-muted mb-1.5">
              Hora de fin {end <= start ? '(día siguiente)' : ''}
            </label>
            <select
              value={end}
              onChange={e => setEnd(parseInt(e.target.value))}
              className="w-full bg-muted-bg border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              {hours.map(h => (
                <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">
              Si la hora de fin es menor o igual que la de inicio, se interpreta como el día siguiente.
            </p>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-sm text-muted mb-1.5">Intervalo de actualización</label>
            <select
              value={interval}
              onChange={e => setInterval(parseInt(e.target.value))}
              className="w-full bg-muted-bg border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue"
            >
              <option value={5}>Cada 5 minutos</option>
              <option value={10}>Cada 10 minutos</option>
              <option value={15}>Cada 15 minutos</option>
              <option value={30}>Cada 30 minutos</option>
              <option value={60}>Cada 60 minutos</option>
            </select>
          </div>

          {/* Visual summary */}
          <div className="p-3 rounded-lg bg-muted-bg/50 border border-card-border">
            <p className="text-xs text-muted">Resumen:</p>
            <p className="text-sm font-medium mt-1">
              Actualizaciones cada <span className="text-accent-blue">{interval} min</span> de{' '}
              <span className="text-accent-green">{start.toString().padStart(2, '0')}:00</span> a{' '}
              <span className="text-accent-green">{end.toString().padStart(2, '0')}:00</span>
              {end <= start ? ' (día siguiente)' : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-card-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm hover:bg-accent-blue/80 transition-colors"
          >
            <Check className="w-4 h-4" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
