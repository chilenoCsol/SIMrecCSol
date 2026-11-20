export const SOCHIPE_LOGO_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-10-27_at_20.48.51_4bf5cd3b.jpeg';

export interface ProcessedInstitutionalLogo {
  /** Offscreen canvas ready for direct drawImage onto 1280x720 recording canvas */
  canvas: HTMLCanvasElement;
  /** PNG Data URL with transparent background and subtle light broadcast contour */
  dataUrl: string;
  width: number;
  height: number;
}

let cachedPromise: Promise<ProcessedInstitutionalLogo> | null = null;

function isNearWhite(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 224 && max - min <= 28;
}

/**
 * Loads the CEI SOCHIPE logo into an auxiliary canvas, removes the white background
 * (including letter counters) via connected-component flood fill while preserving the
 * white interior inside the circular pediatric emblem, feathers edges smoothly, and
 * applies a subtle light broadcast-TV halo so dark navy text stays crisp over dark frames.
 */
export function loadProcessedSochipeLogo(): Promise<ProcessedInstitutionalLogo> {
  if (cachedPromise) {
    return cachedPromise;
  }

  cachedPromise = new Promise<ProcessedInstitutionalLogo>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 512;
        const h = img.naturalHeight || 512;

        // Step 1: Auxiliary canvas for pixel-level transparency processing
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = w;
        rawCanvas.height = h;
        const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
        if (!rawCtx) {
          reject(new Error('No se pudo inicializar el canvas auxiliar de logotipo.'));
          return;
        }

        rawCtx.drawImage(img, 0, 0, w, h);
        const imageData = rawCtx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const total = w * h;

        // 0 = unvisited, 1 = transparent background/counter, 2 = kept interior white
        const mask = new Uint8Array(total);
        const queue = new Int32Array(total);

        // Flood-fill near-white connected pixels starting from all 4 outer edges
        let qHead = 0;
        let qTail = 0;

        const trySeedEdge = (x: number, y: number) => {
          const idx = y * w + x;
          if (mask[idx] !== 0) return;
          const p = idx * 4;
          if (isNearWhite(data[p], data[p + 1], data[p + 2])) {
            mask[idx] = 1;
            queue[qTail++] = idx;
          }
        };

        for (let x = 0; x < w; x++) {
          trySeedEdge(x, 0);
          trySeedEdge(x, h - 1);
        }
        for (let y = 1; y < h - 1; y++) {
          trySeedEdge(0, y);
          trySeedEdge(w - 1, y);
        }

        while (qHead < qTail) {
          const idx = queue[qHead++];
          const cx = idx % w;
          const cy = (idx - cx) / w;

          // 4-neighbor expansion
          if (cx > 0) {
            const n = idx - 1;
            if (mask[n] === 0 && isNearWhite(data[n * 4], data[n * 4 + 1], data[n * 4 + 2])) {
              mask[n] = 1;
              queue[qTail++] = n;
            }
          }
          if (cx < w - 1) {
            const n = idx + 1;
            if (mask[n] === 0 && isNearWhite(data[n * 4], data[n * 4 + 1], data[n * 4 + 2])) {
              mask[n] = 1;
              queue[qTail++] = n;
            }
          }
          if (cy > 0) {
            const n = idx - w;
            if (mask[n] === 0 && isNearWhite(data[n * 4], data[n * 4 + 1], data[n * 4 + 2])) {
              mask[n] = 1;
              queue[qTail++] = n;
            }
          }
          if (cy < h - 1) {
            const n = idx + w;
            if (mask[n] === 0 && isNearWhite(data[n * 4], data[n * 4 + 1], data[n * 4 + 2])) {
              mask[n] = 1;
              queue[qTail++] = n;
            }
          }
        }

        // Step 2: Also clear small enclosed white letter counters (O, D, A, P, R, e, a, o)
        // while keeping the large white interior regions inside the circular pediatric crest
        const smallHoleThreshold = Math.floor(total * 0.0045);
        const componentPixels: number[] = [];

        for (let i = 0; i < total; i++) {
          if (mask[i] !== 0) continue;
          const p = i * 4;
          if (!isNearWhite(data[p], data[p + 1], data[p + 2])) continue;

          componentPixels.length = 0;
          qHead = 0;
          qTail = 0;
          mask[i] = 2;
          queue[qTail++] = i;
          componentPixels.push(i);

          let minY = (i - (i % w)) / w;
          let maxY = minY;

          while (qHead < qTail) {
            const idx = queue[qHead++];
            const cx = idx % w;
            const cy = (idx - cx) / w;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const neighbors = [
              cx > 0 ? idx - 1 : -1,
              cx < w - 1 ? idx + 1 : -1,
              cy > 0 ? idx - w : -1,
              cy < h - 1 ? idx + w : -1,
            ];
            for (const n of neighbors) {
              if (n >= 0 && mask[n] === 0 && isNearWhite(data[n * 4], data[n * 4 + 1], data[n * 4 + 2])) {
                mask[n] = 2;
                queue[qTail++] = n;
                componentPixels.push(n);
              }
            }
          }

          // Clear enclosed holes inside letters (small area or located in the text band below the circle)
          const isInBottomTextBand = minY > h * 0.68;
          const isInTopTextBand = maxY < h * 0.14;
          if (
            componentPixels.length <= smallHoleThreshold ||
            isInBottomTextBand ||
            isInTopTextBand
          ) {
            for (let k = 0; k < componentPixels.length; k++) {
              mask[componentPixels[k]] = 1;
            }
          }
        }

        // Apply transparency for masked pixels
        for (let i = 0; i < total; i++) {
          if (mask[i] === 1) {
            data[i * 4 + 3] = 0;
          }
        }

        // Step 3: Soft edge feathering for anti-aliased light fringe pixels adjacent to transparent background
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (mask[idx] === 1) continue;

            const touchesTransparent =
              mask[idx - 1] === 1 ||
              mask[idx + 1] === 1 ||
              mask[idx - w] === 1 ||
              mask[idx + w] === 1;

            if (!touchesTransparent) continue;

            const p = idx * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (lum > 165 && max - min < 42) {
              const alphaFactor = Math.max(0, Math.min(1, (235 - lum) / 70));
              data[p + 3] = Math.round(255 * alphaFactor);
            }
          }
        }

        rawCtx.putImageData(imageData, 0, 0);

        // Step 4: Composite onto final padded canvas with subtle crisp light glow
        // so dark navy text ("CEI SOCHIPE") reads effortlessly on dark backgrounds & video
        const pad = 16;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w + pad * 2;
        outCanvas.height = h + pad * 2;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve({
            canvas: rawCanvas,
            dataUrl: rawCanvas.toDataURL('image/png'),
            width: w,
            height: h,
          });
          return;
        }

        // Crisp subtle broadcast light outline/halo pass
        outCtx.save();
        outCtx.shadowColor = 'rgba(248, 250, 252, 0.92)';
        outCtx.shadowBlur = 10;
        outCtx.shadowOffsetX = 0;
        outCtx.shadowOffsetY = 0;
        outCtx.drawImage(rawCanvas, pad, pad);
        // Second tight glow pass for crisp legibility on pure black (#000000)
        outCtx.shadowBlur = 4;
        outCtx.drawImage(rawCanvas, pad, pad);
        outCtx.restore();

        // Crisp foreground logo pass
        outCtx.drawImage(rawCanvas, pad, pad);

        resolve({
          canvas: outCanvas,
          dataUrl: outCanvas.toDataURL('image/png'),
          width: outCanvas.width,
          height: outCanvas.height,
        });
      } catch (error) {
        cachedPromise = null;
        reject(error);
      }
    };
    img.onerror = () => {
      cachedPromise = null;
      reject(new Error('No se pudo cargar el logotipo institucional CEI SOCHIPE.'));
    };
    img.src = SOCHIPE_LOGO_SRC;
  });

  return cachedPromise;
}
