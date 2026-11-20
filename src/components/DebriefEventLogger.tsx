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
  STAGE_ACCENT_HEX,
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

  // Inline edit state for correcting a logged event
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editTimeText, setEditTimeText] = useState('');
  const [editNote, setEditNote] = useState('');

  // Count how many times each milestone has been logged
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
      // Fallback textarea copy if clipboard API is restricted
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

  return (
    <div className="divide-y divide-slate-800/80">
      {/* Compact Video Banner Toggle + Export Bar */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#0B1019]">
        <button
          type="button"
          role="switch"
          aria-checked={showBannerInVideo}
          onClick={onToggleShowBanner}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
            showBannerInVideo
              ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
              : 'bg-[#141C2B] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Tv className="w-3 h-3 shrink-0" />
          <span>Banner en video (3s)</span>
          <span
            className={`inline-flex items-center w-6 h-3.5 rounded-full p-0.5 transition-colors ${
              showBannerInVideo ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white block" />
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => downloadDebriefCsv(events, timerSeconds)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-[#141C2B] text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3 h-3 text-sky-400" />
            .CSV
          </button>

          <button
            type="button"
            onClick={() => downloadDebriefTxt(events, timerSeconds)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-[#141C2B] text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3 h-3 text-emerald-400" />
            .TXT
          </button>

          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              copiedFeedback
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
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
                <ClipboardCopy className="w-3 h-3 text-slate-400" />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* 19 Quick Clinical Milestone Buttons: 5 Evaluation Questions + 14 NRP Interventions */}
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DEBRIEF_STAGES.map((stage) => {
            const stageMilestones = DEBRIEF_MILESTONES.filter((m) => m.stage === stage.id);

            // Differentiated top indigo block for 'Evaluación y Preguntas Clave'
            if (stage.id === 'evaluacion') {
              const initialQuestion = stageMilestones.find(
                (m) => m.id === 'preguntas-iniciales-ok'
              );
              const reevalQuestions = stageMilestones.filter(
                (m) => m.id !== 'preguntas-iniciales-ok'
              );

              return (
                <div
                  key={stage.id}
                  className="sm:col-span-2 rounded-md bg-indigo-500/[0.06] border border-indigo-500/25 p-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-semibold tracking-wide ${stage.headerTextClass}`}>
                      {stage.title}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-300/70">
                      1 clic · repetible
                    </span>
                  </div>

                  {/* Leading initial question right before 'Inicial / Pasos iniciales' */}
                  {initialQuestion && (() => {
                    const count = milestoneCounts.get(initialQuestion.id) ?? 0;
                    const executed = count > 0;
                    return (
                      <button
                        key={initialQuestion.id}
                        type="button"
                        onClick={() => onLogMilestone(initialQuestion)}
                        className={`w-full px-2.5 py-1.5 rounded border text-left text-[11px] font-medium transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                          executed ? stage.buttonActiveClass : stage.buttonIdleClass
                        }`}
                      >
                        <span className="truncate">{initialQuestion.label}</span>
                        {executed && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold tabular-nums shrink-0 ${stage.badgeTextClass}`}
                          >
                            <Check className="w-3 h-3" />
                            <span>×{count}</span>
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {/* 4 Reevaluation Questions in quick 1-click 2x2 grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {reevalQuestions.map((milestone) => {
                      const count = milestoneCounts.get(milestone.id) ?? 0;
                      const executed = count > 0;
                      return (
                        <button
                          key={milestone.id}
                          type="button"
                          title={milestone.label}
                          onClick={() => onLogMilestone(milestone)}
                          className={`w-full px-2.5 py-1.5 rounded border text-left text-[11px] font-medium transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                            executed ? stage.buttonActiveClass : stage.buttonIdleClass
                          }`}
                        >
                          <span className="truncate">{milestone.label}</span>
                          {executed && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-500/25 border border-indigo-400/40 text-[10px] font-mono font-bold tabular-nums leading-none shrink-0 ${stage.badgeTextClass}`}
                            >
                              ×{count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isFullWidth =
              stage.id === 'circulacion' || stage.id === 'farmacos' || stage.id === 'especiales';
            const buttonGridClass =
              stage.id === 'circulacion'
                ? 'grid grid-cols-1 sm:grid-cols-3 gap-1.5'
                : stage.id === 'farmacos'
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-1.5'
                : 'grid grid-cols-1 gap-1.5';
            return (
              <div
                key={stage.id}
                className={`space-y-1 ${isFullWidth ? 'sm:col-span-2' : ''}`}
              >
                <div className={`text-[11px] font-semibold tracking-wide ${stage.headerTextClass}`}>
                  {stage.title}
                </div>
                <div className={buttonGridClass}>
                  {stageMilestones.map((milestone) => {
                    const count = milestoneCounts.get(milestone.id) ?? 0;
                    const executed = count > 0;
                    return (
                      <button
                        key={milestone.id}
                        type="button"
                        onClick={() => onLogMilestone(milestone)}
                        className={`w-full px-2.5 py-1.5 rounded border text-left text-[11px] font-medium transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                          executed ? stage.buttonActiveClass : stage.buttonIdleClass
                        }`}
                      >
                        <span className="truncate">{milestone.label}</span>
                        {executed && (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold tabular-nums shrink-0 ${stage.badgeTextClass}`}
                          >
                            <Check className="w-3 h-3" />
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

        {/* Optional Free-Text Clinical Note Bar */}
        <form onSubmit={handleSubmitNote} className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={customNoteInput}
            onChange={(e) => setCustomNoteInput(e.target.value)}
            placeholder="Nota rápida opcional (ej. Cambio mascarilla, ajuste PEEP)..."
            className="flex-1 h-8 px-2.5 rounded bg-[#080C12] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/70"
          />
          <button
            type="submit"
            disabled={customNoteInput.trim().length === 0}
            className="h-8 px-3 inline-flex items-center gap-1 rounded bg-[#141C2B] border border-slate-700 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nota
          </button>
        </form>
      </div>

      {/* Chronological Telemetry Log (Compact Editable List) */}
      <div className="divide-y divide-slate-800/80">
        <div className="px-3.5 py-2 flex items-center justify-between gap-2 bg-[#0B1019]">
          <span className="text-[11px] font-semibold text-slate-300">
            Bitácora Completa ({events.length})
          </span>

          {events.length > 0 && (
            confirmClear ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onClearEvents();
                    setConfirmClear(false);
                    setEditingId(null);
                  }}
                  className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500 cursor-pointer whitespace-nowrap"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-0.5 rounded border border-slate-700 bg-[#141C2B] text-slate-300 text-[11px] hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                Limpiar bitácora
              </button>
            )
          )}
        </div>

        {events.length === 0 ? (
          <div className="px-3.5 py-3 text-center text-[11px] text-slate-500">
            Presiona un hito superior para registrar tiempo MM:SS y signos vitales activos.
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto clinical-scroll divide-y divide-slate-800/70">
            {events.map((ev, index) => {
              const isEditing = editingId === ev.id;
              const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
              const noPulse = ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea';
              const spo2Display = noPulse ? '--' : `${Math.round(ev.vitals.spo2)}%`;

              if (isEditing) {
                return (
                  <div key={ev.id} className="px-3 py-2 bg-[#121B2B] space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        aria-label="Editar tiempo MM:SS"
                        value={editTimeText}
                        onChange={(e) => setEditTimeText(e.target.value)}
                        className="w-16 h-7 px-2 rounded bg-[#080C12] border border-slate-700 font-mono text-xs text-slate-100 tabular-nums"
                      />
                      <input
                        type="text"
                        aria-label="Editar nombre del hito"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 min-w-0 h-7 px-2 rounded bg-[#080C12] border border-slate-700 text-xs text-slate-100"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        aria-label="Observación adicional"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Observación breve (opcional)"
                        className="flex-1 min-w-0 h-7 px-2 rounded bg-[#080C12] border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(ev)}
                        className="h-7 px-2.5 rounded bg-sky-500 text-slate-950 text-[11px] font-semibold hover:bg-sky-400 cursor-pointer shrink-0"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancelar edición"
                        className="h-7 px-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ev.id}
                  className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-[#131C2B]/70 transition-colors"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-slate-500 tabular-nums pt-0.5 shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span
                      className="font-mono text-[11px] font-bold tabular-nums pt-0.5 shrink-0"
                      style={{ color: STAGE_ACCENT_HEX[ev.stage] }}
                    >
                      {formatTimerMMSS(ev.timerSec)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-xs font-semibold text-slate-100">{ev.label}</span>
                        {ev.note && (
                          <span className="text-[11px] text-slate-400 truncate">— {ev.note}</span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-400 flex flex-wrap items-center gap-x-1.5">
                        <span className="text-emerald-400">FC {hrDisplay}</span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-sky-400">SatO₂ {spo2Display}</span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className={ev.vitals.temp < 36.5 ? 'text-red-400' : 'text-amber-200'}>
                          {ev.vitals.temp.toFixed(1)}°C
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          {RHYTHM_LABELS[ev.vitals.rhythm]} ({ev.vitals.lead})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(ev)}
                      aria-label={`Corregir ${ev.label}`}
                      title="Corregir evento o tiempo"
                      className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(ev.id)}
                      aria-label={`Eliminar ${ev.label}`}
                      title="Eliminar evento"
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
