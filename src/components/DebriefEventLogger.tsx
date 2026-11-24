import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  Edit3,
  FileText,
  Mic,
  MicOff,
  Plus,
  Tv,
  X,
} from 'lucide-react';
import {
  CRITICAL_ERROR_BUTTON_DARK,
  CRITICAL_ERROR_BUTTON_LIGHT,
  DEBRIEF_MILESTONES,
  DEBRIEF_STAGES,
  STAGE_TIME_TEXT_DARK,
  STAGE_TIME_TEXT_LIGHT,
} from '../data/debriefMilestones';
import { RHYTHM_LABELS } from '../data/nrpPresets';
import { DebriefEvent, DebriefMilestoneDef } from '../types/simulation';
import {
  buildDebriefTextReport,
  downloadDebriefCsv,
  downloadDebriefTxt,
} from '../utils/debriefExport';
import { formatTimerMMSS } from '../utils/hudRenderer';

interface DebriefEventLoggerProps {
  isLightMode: boolean;
  events: DebriefEvent[];
  timerSeconds: number;
  showBannerInVideo: boolean;
  onToggleShowBanner: () => void;
  voiceSupported: boolean;
  voiceEnabled: boolean;
  voiceIsListening: boolean;
  voiceLastTranscript: string;
  voiceError: string | null;
  voiceActiveLang: 'es-CL' | 'es-ES';
  onToggleVoice: () => void;
  onLogMilestone: (milestone: DebriefMilestoneDef) => void;
  onLogCustomNote: (text: string) => void;
  onUpdateEvent: (id: string, patch: { label: string; timerSec: number; note: string }) => void;
  onDeleteEvent: (id: string) => void;
  onClearEvents: () => void;
}

const VOICE_PRIVACY_NOTICE =
  'El video y la bitácora siguen siendo 100 % locales. El reconocimiento de voz usa el motor en línea del navegador (Chrome/Edge).';

function parseMMSS(text: string, fallbackSec: number): number {
  const trimmed = text.trim();
  const match = /^(\d{1,3}):(\d{1,2})$/.exec(trimmed);
  if (!match) return fallbackSec;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  if (Number.isNaN(mins) || Number.isNaN(secs) || secs >= 60) return fallbackSec;
  return mins * 60 + secs;
}

