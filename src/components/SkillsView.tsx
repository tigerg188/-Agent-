import React, { useState } from 'react';
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
} from 'lucide-react';
import { SkillMetadata } from '../types';
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
  const [activeTab, setActiveTab] = useState<'all' | 'import'>('all');
  const [viewMode, setViewMode] = useState<'pack' | 'flat'>('pack');
  const [expandedPacks, setExpandedPacks] = useState<Record<string, boolean>>({});
  const [importType, setImportType] = useState<'zip' | 'md' | 'github'>('zip');
  const [mdContent, setMdContent] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected skill modal for inspecting full files and SKILL.md
  const [selectedSkill, setSelectedSkill] = useState<SkillMetadata | null>(null);
  const [modalActiveSubSkillId, setModalActiveSubSkillId] = useState<string | null>(null);

  const togglePackExpand = (skillId: string) => {
    setExpandedPacks((prev) => ({
      ...prev,
      [skillId]: !prev[skillId],
    }));
  };

  // Top level skills in pack mode: standalone skills + master router skills
  const topLevelSkills = skills.filter((s) => !s.parentSkillId);
  const masterPackSkills = skills.filter((s) => s.isPackMaster);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const imported = await api.uploadSkillZip(file, workspaceId);
      setSuccessMessage(`成功导入技能「${imported.displayName || imported.name}」！`);
      onRefresh();
      setActiveTab('all');
    } catch (err: any) {
      setErrorMessage(err.message || 'ZIP 技能解压导入失败');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleMdImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mdContent.trim()) return;

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const imported = await api.uploadSkillMd(mdContent.trim(), workspaceId);
      setSuccessMessage(`成功导入技能「${imported.displayName || imported.name}」！`);
      setMdContent('');
      onRefresh();
      setActiveTab('all');
    } catch (err: any) {
      setErrorMessage(err.message || 'SKILL.md 导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const handleGithubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const imported = await api.importSkillGithub(githubUrl.trim(), workspaceId);
      if (imported.count && imported.count > 1) {
        setSuccessMessage(`成功从 GitHub 导入技能合集包，识别总入口「${imported.displayName || imported.name}」及下属 ${imported.count - 1} 个专项分支！`);
      } else {
        setSuccessMessage(`成功从 GitHub 导入技能「${imported.displayName || imported.name}」！`);
      }
      setGithubUrl('');
      onRefresh();
      setActiveTab('all');
    } catch (err: any) {
      setErrorMessage(err.message || 'GitHub 导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggle = async (skillId: string, current: boolean) => {
    await api.toggleSkill(skillId, !current);
    onRefresh();
  };

  const handleDelete = async (skillId: string) => {
    if (confirm('确定要删除此 Skill 规范吗？')) {
      await api.deleteSkill(skillId);
      onRefresh();
    }
  };

  // Find sub-skill object if inspecting
  const activeModalSkill = modalActiveSubSkillId
    ? skills.find((s) => s.id === modalActiveSubSkillId) || selectedSkill
    : selectedSkill;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-blue-600" />
            <span>Skill 技能管理中心</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Skill 是 Agent 工作的核心方法论与专业规范。支持标准单体 Skill 以及拥有总路由与专项分支的「技能合集包」。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'all' && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs mr-2">
              <button
                onClick={() => setViewMode('pack')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                  viewMode === 'pack'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="层级合集视图：将下属专项归纳到总路由入口内"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>合集包层级 ({topLevelSkills.length})</span>
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="平铺所有技能（含所有下属专项）"
              >
                <span>平铺全部 ({skills.length})</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            技能库
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>导入 Skill</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* View: All Skills */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {/* Display Mode: Pack Hierarchy View (Recommended) */}
          {viewMode === 'pack' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {topLevelSkills.map((skill) => {
                  const isMaster = !!skill.isPackMaster;
                  const hasSubSkills = (skill.subSkills?.length || 0) > 0;
                  const isExpanded = !!expandedPacks[skill.id];

                  return (
                    <div
                      key={skill.id}
                      className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                        isMaster
                          ? 'border-indigo-200 bg-gradient-to-b from-indigo-50/30 to-white hover:border-indigo-400 ring-1 ring-indigo-100 md:col-span-2 lg:col-span-3'
                          : skill.enabled
                          ? 'border-slate-200 hover:border-blue-400'
                          : 'border-slate-200 bg-slate-50/60 opacity-70'
                      }`}
                    >
                      <div>
                        {/* Header info */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-sm font-bold text-slate-900 leading-snug">
                                {skill.displayName || skill.name}
                              </h2>
                              {isMaster && (
                                <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full font-semibold flex items-center gap-1 shadow-2xs">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>技能合集总路由入口</span>
                                </span>
                              )}
                              {skill.packName && (
                                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-200">
                                  {skill.packName}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">id: {skill.name}</span>
                          </div>

                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            isMaster
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {skill.category || '通用'}
                          </span>
                        </div>

                        <p className={`text-xs text-slate-600 leading-relaxed mb-4 ${isMaster ? 'line-clamp-2' : 'line-clamp-3'}`}>
                          {skill.description}
                        </p>

                        {/* Directory structure tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-4">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            SKILL.md
                          </span>
                          {skill.hasReferences && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                              references/
                            </span>
                          )}
                          {skill.hasTemplates && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono">
                              templates/
                            </span>
                          )}
                          {skill.hasExamples && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">
                              examples/
                            </span>
                          )}
                          {skill.hasScripts && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono">
                              scripts/
                            </span>
                          )}

                          {isMaster && hasSubSkills && (
                            <button
                              type="button"
                              onClick={() => togglePackExpand(skill.id)}
                              className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 hover:bg-indigo-200 px-2.5 py-0.5 rounded-md flex items-center gap-1 transition-colors ml-auto"
                            >
                              <GitBranch className="w-3 h-3" />
                              <span>
                                {isExpanded ? '收起专项分支' : `展开下属 ${skill.subSkills!.length} 个专项分支`}
                              </span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Master Router Expandable Sub-Skills List */}
                        {isMaster && hasSubSkills && isExpanded && (
                          <div className="mt-3 mb-4 p-4 bg-white/80 rounded-xl border border-indigo-100 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                                <span>下属专项分支技能清单 ({skill.subSkills!.length} 个)</span>
                              </span>
                              <span className="text-[11px] text-slate-500 font-normal">
                                作为总路由的专业支撑模块，可在总任务中自动调度，亦可独立启动
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {skill.subSkills!.map((sub) => {
                                const fullSub = skills.find((s) => s.id === sub.id) || sub;
                                return (
                                  <div
                                    key={sub.id}
                                    className="p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-indigo-300 transition-all text-xs flex flex-col justify-between group"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-1 mb-1">
                                        <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                          {sub.displayName || sub.name}
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-200/60 text-slate-600 rounded shrink-0">
                                          专项
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                        {sub.description}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50">
                                      <button
                                        onClick={() => {
                                          setSelectedSkill(skill);
                                          setModalActiveSubSkillId(sub.id);
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                                      >
                                        <Eye className="w-2.5 h-2.5" />
                                        <span>查看规范</span>
                                      </button>
                                      <button
                                        onClick={() => onRunSkill(sub.id)}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded font-medium flex items-center gap-0.5"
                                      >
                                        <Play className="w-2.5 h-2.5" />
                                        <span>独立执行</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(skill.id, skill.enabled)}
                            className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                              skill.enabled
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {skill.enabled ? '已启用' : '已禁用'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSkill(skill);
                              setModalActiveSubSkillId(null);
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium px-2 py-1 hover:bg-slate-100 rounded transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>查看{isMaster ? '总路由规范' : '规范'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onRunSkill(skill.id)}
                            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                            title={isMaster ? '以此总路由入口统筹全景调研' : '立即以此 Skill 启动任务'}
                          >
                            <Play className="w-3 h-3" />
                            <span>{isMaster ? '统筹启动研究任务' : '执行'}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(skill.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="删除技能"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display Mode: Flat View */}
          {viewMode === 'flat' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                    skill.isPackMaster
                      ? 'border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/20'
                      : skill.enabled
                      ? 'border-slate-200 hover:border-blue-400'
                      : 'border-slate-200 bg-slate-50/60 opacity-70'
                  }`}
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className="text-sm font-bold text-slate-900 leading-snug">
                            {skill.displayName || skill.name}
                          </h2>
                          {skill.isPackMaster && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-medium">
                              总路由入口
                            </span>
                          )}
                          {skill.role === 'specialty' && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">
                              专项分支
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">id: {skill.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-200 shrink-0">
                        {skill.category || '通用'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                      {skill.description}
                    </p>

                    {/* Directory structure tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        SKILL.md
                      </span>
                      {skill.hasReferences && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                          references/
                        </span>
                      )}
                      {skill.hasTemplates && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono">
                          templates/
                        </span>
                      )}
                      {skill.hasExamples && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">
                          examples/
                        </span>
                      )}
                      {skill.hasScripts && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono">
                          scripts/
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(skill.id, skill.enabled)}
                        className={`text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                          skill.enabled
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {skill.enabled ? '已启用' : '已禁用'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSkill(skill);
                          setModalActiveSubSkillId(null);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-900 font-medium px-2 py-1 hover:bg-slate-100 rounded transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>查看规范</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onRunSkill(skill.id)}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                        title="立即以此 Skill 启动任务"
                      >
                        <Play className="w-3 h-3" />
                        <span>执行</span>
                      </button>
                      <button
                        onClick={() => handleDelete(skill.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="删除技能"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Import Skill */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">导入新的技能执行规范</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                支持标准 ZIP 技能包、SKILL.md 单文件以及 GitHub 技能包仓库（如自动识别 release-manifest.json 结构与总路由入口）。
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setImportType('zip')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  importType === 'zip' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                1. 上传 ZIP 技能包
              </button>
              <button
                type="button"
                onClick={() => setImportType('md')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  importType === 'md' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                2. 上传/粘贴 SKILL.md
              </button>
              <button
                type="button"
                onClick={() => setImportType('github')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  importType === 'github' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                3. GitHub 仓库导入
              </button>
            </div>
          </div>

          {/* 1. ZIP Upload */}
          {importType === 'zip' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 text-center transition-colors bg-slate-50/50">
                <Upload className="w-10 h-10 text-blue-600 mx-auto mb-3" />
                <h3 className="text-xs font-bold text-slate-800">上传标准 Skill ZIP 压缩包</h3>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  系统将自动解压并验证其内部是否包含合规的 <code>SKILL.md</code> 与相关模板。支持单体技能与多分支技能包结构。
                </p>
                <div className="mt-4">
                  <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-2">
                    <span>{isImporting ? '正在解压并识别...' : '选择 ZIP 文件'}</span>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleZipUpload}
                      disabled={isImporting}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 2. Markdown upload/paste */}
          {importType === 'md' && (
            <form onSubmit={handleMdImport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  粘贴或编写 SKILL.md 规范内容
                </label>
                <textarea
                  value={mdContent}
                  onChange={(e) => setMdContent(e.target.value)}
                  placeholder={`---
name: industry-researcher
description: 行业全景调研与商业分析
---

# 行业研究员
## 1. 调研流程规范...`}
                  rows={10}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isImporting || !mdContent.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:bg-slate-300"
                >
                  {isImporting ? '正在解析...' : '确认并导入 Skill'}
                </button>
              </div>
            </form>
          )}

          {/* 3. GitHub repository import */}
          {importType === 'github' && (
            <form onSubmit={handleGithubImport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GitHub 仓库地址（支持完整 Skill Pack 技能包仓库）
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Github className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/hexiaofeier/hehe-industry-research-skill-pack"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isImporting || !githubUrl.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:bg-slate-300 shrink-0"
                  >
                    {isImporting ? '正在拉取与识别...' : '拉取并识别技能包'}
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>智能技能包架构识别引擎</span>
                </div>
                <p>
                  当仓库包含 <code>release-manifest.json</code> 或多级分支时，系统会自动提取主路由入口（如 <code>hehe-industry-researcher</code>）并将其下属的专项分支有机挂载，形成完整的层级化工作流，避免碎片化孤立识别。
                </p>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Puzzle className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {activeModalSkill?.displayName || activeModalSkill?.name}
                    </h3>
                    {activeModalSkill?.isPackMaster && (
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-md font-semibold">
                        总路由入口
                      </span>
                    )}
                    {activeModalSkill?.role === 'specialty' && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-medium">
                        专项分支
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    版本：{activeModalSkill?.version || '1.0.0'} · 分类：{activeModalSkill?.category || '通用'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSkill(null);
                  setModalActiveSubSkillId(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-skills Selector tabs if this is a Master Router Skill */}
            {selectedSkill.isPackMaster && selectedSkill.subSkills && selectedSkill.subSkills.length > 0 && (
              <div className="bg-indigo-50/50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-[11px] font-bold text-indigo-900 shrink-0">合集导航：</span>
                <button
                  type="button"
                  onClick={() => setModalActiveSubSkillId(null)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-all ${
                    !modalActiveSubSkillId
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-100/50'
                  }`}
                >
                  总路由主控 (SKILL.md)
                </button>
                {selectedSkill.subSkills.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setModalActiveSubSkillId(sub.id)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 text-[11px] transition-all ${
                      modalActiveSubSkillId === sub.id
                        ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {sub.displayName || sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-1">技能描述与定位</h4>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {activeModalSkill?.description}
                </p>
              </div>

              {activeModalSkill?.files && activeModalSkill.files.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1.5">包含的文件与资源清单</h4>
                  <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono">
                    {activeModalSkill.files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5 text-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{f.path}</span>
                        </div>
                        <span className="text-slate-400 shrink-0">{f.size} B</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-1.5">SKILL.md 正文规范</h4>
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {activeModalSkill?.content || '暂无内容'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">
                {activeModalSkill?.isPackMaster
                  ? '以此总路由发起任务时，Agent 将自动统筹调用所有下属专项方法。'
                  : '可以针对该专项独立发起深度研究。'}
              </span>
              <button
                onClick={() => {
                  const targetId = activeModalSkill?.id || selectedSkill.id;
                  setSelectedSkill(null);
                  setModalActiveSubSkillId(null);
                  onRunSkill(targetId);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>立即以此 Skill 发起任务</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

