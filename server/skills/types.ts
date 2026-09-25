// Universal Heterogeneous Skill Runtime V0.3.1 ~ V0.3.2 Specification Types

export type CompatibilityLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type CompatibilityStatus = 'FULL' | 'PARTIAL' | 'REPAIRABLE' | 'BLOCKED' | 'UNSUPPORTED' | 'compatible' | 'partial' | 'blocked' | 'unknown';
export type EnvironmentComponentStatus =
  | 'READY'
  | 'AUTO_INSTALLABLE'
  | 'USER_CONFIRMATION_REQUIRED'
  | 'MISSING'
  | 'UNSUPPORTED'
  | 'FAILED';

export type SkillProjectType =
  | 'skill'
  | 'skill-pack'
  | 'agent'
  | 'workflow'
  | 'script-project'
  | 'application'
  | 'hybrid'
  | 'unknown';

export interface EntryCandidate {
  path: string;
  score: number;
  evidence: string[];
  reason: string;
  id?: string;
  name?: string;
  displayName?: string;
  description?: string;
  role?: string;
  contentPreview?: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  path: string;
  type: string;
  description?: string;
  displayName?: string;
  role?: 'router' | 'specialty' | 'standalone' | 'subskill';
  category?: string;
  triggers?: string[];
  inputs?: string[];
  outputs?: string[];
  tools?: string[];
  references?: string[];
  content?: string;
  contentPreview?: string;
}

export interface SkillRelationship {
  from: string;
  to: string;
  type:
    | 'invoke'
    | 'depends_on'
    | 'feeds'
    | 'references'
    | 'delegates_to'
    | 'precedes'
    | 'parallel_with'
    | 'fallback_to';
  origin?: 'declared' | 'inferred';
  confidence: number;
  evidence: string[];
  label?: string;
}

export interface ScriptInfo {
  path: string;
  name: string;
  runtime: 'python' | 'node' | 'bash' | 'unknown';
  size: number;
  executable?: boolean;
}

export interface ResourceInfo {
  path: string;
  name: string;
  size: number;
  type?: string;
}

export interface DependencyInfo {
  name: string;
  type: 'npm' | 'pip' | 'system' | 'env';
  version?: string;
  required: boolean;
}

export interface EnvironmentRequirement {
  runtime: string;
  version?: string;
  required: boolean;
  source: string;
}

export interface ToolRequirement {
  name: string;
  type: 'browser' | 'mcp' | 'script' | 'model' | 'filesystem';
  required: boolean;
  reason?: string;
}

export interface DiscoveryEvidence {
  file: string;
  line?: number;
  snippet: string;
  category: 'entry' | 'relationship' | 'dependency' | 'tool' | 'workflow';
}

export interface CompatibilityProfile {
  level: CompatibilityLevel;
  status: 'compatible' | 'partial' | 'blocked' | 'unknown';
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
  type: 'calls' | 'orchestrates' | 'uses_tool' | 'executes_script' | 'reads_reference' | 'uses_template' | 'produces' | 'invoke' | 'depends_on' | 'feeds' | 'references' | 'delegates_to' | 'precedes' | 'parallel_with' | 'fallback_to';
  origin?: 'declared' | 'inferred';
  label?: string;
  confidence?: number;
  evidence?: string[];
}

export interface RelationshipGraph {
  structureType: 'tree' | 'chain' | 'graph' | 'parallel' | 'conditional';
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  hasCycle?: boolean;
  cycleNodes?: string[];
  topologicalOrder?: string[];
}

export interface InputRequirement {
  name: string;
  type?: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface WorkflowStep {
  stepNumber: number;
  stepId?: string;
  title: string;
  skillOrTool: string;
  action: string;
  expectedOutput: string;
  dependsOn?: string[];
}

export interface OutputRequirement {
  name: string;
  format: string;
  description: string;
  required?: boolean;
}

export interface RuntimeConstraint {
  description: string;
  category: 'data_integrity' | 'safety' | 'temporal' | 'execution_budget';
}

export interface CompletionCondition {
  condition: string;
  standard: string;
}

export interface FailureCondition {
  condition: string;
  handling: string;
}

export interface EvidenceRequirement {
  type: string;
  description: string;
  strictness: 'mandatory' | 'recommended';
}

export interface RuntimeIntent {
  projectId: string;
  task: string;
  goal: string;
  authorIntent?: string;
  inputs: InputRequirement[];
  requiredCapabilities: string[];
  selectedSkills: string[];
  workflow: WorkflowStep[];
  tools: ToolRequirement[];
  expectedOutputs: OutputRequirement[];
  constraints: RuntimeConstraint[];
  completionConditions: CompletionCondition[];
  failureConditions: FailureCondition[];
  evidenceRequirements: EvidenceRequirement[];

