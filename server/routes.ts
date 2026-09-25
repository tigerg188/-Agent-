import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { globalWorkspaceStore } from './workspace/store';
import { globalSkillEngine } from './skills/engine';
import { globalSkillProjectDiscovery } from './skills/discovery';
import { globalSkillProjectInterpreter } from './skills/interpreter';
import { globalEnvironmentAdapter } from './skills/environment';
import { globalSkillProjectStore } from './skills/projectStore';
import { ProjectDiscoveryResult } from './skills/types';
import { globalMcpManager } from './mcp/manager';
import { globalBrowserAdapter } from './browser/adapter';
import { globalHistoryStore } from './history/store';
import { globalAgentCore } from './agent/core';
import { globalAutomationEngine } from './automation/engine';
import { TaskRecord, ExecutionMode } from './types';
import { convertMarkdownToDocx } from './utils/markdownToDocx';
import { globalRuntimeIntentBuilder } from './skills/runtime-intent';
import { globalSkillPlanner } from './skills/planner';
import { globalSkillOrchestrator } from './skills/orchestrator';
import { globalArtifactBus } from './skills/artifacts';
import { globalExecutionTraceManager } from './skills/execution-trace';
import { globalSkillDb } from './database/db';


const router = express.Router();

// Configure multer for file uploads in memory/disk
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// ==================== WORKSPACE ROUTES ====================
router.get('/workspaces', (req: Request, res: Response) => {
  res.json({ success: true, data: globalWorkspaceStore.getAllWorkspaces() });
});

router.post('/workspaces', (req: Request, res: Response) => {
  const { code, name, description } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, error: '工作区代码与名称为必填项' });
  }
  const ws = globalWorkspaceStore.createWorkspace(code, name, description || '');
  res.json({ success: true, data: ws });
});

router.get('/workspaces/:id/files', (req: Request, res: Response) => {
  const files = globalWorkspaceStore.getFiles(req.params.id);
  res.json({ success: true, data: files });
});

router.post('/workspaces/:id/files', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: '未提供上传文件' });
  }

  const workspaceId = req.params.id;
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  let extractedText = '';

  // Extract text for text/markdown/json/csv
  if (
    file.mimetype.includes('text') ||
    file.mimetype.includes('json') ||
    file.mimetype.includes('csv') ||
    originalName.endsWith('.md') ||
    originalName.endsWith('.txt') ||
    originalName.endsWith('.json') ||
    originalName.endsWith('.csv')
  ) {
    extractedText = file.buffer.toString('utf8');
  } else {
    extractedText = `[二进制/结构化文件：${originalName}，大小：${file.size} 字节]`;
  }

  const newFile = {
    id: `file-${Date.now().toString(36)}`,
    workspaceId,
    name: originalName,
    originalName,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    path: `data/uploads/${originalName}`,
    extractedText,
  };

  globalWorkspaceStore.addFile(workspaceId, newFile);
  res.json({ success: true, data: newFile });
});

router.delete('/workspaces/:id/files/:fileId', (req: Request, res: Response) => {
  globalWorkspaceStore.deleteFile(req.params.id, req.params.fileId);
  res.json({ success: true });
});

// ==================== SKILL PROJECT ROUTES (Universal Skill Runtime V0.2) ====================

// List installed Skill Projects
router.get('/skills/projects', (req: Request, res: Response) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  const projects = globalSkillProjectStore.getAllProjects(workspaceId);
  res.json({ success: true, data: projects });
});

// Get single project detail
router.get('/skills/projects/:id', (req: Request, res: Response) => {
  const project = globalSkillProjectStore.getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, error: '未找到指定的 Skill 项目' });
  }
  res.json({ success: true, data: project });
});

// Toggle project enabled state
router.post('/skills/projects/:id/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const ok = globalSkillProjectStore.toggleProject(req.params.id, Boolean(enabled));
  res.json({ success: ok });
});

// Delete / uninstall project
router.delete('/skills/projects/:id', (req: Request, res: Response) => {
  const ok = globalSkillProjectStore.deleteProject(req.params.id);
  res.json({ success: ok });
});

