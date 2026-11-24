import { HYPOTHERMIA_THRESHOLD } from '../data/nrpPresets';
import {
  MonitorSyncMessage,
  MonitorSyncPayload,
  SensorConnections,
  VitalParams,
} from '../types/simulation';

export const MONITOR_SYNC_CHANNEL_NAME = 'simrec-monitor-sync';
export const MONITOR_SYNC_STORAGE_KEY = 'simrec_live_state';

const DEFAULT_SENSORS: SensorConnections = {
  ecgConnected: true,
  spo2Connected: true,
  tempConnected: true,
};

export function computeActiveClinicalAlerts(
  vitals: VitalParams,
  sensors: SensorConnections = DEFAULT_SENSORS
): string[] {
  const hr = vitals.rhythm === 'asistolia' ? 0 : Math.round(vitals.hr);
  const spo2 = Math.round(vitals.spo2);
  const isAsystole = vitals.rhythm === 'asistolia' || hr === 0;
  const isPea = vitals.rhythm === 'pea';
  const noPulse = isAsystole || isPea;

  const alerts: string[] = [];

  if (sensors.ecgConnected) {
    if (isAsystole) {
      alerts.push('ASISTOLIA');
    } else if (isPea) {
      alerts.push('SIN PULSO DETECTABLE');
    } else if (hr < 60) {
      alerts.push('BRADICARDIA < 60 lpm');
    } else if (hr < 100) {
      alerts.push('BRADICARDIA < 100 lpm');
    }
  } else if (sensors.spo2Connected) {
    if (noPulse) {
      alerts.push('SIN PULSO DETECTABLE');
    } else if (hr < 60) {
      alerts.push('BRADICARDIA < 60 lpm');
    } else if (hr < 100) {
      alerts.push('BRADICARDIA < 100 lpm');
    }
  }

  if (sensors.spo2Connected && !noPulse && spo2 < 80) {
    alerts.push('DESATURACIÓN < 80%');
  }

  if (sensors.tempConnected && vitals.temp < HYPOTHERMIA_THRESHOLD) {
    alerts.push('HIPOTERMIA < 36.5 °C');
  }

  return alerts;
}

export function extractVitalsFromPayload(payload: MonitorSyncPayload): VitalParams {
  return {
    hr: payload.hr,
    spo2: payload.spo2,
    temp: payload.temp,
    rhythm: payload.rhythm,
    lead: payload.lead,
  };
}

export function extractSensorsFromPayload(payload: MonitorSyncPayload): SensorConnections {
  return {
    ecgConnected: payload.ecgConnected !== false,
    spo2Connected: payload.spo2Connected !== false,
    tempConnected: payload.tempConnected !== false,
  };
}

export function computeSyncedTimerSeconds(
  payload: MonitorSyncPayload,
  nowEpochMs = Date.now()
): number {
  if (!payload.isRunning) {
    return Math.max(0, payload.timerSeconds);
  }
  const elapsedSinceAnchor = Math.max(0, (nowEpochMs - payload.timerAnchorEpochMs) / 1000);
  return Math.max(0, payload.timerSeconds + elapsedSinceAnchor);
}

export function isValidSyncPayload(candidate: unknown): candidate is MonitorSyncPayload {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Record<string, unknown>;
  return (
    typeof obj.hr === 'number' &&
    typeof obj.spo2 === 'number' &&
    typeof obj.temp === 'number' &&
    typeof obj.rhythm === 'string' &&
    typeof obj.lead === 'string' &&
    typeof obj.timerSeconds === 'number' &&
    typeof obj.isRunning === 'boolean'
  );
}

export function normalizeSyncPayload(payload: MonitorSyncPayload): MonitorSyncPayload {
  return {
    ...payload,
    ecgConnected: payload.ecgConnected !== false,
    spo2Connected: payload.spo2Connected !== false,
    tempConnected: payload.tempConnected !== false,
  };
}

export function saveMonitorStateToStorage(payload: MonitorSyncPayload): void {
  try {
    window.localStorage.setItem(MONITOR_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function loadMonitorStateFromStorage(): MonitorSyncPayload | null {
  try {
    const raw = window.localStorage.getItem(MONITOR_SYNC_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSyncPayload(parsed) ? normalizeSyncPayload(parsed) : null;
  } catch {
    return null;
  }
}

export function createMonitorChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    return new BroadcastChannel(MONITOR_SYNC_CHANNEL_NAME);
  } catch {
    return null;
  }
}

/**
 * Broadcasts the complete master SYNC_STATE payload via:
 * 1. BroadcastChannel('simrec-monitor-sync')
 * 2. localStorage ('simrec_live_state') for cross-window storage events & persistence
 * 3. Direct postMessage to opened student popup window (resilience against iframe storage partitioning)
 */
export function publishMonitorState(
  channel: BroadcastChannel | null,
  payload: MonitorSyncPayload,
  studentWindow?: Window | null
): void {
  saveMonitorStateToStorage(payload);

  const msg: MonitorSyncMessage = { type: 'SYNC_STATE', payload };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // Ignore postMessage errors if channel is closing
    }
  }

  if (studentWindow && !studentWindow.closed) {
    try {
      studentWindow.postMessage(msg, '*');
    } catch {
      // Ignore cross-origin postMessage errors if window navigated away
    }
  }
}

/**
 * Sends a REQUEST_STATE handshake over BroadcastChannel and directly to window.opener if present.
 */
export function requestMonitorState(channel: BroadcastChannel | null): void {
  const msg: MonitorSyncMessage = { type: 'REQUEST_STATE' };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(msg, '*');
    } catch {
      // Ignore opener postMessage errors
    }
  }
}
