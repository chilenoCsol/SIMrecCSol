import { useCallback, useEffect, useRef, useState } from 'react';
import { matchClinicalVoiceMilestones } from '../utils/voiceEventMatcher';

export const VOICE_COOLDOWN_MS = 15_000;
const AUTO_RESTART_DELAY_MS = 250;
const INTERIM_SETTLE_DELAY_MS = 280;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function formatTailTranscript(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 12) return words.join(' ');
  return `… ${words.slice(-12).join(' ')}`;
}

export interface UseVoiceEventRecognitionOptions {
  onDetectMilestone: (milestoneId: string) => void;
}

export interface UseVoiceEventRecognitionResult {
  isSupported: boolean;
  voiceEnabled: boolean;
  isListening: boolean;
  lastTranscript: string;
  voiceError: string | null;
  activeLang: 'es-CL' | 'es-ES';
  toggleVoice: () => void;
  resetVoiceCooldowns: () => void;
}

export function useVoiceEventRecognition({
  onDetectMilestone,
}: UseVoiceEventRecognitionOptions): UseVoiceEventRecognitionResult {
  const isSupported = getSpeechRecognitionCtor() !== null;

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'es-CL' | 'es-ES'>('es-CL');

  const onDetectMilestoneRef = useRef(onDetectMilestone);
  onDetectMilestoneRef.current = onDetectMilestone;

  const voiceEnabledRef = useRef(false);
  voiceEnabledRef.current = voiceEnabled;

  const langRef = useRef<'es-CL' | 'es-ES'>('es-CL');
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const sessionIdRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const interimTimerRef = useRef<number | null>(null);
  const fatalStopRef = useRef(false);
  const networkErrorCountRef = useRef(0);

  // Track finalized result indices in the current recognition session so they are not re-evaluated
  const finalizedIndicesRef = useRef<Set<number>>(new Set());
  // 15-second anti-duplicate cooldown per milestoneId (survives silent onend restarts)
  const lastTriggeredAtRef = useRef<Map<string, number>>(new Map());

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (interimTimerRef.current !== null) {
      window.clearTimeout(interimTimerRef.current);
      interimTimerRef.current = null;
    }
  }, []);

  const triggerMatchedMilestones = useCallback((segmentText: string): boolean => {
    const matchedIds = matchClinicalVoiceMilestones(segmentText);
    if (matchedIds.length === 0) return false;

    const now = Date.now();
    let triggeredAny = false;
    for (const milestoneId of matchedIds) {
      const lastTime = lastTriggeredAtRef.current.get(milestoneId) ?? 0;
      if (now - lastTime < VOICE_COOLDOWN_MS) {
        continue;
      }
      lastTriggeredAtRef.current.set(milestoneId, now);
      onDetectMilestoneRef.current(milestoneId);
      triggeredAny = true;
    }
    return triggeredAny;
  }, []);

  const startSession = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !voiceEnabledRef.current) return;

    clearTimers();
    const mySessionId = ++sessionIdRef.current;

    // Clean up any leftover instance before spawning a fresh session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore cleanup errors
      }
      recognitionRef.current = null;
    }

    finalizedIndicesRef.current.clear();

    try {
      const recognition = new Ctor();
      recognition.lang = langRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (!voiceEnabledRef.current || sessionIdRef.current !== mySessionId) return;
        networkErrorCountRef.current = 0;
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (!voiceEnabledRef.current || sessionIdRef.current !== mySessionId) return;

        let latestDisplayText = '';
        const pendingInterimTexts: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? '';
          if (transcript.trim()) {
            latestDisplayText = transcript;
          }

          if (finalizedIndicesRef.current.has(i)) {
            continue;
          }

          if (result.isFinal) {
            finalizedIndicesRef.current.add(i);
            if (interimTimerRef.current !== null) {
              window.clearTimeout(interimTimerRef.current);
              interimTimerRef.current = null;
            }
            if (transcript.trim()) {
              triggerMatchedMilestones(transcript);
            }
          } else if (transcript.trim()) {
            pendingInterimTexts.push(transcript);
          }
        }

        if (latestDisplayText) {
          setLastTranscript(formatTailTranscript(latestDisplayText));
        }

        if (pendingInterimTexts.length > 0) {
          if (interimTimerRef.current !== null) {
            window.clearTimeout(interimTimerRef.current);
          }
          interimTimerRef.current = window.setTimeout(() => {
            interimTimerRef.current = null;
            if (!voiceEnabledRef.current || sessionIdRef.current !== mySessionId) return;
            for (const text of pendingInterimTexts) {
              triggerMatchedMilestones(text);
            }
          }, INTERIM_SETTLE_DELAY_MS);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (sessionIdRef.current !== mySessionId) return;
        const errCode = event.error;
        if (errCode === 'language-not-supported' && langRef.current === 'es-CL') {
          langRef.current = 'es-ES';
          setActiveLang('es-ES');
          return;
        }
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          fatalStopRef.current = true;
          voiceEnabledRef.current = false;
          setVoiceEnabled(false);
          setIsListening(false);
          setVoiceError('Permiso de micrófono denegado para reconocimiento de voz.');
          return;
        }
        if (errCode === 'audio-capture') {
          fatalStopRef.current = true;
          voiceEnabledRef.current = false;
          setVoiceEnabled(false);
          setIsListening(false);
          setVoiceError('No se detectó micrófono disponible para reconocimiento de voz.');
          return;
        }
        if (errCode === 'network') {
          networkErrorCountRef.current += 1;
          setVoiceError('Sin conexión al motor de voz del navegador. Reintentando…');
          return;
        }
        // 'no-speech' / 'aborted': transient silence; silent onend handler restarts after 250ms
      };

      recognition.onend = () => {
        if (sessionIdRef.current !== mySessionId) return;
        setIsListening(false);
        if (interimTimerRef.current !== null) {
          window.clearTimeout(interimTimerRef.current);
          interimTimerRef.current = null;
        }

        if (!voiceEnabledRef.current || fatalStopRef.current) {
          return;
        }

        // Silent automatic restart after 250ms when browser pauses for silence
        const restartDelay =
          networkErrorCountRef.current > 0
            ? Math.min(3000, 1000 * networkErrorCountRef.current)
            : AUTO_RESTART_DELAY_MS;

        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (!voiceEnabledRef.current || fatalStopRef.current) return;
          try {
            startSession();
          } catch {
            // Silently ignore transient restart errors
          }
        }, restartDelay);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      if (voiceEnabledRef.current && !fatalStopRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          try {
            startSession();
          } catch {
            // Silently ignore retry error
          }
        }, AUTO_RESTART_DELAY_MS);
      }
    }
  }, [clearTimers, triggerMatchedMilestones]);

  const stopSession = useCallback(() => {
    sessionIdRef.current += 1;
    clearTimers();
    networkErrorCountRef.current = 0;
    setIsListening(false);
    setLastTranscript('');
    finalizedIndicesRef.current.clear();

    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      try {
        current.onstart = null;
        current.onresult = null;
        current.onerror = null;
        current.onend = null;
        current.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }, [clearTimers]);

  useEffect(() => {
    if (voiceEnabled) {
      fatalStopRef.current = false;
      setVoiceError(null);
      startSession();
    } else {
      stopSession();
    }
  }, [voiceEnabled, startSession, stopSession]);

  useEffect(() => {
    return () => {
      voiceEnabledRef.current = false;
      stopSession();
    };
  }, [stopSession]);

  const toggleVoice = useCallback(() => {
    if (!isSupported) return;
    setVoiceError(null);
    setVoiceEnabled((prev) => !prev);
  }, [isSupported]);

  const resetVoiceCooldowns = useCallback(() => {
    lastTriggeredAtRef.current.clear();
  }, []);

  return {
    isSupported,
    voiceEnabled,
    isListening,
    lastTranscript,
    voiceError,
    activeLang,
    toggleVoice,
    resetVoiceCooldowns,
  };
}
