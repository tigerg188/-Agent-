import fs from 'fs';
import path from 'path';
import { WorkspaceItem, WorkspaceFile } from '../types';

export class WorkspaceStore {
  private workspaces: Map<string, WorkspaceItem> = new Map();
  private files: Map<string, WorkspaceFile[]> = new Map(); // workspaceId -> files
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    this.initDefaultWorkspaces();
  }

  private initDefaultWorkspaces() {
    const defaultWs1: WorkspaceItem = {
      id: 'ws-cides',
      code: 'CIDES',
      name: 'CIDES 战略研究与自动化工作区',
      description: '面向宏观战略调研、多源网络情报搜集与自动化执行流水线的高优先级工作区。',
      createdAt: new Date().toISOString(),
      filesCount: 2,
      skillsCount: 3,
      tasksCount: 0,
    };

    const defaultWs2: WorkspaceItem = {
      id: 'ws-ciw',
      code: 'CIW',
      name: 'CIW 合规与信息审查工作区',
      description: '面向法律文本、商业合同、知识产权及安全合规性严格审查的隔离工作区。',
      createdAt: new Date().toISOString(),
      filesCount: 1,
      skillsCount: 2,
      tasksCount: 0,
    };

    this.workspaces.set(defaultWs1.id, defaultWs1);
    this.workspaces.set(defaultWs2.id, defaultWs2);

    // Add some sample files in CIDES workspace
    this.files.set(defaultWs1.id, [
      {
        id: 'file-sample-1',
        workspaceId: defaultWs1.id,
        name: '2026战略调研需求清单.md',
        originalName: '2026战略调研需求清单.md',
        mimeType: 'text/markdown',
        size: 1420,
        uploadedAt: new Date().toISOString(),
        path: path.join(this.uploadsDir, '2026战略调研需求清单.md'),
        extractedText: '调研目标：重点追踪全球生成式智能体自动化领域的头部技术趋势与开源生态规范。\n要求包含：MCP 协议成熟度、真实 Browser Use 能力与自主规划闭环。',
      },
      {
        id: 'file-sample-2',
        workspaceId: defaultWs1.id,
        name: '自动化测试网站列表.txt',
        originalName: '自动化测试网站列表.txt',
        mimeType: 'text/plain',
        size: 890,
        uploadedAt: new Date().toISOString(),
        path: path.join(this.uploadsDir, '自动化测试网站列表.txt'),
        extractedText: '目标站点：\n1. https://news.ycombinator.com\n2. https://github.com/trending\n3. https://wikipedia.org',
      },
    ]);

    // Add sample file in CIW workspace
    this.files.set(defaultWs2.id, [
      {
        id: 'file-sample-3',
        workspaceId: defaultWs2.id,
        name: '标准云服务采购合同示例.md',
        originalName: '标准云服务采购合同示例.md',
        mimeType: 'text/markdown',
        size: 3200,
        uploadedAt: new Date().toISOString(),
        path: path.join(this.uploadsDir, '标准云服务采购合同示例.md'),
        extractedText: '甲方（采购方）与乙方（云服务商）签订本技术服务协议。\n第8条：乙方应保证服务可用性不低于99.9%。违约赔偿以过去12个月已付服务费总额为上限。\n第12条：涉及知识产权归属甲方所有。',
      },
    ]);
  }

  getAllWorkspaces(): WorkspaceItem[] {
    return Array.from(this.workspaces.values());
  }

  getWorkspace(id: string): WorkspaceItem | undefined {
    return this.workspaces.get(id);
  }

  createWorkspace(code: string, name: string, description: string): WorkspaceItem {
    const id = `ws-${code.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-${Date.now().toString(36)}`;
    const ws: WorkspaceItem = {
      id,
      code: code.toUpperCase(),
      name,
      description,
      createdAt: new Date().toISOString(),
      filesCount: 0,
      skillsCount: 0,
      tasksCount: 0,
    };
    this.workspaces.set(id, ws);
    this.files.set(id, []);
    return ws;
  }

  getFiles(workspaceId: string): WorkspaceFile[] {
    return this.files.get(workspaceId) || [];
  }

  addFile(workspaceId: string, file: WorkspaceFile): void {
    const existing = this.files.get(workspaceId) || [];
    existing.unshift(file);
    this.files.set(workspaceId, existing);

    const ws = this.workspaces.get(workspaceId);
    if (ws) {
      ws.filesCount = existing.length;
    }
  }

  deleteFile(workspaceId: string, fileId: string): boolean {
    const existing = this.files.get(workspaceId) || [];
    const filtered = existing.filter((f) => f.id !== fileId);
    this.files.set(workspaceId, filtered);
    const ws = this.workspaces.get(workspaceId);
    if (ws) {
      ws.filesCount = filtered.length;
    }
    return true;
  }
}

export const globalWorkspaceStore = new WorkspaceStore();
