import React, { useState } from 'react';
import {
  Blocks,
  CheckCircle2,
  AlertCircle,
  Play,
  Plus,
  Trash2,
  Globe,
  Search,
  FileText,
  Github,
  Sliders,
  X,
  Code2,
  Terminal,
} from 'lucide-react';
import { McpServerConfig, McpToolDeclaration } from '../types';
import { api } from '../api';

interface McpViewProps {
  servers: McpServerConfig[];
  availableTools: any[];
  workspaceId: string;
  onRefresh: () => void;
}

export const McpView: React.FC<McpViewProps> = ({
  servers,
  availableTools,
  workspaceId,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [inspectServer, setInspectServer] = useState<McpServerConfig | null>(null);
  const [testingTool, setTestingTool] = useState<McpToolDeclaration | null>(null);
  const [testArgs, setTestArgs] = useState<string>('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Form for adding new custom MCP
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as 'browser' | 'search' | 'file' | 'github' | 'custom',
    description: '',
    endpoint: '',
  });

  const getMcpIcon = (type: string) => {
    switch (type) {
      case 'browser':
        return <Globe className="w-5 h-5 text-blue-600" />;
      case 'search':
        return <Search className="w-5 h-5 text-emerald-600" />;
      case 'file':
        return <FileText className="w-5 h-5 text-indigo-600" />;
      case 'github':
        return <Github className="w-5 h-5 text-slate-800" />;
      default:
        return <Blocks className="w-5 h-5 text-purple-600" />;
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await api.toggleMcp(id, !current);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要移除此 MCP 服务配置吗？')) {
      await api.deleteMcp(id);
      onRefresh();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    await api.createMcp({
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim() || '自定义 MCP 服务',
      endpoint: formData.endpoint.trim(),
      enabled: true,
    });

    setShowAddModal(false);
    setFormData({ name: '', type: 'custom', description: '', endpoint: '' });
    onRefresh();
  };

  const handleRunToolTest = async () => {
    if (!testingTool) return;
    setIsTesting(true);
    setTestResult(null);

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(testArgs);
    } catch (e: any) {
      setTestResult({ error: `JSON 参数格式错误: ${e.message}` });
      setIsTesting(false);
      return;
    }

    try {
      const res = await api.testMcpTool(testingTool.name, parsedArgs, workspaceId);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ error: err.message || '测试调用失败' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Blocks className="w-5 h-5 text-indigo-600" />
            <span>MCP 服务管理器 (Model Context Protocol)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            统一管理工具协议服务（Browser, Web Search, File/Document, GitHub, Custom MCP）。
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>添加 MCP 服务</span>
        </button>
      </div>

      {/* Server Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {servers.map((server) => {
          const isReady = server.status === 'ready';
          const isUnsupported = server.status === 'unsupported_in_env';
          const isNeedsConfig = server.status === 'needs_config';

          return (
            <div
              key={server.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                server.enabled ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      {getMcpIcon(server.type)}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{server.name}</h2>
                      <span className="text-[10px] font-mono text-slate-400">
                        类型: {server.type.toUpperCase()} · 传输: {server.transport || 'in_process'}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div>
                    {isReady && (
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已就绪</span>
                      </span>
                    )}
                    {isNeedsConfig && (
                      <span className="text-[10px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>需配置令牌</span>
                      </span>
                    )}
                    {isUnsupported && (
                      <span className="text-[10px] font-medium bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>当前环境暂不支持</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {server.description}
                </p>

                {server.statusMessage && (
                  <div className="text-[11px] p-2 bg-slate-50 rounded-lg text-slate-500 mb-3 border border-slate-100">
                    状态反馈：{server.statusMessage}
                  </div>
                )}

                {/* Tool List Preview */}
                <div className="space-y-1.5 mb-4">
                  <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>暴露工具清单 ({server.tools.length})：</span>
                  </div>
                  {server.tools.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">暂无工具声明</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {server.tools.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => {
                            setTestingTool(t);
                            // Pre-fill test arguments
                            const sample: Record<string, any> = {};
                            if (t.name === 'browser_navigate') sample.url = 'https://news.ycombinator.com';
                            if (t.name === 'browser_search_and_read') sample.keyword = 'Agent';
                            if (t.name === 'file_read_workspace_file') sample.fileName = '自动化测试网站列表.txt';
                            setTestArgs(JSON.stringify(sample, null, 2));
                            setTestResult(null);
                          }}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-md font-mono border border-slate-200 transition-colors flex items-center gap-1"
                        >
                          <span>{t.name}</span>
                          <Play className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleToggle(server.id, server.enabled)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    server.enabled
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {server.enabled ? '启用中' : '已禁用'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setInspectServer(server)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                  >
                    详情配置
                  </button>
                  {server.type === 'custom' && (
                    <button
                      onClick={() => handleDelete(server.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom MCP Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>添加 MCP 服务（中文向导）</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-900 block mb-1">服务名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：公司内部 CRM MCP 服务"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">服务类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="custom">Custom 自定义扩展 MCP</option>
                  <option value="browser">Browser 浏览器 MCP</option>
                  <option value="search">Web / Search 检索 MCP</option>
                  <option value="file">File / Document 文档 MCP</option>
                  <option value="github">GitHub MCP</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">端点 URL 或 SSE 连接串 (可选)</label>
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="http://localhost:8080/sse 或 https://api.example.com/mcp"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">描述说明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="描述此 MCP 提供的业务能力..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs"
                >
                  确认保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Tool Drawer / Modal */}
      {testingTool && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  测试工具调用: <span className="font-mono text-blue-600">{testingTool.name}</span>
                </h3>
              </div>
              <button
                onClick={() => setTestingTool(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {testingTool.description}
              </p>

              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  工具入参 (JSON 格式参数)
                </label>
                <textarea
                  value={testArgs}
                  onChange={(e) => setTestArgs(e.target.value)}
                  rows={4}
                  className="w-full font-mono text-[11px] p-2.5 bg-slate-900 text-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  当前工作区上下文: {workspaceId}
                </span>
                <button
                  onClick={handleRunToolTest}
                  disabled={isTesting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isTesting ? '正在执行工具...' : '发送测试调用'}</span>
                </button>
              </div>

              {testResult && (
                <div>
                  <div className="font-bold text-slate-900 mb-1">执行响应结果：</div>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl max-h-48 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Server Details Modal */}
      {inspectServer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">{inspectServer.name} - 内部配置与工具架构</h3>
              <button
                onClick={() => setInspectServer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-500">内部 JSON 存储规范：</div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs max-h-80 overflow-y-auto">
                {JSON.stringify(inspectServer, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
