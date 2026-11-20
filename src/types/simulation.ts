export type EcgLead = 'DII' | 'DI' | 'DIII';

export type CardiacRhythm = 'sinusal' | 'bradicardia' | 'asistolia' | 'pea';

export type PlethColorMode = 'cyan' | 'yellow';

export type HudLayoutMode = 'side' | 'top';

export type TransitionDurationSec = 0 | 20 | 40 | 60 | 120;

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RampStatus {
  active: boolean;
  durationSec: number;
  remainingSec: number;
  progressPct: number; // 0 - 100
}

export interface VitalParams {
  hr: number; // 0 - 220 lpm
  spo2: number; // 40 - 100 %
  temp: number; // 34.0 - 39.0 °C
  rhythm: CardiacRhythm;
  lead: EcgLead;
}

export interface SensorConnections {
  ecgConnected: boolean;
  spo2Connected: boolean;
  tempConnected: boolean;
}

export interface NrpPreset {
  id: string;
  name: string;
  summary: string;
  hr: number;
  spo2: number;
  temp: number;
  rhythm: CardiacRhythm;
}

export type ThemeMode = 'light' | 'dark';

export interface RecordedClip {
  id: string;
  url: string;
  baseName: string;
  filename: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: string;
  mimeType: string;
  formatLabel: string;
}

export interface MonitorSyncPayload {
  hr: number;
  spo2: number;
  temp: number;
  rhythm: CardiacRhythm;
  lead: EcgLead;
  ecgConnected: boolean;
  spo2Connected: boolean;
  tempConnected: boolean;
  timerSeconds: number;
  isRunning: boolean;
  alarmSilenced: boolean;
  alarmSilencedUntilMs: number | null;
  activeAlerts: string[];
  plethColorMode: PlethColorMode;
  timerAnchorEpochMs: number;
  updatedAt: number;
}

export type MonitorSyncMessage =
  | { type: 'SYNC_STATE'; payload: MonitorSyncPayload }
  | { type: 'REQUEST_STATE' };

export type DebriefStage =
  | 'evaluacion'
  | 'inicial'
  | 'via-aerea'
  | 'circulacion'
  | 'farmacos'
  | 'especiales'
  | 'nota';

export interface DebriefMilestoneDef {
  id: string;
  label: string;
  stage: Exclude<DebriefStage, 'nota'>;
}

export interface DebriefEvent {
  id: string;
  milestoneId: string | null;
  label: string;
  stage: DebriefStage;
  timerSec: number;
  wallTime: string;
  vitals: VitalParams;
  note?: string;
}

export interface CanvasMilestoneBanner {
  id: string;
  label: string;
  timerText: string;
  stage: DebriefStage;
  startedAtMs: number;
  durationMs: number;
}


