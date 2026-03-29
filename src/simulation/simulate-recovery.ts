import type {
  ExecutionPlan,
  ExecutionPlanNode,
  PolicyNodeErrorCode,
  RecoveryPath,
  RecoverySimulation,
} from "../domain/contracts.js";

export function simulateRecovery(plan: ExecutionPlan): RecoverySimulation {
  const normalPath = plan.nodes.map((node) => node.node_id);
  const recoveryPaths = plan.nodes
    .filter((node) => node.fallback_node !== null)
    .map<RecoveryPath>((node) => ({
      trigger_node: node.node_id,
      failure_code: inferFailureCode(node.node_id),
      attempts: buildAttempts(node),
      final_status: node.skip_allowed ? "partial_success" : "success_with_fallback",
    }));

  return {
    normal_path: normalPath,
    recovery_paths: recoveryPaths,
  };
}

function buildAttempts(node: ExecutionPlanNode): string[] {
  const retryWorthIt = node.retry_count > 0 && node.retry_cost <= node.cost_efficiency_score;
  return [
    ...(retryWorthIt ? [`retry:${node.node_id}:x${node.retry_count}`] : []),
    ...(!retryWorthIt && node.retry_count > 0 ? [`skip_retry:cost_exceeds_value`] : []),
    `fallback:${node.fallback_node}`,
  ];
}

function inferFailureCode(nodeId: string): PolicyNodeErrorCode {
  switch (nodeId) {
    case "tool_adapter":
      return "timeout";
    case "quality_checker":
      return "quality_below_threshold";
    case "video_candidate":
      return "unavailable_backend";
    default:
      return "policy_blocked";
  }
}
