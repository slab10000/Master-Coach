# Master Coach

## Working Name

**Master Coach: World Cup Tactical Lens**

An AI-powered football coaching tool that turns a local match clip into a beautiful, coach-grade tactical breakdown. The demo experience should feel like a World Cup analysis room: cinematic, fast, visual, and useful for real coaches.

## Core Idea

The user drops football clips into a local folder. The web app finds those clips, lets the user choose one from a World Cup-themed landing page, and launches a RocketRide workflow.

The workflow gathers match context from the web, builds a structured match facts JSON, sends the clip plus that context into a multimodal model, and returns a tactical description of the play. The app then renders that analysis in a strategy engine: players become circles with shirt numbers and names, passes become arrows, runs become motion paths, space creation becomes highlighted pitch zones, and coaching fixes appear in a second color.

The app is local-only for the hackathon:

- No authentication.
- No user accounts.
- No hosted database required.
- Clips live in a local folder.
- Analysis artifacts are written to local JSON files.
- The web app reads local results and visualizes them beautifully.

## Demo Promise

**"Paste a football clip into a folder. Master Coach watches it like an elite analyst, researches the match context, explains the play, and turns it into an interactive tactical board with corrective counterplays."**

The strongest demo moment:

1. The original clip plays in an embedded video player.
2. The app launches the RocketRide pipeline.
3. The tactical board animates the play: passes, runs, pressure, overloads, space, finish.
4. The app switches to "Coach Fix" mode and overlays counterplay ideas in a different color.

## Product Positioning

Most teams have video, but only a few have the staff to break it down deeply. Master Coach turns raw clips into coaching language, tactical diagrams, and reusable training ideas.

This is not just "summarize this video." It is:

- A tactical analyst.
- A match researcher.
- A playbook generator.
- A visual teaching tool.

## Hackathon Constraints

### What We Are Building

- Local web app.
- Local video folder.
- Embedded video player.
- RocketRide-triggered analysis workflow.
- Google Gemini multimodal reasoning.
- GMI Cloud integration for inference or video/vision workload.
- Beautiful World Cup-inspired UI.
- Strategy engine that visualizes the analyzed play.

### What We Are Not Building For The Demo

- Authentication.
- Team management dashboards.
- Full-season analytics.
- Perfect player tracking.
- Production-grade match database.
- Native mobile app.
- Long full-match ingestion.

The demo should optimize for a magical, polished clip-to-analysis loop.

## Required Technologies

### Google Technologies

Use Google as the reasoning and multimodal intelligence layer.

Planned Google usage:

- **Gemini multimodal model** for video understanding and tactical reasoning.
- **Grounding / web-aware search where available** for match context enrichment.
- **Structured JSON output** for reliable app rendering.
- Optional local/dev usage of Google Cloud APIs if the hackathon requires visible Google Cloud usage.

Target model:

- Use `gemini-3.5-flash` if this is the hackathon-provided model ID.
- Keep the model configurable through an environment variable, for example `GEMINI_MODEL`.
- Fallback option if needed: use the closest available Gemini Flash multimodal model exposed by the Google account.

Reason:

The model naming and availability may vary by API surface, region, or hackathon account. A configurable model ID prevents demo-day breakage.

### GMI Cloud

Use GMI Cloud as the GPU/inference acceleration layer.

Possible GMI roles, from simplest to strongest:

1. **Serverless inference endpoint** for an OpenAI-compatible vision or multimodal call.
2. **Video or image model endpoint** for frame-level visual analysis, enhancement, or annotation generation.
3. **Dedicated endpoint** if the demo needs heavier tracking or custom inference.
4. **Second analyst model** that reviews the Gemini tactical output and flags missing details.

Recommended hackathon use:

- Use GMI for a visible pipeline stage called `gmi_frame_analysis`.
- Send sampled frames or keyframes to a GMI-hosted model.
- Return visual observations such as pressure, player clusters, ball location hints, attacking direction, and shot/pass likelihood.
- Pass those observations into Gemini as additional structured context.

This makes GMI a real part of the product instead of a cosmetic integration.

### RocketRide