// Pre-install Project Discovery: Scan & Interpret WITHOUT modifying files or installing
router.post('/skills/project-discover', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const sourceType = (req.body.sourceType || 'github') as 'github' | 'local_folder' | 'zip';
    const source = req.body.source || '';

    let rawDiscovery;

    if (req.file) {
      rawDiscovery = await globalSkillProjectDiscovery.discoverFromZip(req.file.buffer, req.file.originalname);
    } else if (sourceType === 'github') {
      if (!source) {
        return res.status(400).json({ success: false, error: '请提供有效的 GitHub 仓库地址' });
      }
      rawDiscovery = await globalSkillProjectDiscovery.discoverFromGithub(source);
    } else if (sourceType === 'local_folder') {
      if (!source) {
        return res.status(400).json({ success: false, error: '请提供本地文件夹绝对路径' });
      }
      rawDiscovery = await globalSkillProjectDiscovery.discoverFromLocalFolder(source);
    } else {
      return res.status(400).json({ success: false, error: '不支持的项目来源类型' });
    }

    // Interpret structure without altering original files
    const { projectMap, runtimeIntent } = globalSkillProjectInterpreter.interpret(rawDiscovery);

    // Environment & Compatibility inspection
    const envReport = await globalEnvironmentAdapter.checkEnvironment();
    const compatibilityReport = globalEnvironmentAdapter.evaluateCompatibility(projectMap, envReport);

    const discoveryResult: ProjectDiscoveryResult = {
      projectMap,
      runtimeIntent,
      compatibilityReport,
      environmentReport: envReport,
      scannedFiles: rawDiscovery.files,
    };

    res.json({ success: true, data: discoveryResult });
  } catch (err: any) {
    console.error('[Discovery] Project discovery error:', err);
    res.status(400).json({ success: false, error: `项目勘探与解析失败: ${err.message}` });
  }
});

// Project Installation: Confirmed install with step-by-step diagnostic logs
router.post('/skills/project-install', async (req: Request, res: Response) => {
  try {
    const { discoveryResult, workspaceId } = req.body;
    if (!discoveryResult || !discoveryResult.projectMap) {
      return res.status(400).json({ success: false, error: '缺少有效的项目勘探结果 (ProjectDiscoveryResult)' });
    }

    const { project, diagnosticLogs } = await globalSkillProjectStore.installProject(discoveryResult, workspaceId);

    res.json({
      success: true,
      data: {
        project,
        diagnosticLogs,
      },
    });
  } catch (err: any) {
    console.error('[Install] Project install error:', err);
    res.status(500).json({ success: false, error: `项目安装与入库失败: ${err.message}` });
  }
});

// Environment inspect & repair routes
router.get('/skills/environment', async (req: Request, res: Response) => {
  const envReport = await globalEnvironmentAdapter.checkEnvironment();
  res.json({ success: true, data: envReport });
});

router.post('/skills/repair-environment', async (req: Request, res: Response) => {
  const { components } = req.body;
  const result = await globalEnvironmentAdapter.repairEnvironment(components || []);
  res.json({ success: true, data: result });
});

// ==================== UNIVERSAL HETEROGENEOUS SKILL RUNTIME (V0.3.1 ~ V0.3.2) ====================

