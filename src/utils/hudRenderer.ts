import { STAGE_ACCENT_HEX } from '../data/debriefMilestones';
import { HYPOTHERMIA_THRESHOLD, RHYTHM_SHORT_LABELS } from '../data/nrpPresets';
import {
  CanvasMilestoneBanner,
  HudLayoutMode,
  PlethColorMode,
  RecordingState,
  SensorConnections,
  VitalParams,
} from '../types/simulation';
import { WAVE_BUFFER_SIZE, WaveformEngineState } from './waveformEngine';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export interface HudRenderContext {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement | null;
  hasVideoFeed: boolean;
  mirrorVideo: boolean;
  vitals: VitalParams;
  sensors: SensorConnections;
  waveform: WaveformEngineState;
  timerSeconds: number;
  recordingState: RecordingState;
  plethColorMode: PlethColorMode;
  hudLayout: HudLayoutMode;
  institutionalLogo: HTMLCanvasElement | null;
  activeBanner: CanvasMilestoneBanner | null;
  nowMs: number;
}

export function formatTimerMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatWallClock(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draws the webcam video cover-fitted into 1280x720, or a clean clinical simulation
 * viewfinder standby canvas when no physical camera stream is active.
 */
function drawVideoOrStandby(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  hasVideoFeed: boolean,
  mirrorVideo: boolean
) {
  if (hasVideoFeed && video && video.readyState >= 2 && video.videoWidth > 0) {
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const videoRatio = vidW / vidH;

    let sx = 0;
    let sy = 0;
    let sw = vidW;
    let sh = vidH;

    if (videoRatio > canvasRatio) {
      sw = vidH * canvasRatio;
      sx = (vidW - sw) / 2;
    } else {
      sh = vidW / canvasRatio;
      sy = (vidH - sh) / 2;
    }

    ctx.save();
    if (mirrorVideo) {
      ctx.translate(CANVAS_WIDTH, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    return;
  }

  // Standby clinical simulation studio backdrop (clean dark calibration grid)
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bg.addColorStop(0, '#0B111B');
  bg.addColorStop(1, '#070A10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle calibration grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 64; x < CANVAS_WIDTH; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 64; y < CANVAS_HEIGHT; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Center safe-zone framing guide (shifted slightly left when side HUD is active)
  const cx = 480;
  const cy = 410;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx, cy + 24);
  ctx.stroke();

  ctx.fillStyle = 'rgba(148, 163, 184, 0.62)';
  ctx.font = '600 18px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SALA DE SIMULACIÓN NEONATAL — SIN SEÑAL DE CÁMARA', cx, cy + 58);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.fillText('1280 × 720 HD · 30 FPS · HUD CLÍNICO ACTIVO', cx, cy + 84);
  ctx.textAlign = 'left';
}

/**
 * Draws an oscilloscope sweep trace with subtle grid, erase gap ahead of cursor,
 * and glowing phosphor beam tip.
 */
function drawOscilloscopeTrace(
  ctx: CanvasRenderingContext2D,
  buffer: Float32Array,
  writeIndex: number,
  rect: { x: number; y: number; w: number; h: number },
  color: string,
  glowColor: string,
  mapValueToY: (val: number, y: number, h: number) => number
) {
  const { x, y, w, h } = rect;

  // Calibration grid inside waveform area
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  const vDivs = 6;
  const hDivs = 3;
  for (let i = 1; i < vDivs; i++) {
    const gx = x + (w * i) / vDivs;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let j = 1; j < hDivs; j++) {
    const gy = y + (h * j) / hDivs;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Erase gap length in samples ahead of sweep head
  const gapSamples = 11;
  const stepX = w / (WAVE_BUFFER_SIZE - 1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 6;

  // Draw two continuous segments avoiding the moving erase gap
  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i < WAVE_BUFFER_SIZE; i++) {
    // Distance ahead of writeIndex in circular buffer
    const distAhead = (i - writeIndex + WAVE_BUFFER_SIZE) % WAVE_BUFFER_SIZE;
    const inGap = distAhead >= 0 && distAhead < gapSamples;

    if (inGap) {
      if (drawing) {
        ctx.stroke();
        ctx.beginPath();
        drawing = false;
      }
      continue;
    }

    const px = x + i * stepX;
    const py = mapValueToY(buffer[i], y, h);

    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  if (drawing) {
    ctx.stroke();
  }

  // Bright phosphor head dot at the latest written sample
  const headIdx = (writeIndex - 1 + WAVE_BUFFER_SIZE) % WAVE_BUFFER_SIZE;
  const headX = x + headIdx * stepX;
  const headY = mapValueToY(buffer[headIdx], y, h);

  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(headX, headY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a flat dashed baseline with a clear clinical disconnection notice
 * when a bedside sensor cable (ECG or SpO2) is unplugged.
 */
function drawDisconnectedWaveTrack(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  message: string
) {
  const { x, y, w, h } = rect;
  const midY = y + h * 0.54;

  ctx.save();
  // Subtle calibration grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const gx = x + (w * i) / 6;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }

  // Flat dashed baseline
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(x + 4, midY);
  ctx.lineTo(x + w - 4, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Centered disconnection text over subtle dark pill-less strip for legibility
  const fontSize = h < 74 ? 11.5 : 12.5;
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
  const textW = ctx.measureText(message).width;
  const boxW = Math.min(w - 8, textW + 18);
  const boxH = 24;
  const boxX = x + (w - boxW) / 2;
  const boxY = midY - boxH / 2;

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 4);
  ctx.fillStyle = 'rgba(11, 16, 25, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(251, 191, 36, 0.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, x + w / 2, midY + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawTopBarAndSideHud(rc: HudRenderContext) {
  const { ctx, vitals, sensors, waveform, timerSeconds, recordingState, plethColorMode, nowMs } = rc;
  const { ecgConnected, spo2Connected, tempConnected } = sensors;

  const isHypothermia = tempConnected && vitals.temp < HYPOTHERMIA_THRESHOLD;
  const hrRounded = vitals.rhythm === 'asistolia' ? 0 : Math.round(vitals.hr);
  const isAsystole = vitals.rhythm === 'asistolia' || hrRounded === 0;
  const isPea = vitals.rhythm === 'pea';
  const noPulse = isAsystole || isPea;
  const isBrady = !isAsystole && hrRounded < 100;
  const pulseBlink = 0.55 + 0.45 * Math.sin(nowMs / 240);

  // HR Source Resolution: Caso A (ECG) -> Caso B (SpO2) -> Caso C (None)
  const hrSource: 'ecg' | 'spo2' | 'none' = ecgConnected
    ? 'ecg'
    : spo2Connected
    ? 'spo2'
    : 'none';

  const plethMainColor = plethColorMode === 'yellow' ? '#FACC15' : '#38BDF8';
  const plethGlowColor =
    plethColorMode === 'yellow' ? 'rgba(250, 204, 21, 0.5)' : 'rgba(56, 189, 248, 0.5)';

  // =========================================================================
  // 1. TOP HUD BAR (Cronómetro NRP + Estado Grabación + Temperatura)
  // =========================================================================
  const topX = 16;
  const topY = 16;
  const topW = CANVAS_WIDTH - 32;
  const topH = 82;

  ctx.save();
  drawRoundedRect(ctx, topX, topY, topW, topH, 10);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left block: Resuscitation Stopwatch
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 11px "IBM Plex Sans", sans-serif';
  ctx.fillText('CRONÓMETRO DE REANIMACIÓN NRP', topX + 18, topY + 22);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.fillText(formatTimerMMSS(timerSeconds), topX + 18, topY + 69);

  // Recording state indicator right next to timer
  const recX = topX + 184;
  if (recordingState === 'recording') {
    const recDotAlpha = 0.4 + 0.6 * Math.abs(Math.sin(nowMs / 450));
    ctx.fillStyle = `rgba(239, 68, 68, ${recDotAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(recX + 6, topY + 52, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F87171';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText('REC', recX + 18, topY + 57);
  } else if (recordingState === 'paused') {
    ctx.fillStyle = '#FBBF24';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText('PAUSA', recX, topY + 57);
  } else {
    ctx.fillStyle = '#64748B';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('LISTO', recX, topY + 57);
  }

  // Vertical hairline divider 1
  const div1X = topX + 278;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.beginPath();
  ctx.moveTo(div1X, topY + 14);
  ctx.lineTo(div1X, topY + topH - 14);
  ctx.stroke();

  // Center block: Rhythm / Active Source & Real-time Wall Clock
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 11px "IBM Plex Sans", sans-serif';
  ctx.fillText('MONITOR MULTIPARÁMETRO NEONATAL', div1X + 20, topY + 24);

  let centerMainLabel: string;
  let centerMainColor: string;
  let centerSubLabel: string;

  if (hrSource === 'ecg') {
    centerMainLabel = RHYTHM_SHORT_LABELS[vitals.rhythm];
    centerMainColor = isAsystole || isPea ? '#F87171' : isBrady ? '#FBBF24' : '#4ADE80';
    centerSubLabel = `DERIVADA ${vitals.lead}  ·  HORA ${formatWallClock(new Date())}`;
  } else if (hrSource === 'spo2') {
    centerMainLabel = noPulse
      ? 'SIN PULSO (SpO2)'
      : isBrady
      ? 'BRADICARDIA (SpO2)'
      : 'PULSO POR SpO2';
    centerMainColor = noPulse ? '#F87171' : isBrady ? '#FBBF24' : plethMainColor;
    centerSubLabel = `SIN ECG · ORIGEN FP (SpO2)  ·  HORA ${formatWallClock(new Date())}`;
  } else {
    centerMainLabel = 'SIN SENSORES CARDÍACOS';
    centerMainColor = '#94A3B8';
    centerSubLabel = `ECG/SpO2 DESCONECTADOS  ·  HORA ${formatWallClock(new Date())}`;
  }

  ctx.fillStyle = centerMainColor;
  ctx.font = '700 19px "JetBrains Mono", monospace';
  ctx.fillText(centerMainLabel, div1X + 20, topY + 54);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillText(centerSubLabel, div1X + 20, topY + 72);

  // Right block: Temperature Module inside Top Bar
  const tempBoxW = isHypothermia ? 368 : !tempConnected ? 298 : 236;
  const tempBoxX = topX + topW - tempBoxW - 10;
  const tempBoxY = topY + 8;
  const tempBoxH = topH - 16;

  drawRoundedRect(ctx, tempBoxX, tempBoxY, tempBoxW, tempBoxH, 7);
  if (isHypothermia) {
    ctx.fillStyle = `rgba(220, 38, 38, ${(0.22 + 0.14 * pulseBlink).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(248, 113, 113, ${(0.65 + 0.35 * pulseBlink).toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.strokeStyle = !tempConnected
      ? 'rgba(245, 158, 11, 0.28)'
      : 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = isHypothermia ? '#FCA5A5' : '#94A3B8';
  ctx.font = '600 11px "IBM Plex Sans", sans-serif';
  ctx.fillText('TEMPERATURA', tempBoxX + 14, tempBoxY + 20);

  if (!tempConnected) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillText('SENSOR NO CONECTADO', tempBoxX + 14, tempBoxY + 53);
  } else if (isHypothermia) {
    ctx.fillStyle = '#FEF08A';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText('▲ HIPOTERMIA (< 36.5 °C)', tempBoxX + 14, tempBoxY + 53);
  } else {
    ctx.fillStyle = '#64748B';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText('NORMOTERMIA', tempBoxX + 14, tempBoxY + 53);
  }

  ctx.fillStyle = !tempConnected ? '#64748B' : isHypothermia ? '#FFFFFF' : '#FDE68A';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    tempConnected ? `${vitals.temp.toFixed(1)}` : '--.-',
    tempBoxX + tempBoxW - 44,
    tempBoxY + 46
  );

  ctx.fillStyle = !tempConnected ? '#64748B' : isHypothermia ? '#FCA5A5' : '#CBD5E1';
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillText('°C', tempBoxX + tempBoxW - 14, tempBoxY + 46);
  ctx.textAlign = 'left';

  ctx.restore();

  // =========================================================================
  // 2. RIGHT SIDE MULTIPARAMETER MONITOR PANEL (ECG + SatO2)
  // =========================================================================
  const sideW = 356;
  const sideX = CANVAS_WIDTH - sideW - 16;
  const sideY = topY + topH + 12;

  // --- ECG / HEART RATE MODULE ---
  const ecgH = 178;
  const hrCriticalBorder =
    (hrSource === 'ecg' && (isAsystole || isPea)) ||
    (hrSource === 'spo2' && noPulse);

  ctx.save();
  drawRoundedRect(ctx, sideX, sideY, sideW, ecgH, 10);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.82)';
  ctx.fill();
  ctx.strokeStyle = hrCriticalBorder
    ? `rgba(239, 68, 68, ${(0.55 + 0.4 * pulseBlink).toFixed(2)})`
    : hrSource === 'ecg'
    ? 'rgba(34, 197, 94, 0.34)'
    : hrSource === 'spo2'
    ? plethColorMode === 'yellow'
      ? 'rgba(250, 204, 21, 0.34)'
      : 'rgba(56, 189, 248, 0.34)'
    : 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = hrCriticalBorder ? 1.6 : 1;
  ctx.stroke();

  // ECG Header Row
  ctx.fillStyle = ecgConnected ? '#4ADE80' : '#94A3B8';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText(ecgConnected ? `ECG  ${vitals.lead}` : 'ECG  OFF', sideX + 16, sideY + 24);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText(ecgConnected ? '25 mm/s' : 'SIN ELECTRODOS', sideX + 104, sideY + 24);

  // Beat pulse indicator (synced to QRS in Caso A, or to Pleth in Caso B; silent in Caso C)
  if (hrSource === 'ecg' && !isAsystole && waveform.beatFlashAlpha > 0.05) {
    ctx.fillStyle = `rgba(74, 222, 128, ${waveform.beatFlashAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sideX + 178, sideY + 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (hrSource === 'spo2' && !noPulse && waveform.plethFlashAlpha > 0.05) {
    ctx.fillStyle =
      plethColorMode === 'yellow'
        ? `rgba(250, 204, 21, ${waveform.plethFlashAlpha.toFixed(2)})`
        : `rgba(56, 189, 248, ${waveform.plethFlashAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sideX + 216, sideY + 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // FC / FP Numeric Readout (top right of ECG module)
  let hrLabelText = 'FC / FP';
  let hrLabelColor = '#94A3B8';
  let displayHr = '---';
  let hrValueColor = '#64748B';
  let hrUnitColor = '#64748B';

  if (hrSource === 'ecg') {
    hrLabelText = 'FC (ECG)';
    hrLabelColor = '#4ADE80';
    displayHr = isAsystole ? '0' : String(hrRounded);
    hrValueColor = isAsystole ? '#F87171' : '#4ADE80';
    hrUnitColor = '#86EFAC';
  } else if (hrSource === 'spo2') {
    hrLabelText = 'FP (SpO2)';
    hrLabelColor = plethMainColor;
    displayHr = noPulse ? '---' : String(hrRounded);
    hrValueColor = noPulse ? '#94A3B8' : plethMainColor;
    hrUnitColor = plethMainColor;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = hrLabelColor;
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.fillText(hrLabelText, sideX + sideW - 14, sideY + 21);

  ctx.fillStyle = hrValueColor;
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.fillText(displayHr, sideX + sideW - 48, sideY + 57);

  ctx.fillStyle = hrUnitColor;
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('lpm', sideX + sideW - 14, sideY + 57);
  ctx.textAlign = 'left';

  // Alert subtitle inside ECG card (only when an active sensor is actually sensing!)
  if (hrSource === 'ecg') {
    if (isAsystole) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('▲ ASISTOLIA — SIN ACTIVIDAD', sideX + 16, sideY + 46);
    } else if (isPea) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('▲ AESP / PEA — SIN PULSO', sideX + 16, sideY + 46);
    } else if (isBrady) {
      ctx.fillStyle = '#FDE047';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(
        vitals.hr < 60 ? '▲ BRADICARDIA SEVERA (<60)' : '▲ BRADICARDIA (<100)',
        sideX + 16,
        sideY + 46
      );
    }
  } else if (hrSource === 'spo2') {
    if (noPulse) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('▲ PULSO NO DETECTADO (SpO2)', sideX + 16, sideY + 46);
    } else if (isBrady) {
      ctx.fillStyle = '#FDE047';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(
        vitals.hr < 60 ? '▲ BRADICARDIA SpO2 (<60)' : '▲ BRADICARDIA SpO2 (<100)',
        sideX + 16,
        sideY + 46
      );
    } else {
      ctx.fillStyle = plethMainColor;
      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillText('ORIGEN PULSO: OXIMETRÍA', sideX + 16, sideY + 46);
    }
  }

  // ECG Oscilloscope Waveform Area
  const ecgWaveRect = { x: sideX + 14, y: sideY + 66, w: sideW - 28, h: 98 };
  if (ecgConnected) {
    drawOscilloscopeTrace(
      ctx,
      waveform.ecgBuffer,
      waveform.writeIndex,
      ecgWaveRect,
      '#22C55E',
      'rgba(34, 197, 94, 0.55)',
      (val, y, h) => {
        const baseline = y + h * 0.68;
        return baseline - val * (h * 0.56);
      }
    );
  } else {
    drawDisconnectedWaveTrack(ctx, ecgWaveRect, 'ECG: SENSOR NO CONECTADO');
  }
  ctx.restore();

  // --- SpO2 PLETHYSMOGRAPHY MODULE ---
  const spo2Y = sideY + ecgH + 12;
  const spo2H = 166;

  ctx.save();
  drawRoundedRect(ctx, sideX, spo2Y, sideW, spo2H, 10);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.82)';
  ctx.fill();
  ctx.strokeStyle = !spo2Connected
    ? 'rgba(148, 163, 184, 0.24)'
    : plethColorMode === 'yellow'
    ? 'rgba(250, 204, 21, 0.34)'
    : 'rgba(56, 189, 248, 0.34)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // SpO2 Header
  ctx.fillStyle = spo2Connected ? plethMainColor : '#94A3B8';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText('SatO₂', sideX + 16, spo2Y + 24);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText(spo2Connected ? 'PLETISMOGRAFÍA' : 'SENSOR OFF', sideX + 68, spo2Y + 24);

  // SpO2 Numeric Readout
  ctx.fillStyle = !spo2Connected ? '#64748B' : noPulse ? '#94A3B8' : plethMainColor;
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  const spo2Text = !spo2Connected ? '---' : noPulse ? '--' : String(Math.round(vitals.spo2));
  ctx.fillText(spo2Text, sideX + sideW - 36, spo2Y + 56);

  ctx.fillStyle = !spo2Connected ? '#64748B' : '#CBD5E1';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('%', sideX + sideW - 14, spo2Y + 54);
  ctx.textAlign = 'left';

  if (spo2Connected) {
    if (noPulse) {
      ctx.fillStyle = '#FCA5A5';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('▲ SEÑAL DE PULSO AUSENTE', sideX + 16, spo2Y + 46);
    } else if (vitals.spo2 < 80) {
      ctx.fillStyle = '#FDE047';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('▲ DESATURACIÓN (<80%)', sideX + 16, spo2Y + 46);
    }
  }

  // Plethysmography Waveform Area
  const plethWaveRect = { x: sideX + 14, y: spo2Y + 64, w: sideW - 28, h: 88 };
  if (spo2Connected) {
    drawOscilloscopeTrace(
      ctx,
      waveform.plethBuffer,
      waveform.writeIndex,
      plethWaveRect,
      plethMainColor,
      plethGlowColor,
      (val, y, h) => {
        const bottom = y + h * 0.86;
        return bottom - val * (h * 0.72);
      }
    );
  } else {
    drawDisconnectedWaveTrack(ctx, plethWaveRect, 'SatO2: SENSOR NO CONECTADO');
  }
  ctx.restore();
}

/**
 * Compact horizontal top-strip HUD mode (leaves entire right side of the camera frame unobstructed).
 */
function drawCompactTopHud(rc: HudRenderContext) {
  const { ctx, vitals, sensors, waveform, timerSeconds, recordingState, plethColorMode, nowMs } = rc;
  const { ecgConnected, spo2Connected, tempConnected } = sensors;

  const isHypothermia = tempConnected && vitals.temp < HYPOTHERMIA_THRESHOLD;
  const hrRounded = vitals.rhythm === 'asistolia' ? 0 : Math.round(vitals.hr);
  const isAsystole = vitals.rhythm === 'asistolia' || hrRounded === 0;
  const isPea = vitals.rhythm === 'pea';
  const noPulse = isAsystole || isPea;
  const pulseBlink = 0.55 + 0.45 * Math.sin(nowMs / 240);

  const hrSource: 'ecg' | 'spo2' | 'none' = ecgConnected
    ? 'ecg'
    : spo2Connected
    ? 'spo2'
    : 'none';

  const plethMainColor = plethColorMode === 'yellow' ? '#FACC15' : '#38BDF8';
  const plethGlowColor =
    plethColorMode === 'yellow' ? 'rgba(250, 204, 21, 0.5)' : 'rgba(56, 189, 248, 0.5)';

  const x = 16;
  const y = 16;
  const w = CANVAS_WIDTH - 32;
  const h = 112;

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Zone 1: Timer (0..220)
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 11px "IBM Plex Sans", sans-serif';
  ctx.fillText('CRONÓMETRO NRP', x + 16, y + 24);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 46px "JetBrains Mono", monospace';
  ctx.fillText(formatTimerMMSS(timerSeconds), x + 16, y + 76);

  const statusTag =
    hrSource === 'ecg'
      ? RHYTHM_SHORT_LABELS[vitals.rhythm]
      : hrSource === 'spo2'
      ? 'FP (SpO2)'
      : 'SIN SENSORES';

  if (recordingState === 'recording') {
    const recDotAlpha = 0.4 + 0.6 * Math.abs(Math.sin(nowMs / 450));
    ctx.fillStyle = `rgba(239, 68, 68, ${recDotAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x + 22, y + 96, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F87171';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(`REC · ${statusTag}`, x + 33, y + 100);
  } else {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(
      `${recordingState === 'paused' ? 'PAUSA' : 'LISTO'} · ${statusTag}`,
      x + 16,
      y + 100
    );
  }

  // Divider 1
  const d1 = x + 224;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.beginPath();
  ctx.moveTo(d1, y + 12);
  ctx.lineTo(d1, y + h - 12);
  ctx.stroke();

  // Zone 2: ECG & HR/FP (224..648)
  ctx.fillStyle = ecgConnected ? '#4ADE80' : '#94A3B8';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(ecgConnected ? `ECG ${vitals.lead}` : 'ECG OFF', d1 + 14, y + 24);

  const topEcgRect = { x: d1 + 14, y: y + 32, w: 280, h: 68 };
  if (ecgConnected) {
    drawOscilloscopeTrace(
      ctx,
      waveform.ecgBuffer,
      waveform.writeIndex,
      topEcgRect,
      '#22C55E',
      'rgba(34, 197, 94, 0.55)',
      (val, ry, rh) => ry + rh * 0.68 - val * (rh * 0.56)
    );
  } else {
    drawDisconnectedWaveTrack(ctx, topEcgRect, 'ECG: SENSOR NO CONECTADO');
  }

  let topHrLabel = 'FC / FP';
  let topHrLabelColor = '#94A3B8';
  let topHrValue = '---';
  let topHrValueColor = '#64748B';

  if (hrSource === 'ecg') {
    topHrLabel = 'FC (ECG)';
    topHrLabelColor = '#4ADE80';
    topHrValue = isAsystole ? '0' : String(hrRounded);
    topHrValueColor = isAsystole ? '#F87171' : '#4ADE80';
  } else if (hrSource === 'spo2') {
    topHrLabel = 'FP (SpO2)';
    topHrLabelColor = plethMainColor;
    topHrValue = noPulse ? '---' : String(hrRounded);
    topHrValueColor = noPulse ? '#94A3B8' : plethMainColor;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = topHrLabelColor;
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.fillText(topHrLabel, d1 + 410, y + 24);

  ctx.fillStyle = topHrValueColor;
  ctx.font = '700 38px "JetBrains Mono", monospace';
  ctx.fillText(topHrValue, d1 + 410, y + 68);

  ctx.fillStyle = hrSource === 'none' ? '#64748B' : topHrLabelColor;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText('lpm', d1 + 410, y + 90);
  ctx.textAlign = 'left';

  // Divider 2
  const d2 = d1 + 424;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.beginPath();
  ctx.moveTo(d2, y + 12);
  ctx.lineTo(d2, y + h - 12);
  ctx.stroke();

  // Zone 3: SpO2 (648..1040)
  ctx.fillStyle = spo2Connected ? plethMainColor : '#94A3B8';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(spo2Connected ? 'SatO₂ PLETH' : 'SatO₂ OFF', d2 + 14, y + 24);

  const topPlethRect = { x: d2 + 14, y: y + 32, w: 256, h: 68 };
  if (spo2Connected) {
    drawOscilloscopeTrace(
      ctx,
      waveform.plethBuffer,
      waveform.writeIndex,
      topPlethRect,
      plethMainColor,
      plethGlowColor,
      (val, ry, rh) => ry + rh * 0.86 - val * (rh * 0.72)
    );
  } else {
    drawDisconnectedWaveTrack(ctx, topPlethRect, 'SatO2: SENSOR NO CONECTADO');
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = !spo2Connected ? '#64748B' : noPulse ? '#94A3B8' : plethMainColor;
  ctx.font = '700 38px "JetBrains Mono", monospace';
  ctx.fillText(
    !spo2Connected ? '---' : noPulse ? '--' : String(Math.round(vitals.spo2)),
    d2 + 378,
    y + 68
  );
  ctx.fillStyle = !spo2Connected ? '#64748B' : '#CBD5E1';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillText('%', d2 + 378, y + 90);
  ctx.textAlign = 'left';

  // Divider 3 + Zone 4: Temperature (1040..1248)
  const d3 = d2 + 392;
  const tBoxX = d3 + 8;
  const tBoxW = x + w - tBoxX - 10;
  drawRoundedRect(ctx, tBoxX, y + 10, tBoxW, h - 20, 7);
  if (isHypothermia) {
    ctx.fillStyle = `rgba(220, 38, 38, ${(0.22 + 0.14 * pulseBlink).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(248, 113, 113, ${(0.65 + 0.35 * pulseBlink).toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.strokeStyle = !tempConnected
      ? 'rgba(245, 158, 11, 0.28)'
      : 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = isHypothermia ? '#FCA5A5' : '#94A3B8';
  ctx.font = '600 11px "IBM Plex Sans", sans-serif';
  ctx.fillText('TEMPERATURA', tBoxX + 12, y + 29);

  ctx.fillStyle = !tempConnected ? '#64748B' : isHypothermia ? '#FFFFFF' : '#FDE68A';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.fillText(tempConnected ? `${vitals.temp.toFixed(1)}°C` : '--.-°C', tBoxX + 12, y + 68);

  ctx.fillStyle = !tempConnected
    ? 'rgba(251, 191, 36, 0.85)'
    : isHypothermia
    ? '#FEF08A'
    : '#64748B';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillText(
    !tempConnected ? 'SENSOR NO CONECTADO' : isHypothermia ? '▲ HIPOTERMIA' : 'NORMOTERMIA',
    tBoxX + 12,
    y + 91
  );

  ctx.restore();
}

function drawBroadcastInstitutionalBug(
  ctx: CanvasRenderingContext2D,
  logoCanvas: HTMLCanvasElement | null
) {
  if (!logoCanvas || logoCanvas.width === 0 || logoCanvas.height === 0) return;

  // Discrete TV broadcast bug (~104px wide, opacity 0.85) in bottom-left corner
  const targetWidth = 104;
  const aspect = logoCanvas.height / logoCanvas.width;
  const targetHeight = Math.round(targetWidth * aspect);
  const marginX = 20;
  const marginY = 18;
  const x = marginX;
  const y = CANVAS_HEIGHT - targetHeight - marginY;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(logoCanvas, x, y, targetWidth, targetHeight);
  ctx.restore();
}

function drawTemporaryMilestoneBanner(
  ctx: CanvasRenderingContext2D,
  banner: CanvasMilestoneBanner | null,
  nowMs: number
) {
  if (!banner) return;
  const elapsed = nowMs - banner.startedAtMs;
  if (elapsed < 0 || elapsed >= banner.durationMs) return;

  // Smooth fade-in (180ms) and fade-out (380ms)
  let alpha = 1;
  if (elapsed < 180) {
    alpha = elapsed / 180;
  } else if (elapsed > banner.durationMs - 380) {
    alpha = Math.max(0, (banner.durationMs - elapsed) / 380);
  }

  const accent = STAGE_ACCENT_HEX[banner.stage] ?? '#38BDF8';
  const textTime = banner.timerText;
  const textSep = ' — ';
  const maxLabelChars = 48;
  const labelDisplay =
    banner.label.length > maxLabelChars
      ? `${banner.label.slice(0, maxLabelChars - 1)}…`
      : banner.label;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.font = '700 18px "JetBrains Mono", monospace';
  const timeW = ctx.measureText(textTime).width;
  ctx.font = '600 18px "IBM Plex Sans", sans-serif';
  const sepW = ctx.measureText(textSep).width;
  const labelW = ctx.measureText(labelDisplay).width;

  const padLeft = 22;
  const padRight = 20;
  const boxH = 44;
  const boxW = Math.min(430, Math.max(220, padLeft + timeW + sepW + labelW + padRight));
  // Positioned cleanly to the right of the bottom-left CEI SOCHIPE broadcast logo
  const boxX = 144;
  const boxY = CANVAS_HEIGHT - boxH - 22;

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Compact stage color dot indicator
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(boxX + 12, boxY + boxH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  const textY = boxY + 28;
  ctx.fillStyle = accent;
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText(textTime, boxX + padLeft, textY);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 18px "IBM Plex Sans", sans-serif';
  ctx.fillText(textSep, boxX + padLeft + timeW, textY);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 18px "IBM Plex Sans", sans-serif';
  ctx.fillText(labelDisplay, boxX + padLeft + timeW + sepW, textY);

  ctx.restore();
}

const COPYRIGHT_WATERMARK_TEXT =
  'Video hecho en SimRec Neonatal HUD SOCHIPE / Creado por Mat. Carlos Solar, Reservados todos los derechos';

function drawCopyrightWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.font = '500 12.5px "IBM Plex Sans", system-ui, sans-serif';
  const textWidth = ctx.measureText(COPYRIGHT_WATERMARK_TEXT).width;

  const padX = 10;
  const boxH = 26;
  const boxW = Math.ceil(textWidth + padX * 2);
  const marginRight = 18;
  const marginBottom = 16;
  const boxX = CANVAS_WIDTH - boxW - marginRight;
  const boxY = CANVAS_HEIGHT - boxH - marginBottom;

  // Subtle dark semi-transparent backing for legibility over bright clinical linens
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();

  // Crisp white text (opacity ~0.78) with dark drop shadow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.textBaseline = 'middle';
  ctx.fillText(COPYRIGHT_WATERMARK_TEXT, boxX + padX, boxY + boxH / 2);

  ctx.restore();
}

export function renderCompositorFrame(rc: HudRenderContext) {
  drawVideoOrStandby(rc.ctx, rc.video, rc.hasVideoFeed, rc.mirrorVideo);

  if (rc.hudLayout === 'top') {
    drawCompactTopHud(rc);
  } else {
    drawTopBarAndSideHud(rc);
  }

  // Embed transparent institutional CEI SOCHIPE broadcast bug into recorded video
  drawBroadcastInstitutionalBug(rc.ctx, rc.institutionalLogo);

  // Permanent bottom-right institutional copyright watermark (excluded from student monitor)
  drawCopyrightWatermark(rc.ctx);

  // Optional 3-second temporary milestone banner embedded in recorded video
  drawTemporaryMilestoneBanner(rc.ctx, rc.activeBanner, rc.nowMs);
}