Use RocketRide as the orchestration layer for the analysis pipeline.

RocketRide should own the workflow:

- Read the selected local clip path.
- Extract frames.
- Fetch match context with a web tool.
- Call Gemini for match facts JSON.
- Call GMI for frame/vision analysis.
- Call Gemini again for tactical analysis.
- Call Gemini again for counterplay generation.
- Write final JSON artifacts back to the local app.

The app should trigger RocketRide from the landing page through a local backend endpoint or SDK call.

## Local Folder Structure

Recommended repo structure:

```text
Master Coach/
  PROJECT.md
  README.md
  clips/
    inbox/
      argentina-france-2022-messi-goal.mp4
      argentina-france-2022-messi-goal.meta.json
    processed/
  analysis/
    argentina-france-2022-messi-goal/
      match_context.json
      frame_observations.json
      tactical_analysis.json
      counterplay.json
      strategy_scene.json
  pipelines/
    master-coach-analysis.pipe
  app/
    ...
```

### Clip Naming

Clips should use descriptive names when possible:

```text
world-cup-year-team-vs-team-minute-event.mp4
argentina-france-2022-108-messi-shot.mp4
spain-netherlands-2010-116-iniesta-goal.mp4
```

### Optional Sidecar Metadata

For a more reliable demo, allow an optional sidecar JSON file next to the clip:

```json
{
  "competition": "FIFA World Cup",
  "season": "2022",
  "match": "Argentina vs France",
  "date": "2022-12-18",
  "minute": "108",
  "team_focus": "Argentina",
  "event": "attacking sequence leading to chance",
  "desired_mode": "improve_if_for_us"
}
```

This prevents the workflow from guessing the wrong match if the clip does not contain scoreboard or broadcast context.

## User Experience

### Landing Page

The landing page is the app's first impression. It should not feel like a generic file uploader. It should feel like entering a World Cup tactical studio.

Landing page content:

- Full-screen World Cup-inspired football atmosphere.
- Local clip browser: cards for each video found in `clips/inbox`.
- Each card shows filename, duration if available, status, and a small generated thumbnail.
- Primary action: **Analyze Clip**.
- Secondary action: **Open Previous Analysis** if JSON output already exists.
- Optional match hints form:
  - Competition.
  - Match.
  - Year.
  - Minute.
  - Team to coach.
  - Was the play for us or against us?

Landing page tone:

- Premium broadcast.
- Stadium lights.
- Green pitch texture.
- Gold trophy accents.
- Clean typography.
- Big confident visuals.

Avoid a marketing-page feel. The first screen should be a working command center.

### Analysis View

The analysis view should have three synchronized zones.

#### 1. Embedded Video Player

The original clip plays in-app.

Features:

- Play/pause.
- Scrubber.
- Current timestamp.
- Optional overlay mode.
- Event markers on the timeline.
- Click an event to jump to that moment.

#### 2. Strategy Engine

The strategy engine renders the play on a football pitch.

Visual elements:

- Players as circles.
- Player numbers inside circles.
- Player names as small labels.
- Ball as a small high-contrast dot.
- Passes as solid arrows.
- Player runs as curved arrows.
- Defensive movement as dashed arrows.
- Pressing lines as thin red/orange paths.
- Space created as translucent highlighted zones.
- Key decision points as pulsing markers.

Color language:

- Team focus: tournament gold or electric cyan.
- Opponent: deep red or white depending on contrast.
- Successful attacking action: bright green.
- Danger / pressure: red-orange.
- Counterplay / improvement suggestion: violet, blue, or another clearly distinct color.

Modes:

- **Play Reconstruction**: what happened.
- **Coach Fix**: what should have happened or how to improve it.
- **Training Drill**: simplified repeatable pattern.

#### 3. Tactical Explanation Panel

This panel translates the model output into coach language.

Sections:

- Phase of play.
- Event-by-event sequence.
- Why the play worked or failed.
- Key players.
- Space created.
- Defensive mistakes.
- Coaching point.
- Training drill idea.

The panel should be concise, not a wall of text. The strategy engine is the star.

## RocketRide Workflow

Pipeline name:

