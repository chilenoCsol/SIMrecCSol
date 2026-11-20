import React, { useEffect, useRef } from 'react';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  CanvasMilestoneBanner,
  HudLayoutMode,
  PlethColorMode,
  RecordingState,
  SensorConnections,
  VitalParams,
} from '../types/simulation';
import { clinicalAudioCue } from '../utils/audioCue';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  renderCompositorFrame,
} from '../utils/hudRenderer';
import { loadProcessedSochipeLogo } from '../utils/logoProcessor';
import {
  createWaveformEngineState,
  stepWaveformEngine,
} from '../utils/waveformEngine';

interface CanvasStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mediaStream: MediaStream | null;
  hasVideoFeed: boolean;
  cameraError: string | null;
  isRequestingCamera: boolean;
  onRequestCamera: () => void;
  mirrorVideo: boolean;
  vitals: VitalParams;
  sensors: SensorConnections;
  timerSeconds: number;
  recordingState: RecordingState;
  plethColorMode: PlethColorMode;
  hudLayout: HudLayoutMode;
  soundEnabled: boolean;
  activeBanner: CanvasMilestoneBanner | null;
  liveVitalsSnapshotRef: React.MutableRefObject<VitalParams>;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  canvasRef,
  mediaStream,
  hasVideoFeed,
  cameraError,
  isRequestingCamera,
  onRequestCamera,
  mirrorVideo,
  vitals,
  sensors,
  timerSeconds,
  recordingState,
  plethColorMode,
  hudLayout,
  soundEnabled,
  activeBanner,
  liveVitalsSnapshotRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveformRef = useRef(createWaveformEngineState());
  const institutionalLogoRef = useRef<HTMLCanvasElement | null>(null);

  // Process CEI SOCHIPE logo through auxiliary canvas once for transparent TV-bug overlay
  useEffect(() => {
    let active = true;
    loadProcessedSochipeLogo()
      .then((processed) => {
        if (active) {
          institutionalLogoRef.current = processed.canvas;
        }
      })
      .catch(() => {
        // Ignore logo load error gracefully
      });
    return () => {
      active = false;
    };
  }, []);

  // Mutable ref to avoid restarting RAF loop on every 250ms ramp tick
  const livePropsRef = useRef({
    hasVideoFeed,
    mirrorVideo,
    vitals,
    sensors,
    timerSeconds,
    recordingState,
    plethColorMode,
    hudLayout,
    soundEnabled,
    activeBanner,
  });

  useEffect(() => {
    livePropsRef.current = {
      hasVideoFeed,
      mirrorVideo,
      vitals,
      sensors,
      timerSeconds,
      recordingState,
      plethColorMode,
      hudLayout,
      soundEnabled,
      activeBanner,
    };
    liveVitalsSnapshotRef.current = { ...vitals };
  }, [
    hasVideoFeed,
    mirrorVideo,
    vitals,
    sensors,
    timerSeconds,
    recordingState,
    plethColorMode,
    hudLayout,
    soundEnabled,
    activeBanner,
    liveVitalsSnapshotRef,
  ]);

  // Attach MediaStream to hidden <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (mediaStream) {
      video.srcObject = mediaStream;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay policies may defer until user interaction; muted video usually succeeds immediately
        });
      }
    } else {
      video.srcObject = null;
    }
  }, [mediaStream]);

  // Main real-time 1280x720 Canvas compositor loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const renderLoop = (now: number) => {
      const dtSec = Math.min((now - lastTime) / 1000, 0.15);
      lastTime = now;

      const props = livePropsRef.current;
      const current = props.vitals;
      const activeSensors = props.sensors;
      liveVitalsSnapshotRef.current = { ...current };

      const stepResult = stepWaveformEngine(
        waveformRef.current,
        dtSec,
        current.hr,
        current.spo2,
        current.lead,
        current.rhythm
      );

      // Smart clinical pulse beep routing:
      // Caso A (ECG ON): synced to QRS (SpO2-pitched if SpO2 ON, steady QRS tone if SpO2 OFF)
      // Caso B (ECG OFF + SpO2 ON): synced to plethysmography systolic peak
      // Caso C (Both OFF): silent
      if (props.soundEnabled) {
        const hasPulse = current.rhythm !== 'asistolia' && current.rhythm !== 'pea' && current.hr > 0;
        if (activeSensors.ecgConnected) {
          if (stepResult.ecgBeatOccurred) {
            clinicalAudioCue.playBeat(current.spo2, hasPulse, activeSensors.spo2Connected);
          }
        } else if (activeSensors.spo2Connected) {
          if (stepResult.plethBeatOccurred) {
            clinicalAudioCue.playBeat(current.spo2, true, true);
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          renderCompositorFrame({
            ctx,
            video: videoRef.current,
            hasVideoFeed: props.hasVideoFeed,
            mirrorVideo: props.mirrorVideo,
            vitals: current,
            sensors: activeSensors,
            waveform: waveformRef.current,
            timerSeconds: props.timerSeconds,
            recordingState: props.recordingState,
            plethColorMode: props.plethColorMode,
            hudLayout: props.hudLayout,
            institutionalLogo: institutionalLogoRef.current,
            activeBanner: props.activeBanner,
            nowMs: now,
          });
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [canvasRef]);

  return (
    <div className="relative w-full bg-[#05080D] border border-slate-800 rounded-lg overflow-hidden">
      {/* Hidden source video element fed by getUserMedia */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
        aria-hidden="true"
      />

      {/* Unified HD 1280x720 Canvas recorded by MediaRecorder (scaled strictly via CSS w-full h-auto) */}
      <div className="relative w-full bg-[#05080D]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block w-full h-auto"
        />

        {/* Non-recorded floating camera activation control when no webcam is connected */}
        {!hasVideoFeed && (
          <div className="absolute bottom-3 right-3 max-w-[340px] bg-[#0F1520]/95 border border-slate-700/80 rounded-md px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 text-sky-400 shrink-0">
                {cameraError ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-100 leading-tight">
                  {cameraError ? 'Cámara no disponible' : 'Modo visor sin cámara activa'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {cameraError
                    ? cameraError
                    : 'HUD 1280×720 activo. Conecta cámara web para capturar la cuna radiante.'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRequestCamera}
                    disabled={isRequestingCamera}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRequestingCamera ? 'animate-spin' : ''}`} />
                    {isRequestingCamera ? 'Solicitando...' : 'Activar cámara y mic'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
