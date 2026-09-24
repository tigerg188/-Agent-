import React, { useState } from 'react';
import {
  Play,
  Upload,
  FileText,
  Trash2,
  Puzzle,
  Blocks,
  Shield,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  Cpu,
} from 'lucide-react';
import { WorkspaceItem, SkillMetadata, McpServerConfig, ExecutionMode, WorkspaceFile } from '../types';
import { api } from '../api';

interface NewTaskViewProps {
  workspaces: WorkspaceItem[];
  currentWorkspaceId: string;
  skills: SkillMetadata[];
  mcpServers: McpServerConfig[];
  workspaceFiles: WorkspaceFile[];
  preselectedSkillId?: string;
  onStartTask: (params: {
    workspaceId: string;
    prompt: string;
    skillMode: 'auto' | 'forced';
    skillId?: string;
    executionMode: ExecutionMode;
    model: string;
    selectedMcps: string[];
    attachedFiles: string[];
  }) => Promise<void>;
  onRefreshFiles: () => void;
}

export const NewTaskView: React.FC<NewTaskViewProps> = ({
  workspaces,
  currentWorkspaceId,
  skills,
  mcpServers,
  workspaceFiles,
  preselectedSkillId,
  onStartTask,
  onRefreshFiles,
}) => {
  const [selectedWorkspace, setSelectedWorkspace] = useState(currentWorkspaceId);
  const [prompt, setPrompt] = useState('');
  const [skillMode, setSkillMode] = useState<'auto' | 'forced'>(preselectedSkillId ? 'forced' : 'auto');
  const [selectedSkillId, setSelectedSkillId] = useState<string>(preselectedSkillId || (skills[0]?.id || ''));
  const [mcpMode, setMcpMode] = useState<'auto' | 'manual'>('auto');
  const [selectedMcps, setSelectedMcps] = useState<string[]>(['mcp-browser', 'mcp-web-search', 'mcp-file-doc']);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('ask_approval');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const presetPrompts = [
    {
      title: '网络搜索与调研报告',
      text: '打开网络搜索检索“Model Context Protocol 与 Agent Browser 自动化发展”，提取事实并生成 Markdown 调研报告。',
      skillId: 'web-research-summary',
    },
    {
      title: '合同合规审查',
      text: '审查当前工作区中的合同协议文本，重点识别违约责任、付款节点、争议管辖条款并输出合规审查意见书。',
      skillId: 'contract-review',
    },
    {
      title: '网页数据提取与制表',
      text: '打开权威技术站点，抓取页面上的关键指标数据与表格，清洗并格式化为标准 Markdown 表格。',
      skillId: 'data-report-extractor',
    },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const uploaded = await api.uploadFile(selectedWorkspace, file);
      setAttachedFiles((prev) => [...prev, uploaded.name]);
      onRefreshFiles();
    } catch (err: any) {
      setUploadError(err.message || '上传文件失败');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const toggleMcpSelection = (id: string) => {
    setSelectedMcps((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onStartTask({
        workspaceId: selectedWorkspace,
        prompt: prompt.trim(),
        skillMode,
        skillId: skillMode === 'forced' ? selectedSkillId : undefined,
        executionMode,
        model,
        selectedMcps: mcpMode === 'auto' ? ['mcp-browser', 'mcp-web-search', 'mcp-file-doc'] : selectedMcps,
        attachedFiles,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span>新建 Agent 执行任务</span>
          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            自主闭环执行
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          配置目标任务、工作区、技能约束与审批安全级别，Agent 将自动进行分析、工具调用与结果验证。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Task Prompt */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>任务执行指令 (自然语言)</span>
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400">支持详细的多步骤复合任务说明</span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="例如：打开指定网站，搜索关键词，读取搜索结果并保存成 Markdown 文件；或审查工作区合同识别风险条款..."
            className="w-full text-xs text-slate-900 placeholder-slate-400 p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all leading-relaxed"
            required
          />

          {/* Quick presets */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>快捷测试任务预设：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {presetPrompts.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setPrompt(p.text);
                    if (p.skillId) {
                      setSkillMode('forced');
                      setSelectedSkillId(p.skillId);
                    }
                  }}
                  className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 hover:border-blue-300 transition-all text-left"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Workspace & Files */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workspace Select */}
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1.5">
                所属工作区 (Workspace)
              </label>
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    [{ws.code}] {ws.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Select */}
            <div>
              <label className="text-xs font-bold text-slate-900 flex items-center justify-between mb-1.5">
                <span>底层模型 (Model Adapter)</span>
                <span className="text-[10px] text-blue-600 font-normal">Interactions / Gemini SDK</span>
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>gemini-3.8-flash (官方推荐)</span>
              </div>
            </div>
          </div>

          {/* Upload Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-900">
                任务参考附件 / 文档 (可选)
              </label>
              <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? '正在解析上传...' : '上传新文件 (PDF/Word/TXT/MD/ZIP)'}</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.json,.csv,.zip,image/*"
                />
              </label>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-600 mb-2">{uploadError}</p>
            )}

            {/* Workspace existing files selector */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="text-[11px] text-slate-500 mb-2">工作区中可用资料（勾选作为本任务上下文）：</div>
              {workspaceFiles.length === 0 ? (
                <div className="text-xs text-slate-400 italic">当前工作区暂无上传文件。</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workspaceFiles.map((file) => {
                    const isAttached = attachedFiles.includes(file.name);
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          setAttachedFiles((prev) =>
                            isAttached ? prev.filter((n) => n !== file.name) : [...prev, file.name]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isAttached
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        {isAttached ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Skill & MCP Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Skill Selector */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Puzzle className="w-4 h-4 text-blue-600" />
                <span>Skill 规范配置</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setSkillMode('auto')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    skillMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  自动选择
                </button>
                <button
                  type="button"
                  onClick={() => setSkillMode('forced')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    skillMode === 'forced'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  指定 Skill
                </button>
              </div>
            </div>

            {skillMode === 'auto' ? (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Agent 自动识别匹配</span>
                </div>
                <p className="text-[11px] text-blue-700/80 leading-relaxed">
                  Agent 将根据任务 prompt 语义和已启用的 {skills.filter((s) => s.enabled).length} 个技能库自动匹配最佳工作法。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <optgroup label="核心与总路由技能（推荐）">
                    {skills
                      .filter((s) => !s.parentSkillId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.isPackMaster ? `⚡ 【总路由】${s.displayName || s.name}（包含 ${s.subSkills?.length || 0} 个专项）` : `${s.displayName || s.name} (${s.category || 'Skill'})`}
                        </option>
                      ))}
                  </optgroup>
                  {skills.some((s) => s.role === 'specialty' || s.parentSkillId) && (
                    <optgroup label="技能包下属专项分支（精细化单项执行）">
                      {skills
                        .filter((s) => s.role === 'specialty' || s.parentSkillId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            ↳ {s.displayName || s.name} ({s.category || '专项'})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <div className="text-[11px] text-slate-500 px-1">
                  专业或严肃任务推荐选择「强制使用指定 Skill」，严格遵循其 SKILL.md 流程。
                </div>
              </div>
            )}
          </div>

          {/* MCP Selector */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Blocks className="w-4 h-4 text-indigo-600" />
                <span>MCP 工具链配置</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setMcpMode('auto')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    mcpMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  自动选择
                </button>
                <button
                  type="button"
                  onClick={() => setMcpMode('manual')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    mcpMode === 'manual'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  手动指定
                </button>
              </div>
            </div>

            {mcpMode === 'auto' ? (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-800 space-y-1">
                <div className="font-semibold">默认调度全部就绪 MCP 工具链</div>
                <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                  包括 Playwright Browser、Web Search 与工作区文件读写引擎。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {mcpServers.map((server) => (
                  <label
                    key={server.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedMcps.includes(server.id)}
                        onChange={() => toggleMcpSelection(server.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-slate-800">{server.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {server.status === 'ready' ? '可用' : '受限/未配置'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Execution Mode (Approval Mechanics) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>执行与审批模式 (Approval Mechanics)</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Mode 1 */}
            <div
              onClick={() => setExecutionMode('ask_approval')}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                executionMode === 'ask_approval'
                  ? 'border-blue-600 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center justify-between mb-1">
                <span>1. 询问审批 (推荐)</span>
                {executionMode === 'ask_approval' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Agent 在持久化写入、外部调用等中高风险操作前暂停并征询您的同意。
              </p>
            </div>

            {/* Mode 2 */}
            <div
              onClick={() => setExecutionMode('auto_execute')}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                executionMode === 'auto_execute'
                  ? 'border-blue-600 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center justify-between mb-1">
                <span>2. 自动执行</span>
                {executionMode === 'auto_execute' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                低风险与读写自动执行无感知完成，仅极高风险动作进行中断审批。
              </p>
            </div>

            {/* Mode 3 */}
            <div
              onClick={() => setExecutionMode('strictly_safe')}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                executionMode === 'strictly_safe'
                  ? 'border-blue-600 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center justify-between mb-1">
                <span>3. 禁止高风险操作</span>
                {executionMode === 'strictly_safe' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                直接拦截付款、批量删除、公开发布等操作，杜绝任何外部不可逆影响。
              </p>
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isSubmitting ? '正在启动 Agent...' : '开始执行任务'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
