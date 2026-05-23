export type ProviderName = "google" | "gmi";

export interface ClipMeta {
  id: string;
  filename: string;
  path: string;
  durationSeconds?: number;
  thumbnailPath?: string;
  hasCachedAnalysis: boolean;
  sidecar?: MatchHint;
}

export interface MatchHint {
  competition?: string;
  season?: string;
  match?: string;
  date?: string;
  minute?: string;
  team_focus?: string;
  event?: string;
  desired_mode?: "improve_attack" | "improve_defense" | "training_drill";
  play_was_for_focus_team?: boolean;
}

export interface MatchFacts {
  competition: string;
  stage?: string;
  date?: string;
  venue?: string;
  teams: {
    name: string;
    score?: number;
    formation?: string;
    players: { number: number; name: string; position: string; started: boolean }[];
  }[];
  goals: { team: string; player: string; minute: string; type?: string }[];
  notes: string[];
  source_confidence: "low" | "medium" | "high";
  missing_information: string[];
}

export interface TacticalEvent {
  id: string;
  start: number;
  end: number;
  type: "pass" | "run" | "shot" | "press" | "carry" | "tackle" | "cross" | "dribble" | "switch";
  team: "focus" | "opponent";
  from?: { number?: number; name?: string; role?: string; x?: number; y?: number };
  to?: { number?: number; name?: string; role?: string; x?: number; y?: number };
  description: string;
  tactical_effect?: string;
}

export interface KeyMoment {
  timestamp: number;
  label: string;
  why_it_matters: string;
}

export interface TacticalAnalysis {
  clip_id: string;
  summary: string;
  phase: string;
  team_focus: string;
  attacking_team: string;
  defending_team: string;
  outcome: { type: string; for_focus_team: boolean; quality: "low" | "medium" | "high" };
  events: TacticalEvent[];
  key_moments: KeyMoment[];
  coaching_points: string[];
  confidence: {
    player_identity: "low" | "medium" | "high";
    ball_tracking: "low" | "medium" | "high";
    tactical_interpretation: "low" | "medium" | "high";
  };
}

export interface StrategyPlayer {
  id: string;
  team: "focus" | "opponent";
  number: number;
  name?: string;
  role: string;
  positions: { t: number; x: number; y: number }[];
}

export interface StrategyAction {
  id: string;
  type: "pass" | "run" | "shot" | "press" | "carry" | "defensive_run" | "switch";
  team: "focus" | "opponent";
  from_player_id?: string;
  to_player_id?: string;
  start: number;
  end: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
  color_role?: "primary" | "danger" | "success" | "coach_fix";
}

export interface StrategyZone {
  id: string;
  type: "space_created" | "pressure" | "danger";
  start: number;
  end: number;
  points: { x: number; y: number }[];
  label?: string;
}

export interface StrategyScene {
  pitch: { orientation: "left_to_right"; units: "normalized"; width: 100; height: 68 };
  teams: {
    focus: { name: string; color: string };
    opponent: { name: string; color: string };
  };
  players: StrategyPlayer[];
  ball: { t: number; x: number; y: number }[];
  actions: StrategyAction[];
  zones: StrategyZone[];
  duration: number;
}

export interface CounterAction {
  id: string;
  type: "run" | "pass" | "press" | "shift" | "cover";
  player_id?: string;
  start: number;
  end: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color_role: "coach_fix";
  label: string;
}

export interface Counterplay {
  mode: "improve_attack" | "improve_defense" | "training_drill";
  summary: string;
  counter_actions: CounterAction[];
  coach_notes: string[];
  training_drill?: {
    name: string;
    players_needed: number;
    duration_minutes: number;
    setup: string;
    objective: string;
  };
}

export interface FrameClassification {
  framePath: string;
  timestamp: number;
  is_key_moment: boolean;
  type: "pass_start" | "shot" | "run_begin" | "pressure" | "none";
  confidence: number;
  ball_zone?: string;
}

export interface HeroFrame {
  eventId: string;
  framePath: string;
  annotatedPath: string;
  timestamp: number;
  caption: string;
}

export type PipelineStage =
  | "intake"
  | "extractFrames"
  | "matchContext"
  | "matchFacts"
  | "geminiTactical"
  | "topdownMinimaps"
  | "geometryPass"
  | "classifyFrames"
  | "selectHeroFrames"
  | "annotateFrames"
  | "strategyScene"
  | "counterplay";

export interface PipelineEvent {
  stage: PipelineStage;
  status: "started" | "progress" | "done" | "error";
  message: string;
  progress?: number;
  payload?: unknown;
  timestamp: number;
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  intake: "Reading the clip",
  extractFrames: "Extracting frames",
  matchContext: "Finding match context",
  matchFacts: "Building match facts",
  geminiTactical: "Watching the play",
  topdownMinimaps: "Redrawing play as top-down diagrams",
  geometryPass: "Solving pitch geometry",
  classifyFrames: "Mapping ball action",
  selectHeroFrames: "Choosing hero moments",
  annotateFrames: "Drawing tactical overlays",
  strategyScene: "Building tactical board",
  counterplay: "Generating coach fixes",
};
