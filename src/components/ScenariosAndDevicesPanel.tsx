import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ExternalLink,
  FlipHorizontal2,
  Mic,
  MicOff,
  RefreshCw,
} from 'lucide-react';
import { NRP_PRESETS } from '../data/nrpPresets';
import {
  HudLayoutMode,
  NrpPreset,
  PlethColorMode,
  RecordingState,
  TransitionDurationSec,
} from '../types/simulation';

interface ScenariosAndDevicesPanelProps {
  isLightMode: boolean;
  activePresetId: string | null;
  transitionDurationSec: TransitionDurationSec;
  plethColorMode: PlethColorMode;
  hudLayout: HudLayoutMode;
  onSelectPreset: (preset: NrpPreset) => void;
  onChangePlethColorMode: (mode: PlethColorMode) => void;
  onChangeHudLayout: (layout: HudLayoutMode) => void;
  onOpenStudentMonitor: () => void;
  studentMonitorBlockedUrl: string | null;
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

export const ScenariosAndDevicesPanel: React.FC<ScenariosAndDevicesPanelProps> = ({
  isLightMode,
  activePresetId,
  transitionDurationSec,
  plethColorMode,
  hudLayout,
  onSelectPreset,
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

  const activePreset = NRP_PRESETS.find((p) => p.id === activePresetId) ?? null;

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden transition-colors ${
        isLightMode
          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
          : 'bg-[#0F1520] border-slate-800 text-slate-100'
      }`}
    >
      <div
        className={`flex-1 min-h-0 overflow-y-auto clinical-scroll divide-y ${
          isLightMode ? 'divide-slate-300' : 'divide-slate-800/90'
        }`}
      >
        {/* ACORDEÓN 1 — Escenarios NRP / Presets clínicos rápidos */}
        <section aria-label="Escenarios NRP">
          <button
            type="button"
            aria-expanded={presetsOpen}
            onClick={() => setPresetsOpen((prev) => !prev)}
            className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
              isLightMode
                ? 'bg-white hover:bg-slate-50'
                : 'bg-[#0E1420] hover:bg-[#131B2B]'
            }`}
          >
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className={`text-[11.5px] font-bold whitespace-nowrap ${
                  isLightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Escenarios NRP
              </span>
              <span
                className={`text-[10.5px] truncate ${
                  isLightMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {activePreset ? activePreset.name : 'Ajuste manual'}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              } ${presetsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {presetsOpen && (
            <div
              className={`p-2 space-y-1.5 ${
                isLightMode ? 'bg-slate-50/90' : 'bg-[#0B1019]'
              }`}
            >
              <div
                className={`flex items-center justify-between text-[10.5px] ${
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
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-1">
                {NRP_PRESETS.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectPreset(preset)}
                      className={`text-left px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                        isActive
                          ? isLightMode
                            ? 'bg-sky-100 border-sky-500 text-sky-950 shadow-xs'
                            : 'bg-sky-500/15 border-sky-500/60 text-slate-100'
                          : isLightMode
                          ? 'bg-white border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50 shadow-xs'
                          : 'bg-[#141C2B] border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-[#192336]'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight truncate">
                        {preset.name}
                      </div>
                      <div
                        className={`text-[9.5px] font-mono tabular-nums mt-0.5 truncate ${
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
            className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
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
              className={`p-3 space-y-3 ${
                isLightMode ? 'bg-slate-50/90' : 'bg-[#0B1019]'
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

              {/* Cámara Web & Micrófono en 2 columnas en escritorio ancho */}
              <div
                className={`grid grid-cols-1 xl:grid-cols-2 gap-3 pt-2 border-t ${
                  isLightMode ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                {/* Cámara Web Selector + Espejo */}
                <div className="space-y-1.5">
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
                        <RefreshCw
                          className={`w-3 h-3 ${isRequestingCamera ? 'animate-spin' : ''}`}
                        />
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
                              isLightMode
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0F1520] text-slate-200'
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
                            isLightMode
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0F1520] text-slate-200'
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
                              isLightMode
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0F1520] text-slate-200'
                            }
                          >
                            {mic.label || `Micrófono ${idx + 1}`}
                          </option>
                        ))
                      )}
                    </select>

                    {/* Real-time Green Audio Level VU Meter */}
                    <div
                      className={`w-16 h-2 border rounded-sm overflow-hidden shrink-0 ${
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
    </div>
  );
};
