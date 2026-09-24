import { AutomationTask, TaskRecord } from '../types';
import { globalAgentCore } from '../agent/core';
import { globalHistoryStore } from '../history/store';

export class AutomationEngine {
  private automations: Map<string, AutomationTask> = new Map();
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initDefaultAutomations();
    this.startScheduler();
  }

  private initDefaultAutomations() {
    const auto1: AutomationTask = {
      id: 'auto-daily-legal-check',
      workspaceId: 'ws-ciw',
      name: '每日合规与新法规政策自动监测',
      description: '每天 08:00 自动运行合规审查 Skill，检查指定官方发布平台是否有最新监管指引并汇总简报。',
      scheduleType: 'daily',
      scheduleTime: '08:00',
      enabled: true,
      skillId: 'contract-review',
      skillMode: 'forced',
      prompt: '检索最新产业合规监管动态与数据跨境安全法规，生成合规指引与风险防范清单。',
      mcpIds: ['mcp-browser', 'mcp-web-search', 'mcp-file-doc'],
      outputPath: 'data/outputs/ws-ciw/每日合规报告.md',
      lastRunAt: new Date(Date.now() - 86400000).toISOString(),
      lastRunStatus: 'success',
      executionLogs: [
        {
          id: 'log-1',
          runAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'success',
          durationMs: 42000,
          taskId: 'task-hist-001',
          summary: '成功执行自动化任务，已抓取最新合规条例并完成结果验证。',
          logText: `[08:00:01] 自动化触发器启动：每日合规与新法规政策自动监测
[08:00:03] 识别 Skill：contract-review (合同合规审查与风险识别)
[08:00:07] 调用 Browser MCP 检索目标站点
[08:00:22] 读取并清洗正文，完成关键要点提取
[08:00:35] 生成 Markdown 成果报告：每日合规报告.md
[08:00:42] 自动化执行自检通过，已归档`,
        },
      ],
    };

    const auto2: AutomationTask = {
      id: 'auto-weekly-market-intel',
      workspaceId: 'ws-cides',
      name: '每周一行业技术前沿情报汇总',
      description: '每周一 09:30 自动调用 Web Research Skill，整理 AI Agent 开源生态与标准协议进展。',
      scheduleType: 'weekly',
      scheduleTime: '09:30',
      dayOfWeek: 1, // Monday
      enabled: true,
      skillId: 'web-research-summary',
      skillMode: 'forced',
      prompt: '打开指定开源平台与学术预印本站点，收集过去一周内 Agent 体系架构与 MCP 协议的演进动向。',
      mcpIds: ['mcp-browser', 'mcp-web-search'],
      outputPath: 'data/outputs/ws-cides/每周情报周报.md',
      executionLogs: [],
    };

    this.automations.set(auto1.id, auto1);
    this.automations.set(auto2.id, auto2);
  }

  getAllAutomations(workspaceId?: string): AutomationTask[] {
    const list = Array.from(this.automations.values());
    if (!workspaceId) return list;
    return list.filter((a) => a.workspaceId === workspaceId);
  }

  getAutomation(id: string): AutomationTask | undefined {
    return this.automations.get(id);
  }

  saveAutomation(task: AutomationTask): void {
    this.automations.set(task.id, task);
  }

  deleteAutomation(id: string): boolean {
    return this.automations.delete(id);
  }

  toggleAutomation(id: string, enabled: boolean): boolean {
    const a = this.automations.get(id);
    if (!a) return false;
    a.enabled = enabled;
    return true;
  }

  /**
   * Manually trigger an automation run immediately
   */
  async triggerNow(id: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const auto = this.automations.get(id);
    if (!auto) {
      return { success: false, error: '自动化任务不存在' };
    }

    const taskId = `task-auto-${Date.now().toString(36)}`;
    const now = new Date();

    const taskRecord: TaskRecord = {
      id: taskId,
      workspaceId: auto.workspaceId,
      title: `[自动化] ${auto.name}`,
      prompt: auto.prompt,
      model: 'gemini-3.8-flash',
      status: 'idle',
      executionMode: 'auto_execute', // Automated tasks default to safe auto execute
      skillId: auto.skillId,
      skillMode: auto.skillMode || 'forced',
      selectedMcps: auto.mcpIds || ['mcp-browser', 'mcp-web-search', 'mcp-file-doc'],
      attachedFiles: [],
      steps: [],
      currentStepIndex: 0,
      outputFiles: [],
      createdAt: now.toISOString(),
    };

    auto.lastRunAt = now.toISOString();
    auto.lastRunStatus = 'running';
    auto.lastRunTaskId = taskId;

    // Run in background and record detailed logs
    (async () => {
      const startTime = Date.now();
      try {
        await globalAgentCore.runTask(taskRecord);
        const duration = Date.now() - startTime;
        auto.lastRunStatus = taskRecord.status === 'completed' ? 'success' : 'failed';

        // Format detailed log
        const logLines = taskRecord.steps.map(
          (s) => `[${s.timestamp.slice(11, 19)}] [${s.stage}] ${s.title}: ${s.description || ''}`
        );

        auto.executionLogs.unshift({
          id: `log-${Date.now()}`,
          runAt: now.toISOString(),
          status: auto.lastRunStatus,
          durationMs: duration,
          taskId,
          summary: taskRecord.finalResult?.slice(0, 100) || '自动化任务执行完毕',
          logText: logLines.join('\n'),
        });

        // Limit log entries to 20
        if (auto.executionLogs.length > 20) {
          auto.executionLogs = auto.executionLogs.slice(0, 20);
        }
      } catch (e: any) {
        auto.lastRunStatus = 'failed';
        auto.executionLogs.unshift({
          id: `log-${Date.now()}`,
          runAt: now.toISOString(),
          status: 'failed',
          durationMs: Date.now() - startTime,
          taskId,
          summary: `执行异常: ${e.message}`,
          logText: `[ERROR] ${e.stack || e.message}`,
        });
      }
    })();

    return { success: true, taskId };
  }

  private startScheduler() {
    // Check every minute for active schedules
    this.intervalTimer = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const currentDayOfWeek = now.getDay();
      const currentDayOfMonth = now.getDate();

      for (const auto of this.automations.values()) {
        if (!auto.enabled) continue;

        let shouldTrigger = false;
        if (auto.scheduleTime === currentTimeStr) {
          if (auto.scheduleType === 'daily') {
            shouldTrigger = true;
          } else if (auto.scheduleType === 'weekly' && auto.dayOfWeek === currentDayOfWeek) {
            shouldTrigger = true;
          } else if (auto.scheduleType === 'monthly' && auto.dayOfMonth === currentDayOfMonth) {
            shouldTrigger = true;
          }
        }

        // Avoid triggering multiple times within the same minute
        if (shouldTrigger && auto.lastRunAt) {
          const lastRun = new Date(auto.lastRunAt);
          if (now.getTime() - lastRun.getTime() < 65000) {
            shouldTrigger = false;
          }
        }

        if (shouldTrigger) {
          this.triggerNow(auto.id);
        }
      }
    }, 60000);
  }
}

export const globalAutomationEngine = new AutomationEngine();
