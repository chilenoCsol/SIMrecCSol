import { DebriefMilestoneDef, DebriefStage } from '../types/simulation';

export interface StageStyleSet {
  headerTextClass: string;
  buttonIdleClass: string;
  buttonActiveClass: string;
  badgeTextClass: string;
}

export interface StageMeta {
  id: Exclude<DebriefStage, 'nota'>;
  title: string;
  accentHex: string;
  light: StageStyleSet;
  dark: StageStyleSet;
}

export const DEBRIEF_STAGES: StageMeta[] = [
  {
    id: 'evaluacion',
    title: 'Evaluación y Preguntas Clave',
    accentHex: '#818CF8',
    light: {
      headerTextClass: 'text-indigo-800',
      buttonIdleClass:
        'bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100 hover:border-indigo-400',
      buttonActiveClass:
        'bg-indigo-100 border-indigo-500 text-indigo-950 hover:bg-indigo-200/80',
      badgeTextClass: 'text-indigo-800',
    },
    dark: {
      headerTextClass: 'text-indigo-300',
      buttonIdleClass:
        'bg-[#13162A] border-indigo-500/35 text-slate-100 hover:bg-indigo-500/15 hover:border-indigo-400/65',
      buttonActiveClass:
        'bg-indigo-500/20 border-indigo-400 text-indigo-100 hover:bg-indigo-500/25',
      badgeTextClass: 'text-indigo-200',
    },
  },
  {
    id: 'inicial',
    title: 'Inicial',
    accentHex: '#38BDF8',
    light: {
      headerTextClass: 'text-sky-800',
      buttonIdleClass:
        'bg-sky-50 border-sky-300 text-sky-950 hover:bg-sky-100 hover:border-sky-400',
      buttonActiveClass:
        'bg-sky-100 border-sky-500 text-sky-950 hover:bg-sky-200/80',
      badgeTextClass: 'text-sky-800',
    },
    dark: {
      headerTextClass: 'text-sky-400',
      buttonIdleClass:
        'bg-[#111A28] border-sky-500/30 text-slate-100 hover:bg-sky-500/15 hover:border-sky-400/60',
      buttonActiveClass:
        'bg-sky-500/20 border-sky-400 text-sky-100 hover:bg-sky-500/25',
      badgeTextClass: 'text-sky-300',
    },
  },
  {
    id: 'via-aerea',
    title: 'Vía Aérea / Ventilación',
    accentHex: '#22C55E',
    light: {
      headerTextClass: 'text-emerald-800',
      buttonIdleClass:
        'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400',
      buttonActiveClass:
        'bg-emerald-100 border-emerald-500 text-emerald-950 hover:bg-emerald-200/80',
      badgeTextClass: 'text-emerald-800',
    },
    dark: {
      headerTextClass: 'text-emerald-400',
      buttonIdleClass:
        'bg-[#101D1A] border-emerald-500/30 text-slate-100 hover:bg-emerald-500/15 hover:border-emerald-400/60',
      buttonActiveClass:
        'bg-emerald-500/20 border-emerald-400 text-emerald-100 hover:bg-emerald-500/25',
      badgeTextClass: 'text-emerald-300',
    },
  },
  {
    id: 'circulacion',
    title: 'Circulación / Accesos',
    accentHex: '#F59E0B',
    light: {
      headerTextClass: 'text-amber-800',
      buttonIdleClass:
        'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100 hover:border-amber-400',
      buttonActiveClass:
        'bg-amber-100 border-amber-500 text-amber-950 hover:bg-amber-200/80',
      badgeTextClass: 'text-amber-800',
    },
    dark: {
      headerTextClass: 'text-amber-400',
      buttonIdleClass:
        'bg-[#1D1910] border-amber-500/30 text-slate-100 hover:bg-amber-500/15 hover:border-amber-400/60',
      buttonActiveClass:
        'bg-amber-500/20 border-amber-400 text-amber-100 hover:bg-amber-500/25',
      badgeTextClass: 'text-amber-300',
    },
  },
  {
    id: 'farmacos',
    title: 'Fármacos / Volumen',
    accentHex: '#F43F5E',
    light: {
      headerTextClass: 'text-rose-800',
      buttonIdleClass:
        'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100 hover:border-rose-400',
      buttonActiveClass:
        'bg-rose-100 border-rose-500 text-rose-950 hover:bg-rose-200/80',
      badgeTextClass: 'text-rose-800',
    },
    dark: {
      headerTextClass: 'text-rose-400',
      buttonIdleClass:
        'bg-[#1F1218] border-rose-500/30 text-slate-100 hover:bg-rose-500/15 hover:border-rose-400/60',
      buttonActiveClass:
        'bg-rose-500/20 border-rose-400 text-rose-100 hover:bg-rose-500/25',
      badgeTextClass: 'text-rose-300',
    },
  },
  {
    id: 'especiales',
    title: 'Procedimientos Especiales',
    accentHex: '#A855F7',
    light: {
      headerTextClass: 'text-violet-800',
      buttonIdleClass:
        'bg-violet-50 border-violet-300 text-violet-950 hover:bg-violet-100 hover:border-violet-400',
      buttonActiveClass:
        'bg-violet-100 border-violet-500 text-violet-950 hover:bg-violet-200/80',
      badgeTextClass: 'text-violet-800',
    },
    dark: {
      headerTextClass: 'text-violet-400',
      buttonIdleClass:
        'bg-[#191324] border-violet-500/30 text-slate-100 hover:bg-violet-500/15 hover:border-violet-400/60',
      buttonActiveClass:
        'bg-violet-500/20 border-violet-400 text-violet-100 hover:bg-violet-500/25',
      badgeTextClass: 'text-violet-300',
    },
  },
];

