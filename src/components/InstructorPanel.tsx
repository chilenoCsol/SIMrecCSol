import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ExternalLink,
  FlipHorizontal2,
  Mic,
  MicOff,
  Minus,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { HYPOTHERMIA_THRESHOLD, NRP_PRESETS, RHYTHM_LABELS } from '../data/nrpPresets';
import {
  CardiacRhythm,
  EcgLead,
  HudLayoutMode,
  NrpPreset,
  PlethColorMode,
  RampStatus,
  RecordingState,
  SensorConnections,
  TransitionDurationSec,
  VitalParams,
} from '../types/simulation';

interface InstructorPanelProps {
  isLightMode: boolean;
  vitals: VitalParams;
  targetVitals: VitalParams;
  sensors: SensorConnections;
  activePresetId: string | null;
  transitionDurationSec: TransitionDurationSec;
  rampStatus: RampStatus;
  plethColorMode: PlethColorMode;
  hudLayout: HudLayoutMode;
  onUpdateVitals: (patch: Partial<VitalParams>, clearPreset?: boolean) => void;
  onToggleSensor: (key: keyof SensorConnections) => void;
  onSetAllSensors: (connected: boolean) => void;
  onSelectRhythm: (rhythm: CardiacRhythm) => void;
  onSelectPreset: (preset: NrpPreset) => void;
  onChangeTransitionDuration: (sec: TransitionDurationSec) => void;
  onApplyRampNow: () => void;
  onChangePlethColorMode: (mode: PlethColorMode) => void;
  onChangeHudLayout: (layout: HudLayoutMode) => void;
  onOpenStudentMonitor: () => void;
  studentMonitorBlockedUrl: string | null;
  // Camera & Microphone device config
  cameras: MediaDeviceInfo[];
  selectedCameraId: string;
  onCameraChange: (deviceId: string) => void;
  microphones: MediaDeviceInfo[];
  selectedMicId: string;
  micAutoMatched: boolean;
  onMicChange: (deviceId: string) => void;
  hasVideoFeed: boolean;
  hasMicTrack: boolean;
  micEnabled: boolean;
  onToggleMicEnabled: () => void;
  audioLevel: number;
  mirrorVideo: boolean;
  onToggleMirrorVideo: () => void;
  isRequestingCamera: boolean;
  onRequestCamera: () => void;
  recordingState: RecordingState;
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
  activePresetId,
  transitionDurationSec,
  rampStatus,
  plethColorMode,
  hudLayout,
  onUpdateVitals,
  onToggleSensor,
  onSetAllSensors,
  onSelectRhythm,
  onSelectPreset,
  onChangeTransitionDuration,
  onApplyRampNow,
  onChangePlethColorMode,
  onChangeHudLayout,
  onOpenStudentMonitor,
  studentMonitorBlockedUrl,
  cameras,
  selectedCameraId,
  onCameraChange,
  microphones,
  selectedMicId,
  micAutoMatched,
  onMicChange,
  hasVideoFeed,
  hasMicTrack,
  micEnabled,
  onToggleMicEnabled,
  audioLevel,
  mirrorVideo,
  onToggleMirrorVideo,
  isRequestingCamera,
  onRequestCamera,
  recordingState,
}) => {
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);

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

  const activePreset = NRP_PRESETS.find((p) => p.id === activePresetId) ?? null;

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

  const handleSpo2Delta = (delta: number) => {
    const next = Math.max(40, Math.min(100, Math.round(targetVitals.spo2 + delta)));
    onUpdateVitals({ spo2: next }, true);
  };

  const handleTempDelta = (delta: number) => {
    const next = Math.max(
      34.0,
      Math.min(39.0, Math.round((targetVitals.temp + delta) * 10) / 10)
    );
    onUpdateVitals({ temp: next }, true);
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
    ? 'w-7 h-7 flex items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-950 shrink-0 cursor-pointer'
    : 'w-7 h-7 flex items-center justify-center rounded border border-slate-700 bg-[#141C2B] text-slate-300 hover:bg-slate-800 hover:text-white shrink-0 cursor-pointer';

  return (
    <aside
      aria-label="Panel de control del instructor"
      className={`w-full h-full flex flex-col min-h-0 transition-colors ${
        isLightMode ? 'bg-slate-100 text-slate-900' : 'bg-[#0B1019] text-slate-100'
      }`}
    >
      {/* SECCIÓN SIEMPRE VISIBLE (Fija arriba): Parámetros Vitales + Rampa + Sensores + Ritmo/Derivada */}
      <div
        className={`shrink-0 border-b px-3.5 py-2.5 space-y-2 transition-colors ${
          isLightMode
            ? 'bg-white border-slate-300 shadow-xs'
            : 'bg-[#0F1520] border-slate-800/90'
        }`}
      >
        {/* Header + 5-Option Physiological Ramp Speed Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className={`text-xs font-bold tracking-wide whitespace-nowrap ${
              isLightMode ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            Parámetros Vitales
          </h2>

          <div
            role="group"
            aria-label="Velocidad de Transición Fisiológica (Rampa)"
            className={`inline-flex items-center gap-0.5 p-0.5 border rounded-md ${
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
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
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
            className={`px-2.5 py-2 rounded-md border space-y-1.5 ${
              isLightMode
                ? 'bg-sky-50 border-sky-300'
                : 'bg-sky-500/10 border-sky-500/45'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
                <span
                  className={`text-[11px] font-mono font-semibold tabular-nums whitespace-nowrap ${
                    isLightMode ? 'text-sky-800' : 'text-sky-200'
                  }`}
                >
                  Rampa ({rampStatus.remainingSec}s restantes)
                </span>
                {rampChanges.length > 0 && (
                  <span
                    className={`text-[11px] font-mono tabular-nums truncate ${
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
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLightMode
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                }`}
              >
                <Zap className="w-3 h-3 fill-current" />
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

        {/* Clinical Sensor Connection Toggles (ECG, SatO2, Temp + Quick All On/Off) */}
        <div
          className={`border rounded-md px-2.5 py-1.5 space-y-1.5 ${
            isLightMode
              ? 'bg-slate-50 border-slate-300'
              : 'bg-[#0B1019] border-slate-800/90'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-semibold ${
                isLightMode ? 'text-slate-700' : 'text-slate-300'
              }`}
            >
              Conexión de Sensores
            </span>
            <div className="flex items-center gap-1.5">
              {!allSensorsConnected && (
                <button
                  type="button"
                  onClick={() => onSetAllSensors(true)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
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
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
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

          <div className="grid grid-cols-3 gap-1.5">
            {/* ECG Sensor Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={sensors.ecgConnected}
              onClick={() => onToggleSensor('ecgConnected')}
              className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-left transition-colors cursor-pointer ${
                sensors.ecgConnected
                  ? isLightMode
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                    : 'bg-emerald-500/15 border-emerald-500/55 text-emerald-200'
                  : isLightMode
                  ? 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                  : 'bg-[#121926] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-[10.5px] font-medium leading-tight truncate">
                ECG Conectado
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
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
                  className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    sensors.ecgConnected ? 'translate-x-3' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>

            {/* SatO2 Sensor Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={sensors.spo2Connected}
              onClick={() => onToggleSensor('spo2Connected')}
              className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-left transition-colors cursor-pointer ${
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
              <span className="text-[10.5px] font-medium leading-tight truncate">
                Sensor SatO2 Conectado
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
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
                  className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    sensors.spo2Connected ? 'translate-x-3' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>

            {/* Temperature Sensor Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={sensors.tempConnected}
              onClick={() => onToggleSensor('tempConnected')}
              className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-left transition-colors cursor-pointer ${
                sensors.tempConnected
                  ? isLightMode
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-amber-500/15 border-amber-500/55 text-amber-200'
                  : isLightMode
                  ? 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                  : 'bg-[#121926] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-[10.5px] font-medium leading-tight truncate">
                Sensor Temp Conectado
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
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
                  className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    sensors.tempConnected ? 'translate-x-3' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Compact Vital Sliders Grid: FC, SatO2, Temperatura */}
        <div className="space-y-2">
          {/* 1. Frecuencia Cardíaca (FC) */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <label
                  htmlFor="slider-hr"
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isLightMode ? 'text-slate-900' : 'text-slate-300'
                  }`}
                >
                  {hrSourceMode === 'ecg'
                    ? 'FC (ECG)'
                    : hrSourceMode === 'spo2'
                    ? 'FP (SpO2)'
                    : 'FC / FP'}
                </label>
                {hrSourceMode === 'none' ? (
                  <span
                    className={`text-[10px] font-mono truncate ${
                      isLightMode ? 'text-amber-700' : 'text-amber-300/80'
                    }`}
                  >
                    Monitor: --- (sin sensor)
                  </span>
                ) : hrSourceMode === 'spo2' ? (
                  <span
                    className={`text-[10px] font-mono truncate ${
                      plethColorMode === 'yellow'
                        ? isLightMode
                          ? 'text-amber-700'
                          : 'text-amber-300/90'
                        : isLightMode
                        ? 'text-sky-700'
                        : 'text-sky-300/90'
                    }`}
                  >
                    Pulso por pletismografía
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-mono ${
                      isLightMode ? 'text-slate-600' : 'text-slate-500'
                    }`}
                  >
                    0–220 lpm
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span
                  className={`text-lg font-mono font-bold tabular-nums leading-none ${
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
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      isLightMode ? 'text-sky-700' : 'text-sky-300'
                    }`}
                  >
                    (→ {targetHrDisplay})
                  </span>
                )}
                <span
                  className={`text-[11px] font-mono ${
                    isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  lpm
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleHrDelta(-5)}
                aria-label="Disminuir FC en 5 lpm"
                className={stepBtnClass}
              >
                <Minus className="w-3.5 h-3.5" />
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
                className="clinical-slider"
              />
              <button
                type="button"
                onClick={() => handleHrDelta(5)}
                aria-label="Aumentar FC en 5 lpm"
                className={stepBtnClass}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Saturación (SatO2) */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <label
                  htmlFor="slider-spo2"
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isLightMode ? 'text-slate-900' : 'text-slate-300'
                  }`}
                >
                  SatO₂
                </label>
                {!sensors.spo2Connected ? (
                  <span
                    className={`text-[10px] font-mono truncate ${
                      isLightMode ? 'text-amber-700' : 'text-amber-300/80'
                    }`}
                  >
                    Monitor: --- (sensor desconectado)
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-mono ${
                      isLightMode ? 'text-slate-600' : 'text-slate-500'
                    }`}
                  >
                    40–100%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span
                  className={`text-lg font-mono font-bold tabular-nums leading-none ${
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
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      isLightMode ? 'text-sky-700' : 'text-sky-300'
                    }`}
                  >
                    (→ {targetSpo2Display})
                  </span>
                )}
                <span
                  className={`text-[11px] font-mono ${
                    isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  %
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSpo2Delta(-2)}
                aria-label="Disminuir SatO2 en 2 por ciento"
                className={stepBtnClass}
              >
                <Minus className="w-3.5 h-3.5" />
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
                className="clinical-slider"
              />
              <button
                type="button"
                onClick={() => handleSpo2Delta(2)}
                aria-label="Aumentar SatO2 en 2 por ciento"
                className={stepBtnClass}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Temperatura (°C) */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <label
                  htmlFor="slider-temp"
                  className={`text-xs font-semibold shrink-0 ${
                    isLightMode ? 'text-slate-900' : 'text-slate-300'
                  }`}
                >
                  Temperatura
                </label>
                {!sensors.tempConnected ? (
                  <span
                    className={`text-[10px] font-mono truncate ${
                      isLightMode ? 'text-amber-700' : 'text-amber-300/80'
                    }`}
                  >
                    Monitor: --.- °C (sensor desconectado)
                  </span>
                ) : isHypothermia ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold truncate ${
                      isLightMode ? 'text-red-600' : 'text-red-400'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Hipotermia (&lt;36.5 °C)
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-mono ${
                      isLightMode ? 'text-slate-600' : 'text-slate-500'
                    }`}
                  >
                    34.0–39.0 °C
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span
                  className={`text-lg font-mono font-bold tabular-nums leading-none ${
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
                    className={`text-[11px] font-mono font-semibold tabular-nums ${
                      isLightMode ? 'text-sky-700' : 'text-sky-300'
                    }`}
                  >
                    (→ {targetVitals.temp.toFixed(1)})
                  </span>
                )}
                <span
                  className={`text-[11px] font-mono ${
                    isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  °C
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTempDelta(-0.1)}
                aria-label="Disminuir temperatura en 0.1 grados"
                className={stepBtnClass}
              >
                <Minus className="w-3.5 h-3.5" />
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
                className="clinical-slider"
              />
              <button
                type="button"
                onClick={() => handleTempDelta(0.1)}
                aria-label="Aumentar temperatura en 0.1 grados"
                className={stepBtnClass}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Compact Rhythm & ECG Lead Selector Row */}
        <div
          className={`pt-1.5 border-t flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 ${
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
                  className={`px-1.5 py-1.5 text-[11px] font-semibold rounded border transition-colors whitespace-nowrap truncate cursor-pointer ${
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
                className={`px-2 py-1 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
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
      </div>

      {/* ZONA DE ACORDEONES COLAPSABLES (Scroll interno independiente en escritorio) */}
      <div
        className={`flex-1 min-h-0 lg:overflow-y-auto clinical-scroll divide-y ${
          isLightMode ? 'divide-slate-300' : 'divide-slate-800/90'
        }`}
      >
        {/* ACORDEÓN 1 — Escenarios NRP */}
        <section aria-label="Escenarios NRP">
          <button
            type="button"
            aria-expanded={presetsOpen}
            onClick={() => setPresetsOpen((prev) => !prev)}
            className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
              isLightMode
                ? 'bg-white hover:bg-slate-50'
                : 'bg-[#0E1420] hover:bg-[#131B2B]'
            }`}
          >
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className={`text-xs font-bold whitespace-nowrap ${
                  isLightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Escenarios NRP
              </span>
              <span
                className={`text-[11px] truncate ${
                  isLightMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {activePreset ? activePreset.name : 'Ajuste manual'}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              } ${presetsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {presetsOpen && (
            <div
              className={`p-3 space-y-2 ${
                isLightMode ? 'bg-slate-100' : 'bg-[#0B1019]'
              }`}
            >
              <div
                className={`flex items-center justify-between text-[11px] ${
                  isLightMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                <span>Presets clínicos rápidos</span>
                <span className="font-mono tabular-nums text-slate-500">
                  Rampa activa:{' '}
                  {transitionDurationSec === 0
                    ? 'Inmediato'
                    : transitionDurationSec === 120
                    ? '2 min'
                    : `${transitionDurationSec} s`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {NRP_PRESETS.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectPreset(preset)}
                      className={`text-left px-2.5 py-2 rounded border transition-colors cursor-pointer ${
                        isActive
                          ? isLightMode
                            ? 'bg-sky-100 border-sky-500 text-sky-950 shadow-xs'
                            : 'bg-sky-500/15 border-sky-500/60 text-slate-100'
                          : isLightMode
                          ? 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50 shadow-xs'
                          : 'bg-[#141C2B] border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-[#192336]'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{preset.name}</div>
                      <div
                        className={`text-[10px] font-mono tabular-nums mt-0.5 truncate ${
                          isLightMode ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {preset.summary}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ACORDEÓN 2 — Configuración de Cámara, Micrófono y Segunda Pantalla */}
        <section aria-label="Configuración de Cámara, Micrófono y Segunda Pantalla">
          <button
            type="button"
            aria-expanded={configOpen}
            onClick={() => setConfigOpen((prev) => !prev)}
            className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
              isLightMode
                ? 'bg-white hover:bg-slate-50'
                : 'bg-[#0E1420] hover:bg-[#131B2B]'
            }`}
          >
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className={`text-xs font-bold truncate ${
                  isLightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Configuración de Cámara, Micrófono y Segunda Pantalla
              </span>
              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline whitespace-nowrap shrink-0">
                {hasVideoFeed ? 'Cám OK' : 'Sin cám'} ·{' '}
                {micEnabled && hasMicTrack ? 'Mic OK' : 'Sin mic'}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              } ${configOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {configOpen && (
            <div
              className={`p-3.5 space-y-3.5 ${
                isLightMode ? 'bg-slate-100' : 'bg-[#0B1019]'
              }`}
            >
              {/* Segunda Pantalla: Monitor para Estudiantes */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={onOpenStudentMonitor}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    isLightMode
                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Abrir Monitor Estudiantes (Nueva Ventana)</span>
                </button>

                {studentMonitorBlockedUrl && (
                  <p
                    className={`text-[11px] leading-snug ${
                      isLightMode ? 'text-amber-800' : 'text-amber-300'
                    }`}
                  >
                    Ventana emergente bloqueada.{' '}
                    <a
                      href={studentMonitorBlockedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`underline font-semibold ${
                        isLightMode
                          ? 'text-sky-700 hover:text-sky-800'
                          : 'text-sky-300 hover:text-sky-200'
                      }`}
                    >
                      Abrir en nueva pestaña aquí
                    </a>
                  </p>
                )}
              </div>

              {/* Cámara Web Selector + Espejo */}
              <div
                className={`space-y-1.5 pt-2 border-t ${
                  isLightMode ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label
                    className={`text-[11px] font-semibold ${
                      isLightMode ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Cámara Web
                  </label>
                  {!hasVideoFeed && (
                    <button
                      type="button"
                      onClick={onRequestCamera}
                      disabled={isRequestingCamera}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium hover:underline cursor-pointer ${
                        isLightMode ? 'text-sky-700' : 'text-sky-400'
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isRequestingCamera ? 'animate-spin' : ''}`} />
                      {isRequestingCamera ? 'Conectando...' : 'Activar cámara'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex-1 flex items-center gap-1.5 border rounded px-2.5 h-8 min-w-0 ${
                      isLightMode
                        ? 'bg-white border-slate-300'
                        : 'bg-[#121A28] border-slate-800'
                    }`}
                  >
                    <Camera
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isLightMode ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    />
                    <select
                      aria-label="Seleccionar cámara"
                      value={selectedCameraId}
                      disabled={recordingState !== 'idle'}
                      onChange={(e) => onCameraChange(e.target.value)}
                      className={`w-full bg-transparent text-xs focus:outline-none truncate cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                        isLightMode ? 'text-slate-900' : 'text-slate-200'
                      }`}
                    >
                      {cameras.length === 0 ? (
                        <option
                          value=""
                          className={
                            isLightMode ? 'bg-white text-slate-900' : 'bg-[#0F1520] text-slate-200'
                          }
                        >
                          Sin cámara detectada
                        </option>
                      ) : (
                        cameras.map((cam, idx) => (
                          <option
                            key={cam.deviceId || idx}
                            value={cam.deviceId}
                            className={
                              isLightMode
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0F1520] text-slate-200'
                            }
                          >
                            {cam.label || `Cámara ${idx + 1}`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleMirrorVideo}
                    title="Invertir cámara horizontalmente"
                    className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mirrorVideo
                        ? isLightMode
                          ? 'bg-sky-100 border-sky-500 text-sky-950'
                          : 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                        : isLightMode
                        ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'bg-[#121A28] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    Espejo
                  </button>
                </div>
              </div>

              {/* Micrófono / Fuente de Audio + Barra VU verde */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    className={`text-[11px] font-semibold ${
                      isLightMode ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    Micrófono / Fuente de Audio
                  </label>
                  {micAutoMatched && (
                    <span
                      className={`text-[10px] font-mono ${
                        isLightMode ? 'text-emerald-700' : 'text-emerald-400'
                      }`}
                    >
                      Vinculado a cámara
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-2 border rounded px-2.5 h-8 ${
                    isLightMode
                      ? 'bg-white border-slate-300'
                      : 'bg-[#121A28] border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={onToggleMicEnabled}
                    disabled={!hasMicTrack}
                    aria-label={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
                    className="shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {micEnabled && hasMicTrack ? (
                      <Mic
                        className={`w-3.5 h-3.5 ${
                          isLightMode ? 'text-emerald-600' : 'text-emerald-400'
                        }`}
                      />
                    ) : (
                      <MicOff
                        className={`w-3.5 h-3.5 ${
                          isLightMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      />
                    )}
                  </button>

                  <select
                    aria-label="Micrófono / Fuente de Audio"
                    value={selectedMicId}
                    disabled={recordingState !== 'idle'}
                    onChange={(e) => onMicChange(e.target.value)}
                    className={`flex-1 min-w-0 bg-transparent text-xs focus:outline-none truncate cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                      isLightMode ? 'text-slate-900' : 'text-slate-200'
                    }`}
                  >
                    {microphones.length === 0 ? (
                      <option
                        value=""
                        className={
                          isLightMode ? 'bg-white text-slate-900' : 'bg-[#0F1520] text-slate-200'
                        }
                      >
                        Sin micrófono detectado
                      </option>
                    ) : (
                      microphones.map((mic, idx) => (
                        <option
                          key={mic.deviceId || idx}
                          value={mic.deviceId}
                          className={
                            isLightMode ? 'bg-white text-slate-900' : 'bg-[#0F1520] text-slate-200'
                          }
                        >
                          {mic.label || `Micrófono ${idx + 1}`}
                        </option>
                      ))
                    )}
                  </select>

                  {/* Real-time Green Audio Level VU Meter */}
                  <div
                    className={`w-20 h-2 border rounded-sm overflow-hidden shrink-0 ${
                      isLightMode
                        ? 'bg-slate-200 border-slate-300'
                        : 'bg-slate-900 border-slate-700/80'
                    }`}
                    title={`Nivel de voz ambiental: ${Math.round(audioLevel * 100)}%`}
                    aria-label="Medidor visual de nivel de audio"
                  >
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        audioLevel > 0.85
                          ? isLightMode
                            ? 'bg-amber-500'
                            : 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${
                          micEnabled && hasMicTrack
                            ? Math.min(100, Math.round(audioLevel * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Opciones de visualización del HUD */}
              <div
                className={`grid grid-cols-2 gap-2 pt-2 border-t ${
                  isLightMode ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <div className="space-y-1">
                  <span
                    className={`block text-[11px] font-semibold ${
                      isLightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    Curva SatO₂
                  </span>
                  <div
                    className={`grid grid-cols-2 gap-0.5 p-0.5 border rounded ${
                      isLightMode
                        ? 'bg-slate-200/80 border-slate-300'
                        : 'bg-[#080C12] border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onChangePlethColorMode('cyan')}
                      className={`py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                        plethColorMode === 'cyan'
                          ? isLightMode
                            ? 'bg-sky-600 text-white'
                            : 'bg-sky-500/25 text-sky-300'
                          : isLightMode
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Celeste
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangePlethColorMode('yellow')}
                      className={`py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                        plethColorMode === 'yellow'
                          ? isLightMode
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-amber-400/25 text-amber-300'
                          : isLightMode
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Amarillo
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span
                    className={`block text-[11px] font-semibold ${
                      isLightMode ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    Posición del HUD
                  </span>
                  <div
                    className={`grid grid-cols-2 gap-0.5 p-0.5 border rounded ${
                      isLightMode
                        ? 'bg-slate-200/80 border-slate-300'
                        : 'bg-[#080C12] border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onChangeHudLayout('side')}
                      className={`py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                        hudLayout === 'side'
                          ? isLightMode
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'bg-slate-800 text-slate-100'
                          : isLightMode
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Lateral
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeHudLayout('top')}
                      className={`py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                        hudLayout === 'top'
                          ? isLightMode
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'bg-slate-800 text-slate-100'
                          : isLightMode
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Superior
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
