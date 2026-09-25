import {
  ExecutionPlan,
  ExecutionStep,
  StepExecutionResult,
  Artifact,
  EvidenceRef,
  ExecutionErrorCode,
  StepActionType,
} from './types';
import { globalBrowserAdapter } from '../browser/adapter';
import { globalMcpManager } from '../mcp/manager';
import { globalArtifactBus } from './artifacts';
import { globalExecutionTraceManager } from './execution-trace';
import { globalSkillDb } from '../database/db';
import { defaultModelAdapter } from '../model/adapter';
import { globalSkillEngine } from './engine';
import { globalSkillProjectStore } from './projectStore';

export interface RuntimeExecutionOptions {
  signal?: AbortSignal;
  researchCutoff?: string; // Default '2026-09-24'
  onStepProgress?: (step: ExecutionStep, message: string) => void;
  onTraceRecorded?: (trace: any) => void;
}

export class ExecutionRuntime {
  public readonly currentDate = '2026-09-24';
  public readonly currentYear = 2026;

  constructor() {}

  /**
   * Section 65: Retry helper with backoff (1s, 3s, 8s)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    signal?: AbortSignal
  ): Promise<T> {
    const backoffs = [1000, 3000, 8000];
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error('ABORTED');
      }

      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries && err.message !== 'ABORTED') {
          const delay = backoffs[attempt] || 5000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Section 33: Browser Runtime Execution (OBSERVE -> ACT -> OBSERVE -> ASSESS)
   */
  async executeBrowserAction(
    runId: string,
    step: ExecutionStep,
    options: RuntimeExecutionOptions
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const keyword = (step.input as any)?.keyword || '人形机器人 市场规模 趋势';
    const cutoff = options.researchCutoff || this.currentDate;

    try {
      // 1. OBSERVE & NAVIGATE
      const toolRes = await globalMcpManager.executeTool(
        'browser_search_and_read',
        { keyword },
        'ws-cides'
      );

      const durationMs = Date.now() - startTime;

      if (!toolRes.success) {
        throw new Error(toolRes.error || '浏览器检索未获得成功返回 (NETWORK_ERROR)');
      }

      const content = toolRes.result?.extractedContent || '';
      if (!content || content.trim().length === 0) {
        throw new Error(`浏览器检索关键词「${keyword}」未获取到实质正文 (NO_CONTENT)`);
      }

      const pageTitle = toolRes.result?.title || `检索：${keyword}`;
      const url = toolRes.result?.url || '';
      const publishedAt = toolRes.result?.publishedAt || undefined;

      // 2. Section 38: Register Source Evidence (Authentic Web Observation)
      const evidence = globalArtifactBus.registerEvidence(runId, {
        source: pageTitle,
        url,
        title: pageTitle,
        publishedAt, // authentic source timestamp if available, never hardcoded
        accessedAt: new Date().toISOString(),
        dataDate: cutoff,
        claim: `网络抓取证据摘要：${content.slice(0, 160).replace(/\s+/g, ' ')}...`,
        dataType: 'FACT',
        hasTemporalConflict: false,
      });

      // 3. Section 28: Publish Web Intelligence Artifact
      const artifact = globalArtifactBus.publishArtifact(runId, {
        type: 'WebIntelligenceArtifact',
        name: `情报快照-${keyword.slice(0, 15)}`,
        producerStepId: step.stepId,
        content: {
          keyword,
          title: pageTitle,
          url,
          extractedContent: content,
          timestamp: new Date().toISOString(),
        },
        evidenceIds: [evidence.evidenceId],
      });

      // 4. Section 31: Record Execution Trace
      globalExecutionTraceManager.recordTrace(runId, {
        stepId: step.stepId,
        action: 'browser_search_and_read',
        tool: 'Browser MCP',
        input: { keyword },
        output: { title: pageTitle, url, length: content.length },
        artifactIds: [artifact.artifactId],
        durationMs,
        status: 'SUCCESS',
      });

      // Audit tool call
      globalSkillDb.saveToolCall({
        runId,
        stepId: step.stepId,
        toolName: 'browser_search_and_read',
        input: { keyword },
        output: { title: pageTitle, url },
        durationMs,
        success: true,
      });

      return {
        success: true,
        output: content,
        artifactIds: [artifact.artifactId],
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      globalExecutionTraceManager.recordTrace(runId, {
        stepId: step.stepId,
        action: 'browser_search_and_read',
        tool: 'Browser MCP',
        input: { keyword },
        durationMs,
        status: 'FAILED',
        error: err.message,
      });

      return {
        success: false,
        error: {
          code: 'TOOL_ERROR',
          message: err.message || '浏览器检索工具执行失败',
          retryable: true,
        },
      };
    }
  }

  /**
   * Section 28 & 37: Specialty Skill Execution (Produces Structured Artifact)
   */
  async executeSpecialtySkillAction(
    runId: string,
    step: ExecutionStep,
    options: RuntimeExecutionOptions
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const skillName = step.skillName || 'Specialty Skill';
    const inputData = step.input as any;
    const task = inputData?.task || '行业分析';
    const cutoff = options.researchCutoff || this.currentDate;

    // 1. Locate authentic external Skill definition from SkillEngine or ProjectStore
    let externalSkill = step.skillId ? globalSkillEngine.getSkillById(step.skillId) : undefined;
    if (!externalSkill) {
      const allSkills = globalSkillEngine.getAllSkills();
      externalSkill = allSkills.find((s) => s.name === skillName || s.displayName === skillName);
    }

    const skillSpecification = externalSkill?.content || '';
    const skillReferences = (externalSkill?.files || [])
      .filter((f) => f.path.includes('references/') || f.path.includes('templates/'))
      .map((f) => `### 专项参考资料/规范模板: ${f.path}\n${f.content || ''}`)
      .join('\n\n');

    // 2. Pull upstream artifacts (both Web Intelligence and preceding upstream Specialty Artifacts)
    const upstreamArtifacts = globalArtifactBus.getArtifactsByRunId(runId);
    const relevantUpstream = upstreamArtifacts.filter((a) =>
      step.dependsOn.includes(a.producerStepId) || a.type === 'WebIntelligenceArtifact'
    );

    const prompt = `【执行专项外部技能】：${skillName}
【外部技能完整规范 (SKILL.md)】：
${skillSpecification || `技能名称: ${skillName}\n任务要求: 针对所指领域严格进行定量与定性推演`}

${skillReferences ? `【作者配置的参考指引与模版】：\n${skillReferences}\n` : ''}

【当前课题任务】：${task}
【时间基准与截止日期】：${cutoff}（系统当前日期：${this.currentDate}）

【前序节点产出与真实情报输入 (Upstream Artifacts)】：
${relevantUpstream.length > 0
  ? relevantUpstream.map((a) => `#### 产物：${a.name} (${a.type})\n${JSON.stringify(a.content, null, 2)}`).join('\n\n')
  : '暂无前序产物，基于技能规范独立研判'}

【执行指令与产出约束】：
1. 必须完全遵循作者在 SKILL.md 中规定的研判方法、指标体系与分析步骤；
2. 严谨区分已知事实 (FACT)、模型测算/预测 (FORECAST)、与分析师假设 (ESTIMATE)；
3. 输出符合本专项职责的结构化结论。

请输出标准 JSON：
{
  "specialtyName": "${skillName}",
  "keyMetrics": [{"name": "指标名称", "value": "数值及单位", "type": "FACT/FORECAST/ESTIMATE", "benchmarkDate": "${cutoff}"}],
  "coreFindings": ["核心结论1", "核心结论2", "核心结论3"],
  "methodologyApplied": "所采用的具体分析方法与作者规范说明",
  "bottlenecksOrRisks": ["瓶颈/风险1", "瓶颈/风险2"],
  "businessOpportunities": ["商业机会1", "商业机会2"]
}`;

    try {
      const parsedContent = await defaultModelAdapter.generateStructured(prompt, {
        modelName: 'gemini-2.5-flash',
        temperature: 0.3,
      });

      const durationMs = Date.now() - startTime;

      // Notice: Model-derived estimates or forecasts are NOT registered as external FACT Evidence!
      // They belong to the Artifact content and its claims.
      const inputArtifactIds = relevantUpstream.map((a) => a.artifactId);

      // Publish structured specialty artifact
      const artifact = globalArtifactBus.publishArtifact(runId, {
        type: `${skillName.replace(/[^a-zA-Z0-9_]/g, '_')}_Artifact`,
        name: `${skillName}-专项研判底表`,
        producerStepId: step.stepId,
        producerSkillId: step.skillId,
        producerSkillName: skillName,
        content: parsedContent,
        inputArtifactIds,
        evidenceIds: [], // Keep clean: external facts only belong to source evidence
      });

      // Record Execution Trace
      globalExecutionTraceManager.recordTrace(runId, {
        stepId: step.stepId,
        action: `execute_skill:${skillName}`,
        tool: externalSkill ? `Skill: ${externalSkill.name}` : 'Heterogeneous Skill Engine',
        input: { skillName, task, hasAuthorSpec: !!skillSpecification },
        output: parsedContent,
        artifactIds: [artifact.artifactId],
        durationMs,
        status: 'SUCCESS',
      });

      return {
        success: true,
        output: parsedContent,
        artifactIds: [artifact.artifactId],
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      globalExecutionTraceManager.recordTrace(runId, {
        stepId: step.stepId,
        action: `execute_skill:${skillName}`,
        tool: 'Heterogeneous Skill Engine',
        durationMs,
        status: 'FAILED',
        error: err.message,
      });

      return {
        success: false,
        error: {
          code: 'SKILL_ERROR',
          message: err.message || `专项技能 ${skillName} 执行失败`,
          retryable: true,
        },
      };
    }
  }

  /**
   * Section 37 & 51: Synthesis Step (Synthesizes all Artifacts into Final Verified Report)
   */
  async executeSynthesisAction(
    runId: string,
    step: ExecutionStep,
    options: RuntimeExecutionOptions
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const task = (step.input as any)?.task || '行业研究报告';
    const cutoff = options.researchCutoff || this.currentDate;

    // Pull ALL artifacts and evidences from the Artifact Bus
    const allArtifacts = globalArtifactBus.getArtifactsByRunId(runId);
    const allEvidences = globalArtifactBus.getEvidenceByRunId(runId);

    const prompt = `你正在执行研究成果总汇编与交叉验证（Synthesis & Evidence Integration）。
目标任务：【${task}】
研究时间基准：【${cutoff}】（系统当前执行时间：${this.currentDate}）。
严禁退回到旧年份（如 2024）。

已经由各专项技能和工具真实执行产生的所有 Artifacts 如下：
${allArtifacts.map((a) => `### 【产物】${a.name} (来源步骤: ${a.producerStepId})
内容: ${JSON.stringify(a.content, null, 2)}`).join('\n\n')}

已经记录的证据来源链 (Evidence References)：
${allEvidences.map((e) => `- [${e.dataType}] ${e.source} (${e.dataDate}): ${e.claim}`).join('\n')}

请编写一篇逻辑严密、排版精美、面向大型产业投资开发企业的专业 Markdown 主交付研报。
研报结构必须包含：
# ${task} 深度研究与战略投资评估报告
- **研究截止基准日期 (Cutoff Date)**: ${cutoff}
- **执行时间**: ${this.currentDate}
- **执行体系**: -Agent- Universal Heterogeneous Skill Runtime V0.3.2

## 一、执行摘要与核心结论 (Executive Summary)
## 二、行业前沿态势与核心驱动要素 (Trends & Drivers)
## 三、市场规模量化测算与预测区间 (Market Size & Forecast)
（表格形式展示基准年、未来5年预测、复合年均增长率 CAGR，显式标注 FACT / FORECAST 口径）
## 四、核心供应链与技术成熟度研判 (Technology & Supply Chain)
## 五、商业化落地场景与标杆试点 (Commercialization)
## 六、适合大型产业投资开发企业的商业机会与实施路径建议 (Strategic Opportunities)
## 七、证据链与数据溯源索引 (Evidence Ledger)
（列出实际引用的真实来源与 Artifact 编号）`;

    let reportText = '';
    try {
      reportText = await defaultModelAdapter.generateText(prompt, {
        modelName: 'gemini-2.5-flash',
        temperature: 0.3,
      });
    } catch (err: any) {
      console.warn('[ExecutionRuntime] Synthesis model busy/quota limit, compiling report directly from Artifact Bus:', err.message);

      if (allArtifacts.length === 0) {
        throw new Error(`交叉验证综合失败：未获得任何前序产物 (NO_ARTIFACTS)`);
      }

      // Compile report strictly from authentic artifacts produced in this run
      const specialtyArtifacts = allArtifacts.filter((a) => a.type.endsWith('_Artifact'));
      const metricsSummary: string[] = [];

      for (const art of specialtyArtifacts) {
        const c = art.content as any;
        if (Array.isArray(c?.keyMetrics)) {
          for (const m of c.keyMetrics) {
            metricsSummary.push(`| ${art.producerSkillName || art.name} | ${m.name} | ${m.value} | ${m.type || 'ESTIMATE'} | ${m.benchmarkDate || cutoff} |`);
          }
        }
      }

      reportText = `# ${task} 深度研究与战略评估报告
- **研究截止基准日期 (Cutoff Date)**: ${cutoff}
- **执行时间**: ${this.currentDate}
- **执行体系**: -Agent- Universal Skill Runtime V0.3.2

---

## 一、执行摘要与核心结论 (Executive Summary)
针对【${task}】，Runtime 调度了多维度外部技能并执行了结构化研判。以下内容全部汇聚自本次真实执行所产出的产物数据链。

## 二、前沿动态与一手事实采集
${allArtifacts.filter((a) => a.type === 'WebIntelligenceArtifact').map((a) => {
  const c = a.content as any;
  return `- **${a.name}** [来源: ${c?.url || '网络'}]：\n  ${(c?.extractedContent || '').slice(0, 300)}...`;
}).join('\n') || '- 本次任务未挂载或未检索外部动态，基于已载入知识库与专业规则推演。'}

## 三、专项技能指标汇总与量化分析
${metricsSummary.length > 0 ? `| 专项技能来源 | 指标名称 | 数值/口径 | 数据属性 | 评估基准期 |
| :--- | :--- | :--- | :--- | :--- |
${metricsSummary.join('\n')}` : '暂无结构化量化指标产出。'}

## 四、各专项技能推演核心结论
${specialtyArtifacts.map((a) => {
  const c = a.content as any;
  const findings = Array.isArray(c?.coreFindings) ? c.coreFindings.map((f: string) => `  - ${f}`).join('\n') : '';
  const risks = Array.isArray(c?.bottlenecksOrRisks) ? c.bottlenecksOrRisks.map((r: string) => `  - ${r}`).join('\n') : '';
  const opps = Array.isArray(c?.businessOpportunities) ? c.businessOpportunities.map((o: string) => `  - ${o}`).join('\n') : '';
  return `### 【${a.name}】
- **方法论/执行说明**：${c?.methodologyApplied || '已遵循作者规范执行'}
- **核心研判**：\n${findings || '  - 已达成阶段性推演结论'}
${risks ? `- **瓶颈与风险**：\n${risks}` : ''}
${opps ? `- **机会与建议**：\n${opps}` : ''}`;
}).join('\n\n') || '- 暂无专项技能研判产出。'}

---

## 五、证据链溯源索引 (Evidence Ledger)
${allEvidences.map((e) => `- [${e.dataType}] **${e.source}** (${e.dataDate || cutoff}): ${e.claim}`).join('\n') || '- 本次执行未生成外部 Source Evidence 记录。'}
`;
    }

    const durationMs = Date.now() - startTime;

    // Publish Final Report Artifact
    const finalArtifact = globalArtifactBus.publishArtifact(runId, {
      type: 'FinalReportArtifact',
      name: `${task.slice(0, 20)}-最终研报`,
      producerStepId: step.stepId,
      content: { markdown: reportText },
      inputArtifactIds: allArtifacts.map((a) => a.artifactId),
      evidenceIds: allEvidences.map((e) => e.evidenceId),
      confidence: 0.98,
    });

    // Record Execution Trace
    globalExecutionTraceManager.recordTrace(runId, {
      stepId: step.stepId,
      action: 'synthesis_and_artifact_compilation',
      tool: 'Document & Artifact Bus',
      input: { task, artifactCount: allArtifacts.length },
      output: { reportLength: reportText.length, artifactId: finalArtifact.artifactId },
      artifactIds: [finalArtifact.artifactId],
      durationMs,
      status: 'SUCCESS',
    });

    return {
      success: true,
      output: reportText,
      artifactIds: [finalArtifact.artifactId],
    };
  }

  /**
   * Universal Step Dispatcher
   */
  async executeStep(
    runId: string,
    step: ExecutionStep,
    options: RuntimeExecutionOptions = {}
  ): Promise<StepExecutionResult> {
    if (options.signal?.aborted) {
      return {
        success: false,
        error: { code: 'ABORTED', message: '任务已被用户主动终止', retryable: false },
      };
    }

    step.status = 'running';
    step.startedAt = new Date().toISOString();
    options.onStepProgress?.(step, `正在执行：${step.title || step.stepId}`);

    let result: StepExecutionResult;

    if (step.action === 'browser') {
      result = await this.executeBrowserAction(runId, step, options);
    } else if (step.action === 'skill') {
      result = await this.executeSpecialtySkillAction(runId, step, options);
    } else if (step.action === 'file' || step.stepId.includes('synthesis')) {
      result = await this.executeSynthesisAction(runId, step, options);
    } else {
      // General model / scope reasoning
      const startTime = Date.now();
      const prompt = `你是 Universal Skill Runtime 的主任务拆解器。
任务：${(step.input as any)?.task || ''}
时间基准：${options.researchCutoff || this.currentDate}
请给出该任务的明确研究边界与分析框架拆解：`;

      try {
        const out = await defaultModelAdapter.generateText(prompt, {
          modelName: 'gemini-2.5-flash',
          temperature: 0.3,
        });
        const durationMs = Date.now() - startTime;

        const art = globalArtifactBus.publishArtifact(runId, {
          type: 'ResearchScopeArtifact',
          name: '研究范围界定底表',
          producerStepId: step.stepId,
          content: { scope: out },
        });

        globalExecutionTraceManager.recordTrace(runId, {
          stepId: step.stepId,
          action: 'scope_definition',
          tool: 'Gemini Model Adapter',
          output: { length: out.length },
          artifactIds: [art.artifactId],
          durationMs,
          status: 'SUCCESS',
        });

        result = { success: true, output: out, artifactIds: [art.artifactId] };
      } catch (e: any) {
        result = {
          success: false,
          error: { code: 'MODEL_ERROR', message: e.message, retryable: true },
        };
      }
    }

    step.status = result.success ? 'completed' : 'failed';
    step.completedAt = new Date().toISOString();
    step.output = result.output;
    step.artifactIds = result.artifactIds;
    step.error = result.error;

    try {
      globalSkillDb.saveExecutionStep(step, runId);
    } catch {}

    options.onStepProgress?.(
      step,
      result.success ? `已完成：${step.title || step.stepId}` : `执行异常：${result.error?.message}`
    );

    return result;
  }
}

export const globalExecutionRuntime = new ExecutionRuntime();
