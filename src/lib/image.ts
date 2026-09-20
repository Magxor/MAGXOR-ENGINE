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
  if (input.type === "image/gif" || input.type.startsWith("video/")) {
    return { file: input, originalKB, webpKB: originalKB, converted: false };
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
