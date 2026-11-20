import React, { useEffect, useState } from 'react';
import {
  Check,
  Circle,
  Download,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { STAGE_ACCENT_HEX } from '../data/debriefMilestones';
import { DebriefEvent, RecordedClip, RecordingState } from '../types/simulation';
import { formatTimerMMSS } from '../utils/hudRenderer';

interface RecordingToolbarProps {
  recordingState: RecordingState;
  timerSeconds: number;
  timerRunning: boolean;
  micEnabled: boolean;
  hasMicTrack: boolean;
  audioLevel: number; // 0..1
  detectedFormatLabel: string;
  isMp4Supported: boolean;
  recordingError: string | null;
  clips: RecordedClip[];
  debriefEvents: DebriefEvent[];
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
  onResetTimer: () => void;
  onToggleTimerStandalone: () => void;
  onResetScenario: () => void;
  onDownloadClip: (clip: RecordedClip) => void;
  onDeleteClip: (id: string) => void;
  onOpenDebriefLog: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RecordingToolbar: React.FC<RecordingToolbarProps> = ({
  recordingState,
  timerSeconds,
  timerRunning,
  micEnabled,
  hasMicTrack,
  audioLevel,
  detectedFormatLabel,
  isMp4Supported,
  recordingError,
  clips,
  debriefEvents,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onResetTimer,
  onToggleTimerStandalone,
  onResetScenario,
  onDownloadClip,
  onDeleteClip,
  onOpenDebriefLog,
}) => {
  const [bottomTab, setBottomTab] = useState<'events' | 'clips'>('events');
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [justReset, setJustReset] = useState(false);

  const previewClip = clips.find((c) => c.id === previewClipId) ?? null;
  const lastThreeEvents = debriefEvents.slice(-3).reverse();
  const latestClip = clips[0] ?? null;

  const needsResetConfirmation = debriefEvents.length > 0 || recordingState !== 'idle';

  // Auto-dismiss reset confirmation after 6 seconds to avoid accidental stale clicks
  useEffect(() => {
    if (!confirmingReset) return;
    const timeoutId = window.setTimeout(() => setConfirmingReset(false), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [confirmingReset]);

  const executeReset = () => {
    setConfirmingReset(false);
    onResetScenario();
    setJustReset(true);
    window.setTimeout(() => setJustReset(false), 1800);
  };

  const handleClickResetScenario = () => {
    if (needsResetConfirmation) {
      setConfirmingReset(true);
    } else {
      executeReset();
    }
  };

  return (
    <div className="flex flex-col gap-2.5 min-h-0 flex-1">
      {/* Fixed Action Bar: Large MM:SS Stopwatch + Recording Controls */}
      <div className="bg-[#0F1520] border border-slate-800 rounded-lg px-3.5 py-2.5 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Large Clinical Chronometer + Reset / Standalone Play */}
          <div className="flex items-center gap-3">
            <div className="leading-none">
              <div className="text-[10px] font-mono tracking-wider text-slate-400">
                {recordingState === 'recording' ? (
                  <span className="text-red-400 font-semibold">● GRABANDO</span>
                ) : recordingState === 'paused' ? (
                  <span className="text-amber-300 font-semibold">❚❚ PAUSADO</span>
                ) : (
                  'CRONÓMETRO NRP'
                )}
              </div>
              <div className="text-3xl xl:text-4xl font-mono font-bold tabular-nums text-slate-100 mt-0.5 tracking-tight">
                {formatTimerMMSS(timerSeconds)}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onResetTimer}
                title="Reiniciar cronómetro a 00:00"
                className="h-9 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium bg-[#141C2B] border border-slate-700/80 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">00:00</span>
              </button>

              {recordingState === 'idle' && (
                <button
                  type="button"
                  onClick={onToggleTimerStandalone}
                  title={timerRunning ? 'Pausar cronómetro' : 'Iniciar solo cronómetro'}
                  className="h-9 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium bg-[#141C2B] border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span className="hidden xl:inline">{timerRunning ? 'Pausar' : 'Cronómetro'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Recording Transport Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {recordingState === 'idle' ? (
              <button
                type="button"
                onClick={onStartRecording}
                className="h-10 inline-flex items-center gap-2 px-4 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Circle className="w-3.5 h-3.5 fill-current" />
                Iniciar grabación
              </button>
            ) : (
              <>
                {recordingState === 'recording' ? (
                  <button
                    type="button"
                    onClick={onPauseRecording}
                    className="h-10 inline-flex items-center gap-1.5 px-3.5 rounded-md text-xs font-semibold bg-amber-500/20 border border-amber-500/60 text-amber-200 hover:bg-amber-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onResumeRecording}
                    className="h-10 inline-flex items-center gap-1.5 px-3.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Reanudar
                  </button>
                )}

                <button
                  type="button"
                  onClick={onStopRecording}
                  className="h-10 inline-flex items-center gap-2 px-3.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-950 hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  {isMp4Supported ? 'Detener y descargar MP4' : 'Detener y descargar'}
                </button>
              </>
            )}

            {/* Clean Scenario Reset Button — positioned right after 'Iniciar grabación' and before 'Descargar MP4' */}
            {confirmingReset ? (
              <div className="h-10 inline-flex items-center gap-1.5 px-2.5 rounded-md bg-amber-500/15 border border-amber-400/75 shrink-0">
                <span className="text-[11px] font-medium text-amber-100 whitespace-nowrap">
                  ¿Reiniciar escenario?
                </span>
                <button
                  type="button"
                  onClick={executeReset}
                  className="h-7 px-2.5 rounded text-[11px] font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  aria-label="Cancelar reinicio de escenario"
                  className="h-7 w-7 inline-flex items-center justify-center rounded border border-amber-400/40 text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClickResetScenario}
                title="Reiniciar cronómetro, bitácora, contadores y signos vitales sin desconectar cámara ni monitor"
                className={`h-10 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  justReset
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : 'bg-[#171A21] border-amber-500/50 text-amber-200 hover:bg-amber-500/15 hover:border-amber-400/80'
                }`}
              >
                {justReset ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Escenario reiniciado
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    Reiniciar escenario
                  </>
                )}
              </button>
            )}

            {recordingState === 'idle' && latestClip && (
              <button
                type="button"
                onClick={() => onDownloadClip(latestClip)}
                title={`Descargar ${latestClip.filename}`}
                className="h-10 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar {latestClip.mimeType.toLowerCase().includes('mp4') ? 'MP4' : 'Video'}
              </button>
            )}
          </div>
        </div>

        {/* Quiet Telemetry Sub-bar: Live Mic VU + Active Export Format */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            {micEnabled && hasMicTrack ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <div
              className="w-20 h-2 bg-slate-900 rounded-sm overflow-hidden border border-slate-700/70"
              title="Nivel de entrada del micrófono"
            >
              <div
                className={`h-full transition-[width] duration-75 ${
                  audioLevel > 0.85
                    ? 'bg-amber-400'
                    : audioLevel > 0.05
                    ? 'bg-emerald-500'
                    : 'bg-emerald-600/60'
                }`}
                style={{
                  width: `${micEnabled && hasMicTrack ? Math.min(100, Math.round(audioLevel * 100)) : 0}%`,
                }}
              />
            </div>
            <span>{micEnabled && hasMicTrack ? 'Mic activo' : 'Sin mic'}</span>
          </div>

          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-slate-500">1280×720 HD</span>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <span
              title={
                isMp4Supported
                  ? 'Compatible directamente con PowerPoint y reproductores estándar'
                  : 'El navegador no soporta MP4 nativo; respaldo WebM activo'
              }
              className={isMp4Supported ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}
            >
              Formato: {detectedFormatLabel}
            </span>
          </div>
        </div>
      </div>

      {recordingError && (
        <div className="px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-xs text-red-200 shrink-0">
          {recordingError}
        </div>
      )}

      {/* Compact Viewer: Last 3 Recorded Events (with optional Recordings Tab when clips exist) */}
      <div className="bg-[#0F1520] border border-slate-800 rounded-lg flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-800/80 bg-[#0B1019] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {clips.length > 0 ? (
              <div className="inline-flex items-center p-0.5 bg-[#080C12] border border-slate-800 rounded">
                <button
                  type="button"
                  onClick={() => setBottomTab('events')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    bottomTab === 'events'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Últimos 3 eventos ({debriefEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab('clips')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    bottomTab === 'clips'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Grabaciones ({clips.length})
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                  Últimos 3 eventos registrados
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  {debriefEvents.length} total
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenDebriefLog}
            className="text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Abrir bitácora
          </button>
        </div>

        {/* Tab Body */}
        {bottomTab === 'events' || clips.length === 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto clinical-scroll divide-y divide-slate-800/70">
            {lastThreeEvents.length === 0 ? (
              <div className="px-3.5 py-3.5 text-xs text-slate-500 text-center">
                Sin eventos registrados · Marca hitos clínicos en el acordeón de Debriefing (columna
                izquierda).
              </div>
            ) : (
              lastThreeEvents.map((ev) => {
                const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
                const noPulse = ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea';
                const spo2Display = noPulse ? '--' : `${Math.round(ev.vitals.spo2)}%`;
                return (
                  <div
                    key={ev.id}
                    className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-[#131C2B]/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="font-mono text-xs font-bold tabular-nums shrink-0"
                        style={{ color: STAGE_ACCENT_HEX[ev.stage] }}
                      >
                        {formatTimerMMSS(ev.timerSec)}
                      </span>
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {ev.label}
                      </span>
                      {ev.note && (
                        <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                          — {ev.note}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono tabular-nums text-slate-400 flex items-center gap-1.5 shrink-0">
                      <span className="text-emerald-400">FC {hrDisplay}</span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-sky-400">{spo2Display}</span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className={ev.vitals.temp < 36.5 ? 'text-red-400' : 'text-amber-200'}>
                        {ev.vitals.temp.toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto clinical-scroll divide-y divide-slate-800/70">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="px-3.5 py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Video className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-100 truncate">{clip.filename}</p>
                    <p className="text-[10px] font-mono tabular-nums text-slate-400">
                      {formatTimerMMSS(clip.durationSec)} · {formatFileSize(clip.sizeBytes)} ·{' '}
                      {clip.formatLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewClipId(clip.id)}
                    className="px-2 py-1 text-[11px] font-medium rounded border border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    Reproducir
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadClip(clip)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3 h-3" />
                    Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewClipId === clip.id) setPreviewClipId(null);
                      onDeleteClip(clip.id);
                    }}
                    aria-label={`Eliminar ${clip.filename}`}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Player for Recorded HD MP4 Clips (keeps 100vh desktop workspace intact) */}
      {previewClip && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Reproductor de ${previewClip.filename}`}
        >
          <div className="w-full max-w-4xl bg-[#0F1520] border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {previewClip.filename}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-400">
                  {formatTimerMMSS(previewClip.durationSec)} · {formatFileSize(previewClip.sizeBytes)}{' '}
                  · {previewClip.formatLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onDownloadClip(previewClip)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewClipId(null)}
                  aria-label="Cerrar reproductor"
                  className="p-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 bg-black">
              <video
                key={previewClip.url}
                src={previewClip.url}
                controls
                autoPlay
                className="w-full max-h-[72vh] rounded bg-black"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
