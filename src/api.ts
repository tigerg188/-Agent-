import {
  WorkspaceItem,
  WorkspaceFile,
  SkillMetadata,
  McpServerConfig,
  TaskRecord,
  AutomationTask,
  SystemStatus,
} from './types';

const API_BASE = '/api';

export const api = {
  // Workspaces
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE}/workspaces`);
    const json = await res.json();
    return json.data || [];
  },

  async createWorkspace(code: string, name: string, description: string): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, description }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '创建工作区失败');
    return json.data;
  },

  async getWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files`);
    const json = await res.json();
    return json.data || [];
  },

  async uploadFile(workspaceId: string, file: File): Promise<WorkspaceFile> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '上传文件失败');
    return json.data;
  },

  async deleteFile(workspaceId: string, fileId: string): Promise<void> {
    await fetch(`${API_BASE}/workspaces/${workspaceId}/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  // Skills
  async getSkills(workspaceId?: string): Promise<SkillMetadata[]> {
    const url = workspaceId ? `${API_BASE}/skills?workspaceId=${workspaceId}` : `${API_BASE}/skills`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },

  async uploadSkillZip(file: File, workspaceId?: string): Promise<SkillMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    if (workspaceId) formData.append('workspaceId', workspaceId);
    const res = await fetch(`${API_BASE}/skills/upload-zip`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '上传 ZIP Skill 失败');
    return json.data;
  },

  async uploadSkillMd(content: string, workspaceId?: string): Promise<SkillMetadata> {
    const res = await fetch(`${API_BASE}/skills/upload-md`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, workspaceId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '上传 SKILL.md 失败');
    return json.data;
  },

  async importSkillGithub(repoUrl: string, workspaceId?: string): Promise<SkillMetadata & { count?: number }> {
    const res = await fetch(`${API_BASE}/skills/import-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, workspaceId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '导入 GitHub Skill 失败');
    const skillData = json.data;
    if (json.count) {
      skillData.count = json.count;
    }
    return skillData;
  },

  async toggleSkill(id: string, enabled: boolean): Promise<void> {
    await fetch(`${API_BASE}/skills/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  },

  async deleteSkill(id: string): Promise<void> {
    await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' });
  },

  // MCP
  async getMcp(): Promise<{ servers: McpServerConfig[]; availableTools: any[] }> {
    const res = await fetch(`${API_BASE}/mcp`);
    const json = await res.json();
    return json.data || { servers: [], availableTools: [] };
  },

  async createMcp(server: Partial<McpServerConfig>): Promise<McpServerConfig> {
    const res = await fetch(`${API_BASE}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '创建 MCP 服务失败');
    return json.data;
  },

  async toggleMcp(id: string, enabled: boolean): Promise<void> {
    await fetch(`${API_BASE}/mcp/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  },

  async deleteMcp(id: string): Promise<void> {
    await fetch(`${API_BASE}/mcp/${id}`, { method: 'DELETE' });
  },

  async testMcpTool(toolName: string, args: Record<string, any>, workspaceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/mcp/test-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, args, workspaceId }),
    });
    const json = await res.json();
    return json.data;
  },

  // Browser
  async runBrowserCommand(params: {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
    scrollDirection?: 'up' | 'down';
    scrollAmount?: number;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/browser/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    return json.data;
  },

  async getBrowserState(): Promise<{ currentUrl: string; pageTitle: string; lastScreenshotBase64: string }> {
    const res = await fetch(`${API_BASE}/browser/state`);
    const json = await res.json();
    return json.data;
  },

  // Tasks
  async getTasks(workspaceId?: string): Promise<TaskRecord[]> {
    const url = workspaceId ? `${API_BASE}/tasks?workspaceId=${workspaceId}` : `${API_BASE}/tasks`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },

  async getTask(id: string): Promise<TaskRecord> {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '获取任务失败');
    return json.data;
  },

  async createTask(params: {
    workspaceId: string;
    prompt: string;
    skillMode: 'auto' | 'forced';
    skillId?: string;
    executionMode: string;
    model?: string;
    selectedMcps?: string[];
    attachedFiles?: string[];
  }): Promise<TaskRecord> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '创建并启动任务失败');
    return json.data;
  },

  async stopTask(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/tasks/${id}/stop`, { method: 'POST' });
    const json = await res.json();
    return json.success;
  },

  async approveTask(id: string, approvalId: string, approved: boolean): Promise<void> {
    const res = await fetch(`${API_BASE}/tasks/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId, approved }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '审批提交失败');
  },

  async rerunTask(id: string): Promise<TaskRecord> {
    const res = await fetch(`${API_BASE}/tasks/${id}/rerun`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '重新运行任务失败');
    return json.data;
  },

  getTaskDownloadUrl(id: string, format: 'md' | 'docx' = 'md'): string {
    return `${API_BASE}/tasks/${id}/download?format=${format}`;
  },

  async downloadTaskResult(id: string, format: 'md' | 'docx' = 'md', fallbackFilename?: string): Promise<void> {
    const url = this.getTaskDownloadUrl(id, format);
    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `下载文件失败 (HTTP ${res.status})`);
    }

    const blob = await res.blob();
    let filename = fallbackFilename || `Task-Result.${format}`;
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (standardMatch) {
          filename = standardMatch[1];
        }
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },

  // Automations
  async getAutomations(workspaceId?: string): Promise<AutomationTask[]> {
    const url = workspaceId ? `${API_BASE}/automations?workspaceId=${workspaceId}` : `${API_BASE}/automations`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },

  async createAutomation(params: Partial<AutomationTask>): Promise<AutomationTask> {
    const res = await fetch(`${API_BASE}/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '创建自动化任务失败');
    return json.data;
  },

  async toggleAutomation(id: string, enabled: boolean): Promise<void> {
    await fetch(`${API_BASE}/automations/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
  },

  async deleteAutomation(id: string): Promise<void> {
    await fetch(`${API_BASE}/automations/${id}`, { method: 'DELETE' });
  },

  async triggerAutomation(id: string): Promise<{ success: boolean; taskId?: string }> {
    const res = await fetch(`${API_BASE}/automations/${id}/trigger`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '触发自动化任务失败');
    return json.data;
  },

  // System
  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/system/status`);
    const json = await res.json();
    return json.data;
  },
};