// Section 18: Get full host EnvironmentProfile
router.get('/skills/runtime/profile', async (req: Request, res: Response) => {
  try {
    const profile = await globalEnvironmentAdapter.getEnvironmentProfile();
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Section 24: Generate DAG ExecutionPlan & RuntimeIntent for task
router.post('/skills/runtime/plan', async (req: Request, res: Response) => {
  try {
    const { task, projectId, researchCutoff } = req.body;
    if (!task) {
      return res.status(400).json({ success: false, error: '请提供研究任务或 Prompt' });
    }

    const project = projectId
      ? globalSkillProjectStore.getProject(projectId)
      : globalSkillProjectStore.getProjects()[0];

    if (!project) {
      return res.status(404).json({ success: false, error: '未找到可用的 Skill 项目' });
    }

    const cutoff = researchCutoff || '2026-09-24';
    const runtimeIntent = globalRuntimeIntentBuilder.build(task, project.projectMap, cutoff);
    const envProfile = await globalEnvironmentAdapter.getEnvironmentProfile();
    const plan = globalSkillPlanner.plan(task, runtimeIntent, project.projectMap, envProfile);

    res.json({
      success: true,
      data: {
        plan,
        runtimeIntent,
        projectMap: project.projectMap,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Section 23 & 26: Execute Plan via DAG Orchestrator
router.post('/skills/runtime/execute', async (req: Request, res: Response) => {
  try {
    const { plan, researchCutoff } = req.body;
    if (!plan || !plan.steps) {
      return res.status(400).json({ success: false, error: '缺少有效的 ExecutionPlan' });
    }

    const result = await globalSkillOrchestrator.executePlan(plan, {
      researchCutoff: researchCutoff || '2026-09-24',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Section 31: List Execution Runs
router.get('/skills/runtime/runs', (req: Request, res: Response) => {
  const runs = globalSkillDb.listExecutionRuns(50);
  res.json({ success: true, data: runs });
});

// Section 31 & 32: Get single run with Traces, Artifacts, Evidence
router.get('/skills/runtime/runs/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  const run = globalSkillDb.getExecutionRun(runId);
  if (!run) {
    return res.status(404).json({ success: false, error: '未找到对应的执行记录' });
  }

  const traces = globalSkillDb.getExecutionTraces(runId);
  const artifacts = globalSkillDb.getArtifacts(runId);
  const evidence = globalSkillDb.getEvidenceRefs(runId);
  const steps = globalSkillDb.getExecutionSteps(runId);

  res.json({
    success: true,
    data: {
      run,
      steps,
      traces,
      artifacts,
      evidence,
    },
  });
});

// Section 30: Trace single artifact upstream and evidence
router.get('/skills/runtime/artifacts/:artifactId/trace', (req: Request, res: Response) => {
  const { artifactId } = req.params;
  const trace = globalArtifactBus.traceArtifact(artifactId);
  res.json({ success: true, data: trace });
});

// ==================== SKILL ROUTES ====================
router.get('/skills', (req: Request, res: Response) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  const skills = globalSkillEngine.getAllSkills(workspaceId);
  res.json({ success: true, data: skills });
});

router.post('/skills/upload-zip', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请选择拟上传的 Skill ZIP 压缩包' });
  }

  const workspaceId = req.body.workspaceId;
  try {
    // Run full Discovery -> Interpreter -> Install workflow automatically for backward-compat
    const rawDiscovery = await globalSkillProjectDiscovery.discoverFromZip(req.file.buffer, req.file.originalname);
    const { projectMap, runtimeIntent } = globalSkillProjectInterpreter.interpret(rawDiscovery);
    const envReport = await globalEnvironmentAdapter.checkEnvironment();
    const compatibilityReport = globalEnvironmentAdapter.evaluateCompatibility(projectMap, envReport);

    const discoveryResult: ProjectDiscoveryResult = {
      projectMap,
      runtimeIntent,
      compatibilityReport,
      environmentReport: envReport,
      scannedFiles: rawDiscovery.files,
    };

    const { project } = await globalSkillProjectStore.installProject(discoveryResult, workspaceId);
    const mainSkillId = project.projectMap.mainEntry
      ? (project.projectMap.entries?.find((e) => e.path === project.projectMap.mainEntry?.path)?.id || project.id)
      : project.id;
    const primarySkill = globalSkillEngine.getSkillById(mainSkillId);
    res.json({ success: true, data: primarySkill, project });
  } catch (e: any) {
    // Fallback to legacy zip import
    const result = await globalSkillEngine.importFromZip(req.file.buffer, workspaceId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.skill });
  }
});

router.post('/skills/upload-md', (req: Request, res: Response) => {
  const { content, workspaceId } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: 'SKILL.md 内容不能为空' });
  }

  const result = globalSkillEngine.importFromMarkdown(content, workspaceId);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result.skill });
});

router.post('/skills/import-github', async (req: Request, res: Response) => {
  const { repoUrl, workspaceId } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ success: false, error: 'GitHub 仓库地址不能为空' });
  }

  try {
    // 1. Run through the new SkillProjectDiscovery & Interpreter pipeline
    const rawDiscovery = await globalSkillProjectDiscovery.discoverFromGithub(repoUrl);
    const { projectMap, runtimeIntent } = globalSkillProjectInterpreter.interpret(rawDiscovery);
    const envReport = await globalEnvironmentAdapter.checkEnvironment();
    const compatibilityReport = globalEnvironmentAdapter.evaluateCompatibility(projectMap, envReport);

    const discoveryResult: ProjectDiscoveryResult = {
      projectMap,
      runtimeIntent,
      compatibilityReport,
      environmentReport: envReport,
      scannedFiles: rawDiscovery.files,
    };

    // 2. Install project into project store
    const { project, diagnosticLogs } = await globalSkillProjectStore.installProject(discoveryResult, workspaceId);
    const mainSkillId = project.projectMap.mainEntry
      ? (project.projectMap.entries?.find((e) => e.path === project.projectMap.mainEntry?.path)?.id || project.id)
      : project.id;
    const primarySkill = globalSkillEngine.getSkillById(mainSkillId);

    return res.json({
      success: true,
      data: primarySkill,
      project,
      diagnosticLogs,
      count: project.childSkillsCount + 1,
    });
  } catch (err: any) {
    console.error('import-github error:', err);
    res.status(500).json({ success: false, error: `拉取与识别 GitHub Skill 异常: ${err.message}` });
  }
});

router.patch('/skills/:id/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const ok = globalSkillEngine.toggleSkill(req.params.id, Boolean(enabled));
  res.json({ success: ok });
});

