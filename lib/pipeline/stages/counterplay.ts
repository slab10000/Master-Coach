import { Type } from "@google/genai";
import { emitStage } from "../events";
import { googleClient } from "@/lib/providers/google";
import { writeJson } from "@/lib/fs/analysis";
import type { Counterplay, MatchHint, StrategyScene, TacticalAnalysis } from "@/lib/types";

const COUNTERPLAY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, enum: ["improve_attack", "improve_defense", "training_drill"] },
    summary: { type: Type.STRING },
    counter_actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["run", "pass", "press", "shift", "cover"] },
          player_id: { type: Type.STRING },
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
          from: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"],
          },
          to: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
            required: ["x", "y"],
          },
          color_role: { type: Type.STRING, enum: ["coach_fix"] },
          label: { type: Type.STRING },
        },
        required: ["id", "type", "start", "end", "from", "to", "color_role", "label"],
      },
    },
    coach_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
    training_drill: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        players_needed: { type: Type.NUMBER },
        duration_minutes: { type: Type.NUMBER },
        setup: { type: Type.STRING },
        objective: { type: Type.STRING },
      },
      required: ["name", "players_needed", "duration_minutes", "setup", "objective"],
    },
  },
  required: ["mode", "summary", "counter_actions", "coach_notes"],
};

export async function counterplay(
  clipId: string,
  analysis: TacticalAnalysis,
  scene: StrategyScene,
  hint: MatchHint | undefined,
): Promise<Counterplay> {
  emitStage(clipId, "counterplay", "started", "Generating coach fixes");
  const ai = googleClient();
  const model = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

  const desiredMode =
    hint?.desired_mode ??
    (analysis.outcome?.for_focus_team ? "improve_attack" : "improve_defense");

  const prompt = `You are the assistant coach for the focus team. Generate a corrected or improved tactical version of the play. Output ONLY a JSON object matching the schema.

Mode: ${desiredMode}
- improve_attack: invent 2-3 alternative attacking actions that would have made the same pattern more dangerous (earlier weak-side run, third-man combination, switch of play).
- improve_defense: invent 2-3 defensive adjustments (where pressure should arrive, who should track the runner, how the line should shift).
- training_drill: produce a simplified repeatable training drill that teaches this pattern.

Coordinate system: x in [0,100], y in [0,68], matching the strategy scene.
Pull player_id values from the existing scene where possible.

TACTICAL ANALYSIS:
${JSON.stringify(analysis, null, 2)}

EXISTING SCENE PLAYERS:
${JSON.stringify(scene.players.map((p) => ({ id: p.id, team: p.team, number: p.number, role: p.role })), null, 2)}

Always set color_role to "coach_fix". Include 2-4 short coach_notes. Always include a training_drill.`;

  const result = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: COUNTERPLAY_SCHEMA,
      temperature: 0.6,
    },
  });

  const parsed = JSON.parse(result.text ?? "{}") as Counterplay;
  await writeJson(clipId, "counterplay.json", parsed);
  emitStage(clipId, "counterplay", "done", `Coach fix ready: ${parsed.counter_actions?.length ?? 0} actions`);
  return parsed;
}
