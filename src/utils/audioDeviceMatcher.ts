const GENERIC_TOKENS = new Set([
  'usb',
  'hd',
  'fhd',
  '4k',
  'pro',
  'camera',
  'camara',
  'webcam',
  'video',
  'audio',
  'mic',
  'microphone',
  'microfono',
  'input',
  'device',
  'default',
  'predeterminado',
  'communications',
  'comunicaciones',
  'builtin',
  'built',
  'integrated',
  'integrada',
  'digital',
  'stereo',
  'mono',
  'analog',
  'array',
  'capture',
]);

function normalizeLabelTokens(label: string): string[] {
  // Remove USB vendor/product IDs like "(046d:082d)"
  const stripped = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([0-9a-f]{4}:[0-9a-f]{4}\)/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return stripped
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !GENERIC_TOKENS.has(token));
}

/**
 * Finds the audioinput microphone that belongs to the selected webcam:
 * 1. Exact groupId match (preferring physical deviceId over virtual 'default'/'communications')
 * 2. Matching brand/model tokens between camera label and microphone label
 * 3. Returns null if no webcam-associated microphone is found
 */
export function findMatchingMicForCamera(
  camera: MediaDeviceInfo | undefined,
  microphones: MediaDeviceInfo[]
): MediaDeviceInfo | null {
  if (!camera || microphones.length === 0) return null;

  // Priority 1: Same hardware groupId (most reliable indicator of integrated webcam mic)
  if (camera.groupId) {
    const physicalGroupMatch = microphones.find(
      (mic) =>
        mic.groupId === camera.groupId &&
        mic.deviceId !== 'default' &&
        mic.deviceId !== 'communications'
    );
    if (physicalGroupMatch) {
      return physicalGroupMatch;
    }

    const anyGroupMatch = microphones.find((mic) => mic.groupId === camera.groupId);
    if (anyGroupMatch) {
      return anyGroupMatch;
    }
  }

  // Priority 2: Best overlapping model/brand name tokens (e.g., "Logitech C920", "Brio", "Insta360")
  if (camera.label) {
    const camTokens = normalizeLabelTokens(camera.label);
    if (camTokens.length > 0) {
      let bestMic: MediaDeviceInfo | null = null;
      let bestScore = 0;

      for (const mic of microphones) {
        if (!mic.label) continue;
        const micTokens = new Set(normalizeLabelTokens(mic.label));
        let score = 0;
        for (const token of camTokens) {
          if (micTokens.has(token)) {
            score += token.length >= 4 ? 2 : 1;
          }
        }
        // Slight preference for physical device over virtual 'default' on tie
        if (score > 0 && mic.deviceId !== 'default' && mic.deviceId !== 'communications') {
          score += 0.25;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMic = mic;
        }
      }

      if (bestMic && bestScore >= 1) {
        return bestMic;
      }
    }
  }

  return null;
}
