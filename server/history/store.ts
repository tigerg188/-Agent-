import { TaskRecord, StepLog } from '../types';

export class HistoryStore {
  private tasks: Map<string, TaskRecord> = new Map();

  constructor() {
    this.initSampleHistory();
  }

  private initSampleHistory() {
    const sampleTask1: TaskRecord = {
      id: 'task-hist-001',
      workspaceId: 'ws-cides',
      title: '调研全球 Agent 工具调用与 MCP 发展现状',
      prompt: '打开网络搜索，检索 Model Context Protocol 与 Agent Browser 自动化最新动态，整理成一份简要报告。',
      model: 'gemini-3.8-flash',
      status: 'completed',
      executionMode: 'auto_execute',
      skillId: 'web-research-summary',
      skillMode: 'auto',
      selectedSkill: {
        id: 'web-research-summary',
        name: 'web-research-summary',
        description: '自动化打开目标网络、检索最新资讯、深度抓取核心正文并输出结构化 Markdown 调研报告。',
      },
      selectedMcps: ['mcp-browser', 'mcp-web-search', 'mcp-file-doc'],
      attachedFiles: [],
      steps: [
        {
          id: 'step-1',
          stage: 'task_analysis',
          title: '任务分析中',
          description: '分析任务意图：网络前沿检索、提取多方事实、生成结构化研报',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'success',
        },
        {
          id: 'step-2',
          stage: 'skill_selected',
          title: '识别与选择 Skill',
          description: '自动匹配最佳技能：web-research-summary (网络多源情报调研与报告生成)',
          timestamp: new Date(Date.now() - 3550000).toISOString(),
          status: 'success',
        },
        {
          id: 'step-3',
          stage: 'tool_call',
          title: '调用工具：Browser 打开网页与检索',
          description: '使用 Browser MCP 导航至权威资讯站点，检索 MCP 协议最新演进',
          timestamp: new Date(Date.now() - 3450000).toISOString(),
          status: 'success',
        },
        {
          id: 'step-4',
          stage: 'tool_result',
          title: '提取与整理网页资料',
          description: '成功获取页面结构，抽取核心技术要素与关键观点',
          timestamp: new Date(Date.now() - 3350000).toISOString(),
          status: 'success',
        },
        {
          id: 'step-5',
          stage: 'verification',
          title: '验证任务结果',
          description: '结果自检：核验报告是否符合 Skill 模板规范与用户全部要求，各项核验均通过',
          timestamp: new Date(Date.now() - 3250000).toISOString(),
          status: 'success',
        },
        {
          id: 'step-6',
          stage: 'final_result',
          title: '输出最终成果',
          description: '生成成果文件：MCP-Agent技术现状调研报告.md',
          timestamp: new Date(Date.now() - 3200000).toISOString(),
          status: 'success',
        },
      ],
      currentStepIndex: 6,
      outputFiles: [
        {
          name: 'MCP-Agent技术现状调研报告.md',
          path: '/data/outputs/ws-cides/MCP-Agent技术现状调研报告.md',
          size: 2450,
          mimeType: 'text/markdown',
          previewContent: '# MCP 与 Agent 自动化技术演进调研报告\n\n## 一、核心结论\n- Model Context Protocol 成为连接企业工具链与大模型的通用标准。\n- 浏览器原生驱动（Playwright/CDP）成为高可靠自动化闭环的基石。\n\n## 二、关键发现\n- 自动化执行闭环要求可观察性与清晰审批中断机制。',
        },
      ],
      finalResult: '已成功完成调研。通过 Browser 与 Search MCP 检索了权威网络信息，并按 Skill 标准生成《MCP 与 Agent 自动化技术演进调研报告》。各项验证均已通过。',
      verificationReport: {
        passed: true,
        summary: '全流程产出物验证通过，满足格式规范、客观事实与结构化要求。',
        checks: [
          { name: '格式规范性', passed: true, message: '包含完整的标题、结论与详细事实支撑' },
          { name: '任务覆盖度', passed: true, message: '涵盖了 MCP 与 Browser 两大关键检索目标' },
          { name: '文件落地性', passed: true, message: '报告已安全持久化写入工作区输出目录' },
        ],
      },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3200000).toISOString(),
      durationMs: 400000,
    };

    this.tasks.set(sampleTask1.id, sampleTask1);
  }

  private sanitizeTask(task: TaskRecord): TaskRecord {
    // If task is completed, failed, or stopped, ensure no steps linger in 'in_progress'
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') {
      for (const step of task.steps) {
        if (step.status === 'in_progress') {
          step.status = 'success';
          if (step.stage === 'task_analysis') {
            step.title = '任务分析完成';
          }
        }
      }
    }
    return task;
  }

  getAllTasks(workspaceId?: string): TaskRecord[] {
    const list = Array.from(this.tasks.values())
      .map((t) => this.sanitizeTask(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!workspaceId) return list;
    return list.filter((t) => t.workspaceId === workspaceId);
  }

  getTask(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    return task ? this.sanitizeTask(task) : undefined;
  }

  saveTask(task: TaskRecord): void {
    this.tasks.set(task.id, this.sanitizeTask(task));
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  addStep(taskId: string, step: StepLog): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.steps.push(step);
      task.currentStepIndex = task.steps.length;
    }
  }
}

export const globalHistoryStore = new HistoryStore();