```text
master-coach-analysis.pipe
```

### Workflow Inputs

```json
{
  "clip_path": "clips/inbox/argentina-france-2022-108-messi-shot.mp4",
  "clip_id": "argentina-france-2022-108-messi-shot",
  "match_hint": {
    "competition": "FIFA World Cup",
    "match": "Argentina vs France",
    "year": "2022",
    "minute": "108",
    "team_focus": "Argentina",
    "event": "attacking sequence",
    "play_was_for_focus_team": true
  }
}
```

### Workflow Stages

#### 1. Local Clip Intake

Input:

- Local video path.
- Optional metadata from sidecar JSON or landing page form.

Output:

- Clip ID.
- Absolute path.
- Duration.
- Basic media info.

#### 2. Frame Extraction

Use RocketRide video/frame extraction or a local helper.

Extract:

- 1 frame per second for context.
- More dense frames around key motion moments if possible.
- Thumbnail frame for the landing page.

Output:

```json
{
  "duration_seconds": 18.4,
  "frames": [
    {
      "timestamp": 0.0,
      "path": "analysis/clip-id/frames/frame_000.jpg"
    }
  ]
}
```

#### 3. Match Context Fetch

Use a web tool to gather facts about the match.

Search queries should be generated from:

- Competition.
- Teams.
- Year.
- Date if known.
- Minute/event hint if known.

Example queries:

```text
Argentina France 2022 World Cup final lineups goals substitutions
Argentina France 2022 World Cup final match report minute goals
Argentina France 2022 World Cup final player numbers lineups
```

Data to fetch:

- Teams.
- Starting lineups.
- Substitutes used.
- Player numbers.
- Goals and minutes.
- Cards.
- Scoreline.
- Formations if available.
- Match context: final, group stage, knockout, extra time, penalty shootout.

#### 4. Match Facts JSON

Use Gemini 3.5 Flash to convert web results into a clean match JSON.

Output:

```json
{
  "competition": "FIFA World Cup",
  "stage": "Final",
  "date": "2022-12-18",
  "venue": "Lusail Stadium",
  "teams": [
    {
      "name": "Argentina",
      "score": 3,
      "formation": "4-3-3",
      "players": [
        {
          "number": 10,
          "name": "Lionel Messi",
          "position": "FW",
          "started": true
        }
      ]
    },
    {
      "name": "France",
      "score": 3,
      "formation": "4-2-3-1",
      "players": []
    }
  ],
  "goals": [
    {
      "team": "Argentina",
      "player": "Lionel Messi",
      "minute": "23",
      "type": "penalty"
    }
  ],
  "notes": [
    "Argentina won after penalties."
  ],
  "source_confidence": "medium",
  "missing_information": []
}
```

Important:

- The model should mark uncertainty.
- The model should not invent player numbers if sources are missing.
- The strategy engine can still use roles like `LW`, `CB`, or `Player 7` when identity is uncertain.

#### 5. GMI Frame Analysis

Send keyframes or frame batches to GMI Cloud.

Goal:

- Extract visual observations that help the tactical analysis.

Possible output:

```json
{
  "observations": [
    {
      "timestamp": 4.0,
      "ball_zone": "right half-space",
      "attacking_shape": "3 players between midfield and defensive line",
      "defensive_shape": "back line retreating toward box",
      "pressure": "low",
      "notable_space": "left channel behind fullback"
    }
  ]
}
```

This stage does not need perfect computer vision. For the hackathon, useful structured observations are enough.

#### 6. Multimodal Tactical Analysis

Send to Gemini:

- Video clip.
- Match facts JSON.
- GMI frame observations.
- User match hint.
- Desired team focus.

Prompt goal:

Explain the play like a football analyst.

The model should identify:

- Phase of play.
- Attacking direction.
- Teams involved.
- Player actions.
- Passes.
- Runs.
- Space creation.
- Defensive movement.
- Key tactical trigger.
- Why the event happened.
- What the coach should teach from it.

Output:

