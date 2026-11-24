export interface VoiceSynonymRule {
  milestoneId: string;
  phrase: string;
}

const RAW_VOICE_RULES: VoiceSynonymRule[] = [
  // Preguntas iniciales ok
  { milestoneId: 'preguntas-iniciales-ok', phrase: 'preguntas iniciales' },
  { milestoneId: 'preguntas-iniciales-ok', phrase: 'edad gestacional' },
  { milestoneId: 'preguntas-iniciales-ok', phrase: 'liquido amniotico' },
  { milestoneId: 'preguntas-iniciales-ok', phrase: 'tono muscular' },

  // Pregunta FC
  { milestoneId: 'pregunta-fc', phrase: 'frecuencia cardiaca' },
  { milestoneId: 'pregunta-fc', phrase: 'cuanto tiene de frecuencia' },
  { milestoneId: 'pregunta-fc', phrase: 'como esta la fc' },
  { milestoneId: 'pregunta-fc', phrase: 'latidos' },

  // Pregunta SatO2
  { milestoneId: 'pregunta-sato2', phrase: 'saturacion' },
  { milestoneId: 'pregunta-sato2', phrase: 'cuanto satura' },
  { milestoneId: 'pregunta-sato2', phrase: 'sato2' },
  { milestoneId: 'pregunta-sato2', phrase: 'oximetria' },

  // Pregunta ER (Esfuerzo Respiratorio)
  { milestoneId: 'pregunta-er', phrase: 'esfuerzo respiratorio' },
  { milestoneId: 'pregunta-er', phrase: 'respira' },
  { milestoneId: 'pregunta-er', phrase: 'apnea' },
  { milestoneId: 'pregunta-er', phrase: 'llora' },

  // Pregunta Mov. Tórax
  { milestoneId: 'pregunta-mov-torax', phrase: 'mueve el torax' },
  { milestoneId: 'pregunta-mov-torax', phrase: 'movimiento del torax' },
  { milestoneId: 'pregunta-mov-torax', phrase: 'expande el torax' },
  { milestoneId: 'pregunta-mov-torax', phrase: 'elevacion del torax' },

  // Pasos iniciales
  { milestoneId: 'pasos-iniciales', phrase: 'pasos iniciales' },
  { milestoneId: 'pasos-iniciales', phrase: 'secar y estimular' },
  { milestoneId: 'pasos-iniciales', phrase: 'calor' },
  { milestoneId: 'pasos-iniciales', phrase: 'despejar via aerea' },

  // Sensor de Saturación OK
  { milestoneId: 'sensor-sat-ok', phrase: 'sensor de saturacion' },
  { milestoneId: 'sensor-sat-ok', phrase: 'oximetro en mano derecha' },
  { milestoneId: 'sensor-sat-ok', phrase: 'sensor preductal' },

  // Ventilación
  { milestoneId: 'ventilacion', phrase: 'inicio ventilacion' },
  { milestoneId: 'ventilacion', phrase: 'iniciamos vpp' },
  { milestoneId: 'ventilacion', phrase: 'ventilacion a presion positiva' },
  { milestoneId: 'ventilacion', phrase: 'ventilo dos tres' },
  { milestoneId: 'ventilacion', phrase: 'ventilo 2 3' },

  // MRSOPA
  { milestoneId: 'mrsopa', phrase: 'mrsopa' },
  { milestoneId: 'mrsopa', phrase: 'mr sopa' },
  { milestoneId: 'mrsopa', phrase: 'ajustar mascara' },
  { milestoneId: 'mrsopa', phrase: 'reubicar cabeza' },
  { milestoneId: 'mrsopa', phrase: 'succionar' },
  { milestoneId: 'mrsopa', phrase: 'abrir boca' },
  { milestoneId: 'mrsopa', phrase: 'aumentar presion' },

  // TET/ML
  { milestoneId: 'tet-ml', phrase: 'intubar' },
  { milestoneId: 'tet-ml', phrase: 'tubo endotraqueal' },
  { milestoneId: 'tet-ml', phrase: 'mascara laringea' },
  { milestoneId: 'tet-ml', phrase: 'via aerea alternativa' },

  // Monitor Cardiaco
  { milestoneId: 'monitor-cardiaco', phrase: 'monitor cardiaco' },
  { milestoneId: 'monitor-cardiaco', phrase: 'electrodos' },
  { milestoneId: 'monitor-cardiaco', phrase: 'poner ecg' },
  { milestoneId: 'monitor-cardiaco', phrase: 'conectar monitor' },

  // MC/FiO2 100%
  { milestoneId: 'mc-fio2-100', phrase: 'fio2 al cien' },
  { milestoneId: 'mc-fio2-100', phrase: 'fio2 al 100' },
  { milestoneId: 'mc-fio2-100', phrase: 'fio2 100' },
  { milestoneId: 'mc-fio2-100', phrase: 'oxigeno al cien' },
  { milestoneId: 'mc-fio2-100', phrase: 'oxigeno al 100' },
  { milestoneId: 'mc-fio2-100', phrase: 'masaje cardiaco' },
  { milestoneId: 'mc-fio2-100', phrase: 'compresiones toracicas' },
  { milestoneId: 'mc-fio2-100', phrase: 'uno y dos y tres y ventilo' },
  { milestoneId: 'mc-fio2-100', phrase: '1 y 2 y 3 y ventilo' },

  // Cateterismo
  { milestoneId: 'cateterismo', phrase: 'cateter umbilical' },
  { milestoneId: 'cateterismo', phrase: 'vena umbilical' },
  { milestoneId: 'cateterismo', phrase: 'acceso venoso' },
  { milestoneId: 'cateterismo', phrase: 'cateterismo' },

  // Adrenalina / Fármacos / Volumen
  { milestoneId: 'admin-volumen', phrase: 'bolo de suero' },
  { milestoneId: 'admin-volumen', phrase: 'suero fisiologico' },
  { milestoneId: 'adrenalina-et', phrase: 'adrenalina endotraqueal' },
  { milestoneId: 'adrenalina-et', phrase: 'adrenalina et' },
  { milestoneId: 'adrenalina-et', phrase: 'epinefrina endotraqueal' },
  { milestoneId: 'adrenalina-d2', phrase: 'adrenalina dosis 2' },
  { milestoneId: 'adrenalina-d2', phrase: 'segunda dosis de adrenalina' },
  { milestoneId: 'adrenalina-d3', phrase: 'adrenalina dosis 3' },
  { milestoneId: 'adrenalina-d3', phrase: 'tercera dosis de adrenalina' },
  { milestoneId: 'adrenalina-d1', phrase: 'adrenalina' },
  { milestoneId: 'adrenalina-d1', phrase: 'epinefrina' },
];

