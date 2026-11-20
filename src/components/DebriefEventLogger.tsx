import React, { useMemo, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Download,
  Edit3,
  FileText,
  Plus,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import {
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
  onLogMilestone: (milestone: DebriefMilestoneDef) => void;
  onLogCustomNote: (text: string) => void;
  onUpdateEvent: (id: string, patch: { label: string; timerSec: number; note: string }) => void;
  onDeleteEvent: (id: string) => void;
  onClearEvents: () => void;
}

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
  const evalPalette = isLightMode ? evalStage.light : evalStage.dark;
  const interventionStages = DEBRIEF_STAGES.filter((s) => s.id !== 'evaluacion');
  const evalMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === 'evaluacion');
  const stageTimeClasses = isLightMode ? STAGE_TIME_TEXT_LIGHT : STAGE_TIME_TEXT_DARK;

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden transition-colors ${
        isLightMode
          ? 'bg-white border-slate-300 shadow-xs text-slate-900'
          : 'bg-[#0F1520] border-slate-800 text-slate-100'
      }`}
    >
      {/* Compact Module Header + Banner Toggle + Export Bar */}
      <div
        className={`shrink-0 px-2.5 py-1.5 border-b flex flex-wrap items-center justify-between gap-1.5 ${
          isLightMode
            ? 'bg-slate-50 border-slate-200'
            : 'bg-[#0B1019] border-slate-800/90'
        }`}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <h2
            className={`text-[11.5px] font-bold whitespace-nowrap ${
              isLightMode ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            Registro de Eventos para Debriefing
          </h2>
          <span
            className={`text-[10.5px] font-mono tabular-nums whitespace-nowrap ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {events.length} {events.length === 1 ? 'hito' : 'hitos'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={showBannerInVideo}
            onClick={onToggleShowBanner}
            title="Mostrar subtítulo de 3 segundos en el video al registrar un hito"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              showBannerInVideo
                ? isLightMode
                  ? 'bg-sky-100 border-sky-400 text-sky-950'
                  : 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                : isLightMode
                ? 'bg-white border-slate-300 text-slate-700 hover:text-slate-950'
                : 'bg-[#141C2B] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3 h-3 shrink-0" />
            <span>Banner 3s</span>
            <span
              className={`inline-flex items-center w-5 h-3 rounded-full p-0.5 transition-colors ${
                showBannerInVideo
                  ? isLightMode
                    ? 'bg-sky-600 justify-end'
                    : 'bg-sky-500 justify-end'
                  : isLightMode
                  ? 'bg-slate-300 justify-start'
                  : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white block" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadDebriefCsv(events, timerSeconds)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Download className={`w-3 h-3 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`} />
            .CSV
          </button>

          <button
            type="button"
            onClick={() => downloadDebriefTxt(events, timerSeconds)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-slate-700 bg-[#141C2B] text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText
              className={`w-3 h-3 ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'}`}
            />
            .TXT
          </button>

          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
                <Check className="w-3 h-3" />
                Copiado
              </>
            ) : (
              <>
                <ClipboardCopy
                  className={`w-3 h-3 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}
                />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Inner Area: Compact 3-Column Buttons directly above Chronological Log */}
      <div
        className={`flex-1 min-h-0 flex flex-col overflow-y-auto clinical-scroll divide-y ${
          isLightMode ? 'divide-slate-200' : 'divide-slate-800/80'
        }`}
      >
        {/* Compact 19-Button Milestone Grid + Optional Note Input */}
        <div className="p-2 space-y-1.5 shrink-0">
          {/* Differentiated Top Block: Evaluación y Preguntas Clave (5 buttons, compact 3-col grid) */}
          <div
            className={`rounded-md border px-2 py-1.5 space-y-1 ${
              isLightMode
                ? 'bg-indigo-50/70 border-indigo-200'
                : 'bg-indigo-500/[0.06] border-indigo-500/25'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-bold tracking-wide uppercase ${evalPalette.headerTextClass}`}
              >
                {evalStage.title}
              </span>
              <span
                className={`text-[9.5px] font-mono ${
                  isLightMode ? 'text-indigo-700' : 'text-indigo-300/70'
                }`}
              >
                1 clic · repetible
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {evalMilestones.map((milestone) => {
                const count = milestoneCounts.get(milestone.id) ?? 0;
                const executed = count > 0;
                const isInitialQ = milestone.id === 'preguntas-iniciales-ok';
                return (
                  <button
                    key={milestone.id}
                    type="button"
                    title={milestone.label}
                    onClick={() => onLogMilestone(milestone)}
                    className={`w-full px-2 py-1 rounded border text-left text-[10.5px] font-medium leading-tight transition-colors flex items-center justify-between gap-1 cursor-pointer ${
                      executed ? evalPalette.buttonActiveClass : evalPalette.buttonIdleClass
                    }`}
                  >
                    <span className="truncate">{milestone.label}</span>
                    {executed && (
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9.5px] font-mono font-bold tabular-nums leading-none shrink-0 ${
                          isLightMode
                            ? 'bg-indigo-200/80 border-indigo-400 text-indigo-950'
                            : 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
                        }`}
                      >
                        {isInitialQ && <Check className="w-2.5 h-2.5" />}
                        <span>×{count}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 14 NRP Clinical Interventions in Compact Multi-Column Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-2 gap-y-1.5">
            {interventionStages.map((stage) => {
              const stagePalette = isLightMode ? stage.light : stage.dark;
              const stageMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === stage.id);
              const isFarmacos = stage.id === 'farmacos';
              return (
                <div
                  key={stage.id}
                  className={`space-y-1 ${isFarmacos ? 'sm:col-span-2' : ''}`}
                >
                  <div
                    className={`text-[10px] font-bold tracking-wide uppercase ${stagePalette.headerTextClass}`}
                  >
                    {stage.title}
                  </div>
                  <div
                    className={
                      isFarmacos
                        ? 'grid grid-cols-2 sm:grid-cols-3 gap-1'
                        : 'grid grid-cols-2 sm:grid-cols-1 gap-1'
                    }
                  >
                    {stageMilestones.map((milestone) => {
                      const count = milestoneCounts.get(milestone.id) ?? 0;
                      const executed = count > 0;
                      return (
                        <button
                          key={milestone.id}
                          type="button"
                          title={milestone.label}
                          onClick={() => onLogMilestone(milestone)}
                          className={`w-full px-2 py-1 rounded border text-left text-[10.5px] font-medium leading-tight transition-colors flex items-center justify-between gap-1 cursor-pointer ${
                            executed ? stagePalette.buttonActiveClass : stagePalette.buttonIdleClass
                          }`}
                        >
                          <span className="truncate">{milestone.label}</span>
                          {executed && (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[9.5px] font-mono font-bold tabular-nums shrink-0 ${stagePalette.badgeTextClass}`}
                            >
                              <Check className="w-2.5 h-2.5" />
                              {count > 1 && <span>×{count}</span>}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compact Free-Text Optional Note Bar */}
          <form onSubmit={handleSubmitNote} className="flex items-center gap-1.5 pt-0.5">
            <input
              type="text"
              value={customNoteInput}
              onChange={(e) => setCustomNoteInput(e.target.value)}
              placeholder="Nota rápida opcional (ej. Cambio mascarilla, ajuste PEEP)..."
              className={`flex-1 h-7 px-2 rounded border text-[11px] focus:outline-none focus:border-sky-500 ${
                isLightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-[#080C12] border-slate-800 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            <button
              type="submit"
              disabled={customNoteInput.trim().length === 0}
              className={`h-7 px-2.5 inline-flex items-center gap-1 rounded border text-[11px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

        {/* Chronological Event Log Directly Beneath Buttons */}
        <div className="flex-1 min-h-[92px] flex flex-col">
          <div
            className={`px-2.5 py-1 flex items-center justify-between gap-2 border-b shrink-0 ${
              isLightMode
                ? 'bg-slate-50 border-slate-200'
                : 'bg-[#0B1019] border-slate-800/70'
            }`}
          >
            <span
              className={`text-[10.5px] font-semibold ${
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
                    className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-500 cursor-pointer whitespace-nowrap"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
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
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isLightMode
                      ? 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                      : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                >
                  Limpiar bitácora
                </button>
              ))}
          </div>

          {events.length === 0 ? (
            <div className="px-3 py-3 text-center text-[11px] text-slate-500">
              Presiona cualquier botón superior para registrar tiempo MM:SS y signos vitales activos.
            </div>
          ) : (
            <div
              className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-slate-800/70'}`}
            >
              {[...events].reverse().map((ev, revIdx) => {
                const chronologicalNum = events.length - revIdx;
                const isEditing = editingId === ev.id;
                const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
                const noPulse = ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea';
                const spo2Display = noPulse ? '--' : `${Math.round(ev.vitals.spo2)}%`;

                if (isEditing) {
                  return (
                    <div
                      key={ev.id}
                      className={`px-2.5 py-1.5 space-y-1.5 ${
                        isLightMode ? 'bg-slate-50' : 'bg-[#121B2B]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          aria-label="Editar tiempo MM:SS"
                          value={editTimeText}
                          onChange={(e) => setEditTimeText(e.target.value)}
                          className={`w-16 h-6 px-2 rounded border font-mono text-[11px] tabular-nums ${
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
                          className={`flex-1 min-w-0 h-6 px-2 rounded border text-[11px] ${
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
                          className={`flex-1 min-w-0 h-6 px-2 rounded border text-[11px] ${
                            isLightMode
                              ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                              : 'bg-[#080C12] border-slate-700 text-slate-200 placeholder:text-slate-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(ev)}
                          className={`h-6 px-2 rounded text-[10.5px] font-semibold cursor-pointer shrink-0 ${
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
                    className={`px-2.5 py-1 flex items-center justify-between gap-2 transition-colors ${
                      isLightMode ? 'hover:bg-slate-50' : 'hover:bg-[#131C2B]/70'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 min-w-0 flex-1">
                      <span
                        className={`text-[10px] font-mono tabular-nums shrink-0 ${
                          isLightMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {String(chronologicalNum).padStart(2, '0')}
                      </span>

                      <span
                        className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${stageTimeClasses[ev.stage]}`}
                      >
                        {formatTimerMMSS(ev.timerSec)}
                      </span>

                      <span
                        className={`text-[11.5px] font-semibold truncate ${
                          isLightMode ? 'text-slate-900' : 'text-slate-100'
                        }`}
                      >
                        {ev.label}
                      </span>

                      {ev.note && (
                        <span
                          className={`text-[10.5px] truncate hidden md:inline ${
                            isLightMode ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          — {ev.note}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`text-[10px] font-mono tabular-nums flex items-center gap-1 ${
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
                          className={`hidden xl:inline ${
                            isLightMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span
                          className={`hidden xl:inline ${
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
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(ev.id)}
                          aria-label={`Eliminar ${ev.label}`}
                          title="Eliminar evento"
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            isLightMode
                              ? 'text-slate-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
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
