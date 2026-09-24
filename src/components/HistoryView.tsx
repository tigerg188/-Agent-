import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Eye,
  FileText,
  Download,
  Puzzle,
  Search,
  ChevronRight,
} from 'lucide-react';
import { TaskRecord, WorkspaceItem } from '../types';
import { api } from '../api';

interface HistoryViewProps {
  tasks: TaskRecord[];
  workspaces: WorkspaceItem[];
  currentWorkspaceId: string;
  onViewTask: (task: TaskRecord) => void;
  onRerunTask: (task: TaskRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  tasks,
  workspaces,
  currentWorkspaceId,
  onViewTask,
  onRerunTask,
}) => {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);

  const handleDownloadTask = async (task: TaskRecord, format: 'md' | 'docx') => {
    setDownloadingTaskId(`${task.id}-${format}`);
    try {
      await api.downloadTaskResult(task.id, format);
    } catch (err: any) {
      alert(`下载成果失败: ${err.message || '网络异常'}`);
    } finally {
      setDownloadingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesText =
      t.title.toLowerCase().includes(filterText.toLowerCase()) ||
      t.prompt.toLowerCase().includes(filterText.toLowerCase()) ||
      (t.selectedSkill?.name && t.selectedSkill.name.toLowerCase().includes(filterText.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700" />
            <span>任务历史记录与审计归档</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            完整留存所有 Agent 任务的步骤记录、产出物、自验报告与执行参数。支持随时查看成果或一键重跑。
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="搜索任务标题、Prompt 或 Skill 名称..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">状态：</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
          >
            <option value="all">全部状态</option>
            <option value="completed">已完成</option>
            <option value="awaiting_approval">待审批</option>
            <option value="stopped">已停止</option>
            <option value="failed">执行失败</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            暂无匹配的历史执行任务。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">任务标题与目标</th>
                  <th className="py-3 px-4 font-semibold">使用的 Skill</th>
                  <th className="py-3 px-4 font-semibold">状态与审批</th>
                  <th className="py-3 px-4 font-semibold">生成成果</th>
                  <th className="py-3 px-4 font-semibold">执行耗时</th>
                  <th className="py-3 px-4 font-semibold">时间</th>
                  <th className="py-3 px-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-bold text-slate-900 truncate">{task.title}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{task.prompt}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {task.selectedSkill ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <Puzzle className="w-3 h-3 text-blue-600" />
                          {task.selectedSkill.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">通用 Agent</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {task.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          已完成
                        </span>
                      )}
                      {task.status === 'awaiting_approval' && (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                          <AlertCircle className="w-3 h-3" />
                          待用户审批
                        </span>
                      )}
                      {task.status === 'stopped' && (
                        <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          已停止
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-medium border border-rose-200">
                          执行失败
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {task.outputFiles.length > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                          <FileText className="w-3 h-3" />
                          {task.outputFiles[0].name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">无文件</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {task.durationMs ? `${Math.round(task.durationMs / 1000)}s` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(task.createdAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(task.finalResult || task.outputFiles.length > 0) && (
                          <div className="flex items-center gap-1 mr-1">
                            <button
                              onClick={() => handleDownloadTask(task, 'md')}
                              disabled={downloadingTaskId === `${task.id}-md`}
                              title="下载完整 Markdown 源码"
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium rounded border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>.md</span>
                            </button>
                            <button
                              onClick={() => handleDownloadTask(task, 'docx')}
                              disabled={downloadingTaskId === `${task.id}-docx`}
                              title="下载 Microsoft Word 文档 (.docx)"
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold rounded border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>.docx</span>
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => onViewTask(task)}
                          className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded font-medium transition-colors flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>查看</span>
                        </button>
                        <button
                          onClick={() => onRerunTask(task)}
                          title="重新运行此任务"
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
