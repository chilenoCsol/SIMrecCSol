import React, { useEffect, useState } from 'react';
import { AlertTriangle, Minus, Plus, Zap } from 'lucide-react';
import { HYPOTHERMIA_THRESHOLD, RHYTHM_LABELS } from '../data/nrpPresets';
import {
  CardiacRhythm,
  EcgLead,
  PlethColorMode,
  RampStatus,
  SensorConnections,
  TransitionDurationSec,
  VitalParams,
} from '../types/simulation';

interface InstructorPanelProps {
  isLightMode: boolean;
  vitals: VitalParams;
  targetVitals: VitalParams;
  sensors: SensorConnections;
  transitionDurationSec: TransitionDurationSec;
  rampStatus: RampStatus;
  plethColorMode: PlethColorMode;
  onUpdateVitals: (patch: Partial<VitalParams>, clearPreset?: boolean) => void;
  onToggleSensor: (key: keyof SensorConnections) => void;
  onSetAllSensors: (connected: boolean) => void;
  onSelectRhythm: (rhythm: CardiacRhythm) => void;
  onChangeTransitionDuration: (sec: TransitionDurationSec) => void;
  onApplyRampNow: () => void;
}

const ECG_LEADS: EcgLead[] = ['DII', 'DI', 'DIII'];
const RHYTHMS: CardiacRhythm[] = ['sinusal', 'bradicardia', 'asistolia', 'pea'];

const RAMP_SPEED_OPTIONS: Array<{ value: TransitionDurationSec; label: string }> = [
  { value: 0, label: 'Inmediato' },
  { value: 20, label: '20 s' },
  { value: 40, label: '40 s' },
  { value: 60, label: '60 s' },
  { value: 120, label: '2 min' },
];

