import { HYPOTHERMIA_THRESHOLD } from '../data/nrpPresets';
import { SensorConnections, VitalParams } from '../types/simulation';

export type AlarmPriority = 'none' | 'medium' | 'high';

export const ALARM_SILENCE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

const ALL_CONNECTED: SensorConnections = {
  ecgConnected: true,
  spo2Connected: true,
  tempConnected: true,
};

/**
 * Evaluates clinical cardiorespiratory alarm priority following IEC 60601-1-8 conventions,
 * strictly gated by which bedside sensors are physically connected:
 * - High priority (5-pulse burst):
 *   - ECG connected: Asistolia, AESP/PEA, Severe Bradycardia (<60 lpm)
 *   - SpO2 connected: Severe Desaturation (<75%), or Pulseless / Severe Bradycardia (<60 lpm) when HR derives from SpO2
 * - Medium priority (3-pulse burst):
 *   - ECG or SpO2 connected: Bradycardia (<100 lpm)
 *   - SpO2 connected: Desaturation (<85%)
 *   - Temp connected: Hypothermia (<36.5 °C)
 * - Disconnected sensors NEVER trigger false alarms (e.g., no false asystole or hypothermia when OFF).
 */
export function evaluateAlarmPriority(
  vitals: VitalParams,
  sensors: SensorConnections = ALL_CONNECTED
): AlarmPriority {
  const hr = vitals.rhythm === 'asistolia' ? 0 : Math.round(vitals.hr);
  const spo2 = Math.round(vitals.spo2);
  const isAsystole = vitals.rhythm === 'asistolia' || hr === 0;
  const isPea = vitals.rhythm === 'pea';
  const noPulse = isAsystole || isPea;

  // High priority checks (only for connected sensors)
  if (sensors.ecgConnected) {
    if (isAsystole || isPea || hr < 60) {
      return 'high';
    }
  }

  if (sensors.spo2Connected) {
    if (noPulse) {
      return 'high';
    }
    if (spo2 < 75 || (!sensors.ecgConnected && hr < 60)) {
      return 'high';
    }
  }

  // Medium priority checks (only for connected sensors)
  if (sensors.ecgConnected && hr < 100) {
    return 'medium';
  }

  if (sensors.spo2Connected && !noPulse) {
    if (spo2 < 85 || (!sensors.ecgConnected && hr < 100)) {
      return 'medium';
    }
  }

  if (sensors.tempConnected && vitals.temp < HYPOTHERMIA_THRESHOLD) {
    return 'medium';
  }

  return 'none';
}

/**
 * Web Audio API clinical multiparameter monitor synthesizer:
 * 1. Pitch-modulated QRS / pulse oximetry beep (pitch drops progressively as SpO2 falls,
 *    or uses a steady 660 Hz ECG QRS beep when SpO2 probe is disconnected)
 * 2. IEC 60601-1-8 style cardiorespiratory alarm sequences (3-pulse medium / 5-pulse high priority)
 */
class ClinicalAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.65;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Short, clean QRS / pulse oximetry beep.
   * When modulateBySpo2 is true and pulse is present, frequency follows SpO2 (880 Hz at 100% -> 300 Hz at 40%).
   * When ECG is connected alone (modulateBySpo2 = false), plays a steady calibrated 660 Hz QRS tone.
   */
  public playBeat(spo2: number, hasPulse: boolean, modulateBySpo2 = true): void {
    if (this.masterVolume <= 0.005) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clampedSpo2 = Math.max(40, Math.min(100, spo2));
    const freq = !modulateBySpo2
      ? hasPulse
        ? 660
        : 330
      : hasPulse
      ? 300 * Math.pow(880 / 300, (clampedSpo2 - 40) / 60)
      : 330;

    const peakGain = (hasPulse ? 0.14 : 0.08) * this.masterVolume;

    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const harmGain = ctx.createGain();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Subtle 2nd harmonic gives authentic medical transducer warmth
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2, now);

    oscGain.gain.setValueAtTime(1.0, now);
    harmGain.gain.setValueAtTime(0.12, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.007);
    env.gain.setValueAtTime(peakGain, now + 0.048);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(oscGain);
    harmonic.connect(harmGain);
    oscGain.connect(env);
    harmGain.connect(env);
    env.connect(ctx.destination);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 0.095);
    harmonic.stop(now + 0.095);
  }

  /**
   * Plays an IEC 60601-1-8 inspired multiparameter alarm burst:
   * - High priority: 5-pulse urgent burst (3 pulses + short pause + 2 pulses)
   * - Medium priority: 3-pulse warning burst
   */
  public playAlarmBurst(priority: 'medium' | 'high'): void {
    if (this.masterVolume <= 0.005) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const baseTime = ctx.currentTime + 0.01;

    // Classic IEC 60601-1-8 cardiac/respiratory melodic pulse timings & pitches
    const pulses: Array<{ offsetSec: number; durationSec: number; freqHz: number }> =
      priority === 'high'
        ? [
            { offsetSec: 0.0, durationSec: 0.105, freqHz: 783.99 }, // G5
            { offsetSec: 0.155, durationSec: 0.105, freqHz: 987.77 }, // B5
            { offsetSec: 0.31, durationSec: 0.105, freqHz: 1174.66 }, // D6
            { offsetSec: 0.56, durationSec: 0.105, freqHz: 987.77 }, // B5
            { offsetSec: 0.715, durationSec: 0.135, freqHz: 1174.66 }, // D6
          ]
        : [
            { offsetSec: 0.0, durationSec: 0.13, freqHz: 659.25 }, // E5
            { offsetSec: 0.21, durationSec: 0.13, freqHz: 783.99 }, // G5
            { offsetSec: 0.42, durationSec: 0.15, freqHz: 987.77 }, // B5
          ];

    const peakGain = (priority === 'high' ? 0.18 : 0.13) * this.masterVolume;

    // Shared warm low-pass filter so alarm harmonics sound like a real clinical monitor speaker
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, baseTime);
    filter.connect(ctx.destination);

    for (const pulse of pulses) {
      const t0 = baseTime + pulse.offsetSec;
      const tEnd = t0 + pulse.durationSec;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const mix = ctx.createGain();
      const env = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(pulse.freqHz, t0);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(pulse.freqHz * 2, t0);

      mix.gain.setValueAtTime(0.22, t0);

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
      env.gain.setValueAtTime(peakGain, tEnd - 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      osc1.connect(env);
      osc2.connect(mix);
      mix.connect(env);
      env.connect(filter);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(tEnd + 0.015);
      osc2.stop(tEnd + 0.015);
    }
  }
}

export const clinicalAudioCue = new ClinicalAudioSynthesizer();