router.delete('/skills/:id', (req: Request, res: Response) => {
  const ok = globalSkillEngine.deleteSkill(req.params.id);
  res.json({ success: ok });
});

// ==================== MCP ROUTES ====================
router.get('/mcp', (req: Request, res: Response) => {
  const servers = globalMcpManager.getAllServers();
  const availableTools = globalMcpManager.getAvailableTools();
  res.json({ success: true, data: { servers, availableTools } });
});

router.post('/mcp', (req: Request, res: Response) => {
  const { name, type, description, enabled, endpoint } = req.body;
  if (!name || !type) {
    return res.status(400).json({ success: false, error: '名称与类型为必填项' });
  }

  const id = `mcp-${Date.now().toString(36)}`;
  const newServer = {
    id,
    name,
    type,
    description: description || '自定义 MCP 服务',
    enabled: enabled ?? true,
    endpoint,
    tools: [],
    status: (type === 'custom' && !endpoint ? 'unsupported_in_env' : 'ready') as any,
    statusMessage: type === 'custom' && !endpoint ? '未指定有效服务终端' : '服务已注册',
  };

  globalMcpManager.saveServer(newServer);
  res.json({ success: true, data: newServer });
});

router.patch('/mcp/:id/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const ok = globalMcpManager.toggleServer(req.params.id, Boolean(enabled));
  res.json({ success: ok });
});

router.delete('/mcp/:id', (req: Request, res: Response) => {
  const ok = globalMcpManager.deleteServer(req.params.id);
  res.json({ success: ok });
});

router.post('/mcp/test-tool', async (req: Request, res: Response) => {
  const { toolName, args, workspaceId } = req.body;
  if (!toolName) {
    return res.status(400).json({ success: false, error: '必须指定测试的工具名称' });
  }

  const result = await globalMcpManager.executeTool(toolName, args || {}, workspaceId || 'ws-cides');
  res.json({ success: true, data: result });
});

// ==================== BROWSER ROUTES ====================
router.post('/browser/command', async (req: Request, res: Response) => {
  const { action, url, selector, text, scrollDirection, scrollAmount } = req.body;
  const result = await globalBrowserAdapter.executeCommand({
    action,
    url,
    selector,
    text,
    scrollDirection,
    scrollAmount,
  });
  res.json({ success: true, data: result });
});

router.get('/browser/state', (req: Request, res: Response) => {
  const state = globalBrowserAdapter.getCurrentState();
  res.json({ success: true, data: state });
});