export const STAGE_LABELS: Record<DebriefStage, string> = {
  evaluacion: 'Evaluación y Preguntas Clave',
  inicial: 'Inicial',
  'via-aerea': 'Vía Aérea / Ventilación',
  circulacion: 'Circulación / Accesos',
  farmacos: 'Fármacos / Volumen',
  especiales: 'Procedimientos Especiales',
  nota: 'Nota Libre',
};

export const STAGE_ACCENT_HEX: Record<DebriefStage, string> = {
  evaluacion: '#818CF8',
  inicial: '#38BDF8',
  'via-aerea': '#22C55E',
  circulacion: '#F59E0B',
  farmacos: '#F43F5E',
  especiales: '#A855F7',
  nota: '#94A3B8',
};

export const STAGE_TIME_TEXT_LIGHT: Record<DebriefStage, string> = {
  evaluacion: 'text-indigo-700',
  inicial: 'text-sky-700',
  'via-aerea': 'text-emerald-700',
  circulacion: 'text-amber-700',
  farmacos: 'text-rose-700',
  especiales: 'text-violet-700',
  nota: 'text-slate-600',
};

export const STAGE_TIME_TEXT_DARK: Record<DebriefStage, string> = {
  evaluacion: 'text-indigo-300',
  inicial: 'text-sky-400',
  'via-aerea': 'text-emerald-400',
  circulacion: 'text-amber-400',
  farmacos: 'text-rose-400',
  especiales: 'text-violet-400',
  nota: 'text-slate-400',
};

export const CRITICAL_ERROR_BUTTON_LIGHT = {
  idle: 'border-2 border-red-500 bg-red-50/90 text-red-950 hover:bg-red-100 hover:border-red-600',
  active: 'border-2 border-red-600 bg-red-100 text-red-950 font-semibold hover:bg-red-200/80',
  badge: 'bg-red-600 border-red-700 text-white',
};

export const CRITICAL_ERROR_BUTTON_DARK = {
  idle: 'border-2 border-red-500/90 bg-red-950/35 text-red-100 hover:bg-red-900/45 hover:border-red-400',
  active: 'border-2 border-red-500 bg-red-600/25 text-red-50 font-semibold hover:bg-red-600/35',
  badge: 'bg-red-500/35 border-red-400/75 text-red-100',
};

/**
 * 30 clinical NRP debriefing buttons organized by color-coded stage:
 * 5 Evaluation & Key Questions + 14 NRP clinical interventions/procedures
 * + 11 Critical Errors (highlighted in red frame) inside their corresponding categories.
 */
