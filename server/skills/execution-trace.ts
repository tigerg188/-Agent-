import crypto from 'crypto';
import { ExecutionRun, ExecutionTrace } from './types';
import { globalSkillDb } from '../database/db';

export class ExecutionTraceManager {
  private runs: Map<string, ExecutionRun> = new Map();
  private traces: Map<string, ExecutionTrace[]> = new Map();

  startRun(runId: string, task: string, projectId: string, planId: string, researchCutoff = '2026-09-24'): ExecutionRun {
    const run: ExecutionRun = {
      runId,
      task,
      projectId,
      planId,
      startedAt: new Date().toISOString(),
      status: 'EXECUTING',
      researchCutoff,
    };

    this.runs.set(runId, run);
    this.traces.set(runId, []);

    try {
      globalSkillDb.saveExecutionRun(run);
    } catch (e) {
      console.warn('[ExecutionTraceManager] Failed to persist run:', e);
    }

    return run;
  }

  finishRun(runId: string, status: ExecutionRun['status'], summary?: string, error?: string): void {
    const run = this.runs.get(runId);
    if (run) {
      run.status = status;
      run.finishedAt = new Date().toISOString();
      run.summary = summary;
      run.error = error;

      try {
        globalSkillDb.saveExecutionRun(run);
      } catch (e) {
        console.warn('[ExecutionTraceManager] Failed to update run:', e);
      }
    }
  }

  /**
   * Section 31 & 32: Record an actual step or tool execution trace
   */
  recordTrace(
    runId: string,
    params: {
      stepId: string;
      action: string;
      tool?: string;
      input?: unknown;
      output?: unknown;
      artifactIds?: string[];
      durationMs?: number;
      status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'RETRYING';
      error?: string;
    }
  ): ExecutionTrace {
    const traceId = `trc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const trace: ExecutionTrace = {
      traceId,
      runId,
      stepId: params.stepId,
      timestamp: new Date().toISOString(),
      action: params.action,
      tool: params.tool,
      input: params.input,
      output: params.output,
      artifactIds: params.artifactIds || [],
      durationMs: params.durationMs || 0,
      status: params.status,
      error: params.error,
    };

    const runTraces = this.traces.get(runId) || [];
    runTraces.push(trace);
    this.traces.set(runId, runTraces);

    try {
      globalSkillDb.saveExecutionTrace(trace);
    } catch (e) {
      console.warn('[ExecutionTraceManager] Failed to persist trace:', e);
    }

    return trace;
  }

  getTracesByRunId(runId: string): ExecutionTrace[] {
    try {
      const dbTraces = globalSkillDb.getExecutionTraces(runId);
      if (dbTraces.length > 0) return dbTraces;
    } catch {}
    return this.traces.get(runId) || [];
  }

  getRun(runId: string): ExecutionRun | undefined {
    try {
      const dbRun = globalSkillDb.getExecutionRun(runId);
      if (dbRun) return dbRun;
    } catch {}
    return this.runs.get(runId);
  }

  /**
   * Section 32: Audit verification - check if a specific skill was genuinely executed
   */
  hasRealExecutionTrace(runId: string, skillOrStepId: string): boolean {
    const list = this.getTracesByRunId(runId);
    return list.some(
      (t) => (t.stepId === skillOrStepId || t.action.includes(skillOrStepId)) && t.status === 'SUCCESS'
    );
  }
}

export const globalExecutionTraceManager = new ExecutionTraceManager();