// ==================== TASK & AGENT ROUTES ====================
router.get('/tasks', (req: Request, res: Response) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  const tasks = globalHistoryStore.getAllTasks(workspaceId);
  res.json({ success: true, data: tasks });
});

router.get('/tasks/:id', (req: Request, res: Response) => {
  const task = globalHistoryStore.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }
  res.json({ success: true, data: task });
});

router.post('/tasks', async (req: Request, res: Response) => {
  const {
    workspaceId = 'ws-cides',
    prompt,
    skillMode = 'auto',
    skillId,
    executionMode = 'ask_approval',
    model = 'gemini-3.8-flash',
    selectedMcps = ['mcp-browser', 'mcp-web-search', 'mcp-file-doc'],
    attachedFiles = [],
  } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: '任务内容不能为空' });
  }

  const taskId = `task-${Date.now().toString(36)}`;
  const title = prompt.trim().slice(0, 40) + (prompt.length > 40 ? '...' : '');

  const taskRecord: TaskRecord = {
    id: taskId,
    workspaceId,
    title,
    prompt: prompt.trim(),
    model,
    status: 'idle',
    executionMode: executionMode as ExecutionMode,
    skillId: skillMode === 'forced' ? skillId : undefined,
    skillMode,
    selectedMcps,
    attachedFiles,
    steps: [],
    currentStepIndex: 0,
    outputFiles: [],
    createdAt: new Date().toISOString(),
  };

  globalHistoryStore.saveTask(taskRecord);

  // Run in background asynchronously so UI gets taskId immediately
  globalAgentCore.runTask(taskRecord).catch((err: any) => {
    console.error('Task background execution failed:', err);
  });

  res.json({ success: true, data: taskRecord });
});

router.post('/tasks/:id/stop', (req: Request, res: Response) => {
  const ok = globalAgentCore.stopTask(req.params.id);
  res.json({ success: ok });
});

router.post('/tasks/:id/approve', async (req: Request, res: Response) => {
  const { approvalId, approved } = req.body;
  if (!approvalId) {
    return res.status(400).json({ success: false, error: '缺少 approvalId 参数' });
  }

  try {
    await globalAgentCore.handleApproval(req.params.id, approvalId, Boolean(approved));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/tasks/:id/rerun', async (req: Request, res: Response) => {
  const oldTask = globalHistoryStore.getTask(req.params.id);
  if (!oldTask) {
    return res.status(404).json({ success: false, error: '原始任务不存在' });
  }

  const newTaskId = `task-${Date.now().toString(36)}`;
  const newTask: TaskRecord = {
    ...oldTask,
    id: newTaskId,
    status: 'idle',
    steps: [],
    currentStepIndex: 0,
    outputFiles: [],
    approvalRequest: undefined,
    finalResult: undefined,
    error: undefined,
    createdAt: new Date().toISOString(),
    completedAt: undefined,
  };

  globalHistoryStore.saveTask(newTask);

  globalAgentCore.runTask(newTask).catch((err: any) => {
    console.error('Rerun task failed:', err);
  });

  res.json({ success: true, data: newTask });
});

router.get('/tasks/:id/download', async (req: Request, res: Response) => {
  const task = globalHistoryStore.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: '未找到对应任务记录' });
  }

  // Retrieve complete, untruncated content from outputFiles, disk, or finalResult
  let fullContent = task.finalResult || '';
  let baseFilename = (task.title || 'Agent-Report').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 40);

  if (task.outputFiles && task.outputFiles.length > 0) {
    const out0 = task.outputFiles[0];
    const resolvedPath = path.isAbsolute(out0.path) ? out0.path : path.resolve(process.cwd(), out0.path);
    const localCwdPath = path.resolve(process.cwd(), (out0.path || '').replace(/^\//, ''));

    if (out0.content) {
      fullContent = out0.content;
    } else if (fs.existsSync(resolvedPath)) {
      try {
        fullContent = fs.readFileSync(resolvedPath, 'utf8');
      } catch (e) {}
    } else if (fs.existsSync(localCwdPath)) {
      try {
        fullContent = fs.readFileSync(localCwdPath, 'utf8');
      } catch (e) {}
    } else if (out0.previewContent && (!fullContent || fullContent.length < out0.previewContent.length)) {
      fullContent = out0.previewContent;
    }

    if (out0.name) {
      baseFilename = out0.name.replace(/\.(md|docx)$/i, '');
    }
  }

  if (!fullContent) {
    return res.status(404).json({ success: false, error: '该任务暂无可用成果内容' });
  }

  const format = String(req.query.format || 'md').toLowerCase();
  const asciiSafeBase = baseFilename.replace(/[^\x20-\x7E]/g, '_').trim() || 'Agent-Report';

  if (format === 'docx') {
    try {
      const docxBuffer = await convertMarkdownToDocx(fullContent, task.title);
      const filename = `${baseFilename}.docx`;
      const encodedFilename = encodeURIComponent(filename);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeBase}.docx"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Length', docxBuffer.length);
      return res.end(docxBuffer);
    } catch (err: any) {
      console.error('Failed to generate DOCX:', err);
      return res.status(500).json({ success: false, error: `生成 Word (.docx) 失败: ${err.message}` });
    }
  }

  // Default: Full Markdown (.md)
  const filename = `${baseFilename}.md`;
  const encodedFilename = encodeURIComponent(filename);
  const mdBuffer = Buffer.from(fullContent, 'utf8');

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeBase}.md"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader('Content-Length', mdBuffer.length);
  return res.end(mdBuffer);
});

