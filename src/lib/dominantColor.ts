/**
 * Estrae il colore dominante (più saturo e frequente) da un'immagine.
 * Ritorna un colore hex tipo "#1a5d3a", oppure null se non riesce.
 */
export async function extractDominantColor(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { count: number; score: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue; // skip transparent
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // skip near-white and near-black
      if (max > 240 && min > 240) continue;
      if (max < 25) continue;
      const sat = max === 0 ? 0 : (max - min) / max;
      // quantize in 6 step bins
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const cur = buckets.get(key) ?? { count: 0, score: 0, r: 0, g: 0, b: 0 };
      cur.count += 1;
      cur.score += 1 + sat * 3; // bonus per pixel saturi
      cur.r += r;
      cur.g += g;
      cur.b += b;
      buckets.set(key, cur);
    }

    if (buckets.size === 0) return null;
    let best: { count: number; score: number; r: number; g: number; b: number } | null = null;
    for (const v of buckets.values()) {
      if (!best || v.score > best.score) best = v;
    }
    if (!best) return null;
    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}

/** Restituisce un colore di testo (bianco o nero) leggibile sul background dato. */
export function readableTextColor(hex: string): "#ffffff" | "#0a0a0a" {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // luminance perception
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0a0a0a" : "#ffffff";
}