// Longest phrases first so specific multi-word clinical phrases (e.g. "sensor de saturacion")
// always take precedence over shorter substrings (e.g. "saturacion").
const SORTED_VOICE_RULES: VoiceSynonymRule[] = [...RAW_VOICE_RULES].sort(
  (a, b) => b.phrase.length - a.phrase.length
);

/**
 * Normalizes Spanish speech transcripts: lowercase, no diacritics, standardized spoken medical tokens,
 * and collapsed single-space separation.
 */
export function normalizeClinicalSpeech(rawText: string): string {
  return rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b100\s*%/g, '100')
    .replace(/\bfi\s*o\s*2\b/g, 'fio2')
    .replace(/\bfio\s+2\b/g, 'fio2')
    .replace(/\bsat\s*o\s*2\b/g, 'sato2')
    .replace(/\bsato\s+2\b/g, 'sato2')
    .replace(/\bf\s*\.?\s*c\b/g, 'fc')
    .replace(/\be\s*\.?\s*c\s*\.?\s*g\b/g, 'ecg')
    .replace(/\bm\s*r\s*\.?\s+sopa\b/g, 'mr sopa')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds all distinct NRP milestone IDs matched inside a transcript segment in chronological order,
 * suppressing shorter overlapping substrings once a longer phrase claims that span.
 */
export function matchClinicalVoiceMilestones(rawText: string): string[] {
  const normalized = normalizeClinicalSpeech(rawText);
  if (!normalized) return [];

  const claimed = new Array<boolean>(normalized.length).fill(false);
  const matched: Array<{ milestoneId: string; start: number }> = [];
  const seenMilestones = new Set<string>();

  for (const rule of SORTED_VOICE_RULES) {
    const pattern = new RegExp(`(?:^|\\s)(${escapeRegex(rule.phrase)})(?=\\s|$)`, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(normalized)) !== null) {
      const phraseText = match[1];
      const start = match.index + (match[0].length - phraseText.length);
      const end = start + phraseText.length;

      let overlapsClaimed = false;
      for (let i = start; i < end; i++) {
        if (claimed[i]) {
          overlapsClaimed = true;
          break;
        }
      }

      if (!overlapsClaimed) {
        for (let i = start; i < end; i++) {
          claimed[i] = true;
        }
        if (!seenMilestones.has(rule.milestoneId)) {
          seenMilestones.add(rule.milestoneId);
          matched.push({ milestoneId: rule.milestoneId, start });
        }
      }
    }
  }

  matched.sort((a, b) => a.start - b.start);
  return matched.map((m) => m.milestoneId);
}