// ==================== AUTOMATION ROUTES ====================
router.get('/automations', (req: Request, res: Response) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  const list = globalAutomationEngine.getAllAutomations(workspaceId);
  res.json({ success: true, data: list });
});

router.post('/automations', (req: Request, res: Response) => {
  const {
    workspaceId = 'ws-cides',
    name,
    description,
    scheduleType = 'daily',
    scheduleTime = '08:00',
    dayOfWeek,
    dayOfMonth,
    skillId,
    skillMode = 'forced',
    prompt,
    mcpIds = ['mcp-browser', 'mcp-web-search'],
    outputPath,
  } = req.body;

  if (!name || !prompt) {
    return res.status(400).json({ success: false, error: '自动化名称与执行指令为必填项' });
  }

  const id = `auto-${Date.now().toString(36)}`;
  const newAuto = {
    id,
    workspaceId,
    name,
    description: description || '',
    scheduleType,
    scheduleTime,
    dayOfWeek,
    dayOfMonth,
    enabled: true,
    skillId,
    skillMode,
    prompt,
    mcpIds,
    outputPath: outputPath || `data/outputs/${workspaceId}/自动成果.md`,
    executionLogs: [],
  };

  globalAutomationEngine.saveAutomation(newAuto);
  res.json({ success: true, data: newAuto });
});

router.patch('/automations/:id/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const ok = globalAutomationEngine.toggleAutomation(req.params.id, Boolean(enabled));
  res.json({ success: ok });
});

router.delete('/automations/:id', (req: Request, res: Response) => {
  const ok = globalAutomationEngine.deleteAutomation(req.params.id);
  res.json({ success: ok });
});

router.post('/automations/:id/trigger', async (req: Request, res: Response) => {
  const result = await globalAutomationEngine.triggerNow(req.params.id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.json({ success: true, data: result });
});

// ==================== SYSTEM STATUS ROUTE ====================
router.get('/system/status', (req: Request, res: Response) => {
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);
  const githubTokenConfigured = Boolean(process.env.GITHUB_TOKEN);

  res.json({
    success: true,
    data: {
      version: '0.1.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      apiKeyConfigured,
      githubTokenConfigured,
      modelDefault: 'gemini-3.8-flash',
      browserEngine: 'Playwright Native Chromium',
      browserEngineReady: true,
      workspacesCount: globalWorkspaceStore.getAllWorkspaces().length,
      skillsCount: globalSkillEngine.getAllSkills().length,
      mcpsCount: globalMcpManager.getAllServers().length,
    },
  });
});

export default router;
