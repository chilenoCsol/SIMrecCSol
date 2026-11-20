import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { CanvasStage } from './components/CanvasStage';
import { DebriefEventLogger } from './components/DebriefEventLogger';
import { InstructorPanel } from './components/InstructorPanel';
import { MonitorAudioBar } from './components/MonitorAudioBar';
import { RecordingToolbar } from './components/RecordingToolbar';
import { StudentMonitorView } from './components/StudentMonitorView';
import { NRP_PRESETS } from './data/nrpPresets';
import { useClinicalAlarmLoop } from './hooks/useClinicalAlarmLoop';
import {
  CanvasMilestoneBanner,
  CardiacRhythm,
  DebriefEvent,
  DebriefMilestoneDef,
  DebriefStage,
  HudLayoutMode,
  MonitorSyncMessage,
  MonitorSyncPayload,
  NrpPreset,
  PlethColorMode,
  RampStatus,
  RecordedClip,
  RecordingState,
  SensorConnections,
  ThemeMode,
  TransitionDurationSec,
  VitalParams,
} from './types/simulation';
import { ALARM_SILENCE_DURATION_MS, clinicalAudioCue } from './utils/audioCue';
import { findMatchingMicForCamera } from './utils/audioDeviceMatcher';
import { downloadDebriefCsv } from './utils/debriefExport';
import { formatTimerMMSS } from './utils/hudRenderer';
import {
  computeActiveClinicalAlerts,
  createMonitorChannel,
  publishMonitorState,
} from './utils/monitorSync';

const THEME_STORAGE_KEY = 'simrec_theme';

function loadSavedTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

const AMBIENT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
};

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

function describeVideoFormat(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4')) {
    if (lower.includes('avc1') || lower.includes('h264')) {
      return 'MP4 (H.264)';
    }
    return 'MP4';
  }
  if (lower.includes('vp9')) {
    return 'WebM (VP9)';
  }
  if (lower.includes('webm')) {
    return 'WebM';
  }
  return 'WebM';
}

function buildClipBaseName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `SimRec_NRP_${datePart}_${timePart}`;
}

function buildClipFilename(baseName: string, mimeType: string): string {
  const ext = mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
  return `${baseName}.${ext}`;
}

function isStudentMonitorMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('view') === 'student';
}

export default function App() {
  if (isStudentMonitorMode()) {
    return <StudentMonitorView />;
  }
  return <InstructorRecorderApp />;
}

function InstructorRecorderApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const clipDurationAccumRef = useRef<number>(0);
  const clipSegmentStartMsRef = useRef<number | null>(null);
  const discardRecordingOnStopRef = useRef<boolean>(false);
  const monitorChannelRef = useRef<BroadcastChannel | null>(null);
  const studentWindowRef = useRef<Window | null>(null);
  const timerSecondsRef = useRef<number>(0);

  // Explicit boolean Light/Dark theme state persisted in localStorage — affects Instructor Panel only
  const [isLightMode, setIsLightMode] = useState<boolean>(() => loadSavedTheme() === 'light');

  // Sync data-theme attribute on documentElement for slider/scrollbar/page base styling (never runs in StudentMonitorView)
  useEffect(() => {
    const mode: ThemeMode = isLightMode ? 'light' : 'dark';
    document.documentElement.dataset.theme = mode;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [isLightMode]);

  const handleToggleTheme = useCallback(() => {
    setIsLightMode((prev) => {
      const nextIsLight = !prev;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextIsLight ? 'light' : 'dark');
      } catch {
        // Ignore storage write errors
      }
      return nextIsLight;
    });
  }, []);

  // Media devices state (cameras + microphones)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [micAutoMatched, setMicAutoMatched] = useState<boolean>(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [hasVideoFeed, setHasVideoFeed] = useState(false);
  const [hasMicTrack, setHasMicTrack] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [mirrorVideo, setMirrorVideo] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.65);
  const [alarmSilencedUntilMs, setAlarmSilencedUntilMs] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Clinical simulation parameters: live vitals vs target vitals (for physiological ramp)
  const initialVitals: VitalParams = {
    hr: NRP_PRESETS[0].hr,
    spo2: NRP_PRESETS[0].spo2,
    temp: NRP_PRESETS[0].temp,
    rhythm: NRP_PRESETS[0].rhythm,
    lead: 'DII',
  };
  const [vitals, setVitals] = useState<VitalParams>(initialVitals);
  const [targetVitals, setTargetVitals] = useState<VitalParams>(initialVitals);
  const vitalsRef = useRef<VitalParams>(initialVitals);
  const targetVitalsRef = useRef<VitalParams>(initialVitals);
  vitalsRef.current = vitals;
  targetVitalsRef.current = targetVitals;

  const [activePresetId, setActivePresetId] = useState<string | null>(NRP_PRESETS[0].id);
  const [transitionDurationSec, setTransitionDurationSec] = useState<TransitionDurationSec>(0);
  const transitionDurationRef = useRef<TransitionDurationSec>(0);
  transitionDurationRef.current = transitionDurationSec;

  const [rampStatus, setRampStatus] = useState<RampStatus>({
    active: false,
    durationSec: 0,
    remainingSec: 0,
    progressPct: 0,
  });
  const rampIntervalRef = useRef<number | null>(null);
  const activeRampRef = useRef<{
    startMs: number;
    durationMs: number;
    from: { hr: number; spo2: number; temp: number };
    to: { hr: number; spo2: number; temp: number };
    targetRhythm: CardiacRhythm;
  } | null>(null);

  const [plethColorMode, setPlethColorMode] = useState<PlethColorMode>('cyan');
  const [hudLayout, setHudLayout] = useState<HudLayoutMode>('side');
  const [sensors, setSensors] = useState<SensorConnections>({
    ecgConnected: true,
    spo2Connected: true,
    tempConnected: true,
  });

  const handleToggleSensor = useCallback((key: keyof SensorConnections) => {
    setSensors((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSetAllSensors = useCallback((connected: boolean) => {
    setSensors({
      ecgConnected: connected,
      spo2Connected: connected,
      tempConnected: connected,
    });
  }, []);

  // Cleanup active ramp interval on unmount
  useEffect(() => {
    return () => {
      if (rampIntervalRef.current !== null) {
        window.clearInterval(rampIntervalRef.current);
      }
    };
  }, []);

  // Resuscitation stopwatch & recording state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSyncVersion, setTimerSyncVersion] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [studentMonitorBlockedUrl, setStudentMonitorBlockedUrl] = useState<string | null>(null);

  // Detect browser's highest-priority supported recording MIME type (MP4 H.264 first)
  const detectedMimeType = useMemo(() => pickSupportedMimeType(), []);
  const detectedFormatLabel = useMemo(
    () => describeVideoFormat(detectedMimeType),
    [detectedMimeType]
  );
  const isMp4Supported = detectedMimeType.toLowerCase().includes('mp4');

  // Critical debriefing event log & optional 3-second video banner
  const [debriefEvents, setDebriefEvents] = useState<DebriefEvent[]>([]);
  const debriefEventsRef = useRef<DebriefEvent[]>(debriefEvents);
  debriefEventsRef.current = debriefEvents;
  const [showBannerInVideo, setShowBannerInVideo] = useState<boolean>(true);
  const [activeBanner, setActiveBanner] = useState<CanvasMilestoneBanner | null>(null);
  const liveVitalsSnapshotRef = useRef<VitalParams>({
    hr: NRP_PRESETS[0].hr,
    spo2: NRP_PRESETS[0].spo2,
    temp: NRP_PRESETS[0].temp,
    rhythm: NRP_PRESETS[0].rhythm,
    lead: 'DII',
  });
  const bannerTimeoutRef = useRef<number | null>(null);

  timerSecondsRef.current = timerSeconds;

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  // Keep Web Audio synthesizer master volume synced
  useEffect(() => {
    clinicalAudioCue.setVolume(audioVolume);
  }, [audioVolume]);

  // IEC 60601-1-8 cardiorespiratory alarm loop & 2-minute silence countdown (sensor-gated)
  const { alarmPriority, isAlarmSilenced, silenceRemainingSec } = useClinicalAlarmLoop(
    vitals,
    sensors,
    soundEnabled,
    alarmSilencedUntilMs
  );

  const handleToggleSound = useCallback(() => {
    clinicalAudioCue.unlock();
    setSoundEnabled((prev) => !prev);
  }, []);

  const handleChangeAudioVolume = useCallback((vol: number) => {
    clinicalAudioCue.setVolume(vol);
    setAudioVolume(vol);
  }, []);

  const handleToggleSilenceAlarm = useCallback(() => {
    clinicalAudioCue.unlock();
    setAlarmSilencedUntilMs((prev) => {
      if (prev !== null && prev > Date.now()) {
        return null;
      }
      return Date.now() + ALARM_SILENCE_DURATION_MS;
    });
  }, []);

  const buildSyncPayload = useCallback(
    (override?: Partial<MonitorSyncPayload>): MonitorSyncPayload => {
      const now = Date.now();
      const effectiveSilenced =
        alarmSilencedUntilMs !== null && alarmSilencedUntilMs > now;
      return {
        hr: vitals.hr,
        spo2: vitals.spo2,
        temp: vitals.temp,
        rhythm: vitals.rhythm,
        lead: vitals.lead,
        ecgConnected: sensors.ecgConnected,
        spo2Connected: sensors.spo2Connected,
        tempConnected: sensors.tempConnected,
        timerSeconds: timerSecondsRef.current,
        isRunning: timerRunning,
        alarmSilenced: effectiveSilenced,
        alarmSilencedUntilMs,
        activeAlerts: computeActiveClinicalAlerts(vitals, sensors),
        plethColorMode,
        timerAnchorEpochMs: now,
        updatedAt: now,
        ...override,
      };
    },
    [vitals, sensors, plethColorMode, timerRunning, alarmSilencedUntilMs]
  );

  const buildSyncPayloadRef = useRef(buildSyncPayload);
  buildSyncPayloadRef.current = buildSyncPayload;

  // Initialize BroadcastChannel('simrec-monitor-sync'), postMessage handshake listener, and 2s heartbeat
  useEffect(() => {
    const channel = createMonitorChannel();
    monitorChannelRef.current = channel;

    const respondWithFreshState = (replyTarget?: Window | null) => {
      const payload = buildSyncPayloadRef.current();
      publishMonitorState(channel, payload, replyTarget ?? studentWindowRef.current);
    };

    if (channel) {
      channel.onmessage = (event: MessageEvent<MonitorSyncMessage>) => {
        if (event.data?.type === 'REQUEST_STATE') {
          respondWithFreshState();
        }
      };
    }

    // Also answer REQUEST_STATE over window.postMessage (handles iframe-to-popup storage partitioning)
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'REQUEST_STATE') {
        const sourceWin = event.source && 'postMessage' in event.source ? (event.source as Window) : null;
        if (sourceWin) {
          studentWindowRef.current = sourceWin;
        }
        respondWithFreshState(sourceWin);
      }
    };
    window.addEventListener('message', handleWindowMessage);

    // Lightweight 2s heartbeat so Student Monitor reliably displays '● En línea con HUB'
    const heartbeatId = window.setInterval(() => {
      publishMonitorState(channel, buildSyncPayloadRef.current(), studentWindowRef.current);
    }, 2000);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener('message', handleWindowMessage);
      if (channel) {
        channel.close();
      }
      monitorChannelRef.current = null;
    };
  }, []);

  // Centralized master state emitter: fires immediately on ANY vital, rhythm, lead, preset, alarm, or timer change
  useEffect(() => {
    publishMonitorState(
      monitorChannelRef.current,
      buildSyncPayload(),
      studentWindowRef.current
    );
  }, [buildSyncPayload, timerSyncVersion, isAlarmSilenced]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { videoInputs: [] as MediaDeviceInfo[], audioInputs: [] as MediaDeviceInfo[] };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      setCameras(videoInputs);
      setMicrophones(audioInputs);
      setSelectedCameraId((prev) => {
        if (prev && videoInputs.some((c) => c.deviceId === prev)) return prev;
        return videoInputs[0]?.deviceId ?? '';
      });
      setSelectedMicId((prev) => {
        if (prev && audioInputs.some((m) => m.deviceId === prev)) return prev;
        return audioInputs[0]?.deviceId ?? '';
      });
      return { videoInputs, audioInputs };
    } catch {
      return { videoInputs: [] as MediaDeviceInfo[], audioInputs: [] as MediaDeviceInfo[] };
    }
  }, []);

  const stopVideoStream = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    setVideoStream(null);
    setHasVideoFeed(false);
  }, []);

  const stopAudioStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setAudioStream(null);
    setHasMicTrack(false);
  }, []);

  const stopAllMediaStreams = useCallback(() => {
    stopVideoStream();
    stopAudioStream();
  }, [stopVideoStream, stopAudioStream]);

  /**
   * Acquires a dedicated microphone audio stream configured for ambient clinical room voices:
   * { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
   */
  const startAudioCapture = useCallback(
    async (micDeviceId?: string, autoMatchedFlag = false): Promise<MediaStream | null> => {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      stopAudioStream();

      const audioConstraints: MediaTrackConstraints = {
        ...AMBIENT_AUDIO_CONSTRAINTS,
        ...(micDeviceId ? { deviceId: { exact: micDeviceId } } : {}),
      };

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraints,
          });
        } catch {
          // Fallback to default audioinput if exact deviceId is unavailable
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: AMBIENT_AUDIO_CONSTRAINTS,
          });
        }

        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = micEnabled;
        });

        audioStreamRef.current = stream;
        setAudioStream(stream);
        setHasMicTrack(audioTracks.length > 0);
        setMicAutoMatched(autoMatchedFlag);

        const activeMicId = audioTracks[0]?.getSettings()?.deviceId;
        if (activeMicId) {
          setSelectedMicId(activeMicId);
        }

        return stream;
      } catch {
        setHasMicTrack(false);
        setAudioStream(null);
        audioStreamRef.current = null;
        return null;
      }
    },
    [micEnabled, stopAudioStream]
  );

  /**
   * Acquires camera video stream and automatically selects the microphone sharing the same
   * hardware groupId (or matching webcam name) to capture audio directly from the simulation zone.
   */
  const startCameraCapture = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Este navegador no soporta captura mediante getUserMedia o requiere contexto HTTPS.'
        );
        return;
      }

      setIsRequestingCamera(true);
      setCameraError(null);
      stopVideoStream();

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      try {
        // Request combined video + audio on initial permission grant so browsers unlock labels & groupIds
        let initialAudioStream: MediaStream | null = null;
        let vStream: MediaStream;

        if (!audioStreamRef.current) {
          try {
            const combined = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: AMBIENT_AUDIO_CONSTRAINTS,
            });
            vStream = new MediaStream(combined.getVideoTracks());
            const aTracks = combined.getAudioTracks();
            if (aTracks.length > 0) {
              aTracks.forEach((t) => {
                t.enabled = micEnabled;
              });
              initialAudioStream = new MediaStream(aTracks);
              audioStreamRef.current = initialAudioStream;
              setAudioStream(initialAudioStream);
              setHasMicTrack(true);
            }
          } catch {
            // Retry video-only if mic fails or is absent
            vStream = await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: false,
            });
          }
        } else {
          vStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        }

        videoStreamRef.current = vStream;
        setVideoStream(vStream);
        setHasVideoFeed(vStream.getVideoTracks().length > 0);

        const activeVideoTrack = vStream.getVideoTracks()[0];
        const activeCameraId = activeVideoTrack?.getSettings()?.deviceId || deviceId || '';
        if (activeCameraId) {
          setSelectedCameraId(activeCameraId);
        }

        // Enumerate devices now that permissions are granted, then auto-select the webcam's mic
        const { videoInputs, audioInputs } = await refreshDevices();
        const activeCameraInfo =
          videoInputs.find((c) => c.deviceId === activeCameraId) ?? videoInputs[0];

        if (audioInputs.length > 0) {
          const matchedMic = findMatchingMicForCamera(activeCameraInfo, audioInputs);
          const currentMicId =
            audioStreamRef.current?.getAudioTracks()[0]?.getSettings()?.deviceId ?? '';

          if (matchedMic) {
            if (matchedMic.deviceId !== currentMicId || !audioStreamRef.current) {
              await startAudioCapture(matchedMic.deviceId, true);
            } else {
              setSelectedMicId(matchedMic.deviceId);
              setMicAutoMatched(true);
            }
          } else if (!audioStreamRef.current) {
            await startAudioCapture(audioInputs[0].deviceId, false);
          } else if (currentMicId) {
            setSelectedMicId(currentMicId);
            setMicAutoMatched(false);
          }
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Permiso denegado para cámara o micrófono. Autoriza el acceso en la barra del navegador.'
            : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No se detectó ninguna cámara conectada. Puedes operar y grabar el HUD en modo visor clínico.'
            : 'No se pudo iniciar la cámara web. Verifica que no esté en uso por otra aplicación.';
        setCameraError(message);
        setHasVideoFeed(false);

        // Even if camera is unavailable, still attempt to enumerate & capture microphone for audio-backed HUD recording
        const { audioInputs } = await refreshDevices();
        if (!audioStreamRef.current && audioInputs.length > 0) {
          await startAudioCapture(audioInputs[0].deviceId, false);
        }
      } finally {
        setIsRequestingCamera(false);
      }
    },
    [micEnabled, refreshDevices, startAudioCapture, stopVideoStream]
  );

  // Initial device check & camera + mic request on mount
  useEffect(() => {
    void startCameraCapture();
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      stopAllMediaStreams();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync microphone mute state directly on live audio track
  useEffect(() => {
    const stream = audioStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  // Live green microphone VU meter analyzer (AudioContext + AnalyserNode)
  useEffect(() => {
    if (!audioStream || !hasMicTrack || !micEnabled) {
      setAudioLevel(0);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(audioStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);

    const resumeCtx = () => {
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }
    };
    window.addEventListener('pointerdown', resumeCtx, { passive: true });
    window.addEventListener('keydown', resumeCtx, { passive: true });
    resumeCtx();

    const data = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const pollLevel = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      // Responsive gain curve for ambient room speech
      setAudioLevel(Math.min(1, rms * 4.2));
      rafId = requestAnimationFrame(pollLevel);
    };

    rafId = requestAnimationFrame(pollLevel);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointerdown', resumeCtx);
      window.removeEventListener('keydown', resumeCtx);
      source.disconnect();
      void audioCtx.close();
    };
  }, [audioStream, hasMicTrack, micEnabled]);

  // High-precision resuscitation stopwatch loop
  useEffect(() => {
    if (!timerRunning) return;
    let lastTick = performance.now();

    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      setTimerSeconds((prev) => prev + delta);
    }, 100);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  // Cleanup clip object URLs on unmount
  const clipsRef = useRef<RecordedClip[]>(clips);
  clipsRef.current = clips;
  useEffect(() => {
    return () => {
      clipsRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, []);

  // Centralized physiological ramp engine (250 ms interpolation ticks)
  const stopActiveRamp = useCallback(() => {
    if (rampIntervalRef.current !== null) {
      window.clearInterval(rampIntervalRef.current);
      rampIntervalRef.current = null;
    }
    activeRampRef.current = null;
    setRampStatus({ active: false, durationSec: 0, remainingSec: 0, progressPct: 0 });
  }, []);

  const commitTargetVitals = useCallback(
    (nextTarget: VitalParams, forceImmediate = false) => {
      targetVitalsRef.current = nextTarget;
      setTargetVitals(nextTarget);

      const current = vitalsRef.current;
      const numericChanged =
        Math.abs(nextTarget.hr - current.hr) >= 0.5 ||
        Math.abs(nextTarget.spo2 - current.spo2) >= 0.5 ||
        Math.abs(nextTarget.temp - current.temp) >= 0.05;

      const durationSec = transitionDurationRef.current;

      // Apply immediately when Inmediato (0s), forced, or only lead/rhythm changed without numeric delta
      if (forceImmediate || durationSec === 0 || !numericChanged) {
        stopActiveRamp();
        vitalsRef.current = nextTarget;
        setVitals(nextTarget);
        return;
      }

      // Start/re-anchor 250ms physiological ramp from current interpolated values to nextTarget
      if (rampIntervalRef.current !== null) {
        window.clearInterval(rampIntervalRef.current);
      }

      const durationMs = durationSec * 1000;
      const startMs = Date.now();
      const from = {
        hr: current.rhythm === 'asistolia' ? 0 : current.hr,
        spo2: current.spo2,
        temp: current.temp,
      };
      const to = {
        hr: nextTarget.rhythm === 'asistolia' ? 0 : nextTarget.hr,
        spo2: nextTarget.spo2,
        temp: nextTarget.temp,
      };

      activeRampRef.current = {
        startMs,
        durationMs,
        from,
        to,
        targetRhythm: nextTarget.rhythm,
      };

      // Apply electrical lead and PEA mode immediately while numeric parameters ramp
      const immediateLeadRhythm: VitalParams = {
        ...current,
        lead: nextTarget.lead,
        rhythm: nextTarget.rhythm === 'pea' ? 'pea' : current.rhythm,
      };
      vitalsRef.current = immediateLeadRhythm;
      setVitals(immediateLeadRhythm);

      setRampStatus({
        active: true,
        durationSec,
        remainingSec: durationSec,
        progressPct: 0,
      });

      rampIntervalRef.current = window.setInterval(() => {
        const ramp = activeRampRef.current;
        if (!ramp) {
          stopActiveRamp();
          return;
        }

        const elapsedMs = Date.now() - ramp.startMs;
        const progress = Math.min(1, elapsedMs / ramp.durationMs);

        const nextHr = ramp.from.hr + (ramp.to.hr - ramp.from.hr) * progress;
        const nextSpo2 = ramp.from.spo2 + (ramp.to.spo2 - ramp.from.spo2) * progress;
        const nextTemp =
          Math.round((ramp.from.temp + (ramp.to.temp - ramp.from.temp) * progress) * 10) / 10;

        let nextRhythm: CardiacRhythm;
        if (progress >= 1) {
          nextRhythm = ramp.targetRhythm;
        } else if (ramp.targetRhythm === 'pea') {
          nextRhythm = 'pea';
        } else if (Math.round(nextHr) <= 0) {
          nextRhythm = 'asistolia';
        } else if (nextHr < 100) {
          nextRhythm = 'bradicardia';
        } else {
          nextRhythm = 'sinusal';
        }

        const stepped: VitalParams = {
          hr: progress >= 1 ? ramp.to.hr : nextHr,
          spo2: progress >= 1 ? ramp.to.spo2 : nextSpo2,
          temp: progress >= 1 ? ramp.to.temp : nextTemp,
          rhythm: nextRhythm,
          lead: targetVitalsRef.current.lead,
        };

        vitalsRef.current = stepped;
        setVitals(stepped);

        if (progress >= 1) {
          stopActiveRamp();
        } else {
          const remainingSec = Math.max(1, Math.ceil((ramp.durationMs - elapsedMs) / 1000));
          setRampStatus({
            active: true,
            durationSec: Math.round(ramp.durationMs / 1000),
            remainingSec,
            progressPct: progress * 100,
          });
        }
      }, 250);
    },
    [stopActiveRamp]
  );

  const handleApplyRampNow = useCallback(() => {
    stopActiveRamp();
    const finalTarget = { ...targetVitalsRef.current };
    vitalsRef.current = finalTarget;
    setVitals(finalTarget);
  }, [stopActiveRamp]);

  const handleChangeTransitionDuration = useCallback(
    (sec: TransitionDurationSec) => {
      transitionDurationRef.current = sec;
      setTransitionDurationSec(sec);
      // If user switches to Inmediato while a ramp is active, finish the active ramp immediately
      if (sec === 0 && activeRampRef.current) {
        handleApplyRampNow();
      }
    },
    [handleApplyRampNow]
  );

  // Clinical control handlers
  const handleUpdateVitals = useCallback(
    (patch: Partial<VitalParams>, clearPreset = false) => {
      if (clearPreset) {
        setActivePresetId(null);
      }
      const nextTarget: VitalParams = { ...targetVitalsRef.current, ...patch };
      // Changing only ECG lead should never start or disrupt an active vital ramp
      const isLeadOnly =
        Object.keys(patch).length === 1 && patch.lead !== undefined;
      if (isLeadOnly) {
        targetVitalsRef.current = nextTarget;
        setTargetVitals(nextTarget);
        const updatedLive = { ...vitalsRef.current, lead: patch.lead! };
        vitalsRef.current = updatedLive;
        setVitals(updatedLive);
        return;
      }
      commitTargetVitals(nextTarget);
    },
    [commitTargetVitals]
  );

  const handleSelectRhythm = useCallback(
    (rhythm: CardiacRhythm) => {
      setActivePresetId(null);
      const prev = targetVitalsRef.current;
      let nextTarget: VitalParams;
      if (rhythm === 'asistolia') {
        nextTarget = { ...prev, rhythm, hr: 0 };
      } else if (rhythm === 'bradicardia') {
        const adjustedHr = prev.hr >= 100 || prev.hr === 0 ? 72 : prev.hr;
        nextTarget = { ...prev, rhythm, hr: adjustedHr };
      } else if (rhythm === 'pea') {
        const adjustedHr = prev.hr === 0 || prev.hr > 110 ? 54 : prev.hr;
        nextTarget = { ...prev, rhythm, hr: adjustedHr };
      } else {
        // sinusal
        const adjustedHr = prev.hr < 100 ? 142 : prev.hr;
        nextTarget = { ...prev, rhythm, hr: adjustedHr };
      }
      commitTargetVitals(nextTarget);
    },
    [commitTargetVitals]
  );

  const handleSelectPreset = useCallback(
    (preset: NrpPreset) => {
      setActivePresetId(preset.id);
      const nextTarget: VitalParams = {
        ...targetVitalsRef.current,
        hr: preset.hr,
        spo2: preset.spo2,
        temp: preset.temp,
        rhythm: preset.rhythm,
      };
      commitTargetVitals(nextTarget);
    },
    [commitTargetVitals]
  );

  /**
   * Downloads the recorded video file (.mp4 / .webm) and, after a 300ms pause so browsers
   * do not block simultaneous downloads, exports the paired UTF-8 BOM debriefing events CSV
   * sharing the exact same SimRec_NRP_YYYY-MM-DD_HH-MM base name.
   */
  const triggerClipWithEventsDownload = useCallback((clip: RecordedClip) => {
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = clip.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const pairedCsvName = `${clip.baseName}_eventos.csv`;
    const eventsSnapshot = debriefEventsRef.current;
    const durationSnapshot = Math.max(timerSecondsRef.current, clip.durationSec);
    window.setTimeout(() => {
      downloadDebriefCsv(eventsSnapshot, durationSnapshot, pairedCsvName);
    }, 300);
  }, []);

  // MediaRecorder: Canvas 30fps video tracks + explicit live Microphone audio tracks
  const handleStartRecording = useCallback(async () => {
    setRecordingError(null);
    const canvas = canvasRef.current;
    if (!canvas) {
      setRecordingError('El lienzo de video aún no está inicializado.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setRecordingError('Tu navegador no soporta MediaRecorder para exportar video.');
      return;
    }

    try {
      // Ensure live microphone audio stream is active before starting MediaRecorder
      let activeAudioStream = audioStreamRef.current;
      const hasLiveAudio =
        activeAudioStream !== null &&
        activeAudioStream.getAudioTracks().some((t) => t.readyState === 'live');

      if (!hasLiveAudio && micEnabled) {
        activeAudioStream = await startAudioCapture(selectedMicId || undefined, micAutoMatched);
      }

      const liveAudioTracks =
        activeAudioStream && micEnabled
          ? activeAudioStream.getAudioTracks().filter((t) => t.readyState === 'live')
          : [];

      // Explicitly verify every injected audio track is enabled === true
      liveAudioTracks.forEach((audioTrack) => {
        audioTrack.enabled = true;
      });

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...liveAudioTracks,
      ]);

      const preferredMime = pickSupportedMimeType();
      let recorder: MediaRecorder;
      let activeMime = preferredMime;

      try {
        recorder = preferredMime
          ? new MediaRecorder(combinedStream, {
              mimeType: preferredMime,
              videoBitsPerSecond: 4_500_000,
              audioBitsPerSecond: 128_000,
            })
          : new MediaRecorder(combinedStream);
      } catch {
        // Fallback if specific MP4 codec string rejects the live audio track on this browser
        const fallbackCandidates = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
        const supportedFallback =
          fallbackCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
        activeMime = supportedFallback;
        recorder = supportedFallback
          ? new MediaRecorder(combinedStream, {
              mimeType: supportedFallback,
              videoBitsPerSecond: 4_500_000,
              audioBitsPerSecond: 128_000,
            })
          : new MediaRecorder(combinedStream);
      }

      recordedChunksRef.current = [];
      discardRecordingOnStopRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (discardRecordingOnStopRef.current) {
          discardRecordingOnStopRef.current = false;
          recordedChunksRef.current = [];
          // Stop only synthetic canvas capture tracks; keep live webcam & mic uninterrupted
          canvasStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const finalMime = recorder.mimeType || activeMime || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        const baseName = buildClipBaseName();
        const filename = buildClipFilename(baseName, finalMime);
        const formatLabel = describeVideoFormat(finalMime);
        const createdAt = new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        const clip: RecordedClip = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          baseName,
          filename,
          durationSec: clipDurationAccumRef.current,
          sizeBytes: blob.size,
          createdAt,
          mimeType: finalMime,
          formatLabel,
        };

        setClips((prev) => [clip, ...prev]);
        triggerClipWithEventsDownload(clip);

        // Stop only synthetic canvas video capture tracks (keep live mic stream alive for next take)
        canvasStream.getTracks().forEach((t) => t.stop());
      };

      recorder.onerror = () => {
        setRecordingError('Se produjo un error durante la grabación de video.');
        setRecordingState('idle');
        setTimerRunning(false);
        clipSegmentStartMsRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      clipDurationAccumRef.current = 0;
      clipSegmentStartMsRef.current = performance.now();
      recorder.start(1000);

      // Synchronize resuscitation stopwatch with recording start
      timerSecondsRef.current = 0;
      setTimerSeconds(0);
      setTimerRunning(true);
      setTimerSyncVersion((v) => v + 1);
      setRecordingState('recording');
    } catch {
      setRecordingError(
        'No se pudo iniciar MediaRecorder. Verifica los permisos de micrófono o prueba en Chrome/Edge/Firefox.'
      );
    }
  }, [micAutoMatched, micEnabled, selectedMicId, startAudioCapture, triggerClipWithEventsDownload]);

  const handlePauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      if (clipSegmentStartMsRef.current !== null) {
        clipDurationAccumRef.current += (performance.now() - clipSegmentStartMsRef.current) / 1000;
        clipSegmentStartMsRef.current = null;
      }
      setRecordingState('paused');
      setTimerRunning(false);
      setTimerSyncVersion((v) => v + 1);
    }
  }, []);

  const handleResumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      clipSegmentStartMsRef.current = performance.now();
      setRecordingState('recording');
      setTimerRunning(true);
      setTimerSyncVersion((v) => v + 1);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (clipSegmentStartMsRef.current !== null) {
      clipDurationAccumRef.current += (performance.now() - clipSegmentStartMsRef.current) / 1000;
      clipSegmentStartMsRef.current = null;
    }
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setRecordingState('idle');
    setTimerRunning(false);
    setTimerSyncVersion((v) => v + 1);
  }, []);

  const handleResetTimer = useCallback(() => {
    timerSecondsRef.current = 0;
    setTimerSeconds(0);
    setTimerSyncVersion((v) => v + 1);
  }, []);

  const handleToggleTimerStandalone = useCallback(() => {
    setTimerRunning((prev) => !prev);
    setTimerSyncVersion((v) => v + 1);
  }, []);

  /**
   * Clean "F5-like" scenario reset for the next simulation group:
   * resets stopwatch, clears debrief log & milestone counters, cancels active ramps,
   * restores default vitals/sensors/alerts, and syncs Student Monitor immediately —
   * WITHOUT interrupting webcam, microphone, or second-screen connection.
   */
  const handleResetScenario = useCallback(() => {
    // 1. Safely abort any in-progress recording without touching webcam/mic streams
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      discardRecordingOnStopRef.current = true;
      recorder.stop();
    }
    clipDurationAccumRef.current = 0;
    clipSegmentStartMsRef.current = null;
    setRecordingState('idle');
    setRecordingError(null);

    // 2. Stop & zero NRP stopwatch
    setTimerRunning(false);
    timerSecondsRef.current = 0;
    setTimerSeconds(0);

    // 3. Clear debrief event log (also resets all milestone & question counters/checks) & video banner
    setDebriefEvents([]);
    setActiveBanner(null);
    if (bannerTimeoutRef.current !== null) {
      window.clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }

    // 4. Cancel active physiological ramp & restore initial default vitals, sensors, and alerts
    stopActiveRamp();

    const defaultVitals: VitalParams = {
      hr: NRP_PRESETS[0].hr,
      spo2: NRP_PRESETS[0].spo2,
      temp: NRP_PRESETS[0].temp,
      rhythm: NRP_PRESETS[0].rhythm,
      lead: 'DII',
    };
    const defaultSensors: SensorConnections = {
      ecgConnected: true,
      spo2Connected: true,
      tempConnected: true,
    };

    vitalsRef.current = defaultVitals;
    targetVitalsRef.current = defaultVitals;
    liveVitalsSnapshotRef.current = { ...defaultVitals };
    setVitals(defaultVitals);
    setTargetVitals(defaultVitals);
    setActivePresetId(NRP_PRESETS[0].id);
    setSensors(defaultSensors);
    setAlarmSilencedUntilMs(null);
    setTimerSyncVersion((v) => v + 1);

    // 5. Immediately broadcast clean state to Student Monitor (?view=student)
    const now = Date.now();
    publishMonitorState(
      monitorChannelRef.current,
      {
        hr: defaultVitals.hr,
        spo2: defaultVitals.spo2,
        temp: defaultVitals.temp,
        rhythm: defaultVitals.rhythm,
        lead: defaultVitals.lead,
        ecgConnected: defaultSensors.ecgConnected,
        spo2Connected: defaultSensors.spo2Connected,
        tempConnected: defaultSensors.tempConnected,
        timerSeconds: 0,
        isRunning: false,
        alarmSilenced: false,
        alarmSilencedUntilMs: null,
        activeAlerts: computeActiveClinicalAlerts(defaultVitals, defaultSensors),
        plethColorMode,
        timerAnchorEpochMs: now,
        updatedAt: now,
      },
      studentWindowRef.current
    );
  }, [plethColorMode, stopActiveRamp]);

  const handleOpenStudentMonitor = useCallback(() => {
    // Persist the freshest snapshot to localStorage ('simrec_live_state') & BroadcastChannel before opening
    const snapshot = buildSyncPayloadRef.current();
    publishMonitorState(monitorChannelRef.current, snapshot, studentWindowRef.current);

    const url = new URL(window.location.href);
    url.searchParams.set('view', 'student');
    const studentUrl = url.toString();

    const win = window.open(
      studentUrl,
      'SimRecStudentMonitor',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );

    if (!win) {
      setStudentMonitorBlockedUrl(studentUrl);
    } else {
      studentWindowRef.current = win;
      setStudentMonitorBlockedUrl(null);
      win.focus();
      // Proactively push state after popup finishes initial bootstrap as extra safeguard
      window.setTimeout(() => {
        publishMonitorState(
          monitorChannelRef.current,
          buildSyncPayloadRef.current(),
          studentWindowRef.current
        );
      }, 600);
    }
  }, []);

  const handleDeleteClip = useCallback((id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  // Debriefing milestone & note logging with automatic telemetry capture
  const appendDebriefEntry = useCallback(
    (label: string, stage: DebriefStage, milestoneId: string | null) => {
      const exactTimerSec = timerSecondsRef.current;
      const wallTime = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const snapshot: VitalParams = { ...liveVitalsSnapshotRef.current };
      const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newEvent: DebriefEvent = {
        id: entryId,
        milestoneId,
        label,
        stage,
        timerSec: exactTimerSec,
        wallTime,
        vitals: snapshot,
      };

      setDebriefEvents((prev) => [...prev, newEvent]);

      if (showBannerInVideo) {
        const banner: CanvasMilestoneBanner = {
          id: entryId,
          label,
          timerText: formatTimerMMSS(exactTimerSec),
          stage,
          startedAtMs: performance.now(),
          durationMs: 3000,
        };
        setActiveBanner(banner);
        if (bannerTimeoutRef.current !== null) {
          window.clearTimeout(bannerTimeoutRef.current);
        }
        bannerTimeoutRef.current = window.setTimeout(() => {
          setActiveBanner((current) => (current?.id === entryId ? null : current));
        }, 3150);
      }
    },
    [showBannerInVideo]
  );

  const handleLogMilestone = useCallback(
    (milestone: DebriefMilestoneDef) => {
      appendDebriefEntry(milestone.label, milestone.stage, milestone.id);
    },
    [appendDebriefEntry]
  );

  const handleLogCustomNote = useCallback(
    (text: string) => {
      appendDebriefEntry(text, 'nota', null);
    },
    [appendDebriefEntry]
  );

  const handleUpdateDebriefEvent = useCallback(
    (id: string, patch: { label: string; timerSec: number; note: string }) => {
      setDebriefEvents((prev) =>
        prev.map((ev) =>
          ev.id === id
            ? {
                ...ev,
                label: patch.label,
                timerSec: patch.timerSec,
                note: patch.note || undefined,
              }
            : ev
        )
      );
    },
    []
  );

  const handleDeleteDebriefEvent = useCallback((id: string) => {
    setDebriefEvents((prev) => prev.filter((ev) => ev.id !== id));
  }, []);

  const handleClearDebriefEvents = useCallback(() => {
    setDebriefEvents([]);
    setActiveBanner(null);
  }, []);

  const handleToggleShowBanner = useCallback(() => {
    setShowBannerInVideo((prev) => {
      const next = !prev;
      if (!next) {
        setActiveBanner(null);
      }
      return next;
    });
  }, []);

  const handleCameraChange = (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId);
    void startCameraCapture(newDeviceId);
  };

  const handleMicChange = (newMicId: string) => {
    setSelectedMicId(newMicId);
    setMicAutoMatched(false);
    setMicEnabled(true);
    void startAudioCapture(newMicId, false);
  };

  return (
    <div
      data-theme={isLightMode ? 'light' : 'dark'}
      className={`min-h-screen lg:h-screen lg:overflow-hidden flex flex-col transition-colors ${
        isLightMode ? 'bg-[#F1F5F9] text-slate-900' : 'bg-[#080C12] text-slate-100'
      }`}
    >
      {/* Slim Clinical Top Bar with Light/Dark Theme Switch */}
      <header
        className={`shrink-0 border-b px-4 py-1.5 flex items-center justify-between gap-4 transition-colors ${
          isLightMode
            ? 'bg-white border-slate-300 shadow-xs'
            : 'bg-[#0B1019] border-slate-800/90'
        }`}
      >
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1
            className={`text-sm sm:text-base font-bold tracking-tight whitespace-nowrap truncate ${
              isLightMode ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            SimRec Neonatal HUD SOCHIPE
          </h1>
          <span
            className={`hidden sm:inline ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}
            aria-hidden="true"
          >
            ·
          </span>
          <span
            className={`text-[11px] whitespace-nowrap hidden sm:inline ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            Mat. Carlos Solar O.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
          {alarmPriority !== 'none' && (
            <span
              className={
                isAlarmSilenced
                  ? isLightMode
                    ? 'text-amber-700 font-semibold'
                    : 'text-amber-300 font-semibold'
                  : alarmPriority === 'high'
                  ? isLightMode
                    ? 'text-red-600 font-semibold'
                    : 'text-red-400 font-semibold'
                  : isLightMode
                  ? 'text-amber-700 font-semibold'
                  : 'text-amber-300 font-semibold'
              }
            >
              {isAlarmSilenced
                ? `Alarma silenciada (${formatTimerMMSS(silenceRemainingSec)})`
                : alarmPriority === 'high'
                ? '▲ Alarma Crítica'
                : '▲ Alarma Media'}
            </span>
          )}

          <span
            className={`whitespace-nowrap hidden md:inline ${
              isLightMode ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {recordingState === 'recording' ? (
              <span className={isLightMode ? 'text-red-600 font-semibold' : 'text-red-400 font-semibold'}>
                ● Grabando HD
              </span>
            ) : recordingState === 'paused' ? (
              <span
                className={
                  isLightMode ? 'text-amber-700 font-semibold' : 'text-amber-300 font-semibold'
                }
              >
                ❚❚ Pausado
              </span>
            ) : hasVideoFeed ? (
              hasMicTrack && micEnabled ? 'Cámara + Mic · 720p' : 'Cámara · Sin mic'
            ) : (
              'Visor clínico · 720p'
            )}
          </span>

          {/* Quick Light / Dark Mode Switch */}
          <button
            type="button"
            onClick={handleToggleTheme}
            title={
              isLightMode
                ? 'Cambiar a Modo Oscuro clínico'
                : 'Cambiar a Modo Claro para salas bien iluminadas'
            }
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border font-sans text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isLightMode
                ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                : 'border-slate-700 bg-[#141C2B] text-slate-100 hover:bg-slate-800'
            }`}
          >
            {isLightMode ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Modo Oscuro</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Modo Claro</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Zero-Scroll Desktop Split Workspace (Stacks vertically on mobile/portrait tablets) */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* COLUMNA IZQUIERDA (44%): Parámetros Vitales + Escenarios NRP + Dispositivos */}
        <div
          className={`w-full lg:w-[44%] xl:w-[43%] lg:h-full flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r ${
            isLightMode ? 'border-slate-300' : 'border-slate-800/90'
          }`}
        >
          <InstructorPanel
            isLightMode={isLightMode}
            vitals={vitals}
            targetVitals={targetVitals}
            sensors={sensors}
            activePresetId={activePresetId}
            transitionDurationSec={transitionDurationSec}
            rampStatus={rampStatus}
            plethColorMode={plethColorMode}
            hudLayout={hudLayout}
            onUpdateVitals={handleUpdateVitals}
            onToggleSensor={handleToggleSensor}
            onSetAllSensors={handleSetAllSensors}
            onSelectRhythm={handleSelectRhythm}
            onSelectPreset={handleSelectPreset}
            onChangeTransitionDuration={handleChangeTransitionDuration}
            onApplyRampNow={handleApplyRampNow}
            onChangePlethColorMode={setPlethColorMode}
            onChangeHudLayout={setHudLayout}
            onOpenStudentMonitor={handleOpenStudentMonitor}
            studentMonitorBlockedUrl={studentMonitorBlockedUrl}
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            onCameraChange={handleCameraChange}
            microphones={microphones}
            selectedMicId={selectedMicId}
            micAutoMatched={micAutoMatched}
            onMicChange={handleMicChange}
            hasVideoFeed={hasVideoFeed}
            hasMicTrack={hasMicTrack}
            micEnabled={micEnabled}
            onToggleMicEnabled={() => setMicEnabled((prev) => !prev)}
            audioLevel={audioLevel}
            mirrorVideo={mirrorVideo}
            onToggleMirrorVideo={() => setMirrorVideo((prev) => !prev)}
            isRequestingCamera={isRequestingCamera}
            onRequestCamera={() => void startCameraCapture(selectedCameraId || undefined)}
            recordingState={recordingState}
          />
        </div>

        {/* COLUMNA DERECHA (56%): Audio Monitor -> Visor 16:9 -> Barra Compacta -> Botonera Eventos + Bitácora */}
        <section
          aria-label="Audio del monitor, visor de video, controles de grabación y registro de eventos"
          className={`w-full lg:w-[56%] xl:w-[57%] lg:h-full flex flex-col min-h-0 p-2.5 sm:p-3 gap-2 transition-colors ${
            isLightMode ? 'bg-[#F1F5F9]' : 'bg-[#080C12]'
          }`}
        >
          {/* 1. Controles de Audio del Monitor directamente encima del visor de video */}
          <MonitorAudioBar
            isLightMode={isLightMode}
            soundEnabled={soundEnabled}
            audioVolume={audioVolume}
            alarmPriority={alarmPriority}
            isAlarmSilenced={isAlarmSilenced}
            silenceRemainingSec={silenceRemainingSec}
            onToggleSound={handleToggleSound}
            onChangeAudioVolume={handleChangeAudioVolume}
            onToggleSilenceAlarm={handleToggleSilenceAlarm}
          />

          {/* 2. Visor de Video HD 16:9 (siempre en negro clínico para máxima legibilidad de ondas y MP4) */}
          <div className="w-full flex items-center justify-center shrink-0">
            <div className="w-full lg:max-w-[min(100%,calc(37vh*16/9))]">
              <CanvasStage
                isLightMode={isLightMode}
                canvasRef={canvasRef}
                mediaStream={videoStream}
                hasVideoFeed={hasVideoFeed}
                cameraError={cameraError}
                isRequestingCamera={isRequestingCamera}
                onRequestCamera={() => void startCameraCapture(selectedCameraId || undefined)}
                mirrorVideo={mirrorVideo}
                vitals={vitals}
                sensors={sensors}
                timerSeconds={timerSeconds}
                recordingState={recordingState}
                plethColorMode={plethColorMode}
                hudLayout={hudLayout}
                soundEnabled={soundEnabled}
                activeBanner={activeBanner}
                liveVitalsSnapshotRef={liveVitalsSnapshotRef}
              />
            </div>
          </div>

          {/* 3. Barra Compacta de Cronómetro, Grabación, Reinicio y Descarga Conjunta MP4 + Eventos */}
          <RecordingToolbar
            isLightMode={isLightMode}
            recordingState={recordingState}
            timerSeconds={timerSeconds}
            timerRunning={timerRunning}
            micEnabled={micEnabled}
            hasMicTrack={hasMicTrack}
            audioLevel={audioLevel}
            detectedFormatLabel={detectedFormatLabel}
            isMp4Supported={isMp4Supported}
            recordingError={recordingError}
            clips={clips}
            debriefEvents={debriefEvents}
            onStartRecording={() => void handleStartRecording()}
            onPauseRecording={handlePauseRecording}
            onResumeRecording={handleResumeRecording}
            onStopRecording={handleStopRecording}
            onResetTimer={handleResetTimer}
            onToggleTimerStandalone={handleToggleTimerStandalone}
            onResetScenario={handleResetScenario}
            onDownloadClipWithEvents={triggerClipWithEventsDownload}
            onDeleteClip={handleDeleteClip}
          />

          {/* 4. Módulo Completo de Registro de Eventos para Debriefing (Grilla Compacta 3 Cols + Bitácora) */}
          <DebriefEventLogger
            isLightMode={isLightMode}
            events={debriefEvents}
            timerSeconds={timerSeconds}
            showBannerInVideo={showBannerInVideo}
            onToggleShowBanner={handleToggleShowBanner}
            onLogMilestone={handleLogMilestone}
            onLogCustomNote={handleLogCustomNote}
            onUpdateEvent={handleUpdateDebriefEvent}
            onDeleteEvent={handleDeleteDebriefEvent}
            onClearEvents={handleClearDebriefEvents}
          />
        </section>
      </main>
    </div>
  );
}
