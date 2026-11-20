import { DebriefMilestoneDef, DebriefStage } from '../types/simulation';

export interface StageMeta {
  id: Exclude<DebriefStage, 'nota'>;
  title: string;
  accentHex: string;
  headerTextClass: string;
  buttonIdleClass: string;
  buttonActiveClass: string;
  badgeTextClass: string;
}

export const DEBRIEF_STAGES: StageMeta[] = [
  {
    id: 'evaluacion',
    title: 'Evaluación y Preguntas Clave',
    accentHex: '#818CF8',
    headerTextClass: 'text-indigo-300',
    buttonIdleClass:
      'bg-[#13162A] border-indigo-500/35 text-slate-100 hover:bg-indigo-500/15 hover:border-indigo-400/65',
    buttonActiveClass:
      'bg-indigo-500/20 border-indigo-400 text-indigo-100 hover:bg-indigo-500/25',
    badgeTextClass: 'text-indigo-200',
  },
  {
    id: 'inicial',
    title: 'Inicial',
    accentHex: '#38BDF8',
    headerTextClass: 'text-sky-400',
    buttonIdleClass:
      'bg-[#111A28] border-sky-500/30 text-slate-100 hover:bg-sky-500/15 hover:border-sky-400/60',
    buttonActiveClass:
      'bg-sky-500/20 border-sky-400 text-sky-100 hover:bg-sky-500/25',
    badgeTextClass: 'text-sky-300',
  },
  {
    id: 'via-aerea',
    title: 'Vía Aérea / Ventilación',
    accentHex: '#22C55E',
    headerTextClass: 'text-emerald-400',
    buttonIdleClass:
      'bg-[#101D1A] border-emerald-500/30 text-slate-100 hover:bg-emerald-500/15 hover:border-emerald-400/60',
    buttonActiveClass:
      'bg-emerald-500/20 border-emerald-400 text-emerald-100 hover:bg-emerald-500/25',
    badgeTextClass: 'text-emerald-300',
  },
  {
    id: 'circulacion',
    title: 'Circulación / Accesos',
    accentHex: '#F59E0B',
    headerTextClass: 'text-amber-400',
    buttonIdleClass:
      'bg-[#1D1910] border-amber-500/30 text-slate-100 hover:bg-amber-500/15 hover:border-amber-400/60',
    buttonActiveClass:
      'bg-amber-500/20 border-amber-400 text-amber-100 hover:bg-amber-500/25',
    badgeTextClass: 'text-amber-300',
  },
  {
    id: 'farmacos',
    title: 'Fármacos / Volumen',
    accentHex: '#F43F5E',
    headerTextClass: 'text-rose-400',
    buttonIdleClass:
      'bg-[#1F1218] border-rose-500/30 text-slate-100 hover:bg-rose-500/15 hover:border-rose-400/60',
    buttonActiveClass:
      'bg-rose-500/20 border-rose-400 text-rose-100 hover:bg-rose-500/25',
    badgeTextClass: 'text-rose-300',
  },
  {
    id: 'especiales',
    title: 'Procedimientos Especiales',
    accentHex: '#A855F7',
    headerTextClass: 'text-violet-400',
    buttonIdleClass:
      'bg-[#191324] border-violet-500/30 text-slate-100 hover:bg-violet-500/15 hover:border-violet-400/60',
    buttonActiveClass:
      'bg-violet-500/20 border-violet-400 text-violet-100 hover:bg-violet-500/25',
    badgeTextClass: 'text-violet-300',
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

/**
 * 19 clinical NRP debriefing milestones organized by color-coded stage:
 * 5 Evaluation & Key Questions + 14 NRP clinical interventions/procedures.
 */
export const DEBRIEF_MILESTONES: DebriefMilestoneDef[] = [
  // Evaluación y Preguntas Clave
  { id: 'preguntas-iniciales-ok', label: 'Preguntas iniciales ok', stage: 'evaluacion' },
  { id: 'pregunta-fc', label: 'Pregunta FC', stage: 'evaluacion' },
  { id: 'pregunta-sato2', label: 'Pregunta SaTO2', stage: 'evaluacion' },
  { id: 'pregunta-er', label: 'Pregunta ER (Esfuerzo Respiratorio)', stage: 'evaluacion' },
  { id: 'pregunta-mov-torax', label: 'Pregunta Mov. Torax', stage: 'evaluacion' },

  // Inicial
  { id: 'pasos-iniciales', label: 'Pasos iniciales', stage: 'inicial' },
  { id: 'sensor-sat-ok', label: 'Sensor de Saturación OK', stage: 'inicial' },

  // Vía Aérea / Ventilación
  { id: 'ventilacion', label: 'Ventilación', stage: 'via-aerea' },
  { id: 'mrsopa', label: 'MRSOPA', stage: 'via-aerea' },
  { id: 'tet-ml', label: 'TET/ML', stage: 'via-aerea' },

  // Circulación / Accesos
  { id: 'monitor-cardiaco', label: 'Monitor Cardiaco', stage: 'circulacion' },
  { id: 'mc-fio2-100', label: 'MC/FiO2 100%', stage: 'circulacion' },
  { id: 'cateterismo', label: 'Cateterismo', stage: 'circulacion' },

  // Fármacos / Volumen
  { id: 'adrenalina-et', label: 'Adrenalina ET', stage: 'farmacos' },
  { id: 'adrenalina-d1', label: 'Adrenalina Dosis 1', stage: 'farmacos' },
  { id: 'adrenalina-d2', label: 'Adrenalina Dosis 2', stage: 'farmacos' },
  { id: 'adrenalina-d3', label: 'Adrenalina Dosis 3', stage: 'farmacos' },
  { id: 'admin-volumen', label: 'Administración Volumen', stage: 'farmacos' },

  // Procedimientos Especiales
  { id: 'puncion-pleural', label: 'Punción Pleural', stage: 'especiales' },
];
