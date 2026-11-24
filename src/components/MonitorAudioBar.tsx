import React from 'react';
import { BellOff, BellRing, Volume2, VolumeX } from 'lucide-react';
import { AlarmPriority } from '../utils/audioCue';
import { formatTimerMMSS } from '../utils/hudRenderer';

interface MonitorAudioBarProps {
  isLightMode: boolean;
  soundEnabled: boolean;
  audioVolume: number;
  alarmPriority: AlarmPriority;
  isAlarmSilenced: boolean;
  silenceRemainingSec: number;
  onToggleSound: () => void;
  onChangeAudioVolume: (volume: number) => void;
  onToggleSilenceAlarm: () => void;
}

export const MonitorAudioBar: React.FC<MonitorAudioBarProps> = ({
  isLightMode,
  soundEnabled,
  audioVolume,
  alarmPriority,
  isAlarmSilenced,
  silenceRemainingSec,
  onToggleSound,
  onChangeAudioVolume,
  onToggleSilenceAlarm,
}) => {
  return (
    <div
      aria-label="Controles de audio del monitor clínico"
      className={`shrink-0 border rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
        isLightMode
          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
          : 'bg-[#0F1520] border-slate-800 text-slate-100'
      }`}
    >
      {/* Left: Pulse/Monitor Sound Toggle + Compact Volume Slider */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggleSound}
          title={
            soundEnabled ? 'Silenciar tono de pulso y alarmas' : 'Activar tono de pulso y alarmas'
          }
          className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            soundEnabled
              ? isLightMode
                ? 'bg-emerald-100 border-emerald-500 text-emerald-950 hover:bg-emerald-200/80'
                : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/25'
              : isLightMode
              ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              : 'bg-[#141C2B] border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{soundEnabled ? 'Audio Monitor: ON' : 'Audio Monitor: OFF'}</span>
        </button>

        <div className="flex items-center gap-1.5 w-28 sm:w-32 shrink-0">
          <input
            type="range"
            aria-label="Volumen del monitor clínico"
            min={0}
            max={100}
            step={5}
            value={Math.round(audioVolume * 100)}
            onChange={(e) => onChangeAudioVolume(Number(e.target.value) / 100)}
            style={{ '--slider-accent': isLightMode ? '#0284c7' : '#38bdf8' } as React.CSSProperties}
            className="clinical-slider"
          />
          <span
            className={`text-[10.5px] font-mono tabular-nums w-7 text-right shrink-0 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {Math.round(audioVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Right: Alarm Priority Status + Quick 2-Min Alarm Silence (synced with Student Monitor) */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-[10.5px] font-mono whitespace-nowrap ${
            alarmPriority === 'high'
              ? isLightMode
                ? 'text-red-700 font-semibold'
                : 'text-red-400 font-semibold'
              : alarmPriority === 'medium'
              ? isLightMode
                ? 'text-amber-700 font-semibold'
                : 'text-amber-300 font-semibold'
              : isLightMode
              ? 'text-slate-600'
              : 'text-slate-500'
          }`}
        >
          {alarmPriority === 'high'
            ? '▲ Alarma Crítica'
            : alarmPriority === 'medium'
            ? '▲ Alarma Media'
            : 'Sin alarmas'}
        </span>

        <button
          type="button"
          onClick={onToggleSilenceAlarm}
          className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isAlarmSilenced
              ? isLightMode
                ? 'bg-amber-100 border-amber-500 text-amber-950 hover:bg-amber-200/80'
                : 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/25'
              : alarmPriority !== 'none'
              ? isLightMode
                ? 'bg-red-100 border-red-400 text-red-900 hover:bg-red-200/80'
                : 'bg-red-500/15 border-red-500/60 text-red-200 hover:bg-red-500/25'
              : isLightMode
              ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              : 'bg-[#141C2B] border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          {isAlarmSilenced ? (
            <>
              <BellOff className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono tabular-nums">
                Silenciada {formatTimerMMSS(silenceRemainingSec)} · Reactivar
              </span>
            </>
          ) : (
            <>
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span>Silenciar Alarma (2 min)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
