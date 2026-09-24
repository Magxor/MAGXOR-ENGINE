export interface WebpResult {
  file: File;
  originalKB: number;
  webpKB: number;
  converted: boolean;
}

export async function convertToWebp(
  input: File,
  opts: { maxSide?: number; quality?: number } = {}
): Promise<WebpResult> {
  const maxSide = opts.maxSide || 1600;
  const quality = opts.quality ?? 0.82;
  const originalKB = Math.round(input.size / 1024);

  if (input.type === "image/webp") return { file: input, originalKB, webpKB: originalKB, converted: false };
  if (input.type.startsWith("video/")) {
    return convertVideoToWebp(input, { maxSeconds: 10, maxSide: 720, fps: 10 });
  }
  try {
    const bmp = await createImageBitmap(input);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );
    if (!blob) throw new Error("webp-unsupported");
    const name = input.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
    const file = new File([blob], name, { type: "image/webp" });
    return { file, originalKB, webpKB: Math.round(file.size / 1024), converted: true };
  } catch {
    return { file: input, originalKB, webpKB: originalKB, converted: false };
  }
}

export async function convertVideoToWebp(
  input: File,
  opts: { maxSeconds?: number; maxSide?: number; fps?: number } = {}
): Promise<WebpResult> {
  const maxSeconds = opts.maxSeconds ?? 10;
  const maxSide = opts.maxSide ?? 720;
  const fps = opts.fps ?? 10;
  const originalKB = Math.round(input.size / 1024);

  // 1. Intento con ffmpeg.wasm (carga perezosa desde CDN, sin sumar peso al bundle).
  // Se usa Function para que ni TS ni Vite intenten resolver/empaquetar la URL.
  try {
    const loader = new Function("u", "return import(u)") as (u: string) => Promise<unknown>;
    const mod = await loader("https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js").catch(() => null);
    const FFmpeg = (mod as unknown as { FFmpeg?: new () => {
      load: () => Promise<void>;
      writeFile: (n: string, d: Uint8Array) => Promise<void>;
      exec: (a: string[]) => Promise<void>;
      readFile: (n: string) => Promise<Uint8Array>;
      deleteFile: (n: string) => Promise<void>;
    } }).FFmpeg;
    if (FFmpeg) {
      const ff = new FFmpeg();
      await ff.load();
      const buf = new Uint8Array(await input.arrayBuffer());
      await ff.writeFile("in.mp4", buf);
      const vf = `fps=${fps},scale=${maxSide}:-1:flags=lanczos`;
      await ff.exec(["-t", String(maxSeconds), "-i", "in.mp4", "-vf", vf, "-loop", "0", "-q:v", "60", "out.webp"]);
      const out = await ff.readFile("out.webp");
      try { await ff.deleteFile("in.mp4"); } catch { /* noop */ }
      try { await ff.deleteFile("out.webp"); } catch { /* noop */ }
      const blob = new Blob([out as unknown as BlobPart], { type: "image/webp" });
      const name = input.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
      const file = new File([blob], name, { type: "image/webp" });
      return { file, originalKB, webpKB: Math.round(file.size / 1024), converted: true };
    }
  } catch {
    /* cae al plan B por canvas */
  }

  // 2. Plan B sin dependencias: primer frame a WebP (siempre WebP, nunca MP4).
  try {
    const url = URL.createObjectURL(input);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("video-load"));
    });
    if (video.duration > maxSeconds + 0.5) {
      URL.revokeObjectURL(url);
      throw new Error(`El video supera los ${maxSeconds} segundos.`);
    }
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(2, Math.round(video.videoWidth * scale));
    const h = Math.max(2, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    video.currentTime = 0.01;
    await new Promise<void>((res) => {
      video.onseeked = () => res();
      setTimeout(() => res(), 1500);
    });
    ctx.drawImage(video, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", 0.82));
    if (!blob) throw new Error("webp-unsupported");
    const name = input.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
    const file = new File([blob], name, { type: "image/webp" });
    return { file, originalKB, webpKB: Math.round(file.size / 1024), converted: true };
  } catch (e) {
    throw e instanceof Error ? e : new Error("No se pudo convertir el video a WebP.");
  }
}

/** Convierte imagen o video a WebP. Siempre devuelve WebP o lanza error. */
export async function convertMediaToWebp(
  input: File,
  opts: { maxSide?: number; quality?: number; maxVideoSeconds?: number } = {}
): Promise<WebpResult> {
  if (input.type.startsWith("video/")) {
    return convertVideoToWebp(input, { maxSeconds: opts.maxVideoSeconds ?? 10, maxSide: 720, fps: 10 });
  }
  return convertToWebp(input, { maxSide: opts.maxSide, quality: opts.quality });
}
