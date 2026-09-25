import {
  ExecutionPlan,
  ExecutionStep,
  ExecutionRun,
  Artifact,
  ExecutionTrace,
} from './types';
import { globalExecutionRuntime, RuntimeExecutionOptions } from './runtime';
import { globalExecutionTraceManager } from './execution-trace';
import { globalArtifactBus } from './artifacts';

export interface OrchestrationResult {
  runId: string;
  status: 'COMPLETED' | 'FAILED' | 'ABORTED';
  plan: ExecutionPlan;
  steps: ExecutionStep[];
  finalReportMarkdown?: string;
  artifacts: Artifact[];
  artifactsCount: number;
  traces: ExecutionTrace[];
  tracesCount: number;
  durationMs?: number;
  error?: string;
}

export class SkillOrchestrator {
  /**
   * Section 26 & 27: DAG-based Orchestration Engine
   * Executes parallel groups concurrently, respecting dependencies.
   */
  async executePlan(
    plan: ExecutionPlan,
    options: RuntimeExecutionOptions = {}
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const runId = plan.runId;
    const cutoff = options.researchCutoff || globalExecutionRuntime.currentDate;

    // Start execution run
    globalExecutionTraceManager.startRun(runId, plan.task, plan.projectId, plan.runId, cutoff);

    let finalReportMarkdown: string | undefined;
    let runStatus: 'COMPLETED' | 'FAILED' | 'ABORTED' = 'COMPLETED';
    let errorMessage: string | undefined;

    try {
      // Execute each parallel group in topological DAG order
      for (const group of plan.parallelGroups) {
        if (options.signal?.aborted) {
          runStatus = 'ABORTED';
          throw new Error('用户中止了任务执行');
        }

        // Find the execution steps for this group
        const groupSteps = plan.steps.filter((s) => group.includes(s.stepId));
        if (groupSteps.length === 0) continue;

        if (groupSteps.length === 1) {
          // Single step execution
          const step = groupSteps[0];
          const res = await globalExecutionRuntime.executeStep(runId, step, options);

          if (!res.success) {
            if (res.error?.code === 'ABORTED') {
              runStatus = 'ABORTED';
              throw new Error('任务已终止');
            }
            // For non-fatal step errors, continue with fallback if synthesis, otherwise report
            if (step.stepId.includes('synthesis')) {
              errorMessage = res.error?.message;
            }
          }

          if (step.stepId.includes('synthesis') && typeof res.output === 'string') {
            finalReportMarkdown = res.output;
          }
        } else {
          // Throttled parallel execution of independent specialty skills (concurrency limit = 2)
          // to prevent bursting model API rate limits (RPM / QPS)
          const concurrencyLimit = 2;
          const results: any[] = [];
          for (let i = 0; i < groupSteps.length; i += concurrencyLimit) {
            if (options.signal?.aborted) {
              runStatus = 'ABORTED';
              throw new Error('用户中止了任务执行');
            }
            const chunk = groupSteps.slice(i, i + concurrencyLimit);
            const chunkPromises = chunk.map((step) =>
              globalExecutionRuntime.executeStep(runId, step, options)
            );
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);

            // Brief pacing delay between batches to respect rate limits
            if (i + concurrencyLimit < groupSteps.length) {
              await new Promise((r) => setTimeout(r, 300));
            }
          }

          for (let i = 0; i < results.length; i++) {
            const res = results[i];
            const step = groupSteps[i];
            if (!res.success) {
              console.warn(`[SkillOrchestrator] Step ${step.stepId} completed with advisory notice:`, res.error?.message);
            }
          }
        }
      }

      // If synthesis report wasn't set, try grabbing final artifact
      if (!finalReportMarkdown) {
        const artifacts = globalArtifactBus.getArtifactsByRunId(runId);
        const finalArt = artifacts.find((a) => a.type === 'FinalReportArtifact');
        if (finalArt && (finalArt.content as any)?.markdown) {
          finalReportMarkdown = (finalArt.content as any).markdown;
        }
      }

      globalExecutionTraceManager.finishRun(runId, 'COMPLETED', `成功完成 DAG 规划与 ${plan.steps.length} 步专业推演`);
    } catch (err: any) {
      runStatus = options.signal?.aborted ? 'ABORTED' : 'FAILED';
      errorMessage = err.message || 'DAG 编排执行异常';
      globalExecutionTraceManager.finishRun(runId, runStatus, undefined, errorMessage);
    }

    const allArtifacts = globalArtifactBus.getArtifactsByRunId(runId);
    const allTraces = globalExecutionTraceManager.getTracesByRunId(runId);
    const run = globalExecutionTraceManager.getRun(runId);
    const durationMs = run?.finishedAt && run?.startedAt
      ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      : Date.now() - startTime;

    return {
      runId,
      status: runStatus,
      plan,
      steps: plan.steps,
      finalReportMarkdown,
      artifacts: allArtifacts,
      artifactsCount: allArtifacts.length,
      traces: allTraces,
      tracesCount: allTraces.length,
      durationMs,
      error: errorMessage,
    };
  }
}

export const globalSkillOrchestrator = new SkillOrchestrator();
