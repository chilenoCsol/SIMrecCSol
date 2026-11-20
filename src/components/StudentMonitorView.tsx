import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Heart,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HYPOTHERMIA_THRESHOLD, NRP_PRESETS } from '../data/nrpPresets';
import { useClinicalAlarmLoop } from '../hooks/useClinicalAlarmLoop';
import {
  MonitorSyncMessage,
  MonitorSyncPayload,
  PlethColorMode,
  SensorConnections,
  VitalParams,
} from '../types/simulation';
import { ALARM_SILENCE_DURATION_MS, clinicalAudioCue } from '../utils/audioCue';
import { formatTimerMMSS } from '../utils/hudRenderer';
import { loadProcessedSochipeLogo } from '../utils/logoProcessor';
import {
  MONITOR_SYNC_STORAGE_KEY,
  computeSyncedTimerSeconds,
  createMonitorChannel,
  extractSensorsFromPayload,
  extractVitalsFromPayload,
  isValidSyncPayload,
  loadMonitorStateFromStorage,
  normalizeSyncPayload,
  requestMonitorState,
} from '../utils/monitorSync';
import {
  WAVE_BUFFER_SIZE,
  createWaveformEngineState,
  stepWaveformEngine,
} from '../utils/waveformEngine';

interface AlarmItem {
  id: string;
  label: string;
  severity: 'critical' | 'warning';
}

const HUB_CONNECTION_TIMEOUT_MS = 5500;

const DEFAULT_SYNC_STATE: MonitorSyncPayload = {
  hr: NRP_PRESETS[0].hr,
  spo2: NRP_PRESETS[0].spo2,
  temp: NRP_PRESETS[0].temp,
  rhythm: NRP_PRESETS[0].rhythm,
  lead: 'DII',
  ecgConnected: true,
  spo2Connected: true,
  tempConnected: true,
  timerSeconds: 0,
  isRunning: false,
  alarmSilenced: false,
  alarmSilencedUntilMs: null,
  activeAlerts: [],
  plethColorMode: 'cyan',
  timerAnchorEpochMs: Date.now(),
  updatedAt: 0,
};

