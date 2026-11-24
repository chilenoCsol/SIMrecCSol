import { useEffect, useState } from 'react';
import { SensorConnections, VitalParams } from '../types/simulation';
import {
  AlarmPriority,
  clinicalAudioCue,
  evaluateAlarmPriority,
} from '../utils/audioCue';

export interface ClinicalAlarmStatus {
  alarmPriority: AlarmPriority;
  isAlarmSilenced: boolean;
  silenceRemainingSec: number;
}

/**
 * Evaluates live cardiorespiratory alarm priority and triggers IEC 60601-1-8
 * alarm bursts via Web Audio API when audio is enabled and not silenced.
 */
export function useClinicalAlarmLoop(
  vitals: VitalParams,
  sensors: SensorConnections,
  audioEnabled: boolean,
  alarmSilencedUntilMs: number | null
): ClinicalAlarmStatus {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const alarmPriority = evaluateAlarmPriority(vitals, sensors);

  // Tick every 500ms while a 2-minute silence countdown is active
  useEffect(() => {
    if (alarmSilencedUntilMs === null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (t >= alarmSilencedUntilMs) {
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [alarmSilencedUntilMs]);

  const silenceRemainingSec =
    alarmSilencedUntilMs !== null
      ? Math.max(0, Math.ceil((alarmSilencedUntilMs - nowMs) / 1000))
      : 0;
  const isAlarmSilenced = silenceRemainingSec > 0;

  // Schedule repeating IEC 60601-1-8 alarm bursts whenever active & unsilenced
  useEffect(() => {
    if (!audioEnabled || alarmPriority === 'none' || isAlarmSilenced) {
      return;
    }

    // Immediate alert burst on threshold crossing or priority escalation
    clinicalAudioCue.playAlarmBurst(alarmPriority);

    const repeatMs = alarmPriority === 'high' ? 4400 : 6800;
    const intervalId = window.setInterval(() => {
      clinicalAudioCue.playAlarmBurst(alarmPriority);
    }, repeatMs);

    return () => window.clearInterval(intervalId);
  }, [audioEnabled, alarmPriority, isAlarmSilenced]);

  return {
    alarmPriority,
    isAlarmSilenced,
    silenceRemainingSec,
  };
}
