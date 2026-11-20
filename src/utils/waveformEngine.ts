import { CardiacRhythm, EcgLead } from '../types/simulation';

export const WAVE_BUFFER_SIZE = 270; // ~4.5 seconds at 60 samples/sec (25 mm/s clinical feel)
export const SAMPLE_RATE_HZ = 60;
const SAMPLE_DT = 1 / SAMPLE_RATE_HZ;

interface LeadMorphology {
  pAmp: number;
  qAmp: number;
  rAmp: number;
  sAmp: number;
  tAmp: number;
}

const LEAD_PROFILES: Record<EcgLead, LeadMorphology> = {
  DII: { pAmp: 0.14, qAmp: -0.13, rAmp: 1.0, sAmp: -0.24, tAmp: 0.27 },
  DI: { pAmp: 0.1, qAmp: -0.08, rAmp: 0.72, sAmp: -0.14, tAmp: 0.2 },
  DIII: { pAmp: 0.05, qAmp: -0.06, rAmp: 0.44, sAmp: -0.34, tAmp: 0.09 },
};

function gaussian(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/**
 * Computes physiological ECG amplitude in [-0.45, 1.05] for a given elapsed time
 * since the start of the current cardiac cycle.
 */
function sampleEcg(
  timeInCycleSec: number,
  beatIntervalSec: number,
  hr: number,
  lead: EcgLead,
  rhythm: CardiacRhythm,
  elapsedTotalSec: number
): number {
  if (rhythm === 'asistolia' || hr <= 0) {
    // Subtle clinical baseline wander / sensor noise floor
    const wander = Math.sin(elapsedTotalSec * 1.4) * 0.012 + Math.sin(elapsedTotalSec * 6.3) * 0.006;
    return wander;
  }

  const profile = LEAD_PROFILES[lead];
  const isPea = rhythm === 'pea';

  // Compress systole slightly at high neonatal heart rates (> 140 lpm) so T wave stays clear of next P
  const rateScale = hr > 135 ? Math.max(0.62, beatIntervalSec / 0.44) : 1.0;
  const qrsSpread = isPea ? 1.55 : 1.0;
  const ampScale = isPea ? 0.72 : 1.0;

  // Wave centers in seconds from beat cycle start
  const pCenter = 0.075 * rateScale;
  const qCenter = 0.145 * rateScale;
  const rCenter = 0.165 * rateScale;
  const sCenter = 0.188 * rateScale;
  const tCenter = 0.305 * rateScale;

  let v = 0;
  if (!isPea) {
    v += profile.pAmp * gaussian(timeInCycleSec, pCenter, 0.017 * rateScale);
  }
  v += profile.qAmp * ampScale * gaussian(timeInCycleSec, qCenter, 0.007 * rateScale * qrsSpread);
  v += profile.rAmp * ampScale * gaussian(timeInCycleSec, rCenter, 0.0085 * rateScale * qrsSpread);
  v += profile.sAmp * ampScale * gaussian(timeInCycleSec, sCenter, 0.009 * rateScale * qrsSpread);
  v += profile.tAmp * ampScale * gaussian(timeInCycleSec, tCenter, 0.03 * rateScale);

  // Tiny realistic baseline micro-noise
  v += Math.sin(elapsedTotalSec * 3.1) * 0.008;

  return v;
}

/**
 * Computes physiological pulse oximetry plethysmography amplitude in [0, 1]
 * with realistic pulse transit delay after R wave and dicrotic notch.
 */
function samplePleth(
  timeInCycleSec: number,
  beatIntervalSec: number,
  hr: number,
  spo2: number,
  rhythm: CardiacRhythm,
  elapsedTotalSec: number
): number {
  if (rhythm === 'asistolia' || rhythm === 'pea' || hr <= 0) {
    // No mechanical pulse wave in Asistolia or Pulseless Electrical Activity (AESP/PEA)
    return 0.04 + Math.sin(elapsedTotalSec * 2.2) * 0.01;
  }

  const rateScale = hr > 135 ? Math.max(0.62, beatIntervalSec / 0.44) : 1.0;

  // Pulse arrival time lags R-wave (~165ms) by ~105ms
  const pulseStart = 0.23 * rateScale;
  let t = timeInCycleSec - pulseStart;
  if (t < 0) {
    t += beatIntervalSec;
  }

  // Perfusion amplitude factor: healthy SpO2 produces fuller pulse wave
  const perfusionScale = 0.52 + 0.48 * Math.max(0, Math.min(1, (spo2 - 40) / 60));

  const systolicPeak = 0.095 * rateScale;
  const dicroticPeak = 0.22 * rateScale;

  // Sharp systolic upstroke + wider diastolic shoulder with dicrotic notch
  const systolic =
    t < systolicPeak
      ? gaussian(t, systolicPeak, 0.036 * rateScale)
      : gaussian(t, systolicPeak, 0.068 * rateScale);
  const dicrotic = 0.36 * gaussian(t, dicroticPeak, 0.065 * rateScale);

  const raw = Math.min(1, (systolic * 0.92 + dicrotic) * perfusionScale);
  return Math.max(0.02, raw + Math.sin(elapsedTotalSec * 1.9) * 0.008);
}

export interface WaveformEngineState {
  ecgBuffer: Float32Array;
  plethBuffer: Float32Array;
  writeIndex: number;
  sampleAccumulator: number;
  timeInCycleSec: number;
  elapsedTotalSec: number;
  beatFlashAlpha: number;
  plethFlashAlpha: number;
  rWaveTriggeredThisBeat: boolean;
  plethTriggeredThisBeat: boolean;
}

export function createWaveformEngineState(): WaveformEngineState {
  const ecgBuffer = new Float32Array(WAVE_BUFFER_SIZE);
  const plethBuffer = new Float32Array(WAVE_BUFFER_SIZE);
  plethBuffer.fill(0.04);

  return {
    ecgBuffer,
    plethBuffer,
    writeIndex: 0,
    sampleAccumulator: 0,
    timeInCycleSec: 0,
    elapsedTotalSec: 0,
    beatFlashAlpha: 0,
    plethFlashAlpha: 0,
    rWaveTriggeredThisBeat: false,
    plethTriggeredThisBeat: false,
  };
}

export interface StepResult {
  beatOccurred: boolean;
  ecgBeatOccurred: boolean;
  plethBeatOccurred: boolean;
}

/**
 * Advances the circular oscilloscope buffers by dtSec at a fixed 60 Hz internal sample rate.
 */
export function stepWaveformEngine(
  state: WaveformEngineState,
  dtSec: number,
  hr: number,
  spo2: number,
  lead: EcgLead,
  rhythm: CardiacRhythm
): StepResult {
  // Clamp huge frame gaps (e.g., tab backgrounding) to keep sweep smooth
  const clampedDt = Math.min(Math.max(dtSec, 0), 0.12);
  state.sampleAccumulator += clampedDt;
  state.beatFlashAlpha = Math.max(0, state.beatFlashAlpha - clampedDt * 3.4);
  state.plethFlashAlpha = Math.max(0, state.plethFlashAlpha - clampedDt * 3.4);

  let ecgBeatOccurred = false;
  let plethBeatOccurred = false;
  const effectiveHr = rhythm === 'asistolia' ? 0 : Math.max(0, hr);
  const hasMechanicalPulse = rhythm !== 'asistolia' && rhythm !== 'pea' && effectiveHr > 0;
  const beatIntervalSec = effectiveHr > 0 ? 60 / effectiveHr : 999;

  while (state.sampleAccumulator >= SAMPLE_DT) {
    state.sampleAccumulator -= SAMPLE_DT;
    state.elapsedTotalSec += SAMPLE_DT;

    if (effectiveHr > 0) {
      state.timeInCycleSec += SAMPLE_DT;
      const rateScale = effectiveHr > 135 ? Math.max(0.62, beatIntervalSec / 0.44) : 1.0;
      const rPeakSec = 0.165 * rateScale;
      const plethPeakSec = Math.min(beatIntervalSec - SAMPLE_DT, 0.325 * rateScale);

      if (!state.rWaveTriggeredThisBeat && state.timeInCycleSec >= rPeakSec) {
        state.rWaveTriggeredThisBeat = true;
        state.beatFlashAlpha = 1;
        ecgBeatOccurred = true;
      }

      if (
        hasMechanicalPulse &&
        !state.plethTriggeredThisBeat &&
        state.timeInCycleSec >= plethPeakSec
      ) {
        state.plethTriggeredThisBeat = true;
        state.plethFlashAlpha = 1;
        plethBeatOccurred = true;
      }

      if (state.timeInCycleSec >= beatIntervalSec) {
        state.timeInCycleSec = state.timeInCycleSec % beatIntervalSec;
        state.rWaveTriggeredThisBeat = false;
        state.plethTriggeredThisBeat = false;
      }
    } else {
      state.timeInCycleSec = 0;
      state.rWaveTriggeredThisBeat = false;
      state.plethTriggeredThisBeat = false;
    }

    const ecgVal = sampleEcg(
      state.timeInCycleSec,
      beatIntervalSec,
      effectiveHr,
      lead,
      rhythm,
      state.elapsedTotalSec
    );
    const plethVal = samplePleth(
      state.timeInCycleSec,
      beatIntervalSec,
      effectiveHr,
      spo2,
      rhythm,
      state.elapsedTotalSec
    );

    state.ecgBuffer[state.writeIndex] = ecgVal;
    state.plethBuffer[state.writeIndex] = plethVal;
    state.writeIndex = (state.writeIndex + 1) % WAVE_BUFFER_SIZE;
  }

  return {
    beatOccurred: ecgBeatOccurred,
    ecgBeatOccurred,
    plethBeatOccurred,
  };
}
