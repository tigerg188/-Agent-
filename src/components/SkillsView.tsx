import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  Upload,
  FileCode,
  Github,
  CheckCircle2,
  Trash2,
  Play,
  FileText,
  Folder,
  Eye,
  Plus,
  AlertCircle,
  X,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GitBranch,
  Terminal,
  Compass,
  Cpu,
  RefreshCw,
  Network,
  Wrench,
  Shield,
  ArrowRight,
  BookOpen,
  Search,
  Check,
  AlertTriangle,
  FolderGit2,
  HardDrive,
} from 'lucide-react';
import {
  SkillMetadata,
  SkillProject,
  ProjectDiscoveryResult,
  EnvironmentReport,
  InstallDiagnosticStep,
  CompatibilityLevel,
} from '../types';
import { api } from '../api';

interface SkillsViewProps {
  skills: SkillMetadata[];
  workspaceId: string;
  onRefresh: () => void;
  onRunSkill: (skillId: string) => void;
}

export const SkillsView: React.FC<SkillsViewProps> = ({
  skills,
  workspaceId,
  onRefresh,
  onRunSkill,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'discovery' | 'environment' | 'flat'>('projects');

  // Installed Skill Projects
  const [projects, setProjects] = useState<SkillProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Environment report state
  const [envReport, setEnvReport] = useState<EnvironmentReport | null>(null);
  const [isCheckingEnv, setIsCheckingEnv] = useState(false);
  const [isRepairingEnv, setIsRepairingEnv] = useState(false);

  // Discovery input states
  const [discoverySourceType, setDiscoverySourceType] = useState<'github' | 'local_folder' | 'zip'>('github');
  const [githubUrl, setGithubUrl] = useState('https://github.com/hexiaofeier/hehe-industry-research-skill-pack');
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Pre-installation preview modal state
  const [previewResult, setPreviewResult] = useState<ProjectDiscoveryResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewActiveTab, setPreviewActiveTab] = useState<'overview' | 'graph' | 'intent' | 'files'>('overview');

  // Installation diagnostic logs modal
  const [isInstalling, setIsInstalling] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<InstallDiagnosticStep[]>([]);
  const [installedProjectSuccess, setInstalledProjectSuccess] = useState<SkillProject | null>(null);

  // Project inspect modal (for viewing already installed projects)
  const [inspectingProject, setInspectingProject] = useState<SkillProject | null>(null);
  const [inspectActiveTab, setInspectActiveTab] = useState<'overview' | 'graph' | 'intent' | 'files'>('overview');
  const [inspectSelectedFile, setInspectSelectedFile] = useState<string | null>(null);

  // Status messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load projects and environment on mount
  useEffect(() => {
    loadProjects();
    loadEnvironment();
  }, [workspaceId]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const data = await api.getSkillProjects(workspaceId);
      setProjects(data);
    } catch (e: any) {
      console.error('Failed to load projects', e);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadEnvironment = async () => {
    setIsCheckingEnv(true);
    try {
      const report = await api.getEnvironmentReport();
      setEnvReport(report);
    } catch (e: any) {
      console.error('Failed to load environment report', e);
    } finally {
      setIsCheckingEnv(false);
    }
  };

  const handleRepairEnvironment = async (components?: string[]) => {
    setIsRepairingEnv(true);
    setErrorMessage(null);
    try {
      const comps = components || (envReport?.checks.filter((c) => c.status !== 'READY').map((c) => c.component) || ['python', 'browser']);
      const result = await api.repairEnvironment(comps);
      setSuccessMessage(`环境适配完成：${result.messages.join('；')}`);
      await loadEnvironment();
    } catch (e: any) {
      setErrorMessage(e.message || '环境适配执行异常');
    } finally {
      setIsRepairingEnv(false);
    }
  };

  /**
   * Run Skill Project Discovery (Scan & Interpret without installing)
   */
  const handleStartDiscovery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsDiscovering(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let result: ProjectDiscoveryResult;

      if (discoverySourceType === 'github') {
        if (!githubUrl.trim()) {
          throw new Error('请输入有效的 GitHub 仓库地址');
        }
        result = await api.discoverSkillProject({
          sourceType: 'github',
          source: githubUrl.trim(),
        });
      } else if (discoverySourceType === 'local_folder') {
        if (!localFolderPath.trim()) {
          throw new Error('请输入本地技能项目文件夹的绝对路径');
        }
        result = await api.discoverSkillProject({
          sourceType: 'local_folder',
          source: localFolderPath.trim(),
        });
      } else {
        if (!selectedZipFile) {
          throw new Error('请选择需要勘探分析的 ZIP 技能项目包');
        }
        result = await api.discoverSkillProject({
          sourceType: 'zip',
          file: selectedZipFile,
        });
      }

      setPreviewResult(result);
      setIsPreviewOpen(true);
      setPreviewActiveTab('overview');
      setDiagnosticSteps([]);
      setInstalledProjectSuccess(null);
    } catch (err: any) {
      setErrorMessage(err.message || '项目勘探与解析失败');
    } finally {
      setIsDiscovering(false);
    }
  };

  /**
   * User confirms installation after reviewing analysis preview
   */
  const handleConfirmInstall = async () => {
    if (!previewResult) return;

    setIsInstalling(true);
    setErrorMessage(null);

    // Initial diagnostic setup
    setDiagnosticSteps([
      { step: 'discovery', title: '验证项目勘探拓扑', status: 'in_progress', message: '正在复核项目边界与文件清单...' },
      { step: 'main_entry', title: '确立主入口与子分支', status: 'pending', message: '等待装载...' },
      { step: 'dependencies', title: '工具链与运行时匹配', status: 'pending', message: '等待评估...' },
      { step: 'intent', title: '构建 Runtime Intent 意图模型', status: 'pending', message: '等待生成...' },
      { step: 'persistence', title: '无损持久化至底座技能库', status: 'pending', message: '等待存储...' },
    ]);

    try {
      const res = await api.installSkillProject(previewResult, workspaceId);
      setDiagnosticSteps(res.diagnosticLogs);
      setInstalledProjectSuccess(res.project);
      setSuccessMessage(`项目「${res.project.displayName}」安装成功！已确立主入口及 ${res.project.childSkillsCount} 个专项子分支。`);
      await loadProjects();
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || '项目安装入库失败');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleToggleProject = async (id: string, current: boolean) => {
    await api.toggleSkillProject(id, !current);
    await loadProjects();
    onRefresh();
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (confirm(`确定要移除技能项目「${name}」及其下属所有专项分支吗？（原始文件在本地不会被篡改）`)) {
      await api.deleteSkillProject(id);
      await loadProjects();
      onRefresh();
    }
  };

  const getLevelBadge = (level: CompatibilityLevel) => {
    switch (level) {
      case 'L1':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">L1 纯规范</span>;
      case 'L2':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">L2 多Skill合集</span>;
      case 'L3':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">L3 脚本与依赖</span>;
      case 'L4':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">L4 浏览器与MCP</span>;
      case 'L5':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">L5 复合Workflow</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Positioning Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>通用智能技能执行底座</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-mono">
                V0.2 Runtime
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            核心原则：<span className="text-blue-400 font-semibold">任何Skill，先理解；任何环境，先适配；任何任务，先验证。</span>{' '}
            不强制修改第三方原项目，保持文件原貌，通过智能勘探构建运行时意图 (Runtime Intent) 与拓扑映射。
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'projects'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>技能项目库 ({projects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'discovery'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>项目勘探与导入</span>
          </button>
          <button
            onClick={() => setActiveTab('environment')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'environment'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>底座执行环境</span>
          </button>
          <button
            onClick={() => setActiveTab('flat')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'flat'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>单体规范平铺 ({skills.length})</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== TAB 1: SKILL PROJECTS ==================== */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>已挂载的技能项目 (Skill Projects)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {projects.length} 个
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                项目以独立自治单元维护，清晰标识主入口、专项分支与依赖，不混淆为碎片化散装技能。
              </p>
            </div>

            <button
              onClick={() => setActiveTab('discovery')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>勘探并导入新项目</span>
            </button>
          </div>

          {isLoadingProjects ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span>正在载入技能项目库...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">暂无已挂载的异构 Skill 项目</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  通过上方「项目勘探与导入」可一键解析 GitHub 仓库（如人形机器人产业研究包）、本地文件夹或 ZIP 包。
                </p>
              </div>
              <button
                onClick={() => setActiveTab('discovery')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                前往勘探
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const isPack = project.childSkillsCount > 0;
                const mainEntry = project.projectMap.mainEntry;

                return (
                  <div
                    key={project.id}
                    className={`bg-white rounded-3xl border p-6 flex flex-col justify-between shadow-xs transition-all ${
                      isPack
                        ? 'border-indigo-200/80 bg-gradient-to-b from-indigo-50/20 via-white to-white ring-1 ring-indigo-100 hover:border-indigo-400'
                        : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getLevelBadge(project.compatibility.level)}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              project.sourceType === 'github'
                                ? 'bg-slate-900 text-white'
                                : project.sourceType === 'builtin'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {project.sourceType === 'github'
                              ? 'GitHub'
                              : project.sourceType === 'builtin'
                              ? '内置项目'
                              : project.sourceType === 'local_folder'
                              ? '本地目录'
                              : 'ZIP包'}
                          </span>
                          {isPack && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              <span>{project.childSkillsCount} 个专项分支</span>
                            </span>
                          )}
                        </div>

                        {/* Enable Switch */}
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={project.enabled}
                            onChange={() => handleToggleProject(project.id, project.enabled)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                          <span>{project.displayName || project.name}</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {project.description || project.runtimeIntent.authorIntent}
                        </p>
                      </div>

                      {/* Main Entry Info */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-2xs font-semibold text-slate-400">
                          <span className="flex items-center gap-1 text-indigo-600">
                            <Compass className="w-3 h-3" />
                            <span>主入口 / 总路由</span>
                          </span>
                          <span className="font-mono text-slate-400">{mainEntry.path}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {mainEntry.displayName || mainEntry.name}
                        </div>
                      </div>

                      {/* Child Skills Preview (if pack) */}
                      {isPack && (
                        <div className="space-y-1.5">
                          <div className="text-2xs font-bold text-slate-400 tracking-wider">
                            下属专项技能分支 ({project.projectMap.childSkills.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {project.projectMap.childSkills.slice(0, 4).map((c) => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded-lg text-2xs bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium truncate max-w-[140px]"
                                title={c.description}
                              >
                                {c.displayName || c.name}
                              </span>
                            ))}
                            {project.projectMap.childSkills.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded-lg text-2xs bg-slate-100 text-slate-500">
                                +{project.projectMap.childSkills.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tools & Resources Chips */}
                      <div className="flex items-center gap-3 text-2xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-slate-500" />
                          <span>{project.projectMap.requiredTools.length} 项工具</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3 text-slate-500" />
                          <span>{project.resourcesCount} 项资产文件</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{project.compatibility.status === 'FULL' ? '100% 完整' : '部分就绪'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setInspectingProject(project);
                            setInspectActiveTab('overview');
                            setInspectSelectedFile(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Network className="w-3.5 h-3.5 text-blue-600" />
                          <span>拓扑与意图</span>
                        </button>
                        {project.sourceType !== 'builtin' && (
                          <button
                            onClick={() => handleDeleteProject(project.id, project.displayName)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="卸载此项目"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => onRunSkill(mainEntry.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                        title="唤起 Agent 依本 Skill 项目规划执行"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>规划执行</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: DISCOVERY & IMPORT ==================== */}
      {activeTab === 'discovery' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <span>Skill Project Discovery 技能项目勘探器</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              在安装任何外部 Skill 之前，勘探器将全量扫描其 README、SKILL.md、子分支、脚本、模板与依赖配置文件，
              提炼主入口并构建拓扑关系地图（Skill Project Map 与 Runtime Intent），<span className="font-semibold text-slate-700">绝不修改第三方原始文件</span>。
            </p>
          </div>

          {/* Source Tabs */}
          <div className="flex border-b border-slate-100 gap-6">
            <button
              onClick={() => setDiscoverySourceType('github')}
              className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                discoverySourceType === 'github'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Github className="w-4 h-4" />
              <span>GitHub 仓库地址</span>
            </button>
            <button
              onClick={() => setDiscoverySourceType('local_folder')}
              className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                discoverySourceType === 'local_folder'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span>本地项目文件夹</span>
            </button>
            <button
              onClick={() => setDiscoverySourceType('zip')}
              className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                discoverySourceType === 'zip'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>ZIP 完整项目压缩包</span>
            </button>
          </div>

          {/* Form Controls */}
          {discoverySourceType === 'github' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">GitHub 仓库公开 URL：</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/hexiaofeier/hehe-industry-research-skill-pack"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setGithubUrl('https://github.com/hexiaofeier/hehe-industry-research-skill-pack')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shrink-0"
                  >
                    载入机器人研究合集案例
                  </button>
                </div>
                <p className="text-2xs text-slate-400">
                  支持多技能研究合集包（含 router 总入口与专项深度分析分支）、单体聚焦规范、以及代码依赖型项目。
                </p>
              </div>
            </div>
          )}

          {discoverySourceType === 'local_folder' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">本地文件夹绝对路径：</label>
                <input
                  type="text"
                  value={localFolderPath}
                  onChange={(e) => setLocalFolderPath(e.target.value)}
                  placeholder="/home/user/workspace/my-research-skills"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-2xs text-slate-400">
                  将由底座直接读取该目录下的文件树与结构，分析其依赖与入口，不复制也不修改原始工程。
                </p>
              </div>
            </div>
          )}

          {discoverySourceType === 'zip' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">选择 ZIP 项目包：</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center transition-all bg-slate-50/50">
                  <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setSelectedZipFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="zip-discovery-file"
                  />
                  <label
                    htmlFor="zip-discovery-file"
                    className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 block"
                  >
                    {selectedZipFile ? `已选择：${selectedZipFile.name}` : '点击选择或拖拽 ZIP 文件至此'}
                  </label>
                  <p className="text-2xs text-slate-400 mt-1">支持包含 SKILL.md、references/、templates/、scripts/ 的完整项目包</p>
                </div>
              </div>
            </div>
          )}

          {/* Discovery Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-2xs text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>勘探过程只读且无害，生成分析地图后供您二次确认。</span>
            </div>

            <button
              onClick={handleStartDiscovery}
              disabled={isDiscovering}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {isDiscovering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>勘探中，正在解析全景地图...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>开始勘探与结构解析</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: RUNTIME ENVIRONMENT ==================== */}
      {activeTab === 'environment' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-600" />
                <span>底座执行环境与依赖自检 (Runtime Environment)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                根据「先适配」原则，底座主动侦测主机运行环境、Python 解释器、浏览器自动化内核、MCP 工具总线与模型连通性。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadEnvironment}
                disabled={isCheckingEnv}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEnv ? 'animate-spin' : ''}`} />
                <span>刷新检查</span>
              </button>
              <button
                onClick={() => handleRepairEnvironment()}
                disabled={isRepairingEnv}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>一键环境适配与沙箱自修</span>
              </button>
            </div>
          </div>

          {/* Environment Checks List */}
          {envReport && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 text-xs font-semibold">
                <span className="text-slate-600">整体底座就绪状态：</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    envReport.overallStatus === 'READY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : envReport.overallStatus === 'NEEDS_ATTENTION'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {envReport.overallStatus === 'READY'
                    ? '已完全就绪 (READY)'
                    : envReport.overallStatus === 'NEEDS_ATTENTION'
                    ? '部分待关注 (NEEDS ATTENTION)'
                    : '存在阻塞项 (BLOCKED)'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {envReport.checks.map((check) => {
                  const isOk = check.status === 'READY';
                  return (
                    <div
                      key={check.component}
                      className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                        isOk ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{check.name}</span>
                          <span className="text-2xs font-mono text-slate-400">{check.currentVersion}</span>
                        </div>
                        <p className="text-2xs text-slate-500 leading-relaxed">{check.description}</p>
                        {check.fixAction && (
                          <div className="text-2xs text-indigo-600 font-medium pt-1">
                            建议处理：{check.fixAction}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isOk ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : check.status === 'AUTO_INSTALLABLE' ? (
                          <button
                            onClick={() => handleRepairEnvironment([check.component])}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-2xs font-semibold hover:bg-emerald-700"
                          >
                            配置适配
                          </button>
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: FLAT SKILLS ==================== */}
      {activeTab === 'flat' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              所有细分子技能平铺视图 ({skills.length} 项)
            </h2>
            <span className="text-xs text-slate-400">包含主入口与已展开的所有子技能</span>
          </div>

          <div className="divide-y divide-slate-100">
            {skills.map((skill) => (
              <div key={skill.id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{skill.displayName || skill.name}</span>
                    <span className="text-2xs font-mono text-slate-400">({skill.id})</span>
                    {skill.packName && (
                      <span className="px-1.5 py-0.5 rounded text-2xs bg-indigo-50 text-indigo-700">
                        所属项目：{skill.packName}
                      </span>
                    )}
                    {skill.role === 'router' && (
                      <span className="px-1.5 py-0.5 rounded text-2xs bg-blue-100 text-blue-700 font-semibold">
                        总路由
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-slate-500 line-clamp-1">{skill.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRunSkill(skill.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                  >
                    调用
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== PRE-INSTALL PREVIEW MODAL ==================== */}
      {isPreviewOpen && previewResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold">Skill 项目勘探与理解结果 (安装前预览)</h3>
                  {getLevelBadge(previewResult.compatibilityReport.level)}
                </div>
                <p className="text-xs text-slate-300">
                  项目已由勘探器全景扫描与解析，确立了主入口与依赖图谱。请审阅分析结果后确认是否挂载。
                </p>
              </div>

              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-6 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setPreviewActiveTab('overview')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  previewActiveTab === 'overview'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>项目画像与主入口</span>
              </button>
              <button
                onClick={() => setPreviewActiveTab('graph')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  previewActiveTab === 'graph'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Network className="w-4 h-4" />
                <span>拓扑关系图 (Relationship Graph)</span>
              </button>
              <button
                onClick={() => setPreviewActiveTab('intent')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  previewActiveTab === 'intent'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Runtime Intent (运行意图与自检标准)</span>
              </button>
              <button
                onClick={() => setPreviewActiveTab('files')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  previewActiveTab === 'files'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>扫描文件清单 ({previewResult.scannedFiles.length})</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Tab 1: Overview */}
              {previewActiveTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                        <span>{previewResult.projectMap.projectName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {previewResult.projectMap.projectType}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600">
                        版本：{previewResult.projectMap.version}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-900/80 leading-relaxed">
                      {previewResult.projectMap.projectDescription}
                    </p>
                  </div>

                  {/* Main Entry vs Child Skills */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Main Entry */}
                    <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-bold text-blue-700 tracking-wider flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5" />
                          <span>确立主入口 (MAIN ENTRY / ROUTER)</span>
                        </span>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                          {previewResult.projectMap.mainEntry.role === 'router' ? '总路由中枢' : '核心单入口'}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {previewResult.projectMap.mainEntry.displayName || previewResult.projectMap.mainEntry.name}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {previewResult.projectMap.mainEntry.description}
                      </p>
                      <div className="text-2xs font-mono text-slate-400">
                        规范文件：{previewResult.projectMap.mainEntry.path}
                      </div>
                    </div>

                    {/* Child Skills Summary */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-bold text-slate-600 tracking-wider flex items-center gap-1">
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>下属子技能分支 (CHILD SKILLS)</span>
                        </span>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                          {previewResult.projectMap.childSkills.length} 个
                        </span>
                      </div>
                      {previewResult.projectMap.childSkills.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">单体规范技能，未包含下属分支</p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {previewResult.projectMap.childSkills.map((c) => (
                            <div key={c.id} className="p-2 rounded-xl bg-white border border-slate-100 text-xs flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{c.displayName || c.name}</span>
                              <span className="text-2xs text-indigo-600 font-medium">{c.role}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Supporting Resources & Tools */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="text-2xs font-bold text-slate-400 uppercase">Supporting Resources</div>
                      <div className="text-xs text-slate-700 space-y-1">
                        <div>参考指引: {previewResult.projectMap.supportingResources.references.length} 篇</div>
                        <div>模版文件: {previewResult.projectMap.supportingResources.templates.length} 份</div>
                        <div>工具脚本: {previewResult.projectMap.supportingResources.scripts.length} 个</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="text-2xs font-bold text-slate-400 uppercase">所需外部工具 / MCP</div>
                      <div className="text-xs text-slate-700 space-y-1">
                        {previewResult.projectMap.requiredTools.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-slate-800">
                            <Wrench className="w-3 h-3 text-blue-500" />
                            <span className="truncate">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="text-2xs font-bold text-slate-400 uppercase">环境兼容审计</div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{previewResult.compatibilityReport.levelTitle}</span>
                        </div>
                        <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
                          {previewResult.compatibilityReport.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Relationship Graph */}
              {previewActiveTab === 'graph' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      拓扑结构类型：<span className="font-bold text-slate-900">{previewResult.projectMap.relationshipGraph.structureType}</span>{' '}
                      (主入口统筹调度各子模块协同作业)
                    </div>
                    <span className="text-2xs text-slate-400">无环有向图模型</span>
                  </div>

                  {/* Visual Topology Diagram */}
                  <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-6">
                    {/* Main Entry Node */}
                    <div className="flex justify-center">
                      <div className="p-4 rounded-2xl bg-indigo-600 text-white border-2 border-indigo-400 shadow-lg text-center max-w-sm w-full">
                        <div className="text-2xs uppercase tracking-wider text-indigo-200 font-bold">总入口 / Router</div>
                        <div className="text-sm font-bold mt-0.5">{previewResult.projectMap.mainEntry.displayName || previewResult.projectMap.mainEntry.name}</div>
                        <div className="text-2xs text-indigo-100 font-mono mt-1">{previewResult.projectMap.mainEntry.path}</div>
                      </div>
                    </div>

                    {/* Arrow down */}
                    <div className="flex justify-center">
                      <div className="w-0.5 h-6 bg-indigo-400/50"></div>
                    </div>

                    {/* Child Skills Grid */}
                    {previewResult.projectMap.childSkills.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {previewResult.projectMap.childSkills.map((child) => (
                          <div
                            key={child.id}
                            className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center space-y-1 hover:border-indigo-400 transition-all"
                          >
                            <div className="text-2xs text-indigo-400 font-semibold">{child.role}</div>
                            <div className="text-xs font-bold text-slate-200 truncate">{child.displayName || child.name}</div>
                            <div className="text-2xs text-slate-500 font-mono truncate">{child.path}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-xs text-slate-400">单体规范直连推理与工具链</div>
                    )}

                    {/* Arrow down to Tools */}
                    <div className="flex justify-center">
                      <div className="w-0.5 h-6 bg-indigo-400/50"></div>
                    </div>

                    {/* Tools & Outputs */}
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      {previewResult.projectMap.requiredTools.map((tool, idx) => (
                        <div key={idx} className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-emerald-400 text-2xs font-semibold flex items-center gap-1.5">
                          <Wrench className="w-3 h-3" />
                          <span>{tool}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Runtime Intent */}
              {previewActiveTab === 'intent' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1">
                    <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>作者预期目标 (Author Intent)</span>
                    </div>
                    <p className="text-xs text-purple-950/80 leading-relaxed">
                      {previewResult.runtimeIntent.authorIntent}
                    </p>
                  </div>

                  {/* 4-Step Sequence */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">4步系统化执行次序 (Execution Sequence)：</div>
                    <div className="space-y-2">
                      {previewResult.runtimeIntent.sequence.map((step) => (
                        <div key={step.stepNumber} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-start gap-3 text-xs">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                            {step.stepNumber}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800">{step.title}</div>
                            <div className="text-slate-600">{step.action}</div>
                            <div className="text-2xs text-emerald-600 font-medium">产出预期：{step.expectedOutput}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Verification Standards & Constraints */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>质量与验证标准</span>
                      </div>
                      <div className="space-y-1 text-2xs text-slate-600">
                        {previewResult.runtimeIntent.verification.map((v, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{v.check}: {v.standard}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-600" />
                        <span>约束与边界控制</span>
                      </div>
                      <div className="space-y-1 text-2xs text-slate-600">
                        {previewResult.runtimeIntent.constraints.map((c, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Scanned Files */}
              {previewActiveTab === 'files' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    完整扫描到 {previewResult.scannedFiles.length} 个原始文件，这些文件保持原样，未经任何篡改：
                  </div>
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto text-xs font-mono">
                    {previewResult.scannedFiles.map((file, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <span className="text-slate-800 truncate">{file.path}</span>
                        <span className="text-2xs text-slate-400 shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnostic Logs (if installing or finished) */}
              {diagnosticSteps.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>安装与拓扑挂载进度日志</span>
                  </div>
                  <div className="space-y-2">
                    {diagnosticSteps.map((log, index) => (
                      <div key={index} className="flex items-start gap-2.5 text-xs">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : log.status === 'in_progress' ? (
                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                        ) : log.status === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0 mt-0.5"></div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-200">{log.title}: </span>
                          <span className="text-slate-400">{log.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {previewResult.compatibilityReport.status !== 'FULL' && (
                  <button
                    onClick={() => handleRepairEnvironment()}
                    disabled={isRepairingEnv}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>执行环境适配修复</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold"
                >
                  取消
                </button>

                {installedProjectSuccess ? (
                  <button
                    onClick={() => {
                      setIsPreviewOpen(false);
                      setActiveTab('projects');
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>安装完成，查看项目库</span>
                  </button>
                ) : (
                  <button
                    onClick={handleConfirmInstall}
                    disabled={isInstalling}
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>正在安全挂载至技能底座...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>确认安装入库</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROJECT INSPECT MODAL ==================== */}
      {inspectingProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold">{inspectingProject.displayName || inspectingProject.name}</h3>
                  {getLevelBadge(inspectingProject.compatibility.level)}
                </div>
                <p className="text-xs text-slate-300">
                  主入口：{inspectingProject.projectMap.mainEntry.displayName} | 下属分支：{inspectingProject.childSkillsCount} 个 | 原始资产保留
                </p>
              </div>

              <button
                onClick={() => setInspectingProject(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-6 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setInspectActiveTab('overview')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  inspectActiveTab === 'overview'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>总入口与子分支</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('graph')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  inspectActiveTab === 'graph'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Network className="w-4 h-4" />
                <span>拓扑架构图</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('intent')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  inspectActiveTab === 'intent'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Runtime Intent 执行标准</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('files')}
                className={`py-3.5 border-b-2 flex items-center gap-1.5 transition-all ${
                  inspectActiveTab === 'files'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>原项目文件浏览 ({inspectingProject.originalFiles.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {inspectActiveTab === 'overview' && (
                <div className="space-y-5">
                  {/* Main Entry Details */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-2">
                    <div className="text-2xs font-bold text-blue-700 tracking-wider">项目主入口 / 总路由</div>
                    <div className="text-sm font-bold text-slate-900">
                      {inspectingProject.projectMap.mainEntry.displayName || inspectingProject.projectMap.mainEntry.name}
                    </div>
                    <p className="text-xs text-slate-600">{inspectingProject.projectMap.mainEntry.description}</p>
                    <div className="text-2xs font-mono text-slate-400">规范文件：{inspectingProject.projectMap.mainEntry.path}</div>
                  </div>

                  {/* Child skills list */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">下属专项子分支：</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {inspectingProject.projectMap.childSkills.map((c) => (
                        <div key={c.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{c.displayName || c.name}</span>
                            <span className="text-2xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                              {c.role}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-500 line-clamp-2">{c.description}</p>
                          <div className="text-2xs font-mono text-slate-400 truncate">{c.path}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {inspectActiveTab === 'graph' && (
                <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-6 text-center">
                  <div className="inline-block p-4 rounded-2xl bg-indigo-600 border border-indigo-400 shadow-md">
                    <div className="text-2xs uppercase text-indigo-200 font-bold">总路由主入口</div>
                    <div className="text-sm font-bold mt-0.5">{inspectingProject.projectMap.mainEntry.displayName}</div>
                  </div>

                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-indigo-500"></div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                    {inspectingProject.projectMap.childSkills.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-1">
                        <div className="text-2xs text-indigo-400 font-semibold">{c.role}</div>
                        <div className="text-xs font-bold text-slate-200 truncate">{c.displayName || c.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectActiveTab === 'intent' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-1 text-xs text-indigo-900">
                    <div className="font-bold">作者目标意图：</div>
                    <p className="leading-relaxed">{inspectingProject.runtimeIntent.authorIntent}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">执行流程与交付物：</div>
                    {inspectingProject.runtimeIntent.sequence.map((step) => (
                      <div key={step.stepNumber} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-0.5">
                        <div className="font-bold text-slate-800">{step.stepNumber}. {step.title}</div>
                        <div className="text-slate-600">{step.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectActiveTab === 'files' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs font-mono">
                    {inspectingProject.originalFiles.map((file, idx) => (
                      <div
                        key={idx}
                        onClick={() => setInspectSelectedFile(file.path)}
                        className={`p-2.5 cursor-pointer truncate transition-all ${
                          inspectSelectedFile === file.path ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {file.path}
                      </div>
                    ))}
                  </div>

                  <div className="md:col-span-2 border border-slate-200 rounded-2xl p-4 bg-slate-50 max-h-80 overflow-y-auto text-xs font-mono">
                    {inspectSelectedFile ? (
                      <div>
                        <div className="text-2xs font-bold text-slate-400 mb-2 border-b border-slate-200 pb-1">
                          {inspectSelectedFile}
                        </div>
                        <pre className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                          {inspectingProject.originalFiles.find((f) => f.path === inspectSelectedFile)?.content || '（二进制或空文件）'}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 py-12">点击左侧文件查看原始内容</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setInspectingProject(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold"
              >
                关闭
              </button>

              <button
                onClick={() => {
                  setInspectingProject(null);
                  onRunSkill(inspectingProject.projectMap.mainEntry.id);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>依此项目规划执行</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
