import { emitStage } from "../events";
import { writeJson } from "@/lib/fs/analysis";
import type {
  StrategyAction,
  StrategyPlayer,
  StrategyScene,
  StrategyZone,
  TacticalAnalysis,
} from "@/lib/types";

const FOCUS_COLOR = "#4DD8FF";
const OPPONENT_COLOR = "#F8F5EC";

export async function strategyScene(
  clipId: string,
  analysis: TacticalAnalysis,
): Promise<StrategyScene> {
  emitStage(clipId, "strategyScene", "started", "Building strategy board");

  // Build player tracks from events: any event that references a player by role/number contributes a position sample.
  const playerMap = new Map<string, StrategyPlayer>();

  function keyOf(side: "focus" | "opponent", number?: number, role?: string): string | null {
    if (number != null) return `${side}-${number}`;
    if (role) return `${side}-${role}`;
    return null;
  }
  function ensurePlayer(
    team: "focus" | "opponent",
    number?: number,
    name?: string,
    role?: string,
  ): string | null {
    const k = keyOf(team, number, role);
    if (!k) return null;
    if (!playerMap.has(k)) {
      playerMap.set(k, {
        id: k,
        team,
        number: number ?? 0,
        name,
        role: role ?? "?",
        positions: [],
      });
    } else if (name && !playerMap.get(k)!.name) {
      playerMap.get(k)!.name = name;
    }
    return k;
  }

  const actions: StrategyAction[] = [];
  const ball: { t: number; x: number; y: number }[] = [];

  for (const e of analysis.events ?? []) {
    const fromId = ensurePlayer(e.team, e.from?.number, e.from?.name, e.from?.role);
    const otherTeam: "focus" | "opponent" = e.team === "focus" ? "focus" : "opponent";
    const toId = ensurePlayer(otherTeam, e.to?.number, e.to?.name, e.to?.role);
    if (fromId && e.from?.x != null && e.from?.y != null) {
      playerMap.get(fromId)!.positions.push({ t: e.start, x: e.from.x, y: e.from.y });
    }
    if (toId && e.to?.x != null && e.to?.y != null) {
      playerMap.get(toId)!.positions.push({ t: e.end, x: e.to.x, y: e.to.y });
    }
    if (e.from?.x != null && e.from?.y != null) ball.push({ t: e.start, x: e.from.x, y: e.from.y });
    if (e.to?.x != null && e.to?.y != null) ball.push({ t: e.end, x: e.to.x, y: e.to.y });

    actions.push({
      id: e.id,
      type: mapActionType(e.type),
      team: e.team,
      from_player_id: fromId ?? undefined,
      to_player_id: toId ?? undefined,
      start: e.start,
      end: e.end,
      from: { x: e.from?.x ?? 50, y: e.from?.y ?? 34 },
      to: { x: e.to?.x ?? 60, y: e.to?.y ?? 34 },
      label: e.tactical_effect || e.description,
      color_role: e.team === "focus" ? "primary" : "danger",
    });
  }

  // Sort positions per player by time
  for (const p of playerMap.values()) {
    p.positions.sort((a, b) => a.t - b.t);
  }
  ball.sort((a, b) => a.t - b.t);

  // Build space-created zones from key_moments that mention "space"
  const zones: StrategyZone[] = [];
  for (const km of analysis.key_moments ?? []) {
    if (/space|gap|behind|half-space/i.test(km.label)) {
      // synthesize a rectangle near the late ball position
      const ballAt = ball.find((b) => Math.abs(b.t - km.timestamp) < 1) ?? ball[ball.length - 1];
      if (ballAt) {
        const cx = ballAt.x;
        const cy = ballAt.y;
        zones.push({
          id: `z-${km.timestamp}`,
          type: "space_created",
          start: Math.max(0, km.timestamp - 0.5),
          end: km.timestamp + 2,
          points: [
            { x: clamp(cx - 8, 0, 100), y: clamp(cy - 6, 0, 68) },
            { x: clamp(cx + 8, 0, 100), y: clamp(cy - 6, 0, 68) },
            { x: clamp(cx + 8, 0, 100), y: clamp(cy + 6, 0, 68) },
            { x: clamp(cx - 8, 0, 100), y: clamp(cy + 6, 0, 68) },
          ],
          label: km.label,
        });
      }
    }
  }

  const duration = Math.max(
    ...((analysis.events ?? []).map((e) => e.end) || [0]),
    ...((analysis.key_moments ?? []).map((k) => k.timestamp) || [0]),
    1,
  );

  const scene: StrategyScene = {
    pitch: { orientation: "left_to_right", units: "normalized", width: 100, height: 68 },
    teams: {
      focus: { name: analysis.team_focus, color: FOCUS_COLOR },
      opponent: {
        name:
          analysis.team_focus === analysis.attacking_team
            ? analysis.defending_team
            : analysis.attacking_team,
        color: OPPONENT_COLOR,
      },
    },
    players: Array.from(playerMap.values()),
    ball,
    actions,
    zones,
    duration,
  };

  await writeJson(clipId, "strategy_scene.json", scene);
  emitStage(clipId, "strategyScene", "done", `Board ready: ${scene.players.length} players, ${scene.actions.length} actions`);
  return scene;
}

function mapActionType(t: string): StrategyAction["type"] {
  if (t === "tackle" || t === "press") return "press";
  if (t === "cross" || t === "switch") return "pass";
  if (t === "dribble" || t === "carry") return "carry";
  if (t === "shot") return "shot";
  if (t === "run") return "run";
  return "pass";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
