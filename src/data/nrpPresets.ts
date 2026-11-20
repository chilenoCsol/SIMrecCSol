import { CardiacRhythm, NrpPreset } from '../types/simulation';

export const RHYTHM_LABELS: Record<CardiacRhythm, string> = {
  sinusal: 'Sinusal',
  bradicardia: 'Bradicardia',
  asistolia: 'Asistolia',
  pea: 'AESP / PEA',
};

export const RHYTHM_SHORT_LABELS: Record<CardiacRhythm, string> = {
  sinusal: 'SINUSAL',
  bradicardia: 'BRADICARDIA',
  asistolia: 'ASISTOLIA',
  pea: 'AESP / PEA',
};

export const NRP_PRESETS: NrpPreset[] = [
  {
    id: 'rn-transicion',
    name: 'RN Sano / Transición',
    summary: '148 lpm · 94% · 36.9 °C',
    hr: 148,
    spo2: 94,
    temp: 36.9,
    rhythm: 'sinusal',
  },
  {
    id: 'apnea-bradi',
    name: 'Apnea y Bradicardia',
    summary: '78 lpm · 68% · 36.6 °C',
    hr: 78,
    spo2: 68,
    temp: 36.6,
    rhythm: 'bradicardia',
  },
  {
    id: 'bradi-severa',
    name: 'Bradicardia < 60 (RCP)',
    summary: '48 lpm · 54% · 36.2 °C',
    hr: 48,
    spo2: 54,
    temp: 36.2,
    rhythm: 'bradicardia',
  },
  {
    id: 'recuperacion-vpp',
    name: 'Recuperación Post-VPP',
    summary: '132 lpm · 88% · 36.7 °C',
    hr: 132,
    spo2: 88,
    temp: 36.7,
    rhythm: 'sinusal',
  },
  {
    id: 'asistolia-nrp',
    name: 'Asistolia',
    summary: '0 lpm · 40% · 35.8 °C',
    hr: 0,
    spo2: 40,
    temp: 35.8,
    rhythm: 'asistolia',
  },
  {
    id: 'aesp-pea',
    name: 'AESP / PEA',
    summary: '54 lpm · Sin pulso · 36.0 °C',
    hr: 54,
    spo2: 42,
    temp: 36.0,
    rhythm: 'pea',
  },
];

export const HYPOTHERMIA_THRESHOLD = 36.5;
