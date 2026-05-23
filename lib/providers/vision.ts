import type { FrameClassification, ProviderName } from "@/lib/types";

export interface VisionProvider {
  name: ProviderName;
  classifyFrame(framePath: string, timestamp: number, hint: string): Promise<FrameClassification>;
}

export async function getActiveProvider(): Promise<VisionProvider> {
  const choice = (process.env.VISION_PROVIDER ?? "google") as ProviderName;
  if (choice === "gmi" && process.env.GMI_API_KEY) {
    const { GMIVisionProvider } = await import("./gmi");
    return new GMIVisionProvider();
  }
  const { GoogleVisionProvider } = await import("./google");
  return new GoogleVisionProvider();
}
