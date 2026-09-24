export type ViewType =
  | 'dashboard'
  | 'new_task'
  | 'execution'
  | 'skills'
  | 'mcp'
  | 'browser'
  | 'automation'
  | 'history'
  | 'settings';

export type ExecutionMode = 'ask_approval' | 'auto_execute' | 'strictly_safe';

export type TaskStatus =
  | 'idle'
  | 'analyzing'
  | 'skill_selection'
  | 'reading_skill'
  | 'mcp_identification'
  | 'executing_tool'
  | 'awaiting_approval'
  | 'observing_result'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface StepLog {
  id: string;
  stage:
    | 'task_analysis'
    | 'skill_selected'
    | 'skill_loaded'
    | 'mcp_selected'
    | 'tool_call'
    | 'approval_requested'
    | 'approval_response'
    | 'tool_result'
    | 'verification'
    | 'final_result'
    | 'error'
    | 'stopped';
  title: string;
  description?: string;
  timestamp: string;
  durationMs?: number;
  details?: Record<string, any>;
  status: 'pending' | 'in_progress' | 'success' | 'warning' | 'error';
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  actionName: string;
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  parameters: Record<string, any>;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SkillSubItem {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  role: 'router' | 'specialty' | 'standalone';
  enabled: boolean;
  category?: string;
}

export interface SkillMetadata {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  version?: string;
  category?: string;
  enabled: boolean;
  workspaceId?: string;
  hasReferences?: boolean;
  hasExamples?: boolean;
  hasScripts?: boolean;
  hasTemplates?: boolean;
  content: string;
  files?: Array<{ path: string; size: number; isDir: boolean; content?: string }>;

  // Hierarchical Skill Pack support
  packId?: string;
  packName?: string;
  role?: 'router' | 'specialty' | 'standalone';
  isPackMaster?: boolean;
  parentSkillId?: string;
  subSkills?: SkillSubItem[];
}

export interface McpToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  riskLevel: 'low' | 'medium' | 'high';
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: 'browser' | 'search' | 'file' | 'github' | 'custom';
  description: string;
  enabled: boolean;
  endpoint?: string;
  transport?: 'stdio' | 'sse' | 'in_process';
  authConfig?: Record<string, string>;
  tools: McpToolDeclaration[];
  status: 'ready' | 'unsupported_in_env' | 'needs_config' | 'error';
  statusMessage?: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
  filesCount: number;
  skillsCount: number;
  tasksCount: number;
}

export interface WorkspaceFile {
  id: string;
  workspaceId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  path: string;
  extractedText?: string;
}

export interface TaskRecord {
  id: string;
  workspaceId: string;
  title: string;
  prompt: string;
  model: string;
  status: TaskStatus;
  executionMode: ExecutionMode;
  skillId?: string;
  skillMode: 'auto' | 'forced';
  selectedSkill?: {
    id: string;
    name: string;
    description: string;
  };
  selectedMcps: string[];
  attachedFiles: string[];
  steps: StepLog[];
  currentStepIndex: number;
  approvalRequest?: ApprovalRequest;
  browserSession?: {
    currentUrl?: string;
    lastScreenshot?: string;
    title?: string;
    domSummary?: string;
  };
  outputFiles: Array<{
    name: string;
    path: string;
    size: number;
    mimeType: string;
    previewContent?: string;
    content?: string;
  }>;
  finalResult?: string;
  verificationReport?: {
    passed: boolean;
    summary: string;
    checks: Array<{ name: string; passed: boolean; message: string }>;
  };
  error?: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface AutomationTask {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly';
  scheduleTime: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  enabled: boolean;
  skillId?: string;
  skillMode: 'auto' | 'forced';
  prompt: string;
  mcpIds: string[];
  outputPath: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastRunTaskId?: string;
  executionLogs: Array<{
    id: string;
    runAt: string;
    status: 'success' | 'failed';
    durationMs: number;
    taskId: string;
    summary: string;
    logText: string;
  }>;
}

export interface SystemStatus {
  version: string;
  nodeEnv: string;
  apiKeyConfigured: boolean;
  githubTokenConfigured: boolean;
  modelDefault: string;
  browserEngine: string;
  browserEngineReady: boolean;
  workspacesCount: number;
  skillsCount: number;
  mcpsCount: number;
}
