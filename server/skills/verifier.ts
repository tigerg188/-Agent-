import {
  Artifact,
  EvidenceRef,
  ExecutionPlan,
  ExecutionTrace,
  ExecutionStep,
} from './types';
import { globalArtifactBus } from './artifacts';
import { globalExecutionTraceManager } from './execution-trace';

export interface VerificationCheckItem {
  id: string;
  name: string;
  category: 'execution_reality' | 'evidence_grounding' | 'skill_compliance' | 'user_coverage' | 'temporal_consistency';
  status: 'PASSED' | 'FAILED' | 'WARNING';
  score: number; // 0 to 1.0
  weight: number;
  message: string;
  details?: Record<string, any>;
}

export interface VerificationReport {
  runId: string;
  overallStatus: 'VERIFIED' | 'DEGRADED' | 'FAILED';
  verificationScore: number; // 0 to 1.0
  confidenceScore: number; // 0 to 1.0, calculated strictly by verifier
  checks: VerificationCheckItem[];
  verifiedArtifactsCount: number;
  rejectedArtifactsCount: number;
  unresolvedGaps: string[];
  recommendations: string[];
  timestamp: string;
}

export class SkillVerifier {
  /**
   * Section 48 & 70: Independent Verification of Execution & Artifacts
   * Evaluates reality, grounding, compliance, and coverage without relying on generator claims.
   */
  public verifyRun(
    runId: string,
    plan: ExecutionPlan,
    targetTask: string,
    systemCurrentDate: string = new Date().toISOString().slice(0, 10)
  ): VerificationReport {
    const traces = globalExecutionTraceManager.getTracesByRunId(runId);
    const artifacts = globalArtifactBus.getArtifactsByRunId(runId);
    const evidences: EvidenceRef[] = globalArtifactBus.getEvidenceByRunId(runId);

    const checks: VerificationCheckItem[] = [];
    const gaps: string[] = [];
    const recommendations: string[] = [];

    // ==========================================
    // Check 1: Real Execution Trace Completeness
    // ==========================================
    const successfulTraces = traces.filter((t) => t.status === 'SUCCESS');
    const failedTraces = traces.filter((t) => t.status === 'FAILED');
    const executedStepsCount = traces.length;
    const planStepsCount = plan.steps.length;

    let traceScore = 0;
    if (planStepsCount > 0) {
      traceScore = Math.min(1.0, successfulTraces.length / planStepsCount);
    }

    if (failedTraces.length > 0) {
      gaps.push(`发现 ${failedTraces.length} 个步骤真实执行失败: ${failedTraces.map((t) => t.stepId).join(', ')}`);
    }

    checks.push({
      id: 'check_trace_reality',
      name: '真实执行轨迹覆盖率',
      category: 'execution_reality',
      status: traceScore >= 0.8 ? 'PASSED' : traceScore >= 0.5 ? 'WARNING' : 'FAILED',
      score: traceScore,
      weight: 0.25,
      message: `计划执行 ${planStepsCount} 个步骤，成功记录真实轨迹 ${successfulTraces.length} 个，失败 ${failedTraces.length} 个`,
      details: { successfulTracesCount: successfulTraces.length, planStepsCount, failedTracesCount: failedTraces.length },
    });

    // ==========================================
    // Check 2: Artifact Generation & No-Empty Outputs
    // ==========================================
    const nonReportArtifacts = artifacts.filter((a) => a.type !== 'FinalReportArtifact');
    let artifactScore = 0;
    if (plan.expectedArtifacts.length > 0) {
      artifactScore = Math.min(1.0, nonReportArtifacts.length / Math.max(1, plan.expectedArtifacts.length));
    } else {
      artifactScore = nonReportArtifacts.length > 0 ? 1.0 : 0.0;
    }

    let malformedCount = 0;
    for (const art of artifacts) {
      if (!art.content || (typeof art.content === 'object' && Object.keys(art.content).length === 0)) {
        malformedCount++;
      }
    }

    if (malformedCount > 0) {
      artifactScore = Math.max(0, artifactScore - 0.2 * malformedCount);
      gaps.push(`检测到 ${malformedCount} 个空载荷或格式畸形的产物`);
    }

    checks.push({
      id: 'check_artifact_integrity',
      name: '结构化产物完整性与有效性',
      category: 'skill_compliance',
      status: artifactScore >= 0.8 ? 'PASSED' : artifactScore >= 0.4 ? 'WARNING' : 'FAILED',
      score: artifactScore,
      weight: 0.25,
      message: `预期产物类别 ${plan.expectedArtifacts.length} 种，实际产出有效中间产物 ${nonReportArtifacts.length} 份`,
      details: { expectedCount: plan.expectedArtifacts.length, actualCount: nonReportArtifacts.length, malformedCount },
    });

    // ==========================================
    // Check 3: Evidence Grounding (No Fake External Claims)
    // ==========================================
    const validSourceEvidences = evidences.filter((e: EvidenceRef) => e.url || (e.source && e.source !== 'unknown'));
    const evidenceScore = evidences.length > 0 ? (validSourceEvidences.length / evidences.length) : 0.5;

    let temporalConflicts = 0;
    for (const ev of evidences) {
      if (ev.publishedAt && ev.publishedAt > systemCurrentDate) {
        temporalConflicts++;
        ev.hasTemporalConflict = true;
      }
    }

    if (temporalConflicts > 0) {
      gaps.push(`发现 ${temporalConflicts} 条证据包含超越系统当前日期 (${systemCurrentDate}) 的发布时间`);
    }

    checks.push({
      id: 'check_evidence_grounding',
      name: '客观证据真实性与溯源度',
      category: 'evidence_grounding',
      status: temporalConflicts === 0 && evidenceScore >= 0.7 ? 'PASSED' : 'WARNING',
      score: temporalConflicts > 0 ? Math.max(0.3, evidenceScore - 0.3) : evidenceScore,
      weight: 0.2,
      message: `登记外部证据 ${evidences.length} 条，可溯源有效实体 ${validSourceEvidences.length} 条，时间矛盾 ${temporalConflicts} 条`,
      details: { totalEvidences: evidences.length, validSources: validSourceEvidences.length, temporalConflicts },
    });

    // ==========================================
    // Check 4: User Task Core Elements Coverage
    // ==========================================
    const finalReport = artifacts.find((a) => a.type === 'FinalReportArtifact');
    const reportText = (finalReport?.content as any)?.markdown || '';
    
    const tokens = targetTask
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    let coveredTokens = 0;
    for (const token of tokens) {
      if (reportText.includes(token)) {
        coveredTokens++;
      }
    }

    const taskCoverage = tokens.length > 0 ? coveredTokens / tokens.length : 1.0;
    checks.push({
      id: 'check_task_coverage',
      name: '用户核心诉求覆盖率',
      category: 'user_coverage',
      status: taskCoverage >= 0.7 ? 'PASSED' : taskCoverage >= 0.4 ? 'WARNING' : 'FAILED',
      score: taskCoverage,
      weight: 0.15,
      message: `委托课题切词要素覆盖比例 ${Math.round(taskCoverage * 100)}% (${coveredTokens}/${tokens.length})`,
      details: { tokens, coveredCount: coveredTokens },
    });

    // ==========================================
    // Check 5: Script/Tool Execution Reality
    // ==========================================
    const scriptOrToolTraces = traces.filter((t) => t.tool && t.tool !== 'General Reasoning');
    const toolSuccessRate = scriptOrToolTraces.length > 0
      ? scriptOrToolTraces.filter((t) => t.status === 'SUCCESS').length / scriptOrToolTraces.length
      : 1.0;

    checks.push({
      id: 'check_tool_script_reality',
      name: '工具与脚本动作成功率',
      category: 'execution_reality',
      status: toolSuccessRate >= 0.8 ? 'PASSED' : toolSuccessRate >= 0.5 ? 'WARNING' : 'FAILED',
      score: toolSuccessRate,
      weight: 0.15,
      message: `真实外部工具/技能调用 ${scriptOrToolTraces.length} 次，成功率 ${Math.round(toolSuccessRate * 100)}%`,
      details: { totalCalls: scriptOrToolTraces.length, successRate: toolSuccessRate },
    });

    // ==========================================
    // Calculate Weighted Final Confidence & Verification Status
    // ==========================================
    let totalWeight = 0;
    let weightedScore = 0;
    for (const c of checks) {
      totalWeight += c.weight;
      weightedScore += c.score * c.weight;
    }
    const finalScore = totalWeight > 0 ? Number((weightedScore / totalWeight).toFixed(3)) : 0;

    let overallStatus: 'VERIFIED' | 'DEGRADED' | 'FAILED' = 'VERIFIED';
    if (finalScore < 0.5 || failedTraces.length > planStepsCount * 0.5) {
      overallStatus = 'FAILED';
    } else if (finalScore < 0.75 || gaps.length > 0) {
      overallStatus = 'DEGRADED';
    }

    if (gaps.length > 0) {
      recommendations.push('建议针对执行失败或数据缺失的专项节点，检查外部依赖或配置后重试。');
    }
    if (evidenceScore < 0.6) {
      recommendations.push('外部客观事实源偏少，建议配置具备外网检索能力的 Browser MCP。');
    }

    let verifiedCount = 0;
    let rejectedCount = 0;
    for (const art of artifacts) {
      if (overallStatus === 'FAILED') {
        art.status = 'rejected';
        art.confidence = Number(Math.max(0.1, finalScore * 0.5).toFixed(2));
        rejectedCount++;
      } else {
        art.status = overallStatus === 'VERIFIED' ? 'verified' : 'processed';
        art.confidence = Number(finalScore.toFixed(2));
        verifiedCount++;
      }
    }

    return {
      runId,
      overallStatus,
      verificationScore: finalScore,
      confidenceScore: finalScore,
      checks,
      verifiedArtifactsCount: verifiedCount,
      rejectedArtifactsCount: rejectedCount,
      unresolvedGaps: gaps,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }
}

export const globalSkillVerifier = new SkillVerifier();
