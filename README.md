# Master Coach · World Cup Tactical Lens

Local AI tactical studio for football coaches. Drop a clip into `clips/inbox/`, launch the pipeline, and Master Coach watches the play like an elite analyst — returning a 2D animated strategy board, Nano Banana broadcast overlays, match facts, and corrective coach fixes.

Built for the GDG Newport Beach × RocketRide × GMI Cloud × NVIDIA hackathon (May 23 2026).

## Stack

- **Next.js 15** App Router + TypeScript + Tailwind
- **Google Gemini** (`gemini-2.5-flash`) for video understanding and tactical reasoning
- **Nano Banana** (`gemini-2.5-flash-image-preview`) for broadcast-frame annotation
- **GMI Cloud** OpenAI-compatible inference (`Qwen2.5-VL`) for per-frame key-moment classification — toggleable from the UI
- **RocketRide** (`pipelines/master-coach-analysis.pipe`) as the orchestration graph
- **ffmpeg** for frame sampling

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev
```

Drop a clip into `clips/inbox/`:

```text
clips/inbox/
  argentina-france-2022-108-messi-shot.mp4
  argentina-france-2022-108-messi-shot.meta.json   # optional, see EXAMPLE.meta.json
```

Open <http://localhost:3000>, click **Analyze**, watch the pipeline rail light up stage by stage.

## Environment

`.env.local`:

```env
GOOGLE_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_VIDEO_MODEL=gemini-2.5-flash
GEMINI_IMAGE_EDIT_MODEL=gemini-2.5-flash-image-preview
GMI_API_KEY=                  # leave empty to keep the toggle on Google only
GMI_BASE_URL=https://api.gmi-serving.com/v1
GMI_VISION_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
VISION_PROVIDER=google        # or gmi
```

The **provider toggle** in the top-right of the landing page swaps the per-frame classifier between Google and GMI Cloud at runtime. Tactical reasoning, match facts, counterplay, and Nano Banana annotation stay on Google.

## Pipeline stages

1. `intake` — read clip, ffprobe duration
2. `extractFrames` — ffmpeg @ 4fps
3. `matchContext` — Gemini + Google Search grounding
4. `matchFacts` — Gemini structured-output match facts
5. `geminiTactical` — Gemini video understanding → tactical events with timestamps + coords
6. `classifyFrames` — VisionProvider per-frame classification (GMI or Google)
7. `selectHeroFrames` — cross-reference Gemini events with classifier hits → 3-5 hero moments
8. `annotateFrames` — Nano Banana draws cyan/violet arrows + gold zones onto broadcast frames
9. `strategyScene` — deterministic transform → renderable JSON for the SVG engine
10. `counterplay` — Gemini "coach fix" mode

All outputs land in `analysis/{clip_id}/` and are served back to the UI. Re-running the pipeline overwrites cached outputs; the landing page shows a **Cached** badge for clips that already have results.

## Demo arc (3 minutes)

1. Land on the dark stadium homepage with the clip detected.
2. Click **Analyze** → pipeline rail animates through 10 stages live.
3. Show the synced video + strategy engine — passes, runs, gold space-zones, pulsing key moments.
4. Scroll to **Broadcast Overlays** — Nano Banana drew tactical arrows on the actual broadcast frames.
5. Toggle to **Coach Fix** mode → violet counter-actions appear over the play.
6. Show the **Training Drill** card.

## License

Hackathon prototype. Not for production use.
