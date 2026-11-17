const JPEG_QUALITY = 0.96;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function isAnimatedPng(file: File): Promise<boolean> {
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!PNG_SIGNATURE.every((byte, index) => signature[index] === byte)) return false;

  let offset = 8;
  while (offset + 8 <= file.size) {
    const header = new DataView(await file.slice(offset, offset + 8).arrayBuffer());
    const length = header.getUint32(0);
    const type = String.fromCharCode(...new Uint8Array(header.buffer, header.byteOffset + 4, 4));

    if (type === "acTL") return true;
    if (type === "IEND" || offset + length + 12 > file.size) return false;
    offset += length + 12;
  }

  return false;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encodes JPEGs at high quality and PNGs losslessly, without resizing.
 * The original is retained whenever encoding is unsupported or produces a larger file.
 */
export async function optimizeImage(file: File): Promise<Blob> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") return file;
  if (file.type === "image/png" && (await isAnimatedPng(file))) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0);
    const outputType = file.type === "image/jpeg" ? "image/webp" : "image/png";
    const optimized = await canvasBlob(canvas, outputType, file.type === "image/jpeg" ? JPEG_QUALITY : undefined);
    return optimized && optimized.size < file.size ? optimized : file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
