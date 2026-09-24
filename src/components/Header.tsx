import React from 'react';
import { Bot, Layers, Plus, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';
import { WorkspaceItem } from '../types';

interface HeaderProps {
  workspaces: WorkspaceItem[];
  currentWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenNewWorkspaceModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onOpenNewWorkspaceModal,
}) => {
  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 select-none shadow-xs">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 tracking-tight text-sm">Personal Agent Workbench</span>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded border border-blue-200">
              V0.1 Cloud
            </span>
          </div>
          <span className="text-xs text-slate-500 font-normal">个人智能 Agent 工作台 · 纯云端闭环验证版</span>
        </div>
      </div>

      {/* Right Tools & Workspace Switcher */}
      <div className="flex items-center gap-3">
        {/* Real-time Environment Readiness Badges */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>Gemini 3.8 Flash</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Playwright 浏览器已就绪</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>MCP 审批机制激活</span>
          </div>
        </div>

        {/* Workspace Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <Layers className="w-4 h-4 text-slate-500 ml-1.5" />
          <select
            value={currentWorkspaceId}
            onChange={(e) => onSelectWorkspace(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-800 pr-4 pl-1 py-1 focus:outline-hidden cursor-pointer"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                [{ws.code}] {ws.name}
              </option>
            ))}
          </select>
          <button
            onClick={onOpenNewWorkspaceModal}
            title="创建新工作区"
            className="p-1 hover:bg-white text-slate-600 hover:text-slate-900 rounded transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
