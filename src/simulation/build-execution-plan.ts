import type {
  ExecutionBackend,
  ExecutionPlan,
  ExecutionPlanNode,
  NormalizedRequest,
  PremiumAllowedStep,
  RoutingDecision,
} from "../domain/contracts.js";

export function buildExecutionPlan(
  request: NormalizedRequest,
  routing: RoutingDecision,
): ExecutionPlan {
  const formatterFallbackNode = routing.fallback_backend === null ? null : "formatter_fallback";
  const ttsFallbackNode = routing.fallback_backend === null ? null : "tts_candidate_local";
  const videoFallbackNode =
    routing.fallback_backend === null
      ? null
      : routing.selected_backend === "premium"
        ? "image_motion_fallback"
        : routing.fallback_backend === "gpu"
          ? "video_candidate_gpu"
          : "video_candidate_local";
  const qualityFallbackNode =
    routing.fallback_backend === null
      ? null
      : routing.fallback_backend === "gpu"
        ? "video_candidate_gpu"
        : "video_candidate_local";

  const primaryNodes: ExecutionPlanNode[] = [
    createNode("prompt_normalizer", "policy", "local", 0.01, 2, null, false, "error"),
    createNode(
      "tool_adapter",
      "adapter",
      resolveNodeBackend("final_script_refinement", routing),
      0.02,
      2,
      formatterFallbackNode,
      false,
      "error",
    ),
    createNode("formatter", "formatter", resolveNonPremiumBackend(routing), 0.01, 2, null, false, "warning"),
    createNode(
      "quality_checker",
      "quality",
      "local",
      0.01,
      1,
      qualityFallbackNode,
      false,
      "error",
    ),
    createNode(
      "tts_candidate",
      "candidate",
      resolveNodeBackend("premium_tts", routing),
      request.base.constraints.budget_tier === "low" ? 0.05 : 0.08,
      1,
      ttsFallbackNode,
      true,
      "warning",
    ),
    ((): ExecutionPlanNode => {
      const videoBackend = resolveNodeBackend("high_value_video_generation", routing);
      return createNode(
        "video_candidate",
        "candidate",
        videoBackend,
        videoBackend === "premium" ? 0.2 : 0.08,
        videoBackend === "premium" ? 1 : 2,
        videoFallbackNode,
        false,
        "error",
      );
    })(),
    createNode(
      "final_polish",
      "formatter",
      resolveNodeBackend("final_polish", routing),
      0.01,
      1,
      null,
      true,
      "warning",
    ),
  ];

  const fallbackNodes = buildFallbackNodes(videoFallbackNode, routing.fallback_backend);
  const nodes = [...primaryNodes, ...fallbackNodes];

  const edges: [string, string][] = [
    ["prompt_normalizer", "tool_adapter"],
    ["tool_adapter", "formatter"],
    ["formatter", "quality_checker"],
    ["quality_checker", "tts_candidate"],
    ["tts_candidate", "video_candidate"],
    ["video_candidate", "final_polish"],
  ];

  if (formatterFallbackNode !== null) {
    edges.push(["tool_adapter", formatterFallbackNode]);
  }

  if (qualityFallbackNode !== null) {
    edges.push(["quality_checker", qualityFallbackNode]);
  }

  if (ttsFallbackNode !== null) {
    edges.push(["tts_candidate", ttsFallbackNode]);
  }

  if (videoFallbackNode !== null) {
    edges.push(["video_candidate", videoFallbackNode]);
  }

  return { nodes, edges };
}

function resolveNodeBackend(
  stepType: PremiumAllowedStep,
  routing: RoutingDecision,
): ExecutionBackend {
  if (
    routing.premium_allowed_steps.includes(stepType) &&
    routing.selected_backend === "premium"
  ) {
    return "premium";
  }
  return resolveNonPremiumBackend(routing);
}

function resolveNonPremiumBackend(routing: RoutingDecision): ExecutionBackend {
  return routing.selected_backend === "premium" ? "local" : routing.selected_backend;
}

function buildFallbackNodes(
  videoFallbackNode: string | null,
  fallbackBackend: RoutingDecision["fallback_backend"],
): ExecutionPlanNode[] {
  if (fallbackBackend === null) return [];

  const nodes = new Map<string, ExecutionPlanNode>();

  nodes.set(
    "formatter_fallback",
    createNode("formatter_fallback", "formatter", "local", 0.01, 0, null, false, "warning"),
  );
  nodes.set(
    "tts_candidate_local",
    createNode("tts_candidate_local", "candidate", "local", 0.03, 0, null, true, "warning"),
  );

  if (fallbackBackend === "gpu") {
    nodes.set(
      "video_candidate_gpu",
      createNode("video_candidate_gpu", "candidate", "gpu", 0.08, 0, null, false, "error"),
    );
  }

  if (fallbackBackend === "local") {
    nodes.set(
      "video_candidate_local",
      createNode("video_candidate_local", "candidate", "local", 0.05, 0, null, false, "warning"),
    );
  }

  if (videoFallbackNode === "image_motion_fallback") {
    nodes.set(
      "image_motion_fallback",
      createNode("image_motion_fallback", "candidate", "gpu", 0.12, 0, null, false, "warning"),
    );
  }

  return [...nodes.values()];
}

function createNode(
  nodeId: string,
  nodeType: ExecutionPlanNode["node_type"],
  backend: ExecutionPlanNode["backend"],
  estimatedCost: number,
  retryCount: number,
  fallbackNode: string | null,
  skipAllowed: boolean,
  failureSeverity: ExecutionPlanNode["failure_severity"],
): ExecutionPlanNode {
  return {
    node_id: nodeId,
    node_type: nodeType,
    backend,
    estimated_cost: estimatedCost,
    actual_cost: 0,
    retry_cost: Number((estimatedCost * 0.5).toFixed(2)),
    cost_efficiency_score: Number((1 - estimatedCost).toFixed(2)),
    retry_count: retryCount,
    fallback_node: fallbackNode,
    skip_allowed: skipAllowed,
    failure_severity: failureSeverity,
  };
}