function drawFullMonitorWave(
  canvas: HTMLCanvasElement,
  buffer: Float32Array,
  writeIndex: number,
  color: string,
  glowColor: string,
  mapValueToY: (val: number, h: number) => number
) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  // Clinical obsidian monitor background
  ctx.fillStyle = '#030508';
  ctx.fillRect(0, 0, w, h);

  // Calibrated subtle monitor grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 1;
  const cols = 12;
  const rows = 4;
  for (let i = 1; i < cols; i++) {
    const gx = (w * i) / cols;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const gy = (h * j) / rows;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Oscilloscope sweep with erase gap ahead of write cursor
  const gapSamples = 11;
  const stepX = w / (WAVE_BUFFER_SIZE - 1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 9;

  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i < WAVE_BUFFER_SIZE; i++) {
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

    const px = i * stepX;
    const py = mapValueToY(buffer[i], h);

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

  // Bright phosphor beam head
  const headIdx = (writeIndex - 1 + WAVE_BUFFER_SIZE) % WAVE_BUFFER_SIZE;
  const headX = headIdx * stepX;
  const headY = mapValueToY(buffer[headIdx], h);

  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(headX, headY, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDisconnectedMonitorWave(canvas: HTMLCanvasElement, message: string) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.fillStyle = '#030508';
  ctx.fillRect(0, 0, w, h);

  // Subtle calibration grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const gx = (w * i) / 12;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let j = 1; j < 4; j++) {
    const gy = (h * j) / 4;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Flat dashed baseline
  const midY = h * 0.55;
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.48)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(16, midY);
  ctx.lineTo(w - 16, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Clear centered disconnected label
  const fontSize = Math.max(14, Math.min(20, Math.round(w * 0.02)));
  ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
  const textW = ctx.measureText(message).width;
  const boxW = Math.min(w - 32, textW + 32);
  const boxH = fontSize + 20;
  const boxX = (w - boxW) / 2;
  const boxY = midY - boxH / 2;

  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fillStyle = 'rgba(11, 16, 25, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, w / 2, midY + 1);
  ctx.restore();
}

export const StudentMonitorView: React.FC = () => {
  // Hydrate immediately from localStorage ('simrec_live_state') on load
  const initialStored = loadMonitorStateFromStorage() ?? DEFAULT_SYNC_STATE;
  const initialVitals = extractVitalsFromPayload(initialStored);

  const [syncState, setSyncState] = useState<MonitorSyncPayload>(initialStored);
  const [displayedVitals, setDisplayedVitals] = useState<VitalParams>(initialVitals);
  const [timerSeconds, setTimerSeconds] = useState<number>(() =>
    computeSyncedTimerSeconds(initialStored)
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0.65);
  const [localAlarmSilencedUntilMs, setLocalAlarmSilencedUntilMs] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  // Live HUB link status tracking
  const [hubConnected, setHubConnected] = useState<boolean>(() => {
    return initialStored.updatedAt > 0 && Date.now() - initialStored.updatedAt < HUB_CONNECTION_TIMEOUT_MS;
  });
  const lastHubSignalMsRef = useRef<number>(
    initialStored.updatedAt > 0 && Date.now() - initialStored.updatedAt < HUB_CONNECTION_TIMEOUT_MS
      ? Date.now()
      : 0
  );

  const effectiveSilencedUntilMs = (() => {
    const remote = syncState.alarmSilencedUntilMs ?? null;
    if (remote && localAlarmSilencedUntilMs) {
      return Math.max(remote, localAlarmSilencedUntilMs);
    }
    return remote ?? localAlarmSilencedUntilMs;
  })();

  const activeSensors = extractSensorsFromPayload(syncState);

  const { alarmPriority, isAlarmSilenced, silenceRemainingSec } = useClinicalAlarmLoop(
    displayedVitals,
    activeSensors,
    soundEnabled,
    effectiveSilencedUntilMs
  );

  // Process transparent CEI SOCHIPE institutional logo for bottom-left corner
  useEffect(() => {
    let active = true;
    loadProcessedSochipeLogo()
      .then((processed) => {
        if (active) setLogoDataUrl(processed.dataUrl);
      })
      .catch(() => {
        // Ignore logo load error gracefully
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync audio synthesizer volume
  useEffect(() => {
    clinicalAudioCue.setVolume(audioVolume);
  }, [audioVolume]);

  const handleToggleAudio = () => {
    clinicalAudioCue.unlock();
    setSoundEnabled((prev) => !prev);
  };

  const handleToggleLocalSilence = () => {
    clinicalAudioCue.unlock();
    if (isAlarmSilenced) {
      setLocalAlarmSilencedUntilMs(null);
      setSyncState((prev) => ({ ...prev, alarmSilenced: false, alarmSilencedUntilMs: null }));
    } else {
      setLocalAlarmSilencedUntilMs(Date.now() + ALARM_SILENCE_DURATION_MS);
    }
  };

  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const plethCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformRef = useRef(createWaveformEngineState());

  const targetRef = useRef<{
    vitals: VitalParams;
    sensors: SensorConnections;
    plethColorMode: PlethColorMode;
    soundEnabled: boolean;
  }>({
    vitals: initialVitals,
    sensors: extractSensorsFromPayload(initialStored),
    plethColorMode: initialStored.plethColorMode,
    soundEnabled: false,
  });

  const liveVitalsRef = useRef<VitalParams>({ ...initialVitals });
  const syncStateRef = useRef<MonitorSyncPayload>(initialStored);

  useEffect(() => {
    syncStateRef.current = syncState;
    targetRef.current = {
      vitals: extractVitalsFromPayload(syncState),
      sensors: extractSensorsFromPayload(syncState),
      plethColorMode: syncState.plethColorMode,
      soundEnabled,
    };
  }, [syncState, soundEnabled]);

  // Document title for bedside student window
  useEffect(() => {
    document.title = 'SimRec Neonatal HUD SOCHIPE — Monitor Multiparámetro';
  }, []);

  // Triple-shielded real-time sync: BroadcastChannel + localStorage 'storage' event + window postMessage
  useEffect(() => {
    const channel = createMonitorChannel();

    const applyIncomingState = (rawPayload: MonitorSyncPayload) => {
      if (!isValidSyncPayload(rawPayload)) return;
      const payload = normalizeSyncPayload(rawPayload);

      lastHubSignalMsRef.current = Date.now();
      setHubConnected(true);

      const nextVitals = extractVitalsFromPayload(payload);
      const nextSensors = extractSensorsFromPayload(payload);
      syncStateRef.current = payload;
      targetRef.current = {
        ...targetRef.current,
        vitals: nextVitals,
        sensors: nextSensors,
        plethColorMode: payload.plethColorMode,
      };

      // Apply each incoming step (instant or 250ms physiological ramp step) immediately with zero lag
      liveVitalsRef.current = { ...nextVitals };
      setDisplayedVitals(nextVitals);
      setSyncState(payload);
      setTimerSeconds(computeSyncedTimerSeconds(payload));
    };

    const handleSyncMessage = (msg: MonitorSyncMessage | null | undefined) => {
      if (msg && msg.type === 'SYNC_STATE' && msg.payload) {
        applyIncomingState(msg.payload);
      }
    };

    // 1. BroadcastChannel('simrec-monitor-sync')
    if (channel) {
      channel.onmessage = (event: MessageEvent<MonitorSyncMessage>) => {
        handleSyncMessage(event.data);
      };
    }

    // 2. Cross-window localStorage ('simrec_live_state') listener
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MONITOR_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (isValidSyncPayload(parsed)) {
          applyIncomingState(parsed);
        }
      } catch {
        // Ignore malformed storage data
      }
    };

    // 3. Direct postMessage listener (iframe-to-popup fallback bridge)
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const msg = event.data as MonitorSyncMessage;
      if (msg.type === 'SYNC_STATE') {
        handleSyncMessage(msg);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleWindowMessage);

    // Initial handshake: read fresh localStorage snapshot + emit REQUEST_STATE immediately
    const storedNow = loadMonitorStateFromStorage();
    if (storedNow) {
      const nextVitals = extractVitalsFromPayload(storedNow);
      syncStateRef.current = storedNow;
      liveVitalsRef.current = { ...nextVitals };
      targetRef.current = {
        ...targetRef.current,
        vitals: nextVitals,
        sensors: extractSensorsFromPayload(storedNow),
        plethColorMode: storedNow.plethColorMode,
      };
      setSyncState(storedNow);
      setDisplayedVitals(nextVitals);
      setTimerSeconds(computeSyncedTimerSeconds(storedNow));
    }
    requestMonitorState(channel);

    // Periodic liveness check & automatic reconnect handshake if HUB signal drops
    const livenessInterval = window.setInterval(() => {
      const elapsedSinceSignal = Date.now() - lastHubSignalMsRef.current;
      if (lastHubSignalMsRef.current === 0 || elapsedSinceSignal > HUB_CONNECTION_TIMEOUT_MS) {
        setHubConnected(false);
        requestMonitorState(channel);
      }
    }, 1500);

    return () => {
      window.clearInterval(livenessInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleWindowMessage);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  // Track Fullscreen API state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection if blocked by embedded sandbox policy
    }
  };

  // Main real-time bedside monitor RAF loop (oscilloscopes, gradual ramp, synced timer, QRS audio)
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let lastUiSyncMs = 0;
    let beatResetTimeout = 0;

    const tick = (now: number) => {
      const dtSec = Math.min((now - lastTime) / 1000, 0.15);
      lastTime = now;

      const {
        vitals: target,
        sensors: liveSensors,
        plethColorMode,
        soundEnabled: audioOn,
      } = targetRef.current;
      const current = liveVitalsRef.current;

      current.rhythm = target.rhythm;
      current.lead = target.lead;
      current.hr = target.hr;
      current.spo2 = target.spo2;
      current.temp = target.temp;

      const stepResult = stepWaveformEngine(
        waveformRef.current,
        dtSec,
        current.hr,
        current.spo2,
        current.lead,
        current.rhythm
      );

      // Smart pulse tone & heart-icon beat sync:
      // Caso A (ECG ON): QRS-synced
      // Caso B (ECG OFF + SpO2 ON): Pleth-synced
      // Caso C (Both OFF): silent & static
      const hasPulse =
        current.rhythm !== 'asistolia' && current.rhythm !== 'pea' && current.hr > 0;
      if (liveSensors.ecgConnected) {
        if (stepResult.ecgBeatOccurred) {
          if (audioOn) {
            clinicalAudioCue.playBeat(current.spo2, hasPulse, liveSensors.spo2Connected);
          }
          setBeatPulse(true);
          window.clearTimeout(beatResetTimeout);
          beatResetTimeout = window.setTimeout(() => setBeatPulse(false), 140);
        }
      } else if (liveSensors.spo2Connected) {
        if (stepResult.plethBeatOccurred) {
          if (audioOn) {
            clinicalAudioCue.playBeat(current.spo2, true, true);
          }
          setBeatPulse(true);
          window.clearTimeout(beatResetTimeout);
          beatResetTimeout = window.setTimeout(() => setBeatPulse(false), 140);
        }
      }

      // Render crisp ECG & Plethysmography canvases (or dashed SENSOR NO CONECTADO tracks)
      if (ecgCanvasRef.current) {
        if (liveSensors.ecgConnected) {
          drawFullMonitorWave(
            ecgCanvasRef.current,
            waveformRef.current.ecgBuffer,
            waveformRef.current.writeIndex,
            '#22C55E',
            'rgba(34, 197, 94, 0.6)',
            (val, h) => h * 0.66 - val * (h * 0.54)
          );
        } else {
          drawDisconnectedMonitorWave(ecgCanvasRef.current, 'ECG: SENSOR NO CONECTADO');
        }
      }

      if (plethCanvasRef.current) {
        if (liveSensors.spo2Connected) {
          const plethColor = plethColorMode === 'yellow' ? '#FACC15' : '#38BDF8';
          const plethGlow =
            plethColorMode === 'yellow'
              ? 'rgba(250, 204, 21, 0.55)'
              : 'rgba(56, 189, 248, 0.55)';
          drawFullMonitorWave(
            plethCanvasRef.current,
            waveformRef.current.plethBuffer,
            waveformRef.current.writeIndex,
            plethColor,
            plethGlow,
            (val, h) => h * 0.85 - val * (h * 0.72)
          );
        } else {
          drawDisconnectedMonitorWave(plethCanvasRef.current, 'SatO2: SENSOR NO CONECTADO');
        }
      }

      // Update React numeric readouts & stopwatch at ~10 Hz
      if (now - lastUiSyncMs >= 100) {
        lastUiSyncMs = now;
        setDisplayedVitals({ ...current });
        setTimerSeconds(computeSyncedTimerSeconds(syncStateRef.current));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.clearTimeout(beatResetTimeout);
    };
  }, []);

  const { ecgConnected, spo2Connected, tempConnected } = activeSensors;
  const hrSource: 'ecg' | 'spo2' | 'none' = ecgConnected
    ? 'ecg'
    : spo2Connected
    ? 'spo2'
    : 'none';

  const hrRounded =
    displayedVitals.rhythm === 'asistolia' ? 0 : Math.round(displayedVitals.hr);
  const spo2Rounded = Math.round(displayedVitals.spo2);
  const isAsystole = displayedVitals.rhythm === 'asistolia' || hrRounded === 0;
  const isPea = displayedVitals.rhythm === 'pea';
  const noPulse = isAsystole || isPea;
  const isSevereBrady = !isAsystole && hrRounded < 60;
  const isMildBrady = !isAsystole && hrRounded >= 60 && hrRounded < 100;
  const isDesaturated = spo2Connected && !noPulse && spo2Rounded < 80;
  const isHypothermia = tempConnected && displayedVitals.temp < HYPOTHERMIA_THRESHOLD;

  const plethTextClass =
    syncState.plethColorMode === 'yellow' ? 'text-amber-300' : 'text-sky-400';

  // Build objective clinical monitor alarms ONLY for connected sensors (zero false alarms!)
  const alarms: AlarmItem[] = [];
  if (hrSource === 'ecg') {
    if (isAsystole) {
      alarms.push({ id: 'asystole', label: 'ASISTOLIA', severity: 'critical' });
    } else if (isPea) {
      alarms.push({ id: 'pea', label: 'SIN PULSO DETECTABLE', severity: 'critical' });
    } else if (isSevereBrady) {
      alarms.push({ id: 'brady60', label: 'BRADICARDIA < 60 lpm', severity: 'critical' });
    } else if (isMildBrady) {
      alarms.push({ id: 'brady100', label: 'BRADICARDIA < 100 lpm', severity: 'warning' });
    }
  } else if (hrSource === 'spo2') {
    if (noPulse) {
      alarms.push({ id: 'nopulse', label: 'SIN PULSO DETECTABLE', severity: 'critical' });
    } else if (isSevereBrady) {
      alarms.push({ id: 'brady60', label: 'BRADICARDIA < 60 lpm', severity: 'critical' });
    } else if (isMildBrady) {
      alarms.push({ id: 'brady100', label: 'BRADICARDIA < 100 lpm', severity: 'warning' });
    }
  }

  if (isDesaturated) {
    alarms.push({ id: 'desat', label: 'DESATURACIÓN < 80%', severity: 'warning' });
  }

  if (isHypothermia) {
    alarms.push({ id: 'hypo', label: 'HIPOTERMIA < 36.5 °C', severity: 'critical' });
  }

  const hasCriticalAlarm = alarms.some((a) => a.severity === 'critical');
  const allSensorsDisconnected = !ecgConnected && !spo2Connected && !tempConnected;

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-slate-100 flex flex-col select-none">
      {/* Top Clinical Monitor Strip: Synced Stopwatch + Objective Alarms + HUB Link Indicator & Controls */}
      <header className="shrink-0 h-20 sm:h-24 px-4 sm:px-6 border-b border-slate-800/90 bg-[#05080E] flex items-center justify-between gap-4">
        {/* Synced NRP Resuscitation Stopwatch */}
        <div className="flex items-baseline gap-4 shrink-0">
          <div>
            <div className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
              Cronómetro NRP
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-bold tabular-nums tracking-tight text-white leading-none mt-1">
              {formatTimerMMSS(timerSeconds)}
            </div>
          </div>
          <div className="hidden md:flex flex-col gap-1">
            <span className="text-xs font-mono text-slate-500">
              {syncState.isRunning ? 'EN CURSO' : 'EN ESPERA'}
            </span>
            {/* Real-time HUB Connection Status Indicator */}
            <span
              className={`text-[11px] font-mono whitespace-nowrap ${
                hubConnected ? 'text-emerald-400' : 'text-amber-300'
              }`}
              title={
                hubConnected
                  ? 'Sincronizado en tiempo real con la consola del instructor'
                  : 'Abre o mantén activa la ventana principal del instructor para recibir señal en vivo'
              }
            >
              {hubConnected ? '● En línea con HUB' : '○ Esperando señal del HUB'}
            </span>
          </div>
        </div>

        {/* Clinical Alarm Banner (Center) */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          {alarms.length > 0 ? (
            <div
              role="alert"
              className={`w-full max-w-3xl px-4 py-2.5 rounded-md border flex flex-wrap items-center justify-center gap-x-5 gap-y-1 ${
                hasCriticalAlarm
                  ? 'bg-red-600/25 border-red-500 text-red-100 animate-pulse'
                  : 'bg-amber-500/20 border-amber-400 text-amber-100'
              }`}
            >
              {alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm md:text-base font-mono font-bold tracking-wide whitespace-nowrap"
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      alarm.severity === 'critical' ? 'text-red-400' : 'text-amber-300'
                    }`}
                  />
                  <span>{alarm.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>MONITOR NEONATAL</span>
              <span aria-hidden="true">·</span>
              <span className={allSensorsDisconnected ? 'text-amber-400/80' : ''}>
                {allSensorsDisconnected ? 'SENSORES NO CONECTADOS' : 'PARÁMETROS EN RANGO'}
              </span>
            </div>
          )}
        </div>

        {/* Discrete Corner Controls: Mobile HUB indicator + Audio QRS/Alarms, Volume, Alarm Pause & Fullscreen */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Compact HUB status visible on small viewports where left label is hidden */}
          <span
            className={`md:hidden text-[11px] font-mono whitespace-nowrap ${
              hubConnected ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {hubConnected ? '● HUB' : '○ HUB'}
          </span>

          {(alarmPriority !== 'none' || isAlarmSilenced) && (
            <button
              type="button"
              onClick={handleToggleLocalSilence}
              title={
                isAlarmSilenced
                  ? 'Alarma silenciada temporalmente (clic para reactivar)'
                  : 'Silenciar alarma cardiorrespiratoria por 2 minutos'
              }
              className={`h-10 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isAlarmSilenced
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                  : 'bg-red-500/20 border-red-500/60 text-red-200 hover:bg-red-500/30'
              }`}
            >
              {isAlarmSilenced ? (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{formatTimerMMSS(silenceRemainingSec)}</span>
                </>
              ) : (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Silenciar 2m</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 h-10 px-2.5 rounded-md border border-slate-800 bg-[#0C121D]">
            <button
              type="button"
              onClick={handleToggleAudio}
              title={soundEnabled ? 'Silenciar audio clínico' : 'Activar audio clínico (QRS y alarmas)'}
              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                soundEnabled ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              <span className="hidden md:inline">{soundEnabled ? 'Audio' : 'Silencio'}</span>
            </button>

            <input
              type="range"
              aria-label="Volumen del monitor"
              min={0}
              max={100}
              step={5}
              value={Math.round(audioVolume * 100)}
              onChange={(e) => setAudioVolume(Number(e.target.value) / 100)}
              style={{ '--slider-accent': '#38bdf8' } as React.CSSProperties}
              className="clinical-slider !w-16 sm:!w-20"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Activar pantalla completa'}
            className="h-10 px-3 inline-flex items-center gap-2 rounded-md border border-slate-800 bg-[#0C121D] text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="hidden lg:inline">
              {isFullscreen ? 'Salir' : 'Pantalla Completa'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Multiparameter Body */}
      <main className="flex-1 min-h-0 flex flex-col divide-y divide-slate-800/90">
        {/* ROW 1: ECG Oscilloscope + Smart Heart Rate / Pulse Numeric (FC ECG vs FP SpO2 vs ---) */}
        <section
          aria-label="Monitor de ECG y Frecuencia Cardíaca"
          className="flex-[44] min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/90"
        >
          {/* ECG Waveform */}
          <div className="relative flex-1 min-h-0 bg-[#030508]">
            <div className="absolute top-3 left-4 z-10 flex items-center gap-3 pointer-events-none">
              <span
                className={`text-sm sm:text-base font-mono font-bold ${
                  ecgConnected ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {ecgConnected ? `ECG ${displayedVitals.lead}` : 'ECG OFF'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {ecgConnected ? '25 mm/s · 1.0 mV' : 'DERIVACIONES DESCONECTADAS'}
              </span>
            </div>
            <canvas ref={ecgCanvasRef} className="block w-full h-full" />
          </div>

          {/* FC / FP Numeric Readout */}
          <div
            className={`w-full md:w-[320px] lg:w-[380px] shrink-0 px-6 py-4 flex flex-col justify-between transition-colors ${
              (hrSource === 'ecg' && (isAsystole || isSevereBrady)) ||
              (hrSource === 'spo2' && (noPulse || isSevereBrady))
                ? 'bg-red-950/35'
                : 'bg-[#05080E]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-sm sm:text-base font-semibold tracking-wide ${
                    hrSource === 'ecg'
                      ? 'text-emerald-400'
                      : hrSource === 'spo2'
                      ? plethTextClass
                      : 'text-slate-500'
                  }`}
                >
                  {hrSource === 'ecg'
                    ? 'FC (ECG)'
                    : hrSource === 'spo2'
                    ? 'FP (SpO2)'
                    : 'FC / FP'}
                </span>
                <span className="text-xs font-mono text-slate-500">lpm</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                  180 / 100
                </span>
                <Heart
                  className={`w-5 h-5 transition-transform duration-100 ${
                    hrSource === 'ecg' && !isAsystole && beatPulse
                      ? 'text-emerald-400 fill-emerald-400 scale-125'
                      : hrSource === 'spo2' && !noPulse && beatPulse
                      ? syncState.plethColorMode === 'yellow'
                        ? 'text-amber-300 fill-amber-300 scale-125'
                        : 'text-sky-400 fill-sky-400 scale-125'
                      : 'text-slate-800 scale-100'
                  }`}
                />
              </div>
            </div>

            <div className="my-auto flex items-baseline justify-end">
              <span
                className={`font-mono font-bold tabular-nums leading-none tracking-tight ${
                  hrSource === 'none'
                    ? 'text-slate-600'
                    : hrSource === 'ecg'
                    ? isAsystole || isSevereBrady
                      ? 'text-red-400'
                      : isMildBrady
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                    : noPulse
                    ? 'text-slate-500'
                    : isSevereBrady
                    ? 'text-red-400'
                    : isMildBrady
                    ? 'text-amber-300'
                    : plethTextClass
                }`}
                style={{ fontSize: 'clamp(4.25rem, 9.5vw, 8.5rem)' }}
              >
                {hrSource === 'none'
                  ? '---'
                  : hrSource === 'ecg'
                  ? hrRounded
                  : noPulse
                  ? '---'
                  : hrRounded}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">
                {hrSource === 'ecg'
                  ? `DERIVADA ${displayedVitals.lead}`
                  : hrSource === 'spo2'
                  ? 'ORIGEN: PULSIOXIMETRÍA'
                  : 'SIN SENSOR ACTIVO'}
              </span>
              {hrSource === 'ecg' && (isAsystole || isPea || isSevereBrady || isMildBrady) && (
                <span
                  className={`font-semibold ${
                    isAsystole || isPea || isSevereBrady ? 'text-red-400' : 'text-amber-300'
                  }`}
                >
                  {isAsystole
                    ? '▲ ASISTOLIA'
                    : isPea
                    ? '▲ SIN PULSO'
                    : isSevereBrady
                    ? '▲ < 60 lpm'
                    : '▲ < 100 lpm'}
                </span>
              )}
              {hrSource === 'spo2' && (noPulse || isSevereBrady || isMildBrady) && (
                <span
                  className={`font-semibold ${
                    noPulse || isSevereBrady ? 'text-red-400' : 'text-amber-300'
                  }`}
                >
                  {noPulse
                    ? '▲ SIN PULSO'
                    : isSevereBrady
                    ? '▲ < 60 lpm'
                    : '▲ < 100 lpm'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ROW 2: SpO2 Plethysmograph + Large Saturation Numeric */}
        <section
          aria-label="Monitor de Oximetría SatO2"
          className="flex-[38] min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/90"
        >
          {/* Plethysmography Waveform */}
          <div className="relative flex-1 min-h-0 bg-[#030508]">
            <div className="absolute top-3 left-4 z-10 flex items-center gap-3 pointer-events-none">
              <span
                className={`text-sm sm:text-base font-mono font-bold ${
                  spo2Connected ? plethTextClass : 'text-slate-500'
                }`}
              >
                {spo2Connected ? 'SatO₂' : 'SatO₂ OFF'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {spo2Connected ? 'PLETISMOGRAFÍA' : 'SENSOR DESCONECTADO'}
              </span>
            </div>
            <canvas ref={plethCanvasRef} className="block w-full h-full" />
          </div>

          {/* SpO2 Numeric Readout */}
          <div
            className={`w-full md:w-[320px] lg:w-[380px] shrink-0 px-6 py-4 flex flex-col justify-between transition-colors ${
              spo2Connected && (isDesaturated || noPulse) ? 'bg-amber-950/20' : 'bg-[#05080E]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-sm sm:text-base font-semibold tracking-wide ${
                    spo2Connected ? plethTextClass : 'text-slate-500'
                  }`}
                >
                  SatO₂
                </span>
                <span className="text-xs font-mono text-slate-500">%</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">100 / 85</span>
            </div>

            <div className="my-auto flex items-baseline justify-end gap-2">
              <span
                className={`font-mono font-bold tabular-nums leading-none tracking-tight ${
                  !spo2Connected ? 'text-slate-600' : noPulse ? 'text-slate-500' : plethTextClass
                }`}
                style={{ fontSize: 'clamp(4rem, 9vw, 8rem)' }}
              >
                {!spo2Connected ? '---' : noPulse ? '--' : spo2Rounded}
              </span>
              <span
                className={`text-2xl sm:text-3xl font-mono font-semibold ${
                  spo2Connected ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                %
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">PREDUCTAL</span>
              {!spo2Connected ? (
                <span className="font-semibold text-amber-400/80">SENSOR NO CONECTADO</span>
              ) : noPulse ? (
                <span className="font-semibold text-red-400">▲ SIN SEÑAL DE PULSO</span>
              ) : isDesaturated ? (
                <span className="font-semibold text-amber-300">▲ DESATURACIÓN</span>
              ) : (
                <span className="text-slate-500">SEÑAL ESTABLE</span>
              )}
            </div>
          </div>
        </section>

        {/* ROW 3: Temperature Bar with Bottom-Left Institutional CEI SOCHIPE TV-Bug Logo */}
        <section
          aria-label="Monitor de Temperatura"
          className={`relative flex-[18] min-h-[104px] px-5 sm:px-6 py-3 flex items-center justify-between gap-5 transition-colors ${
            isHypothermia
              ? 'bg-red-950/50 border-t-2 border-t-red-500'
              : 'bg-[#05080E]'
          }`}
        >
          <div className="flex items-center gap-5 min-w-0">
            {/* Transparent broadcast-style CEI SOCHIPE institutional logo in bottom-left */}
            {logoDataUrl && (
              <img
                src={logoDataUrl}
                alt="CEI SOCHIPE — Sociedad Chilena de Pediatría"
                referrerPolicy="no-referrer"
                className="w-[82px] sm:w-[94px] h-auto object-contain opacity-85 shrink-0 pointer-events-none select-none"
              />
            )}

            <div>
              <div
                className={`text-xs sm:text-sm font-semibold tracking-wide ${
                  tempConnected ? 'text-amber-200' : 'text-slate-500'
                }`}
              >
                TEMPERATURA
              </div>
              <div
                className={`text-xs font-mono mt-0.5 ${
                  tempConnected ? 'text-slate-400' : 'text-amber-400/85 font-semibold'
                }`}
              >
                {tempConnected
                  ? 'Rango objetivo: 36.5 – 37.5 °C'
                  : 'SENSOR NO CONECTADO'}
              </div>
            </div>

            {isHypothermia && (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-red-600/30 border border-red-500 text-red-100 text-xs sm:text-sm font-mono font-bold animate-pulse whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>ALERTA HIPOTERMIA (&lt; 36.5 °C)</span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-2 shrink-0">
            <span
              className={`font-mono font-bold tabular-nums leading-none ${
                !tempConnected
                  ? 'text-slate-600'
                  : isHypothermia
                  ? 'text-white'
                  : 'text-amber-200'
              }`}
              style={{ fontSize: 'clamp(2.5rem, 5.2vw, 4.5rem)' }}
            >
              {tempConnected ? displayedVitals.temp.toFixed(1) : '--.-'}
            </span>
            <span
              className={`text-xl sm:text-2xl font-mono font-semibold ${
                tempConnected ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              °C
            </span>
          </div>
        </section>
      </main>
    </div>
  );
};
