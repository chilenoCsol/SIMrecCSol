import React, { useEffect, useState } from 'react';
import {
  Check,
  Circle,
  Download,
  Film,
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
import { DebriefEvent, RecordedClip, RecordingState } from '../types/simulation';
import { formatTimerMMSS } from '../utils/hudRenderer';

interface RecordingToolbarProps {
  isLightMode: boolean;
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
  onDownloadClipWithEvents: (clip: RecordedClip) => void;
  onDeleteClip: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RecordingToolbar: React.FC<RecordingToolbarProps> = ({
  isLightMode,
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
  onDownloadClipWithEvents,
  onDeleteClip,
}) => {
  const [clipsModalOpen, setClipsModalOpen] = useState(false);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [justReset, setJustReset] = useState(false);

  const previewClip = clips.find((c) => c.id === previewClipId) ?? null;
  const latestClip = clips[0] ?? null;

  const needsResetConfirmation = debriefEvents.length > 0 || recordingState !== 'idle';

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
    <div className="shrink-0 space-y-1.5">
      {/* Compact Chronometer + Recording + Scenario Reset Card */}
      <div
        className={`border rounded-lg px-2.5 py-1.5 space-y-1.5 transition-colors ${
          isLightMode
            ? 'bg-white border-slate-300 shadow-xs text-slate-900'
            : 'bg-[#0F1520] border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Compact Clinical Chronometer + Reset / Standalone Play */}
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1.5 leading-none">
              <span
                className={`text-[9.5px] font-mono tracking-wider ${
                  isLightMode ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {recordingState === 'recording' ? (
                  <span className={isLightMode ? 'text-red-600 font-semibold' : 'text-red-400 font-semibold'}>
                    ● REC
                  </span>
                ) : recordingState === 'paused' ? (
                  <span
                    className={
                      isLightMode ? 'text-amber-700 font-semibold' : 'text-amber-300 font-semibold'
                    }
                  >
                    ❚❚ PAUSA
                  </span>
                ) : (
                  'CRONÓMETRO NRP'
                )}
              </span>
              <span
                className={`text-xl xl:text-2xl font-mono font-bold tabular-nums tracking-tight ${
                  isLightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                {formatTimerMMSS(timerSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onResetTimer}
                title="Reiniciar cronómetro a 00:00"
                className={`h-7 px-2 inline-flex items-center gap-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLightMode
                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                    : 'bg-[#141C2B] border-slate-700/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>00:00</span>
              </button>

              {recordingState === 'idle' && (
                <button
                  type="button"
                  onClick={onToggleTimerStandalone}
                  title={timerRunning ? 'Pausar cronómetro' : 'Iniciar solo cronómetro'}
                  className={`h-7 px-2 inline-flex items-center gap-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isLightMode
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                      : 'bg-[#141C2B] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100'
                  }`}
                >
                  {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span className="hidden xl:inline">{timerRunning ? 'Pausar' : 'Cronómetro'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Transport: Iniciar grabación | Reiniciar escenario | Descargar MP4 + Eventos */}
          <div className="flex flex-wrap items-center gap-1.5">
            {recordingState === 'idle' ? (
              <button
                type="button"
                onClick={onStartRecording}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-[11px] font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Circle className="w-3 h-3 fill-current" />
                Iniciar grabación
              </button>
            ) : (
              <>
                {recordingState === 'recording' ? (
                  <button
                    type="button"
                    onClick={onPauseRecording}
                    className={`h-8 inline-flex items-center gap-1 px-2.5 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isLightMode
                        ? 'bg-amber-100 border-amber-500 text-amber-950 hover:bg-amber-200'
                        : 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30'
                    }`}
                  >
                    <Pause className="w-3 h-3" />
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onResumeRecording}
                    className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    Reanudar
                  </button>
                )}

                <button
                  type="button"
                  onClick={onStopRecording}
                  className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isLightMode
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-950 hover:bg-white'
                  }`}
                >
                  <Square className="w-3 h-3 fill-current" />
                  {isMp4Supported ? 'Detener y descargar' : 'Detener'}
                </button>
              </>
            )}

            {/* Clean Scenario Reset Button — right of 'Iniciar grabación' and before 'Descargar MP4 + Eventos' */}
            {confirmingReset ? (
              <div
                className={`h-8 inline-flex items-center gap-1 px-2 rounded-md border shrink-0 ${
                  isLightMode
                    ? 'bg-amber-100 border-amber-500'
                    : 'bg-amber-500/15 border-amber-400/75'
                }`}
              >
                <span
                  className={`text-[10.5px] font-semibold whitespace-nowrap ${
                    isLightMode ? 'text-amber-950' : 'text-amber-100'
                  }`}
                >
                  ¿Reiniciar escenario?
                </span>
                <button
                  type="button"
                  onClick={executeReset}
                  className="h-6 px-2 rounded text-[10.5px] font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  aria-label="Cancelar reinicio de escenario"
                  className={`h-6 w-6 inline-flex items-center justify-center rounded border transition-colors cursor-pointer ${
                    isLightMode
                      ? 'border-amber-500/60 text-amber-950 hover:bg-amber-200/70'
                      : 'border-amber-400/40 text-amber-200 hover:bg-amber-500/20'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClickResetScenario}
                title="Reiniciar cronómetro, bitácora, contadores y signos vitales sin desconectar cámara ni monitor"
                className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  justReset
                    ? isLightMode
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                      : 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : isLightMode
                    ? 'bg-amber-50 border-amber-400 text-amber-950 hover:bg-amber-100'
                    : 'bg-[#171A21] border-amber-500/50 text-amber-200 hover:bg-amber-500/15 hover:border-amber-400/80'
                }`}
              >
                {justReset ? (
                  <>
                    <Check className="w-3 h-3 shrink-0" />
                    Reiniciado
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    Reiniciar escenario
                  </>
                )}
              </button>
            )}

            {/* Paired Video + CSV Events Download Button */}
            {recordingState === 'idle' && latestClip && (
              <button
                type="button"
                onClick={() => onDownloadClipWithEvents(latestClip)}
                title={`Descarga ${latestClip.filename} y ${latestClip.baseName}_eventos.csv`}
                className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLightMode
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                }`}
              >
                <Download className="w-3 h-3 shrink-0" />
                <span>
                  {latestClip.mimeType.toLowerCase().includes('mp4')
                    ? 'Descargar MP4 + Eventos'
                    : 'Descargar Video + Eventos'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tight Mic Status & Format Strip */}
        <div
          className={`pt-1 border-t flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono ${
            isLightMode ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          <div
            className={`flex items-center gap-1.5 ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {micEnabled && hasMicTrack ? (
              <Mic
                className={`w-3 h-3 shrink-0 ${
                  isLightMode ? 'text-emerald-600' : 'text-emerald-400'
                }`}
              />
            ) : (
              <MicOff
                className={`w-3 h-3 shrink-0 ${
                  isLightMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
            )}
            <div
              className={`w-16 h-1.5 rounded-sm overflow-hidden border ${
                isLightMode
                  ? 'bg-slate-200 border-slate-300'
                  : 'bg-slate-900 border-slate-700/70'
              }`}
              title="Nivel de entrada del micrófono"
            >
              <div
                className={`h-full transition-[width] duration-75 ${
                  audioLevel > 0.85
                    ? isLightMode
                      ? 'bg-amber-500'
                      : 'bg-amber-400'
                    : audioLevel > 0.05
                    ? 'bg-emerald-500'
                    : 'bg-emerald-600/60'
                }`}
                style={{
                  width: `${
                    micEnabled && hasMicTrack ? Math.min(100, Math.round(audioLevel * 100)) : 0
                  }%`,
                }}
              />
            </div>
            <span>{micEnabled && hasMicTrack ? 'Mic activo' : 'Sin mic'}</span>
          </div>

          <div className="flex items-center gap-2 tabular-nums">
            <span className={isLightMode ? 'text-slate-600' : 'text-slate-500'}>1280×720 HD</span>
            <span className={isLightMode ? 'text-slate-300' : 'text-slate-700'} aria-hidden="true">
              ·
            </span>
            <span
              title={
                isMp4Supported
                  ? 'Compatible directamente con PowerPoint y reproductores estándar'
                  : 'El navegador no soporta MP4 nativo; respaldo WebM activo'
              }
              className={
                isMp4Supported
                  ? isLightMode
                    ? 'text-emerald-700 font-semibold'
                    : 'text-emerald-400 font-semibold'
                  : isLightMode
                  ? 'text-amber-700 font-semibold'
                  : 'text-amber-300 font-semibold'
              }
            >
              Formato: {detectedFormatLabel}
            </span>

            {clips.length > 0 && (
              <>
                <span
                  className={isLightMode ? 'text-slate-300' : 'text-slate-700'}
                  aria-hidden="true"
                >
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setClipsModalOpen(true)}
                  className={`inline-flex items-center gap-1 hover:underline font-semibold cursor-pointer whitespace-nowrap ${
                    isLightMode ? 'text-sky-700' : 'text-sky-400'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  Grabaciones ({clips.length})
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {recordingError && (
        <div
          className={`px-2.5 py-1.5 rounded-lg border text-xs ${
            isLightMode
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-red-500/10 border-red-500/40 text-red-200'
          }`}
        >
          {recordingError}
        </div>
      )}

      {/* Modal Library for Recorded HD Clips */}
      {clipsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Grabaciones de la sesión"
        >
          <div
            className={`w-full max-w-2xl border rounded-lg overflow-hidden shadow-xl ${
              isLightMode
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#0F1520] border-slate-700 text-slate-100'
            }`}
          >
            <div
              className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${
                isLightMode ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Video
                  className={`w-4 h-4 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}
                />
                <span className="text-xs font-semibold">
                  Grabaciones de la sesión ({clips.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setClipsModalOpen(false)}
                aria-label="Cerrar grabaciones"
                className={`p-1 rounded border cursor-pointer ${
                  isLightMode
                    ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`max-h-[60vh] overflow-y-auto clinical-scroll divide-y ${
                isLightMode ? 'divide-slate-200' : 'divide-slate-800/70'
              }`}
            >
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{clip.filename}</p>
                    <p
                      className={`text-[10.5px] font-mono tabular-nums ${
                        isLightMode ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {formatTimerMMSS(clip.durationSec)} · {formatFileSize(clip.sizeBytes)} ·{' '}
                      {clip.formatLabel} · {clip.createdAt}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setClipsModalOpen(false);
                        setPreviewClipId(clip.id);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                        isLightMode
                          ? 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
                          : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      Reproducir
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadClipWithEvents(clip)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                        isLightMode
                          ? 'bg-sky-600 text-white hover:bg-sky-700'
                          : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                      }`}
                    >
                      <Download className="w-3 h-3" />
                      MP4 + CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (previewClipId === clip.id) setPreviewClipId(null);
                        onDeleteClip(clip.id);
                      }}
                      aria-label={`Eliminar ${clip.filename}`}
                      className={`p-1 rounded cursor-pointer ${
                        isLightMode
                          ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                          : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Player for Recorded HD MP4 Clips */}
      {previewClip && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Reproductor de ${previewClip.filename}`}
        >
          <div
            className={`w-full max-w-4xl border rounded-lg overflow-hidden shadow-2xl ${
              isLightMode
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#0F1520] border-slate-700 text-slate-100'
            }`}
          >
            <div
              className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${
                isLightMode ? 'border-slate-200' : 'border-slate-800'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{previewClip.filename}</p>
                <p
                  className={`text-[11px] font-mono tabular-nums ${
                    isLightMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {formatTimerMMSS(previewClip.durationSec)} ·{' '}
                  {formatFileSize(previewClip.sizeBytes)} · {previewClip.formatLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onDownloadClipWithEvents(previewClip)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    isLightMode
                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar MP4 + Eventos
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewClipId(null)}
                  aria-label="Cerrar reproductor"
                  className={`p-1.5 rounded border cursor-pointer ${
                    isLightMode
                      ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
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
