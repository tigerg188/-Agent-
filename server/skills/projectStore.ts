import {
  SkillProject,
  ProjectDiscoveryResult,
  InstallDiagnosticStep,
  SkillProjectMap,
  RuntimeIntent,
} from './types';
import { globalSkillEngine } from './engine';
import { SkillMetadata } from '../types';
import { globalSkillDb } from '../database/db';

export class SkillProjectStore {
  private projects = new Map<string, SkillProject>();

  constructor() {
    this.loadFromDb();
    this.seedDefaultProjects();
  }

  private loadFromDb() {
    try {
      const persisted = globalSkillDb.listProjects();
      for (const p of persisted) {
        if (p.projectMap) {
          const sp: SkillProject = {
            id: p.id,
            name: p.name,
            displayName: p.displayName || p.name,
            description: p.description || '',
            version: p.version || '1.0.0',
            projectType: p.projectType,
            sourceType: p.sourceType,
            sourceUrl: p.sourceUrl,
            enabled: p.enabled,
            installedAt: p.installedAt,
            projectMap: p.projectMap,
            runtimeIntent: globalSkillDb.getLatestRuntimeIntent(p.id) || (p.projectMap as any).runtimeIntent || {} as any,
            compatibility: p.projectMap.compatibility || {} as any,
            originalFiles: [],
            childSkillsCount: p.childSkillsCount || 0,
            toolsCount: p.toolsCount || 0,
            resourcesCount: p.resourcesCount || 0,
          };
          this.projects.set(p.id, sp);
        }
      }
    } catch (e) {
      console.warn('[SkillProjectStore] Failed to load projects from db:', e);
    }
  }

