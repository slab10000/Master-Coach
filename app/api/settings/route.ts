import { NextRequest, NextResponse } from "next/server";

let runtimeProvider: "google" | "gmi" | null = null;

export async function GET() {
  return NextResponse.json({
    provider: runtimeProvider ?? process.env.VISION_PROVIDER ?? "google",
    gmiConfigured: !!process.env.GMI_API_KEY,
    googleConfigured: !!process.env.GOOGLE_API_KEY,
    models: {
      text: process.env.GEMINI_TEXT_MODEL,
      image: process.env.GEMINI_IMAGE_EDIT_MODEL,
      gmiVision: process.env.GMI_VISION_MODEL,
    },
  });
}

export async function POST(req: NextRequest) {
  const { provider } = (await req.json()) as { provider: "google" | "gmi" };
  if (provider !== "google" && provider !== "gmi") {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }
  runtimeProvider = provider;
  process.env.VISION_PROVIDER = provider;
  return NextResponse.json({ ok: true, provider });
}
