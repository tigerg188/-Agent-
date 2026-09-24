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
  levelTitle: string; // e.g. "L2 多Skill / 技能合集包"
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

  // Stored original files (untouched)
  originalFiles: Array<{ path: string; size: number; isDir: boolean; content?: string }>;

  // Quick stats
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