  private seedDefaultProjects() {
    const builtins = [
      {
        id: 'project-web-research-summary',
        name: 'web-research-summary',
        displayName: '深度网络检索与行业资讯全景整理',
        description: '系统化检索行业、公司、技术或商业事件的公开公开信息，交叉验证数据真伪，输出结构化事实摘要。',
        version: '1.0.0',
        projectType: 'skill' as const,
        skillId: 'web-research-summary',
      },
      {
        id: 'project-contract-review',
        name: 'contract-review',
        displayName: '商业合同条款风险合规审查',
        description: '根据商事法律与合规准则审查合同协议，精准识别违约责任、付款节点、知识产权归属及免责争议条款。',
        version: '1.0.0',
        projectType: 'skill' as const,
        skillId: 'contract-review',
      },
      {
        id: 'project-data-report-extractor',
        name: 'data-report-extractor',
        displayName: '结构化数据提取与表格生成',
        description: '从杂乱网页、文档文本或报告中提取数字指标、表格矩阵与对比参数，清洗整理为规范的 Markdown 表格与 CSV。',
        version: '1.0.0',
        projectType: 'skill' as const,
        skillId: 'data-report-extractor',
      },
    ];

    for (const b of builtins) {
      const skill = globalSkillEngine.getSkillById(b.skillId);
      if (!skill) continue;

      const project: SkillProject = {
        id: b.id,
        name: b.name,
        displayName: b.displayName,
        description: b.description,
        version: b.version,
        projectType: b.projectType,
        sourceType: 'builtin',
        enabled: true,
        installedAt: new Date().toISOString(),
        projectMap: {
          projectId: b.id,
          projectName: b.name,
          projectType: b.projectType,
          projectDescription: b.description,
          rootDir: '',
          version: b.version,
          sourceType: 'builtin',
          mainEntry: {
            id: skill.id,
            name: skill.name,
            displayName: skill.displayName || skill.name,
            path: 'SKILL.md',
            description: skill.description,
            role: 'main',
            contentPreview: skill.content?.slice(0, 300),
            score: 100,
            evidence: ['Builtin primary skill'],
            reason: 'Primary entry definition',
          },
          entries: [
            {
              id: skill.id,
              name: skill.name,
              displayName: skill.displayName || skill.name,
              path: 'SKILL.md',
              type: 'skill',
              description: skill.description,
            },
          ],
          relationships: [],
          scripts: [],
          references: [],
          templates: [],
          childSkills: [],
          supportingResources: {
            references: (skill.files || []).filter((f) => f.path.includes('references/')).map((f) => ({ path: f.path, size: f.size, name: f.path })),
            templates: (skill.files || []).filter((f) => f.path.includes('templates/')).map((f) => ({ path: f.path, size: f.size, name: f.path })),
            examples: (skill.files || []).filter((f) => f.path.includes('examples/')).map((f) => ({ path: f.path, size: f.size, name: f.path })),
            scripts: [],
            configs: [],
          },
          dependencies: [
            { name: 'Node.js', type: 'system', version: '>=18', required: true },
          ],
          environment: [
            { runtime: 'Node.js', version: '>=18', required: true, source: 'system' },
          ],
          tools: [
            { name: 'Web Search', type: 'browser', required: true },
            { name: 'Browser', type: 'browser', required: true },
          ],
          evidence: [],
          compatibility: {
            level: 'L1',
            status: 'compatible',
            summary: '内置核心技能，环境完全就绪。',
            canExecuteLocally: true,
            limitations: [],
            recommendations: [],
          },
          requiredTools: ['Web Search', 'Browser', 'Markdown Processor'],
          mcpRequirements: ['Search MCP', 'Browser MCP'],
          browserRequirements: { needed: true, reason: '检索并访问目标网站' },
          externalServices: ['Gemini 推理服务'],
          relationshipGraph: {
            structureType: 'chain',
            nodes: [
              { id: skill.id, label: skill.displayName || skill.name, type: 'main_entry' },
              { id: 'tool-search', label: 'Search MCP', type: 'mcp' },
              { id: 'tool-browser', label: 'Browser MCP', type: 'mcp' },
            ],
            edges: [
              { from: skill.id, to: 'tool-search', type: 'uses_tool', label: '执行检索' },
              { from: skill.id, to: 'tool-browser', type: 'uses_tool', label: '解析网页' },
            ],
          },
          installationSteps: ['内置技能项目初始化'],
          executionSteps: ['任务理解', '搜索或提取', '结构化分析', '生成报告'],
          outputExpectation: ['Markdown 报告'],
          verificationExpectation: ['格式合规', '数据准确'],
          scannedFilesCount: skill.files?.length || 1,
        },
        runtimeIntent: {
          projectId: b.id,
          task: '',
          goal: b.description,
          authorIntent: b.description,
          inputs: [{ name: '任务需求', description: '待分析的主题或文档', required: true }],
          requiredCapabilities: ['analysis', 'extraction'],
          selectedSkills: [skill.id],
          workflow: [
            { stepNumber: 1, title: '分析目标', skillOrTool: skill.name, action: '解读要求', expectedOutput: '分析大纲' },
            { stepNumber: 2, title: '执行规范', skillOrTool: skill.name, action: '应用 SKILL.md 规则', expectedOutput: '核心结论' },
          ],
          tools: [
            { name: 'Web Search', type: 'browser', required: true },
            { name: 'Browser', type: 'browser', required: true },
          ],
          expectedOutputs: [{ name: '分析成果', format: 'markdown', description: '结构化文档' }],
          constraints: [
            { description: '遵循客观事实', category: 'data_integrity' },
          ],
          completionConditions: [
            { condition: '任务闭环', standard: '完成要求' },
          ],
          failureConditions: [],
          evidenceRequirements: [],
        },
        compatibility: {
          level: 'L1',
          levelTitle: 'L1 纯 Prompt / Markdown 技能规范',
          status: 'FULL',
          summary: '内置核心技能，环境完全就绪。',
          canExecuteLocally: true,
          limitations: [],
          recommendations: [],
        },
        originalFiles: skill.files || [],
        childSkillsCount: 0,
        toolsCount: 2,
        resourcesCount: skill.files?.length || 1,
      };

      this.projects.set(project.id, project);
    }
  }

  listProjects(workspaceId?: string): SkillProject[] {
    const all = Array.from(this.projects.values());
    if (!workspaceId) return all;
    return all.filter((p) => !p.workspaceId || p.workspaceId === workspaceId);
  }

  getProjects(workspaceId?: string): SkillProject[] {
    return this.listProjects(workspaceId);
  }

  getAllProjects(workspaceId?: string): SkillProject[] {
    return this.listProjects(workspaceId);
  }

  getProject(id: string): SkillProject | undefined {
    return this.projects.get(id);
  }

  getProjectById(id: string): SkillProject | undefined {
    return this.projects.get(id);
  }

