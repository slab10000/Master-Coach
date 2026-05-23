import path from "node:path";

export function imageMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".webp":
      return "image/webp";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}
