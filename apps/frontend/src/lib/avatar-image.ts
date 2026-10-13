/** The side, in pixels, of the square the app uploads: sharp at any size an avatar is shown. */
const SIDE = 256;

/**
 * A picture as an avatar: the middle square of it, at `SIDE` pixels, as WebP, or PNG where the browser cannot write
 * WebP. Throws a message for the person when the file is no picture the browser can read.
 */
export async function avatarImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("The picture could not be read");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  // A browser that cannot write WebP writes PNG instead, and says so in the blob's type.
  const blob = (await encode("image/webp")) ?? (await encode("image/png"));
  if (!blob) throw new Error("The picture could not be read");
  return blob;
}
