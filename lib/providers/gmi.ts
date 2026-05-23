import { promises as fs } from "node:fs";
import OpenAI from "openai";
import type { VisionProvider } from "./vision";
import { imageMimeType } from "./imageMime";
import type { FrameClassification } from "@/lib/types";

let _client: OpenAI | null = null;
export function gmiClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.GMI_API_KEY;
  if (!apiKey) throw new Error("GMI_API_KEY is not set");
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.GMI_BASE_URL ?? "https://api.gmi-serving.com/v1",
  });
  return _client;
}

export class GMIVisionProvider implements VisionProvider {
  name = "gmi" as const;

  async classifyFrame(
    framePath: string,
    timestamp: number,
    hint: string,
  ): Promise<FrameClassification> {
    const img = await fs.readFile(framePath);
    const dataUrl = `data:${imageMimeType(framePath)};base64,${img.toString("base64")}`;
    const model = process.env.GMI_VISION_MODEL ?? "Qwen/Qwen2.5-VL-7B-Instruct";

    const prompt = `Frame at ${timestamp.toFixed(2)}s. Hint: ${hint}.
Respond with ONLY a JSON object: {"is_key_moment": bool, "type": one of "pass_start"|"shot"|"run_begin"|"pressure"|"none", "confidence": 0..1, "ball_zone": short phrase or null}.
Mark is_key_moment=true only if this frame contains the start of a tactical trigger (release of pass, shot, run, press).`;

    try {
      const res = await gmiClient().chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });
      const text = res.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text);
      return {
        framePath,
        timestamp,
        is_key_moment: !!parsed.is_key_moment,
        type: parsed.type ?? "none",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        ball_zone: parsed.ball_zone ?? undefined,
      };
    } catch (err) {
      console.error("GMI classifyFrame error", err);
      return { framePath, timestamp, is_key_moment: false, type: "none", confidence: 0 };
    }
  }
}
