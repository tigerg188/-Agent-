/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { NewTaskView } from './components/NewTaskView';
import { AgentExecutionView } from './components/AgentExecutionView';
import { SkillsView } from './components/SkillsView';
import { McpView } from './components/McpView';
import { BrowserView } from './components/BrowserView';
import { AutomationView } from './components/AutomationView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import {
  ViewType,
  WorkspaceItem,
  SkillMetadata,
  McpServerConfig,
  TaskRecord,
  AutomationTask,
  WorkspaceFile,
  ExecutionMode,
} from './types';
import { api } from './api';
import { X, Plus, Layers } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('ws-cides');
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [automations, setAutomations] = useState<AutomationTask[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [preselectedSkillId, setPreselectedSkillId] = useState<string | undefined>();

  // Modal for new workspace
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWsCode, setNewWsCode] = useState('');
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  // Polling ref for active task
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch
  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch when workspace changes
  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspaceSpecificData(currentWorkspaceId);
    }
  }, [currentWorkspaceId]);

  // Polling effect for active task
  useEffect(() => {
    if (activeTask && (
      activeTask.status === 'analyzing' ||
      activeTask.status === 'executing_tool' ||
      activeTask.status === 'reading_skill' ||
      activeTask.status === 'skill_selection' ||
      activeTask.status === 'mcp_identification' ||
      activeTask.status === 'awaiting_approval' ||
      activeTask.status === 'verifying'
    )) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const freshTask = await api.getTask(activeTask.id);
          setActiveTask(freshTask);
          if (freshTask.status === 'completed' || freshTask.status === 'failed' || freshTask.status === 'stopped') {
            loadTasks(currentWorkspaceId);
          }
        } catch (e) {
          // Ignore
        }
      }, 1000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeTask?.id, activeTask?.status, currentWorkspaceId]);

  const loadAllData = async () => {
    try {
      const wsList = await api.getWorkspaces();
      setWorkspaces(wsList);
      if (wsList.length > 0 && !currentWorkspaceId) {
        setCurrentWorkspaceId(wsList[0].id);
      }

      const initialWs = wsList[0]?.id || 'ws-cides';
      await loadWorkspaceSpecificData(initialWs);

      const mcpData = await api.getMcp();
      setMcpServers(mcpData.servers);
      setAvailableTools(mcpData.availableTools);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadWorkspaceSpecificData = async (wsId: string) => {
    try {
      const [skList, autoList, taskList, fileList] = await Promise.all([
        api.getSkills(wsId),
        api.getAutomations(wsId),
        api.getTasks(wsId),
        api.getWorkspaceFiles(wsId),
      ]);
      setSkills(skList);
      setAutomations(autoList);
      setTasks(taskList);
      setWorkspaceFiles(fileList);

      // Check if there is an active running task
      const running = taskList.find(
        (t) =>
          t.status === 'analyzing' ||
          t.status === 'executing_tool' ||
          t.status === 'awaiting_approval' ||
          t.status === 'verifying'
      );
      if (running && !activeTask) {
        setActiveTask(running);
      }
    } catch (e) {
      console.error('Error loading workspace data:', e);
    }
  };

  const loadTasks = async (wsId: string) => {
    const taskList = await api.getTasks(wsId);
    setTasks(taskList);
  };

  const handleStartTask = async (params: {
    workspaceId: string;
    prompt: string;
    skillMode: 'auto' | 'forced';
    skillId?: string;
    executionMode: ExecutionMode;
    model: string;
    selectedMcps: string[];
    attachedFiles: string[];
  }) => {
    const createdTask = await api.createTask(params);
    setActiveTask(createdTask);
    setCurrentView('execution');
    loadTasks(params.workspaceId);
  };

  const handleStopTask = async (taskId: string) => {
    await api.stopTask(taskId);
    if (activeTask && activeTask.id === taskId) {
      const freshTask = await api.getTask(taskId);
      setActiveTask(freshTask);
    }
    loadTasks(currentWorkspaceId);
  };

  const handleApproveTask = async (taskId: string, approvalId: string, approved: boolean) => {
    await api.approveTask(taskId, approvalId, approved);
    const fresh = await api.getTask(taskId);
    setActiveTask(fresh);
    loadTasks(currentWorkspaceId);
  };

  const handleRerunTask = async (task: TaskRecord) => {
    const newTask = await api.rerunTask(task.id);
    setActiveTask(newTask);
    setCurrentView('execution');
    loadTasks(currentWorkspaceId);
  };

  const handleSelectSkillForTask = (skillId: string) => {
    setPreselectedSkillId(skillId);
    setCurrentView('new_task');
  };

  const handleViewTask = (task: TaskRecord) => {
    setActiveTask(task);
    setCurrentView('execution');
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsCode || !newWsName) return;

    try {
      const created = await api.createWorkspace(newWsCode.trim(), newWsName.trim(), newWsDesc.trim());
      setWorkspaces((prev) => [...prev, created]);
      setCurrentWorkspaceId(created.id);
      setShowNewWorkspaceModal(false);
      setNewWsCode('');
      setNewWsName('');
      setNewWsDesc('');
    } catch (err: any) {
      alert(err.message || '创建工作区失败');
    }
  };

  const currentWs =
    workspaces.find((w) => w.id === currentWorkspaceId) || {
      id: 'ws-cides',
      name: '综合智能决策系统',
      code: 'CIDES',
      description: '个人综合决策与跨领域信息调研工作区',
      createdAt: new Date().toISOString(),
      filesCount: 0,
      skillsCount: 0,
      tasksCount: 0,
    };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <Header
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onSelectWorkspace={setCurrentWorkspaceId}
        onOpenNewWorkspaceModal={() => setShowNewWorkspaceModal(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'new_task') {
              setPreselectedSkillId(undefined);
            }
            setCurrentView(view);
          }}
          activeTask={activeTask}
        />

        {/* Central Workspace Area */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              currentWorkspace={currentWs}
              skills={skills}
              automations={automations}
              recentTasks={tasks}
              onNavigate={(v) => {
                if (v === 'new_task') setPreselectedSkillId(undefined);
                setCurrentView(v);
              }}
              onSelectSkillForTask={handleSelectSkillForTask}
              onViewTask={handleViewTask}
              onRerunTask={handleRerunTask}
            />
          )}

          {currentView === 'new_task' && (
            <NewTaskView
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              skills={skills}
              mcpServers={mcpServers}
              workspaceFiles={workspaceFiles}
              preselectedSkillId={preselectedSkillId}
              onStartTask={handleStartTask}
              onRefreshFiles={() => loadWorkspaceSpecificData(currentWorkspaceId)}
            />
          )}

          {currentView === 'execution' && (
            <AgentExecutionView
              task={activeTask}
              onStopTask={handleStopTask}
              onApproveTask={handleApproveTask}
              onRerunTask={handleRerunTask}
              onBackToDashboard={() => setCurrentView('dashboard')}
            />
          )}

          {currentView === 'skills' && (
            <SkillsView
              skills={skills}
              workspaceId={currentWorkspaceId}
              onRefresh={() => loadWorkspaceSpecificData(currentWorkspaceId)}
              onRunSkill={handleSelectSkillForTask}
            />
          )}

          {currentView === 'mcp' && (
            <McpView
              servers={mcpServers}
              availableTools={availableTools}
              workspaceId={currentWorkspaceId}
              onRefresh={loadAllData}
            />
          )}

          {currentView === 'browser' && (
            <BrowserView workspaceId={currentWorkspaceId} />
          )}

          {currentView === 'automation' && (
            <AutomationView
              automations={automations}
              skills={skills}
              mcpServers={mcpServers}
              workspaceId={currentWorkspaceId}
              onRefresh={() => loadWorkspaceSpecificData(currentWorkspaceId)}
            />
          )}

          {currentView === 'history' && (
            <HistoryView
              tasks={tasks}
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              onViewTask={handleViewTask}
              onRerunTask={handleRerunTask}
            />
          )}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* New Workspace Modal */}
      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">创建新工作区 (Workspace)</h3>
              </div>
              <button
                onClick={() => setShowNewWorkspaceModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  工作区代号 (Code，如 CIDES, CIW)
                </label>
                <input
                  type="text"
                  value={newWsCode}
                  onChange={(e) => setNewWsCode(e.target.value.toUpperCase())}
                  placeholder="例如：FINANCE, RESEARCH"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">工作区全称</label>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="例如：财务审计与法律事务工作区"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">工作区描述说明</label>
                <textarea
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  rows={2}
                  placeholder="说明该工作区的业务目标与独立存储范围..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWorkspaceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs"
                >
                  创建工作区
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