  async installProject(
    discoveryResult: ProjectDiscoveryResult,
    workspaceId?: string
  ): Promise<{ project: SkillProject; diagnosticLogs: InstallDiagnosticStep[] }> {
    const { projectMap, runtimeIntent, compatibilityReport, scannedFiles } = discoveryResult;
    const diagnosticLogs: InstallDiagnosticStep[] = [];

    // Step 1: Scan & Metadata
    diagnosticLogs.push({
      step: 'metadata',
      title: '项目架构与文件扫描完成',
      status: 'success',
      message: `成功扫描 ${scannedFiles.length} 个文件，判定类型为「${projectMap.projectType}」。`,
    });

    const mainEntryTitle = projectMap.mainEntry
      ? (projectMap.mainEntry.displayName || projectMap.mainEntry.name || projectMap.mainEntry.path)
      : projectMap.projectName;
    const mainEntryRole = projectMap.mainEntry?.role === 'router' ? '总路由入口' : '核心主入口';

    // Step 2: Main entry identification
    diagnosticLogs.push({
      step: 'main_entry',
      title: '主入口识别完成',
      status: 'success',
      message: `确立主入口为「${mainEntryTitle}」（角色：${mainEntryRole}）。`,
    });

    const childSkills = projectMap.childSkills || [];
    // Step 3: Child skills mapping
    diagnosticLogs.push({
      step: 'child_skills',
      title: `下属专项子Skill识别完成 (${childSkills.length} 个)`,
      status: 'success',
      message:
        childSkills.length > 0
          ? `已成功构建子技能图谱，包含：${childSkills.slice(0, 3).map((c) => c.displayName || c.name).join('、')}${childSkills.length > 3 ? ` 等共 ${childSkills.length} 个专项分支` : ''}。`
          : '本项目为单体聚焦技能，无下属子模块。',
    });

    const requiredToolsList = projectMap.requiredTools || projectMap.tools?.map((t) => t.name) || ['基础语言模型'];
    // Step 4: Dependencies and Tools
    diagnosticLogs.push({
      step: 'dependencies',
      title: '依赖与工具链检测完成',
      status: 'success',
      message: `所需工具：${requiredToolsList.join('、')}；环境兼容等级：${compatibilityReport.level}。`,
    });

    // Step 5: Environment check
    diagnosticLogs.push({
      step: 'environment',
      title: '运行环境适配检查完成',
      status: compatibilityReport.status === 'FULL' || compatibilityReport.status === 'compatible' ? 'success' : 'warning',
      message: compatibilityReport.summary,
    });

    const stepSequenceCount = runtimeIntent.sequence?.length || runtimeIntent.workflow?.length || 1;
    // Step 6: Runtime Intent generation
    diagnosticLogs.push({
      step: 'runtime_intent',
      title: 'Runtime Intent (运行时意图) 生成完成',
      status: 'success',
      message: `已解析作者预期目标、${stepSequenceCount} 步执行次序与交付标准，保留原始第三方文件未作任何改动。`,
    });

    // Step 7: Persistence and Registry
    const projectId = `proj-${projectMap.projectId}`;
    const supportingRes = projectMap.supportingResources || {
      references: projectMap.references || [],
      templates: projectMap.templates || [],
      examples: [],
      scripts: projectMap.scripts || [],
      configs: [],
    };

    const skillProject: SkillProject = {
      id: projectId,
      name: projectMap.projectName,
      displayName: projectMap.projectName,
      description: projectMap.projectDescription,
      version: projectMap.version,
      author: projectMap.author,
      projectType: projectMap.projectType,
      sourceType: projectMap.sourceType,
      sourceUrl: projectMap.sourceUrl,
      enabled: true,
      installedAt: new Date().toISOString(),
      workspaceId,
      projectMap,
      runtimeIntent,
      compatibility: compatibilityReport,
      originalFiles: scannedFiles,
      childSkillsCount: childSkills.length,
      toolsCount: (projectMap.tools || []).length,
      resourcesCount:
        (supportingRes.references?.length || 0) +
        (supportingRes.templates?.length || 0) +
        (supportingRes.scripts?.length || 0),
    };

    // Save project in project store
    this.projects.set(projectId, skillProject);
    try {
      globalSkillDb.saveProject(skillProject);
    } catch (e) {
      console.warn('[SkillProjectStore] Failed to save project to db:', e);
    }

    // Register skills in the underlying SkillEngine so Agent Core can immediately match & invoke them!
    this.registerSkillsInEngine(skillProject, scannedFiles, workspaceId);

    diagnosticLogs.push({
      step: 'installation_complete',
      title: '项目完整注册入库',
      status: 'success',
      message: `项目「${skillProject.displayName}」已成功挂载到底座，可直接用于任务规划与执行。`,
    });

    return {
      project: skillProject,
      diagnosticLogs,
    };
  }