  // Legacy compatibility helpers
  methods?: string[];
  skills?: Array<{ id: string; name: string; role: 'router' | 'specialty' | 'subskill' | 'standalone'; purpose: string }>;
  sequence?: Array<{ stepNumber: number; title: string; skillOrTool: string; action: string; expectedOutput: string }>;
  dependencies?: string[];
  outputs?: Array<{ name: string; format: string; description: string }>;
  verification?: Array<{ check: string; standard: string }>;
  risks?: string[];
  completionCriteria?: string[];
}

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

export interface RuntimeVersion {
  version: string;
  path?: string;
  available: boolean;
}

export interface PackageInfo {
  name: string;
  version: string;
  manager: 'npm' | 'pip';
}

export interface EnvironmentProfile {
  os: string;
  architecture: string;
  python?: RuntimeVersion;
  node?: RuntimeVersion;
  npm?: RuntimeVersion;
  git?: RuntimeVersion;
  playwright?: RuntimeVersion;
  libreOffice?: RuntimeVersion;
  sevenZip?: RuntimeVersion;
  availableCommands: string[];
  installedPackages: PackageInfo[];
  browserAvailable: boolean;
  networkAvailable: boolean;
  currentDate: string; // ISO e.g. '2026-09-24'
  currentYear: number; // 2026
  timezone: string;
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

export interface SkillProjectMap {
  projectId: string;
  projectName: string;
  projectType: SkillProjectType;
  projectDescription: string;
  rootDir: string;
  version: string;
  author?: string;
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;

  mainEntry: EntryCandidate | null;
  entryCandidates?: EntryCandidate[];

  entries: SkillEntry[];
  relationships: SkillRelationship[];

  scripts: ScriptInfo[];
  references: ResourceInfo[];
  templates: ResourceInfo[];
  dependencies: DependencyInfo[];

  environment: EnvironmentRequirement[];
  tools: ToolRequirement[];
  evidence: DiscoveryEvidence[];
  compatibility: CompatibilityProfile;

  // Legacy view compatibility
  childSkills?: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string;
    path: string;
    role: 'specialty' | 'subskill' | 'standalone';
    category?: string;
    contentPreview?: string;
  }>;
  supportingResources?: {
    references: Array<{ path: string; size: number; name: string }>;
    templates: Array<{ path: string; size: number; name: string }>;
    examples: Array<{ path: string; size: number; name: string }>;
    scripts: Array<{ path: string; size: number; name: string; runtime: string }>;
    configs: Array<{ path: string; size: number; name: string }>;
  };
  requiredTools?: string[];
  mcpRequirements?: string[];
  browserRequirements?: { needed: boolean; reason?: string };
  externalServices?: string[];
  relationshipGraph: RelationshipGraph;
  installationSteps?: string[];
  executionSteps?: string[];
  outputExpectation?: string[];
  verificationExpectation?: string[];
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
  projectType: SkillProjectType;
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;
  enabled: boolean;
  installedAt: string;
  workspaceId?: string;

  projectMap: SkillProjectMap;
  runtimeIntent: RuntimeIntent;
  compatibility: CompatibilityReport;

  // Stored original files (untouched)
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
    code: ExecutionErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface ExecutionPlan {
  planId?: string;
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
  type: string; // e.g. 'MarketAnalysisArtifact', 'CompanyIntelligenceArtifact', 'MarkdownReport'
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
  researchCutoff: string; // e.g. '2026-09-24'
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

export type ExecutionErrorCode =
  | 'ENVIRONMENT_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'TOOL_ERROR'
  | 'NETWORK_ERROR'
  | 'SKILL_ERROR'
  | 'MODEL_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'GRAPH_ERROR'
  | 'VALIDATION_ERROR';

export interface StepExecutionResult {
  success: boolean;
  output?: unknown;
  artifactIds?: string[];
  error?: {
    code: ExecutionErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
}
