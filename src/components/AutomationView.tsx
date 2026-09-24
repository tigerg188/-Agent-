import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Calendar,
  FileText,
  Puzzle,
  X,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { AutomationTask, SkillMetadata, McpServerConfig } from '../types';
import { api } from '../api';

interface AutomationViewProps {
  automations: AutomationTask[];
  skills: SkillMetadata[];
  mcpServers: McpServerConfig[];
  workspaceId: string;
  onRefresh: () => void;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  automations,
  skills,
  mcpServers,
  workspaceId,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLogsTask, setSelectedLogsTask] = useState<AutomationTask | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scheduleType: 'daily' as 'once' | 'daily' | 'weekly' | 'monthly',
    scheduleTime: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    skillId: skills[0]?.id || 'contract-review',
    prompt: '',
    outputPath: `data/outputs/${workspaceId}/自动成果.md`,
  });

  const handleToggle = async (id: string, current: boolean) => {
    await api.toggleAutomation(id, !current);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此自动化规则吗？')) {
      await api.deleteAutomation(id);
      onRefresh();
    }
  };

  const handleTriggerNow = async (id: string) => {
    setTriggeringId(id);
    try {
      await api.triggerAutomation(id);
      onRefresh();
      alert('已成功触发自动化任务执行！您可在执行日志或任务历史中观察进度。');
    } catch (e: any) {
      alert(`触发失败: ${e.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.prompt) return;

    await api.createAutomation({
      workspaceId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      scheduleType: formData.scheduleType,
      scheduleTime: formData.scheduleTime,
      dayOfWeek: formData.dayOfWeek,
      dayOfMonth: formData.dayOfMonth,
      skillId: formData.skillId,
      skillMode: 'forced',
      prompt: formData.prompt.trim(),
      outputPath: formData.outputPath,
    });

    setShowAddModal(false);
    setFormData({
      name: '',
      description: '',
      scheduleType: 'daily',
      scheduleTime: '08:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      skillId: skills[0]?.id || '',
      prompt: '',
      outputPath: `data/outputs/${workspaceId}/自动成果.md`,
    });
    onRefresh();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <span>简易自动化任务中心 (Scheduled Automation)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            设置每天、每周或一次性定时任务。默认在安全保护模式下执行，高风险操作需审批，且步骤全量留痕记录。
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>添加自动化任务</span>
        </button>
      </div>

      {/* Automation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {automations.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
              item.enabled ? 'border-slate-200 hover:border-emerald-400' : 'border-slate-200 bg-slate-50/50 opacity-60'
            }`}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {item.scheduleType === 'daily' && `每天 ${item.scheduleTime}`}
                      {item.scheduleType === 'weekly' && `每周 (周${item.dayOfWeek}) ${item.scheduleTime}`}
                      {item.scheduleType === 'monthly' && `每月 ${item.dayOfMonth} 日 ${item.scheduleTime}`}
                      {item.scheduleType === 'once' && `一次性定时 ${item.scheduleTime}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(item.id, item.enabled)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                    item.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.enabled ? '运行中' : '已暂停'}
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {item.description || item.prompt}
              </p>

              {/* Task configuration details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-[11px] text-slate-600 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">调用 Skill：</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Puzzle className="w-3 h-3 text-blue-600" />
                    {item.skillId || '自动选择'}
                  </span>
                </div>
                <div className="flex items-center justify-between truncate">
                  <span className="text-slate-400">输出路径：</span>
                  <span className="font-mono text-slate-700 truncate max-w-[200px]">{item.outputPath}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">上次运行：</span>
                  <span className="text-slate-700">
                    {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : '尚未执行'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedLogsTask(item)}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
              >
                <ScrollText className="w-3.5 h-3.5 text-blue-600" />
                <span>执行日志 ({item.executionLogs.length})</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleTriggerNow(item.id)}
                  disabled={triggeringId === item.id}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{triggeringId === item.id ? '正在触发...' : '立即运行'}</span>
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                  title="删除规则"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Automation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>创建自动化任务规则</span>
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
                <label className="font-bold text-slate-900 block mb-1">自动化任务名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：每日上午行业前沿动态检索与报告"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-900 block mb-1">周期频次</label>
                  <select
                    value={formData.scheduleType}
                    onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  >
                    <option value="daily">每天定时</option>
                    <option value="weekly">每周定时</option>
                    <option value="monthly">每月定时</option>
                    <option value="once">一次性定时</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-900 block mb-1">执行具体时间</label>
                  <input
                    type="time"
                    value={formData.scheduleTime}
                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">使用的 Skill 规范</label>
                <select
                  value={formData.skillId}
                  onChange={(e) => setFormData({ ...formData, skillId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                >
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.name} ({s.category || 'Skill'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">任务执行指令 (Prompt)</label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={3}
                  placeholder="输入此自动化触发时 Agent 需自主执行的具体目标..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">输出成果保存位置</label>
                <input
                  type="text"
                  value={formData.outputPath}
                  onChange={(e) => setFormData({ ...formData, outputPath: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono text-[11px]"
                  required
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs"
                >
                  保存规则
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execution Logs Drawer / Modal */}
      {selectedLogsTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    自动化执行留痕日志：{selectedLogsTask.name}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    共记录 {selectedLogsTask.executionLogs.length} 次调度历史
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogsTask(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {selectedLogsTask.executionLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">暂无执行历史日志记录。</div>
              ) : (
                selectedLogsTask.executionLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800">
                        执行时间: {new Date(log.runAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">耗时: {Math.round(log.durationMs / 1000)}s</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status === 'success' ? '成功' : '失败'}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-700">{log.summary}</p>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {log.logText}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