  private registerSkillsInEngine(
    project: SkillProject,
    scannedFiles: Array<{ path: string; size: number; isDir: boolean; content?: string }>,
    workspaceId?: string
  ) {
    const { projectMap } = project;
    const childSkills = projectMap.childSkills || [];
    const isPack = childSkills.length > 0;

    const getSkillFile = (skillPath: string) => {
      const match = scannedFiles.find((f) => f.path === skillPath || f.path.endsWith('/' + skillPath));
      return match?.content || '';
    };

    const mainEntryId = projectMap.mainEntry?.id || project.id;
    const mainEntryPath = projectMap.mainEntry?.path || 'SKILL.md';
    const mainEntryName = projectMap.mainEntry?.name || project.name;
    const mainEntryDisplayName = projectMap.mainEntry?.displayName || mainEntryName;
    const mainEntryDesc = projectMap.mainEntry?.description || projectMap.projectDescription;

    // 1. Register Child Skills
    const subSkillsList: any[] = [];
    for (const child of childSkills) {
      const content = getSkillFile(child.path);
      const childSkill: SkillMetadata = {
        id: child.id,
        name: child.name,
        displayName: child.displayName,
        description: child.description,
        version: projectMap.version,
        category: child.category || '专项分支',
        enabled: true,
        workspaceId,
        content,
        packId: project.id,
        packName: project.displayName,
        role: child.role,
        parentSkillId: mainEntryId,
        files: scannedFiles.filter((f) => f.path.startsWith(child.path.replace(/SKILL\.md$/i, ''))),
      };

      (globalSkillEngine as any).skills.set(child.id, childSkill);

      subSkillsList.push({
        id: child.id,
        name: child.name,
        displayName: child.displayName,
        description: child.description,
        role: child.role,
        enabled: true,
        category: child.category,
      });
    }

    // 2. Register Main Entry Skill
    const mainContent = getSkillFile(mainEntryPath);
    const supportingRes = projectMap.supportingResources || {
      references: projectMap.references || [],
      templates: projectMap.templates || [],
      examples: [],
      scripts: projectMap.scripts || [],
      configs: [],
    };

    const mainSkill: SkillMetadata = {
      id: mainEntryId,
      name: mainEntryName,
      displayName: mainEntryDisplayName,
      description: mainEntryDesc,
      version: projectMap.version,
      category: isPack ? '合集总路由' : '独立技能',
      enabled: true,
      workspaceId,
      content: mainContent,
      packId: project.id,
      packName: project.displayName,
      role: projectMap.mainEntry?.role === 'router' ? 'router' : 'standalone',
      isPackMaster: isPack,
      subSkills: subSkillsList,
      hasReferences: (supportingRes.references?.length || 0) > 0,
      hasTemplates: (supportingRes.templates?.length || 0) > 0,
      hasExamples: (supportingRes.examples?.length || 0) > 0,
      hasScripts: (supportingRes.scripts?.length || 0) > 0,
      files: scannedFiles,
    };

    (globalSkillEngine as any).skills.set(mainSkill.id, mainSkill);
  }

  toggleProject(id: string, enabled: boolean): boolean {
    const proj = this.projects.get(id);
    if (!proj) return false;
    proj.enabled = enabled;

    if (proj.projectMap.mainEntry?.id) {
      globalSkillEngine.toggleSkill(proj.projectMap.mainEntry.id, enabled);
    }
    for (const child of proj.projectMap.childSkills || []) {
      globalSkillEngine.toggleSkill(child.id, enabled);
    }
    return true;
  }

  deleteProject(id: string): boolean {
    const proj = this.projects.get(id);
    if (!proj) return false;

    if (proj.projectMap.mainEntry?.id) {
      globalSkillEngine.deleteSkill(proj.projectMap.mainEntry.id);
    }
    for (const child of proj.projectMap.childSkills || []) {
      globalSkillEngine.deleteSkill(child.id);
    }

    try {
      globalSkillDb.deleteProject(id);
    } catch {}

    return this.projects.delete(id);
  }
}

export const globalSkillProjectStore = new SkillProjectStore();