```json
{
  "clip_id": "argentina-france-2022-108-messi-shot",
  "summary": "Argentina break through the right half-space after drawing France's midfield toward the ball.",
  "phase": "attacking transition",
  "team_focus": "Argentina",
  "attacking_team": "Argentina",
  "defending_team": "France",
  "outcome": {
    "type": "shot",
    "for_focus_team": true,
    "quality": "high"
  },
  "events": [
    {
      "id": "e1",
      "start": 0.8,
      "end": 2.1,
      "type": "pass",
      "team": "Argentina",
      "from": {
        "number": 24,
        "name": "Player name if known",
        "role": "RCM"
      },
      "to": {
        "number": 10,
        "name": "Lionel Messi",
        "role": "RW/AM"
      },
      "description": "Vertical pass into the half-space.",
      "tactical_effect": "Breaks the first pressing line."
    }
  ],
  "key_moments": [
    {
      "timestamp": 5.2,
      "label": "Space opens behind the fullback",
      "why_it_matters": "The winger pins the defender, creating a lane for the runner."
    }
  ],
  "coaching_points": [
    "Use the first pass to attract pressure, then attack the weak-side gap."
  ],
  "confidence": {
    "player_identity": "medium",
    "ball_tracking": "medium",
    "tactical_interpretation": "high"
  }
}
```

#### 7. Strategy Scene Generation

Convert tactical analysis into a renderable scene.

This is the data contract between AI and UI.

Output:

```json
{
  "pitch": {
    "orientation": "left_to_right",
    "units": "normalized",
    "width": 100,
    "height": 68
  },
  "teams": {
    "focus": {
      "name": "Argentina",
      "color": "#6BD6FF"
    },
    "opponent": {
      "name": "France",
      "color": "#F7F7F7"
    }
  },
  "players": [
    {
      "id": "arg-10",
      "team": "focus",
      "number": 10,
      "name": "Messi",
      "role": "AM",
      "positions": [
        { "t": 0, "x": 62, "y": 34 },
        { "t": 5, "x": 71, "y": 30 }
      ]
    }
  ],
  "ball": [
    { "t": 0, "x": 54, "y": 40 },
    { "t": 5, "x": 71, "y": 30 }
  ],
  "actions": [
    {
      "id": "a1",
      "type": "pass",
      "team": "focus",
      "from_player_id": "arg-24",
      "to_player_id": "arg-10",
      "start": 0.8,
      "end": 2.1,
      "from": { "x": 54, "y": 40 },
      "to": { "x": 64, "y": 35 },
      "label": "Line-breaking pass"
    }
  ],
  "zones": [
    {
      "id": "z1",
      "type": "space_created",
      "start": 2.0,
      "end": 6.0,
      "points": [
        { "x": 70, "y": 18 },
        { "x": 83, "y": 18 },
        { "x": 83, "y": 34 },
        { "x": 70, "y": 34 }
      ],
      "label": "Space behind fullback"
    }
  ]
}
```

#### 8. Counterplay Generation

Use Gemini 3.5 Flash again to create corrective or improvement plays.

Input:

- Tactical analysis.
- Strategy scene.
- Whether the play was for or against the focus team.

If the play was against the focus team:

- Generate defensive corrections.
- Show where pressure should arrive.
- Show who should track the runner.
- Show how the back line should shift.

If the play was for the focus team:

- Generate attacking improvements.
- Show a better third-man run.
- Show alternate pass options.
- Show the training pattern to repeat.

Output:

```json
{
  "mode": "improve_attack",
  "summary": "The focus team can make the same pattern more dangerous by adding an earlier weak-side run.",
  "counter_actions": [
    {
      "id": "c1",
      "type": "run",
      "player_id": "arg-11",
      "start": 2.2,
      "end": 5.0,
      "from": { "x": 64, "y": 18 },
      "to": { "x": 82, "y": 22 },
      "color_role": "coach_fix",
      "label": "Earlier blind-side run"
    }
  ],
  "coach_notes": [
    "Trigger the weak-side run as soon as the central midfielder receives on the half-turn."
  ],
  "training_drill": {
    "name": "Half-space attract and release",
    "players_needed": 8,
    "duration_minutes": 12,
    "setup": "Use a half pitch with two mini-goals and three passive defenders.",
    "objective": "Train the timing of the third-man run after pressure is attracted."
  }
}
```

