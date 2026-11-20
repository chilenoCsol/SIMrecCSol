import { STAGE_LABELS } from '../data/debriefMilestones';
import { RHYTHM_LABELS } from '../data/nrpPresets';
import { DebriefEvent } from '../types/simulation';
import { formatTimerMMSS } from './hudRenderer';

const INSTITUTIONAL_HEADER = 'SimRec Neonatal HUD SOCHIPE — Mat. Carlos Solar O.';

function formatReportDate(date: Date): string {
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function buildExportStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getEffectiveDurationSec(events: DebriefEvent[], currentTimerSec: number): number {
  const maxEventSec = events.reduce((max, ev) => Math.max(max, ev.timerSec), 0);
  return Math.max(currentTimerSec, maxEventSec);
}

/**
 * Generates a structured plain-text debriefing report for TXT download or clipboard copy.
 */
export function buildDebriefTextReport(
  events: DebriefEvent[],
  currentTimerSec: number
): string {
  const now = new Date();
  const totalDur = getEffectiveDurationSec(events, currentTimerSec);

  const lines: string[] = [
    '================================================================================',
    INSTITUTIONAL_HEADER,
    'REGISTRO DE EVENTOS CRÍTICOS PARA DEBRIEFING — REANIMACIÓN NEONATAL (NRP)',
    '================================================================================',
    `Fecha y hora   : ${formatReportDate(now)}`,
    `Duración total : ${formatTimerMMSS(totalDur)}`,
    `Total de hitos : ${events.length}`,
    '--------------------------------------------------------------------------------',
    '#   | TIEMPO | HORA     | HITO / EVENTO                  | TELEMETRÍA ACTIVA',
    '--------------------------------------------------------------------------------',
  ];

  if (events.length === 0) {
    lines.push('(Sin eventos críticos registrados en esta sesión)');
  } else {
    events.forEach((ev, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const mmss = formatTimerMMSS(ev.timerSec);
      const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
      const spo2Display =
        ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea'
          ? '--%'
          : `${Math.round(ev.vitals.spo2)}%`;
      const telemetry = `FC ${hrDisplay} lpm · SatO2 ${spo2Display} · Temp ${ev.vitals.temp.toFixed(
        1
      )}°C · ${RHYTHM_LABELS[ev.vitals.rhythm]} (${ev.vitals.lead})`;

      const labelPadded = ev.label.padEnd(30, ' ');
      lines.push(`${num}  | ${mmss}  | ${ev.wallTime} | ${labelPadded} | ${telemetry}`);

      if (ev.note && ev.note.trim().length > 0) {
        lines.push(`    └─ Nota: ${ev.note.trim()}`);
      }
    });
  }

  lines.push('================================================================================');
  return lines.join('\n');
}

/**
 * Generates a UTF-8 (with BOM) CSV clinical report compatible with Excel in Spanish.
 */
export function buildDebriefCsvReport(
  events: DebriefEvent[],
  currentTimerSec: number
): string {
  const now = new Date();
  const totalDur = getEffectiveDurationSec(events, currentTimerSec);

  const rows: string[] = [
    [escapeCsvCell(INSTITUTIONAL_HEADER)].join(','),
    ['Reporte', escapeCsvCell('Bitácora de Eventos Críticos — Simulación Neonatal NRP')].join(','),
    ['Fecha', escapeCsvCell(formatReportDate(now))].join(','),
    ['Duración total (MM:SS)', escapeCsvCell(formatTimerMMSS(totalDur))].join(','),
    ['Total de eventos', String(events.length)].join(','),
    '',
    [
      'N°',
      'Tiempo NRP (MM:SS)',
      'Hora Real',
      'Etapa',
      'Hito / Evento',
      'FC (lpm)',
      'SatO2 (%)',
      'Temperatura (°C)',
      'Ritmo',
      'Derivada ECG',
      'Observación',
    ]
      .map(escapeCsvCell)
      .join(','),
  ];

  events.forEach((ev, idx) => {
    const hrDisplay = ev.vitals.rhythm === 'asistolia' ? 0 : Math.round(ev.vitals.hr);
    const spo2Display =
      ev.vitals.rhythm === 'asistolia' || ev.vitals.rhythm === 'pea'
        ? '--'
        : String(Math.round(ev.vitals.spo2));

    rows.push(
      [
        idx + 1,
        formatTimerMMSS(ev.timerSec),
        ev.wallTime,
        STAGE_LABELS[ev.stage],
        ev.label,
        hrDisplay,
        spo2Display,
        ev.vitals.temp.toFixed(1),
        RHYTHM_LABELS[ev.vitals.rhythm],
        ev.vitals.lead,
        ev.note?.trim() ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  // Prepend UTF-8 BOM for proper accent handling in Excel
  return `\uFEFF${rows.join('\r\n')}`;
}

function triggerTextFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDebriefCsv(events: DebriefEvent[], currentTimerSec: number): void {
  const csv = buildDebriefCsvReport(events, currentTimerSec);
  const stamp = buildExportStamp(new Date());
  triggerTextFileDownload(
    csv,
    `SimRec-SOCHIPE-Bitacora-${stamp}.csv`,
    'text/csv;charset=utf-8'
  );
}

export function downloadDebriefTxt(events: DebriefEvent[], currentTimerSec: number): void {
  const txt = buildDebriefTextReport(events, currentTimerSec);
  const stamp = buildExportStamp(new Date());
  triggerTextFileDownload(
    txt,
    `SimRec-SOCHIPE-Bitacora-${stamp}.txt`,
    'text/plain;charset=utf-8'
  );
}
