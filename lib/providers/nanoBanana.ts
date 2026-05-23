import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { googleClient } from "./google";
import { imageMimeType } from "./imageMime";

const execAsync = promisify(exec);

export interface AnnotationRequest {
  framePath: string;
  outPath: string;
  prompt: string;
}

export async function annotateFrame({
  framePath,
  outPath,
  prompt,
}: AnnotationRequest): Promise<string | null> {
  const ai = googleClient();
  const model = process.env.GEMINI_IMAGE_EDIT_MODEL ?? "gemini-3.1-flash-image-preview";
  const img = await fs.readFile(framePath);

  const fullPrompt = `${prompt}

Hard rules:
- Preserve every original pixel outside the explicit overlay region. Do not change player faces, jerseys, the crowd, or the pitch texture.
- Add the requested arrow(s) and zone(s) as a tactical overlay on top of the broadcast image, as if a TV analyst drew them with a tactics pen.
- Arrows must be bold and glowing, with a soft outer halo. Zones must be translucent with a subtle outline.
- Keep typography off the image. No text labels unless requested.
Return only the edited image.`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: fullPrompt },
            { inlineData: { mimeType: imageMimeType(framePath), data: img.toString("base64") } },
          ],
        },
      ],
    });
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) {
        const buf = Buffer.from(inline.data, "base64");
        await writeWebp(buf, inline.mimeType, outPath);
        return outPath;
      }
    }
    console.warn("Nano Banana returned no image, falling back to original frame");
    await convertToWebp(framePath, outPath);
    return outPath;
  } catch (err) {
    console.error("annotateFrame error", err);
    try {
      await convertToWebp(framePath, outPath);
      return outPath;
    } catch {
      return null;
    }
  }
}

async function writeWebp(
  buf: Buffer,
  mimeType: string | undefined,
  outPath: string,
): Promise<void> {
  const sourceExt = mimeType?.includes("png")
    ? ".png"
    : mimeType?.includes("webp")
      ? ".webp"
      : ".jpg";
  const sourcePath = `${outPath}.source${sourceExt}`;
  await fs.writeFile(sourcePath, buf);
  try {
    await convertToWebp(sourcePath, outPath);
  } finally {
    await fs.rm(sourcePath, { force: true });
  }
}

async function convertToWebp(sourcePath: string, outPath: string): Promise<void> {
  if (sourcePath.toLowerCase().endsWith(".webp")) {
    await fs.copyFile(sourcePath, outPath);
    return;
  }
  await execAsync(`cwebp -quiet -q 82 "${sourcePath}" -o "${outPath}"`);
}