## App Data Flow

```text
clips/inbox/*.mp4
        |
        v
Local web app landing page
        |
        v
POST /api/analyze { clip_id, clip_path, match_hint }
        |
        v
RocketRide pipeline
        |
        +--> Web match context fetch
        +--> Gemini match facts JSON
        +--> Frame extraction
        +--> GMI frame analysis
        +--> Gemini tactical analysis
        +--> Gemini counterplay generation
        |
        v
analysis/{clip_id}/*.json
        |
        v
Analysis view + strategy engine
```

## UI Design Direction

### Theme

World Cup tactical studio.

The visual language should combine:

- Stadium floodlights.
- Grass pitch textures.
- Trophy gold.
- National-team color accents.
- Broadcast graphics.
- Matchday drama.
- Clean, elite-sport data visualization.

### Palette

Base:

- Deep pitch green: `#0A3B2E`
- Night stadium: `#071411`
- Trophy gold: `#F5C451`
- Chalk white: `#F8F5EC`
- Broadcast cyan: `#4DD8FF`
- Pressure red: `#FF4D3D`
- Coach fix violet: `#8B5CF6`

Use green and night tones as the foundation, but avoid making the entire app one-note green. Gold, cyan, white, and red should create contrast and hierarchy.

### Typography

Use a strong modern sans-serif:

- Headings: bold, condensed or athletic-feeling.
- Body: clean and readable.
- Numeric labels: tabular numbers where possible.

### Components

Important components:

- Clip card.
- Match context form.
- Embedded video player.
- Analysis timeline.
- Strategy engine pitch.
- Player chip.
- Event marker.
- Coaching point panel.
- Mode switch: `Play Reconstruction`, `Coach Fix`, `Training Drill`.
- Pipeline status rail.

Pipeline status should feel alive:

```text
Finding match context
Reading lineups
Watching the clip
Mapping player movement
Building tactical board
Generating coach fixes
```

## Strategy Engine Requirements

The strategy engine should be custom enough to impress judges.

Minimum viable version:

- Render SVG or Canvas pitch.
- Draw player circles at normalized x/y coordinates.
- Draw arrows for passes and runs.
- Animate through timestamps.
- Sync selected event with video timestamp.
- Show a second overlay color for counterplays.

Nice-to-have:

- Scrub timeline updates both video and board.
- Toggle event labels.
- Hover player to see name/number/role.
- Pulse key moment marker.
- Export board as image.
- "Replay Analysis" button.

Implementation options:

- SVG is easiest for crisp arrows, labels, zones, and timeline sync.
- Canvas is better if animation gets dense.
- Use the same normalized coordinate system for all model output: pitch width `100`, pitch height `68`.

## Prompting Strategy

### Match Facts Prompt

System goal:

```text
You are a football match researcher. Convert web search results into verified structured match facts. Do not invent missing facts. Mark uncertainty explicitly.
```

User payload:

- Web snippets.
- Match hint.
- Required JSON schema.

### Tactical Analysis Prompt

System goal:

```text
You are an elite football tactical analyst. Watch the clip and explain the play in coach language. Prioritize tactical causality: what action created what advantage.
```

The model should be pushed to answer:

- Who has the ball?
- What phase is this?
- What shape does the attacking team create?
- What shape does the defending team use?
- What movement creates space?
- Which pass or run changes the play?
- What mistake or advantage leads to the outcome?
- How should this be coached?

### Strategy Scene Prompt

System goal:

```text
Convert the tactical analysis into a normalized 2D football pitch scene. The output must be renderable JSON. Use approximate positions if exact tracking is uncertain, and include confidence.
```

### Counterplay Prompt

System goal:

```text
You are the assistant coach for the focus team. Generate a corrected or improved tactical version of the play. Use a second visual layer that can be drawn on the strategy board.
```

## Reliability Rules

The AI should never pretend to know exact details when it does not.

Rules:

