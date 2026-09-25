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
  role: 'router' | 'specialty' | 'standalone' | 'subskill';
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
  role?: 'router' | 'specialty' | 'standalone' | 'subskill';
  isPackMaster?: boolean;
  parentSkillId?: string;
  subSkills?: SkillSubItem[];
}

// ==================== UNIVERSAL SKILL RUNTIME (V0.2) ====================
export type CompatibilityLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type CompatibilityStatus = 'FULL' | 'PARTIAL' | 'REPAIRABLE' | 'BLOCKED' | 'UNSUPPORTED';
export type EnvironmentComponentStatus =
  | 'READY'
  | 'AUTO_INSTALLABLE'
  | 'USER_CONFIRMATION_REQUIRED'
  | 'MISSING'
  | 'UNSUPPORTED'
  | 'FAILED';

export interface EnvironmentComponentCheck {
  component: string;
  name: string;
  category: 'runtime' | 'browser' | 'mcp' | 'cli' | 'env_var' | 'filesystem';
  status: EnvironmentComponentStatus;
  currentVersion?: string;
  requiredVersion?: string;
  description: string;
  fixAction?: string;
  isOptional?: boolean;
}

export interface EnvironmentReport {
  overallStatus: 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';
  checks: EnvironmentComponentCheck[];
  timestamp: string;
}

export interface CompatibilityReport {
  level: CompatibilityLevel;
  levelTitle: string;
  status: CompatibilityStatus;
  summary: string;
  canExecuteLocally: boolean;
  limitations: string[];
  recommendations: string[];
}

export interface RelationshipNode {
  id: string;
  label: string;
  type: 'main_entry' | 'child_skill' | 'script' | 'tool' | 'mcp' | 'reference' | 'template' | 'output';
  role?: string;
}

export interface RelationshipEdge {
  from: string;
  to: string;
  type: 'calls' | 'orchestrates' | 'uses_tool' | 'executes_script' | 'reads_reference' | 'uses_template' | 'produces';
  label?: string;
}

export interface RelationshipGraph {
  structureType: 'tree' | 'chain' | 'graph' | 'parallel' | 'conditional';
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
}

export interface RuntimeIntent {
  goal: string;
  authorIntent: string;
  inputs: Array<{ name: string; description: string; required: boolean }>;
  methods: string[];
  skills: Array<{ id: string; name: string; role: 'router' | 'specialty' | 'subskill' | 'standalone'; purpose: string }>;
  tools: string[];
  sequence: Array<{ stepNumber: number; title: string; skillOrTool: string; action: string; expectedOutput: string }>;
  dependencies: string[];
  outputs: Array<{ name: string; format: string; description: string }>;
  verification: Array<{ check: string; standard: string }>;
  constraints: string[];
  risks: string[];
  completionCriteria: string[];
}

export interface SkillProjectMap {
  projectId: string;
  projectName: string;
  projectType:
    | 'single_skill'
    | 'skill_pack'
    | 'prompt_skill'
    | 'script_skill'
    | 'agent_workflow'
    | 'mcp_skill'
    | 'browser_skill'
    | 'application_skill'
    | 'hybrid';
  projectDescription: string;
  version: string;
  author?: string;
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;

  mainEntry: {
    id: string;
    name: string;
    displayName: string;
    path: string;
    description: string;
    role: 'router' | 'main';
    contentPreview?: string;
  };

  childSkills: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string;
    path: string;
    role: 'specialty' | 'subskill' | 'standalone';
    category?: string;
    contentPreview?: string;
  }>;

  supportingResources: {
    references: Array<{ path: string; size: number; name: string }>;
    templates: Array<{ path: string; size: number; name: string }>;
    examples: Array<{ path: string; size: number; name: string }>;
    scripts: Array<{ path: string; size: number; name: string; runtime: string }>;
    configs: Array<{ path: string; size: number; name: string }>;
  };

  dependencies: {
    runtime: string[];
    npm: string[];
    pip: string[];
    envVars: string[];
    systemTools: string[];
  };

  requiredTools: string[];
  mcpRequirements: string[];
  browserRequirements: { needed: boolean; reason: string };
  externalServices: string[];

  relationshipGraph: RelationshipGraph;
  installationSteps: string[];
  executionSteps: string[];
  outputExpectation: string[];
  verificationExpectation: string[];

  scannedFilesCount: number;
}

export interface ProjectDiscoveryResult {
  projectMap: SkillProjectMap;
  runtimeIntent: RuntimeIntent;
  compatibilityReport: CompatibilityReport;
  environmentReport: EnvironmentReport;
  scannedFiles: Array<{ path: string; size: number; isDir: boolean; content?: string }>;
}

export interface SkillProject {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  projectType: SkillProjectMap['projectType'];
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;
  enabled: boolean;
  installedAt: string;
  workspaceId?: string;

  projectMap: SkillProjectMap;
  runtimeIntent: RuntimeIntent;
  compatibility: CompatibilityReport;

  originalFiles: Array<{ path: string; size: number; isDir: boolean; content?: string }>;

  childSkillsCount: number;
  toolsCount: number;
  resourcesCount: number;
}

export interface InstallDiagnosticStep {
  step: string;
  title: string;
  status: 'pending' | 'in_progress' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
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

// ==================== V0.3.2 EXECUTION RUNTIME TYPES ====================

export type StepActionType = 'skill' | 'browser' | 'mcp' | 'script' | 'file' | 'model';
export type StepExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ExecutionDependency {
  stepId: string;
  dependsOnStepId: string;
  type: 'hard' | 'soft';
}

export interface ExecutionStep {
  stepId: string;
  skillId?: string;
  skillName?: string;
  title?: string;
  action: StepActionType;
  input: unknown;
  dependsOn: string[];
  expectedOutput?: string;
  status: StepExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  artifactIds?: string[];
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface ExecutionPlan {
  runId: string;
  projectId: string;
  task: string;
  steps: ExecutionStep[];
  dependencies: ExecutionDependency[];
  parallelGroups: string[][];
  expectedArtifacts: string[];
  createdAt: string;
}

export interface Artifact {
  artifactId: string;
  type: string;
  name: string;
  producerStepId: string;
  producerSkillId?: string;
  producerSkillName?: string;
  content: unknown;
  inputArtifactIds: string[];
  evidenceIds: string[];
  confidence?: number;
  status: 'raw' | 'processed' | 'verified' | 'rejected';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ExecutionRun {
  runId: string;
  task: string;
  projectId: string;
  planId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'PLANNED' | 'READY' | 'EXECUTING' | 'OBSERVING' | 'COMPLETED' | 'VERIFIED' | 'FAILED' | 'ABORTED';
  researchCutoff: string;
  error?: string;
  summary?: string;
}

export interface ExecutionTrace {
  traceId: string;
  runId: string;
  stepId: string;
  timestamp: string;
  action: string;
  input?: unknown;
  tool?: string;
  output?: unknown;
  artifactIds: string[];
  durationMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'RETRYING';
  error?: string;
}

export type EvidenceDataType = 'FACT' | 'ESTIMATE' | 'ASSUMPTION' | 'CALCULATION' | 'FORECAST' | 'OPINION';

export interface EvidenceRef {
  evidenceId: string;
  source: string;
  url?: string;
  title?: string;
  publishedAt?: string;
  accessedAt?: string;
  dataDate?: string;
  claim?: string;
  artifactId?: string;
  dataType?: EvidenceDataType;
  hasTemporalConflict?: boolean;
}

