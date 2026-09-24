import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  PlayCircle,
  Puzzle,
  Blocks,
  Globe,
  Clock,
  History,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { ViewType, TaskRecord } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  activeTask?: TaskRecord | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, activeTask }) => {
  const isRunning =
    activeTask &&
    (activeTask.status === 'analyzing' ||
      activeTask.status === 'executing_tool' ||
      activeTask.status === 'awaiting_approval' ||
      activeTask.status === 'verifying');

  const isAwaitingApproval = activeTask?.status === 'awaiting_approval';

  const navItems = [
    { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
    { id: 'new_task', label: '新建任务', icon: PlusCircle, highlight: true },
    {
      id: 'execution',
      label: '执行监控',
      icon: PlayCircle,
      badge: isRunning ? (isAwaitingApproval ? '待审批' : '运行中') : undefined,
      badgeColor: isAwaitingApproval ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white animate-pulse',
    },
    { id: 'skills', label: '技能底座 (Skills)', icon: Puzzle },
    { id: 'mcp', label: 'MCP 管理', icon: Blocks },
    { id: 'browser', label: '浏览器', icon: Globe },
    { id: 'automation', label: '自动化', icon: Clock },
    { id: 'history', label: '历史记录', icon: History },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        导航目录
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewType)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : item.highlight
                  ? 'text-blue-400 hover:bg-slate-800/80 hover:text-blue-300'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Task in-flight mini indicator if running */}
      {isRunning && (
        <div
          onClick={() => onNavigate('execution')}
          className="m-3 p-2.5 rounded-lg bg-slate-800/90 border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              当前活跃任务
            </span>
            {isAwaitingApproval && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <p className="text-[11px] text-slate-400 truncate">{activeTask.title}</p>
        </div>
      )}

      {/* Workspace footnote */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-300">
        <div className="flex items-center justify-between">
          <span>云端执行内核</span>
          <span className="text-emerald-400 font-medium">● 连通</span>
        </div>
      </div>
    </aside>
  );
};