export const DebriefEventLogger: React.FC<DebriefEventLoggerProps> = ({
  isLightMode,
  events,
  timerSeconds,
  showBannerInVideo,
  onToggleShowBanner,
  voiceSupported,
  voiceEnabled,
  voiceIsListening,
  voiceLastTranscript,
  voiceError,
  voiceActiveLang,
  onToggleVoice,
  onLogMilestone,
  onLogCustomNote,
  onUpdateEvent,
  onDeleteEvent,
  onClearEvents,
}) => {
  const [customNoteInput, setCustomNoteInput] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editTimeText, setEditTimeText] = useState('');
  const [editNote, setEditNote] = useState('');

  const milestoneCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (ev.milestoneId) {
        map.set(ev.milestoneId, (map.get(ev.milestoneId) ?? 0) + 1);
      }
    }
    return map;
  }, [events]);

  const criticalErrorCount = useMemo(
    () => events.reduce((acc, ev) => acc + (ev.isCriticalError ? 1 : 0), 0),
    [events]
  );

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customNoteInput.trim();
    if (!cleaned) return;
    onLogCustomNote(cleaned);
    setCustomNoteInput('');
  };

  const handleStartEdit = (ev: DebriefEvent) => {
    setEditingId(ev.id);
    setEditLabel(ev.label);
    setEditTimeText(formatTimerMMSS(ev.timerSec));
    setEditNote(ev.note ?? '');
  };

  const handleSaveEdit = (ev: DebriefEvent) => {
    const cleanedLabel = editLabel.trim() || ev.label;
    const parsedSec = parseMMSS(editTimeText, ev.timerSec);
    onUpdateEvent(ev.id, {
      label: cleanedLabel,
      timerSec: parsedSec,
      note: editNote.trim(),
    });
    setEditingId(null);
  };

  const handleCopySummary = async () => {
    const report = buildDebriefTextReport(events, timerSeconds);
    try {
      await navigator.clipboard.writeText(report);
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = report;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2200);
    }
  };

  const evalStage = DEBRIEF_STAGES.find((s) => s.id === 'evaluacion')!;
  const inicialStage = DEBRIEF_STAGES.find((s) => s.id === 'inicial')!;
  const viaAereaStage = DEBRIEF_STAGES.find((s) => s.id === 'via-aerea')!;
  const circulacionStage = DEBRIEF_STAGES.find((s) => s.id === 'circulacion')!;
  const farmacosStage = DEBRIEF_STAGES.find((s) => s.id === 'farmacos')!;
  const especialesStage = DEBRIEF_STAGES.find((s) => s.id === 'especiales')!;

  const evalPalette = isLightMode ? evalStage.light : evalStage.dark;
  const criticalPalette = isLightMode ? CRITICAL_ERROR_BUTTON_LIGHT : CRITICAL_ERROR_BUTTON_DARK;
  const evalMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'evaluacion');
  const inicialMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'inicial');
  const viaAereaMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'via-aerea');
  const circulacionMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'circulacion');
  const farmacosMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'farmacos');
  const farmacosStandard = farmacosMilestones.filter((m) => !m.isCriticalError);
  const farmacosErrors = farmacosMilestones.filter((m) => m.isCriticalError);
  const especialesMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'especiales');
  const stageTimeClasses = isLightMode ? STAGE_TIME_TEXT_LIGHT : STAGE_TIME_TEXT_DARK;

  const renderStageButton = (
    milestone: DebriefMilestoneDef,
    stagePalette: {
      buttonIdleClass: string;
      buttonActiveClass: string;
      badgeTextClass: string;
    },
    isEvalBlock = false
  ) => {
    const count = milestoneCounts.get(milestone.id) ?? 0;
    const executed = count > 0;
    const isCritical = Boolean(milestone.isCriticalError);
    const isInitialQ = milestone.id === 'preguntas-iniciales-ok';

    return (
      <button
        key={milestone.id}
        type="button"
        title={isCritical ? `[ERROR GRAVE] ${milestone.label}` : milestone.label}
        onClick={() => onLogMilestone(milestone)}
        className={`w-full px-1.5 py-0.5 rounded text-left text-[10.5px] leading-tight transition-colors flex items-center justify-between gap-1 cursor-pointer min-h-[24px] ${
          isCritical
            ? executed
              ? criticalPalette.active
              : criticalPalette.idle
            : `border font-medium ${
                executed ? stagePalette.buttonActiveClass : stagePalette.buttonIdleClass
              }`
        }`}
      >
        <span className="flex items-center gap-1 min-w-0">
          {isCritical && (
            <AlertTriangle
              className={`w-2.5 h-2.5 shrink-0 ${
                isLightMode ? 'text-red-600' : 'text-red-400'
              }`}
            />
          )}
          <span className="leading-[1.15]">{milestone.label}</span>
        </span>
        {executed &&
          (isCritical ? (
            <span
              className={`inline-flex items-center px-1 py-0.5 rounded border text-[9px] font-mono font-bold tabular-nums leading-none shrink-0 ${criticalPalette.badge}`}
            >
              ×{count}
            </span>
          ) : isEvalBlock ? (
            <span
              className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9px] font-mono font-bold tabular-nums leading-none shrink-0 ${
                isLightMode
                  ? 'bg-indigo-200/80 border-indigo-400 text-indigo-950'
                  : 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
              }`}
            >
              {isInitialQ && <Check className="w-2.5 h-2.5" />}
              <span>×{count}</span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] font-mono font-bold tabular-nums shrink-0 ${stagePalette.badgeTextClass}`}
            >
              <Check className="w-2.5 h-2.5" />
              {count > 1 && <span>×{count}</span>}
            </span>
          ))}
      </button>
    );
  };

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden transition-colors ${
        isLightMode
          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
          : 'bg-[#0F1520] border-slate-800 text-slate-100'
      }`}
    >
      {/* Ultra-Compact Module Header + Banner Toggle + Export Bar */}
      <div
        className={`shrink-0 px-2 py-1 border-b flex flex-wrap items-center justify-between gap-1 ${
          isLightMode
            ? 'bg-slate-50 border-slate-200'
            : 'bg-[#0B1019] border-slate-800/90'
        }`}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <h2
            className={`text-[11px] font-bold whitespace-nowrap ${
              isLightMode ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            Registro de Eventos
          </h2>
          <span
            className={`text-[10px] font-mono tabular-nums whitespace-nowrap ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {events.length} {events.length === 1 ? 'hito' : 'hitos'}
          </span>
          {criticalErrorCount > 0 && (
            <span
              className={`text-[10px] font-mono font-bold tabular-nums whitespace-nowrap ${
                isLightMode ? 'text-red-700' : 'text-red-400'
              }`}
            >
              · {criticalErrorCount} {criticalErrorCount === 1 ? 'error' : 'errores'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {/* Optional Automatic Voice Recognition (Beta) Toggle */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              role="switch"
              aria-checked={voiceSupported ? voiceEnabled : false}
              disabled={!voiceSupported}
              onClick={onToggleVoice}
              title={voiceSupported ? VOICE_PRIVACY_NOTICE : 'Solo disponible en Chrome/Edge'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors whitespace-nowrap ${
                !voiceSupported
                  ? isLightMode
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#101622] border-slate-800 text-slate-500 cursor-not-allowed'
                  : voiceEnabled
                  ? isLightMode
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 cursor-pointer'
                    : 'bg-emerald-500/15 border-emerald-500/65 text-emerald-200 cursor-pointer'
                  : isLightMode
                  ? 'bg-white border-slate-300 text-slate-700 hover:text-slate-950 cursor-pointer'
                  : 'bg-[#141C2B] border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer'
              }`}
            >
              {voiceSupported ? (
                <Mic
                  className={`w-2.5 h-2.5 shrink-0 ${
                    voiceEnabled
                      ? voiceIsListening
                        ? isLightMode
                          ? 'text-emerald-600 animate-pulse'
                          : 'text-emerald-400 animate-pulse'
                        : isLightMode
                        ? 'text-amber-600'
                        : 'text-amber-400'
                      : ''
                  }`}
                />
              ) : (
                <MicOff className="w-2.5 h-2.5 shrink-0" />
              )}
              <span>Voz (Beta)</span>
              <span
                className={`inline-flex items-center w-4 h-2.5 rounded-full p-0.5 transition-colors ${
                  voiceSupported && voiceEnabled
                    ? isLightMode
                      ? 'bg-emerald-600 justify-end'
                      : 'bg-emerald-500 justify-end'
                    : isLightMode
                    ? 'bg-slate-300 justify-start'
                    : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
              </span>
            </button>
            {!voiceSupported && (
              <span
                className={`text-[9px] whitespace-nowrap ${
                  isLightMode ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                Solo disponible en Chrome/Edge
              </span>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={showBannerInVideo}
            onClick={onToggleShowBanner}
            title="Mostrar subtítulo de 3 segundos en el video al registrar un hito o error grave"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showBannerInVideo
                ? isLightMode
                  ? 'bg-sky-100 border-sky-400 text-sky-950'
                  : 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                : isLightMode
                ? 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'
                : 'bg-[#141C2B] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-2.5 h-2.5 shrink-0" />
            <span>Banner 3s</span>
            <span
              className={`inline-flex items-center w-4 h-2.5 rounded-full p-0.5 transition-colors ${
                showBannerInVideo
                  ? isLightMode
                    ? 'bg-sky-600 justify-end'
                    : 'bg-sky-500 justify-end'
                  : isLightMode
                  ? 'bg-slate-300 justify-start'
                  : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white block" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadDebriefCsv(events, timerSeconds)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Download className={`w-2.5 h-2.5 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`} />
            .CSV
          </button>

          <button
            type="button"
            onClick={() => downloadDebriefTxt(events, timerSeconds)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText
              className={`w-2.5 h-2.5 ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'}`}
            />
            .TXT
          </button>

          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              copiedFeedback
                ? isLightMode
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                  : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                : isLightMode
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
            }`}
          >
            {copiedFeedback ? (
              <>
                <Check className="w-2.5 h-2.5" />
                Copiado
              </>
            ) : (
              <>
                <ClipboardCopy
                  className={`w-2.5 h-2.5 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}
                />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Discreet Live Voice Transcript & Local Privacy Strip (visible only when Voz (Beta) is active or errored) */}
      {(voiceEnabled || voiceError) && (
        <div
          className={`shrink-0 px-2 py-0.5 border-b space-y-0.5 ${
            voiceError
              ? isLightMode
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : isLightMode
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-emerald-950/25 border-emerald-500/25 text-emerald-100'
          }`}
        >
          {voiceEnabled && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  voiceIsListening ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[9.5px] font-mono truncate flex-1 leading-tight ${
                  isLightMode ? 'text-emerald-900' : 'text-emerald-200'
                }`}
                title={voiceLastTranscript || undefined}
              >
                {voiceLastTranscript
                  ? `Escuchando (${voiceActiveLang}): "${voiceLastTranscript}"`
                  : `Escuchando (${voiceActiveLang})… esperando comandos clínicos PRN`}
              </span>
            </div>
          )}

          {voiceError ? (
            <p className="text-[9px] leading-tight truncate">{voiceError}</p>
          ) : (
            <p
              className={`text-[9px] leading-tight truncate ${
                isLightMode ? 'text-emerald-800/85' : 'text-emerald-300/75'
              }`}
              title={VOICE_PRIVACY_NOTICE}
            >
              {VOICE_PRIVACY_NOTICE}
            </p>
          )}
        </div>
      )}

      {/* Fixed Compact Button Matrix (Never pushed away by the log below) */}
      <div
        className={`shrink-0 p-1.5 space-y-1.5 border-b lg:max-h-[76%] lg:overflow-y-auto clinical-scroll ${
          isLightMode ? 'border-slate-200' : 'border-slate-800/80'
        }`}
      >
        {/* Block 1: Evaluación y Preguntas Clave (3x3 exact grid: 5 questions + 4 critical errors) */}
        <div
          className={`rounded border px-1.5 py-1 space-y-1 ${
            isLightMode
              ? 'bg-indigo-50/70 border-indigo-200'
              : 'bg-indigo-500/[0.06] border-indigo-500/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${evalPalette.headerTextClass}`}
            >
              {evalStage.title}
            </span>
            <span
              className={`text-[9px] font-mono leading-none ${
                isLightMode ? 'text-indigo-700' : 'text-indigo-300/75'
              }`}
            >
              1 clic · marco rojo = error grave
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {evalMilestones.map((m) => renderStageButton(m, evalPalette, true))}
          </div>
        </div>

        {/* Block 2: Balanced 3-Column Row (Inicial + Especiales | Vía Aérea | Circulación) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {/* Column 1: Inicial (3) + Procedimientos Especiales (1) */}
          <div className="space-y-1.5">
            <div className="space-y-0.5">
              <div
                className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${
                  (isLightMode ? inicialStage.light : inicialStage.dark).headerTextClass
                }`}
              >
                {inicialStage.title}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {inicialMilestones.map((m) =>
                  renderStageButton(m, isLightMode ? inicialStage.light : inicialStage.dark)
                )}
              </div>
            </div>

            <div className="space-y-0.5">
              <div
                className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${
                  (isLightMode ? especialesStage.light : especialesStage.dark).headerTextClass
                }`}
              >
                {especialesStage.title}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {especialesMilestones.map((m) =>
                  renderStageButton(m, isLightMode ? especialesStage.light : especialesStage.dark)
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Vía Aérea / Ventilación (5) */}
          <div className="space-y-0.5">
            <div
              className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${
                (isLightMode ? viaAereaStage.light : viaAereaStage.dark).headerTextClass
              }`}
            >
              {viaAereaStage.title}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {viaAereaMilestones.map((m) =>
                renderStageButton(m, isLightMode ? viaAereaStage.light : viaAereaStage.dark)
              )}
            </div>
          </div>

          {/* Column 3: Circulación / Accesos (5) */}
          <div className="space-y-0.5">
            <div
              className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${
                (isLightMode ? circulacionStage.light : circulacionStage.dark).headerTextClass
              }`}
            >
              {circulacionStage.title}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {circulacionMilestones.map((m) =>
                renderStageButton(m, isLightMode ? circulacionStage.light : circulacionStage.dark)
              )}
            </div>
          </div>
        </div>

        {/* Block 3: Fármacos / Volumen (5 compact buttons in 1 row + 2 full-legibility red errors below) */}
        <div className="space-y-1">
          <div
            className={`text-[9.5px] font-bold tracking-wide uppercase leading-none ${
              (isLightMode ? farmacosStage.light : farmacosStage.dark).headerTextClass
            }`}
          >
            {farmacosStage.title}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
            {farmacosStandard.map((m) =>
              renderStageButton(m, isLightMode ? farmacosStage.light : farmacosStage.dark)
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {farmacosErrors.map((m) =>
              renderStageButton(m, isLightMode ? farmacosStage.light : farmacosStage.dark)
            )}
          </div>
        </div>

        {/* Compact Free-Text Optional Note Bar */}
        <form onSubmit={handleSubmitNote} className="flex items-center gap-1">
          <input
            type="text"
            value={customNoteInput}
            onChange={(e) => setCustomNoteInput(e.target.value)}
            placeholder="Nota rápida opcional (ej. Cambio mascarilla, ajuste PEEP)..."
            className={`flex-1 h-6 px-2 rounded border text-[10.5px] focus:outline-none focus:border-sky-500 ${
              isLightMode
                ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                : 'bg-[#080C12] border-slate-800 text-slate-100 placeholder:text-slate-500'
            }`}
          />
          <button
            type="submit"
            disabled={customNoteInput.trim().length === 0}
            className={`h-6 px-2 inline-flex items-center gap-1 rounded border text-[10.5px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isLightMode
                ? 'bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200'
                : 'bg-[#141C2B] border-slate-700 text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3 h-3" />
            Nota
          </button>
        </form>
      </div>

      {/* Dedicated Scrollable Chronological Event Log (Independent overflow-y-auto) */}
      <div className="flex-1 min-h-[82px] flex flex-col overflow-hidden">
        <div
          className={`px-2 py-0.5 flex items-center justify-between gap-2 border-b shrink-0 ${
            isLightMode
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0B1019] border-slate-800/70'
          }`}
        >
          <span
            className={`text-[10px] font-semibold ${
              isLightMode ? 'text-slate-700' : 'text-slate-300'
            }`}
          >
            Bitácora de Eventos Registrados ({events.length})
          </span>

          {events.length > 0 &&
            (confirmClear ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onClearEvents();
                    setConfirmClear(false);
                    setEditingId(null);
                  }}
                  className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9.5px] font-semibold hover:bg-red-500 cursor-pointer whitespace-nowrap"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className={`px-1.5 py-0.5 rounded border text-[9.5px] cursor-pointer ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      : 'border-slate-700 bg-[#141C2B] text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isLightMode
                    ? 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                    : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                }`}
              >
                Limpiar bitácora
              </button>
            ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto clinical-scroll">
          {events.length === 0 ? (
            <div className="px-3 py-2 text-center text-[10.5px] text-slate-500">
              Presiona cualquier botón superior para registrar tiempo MM:SS y signos vitales activos.
            </div>
          ) : (
            <div
              className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-slate-800/70'}`}
            >
              {[...events].reverse().map((ev, revIdx) => {
                const chronologicalNum = events.length - revIdx;
                const isEditing = editingId === ev.id;
                const isCritical = Boolean(ev.isCriticalError);
                const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
                const noPulse = ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea';
                const spo2Display = noPulse ? '--' : `${Math.round(ev.vitals.spo2)}%`;

                if (isEditing) {
                  return (
                    <div
                      key={ev.id}
                      className={`px-2 py-1 space-y-1 ${
                        isLightMode ? 'bg-slate-50' : 'bg-[#121B2B]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          aria-label="Editar tiempo MM:SS"
                          value={editTimeText}
                          onChange={(e) => setEditTimeText(e.target.value)}
                          className={`w-14 h-6 px-1.5 rounded border font-mono text-[10.5px] tabular-nums ${
                            isLightMode
                              ? 'bg-white border-slate-300 text-slate-900'
                              : 'bg-[#080C12] border-slate-700 text-slate-100'
                          }`}
                        />
                        <input
                          type="text"
                          aria-label="Editar nombre del hito"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className={`flex-1 min-w-0 h-6 px-1.5 rounded border text-[10.5px] ${
                            isLightMode
                              ? 'bg-white border-slate-300 text-slate-900'
                              : 'bg-[#080C12] border-slate-700 text-slate-100'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          aria-label="Observación adicional"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Observación breve (opcional)"
                          className={`flex-1 min-w-0 h-6 px-1.5 rounded border text-[10.5px] ${
                            isLightMode
                              ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                              : 'bg-[#080C12] border-slate-700 text-slate-200 placeholder:text-slate-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(ev)}
                          className={`h-6 px-2 rounded text-[10px] font-semibold cursor-pointer shrink-0 ${
                            isLightMode
                              ? 'bg-sky-600 text-white hover:bg-sky-700'
                              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          }`}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancelar edición"
                          className={`h-6 px-1.5 rounded border cursor-pointer shrink-0 ${
                            isLightMode
                              ? 'border-slate-300 text-slate-600 hover:bg-slate-200'
                              : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={ev.id}
                    className={`px-2 py-0.5 flex items-center justify-between gap-1.5 transition-colors ${
                      isCritical
                        ? isLightMode
                          ? 'bg-red-50/90 hover:bg-red-100/80 border-l-4 border-l-red-600'
                          : 'bg-red-950/35 hover:bg-red-950/55 border-l-4 border-l-red-500'
                        : isLightMode
                        ? 'hover:bg-slate-50'
                        : 'hover:bg-[#131C2B]/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className={`text-[9.5px] font-mono tabular-nums shrink-0 ${
                          isCritical
                            ? isLightMode
                              ? 'text-red-600 font-semibold'
                              : 'text-red-400 font-semibold'
                            : isLightMode
                            ? 'text-slate-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {String(chronologicalNum).padStart(2, '0')}
                      </span>

                      <span
                        className={`font-mono text-[10.5px] font-bold tabular-nums shrink-0 ${
                          isCritical
                            ? isLightMode
                              ? 'text-red-700'
                              : 'text-red-400'
                            : stageTimeClasses[ev.stage]
                        }`}
                      >
                        {formatTimerMMSS(ev.timerSec)}
                      </span>

                      {isCritical && (
                        <span
                          className={`px-1 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase tracking-tight leading-none shrink-0 ${
                            isLightMode
                              ? 'bg-red-600 text-white'
                              : 'bg-red-500/25 border border-red-500/70 text-red-200'
                          }`}
                        >
                          ERROR GRAVE
                        </span>
                      )}

                      {ev.triggeredByVoice && (
                        <span
                          title="Evento detectado automáticamente por reconocimiento de voz"
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[8.5px] font-mono font-bold leading-none shrink-0 ${
                            isLightMode
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                              : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          <Mic className="w-2 h-2 shrink-0" />
                          <span>[VOZ]</span>
                        </span>
                      )}

                      <span
                        className={`text-[10.5px] font-semibold truncate ${
                          isCritical
                            ? isLightMode
                              ? 'text-red-950'
                              : 'text-red-100'
                            : isLightMode
                            ? 'text-slate-900'
                            : 'text-slate-100'
                        }`}
                        title={ev.label}
                      >
                        {ev.label}
                      </span>

                      {ev.note && (
                        <span
                          className={`text-[10px] truncate hidden md:inline ${
                            isCritical
                              ? isLightMode
                                ? 'text-red-800'
                                : 'text-red-300/80'
                              : isLightMode
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          — {ev.note}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className={`text-[9.5px] font-mono tabular-nums flex items-center gap-1 ${
                          isLightMode ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={
                            isLightMode
                              ? 'text-emerald-700 font-semibold'
                              : 'text-emerald-400 font-medium'
                          }
                        >
                          FC {hrDisplay}
                        </span>
                        <span
                          className={isLightMode ? 'text-slate-300' : 'text-slate-600'}
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span
                          className={
                            isLightMode ? 'text-sky-700 font-semibold' : 'text-sky-400 font-medium'
                          }
                        >
                          {spo2Display}
                        </span>
                        <span
                          className={isLightMode ? 'text-slate-300' : 'text-slate-600'}
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span
                          className={
                            ev.vitals.temp < 36.5
                              ? isLightMode
                                ? 'text-red-600 font-semibold'
                                : 'text-red-400 font-medium'
                              : isLightMode
                              ? 'text-amber-700 font-semibold'
                              : 'text-amber-200 font-medium'
                          }
                        >
                          {ev.vitals.temp.toFixed(1)}°C
                        </span>
                        <span
                          className={`hidden 2xl:inline ${
                            isLightMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span
                          className={`hidden 2xl:inline ${
                            isLightMode ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          {RHYTHM_LABELS[ev.vitals.rhythm]}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(ev)}
                          aria-label={`Corregir ${ev.label}`}
                          title="Corregir evento o tiempo"
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            isLightMode
                              ? 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'
                              : 'text-slate-400 hover:text-sky-300 hover:bg-sky-500/10'
                          }`}
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(ev.id)}
                          aria-label={`Eliminar ${ev.label}`}
                          title="Eliminar evento (1 clic)"
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            isLightMode
                              ? 'text-slate-500 hover:text-red-700 hover:bg-red-100'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/15'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
