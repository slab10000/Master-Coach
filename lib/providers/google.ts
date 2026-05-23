import { promises as fs } from "node:fs";
import { GoogleGenAI, Type } from "@google/genai";
import type { VisionProvider } from "./vision";
import { imageMimeType } from "./imageMime";
import type { FrameClassification } from "@/lib/types";

let _client: GoogleGenAI | null = null;
export function googleClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export const FRAME_CLASSIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_key_moment: { type: Type.BOOLEAN },
    type: { type: Type.STRING, enum: ["pass_start", "shot", "run_begin", "pressure", "none"] },
    confidence: { type: Type.NUMBER },
    ball_zone: { type: Type.STRING },
  },
  required: ["is_key_moment", "type", "confidence"],
};

export class GoogleVisionProvider implements VisionProvider {
  name = "google" as const;

  async classifyFrame(
    framePath: string,
    timestamp: number,
    hint: string,
  ): Promise<FrameClassification> {
    const ai = googleClient();
    const img = await fs.readFile(framePath);
    const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

    const prompt = `You are a football tactical analyst looking at a single broadcast frame at timestamp ${timestamp.toFixed(2)}s.
Context hint: ${hint}

Classify this frame strictly as JSON:
- is_key_moment: true only if this exact frame captures the START of a tactical action (a pass releasing, a shot striking, a run beginning, or a pressing trigger).
- type: one of "pass_start", "shot", "run_begin", "pressure", "none".
- confidence: 0..1.
- ball_zone: short phrase like "right half-space", "left wing", "central third", or omit.

Do not say a frame is a key moment unless it visually contains the trigger.`;

    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: imageMimeType(framePath), data: img.toString("base64") } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: FRAME_CLASSIFICATION_SCHEMA,
          temperature: 0.2,
        },
      });
      const text = result.text ?? "{}";
      const parsed = JSON.parse(text);
      return {
        framePath,
        timestamp,
        is_key_moment: !!parsed.is_key_moment,
        type: parsed.type ?? "none",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        ball_zone: parsed.ball_zone,
      };
    } catch (err) {
      console.error("classifyFrame error", err);
      return {
        framePath,
        timestamp,
        is_key_moment: false,
        type: "none",
        confidence: 0,
      };
    }
  }
}
