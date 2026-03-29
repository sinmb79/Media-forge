# Shorts Engine Architecture

This document explains the current structure of the first Shorts Engine MVP.

## Purpose

The project turns a structured shorts-production request into deterministic planning output. The first MVP does not generate media. It simulates the decision-making path that a future production engine will follow.

## Main flow

The shared planning pipeline executes these stages:

1. `load`
2. `validate`
3. `normalize`
4. `resolve_novel_shorts_plan`
5. `resolve_platform_output_spec`
6. `resolve_motion_plan`
7. `resolve_broll_plan`
8. `resolve_learning_state`
9. `score`
10. `route`
11. `build_execution_plan`
12. `simulate_recovery`
13. `render_output`

The `prompt` command reuses the same pipeline through `resolve_planning_context`, then executes:

14. `build_prompt_result`
15. `render_prompt_output`

The `analyze` command reuses the same pipeline and then executes:

14. `build_analysis_report`
15. `render_analysis_output`

The `render` command reuses the same pipeline plus prompt layer and then executes:

14. `build_prompt_result`
15. `build_render_plan`
16. `render_render_plan_output`

The `publish` command reuses the same pipeline plus prompt and render layers and then executes:

14. `build_prompt_result`
15. `build_render_plan`
16. `build_publish_plan`
17. `render_publish_output`

Each stage reads structured data and returns structured data.

## Module layout

### `src/cli`

This layer handles:

- command parsing
- file loading
- result rendering
- process exit codes

It does not own business rules.

This layer also contains the shared `resolve_planning_context` helper so `run` and `prompt` can consume the same deterministic planning output without duplicating orchestration logic.
It now also contains shared request-loading and command-specific renderers for `config`, `create`, `doctor`, `analyze`, `render`, and `publish`.

### `src/domain`

This layer handles:

- request contracts
- error contracts
- schema validation
- normalization
- scoring
- routing

This is where deterministic policy rules live.

### `src/config`

This layer handles:

- built-in request profile catalog
- default profile selection
- command catalog metadata

It powers both beginner entry points (`create`) and configuration discovery (`config`) without requiring persistent local state.

### `src/create`

This layer handles:

- request scaffold construction
- profile-to-request expansion

It turns built-in request profiles into writable starter request files.

### `src/platform`

This layer handles:

- platform profile tables
- automatic duration correction
- warning and adjustment generation
- platform delivery metadata

It keeps output policy separate from request normalization.

### `src/motion`

This layer handles:

- motion metadata tables
- segment generation
- anti-repetition rules
- platform and pacing-aware motion assignment

It turns platform-aware timing into a deterministic `motion_plan` without mutating input or platform policy objects.

### `src/broll`

This layer handles:

- seed concept datasets
- semantic keyword matching
- segment-aware concept selection
- generic fallback concept selection

It turns normalized intent plus motion segments into a deterministic `broll_plan`.

### `src/learning`

This layer handles:

- optional learning-history interpretation
- threshold schedule resolution
- weight schedule resolution
- confidence and fallback-source reporting

It turns request-level history into a deterministic `learning_state` without needing persistent storage.

### `src/doctor`

This layer handles:

- local environment checks
- fixture visibility checks
- command catalog checks
- overall doctor status derivation

It provides deterministic diagnostics without depending on network calls or real service integrations.

### `src/analyze`

This layer handles:

- readiness summary generation
- risk score summarization
- warning aggregation for request-level diagnostics

It gives users a compact, opinionated view of request readiness that is easier to scan than `run`.

### `src/novel`

This layer handles:

- optional novel-project interpretation
- highlight candidate selection
- hook builder generation
- mode-aware script outline generation
- effective intent overrides

It turns optional episode metadata into a deterministic `novel_shorts_plan` without mutating `normalized_request`.

### `src/prompt`

This layer handles:

- prompt artifact construction
- style-descriptor synthesis
- warning aggregation for prompt consumers
- deterministic prompt parameter generation

It turns shared planning context into a deterministic `PromptResult` without re-running domain logic.

### `src/render`

