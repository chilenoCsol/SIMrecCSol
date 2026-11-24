import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Maximize2,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { loadProcessedSochipeLogo, SOCHIPE_LOGO_SRC } from '../utils/logoProcessor';

interface LandingScreenProps {
  isLightMode: boolean;
  onToggleTheme: () => void;
  onEnterSimulator: () => void;
}

const PILLAR_CARDS = [
  {
    id: 'debriefing',
    title: 'Evaluación y Debriefing Estructurado',
    description:
      'Diseñado para cumplir con los estándares de evaluación en simulación neonatal, integrando video HD con signos vitales superpuestos (HUD) y cronómetro sincronizado.',
    icon: Activity,
    lightAccent: 'bg-sky-100 text-sky-700 border-sky-200',
    darkAccent: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    highlightPrivacy: false,
  },
  {
    id: 'record',
    title: 'Hoja de Récord de Eventos por Tiempo',
    description:
      'Registro en un clic de hitos críticos, preguntas clave y maniobras de reanimación, con exportación automática de una bitácora cronológica detallada junto al video.',
    icon: ClipboardList,
    lightAccent: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    darkAccent: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    highlightPrivacy: false,
  },
  {
    id: 'privacy',
    title: 'Privacidad y Seguridad 100 % Local',
    descriptionPrefix: 'Las grabaciones nunca se suben ni quedan almacenadas en ninguna nube virtual.',
    description:
      ' Todo el procesamiento ocurre en el equipo local y solo el instructor y los estudiantes tienen acceso directo a los archivos generados.',
    icon: ShieldCheck,
    lightAccent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    darkAccent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    highlightPrivacy: true,
  },
  {
    id: 'control',
    title: 'Control Clínico Total',
    description:
      'Monitor multiparámetro personalizable con rampas de transición, alarmas realistas y vista sincronizada para pantalla de estudiantes.',
    icon: SlidersHorizontal,
    lightAccent: 'bg-amber-100 text-amber-700 border-amber-200',
    darkAccent: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    highlightPrivacy: false,
  },
] as const;

export const LandingScreen: React.FC<LandingScreenProps> = ({
  isLightMode,
  onToggleTheme,
  onEnterSimulator,
}) => {
  const [transparentLogoUrl, setTransparentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadProcessedSochipeLogo()
      .then((processed) => {
        if (mounted) {
          setTransparentLogoUrl(processed.dataUrl);
        }
      })
      .catch(() => {
        // Fallback to raw asset if canvas processing fails
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      data-theme={isLightMode ? 'light' : 'dark'}
      className={`min-h-screen flex flex-col transition-colors ${
        isLightMode ? 'bg-[#F1F5F9] text-slate-900' : 'bg-[#080C12] text-slate-100'
      }`}
    >
      {/* Top Executive Clinical Bar */}
      <header
        className={`shrink-0 border-b px-5 sm:px-8 py-3 flex items-center justify-between gap-4 transition-colors ${
          isLightMode
            ? 'bg-white border-slate-300 shadow-xs'
            : 'bg-[#0B1019] border-slate-800/90'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={isLightMode ? SOCHIPE_LOGO_SRC : transparentLogoUrl ?? SOCHIPE_LOGO_SRC}
            alt="Logotipo institucional CEI SOCHIPE"
            className="w-9 h-9 object-contain shrink-0 rounded"
          />
          <div className="min-w-0">
            <div
              className={`text-xs font-bold tracking-wide uppercase truncate ${
                isLightMode ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              CEI SOCHIPE
            </div>
            <div
              className={`text-[11px] truncate ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Programa de Reanimación Neonatal · Simulación Clínica
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          title={
            isLightMode
              ? 'Cambiar a Modo Oscuro clínico'
              : 'Cambiar a Modo Claro para salas bien iluminadas'
          }
          className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
      </header>

      {/* Main Executive Hero + 4 Pillar Cards + CTA */}
      <main className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-8 sm:py-10">
        <div className="w-full max-w-5xl mx-auto space-y-8">
          {/* Hero Header */}
          <section className="text-center max-w-3xl mx-auto space-y-3">
            <h1
              className={`text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-tight ${
                isLightMode ? 'text-slate-900' : 'text-slate-50'
              }`}
            >
              Video Simulador PRN 9na edición
            </h1>
            <p
              className={`text-sm sm:text-base leading-relaxed ${
                isLightMode ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Grabador profesional de simulación clínica neonatal con monitor multiparámetro
              flotante en tiempo real, bitácora cronológica de hitos y debriefing estructurado.
            </p>
          </section>

          {/* 4 Visual Pillar Cards */}
          <section
            aria-label="Pilares clave de la plataforma"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {PILLAR_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.id}
                  className={`rounded-xl border p-5 flex items-start gap-4 transition-colors ${
                    card.highlightPrivacy
                      ? isLightMode
                        ? 'bg-white border-emerald-400/80 shadow-xs'
                        : 'bg-[#0F1722] border-emerald-500/40'
                      : isLightMode
                      ? 'bg-white border-slate-300 shadow-xs'
                      : 'bg-[#0F1520] border-slate-800'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                      isLightMode ? card.lightAccent : card.darkAccent
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <h2
                      className={`text-sm sm:text-[15px] font-bold leading-snug ${
                        isLightMode ? 'text-slate-900' : 'text-slate-100'
                      }`}
                    >
                      {card.title}
                    </h2>
                    <p
                      className={`text-xs sm:text-[13px] leading-relaxed ${
                        isLightMode ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      {'descriptionPrefix' in card && (
                        <strong
                          className={
                            isLightMode
                              ? 'font-semibold text-emerald-800'
                              : 'font-semibold text-emerald-300'
                          }
                        >
                          {card.descriptionPrefix}
                        </strong>
                      )}
                      {card.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Primary Call To Action + Fullscreen Notice */}
          <section className="flex flex-col items-center text-center space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onEnterSimulator}
              className={`h-12 px-8 rounded-lg text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm ${
                isLightMode
                  ? 'bg-sky-600 text-white hover:bg-sky-700 active:scale-[0.99]'
                  : 'bg-sky-500 text-slate-950 hover:bg-sky-400 active:scale-[0.99]'
              }`}
            >
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span>Ingresar al Simulador</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <p
              className={`text-xs inline-flex items-center gap-1.5 ${
                isLightMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
              <span>Se abrirá en pantalla completa para aprovechar mejor el espacio de trabajo</span>
            </p>
          </section>
        </div>
      </main>

      {/* Sober Institutional Authorship Footer */}
      <footer
        className={`shrink-0 border-t px-5 sm:px-8 py-4 text-center transition-colors ${
          isLightMode
            ? 'bg-white border-slate-300 text-slate-700'
            : 'bg-[#0B1019] border-slate-800/90 text-slate-400'
        }`}
      >
        <p className="text-xs sm:text-[13px] font-medium max-w-3xl mx-auto">
          Herramienta ideada y desarrollada por el{' '}
          <span className={isLightMode ? 'font-semibold text-slate-900' : 'font-semibold text-slate-200'}>
            Matrón Carlos Solar O.
          </span>
          , Instructor Mentor del Programa de Reanimación Neonatal CEI SOCHIPE.
        </p>
      </footer>
    </div>
  );
};
