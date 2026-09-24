import React from 'react';
import {
  PlusCircle,
  Puzzle,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock3,
  Globe,
  FileText,
  AlertCircle,
  Play,
  RotateCcw,
  Download,
} from 'lucide-react';
import { ViewType, TaskRecord, SkillMetadata, AutomationTask, WorkspaceItem } from '../types';
import { api } from '../api';

interface DashboardViewProps {
  currentWorkspace: WorkspaceItem;
  skills: SkillMetadata[];
  automations: AutomationTask[];
  recentTasks: TaskRecord[];
  onNavigate: (view: ViewType) => void;
  onSelectSkillForTask: (skillId: string) => void;
  onViewTask: (task: TaskRecord) => void;
  onRerunTask: (task: TaskRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentWorkspace,
  skills,
  automations,
  recentTasks,
  onNavigate,
  onSelectSkillForTask,
  onViewTask,
  onRerunTask,
}) => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-medium mb-3 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>当前工作区：[{currentWorkspace.code}] {currentWorkspace.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">个人智能 Agent 工作台</h1>
          <p className="text-slate-300 text-xs mt-1.5 max-w-xl leading-relaxed">
            “告诉 AI 我要完成什么，AI 自己选择 Skill、工具和浏览器操作，把任务真正完成。”
            <br />
            核心链路：<span className="text-blue-300 font-mono font-semibold">Skill + MCP + Agent + Browser + Automation</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('new_task')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>新建任务</span>
          </button>
        </div>
      </div>

      {/* 首页中央只突出三个核心入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 入口一：新建任务 */}
        <div
          onClick={() => onNavigate('new_task')}
          className="group relative bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>新建任务</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              输入自然语言需求，附带工作区资料，由主 Agent 自主规划并调度工具闭环完成。
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>支持自动推断或指定 Skill</span>
            <span className="text-blue-600 font-medium">即刻开始 →</span>
          </div>
        </div>

        {/* 入口二：从 Skill 开始 */}
        <div
          onClick={() => onNavigate('skills')}
          className="group relative bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Puzzle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>从 Skill 开始</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              根据业务场景（网络调研、合同审查、数据提取）挑选专业技能规范，精准引导执行。
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>已内置 {skills.length} 个标准化企业技能</span>
            <span className="text-indigo-600 font-medium">浏览技能库 →</span>
          </div>
        </div>

        {/* 入口三：自动化任务 */}
        <div
          onClick={() => onNavigate('automation')}
          className="group relative bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>自动化任务</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              设定每日/每周循环执行规则，全天候自动搜集情报、合规审计并归档执行日志。
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>活跃日程: {automations.filter((a) => a.enabled).length} 条</span>
            <span className="text-emerald-600 font-medium">配置日程 →</span>
          </div>
        </div>
      </div>

      {/* Recommended Skills Showcase */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">推荐业务 Skill 规范</h3>
          </div>
          <button
            onClick={() => onNavigate('skills')}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            查看全部技能 ({skills.length})
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {skills.slice(0, 3).map((skill) => (
            <div
              key={skill.id}
              className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900">{skill.displayName || skill.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                    {skill.category || 'Skill'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                  {skill.description}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">结构: SKILL.md + 模板</span>
                <button
                  onClick={() => onSelectSkillForTask(skill.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  <span>启用执行</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Executed Tasks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">近期执行任务</h3>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            全部历史记录
          </button>
        </div>

        {recentTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            当前工作区暂无历史任务。点击上方【新建任务】开始执行。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">任务标题</th>
                  <th className="py-2.5 px-3 font-semibold">使用的 Skill</th>
                  <th className="py-2.5 px-3 font-semibold">执行状态</th>
                  <th className="py-2.5 px-3 font-semibold">生成成果</th>
                  <th className="py-2.5 px-3 font-semibold">创建时间</th>
                  <th className="py-2.5 px-3 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTasks.slice(0, 5).map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-xs truncate">
                      {task.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {task.selectedSkill ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <Puzzle className="w-3 h-3 text-blue-600" />
                          {task.selectedSkill.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">通用 Agent</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {task.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          已完成
                        </span>
                      )}
                      {task.status === 'awaiting_approval' && (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                          <AlertCircle className="w-3 h-3" />
                          待审批
                        </span>
                      )}
                      {(task.status === 'executing_tool' || task.status === 'analyzing') && (
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] font-medium border border-blue-200 animate-pulse">
                          <Play className="w-3 h-3" />
                          执行中
                        </span>
                      )}
                      {task.status === 'stopped' && (
                        <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                          已停止
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-medium border border-rose-200">
                          执行失败
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {task.outputFiles.length > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                          <FileText className="w-3 h-3" />
                          {task.outputFiles[0].name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">无生成文件</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(task.createdAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(task.finalResult || task.outputFiles.length > 0) && (
                          <div className="flex items-center gap-1 mr-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await api.downloadTaskResult(task.id, 'md');
                                } catch (err: any) {
                                  alert(`下载失败: ${err.message}`);
                                }
                              }}
                              title="下载完整 Markdown 报告"
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium rounded border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>.md</span>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await api.downloadTaskResult(task.id, 'docx');
                                } catch (err: any) {
                                  alert(`下载失败: ${err.message}`);
                                }
                              }}
                              title="下载 Word (.docx) 文档"
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold rounded border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>.docx</span>
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => onViewTask(task)}
                          className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded font-medium transition-colors text-xs cursor-pointer"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => onRerunTask(task)}
                          title="重新运行"
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