- If player identity is unclear, use role plus number if visible.
- If number is unclear, use role only.
- If the clip lacks enough context, rely on sidecar metadata or user hint.
- If exact positions are uncertain, generate approximate tactical positions and mark confidence.
- If web match facts conflict, keep both notes and lower confidence.
- The UI should display uncertainty gracefully.

## Demo Clip Strategy

For hackathon success, choose clips that are:

- Short: 10 to 30 seconds.
- Famous enough that match context exists online.
- Visually clear.
- Built around a recognizable tactical moment.
- Easy to explain with arrows.

Good categories:

- World Cup goal sequence.
- Penalty won.
- Counterattack.
- Pressing trap.
- Defensive breakdown.
- Third-man run.
- Overload on one side, switch to the other.

Suggested demo path:

1. Use one famous World Cup goal clip.
2. Prepare a sidecar metadata file so the workflow has strong hints.
3. Let web fetch enrich the match facts.
4. Let the AI produce the analysis.
5. If live model calls are slow or unstable, keep cached JSON available for instant fallback.

## Local Caching And Fallback

Since this is a hackathon demo, the app should support cached analysis.

For every clip, write:

```text
analysis/{clip_id}/strategy_scene.json
analysis/{clip_id}/tactical_analysis.json
analysis/{clip_id}/counterplay.json
```

If those files exist:

- Show **Open Analysis**.
- Show **Re-run RocketRide Workflow**.

This protects the demo from:

- API latency.
- Model quota issues.
- Wi-Fi problems.
- Bad web search results.
- Video upload failures.

## Judging Story

When presenting, say:

```text
Teams already record every training session and match. The hard part is turning raw video into teachable tactical insight. Master Coach uses Google Gemini for multimodal football understanding, GMI Cloud for inference acceleration, and RocketRide to orchestrate the whole analysis workflow. The result is a local coaching studio: paste in a clip, launch the pipeline, and get a tactical replay with coach fixes.
```

Then show:

1. Local clip folder.
2. Landing page with the clip detected.
3. RocketRide workflow launch.
4. Match context JSON.
5. Embedded video.
6. Tactical board reconstruction.
7. Counterplay overlay.
8. Training drill recommendation.

## Success Criteria

The demo is successful if a judge can understand these three things in under one minute:

1. The app watches a real football clip.
2. The AI understands the tactical story of the play.
3. The UI turns that understanding into a beautiful coach-facing strategy board.

The product should feel premium enough that the design itself becomes part of the pitch.

## First Implementation Milestone

Build a local prototype with:

- `clips/inbox` folder scanning.
- Landing page with World Cup visual theme.
- Embedded video player.
- "Analyze with RocketRide" button.
- Mock or cached JSON analysis.
- SVG strategy engine rendering players, arrows, zones, and counterplay overlay.

Once the visual demo works with mocked JSON, connect the live RocketRide workflow.

## Second Implementation Milestone

Connect the real pipeline:

- RocketRide file input.
- Frame extraction.
- Web match context fetch.
- Gemini match facts JSON.
- GMI frame analysis.
- Gemini tactical analysis.
- Gemini counterplay generation.
- JSON output into `analysis/{clip_id}`.

## Third Implementation Milestone

Polish the hackathon presentation:

- Use one excellent World Cup clip.
- Add cached fallback outputs.
- Add loading/status animations.
- Improve strategy board animation.
- Add coach fix mode.
- Add training drill card.
- Prepare a two-minute demo script.

## Demo Script

```text
This is Master Coach, a local AI tactical studio for football teams.

I start by dropping a World Cup clip into this folder. The app detects it automatically.

When I launch the RocketRide workflow, it researches the match context, builds a structured match JSON with teams, player numbers, goals, and lineups, then sends the clip plus that context into Gemini. GMI Cloud handles the visual inference stage so the model has structured frame observations as well as raw video.

Now the clip is not just summarized. It becomes a tactical scene.

Here we can see the pass that breaks the first line, the run that pins the defender, the space that opens in the half-space, and the action that leads to the goal.

Then Master Coach switches into Coach Fix mode. If this was against our team, it shows how to defend it better. If this was our goal, it shows how to make the pattern repeatable in training.

The end product is not a chatbot answer. It is a visual coaching artifact.
```