export const InstructorPanel: React.FC<InstructorPanelProps> = ({
  isLightMode,
  vitals,
  targetVitals,
  sensors,
  transitionDurationSec,
  rampStatus,
  plethColorMode,
  onUpdateVitals,
  onToggleSensor,
  onSetAllSensors,
  onSelectRhythm,
  onChangeTransitionDuration,
  onApplyRampNow,
}) => {
  const isHypothermia = vitals.temp < HYPOTHERMIA_THRESHOLD;
  const isAsystole = vitals.rhythm === 'asistolia';
  const plethAccentHex =
    plethColorMode === 'yellow'
      ? isLightMode
        ? '#d97706'
        : '#facc15'
      : isLightMode
      ? '#0284c7'
      : '#38bdf8';

  const allSensorsConnected =
    sensors.ecgConnected && sensors.spo2Connected && sensors.tempConnected;
  const anySensorConnected =
    sensors.ecgConnected || sensors.spo2Connected || sensors.tempConnected;
  const hrSourceMode: 'ecg' | 'spo2' | 'none' = sensors.ecgConnected
    ? 'ecg'
    : sensors.spo2Connected
    ? 'spo2'
    : 'none';

  const currentHrDisplay = isAsystole ? 0 : Math.round(vitals.hr);
  const targetHrDisplay = targetVitals.rhythm === 'asistolia' ? 0 : Math.round(targetVitals.hr);
  const hrRamping = rampStatus.active && Math.abs(currentHrDisplay - targetHrDisplay) >= 1;

  const currentSpo2Display = Math.round(vitals.spo2);
  const targetSpo2Display = Math.round(targetVitals.spo2);
  const spo2Ramping = rampStatus.active && Math.abs(currentSpo2Display - targetSpo2Display) >= 1;

  const tempRamping = rampStatus.active && Math.abs(vitals.temp - targetVitals.temp) >= 0.05;

  // Manual numeric input draft states (kept in sync with targetVitals, validated on Enter/blur)
  const [hrInput, setHrInput] = useState<string>(String(targetHrDisplay));
  const [spo2Input, setSpo2Input] = useState<string>(String(targetSpo2Display));
  const [tempInput, setTempInput] = useState<string>(targetVitals.temp.toFixed(1));

  useEffect(() => {
    setHrInput(String(targetHrDisplay));
  }, [targetHrDisplay]);

  useEffect(() => {
    setSpo2Input(String(targetSpo2Display));
  }, [targetSpo2Display]);

  useEffect(() => {
    setTempInput(targetVitals.temp.toFixed(1));
  }, [targetVitals.temp]);

  const handleHrDelta = (delta: number) => {
    const baseHr = targetVitals.rhythm === 'asistolia' ? 0 : targetVitals.hr;
    const nextHr = Math.max(0, Math.min(220, Math.round(baseHr + delta)));
    const patch: Partial<VitalParams> = { hr: nextHr };
    if (nextHr === 0) {
      patch.rhythm = 'asistolia';
    } else if (targetVitals.rhythm === 'asistolia') {
      patch.rhythm = nextHr < 100 ? 'bradicardia' : 'sinusal';
    } else if (targetVitals.rhythm === 'sinusal' && nextHr < 100) {
      patch.rhythm = 'bradicardia';
    } else if (targetVitals.rhythm === 'bradicardia' && nextHr >= 100) {
      patch.rhythm = 'sinusal';
    }
    onUpdateVitals(patch, true);
  };

  const handleHrDirect = (value: number) => {
    const clamped = Math.max(0, Math.min(220, Math.round(value)));
    const patch: Partial<VitalParams> = { hr: clamped };
    if (clamped === 0) {
      patch.rhythm = 'asistolia';
    } else if (targetVitals.rhythm === 'asistolia') {
      patch.rhythm = clamped < 100 ? 'bradicardia' : 'sinusal';
    } else if (targetVitals.rhythm === 'sinusal' && clamped < 100) {
      patch.rhythm = 'bradicardia';
    } else if (targetVitals.rhythm === 'bradicardia' && clamped >= 100) {
      patch.rhythm = 'sinusal';
    }
    onUpdateVitals(patch, true);
  };

  const commitHrInput = () => {
    const parsed = Number.parseInt(hrInput.trim(), 10);
    if (Number.isNaN(parsed)) {
      setHrInput(String(targetHrDisplay));
      return;
    }
    const clamped = Math.max(0, Math.min(220, parsed));
    setHrInput(String(clamped));
    if (clamped !== targetHrDisplay) {
      handleHrDirect(clamped);
    }
  };

  const handleSpo2Delta = (delta: number) => {
    const next = Math.max(40, Math.min(100, Math.round(targetVitals.spo2 + delta)));
    onUpdateVitals({ spo2: next }, true);
  };

  const commitSpo2Input = () => {
    const parsed = Number.parseInt(spo2Input.trim(), 10);
    if (Number.isNaN(parsed)) {
      setSpo2Input(String(targetSpo2Display));
      return;
    }
    const clamped = Math.max(40, Math.min(100, parsed));
    setSpo2Input(String(clamped));
    if (clamped !== targetSpo2Display) {
      onUpdateVitals({ spo2: clamped }, true);
    }
  };

  const handleTempDelta = (delta: number) => {
    const next = Math.max(
      34.0,
      Math.min(39.0, Math.round((targetVitals.temp + delta) * 10) / 10)
    );
    onUpdateVitals({ temp: next }, true);
  };

  const commitTempInput = () => {
    const normalized = tempInput.trim().replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      setTempInput(targetVitals.temp.toFixed(1));
      return;
    }
    const clamped = Math.max(34.0, Math.min(39.0, Math.round(parsed * 10) / 10));
    setTempInput(clamped.toFixed(1));
    if (Math.abs(clamped - targetVitals.temp) >= 0.05) {
      onUpdateVitals({ temp: clamped }, true);
    }
  };

  const rampChanges: string[] = [];
  if (hrRamping) {
    rampChanges.push(`FC: ${currentHrDisplay} → ${targetHrDisplay} lpm`);
  }
  if (spo2Ramping) {
    rampChanges.push(`SatO₂: ${currentSpo2Display} → ${targetSpo2Display}%`);
  }
  if (tempRamping) {
    rampChanges.push(`Temp: ${vitals.temp.toFixed(1)} → ${targetVitals.temp.toFixed(1)} °C`);
  }

  const stepBtnClass = isLightMode
    ? 'w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-950 shrink-0 cursor-pointer'
    : 'w-6 h-6 flex items-center justify-center rounded border border-slate-700 bg-[#141C2B] text-slate-300 hover:bg-slate-800 hover:text-white shrink-0 cursor-pointer';

  const numericBoxClass = isLightMode
    ? 'w-12 h-6 px-1 rounded border border-slate-300 bg-slate-50 font-mono text-[11px] font-semibold tabular-nums text-right text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
    : 'w-12 h-6 px-1 rounded border border-slate-700 bg-[#080C12] font-mono text-[11px] font-semibold tabular-nums text-right text-slate-100 focus:outline-none focus:border-sky-400 shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  return (
    <section
      aria-label="Parámetros vitales del instructor"
      className={`shrink-0 border rounded-lg px-2.5 py-1.5 space-y-1.5 transition-colors ${
        isLightMode
          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
          : 'bg-[#0F1520] border-slate-800 text-slate-100'
      }`}
    >
      {/* Header + 5-Option Physiological Ramp Speed Selector */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h2
          className={`text-[11.5px] font-bold tracking-wide whitespace-nowrap ${
            isLightMode ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          Parámetros Vitales
        </h2>

        <div
          role="group"
          aria-label="Velocidad de Transición Fisiológica (Rampa)"
          className={`inline-flex items-center gap-0.5 p-0.5 border rounded ${
            isLightMode
              ? 'bg-slate-100 border-slate-300'
              : 'bg-[#080C12] border-slate-800'
          }`}
        >
          {RAMP_SPEED_OPTIONS.map((opt) => {
            const selected = transitionDurationSec === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeTransitionDuration(opt.value)}
                className={`px-1.5 py-0.5 text-[10.5px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  selected
                    ? isLightMode
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'bg-sky-500 text-slate-950 font-semibold'
                    : isLightMode
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/80'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* HUB-Only Live Ramp Progress Indicator & 'Aplicar ya' Override */}
      {rampStatus.active && (
        <div
          className={`px-2 py-1 rounded border space-y-1 ${
            isLightMode
              ? 'bg-sky-50 border-sky-300'
              : 'bg-sky-500/10 border-sky-500/45'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
              <span
                className={`text-[10.5px] font-mono font-semibold tabular-nums whitespace-nowrap ${
                  isLightMode ? 'text-sky-800' : 'text-sky-200'
                }`}
              >
                Rampa ({rampStatus.remainingSec}s)
              </span>
              {rampChanges.length > 0 && (
                <span
                  className={`text-[10.5px] font-mono tabular-nums truncate ${
                    isLightMode ? 'text-slate-700' : 'text-slate-200'
                  }`}
                >
                  {rampChanges.join(' · ')}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onApplyRampNow}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isLightMode
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
              }`}
            >
              <Zap className="w-2.5 h-2.5 fill-current" />
              Aplicar ya
            </button>
          </div>

          <div
            className={`w-full h-1 rounded-full overflow-hidden ${
              isLightMode ? 'bg-sky-200' : 'bg-slate-900'
            }`}
          >
            <div
              className={`h-full transition-[width] duration-200 ${
                isLightMode ? 'bg-sky-600' : 'bg-sky-400'
              }`}
              style={{
                width: `${Math.min(100, Math.max(2, Math.round(rampStatus.progressPct)))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Compact Single-Row Clinical Sensor Connection Toggles */}
      <div
        className={`border rounded px-2 py-1 flex flex-wrap items-center justify-between gap-1.5 ${
          isLightMode
            ? 'bg-slate-50 border-slate-300'
            : 'bg-[#0B1019] border-slate-800/90'
        }`}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 mr-0.5 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            Sensores:
          </span>

          {/* ECG Sensor Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={sensors.ecgConnected}
            aria-label="ECG Conectado"
            title="ECG Conectado"
            onClick={() => onToggleSensor('ecgConnected')}
            className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border text-left transition-colors cursor-pointer ${
              sensors.ecgConnected
                ? isLightMode
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-emerald-500/15 border-emerald-500/55 text-emerald-200'
                : isLightMode
                ? 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                : 'bg-[#121926] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">ECG</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-3 w-5 shrink-0 items-center rounded-full transition-colors ${
                sensors.ecgConnected
                  ? isLightMode
                    ? 'bg-emerald-600'
                    : 'bg-emerald-500'
                  : isLightMode
                  ? 'bg-slate-300'
                  : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full bg-white transition-transform ${
                  sensors.ecgConnected ? 'translate-x-2.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {/* SatO2 Sensor Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={sensors.spo2Connected}
            aria-label="Sensor SatO2 Conectado"
            title="Sensor SatO2 Conectado"
            onClick={() => onToggleSensor('spo2Connected')}
            className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border text-left transition-colors cursor-pointer ${
              sensors.spo2Connected
                ? plethColorMode === 'yellow'
                  ? isLightMode
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-amber-400/15 border-amber-400/55 text-amber-200'
                  : isLightMode
                  ? 'bg-sky-50 border-sky-400 text-sky-950'
                  : 'bg-sky-500/15 border-sky-500/55 text-sky-200'
                : isLightMode
                ? 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                : 'bg-[#121926] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">SatO₂</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-3 w-5 shrink-0 items-center rounded-full transition-colors ${
                sensors.spo2Connected
                  ? plethColorMode === 'yellow'
                    ? isLightMode
                      ? 'bg-amber-500'
                      : 'bg-amber-400'
                    : isLightMode
                    ? 'bg-sky-600'
                    : 'bg-sky-400'
                  : isLightMode
                  ? 'bg-slate-300'
                  : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full bg-white transition-transform ${
                  sensors.spo2Connected ? 'translate-x-2.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {/* Temperature Sensor Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={sensors.tempConnected}
            aria-label="Sensor Temp Conectado"
            title="Sensor Temp Conectado"
            onClick={() => onToggleSensor('tempConnected')}
            className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border text-left transition-colors cursor-pointer ${
              sensors.tempConnected
                ? isLightMode
                  ? 'bg-amber-50 border-amber-400 text-amber-950'
                  : 'bg-amber-500/15 border-amber-500/55 text-amber-200'
                : isLightMode
                ? 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                : 'bg-[#121926] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">Temp</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-3 w-5 shrink-0 items-center rounded-full transition-colors ${
                sensors.tempConnected
                  ? isLightMode
                    ? 'bg-amber-500'
                    : 'bg-amber-400'
                  : isLightMode
                  ? 'bg-slate-300'
                  : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full bg-white transition-transform ${
                  sensors.tempConnected ? 'translate-x-2.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!allSensorsConnected && (
            <button
              type="button"
              onClick={() => onSetAllSensors(true)}
              className={`px-1.5 py-0.5 text-[9.5px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
                isLightMode
                  ? 'border-emerald-500/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              Conectar Todos
            </button>
          )}
          {anySensorConnected && (
            <button
              type="button"
              onClick={() => onSetAllSensors(false)}
              className={`px-1.5 py-0.5 text-[9.5px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
                isLightMode
                  ? 'border-slate-300 bg-white text-slate-700 hover:border-amber-500 hover:text-amber-900'
                  : 'border-slate-700 bg-[#141C2B] text-slate-300 hover:border-amber-500/50 hover:text-amber-200'
              }`}
            >
              Desconectar Todos
            </button>
          )}
        </div>
      </div>

      {/* Ultra-Compact Single-Row Vital Controls: FC, SatO2, Temperatura */}
      <div className="space-y-1">
        {/* 1. Frecuencia Cardíaca (FC) */}
        <div className="flex items-center gap-1.5">
          <div className="w-[126px] sm:w-[136px] shrink-0 flex items-baseline justify-between gap-1">
            <label
              htmlFor="slider-hr"
              title={
                hrSourceMode === 'none'
                  ? 'Monitor: --- (sin sensor)'
                  : hrSourceMode === 'spo2'
                  ? 'Pulso por pletismografía'
                  : '0–220 lpm'
              }
              className={`text-[11px] font-semibold whitespace-nowrap ${
                isLightMode ? 'text-slate-900' : 'text-slate-200'
              }`}
            >
              {hrSourceMode === 'ecg'
                ? 'FC (ECG)'
                : hrSourceMode === 'spo2'
                ? 'FP (SpO2)'
                : 'FC / FP'}
            </label>
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span
                className={`text-sm font-mono font-bold tabular-nums leading-none ${
                  hrSourceMode === 'none'
                    ? isLightMode
                      ? 'text-slate-400'
                      : 'text-slate-500'
                    : hrSourceMode === 'spo2'
                    ? plethColorMode === 'yellow'
                      ? isLightMode
                        ? 'text-amber-600'
                        : 'text-amber-300'
                      : isLightMode
                      ? 'text-sky-700'
                      : 'text-sky-400'
                    : isAsystole
                    ? isLightMode
                      ? 'text-red-600'
                      : 'text-red-400'
                    : isLightMode
                    ? 'text-emerald-700'
                    : 'text-emerald-400'
                }`}
              >
                {currentHrDisplay}
              </span>
              {hrRamping && (
                <span
                  className={`text-[9.5px] font-mono font-semibold tabular-nums ${
                    isLightMode ? 'text-sky-700' : 'text-sky-300'
                  }`}
                >
                  →{targetHrDisplay}
                </span>
              )}
              <span
                className={`text-[9.5px] font-mono ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                lpm
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleHrDelta(-5)}
            aria-label="Disminuir FC en 5 lpm"
            className={stepBtnClass}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            id="slider-hr"
            type="range"
            min={0}
            max={220}
            step={1}
            value={targetHrDisplay}
            onChange={(e) => handleHrDirect(Number(e.target.value))}
            style={{ '--slider-accent': isLightMode ? '#16a34a' : '#22c55e' } as React.CSSProperties}
            className="clinical-slider flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={() => handleHrDelta(5)}
            aria-label="Aumentar FC en 5 lpm"
            className={stepBtnClass}
          >
            <Plus className="w-3 h-3" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Ingresar FC exacta en lpm"
            title="Escribir valor exacto de FC (0–220 lpm) y presionar Enter"
            min={0}
            max={220}
            step={1}
            value={hrInput}
            onChange={(e) => setHrInput(e.target.value)}
            onBlur={commitHrInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitHrInput();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setHrInput(String(targetHrDisplay));
                e.currentTarget.blur();
              }
            }}
            className={numericBoxClass}
          />
        </div>

        {/* 2. Saturación (SatO2) */}
        <div className="flex items-center gap-1.5">
          <div className="w-[126px] sm:w-[136px] shrink-0 flex items-baseline justify-between gap-1">
            <label
              htmlFor="slider-spo2"
              title={!sensors.spo2Connected ? 'Monitor: --- (sensor desconectado)' : '40–100%'}
              className={`text-[11px] font-semibold whitespace-nowrap ${
                isLightMode ? 'text-slate-900' : 'text-slate-200'
              }`}
            >
              SatO₂
              {!sensors.spo2Connected && (
                <span
                  className={`ml-1 text-[9.5px] font-mono ${
                    isLightMode ? 'text-amber-700' : 'text-amber-300/80'
                  }`}
                >
                  OFF
                </span>
              )}
            </label>
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span
                className={`text-sm font-mono font-bold tabular-nums leading-none ${
                  !sensors.spo2Connected
                    ? isLightMode
                      ? 'text-slate-400'
                      : 'text-slate-500'
                    : plethColorMode === 'yellow'
                    ? isLightMode
                      ? 'text-amber-600'
                      : 'text-amber-300'
                    : isLightMode
                    ? 'text-sky-700'
                    : 'text-sky-400'
                }`}
              >
                {currentSpo2Display}
              </span>
              {spo2Ramping && (
                <span
                  className={`text-[9.5px] font-mono font-semibold tabular-nums ${
                    isLightMode ? 'text-sky-700' : 'text-sky-300'
                  }`}
                >
                  →{targetSpo2Display}
                </span>
              )}
              <span
                className={`text-[9.5px] font-mono ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                %
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSpo2Delta(-2)}
            aria-label="Disminuir SatO2 en 2 por ciento"
            className={stepBtnClass}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            id="slider-spo2"
            type="range"
            min={40}
            max={100}
            step={1}
            value={targetSpo2Display}
            onChange={(e) => onUpdateVitals({ spo2: Number(e.target.value) }, true)}
            style={{ '--slider-accent': plethAccentHex } as React.CSSProperties}
            className="clinical-slider flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={() => handleSpo2Delta(2)}
            aria-label="Aumentar SatO2 en 2 por ciento"
            className={stepBtnClass}
          >
            <Plus className="w-3 h-3" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Ingresar SatO2 exacta en porcentaje"
            title="Escribir valor exacto de SatO2 (40–100%) y presionar Enter"
            min={40}
            max={100}
            step={1}
            value={spo2Input}
            onChange={(e) => setSpo2Input(e.target.value)}
            onBlur={commitSpo2Input}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitSpo2Input();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setSpo2Input(String(targetSpo2Display));
                e.currentTarget.blur();
              }
            }}
            className={numericBoxClass}
          />
        </div>

        {/* 3. Temperatura (°C) */}
        <div className="flex items-center gap-1.5">
          <div className="w-[126px] sm:w-[136px] shrink-0 flex items-baseline justify-between gap-1">
            <label
              htmlFor="slider-temp"
              title={
                !sensors.tempConnected
                  ? 'Monitor: --.- °C (sensor desconectado)'
                  : isHypothermia
                  ? 'Hipotermia (<36.5 °C)'
                  : '34.0–39.0 °C'
              }
              className={`text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 ${
                isLightMode ? 'text-slate-900' : 'text-slate-200'
              }`}
            >
              <span>Temp</span>
              {!sensors.tempConnected ? (
                <span
                  className={`text-[9.5px] font-mono ${
                    isLightMode ? 'text-amber-700' : 'text-amber-300/80'
                  }`}
                >
                  OFF
                </span>
              ) : isHypothermia ? (
                <AlertTriangle
                  className={`w-3 h-3 shrink-0 ${
                    isLightMode ? 'text-red-600' : 'text-red-400'
                  }`}
                  aria-label="Hipotermia"
                />
              ) : null}
            </label>
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span
                className={`text-sm font-mono font-bold tabular-nums leading-none ${
                  !sensors.tempConnected
                    ? isLightMode
                      ? 'text-slate-400'
                      : 'text-slate-500'
                    : isHypothermia
                    ? isLightMode
                      ? 'text-red-600'
                      : 'text-red-400'
                    : isLightMode
                    ? 'text-amber-700'
                    : 'text-amber-200'
                }`}
              >
                {vitals.temp.toFixed(1)}
              </span>
              {tempRamping && (
                <span
                  className={`text-[9.5px] font-mono font-semibold tabular-nums ${
                    isLightMode ? 'text-sky-700' : 'text-sky-300'
                  }`}
                >
                  →{targetVitals.temp.toFixed(1)}
                </span>
              )}
              <span
                className={`text-[9.5px] font-mono ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                °C
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTempDelta(-0.1)}
            aria-label="Disminuir temperatura en 0.1 grados"
            className={stepBtnClass}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            id="slider-temp"
            type="range"
            min={34.0}
            max={39.0}
            step={0.1}
            value={targetVitals.temp}
            onChange={(e) => onUpdateVitals({ temp: Number(e.target.value) }, true)}
            style={
              {
                '--slider-accent': isHypothermia
                  ? isLightMode
                    ? '#dc2626'
                    : '#ef4444'
                  : isLightMode
                  ? '#d97706'
                  : '#f59e0b',
              } as React.CSSProperties
            }
            className="clinical-slider flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={() => handleTempDelta(0.1)}
            aria-label="Aumentar temperatura en 0.1 grados"
            className={stepBtnClass}
          >
            <Plus className="w-3 h-3" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            aria-label="Ingresar temperatura exacta en grados Celsius"
            title="Escribir valor exacto de Temperatura (34.0–39.0 °C) y presionar Enter"
            min={34.0}
            max={39.0}
            step={0.1}
            value={tempInput}
            onChange={(e) => setTempInput(e.target.value)}
            onBlur={commitTempInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitTempInput();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setTempInput(targetVitals.temp.toFixed(1));
                e.currentTarget.blur();
              }
            }}
            className={numericBoxClass}
          />
        </div>
      </div>

      {/* Compact Rhythm & ECG Lead Selector Row */}
      <div
        className={`pt-1 border-t flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 ${
          isLightMode ? 'border-slate-200' : 'border-slate-800/80'
        }`}
      >
        <div
          role="group"
          aria-label="Tipo de ritmo cardíaco"
          className="grid grid-cols-4 gap-1 flex-1 min-w-0"
        >
          {RHYTHMS.map((rhythm) => {
            const active = targetVitals.rhythm === rhythm;
            const isCritical = rhythm === 'asistolia' || rhythm === 'pea';
            return (
              <button
                key={rhythm}
                type="button"
                onClick={() => onSelectRhythm(rhythm)}
                className={`px-1.5 py-1 text-[10.5px] font-semibold rounded border transition-colors whitespace-nowrap truncate cursor-pointer ${
                  active
                    ? isCritical
                      ? isLightMode
                        ? 'bg-red-100 border-red-500 text-red-900'
                        : 'bg-red-500/20 border-red-500/70 text-red-200'
                      : rhythm === 'bradicardia'
                      ? isLightMode
                        ? 'bg-amber-100 border-amber-500 text-amber-950'
                        : 'bg-amber-500/20 border-amber-500/70 text-amber-200'
                      : isLightMode
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                      : 'bg-emerald-500/20 border-emerald-500/70 text-emerald-200'
                    : isLightMode
                    ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#141C2B] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {RHYTHM_LABELS[rhythm]}
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Derivada ECG"
          className={`grid grid-cols-3 gap-0.5 p-0.5 border rounded shrink-0 ${
            isLightMode
              ? 'bg-slate-100 border-slate-300'
              : 'bg-[#080C12] border-slate-800'
          }`}
        >
          {ECG_LEADS.map((lead) => (
            <button
              key={lead}
              type="button"
              onClick={() => onUpdateVitals({ lead }, false)}
              className={`px-1.5 py-0.5 text-[10.5px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                vitals.lead === lead
                  ? isLightMode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/25 text-emerald-300'
                  : isLightMode
                  ? 'text-slate-600 hover:text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lead}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
