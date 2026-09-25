import crypto from 'crypto';
import {
  SkillProjectMap,
  RuntimeIntent,
  InputRequirement,
  WorkflowStep,
  ToolRequirement,
  OutputRequirement,
  RuntimeConstraint,
  CompletionCondition,
  FailureCondition,
  EvidenceRequirement,
} from './types';
import { globalSkillDb } from '../database/db';

export class RuntimeIntentBuilder {
  /**
   * Section 17: Generate task-grounded RuntimeIntent
   * Synthesizes user task, project map, entries, relationships, and tool constraints.
   */
  build(task: string, projectMap: SkillProjectMap, researchCutoff = '2026-09-24'): RuntimeIntent {
    const taskLower = task.toLowerCase();
    const mainEntry = projectMap.mainEntry;
    const entries = projectMap.entries || [];

    // 1. Determine which child skills are functionally relevant to this task
    const selectedSkills: string[] = [];
    if (mainEntry) {
      selectedSkills.push(mainEntry.name || projectMap.projectName);
    }

    for (const entry of entries) {
      if (entry.path === mainEntry?.path) continue;
      const entryText = `${entry.name} ${entry.displayName || ''} ${entry.description || ''}`.toLowerCase();

      // Check relevance heuristics
      let isRelevant = false;
      if (
        (taskLower.includes('机器人') || taskLower.includes('具身') || taskLower.includes('产业') || taskLower.includes('市场')) &&
        (entryText.includes('市场') || entryText.includes('行业') || entryText.includes('规模') || entryText.includes('market'))
      ) {
        isRelevant = true;
      } else if (
        (taskLower.includes('技术') || taskLower.includes('发展') || taskLower.includes('趋势') || taskLower.includes('架构')) &&
        (entryText.includes('技术') || entryText.includes('路线') || entryText.includes('研发') || entryText.includes('tech'))
      ) {
        isRelevant = true;
      } else if (
        (taskLower.includes('企业') || taskLower.includes('商业') || taskLower.includes('投资') || taskLower.includes('机会') || taskLower.includes('公司')) &&
        (entryText.includes('投资') || entryText.includes('商业') || entryText.includes('竞争') || entryText.includes('公司') || entryText.includes('产业链'))
      ) {
        isRelevant = true;
      } else if (
        taskLower.includes('供应链') || taskLower.includes('制造') || taskLower.includes('部件')
      ) {
        if (entryText.includes('供应链') || entryText.includes('制造') || entryText.includes('零部件')) {
          isRelevant = true;
        }
      }

      // If no specific match, include up to 4 primary specialty skills in project
      if (isRelevant || selectedSkills.length < 5) {
        selectedSkills.push(entry.name);
      }
    }

    // 2. Define Inputs
    const inputs: InputRequirement[] = [
      {
        name: 'task',
        type: 'string',
        description: '用户研究委托与目标课题',
        required: true,
        default: task,
      },
      {
        name: 'researchCutoff',
        type: 'string',
        description: '数据与事实有效截止日期 (默认 2026-09-24)',
        required: false,
        default: researchCutoff,
      },
      {
        name: 'depth',
        type: 'string',
        description: '分析研判深度标准',
        required: false,
        default: 'comprehensive_investment_grade',
      },
    ];

    // 3. Define Required Capabilities
    const requiredCapabilities = [
      '多源网络情报采集与网页检索 (Browser MCP)',
      '异构专业技能规范解析与执行 (Heterogeneous Skill Runtime)',
      '跨技能结构化产物总线流动 (Artifact Bus)',
      '事实/预测口径分类与时序一致性审计 (Temporal Consistency)',
      '综合投资分析与商业可行性研判 (Synthesis Reasoning)',
    ];

    // 4. Section 26: Generate DAG-oriented workflow steps
    const workflow: WorkflowStep[] = [
      {
        stepNumber: 1,
        stepId: 'step_task_definition',
        title: '任务拆解与研究范围界定',
        skillOrTool: mainEntry?.name || 'Project Router',
        action: '分析任务意图、划定研究标的、设立分析维度与基准时间 (2026-09-24)',
        expectedOutput: '明确的开题界定与专项分析任务清单',
      },
      {
        stepNumber: 2,
        stepId: 'step_browser_intelligence',
        title: '全网一手事实采集与动态观测',
        skillOrTool: 'Web Browser & Search MCP',
        action: '定向抓取全球行业前沿指标、核心厂商动态及权威预测数据',
        expectedOutput: '真实可溯源的原始数据事实集 (Evidence References)',
      },
      {
        stepNumber: 3,
        stepId: 'step_parallel_specialty_analysis',
        title: '调度所选专项技能进行并行深度分析',
        skillOrTool: selectedSkills.filter((s) => s !== mainEntry?.name).join(' & ') || 'Specialty Skills',
        action: '按各专项 SKILL.md 分别测算市场规模、技术瓶颈、产业链卡位与商业化机会',
        expectedOutput: '多个专项结构化产物 (Artifacts)',
        dependsOn: ['step_browser_intelligence'],
      },
      {
        stepNumber: 4,
        stepId: 'step_cross_validation_synthesis',
        title: '产物交叉验证与主报告交付物编译',
        skillOrTool: 'Document & Artifact Bus',
        action: '归集各专项 Artifacts，校验证据链与时间有效性，输出完整投资级研究主报告',
        expectedOutput: '专业 Markdown 主交付报告',
        dependsOn: ['step_parallel_specialty_analysis'],
      },
    ];

    // 5. Section 16 Tools & Outputs & Constraints
    const tools: ToolRequirement[] = [
      { name: 'Web Browser & Search MCP', type: 'browser', required: true, reason: '实时获取最新外部公开事实与权威指标' },
      { name: 'Document & Artifact Bus', type: 'filesystem', required: true, reason: '存储与流转各技能生成的结构化数据产物' },
      { name: 'Gemini Model Adapter', type: 'model', required: true, reason: '执行方法论推导、量化推演与综合分析报告编译' },
    ];

    const expectedOutputs: OutputRequirement[] = [
      {
        name: `${task.slice(0, 20)}-研报.md`,
        format: 'markdown',
        description: '包含核心结论、推导过程、事实/预测对照与证据链的结构化主报告',
        required: true,
      },
      {
        name: '结构化产物清单 (Artifacts)',
        format: 'json',
        description: '各专项技能输出的结构化量化底表与分析数据',
        required: true,
      },
    ];

    const constraints: RuntimeConstraint[] = [
      { description: '严禁伪造不存在的检索结果、数据指标或公司信息', category: 'data_integrity' },
      { description: `严格以 ${researchCutoff} 作为研究截止基准时间，禁止采用过时陈旧年份`, category: 'temporal' },
      { description: '最终报告内容必须严格源自实际执行产物与真实检索观察', category: 'data_integrity' },
      { description: '遇到不可用工具时明确记录 Tool Required 与影响，不得声称虚假成功', category: 'safety' },
    ];

    const completionConditions: CompletionCondition[] = [
      { condition: '关键指标具备证据出处', standard: '数据需标明来源机构、发布时间与口径' },
      { condition: '各专项技能产生有效产物', standard: 'Artifact Bus 需记录对应产物节点' },
      { condition: '最终报告覆盖用户核心诉求', standard: '包含行业趋势、市场规模与商业投资机会' },
    ];

    const failureConditions: FailureCondition[] = [
      { condition: '浏览器检索完全受阻且无备用数据源', handling: '标注数据缺口并在研报中明确提示局限性' },
      { condition: '用户主动触发中止 (Abort)', handling: '安全终止所有子流程并输出已完成部分的临时快照' },
    ];

    const evidenceRequirements: EvidenceRequirement[] = [
      { type: 'FACT', description: '历史实际出货量、权威统计部门数据、企业公开发布', strictness: 'mandatory' },
      { type: 'FORECAST', description: '行业预测与市场规模测算，必须显式标明预测区间与核心假设', strictness: 'mandatory' },
    ];

    const runtimeIntent: RuntimeIntent = {
      projectId: projectMap.projectId,
      task,
      goal: `依照「${projectMap.projectName}」的方法论与规范，针对「${task}」执行严谨的深度专业研究。`,
      authorIntent: projectMap.projectDescription,
      inputs,
      requiredCapabilities,
      selectedSkills,
      workflow,
      tools,
      expectedOutputs,
      constraints,
      completionConditions,
      failureConditions,
      evidenceRequirements,
    };

    // Save to database
    try {
      globalSkillDb.saveRuntimeIntent(runtimeIntent);
    } catch (e) {
      console.warn('[RuntimeIntentBuilder] Failed to save intent to db:', e);
    }

    return runtimeIntent;
  }
}

export const globalRuntimeIntentBuilder = new RuntimeIntentBuilder();