This layer handles:

- render manifest generation
- segment alignment across motion and B-roll
- asset manifest construction
- render QA checklist synthesis

It turns planning context plus prompt artifacts into a deterministic `RenderPlan`, not a real media renderer.

### `src/publish`

This layer handles:

- platform packaging metadata
- title and hashtag generation
- CTA synthesis
- upload checklist generation

It turns planning context plus render artifacts into a deterministic `PublishPlan`, not a real uploader.

### `src/simulation`

This layer handles:

- execution plan building
- node metadata
- normal-path generation
- recovery-path generation

It models what the engine would do if real backends existed.

### `src/shared`

This layer contains shared utilities that do not belong to a single domain module.

## Core request objects

### `EngineRequest`

This is the external JSON contract accepted by the CLI.

### `NormalizedRequest`

This is the internal request contract used after validation. It is split into:

- `base`: canonicalized user input
- `derived`: computed fields such as duration, aspect ratio, and premium allowance

All later stages read only `NormalizedRequest`.

### `PlatformOutputSpec`

This is the structured delivery-policy object resolved after normalization. It includes:

- platform metadata
- effective duration
- warnings
- adjustment records

This object preserves output policy without mutating `normalized_request`.

### `MotionPlan`

This is the structured motion-planning object resolved after platform policy. It includes:

- `segments`
- `motion_sequence`
- `hook_motion`
- `anti_repetition_state`
- `warnings`

This object is segment-aware and deterministic so later render steps can consume it directly.

### `BrollPlan`

This is the structured semantic B-roll planning object resolved after motion planning. It includes:

- `segments`
- `warnings`
- `dataset_version`

Each segment carries a selected concept, visual metaphors, mood tags, platform suitability, and selection reason codes.

### `LearningState`

This is the structured cold-start learning object resolved after B-roll planning. It includes:

- `phase`
- `weights`
- `threshold_status`
- `confidence`
- `fallback_sources`
- `reason_codes`

This object makes the engine's current personalization maturity explicit before any persistent learning system exists.

### `NovelShortsPlan`

This is the structured novel branch object resolved after normalization. It includes:

- `mode`
- `highlight_candidate`
- `hook_builder`
- `shorts_script_outline`
- `qa_flags`
- `intent_overrides`

This object lets downstream planning consume novel-specific intent without overwriting the normalized source request.

### `PromptResult`

This is the structured prompt-layer artifact built after the planning pipeline. It includes:

- `engine`
- `main_prompt`
- `negative_prompt`
- `style_descriptor`
- `quality_score`
- `warnings`
- `params`

This object gives downstream prompt consumers a deterministic artifact derived from the same planning decisions used by `run`.

### `AnalyzeResult`

This is the compact diagnostic artifact built from planning context. It includes:

- `request_id`
- `readiness`
- `risk_summary`
- `warning_count`
- `recommended_backend`

This object is for request diagnostics, not full pipeline replay.

### `RenderPlan`

This is the deterministic render manifest built after prompt construction. It includes:

- `render_id`
- `engine`
- `output_filename`
- `segments`
- `asset_manifest`
- `qa_checklist`
- `warnings`

This object is the renderer-facing planning contract for future media generation work.

### `PublishPlan`

This is the deterministic publish manifest built after render planning. It includes:

- `publish_id`
- `platform`
- `title`
- `description`
- `hashtags`
- `cta`
- `upload_checklist`
- `warnings`

This object is the platform-packaging contract for future uploader integrations.

## Scoring and routing

The current engine computes four structured scores:

- `candidate_score`
- `quality_tier_score`
- `premium_eligibility_score`
- `cost_risk_score`

Routing uses those scores plus the request to decide:

- selected backend
- fallback backend
- premium allowance
- reason codes

## Execution plan

The execution plan is a lightweight DAG model with:

- `nodes`
- `edges`

Each node contains retry, fallback, skip, and cost metadata.

## Recovery simulation

Recovery simulation returns:

- `normal_path`
- `recovery_paths`

This allows the project to show how fallback behavior would work before any real backend integration exists.