export const DEBRIEF_MILESTONES: DebriefMilestoneDef[] = [
  // Evaluación y Preguntas Clave
  { id: 'preguntas-iniciales-ok', label: 'Preguntas iniciales ok', stage: 'evaluacion' },
  { id: 'pregunta-fc', label: 'Pregunta FC', stage: 'evaluacion' },
  { id: 'pregunta-sato2', label: 'Pregunta SaTO2', stage: 'evaluacion' },
  { id: 'pregunta-er', label: 'Pregunta ER (Esfuerzo Respiratorio)', stage: 'evaluacion' },
  { id: 'pregunta-mov-torax', label: 'Pregunta Mov. Torax', stage: 'evaluacion' },
  {
    id: 'err-preguntas-iniciales-incorrectas',
    label: 'Preguntas iniciales incorrectas',
    stage: 'evaluacion',
    isCriticalError: true,
  },
  {
    id: 'err-no-pregunta-fc',
    label: 'No pregunta FC',
    stage: 'evaluacion',
    isCriticalError: true,
  },
  {
    id: 'err-no-pregunta-mov-torax',
    label: 'No pregunta Mov. Tórax',
    stage: 'evaluacion',
    isCriticalError: true,
  },
  {
    id: 'err-no-pregunta-sato2',
    label: 'No pregunta SatO2',
    stage: 'evaluacion',
    isCriticalError: true,
  },

  // Inicial
  { id: 'pasos-iniciales', label: 'Pasos iniciales', stage: 'inicial' },
  { id: 'sensor-sat-ok', label: 'Sensor de Saturación OK', stage: 'inicial' },
  {
    id: 'err-pasos-iniciales-incorrectos',
    label: 'Pasos iniciales incorrectos',
    stage: 'inicial',
    isCriticalError: true,
  },

  // Vía Aérea / Ventilación
  { id: 'ventilacion', label: 'Ventilación', stage: 'via-aerea' },
  { id: 'mrsopa', label: 'MRSOPA', stage: 'via-aerea' },
  { id: 'tet-ml', label: 'TET/ML', stage: 'via-aerea' },
  {
    id: 'err-no-inicia-ventilacion',
    label: 'No inicia ventilación',
    stage: 'via-aerea',
    isCriticalError: true,
  },
  {
    id: 'err-no-realiza-mrsopa',
    label: 'No realiza /incompleto MRSOPA',
    stage: 'via-aerea',
    isCriticalError: true,
  },

  // Circulación / Accesos
  { id: 'monitor-cardiaco', label: 'Monitor Cardiaco', stage: 'circulacion' },
  { id: 'mc-fio2-100', label: 'MC/FiO2 100%', stage: 'circulacion' },
  { id: 'cateterismo', label: 'Cateterismo', stage: 'circulacion' },
  {
    id: 'err-no-coloca-monitor-cardiaco',
    label: 'No coloca monitor cardiaco',
    stage: 'circulacion',
    isCriticalError: true,
  },
  {
    id: 'err-mc-sin-100-fio2',
    label: 'MC sin 100% FiO2',
    stage: 'circulacion',
    isCriticalError: true,
  },

  // Fármacos / Volumen
  { id: 'adrenalina-et', label: 'Adrenalina ET', stage: 'farmacos' },
  { id: 'adrenalina-d1', label: 'Adrenalina Dosis 1', stage: 'farmacos' },
  { id: 'adrenalina-d2', label: 'Adrenalina Dosis 2', stage: 'farmacos' },
  { id: 'adrenalina-d3', label: 'Adrenalina Dosis 3', stage: 'farmacos' },
  { id: 'admin-volumen', label: 'Administración Volumen', stage: 'farmacos' },
  {
    id: 'err-dosis-epi-erronea',
    label: 'Dosis de EPI errónea ET o EV',
    stage: 'farmacos',
    isCriticalError: true,
  },
  {
    id: 'err-no-bolo-3ml-sf-epi',
    label: 'No administra bolo 3 ml SF después de EPI',
    stage: 'farmacos',
    isCriticalError: true,
  },

  // Procedimientos Especiales
  { id: 'puncion-pleural', label: 'Punción Pleural', stage: 'especiales' },
];
