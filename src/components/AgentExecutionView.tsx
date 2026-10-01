import React, { useState } from 'react';
import {
  StopCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  FileText,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Terminal,
  FileCode,
  X,
  Activity,
  Layers,
  Cpu,
} from 'lucide-react';
import { TaskRecord, StepLog } from '../types';
import { api } from '../api';

interface AgentExecutionViewProps {
  task: TaskRecord | null;
  onStopTask: (taskId: string) => Promise<void>;
  onApproveTask: (taskId: string, approvalId: string, approved: boolean) => Promise<void>;
  onRerunTask: (task: TaskRecord) => Promise<void>;
  onBackToDashboard: () => void;
}

export const AgentExecutionView: React.FC<AgentExecutionViewProps> = ({
  task,
  onStopTask,
  onApproveTask,
  onRerunTask,
  onBackToDashboard,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLogJson, setCopiedLogJson] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'md' | 'docx' | 'json' | 'txt' | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'ai' | 'tool' | 'verification' | 'raw'>('all');

  if (!task) {
    return (
      <div className="p-12 text-center text-slate-400 space-y-4">
        <p className="text-sm">暂无处于活动或选中的任务。</p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500"
        >
          返回工作台首页
        </button>
      </div>
    );
  }

  const steps = task.steps || [];
  const outputFiles = task.outputFiles || [];
  const verificationChecks = task.verificationReport?.checks || [];

  const isRunning =
    task.status === 'analyzing' ||
    task.status === 'executing_tool' ||
    task.status === 'reading_skill' ||
    task.status === 'skill_selection' ||
    task.status === 'mcp_identification' ||
    task.status === 'verifying';

  const isAwaitingApproval = task.status === 'awaiting_approval' && task.approvalRequest;

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleCopyResult = () => {
    if (task.finalResult) {
      navigator.clipboard.writeText(task.finalResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLogJson = () => {
    const rawData = {
      taskInfo: {
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        model: task.model,
        status: task.status,
        durationMs: task.durationMs,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
      steps: task.steps,
      verificationReport: task.verificationReport,
      browserSession: task.browserSession,
      finalResult: task.finalResult,
    };
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
    setCopiedLogJson(true);
    setTimeout(() => setCopiedLogJson(false), 2000);
  };

  const handleDownload = async (format: 'md' | 'docx' | 'json' | 'txt') => {
    if (!task) return;
    setDownloadingFormat(format);
    try {
      await api.downloadTaskResult(task.id, format);
    } catch (err: any) {
      console.warn('API direct download failed, falling back to complete client generation:', err);
      const fullContent = task.finalResult || (task.outputFiles[0] && task.outputFiles[0].content) || '';
      
      if (format === 'json') {
        const fullJson = JSON.stringify(
          {
            task,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
        const blob = new Blob([fullJson], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${task.title.slice(0, 20)}-audit-log.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'txt') {
        const textLog = `Task ID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\nModel: ${task.model}\n\n=== STEPS ===\n${task.steps.map((s, i) => `[${i + 1}] [${s.timestamp}] [${s.status}] [${s.stage}]\n${s.title}\n${s.description}\n`).join('\n')}\n=== RESULT ===\n${fullContent}`;
        const blob = new Blob([textLog], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${task.title.slice(0, 20)}-audit.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'md') {
        if (!fullContent) {
          alert('当前任务无有效成果内容');
          return;
        }
        const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (task.outputFiles[0] && task.outputFiles[0].name) || `${task.title.slice(0, 20)}.md`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(`导出 Word (.docx) 失败: ${err.message || '网络异常'}`);
      }
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Execution stage visual mapping
  const stages = [
    { key: 'analyzing', label: '1. 任务分析' },
    { key: 'skill_selection', label: '2. 识别与选用 Skill' },
    { key: 'executing_tool', label: '3. 调用工具 (Browser/MCP)' },
    { key: 'verifying', label: '4. 验证任务结果' },
    { key: 'completed', label: '5. 输出成果' },
  ];

  const getStageIndex = (status: string) => {
    if (status === 'analyzing') return 0;
    if (status === 'skill_selection' || status === 'reading_skill') return 1;
    if (status === 'mcp_identification' || status === 'executing_tool' || status === 'awaiting_approval' || status === 'observing_result')
      return 2;
    if (status === 'verifying') return 3;
    if (status === 'completed') return 4;
    return -1;
  };

  const currentStageIdx = getStageIndex(task.status);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Bar: Title, Back & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
            title="返回工作台"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-md">{task.title}</h1>
              {task.selectedSkill && (
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">
                  {task.selectedSkill.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              任务 ID: {task.id} · 创建于 {new Date(task.createdAt).toLocaleTimeString()} · 模式：
              {task.executionMode === 'ask_approval'
                ? '询问审批'
                : task.executionMode === 'auto_execute'
                ? '自动执行'
                : '严格安全'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Full Process Visual Log Modal Trigger */}
          <button
            onClick={() => setShowLogModal(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ring-1 ring-slate-800 hover:ring-slate-700"
            title="查看本任务的全方位全流程可视化执行日志"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>全流程可视化日志</span>
          </button>

          {/* Direct Download Buttons for Completed/Results Available */}
          {(task.finalResult || outputFiles.length > 0) && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => handleDownload('md')}
                disabled={downloadingFormat === 'md'}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                title="完整下载 Markdown 报告源码"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>{downloadingFormat === 'md' ? '导出中...' : '.md 下载'}</span>
              </button>
              <button
                onClick={() => handleDownload('docx')}
                disabled={downloadingFormat === 'docx'}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="导出为 Microsoft Word (.docx) 格式文档"
              >
                <Download className="w-3.5 h-3.5 text-blue-100" />
                <span>{downloadingFormat === 'docx' ? '生成 Word 中...' : '.docx Word 下载'}</span>
              </button>
            </div>
          )}

          {/* STOP BUTTON */}
          {(isRunning || isAwaitingApproval) && (
            <button
              onClick={() => onStopTask(task.id)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              <span>停止 Agent</span>
            </button>
          )}

          {/* RERUN BUTTON */}
          {!isRunning && !isAwaitingApproval && (
            <button
              onClick={() => onRerunTask(task)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重新运行</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Stage Tracker */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs font-medium">
          {stages.map((stage, idx) => {
            const isPassed = currentStageIdx > idx || task.status === 'completed';
            const isCurrent = currentStageIdx === idx && task.status !== 'completed';
            return (
              <div
                key={stage.key}
                className={`p-2 rounded-xl border transition-all ${
                  isPassed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isCurrent
                    ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                  <span className="truncate">{stage.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* APPROVAL DIALOG / BANNER (When awaiting user permission) */}
      {isAwaitingApproval && task.approvalRequest && (
        <div className="bg-amber-50 border-2 border-amber-400 p-5 rounded-2xl shadow-sm animate-pulse-subtle">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200/70 text-amber-900 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">操作审批请求 (需要您的授权)</h3>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                  风险等级：{task.approvalRequest.riskLevel.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                {task.approvalRequest.description}
              </p>
              <div className="mt-2 text-[11px] bg-amber-100/60 p-2.5 rounded-lg text-amber-950 font-mono">
                调用工具: <span className="font-bold">{task.approvalRequest.toolName}</span> | 动作: {task.approvalRequest.actionName}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  disabled={isProcessingApproval}
                  onClick={async () => {
                    setIsProcessingApproval(true);
                    try {
                      await onApproveTask(task.id, task.approvalRequest!.id, true);
                    } finally {
                      setIsProcessingApproval(false);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>批准并继续执行</span>
                </button>

                <button
                  disabled={isProcessingApproval}
                  onClick={async () => {
                    setIsProcessingApproval(true);
                    try {
                      await onApproveTask(task.id, task.approvalRequest!.id, false);
                    } finally {
                      setIsProcessingApproval(false);
                    }
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <span>拒绝并安全跳过</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Steps & Live Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Observable Steps Timeline (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-900">执行过程观察流 (Observable Loop)</h2>
            </div>
            <span className="text-[11px] text-slate-400">已执行 {steps.length} 个步骤</span>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const isExpanded = Boolean(expandedSteps[step.id]);
              return (
                <div
                  key={step.id || idx}
                  className={`rounded-xl border text-xs transition-all ${
                    step.status === 'in_progress'
                      ? 'bg-blue-50/50 border-blue-200'
                      : step.status === 'error'
                      ? 'bg-rose-50 border-rose-200'
                      : step.status === 'warning'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50/50 border-slate-200/80'
                  }`}
                >
                  <div
                    onClick={() => toggleStep(step.id)}
                    className="p-3 flex items-start justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {step.status === 'in_progress' && (
                          isRunning ? (
                            <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )
                        )}
                        {step.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                        {step.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                        {step.status === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{step.title}</div>
                        {step.description && (
                          <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {step.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <span>{step.timestamp ? step.timestamp.slice(11, 19) : ''}</span>
                      {step.details && (
                        <button className="p-0.5 text-slate-400 hover:text-slate-700">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && step.details && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-200/60 font-mono text-[11px] text-slate-700">
                      <pre className="p-2 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[10px]">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Browser View & Result Artifacts (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Browser Snapshot View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-mono text-[11px] truncate text-slate-300">
                  {task.browserSession?.currentUrl || 'Playwright 浏览器视窗待命中'}
                </span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                1280x800
              </span>
            </div>

            <div className="bg-slate-950 aspect-16/10 flex items-center justify-center relative overflow-hidden">
              {task.browserSession?.lastScreenshot ? (
                <img
                  src={
                    task.browserSession.lastScreenshot.startsWith('data:')
                      ? task.browserSession.lastScreenshot
                      : task.browserSession.lastScreenshot.startsWith('PHN2Zy') || task.browserSession.lastScreenshot.startsWith('PD94bW')
                      ? `data:image/svg+xml;base64,${task.browserSession.lastScreenshot}`
                      : `data:image/png;base64,${task.browserSession.lastScreenshot}`
                  }
                  alt="Browser Viewport"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-slate-500 text-xs">
                  <Globe className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <span>浏览器尚未产生页面快照</span>
                </div>
              )}
            </div>

            {task.browserSession?.title && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                <span className="truncate font-medium">标题：{task.browserSession.title}</span>
                <span className="text-emerald-600 font-medium shrink-0 ml-2">● 活跃渲染</span>
              </div>
            )}
          </div>

          {/* Verification Report Card */}
          {task.verificationReport && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900">执行结果自验报告</h3>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    task.verificationReport.passed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {task.verificationReport.passed ? '验证通过' : '未完全达标'}
                </span>
              </div>
              <p className="text-xs text-slate-600">{task.verificationReport.summary}</p>
              <div className="space-y-1.5 pt-1">
                {(verificationChecks || []).map((check, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700">{check.name}</span>
                    <span className={check.passed ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {check.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Artifacts & Final Result */}
          {(task.finalResult || outputFiles.length > 0) && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900">最终输出成果与交付文件</h3>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleCopyResult}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                    title="复制完整 Markdown 内容"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已复制' : '复制全文'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('md')}
                    disabled={downloadingFormat === 'md'}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer disabled:opacity-60"
                    title="下载完整 Markdown 源码文件"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>{downloadingFormat === 'md' ? '导出中...' : '下载 .md'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('docx')}
                    disabled={downloadingFormat === 'docx'}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                    title="导出为 Microsoft Word (.docx) 格式文档"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-100" />
                    <span>{downloadingFormat === 'docx' ? '生成 Word 中...' : '下载 .docx'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('json')}
                    disabled={downloadingFormat === 'json'}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-purple-200 cursor-pointer disabled:opacity-60"
                    title="下载完整结构化全链路审计日志 (JSON 格式)"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>{downloadingFormat === 'json' ? '导出中...' : '下载日志 .json'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload('txt')}
                    disabled={downloadingFormat === 'txt'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                    title="下载控制台纯文本执行日志 (.log)"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{downloadingFormat === 'txt' ? '导出中...' : '下载日志 .log'}</span>
                  </button>
                </div>
              </div>

              {outputFiles.length > 0 && (
                <div className="space-y-2">
                  {outputFiles.map((file, fIdx) => (
                    <div
                      key={fIdx}
                      className="p-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 truncate">{file.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            完整文件 · 约 {Math.max(1, Math.round((file.size || (task.finalResult?.length || 0)) / 1024 * 10) / 10)} KB
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDownload('md')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="下载 Markdown 源码"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>.md</span>
                        </button>
                        <button
                          onClick={() => handleDownload('docx')}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          title="下载 Word 文档"
                        >
                          <Download className="w-3 h-3 text-blue-100" />
                          <span>.docx</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <div className="max-h-72 overflow-y-auto p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text">
                  {task.finalResult}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>完整成果字数：{task.finalResult?.length || 0} 字符</span>
                  <span>支持一键导出排版规整的 Word (.docx)、Markdown (.md)、全量 JSON 与控制台 .log</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== FULL PROCESS VISUAL LOG MODAL ==================== */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">全方位全流程可视化执行审计日志</h3>
                  <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    ID: {task.id}
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                      task.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : task.status === 'failed'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {task.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-2xs text-slate-400 font-mono">
                  <span>底层模型: {task.model || 'gemini-2.5-flash'} (Google GenAI)</span>
                  <span>总耗时: {task.durationMs ? `${(task.durationMs / 1000).toFixed(2)}s` : '运行中'}</span>
                  <span>全量步骤: {(task.steps || []).length} 项</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogJson}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-2xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  title="复制全量结构化 JSON 日志数据"
                >
                  {copiedLogJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLogJson ? '已复制' : '复制 JSON'}</span>
                </button>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Download Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setLogFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    logFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  全部链路 ({(task.steps || []).length})
                </button>
                <button
                  onClick={() => setLogFilter('ai')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    logFilter === 'ai'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI 推理与交互 ({(task.steps || []).filter((s) => s.stage === 'ai_reasoning').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('tool')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    logFilter === 'tool'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>工具与网络 ({(task.steps || []).filter((s) => s.stage === 'tool_call' || s.stage === 'tool_result').length})</span>
                </button>
                <button
                  onClick={() => setLogFilter('verification')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    logFilter === 'verification'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>质量自检验证</span>
                </button>
                <button
                  onClick={() => setLogFilter('raw')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    logFilter === 'raw'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <FileCode className="w-3 h-3" />
                  <span>原始 JSON 结构</span>
                </button>
              </div>

              {/* Download Buttons in Log Viewer */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDownload('json')}
                  disabled={downloadingFormat === 'json'}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-purple-200 cursor-pointer disabled:opacity-50"
                  title="下载为 JSON 结构化日志文件"
                >
                  <Download className="w-3 h-3" />
                  <span>下载 .json</span>
                </button>
                <button
                  onClick={() => handleDownload('txt')}
                  disabled={downloadingFormat === 'txt'}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-300 cursor-pointer disabled:opacity-50"
                  title="下载为标准控制台 .log 文件"
                >
                  <Download className="w-3 h-3" />
                  <span>下载 .log</span>
                </button>
                <button
                  onClick={() => handleDownload('md')}
                  disabled={downloadingFormat === 'md'}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-200 cursor-pointer disabled:opacity-50"
                  title="下载 Markdown 交付成果"
                >
                  <Download className="w-3 h-3" />
                  <span>下载 .md</span>
                </button>
                <button
                  onClick={() => handleDownload('docx')}
                  disabled={downloadingFormat === 'docx'}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="下载 Word 交付成果"
                >
                  <Download className="w-3 h-3" />
                  <span>下载 .docx</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {/* Tab 1: Chronological Steps (All / AI / Tool) */}
              {(logFilter === 'all' || logFilter === 'ai' || logFilter === 'tool') && (
                <div className="space-y-3">
                  {(task.steps || [])
                    .filter((s) => {
                      if (logFilter === 'ai') return s.stage === 'ai_reasoning';
                      if (logFilter === 'tool') return s.stage === 'tool_call' || s.stage === 'tool_result';
                      return true;
                    })
                    .map((step, idx) => {
                      const isAi = step.stage === 'ai_reasoning';
                      const isTool = step.stage === 'tool_call' || step.stage === 'tool_result';
                      const isOk = step.status === 'success';
                      const isWarning = step.status === 'warning';
                      const isError = step.status === 'error';

                      return (
                        <div
                          key={step.id}
                          className={`p-4 rounded-2xl border transition-all text-xs space-y-2 ${
                            isAi
                              ? 'bg-purple-50/40 border-purple-200/80 shadow-xs'
                              : isTool
                              ? 'bg-blue-50/40 border-blue-200/80 shadow-xs'
                              : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-2xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">{step.title}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-2xs font-mono font-semibold ${
                                  isAi
                                    ? 'bg-purple-100 text-purple-700'
                                    : isTool
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {step.stage.toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                                  isOk
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isWarning
                                    ? 'bg-amber-100 text-amber-800'
                                    : isError
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isOk ? '成功' : isWarning ? '告警' : isError ? '错误' : '执行中'}
                              </span>
                              <span className="text-2xs font-mono text-slate-400">
                                {new Date(step.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>

                          <p className="text-slate-600 leading-relaxed pl-8 font-sans select-text">
                            {step.description}
                          </p>

                          {/* Extra contextual badges for AI / Browser */}
                          {isAi && (
                            <div className="pl-8 pt-1 flex items-center gap-2 text-2xs font-mono text-purple-600">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>调用官方 Google GenAI SDK 核心语义大模型进行端到端逻辑推理</span>
                            </div>
                          )}

                          {isTool && task.browserSession?.currentUrl && (
                            <div className="pl-8 pt-1 flex items-center gap-2 text-2xs font-mono text-blue-600">
                              <Globe className="w-3.5 h-3.5" />
                              <span className="truncate">目标站点: {task.browserSession.currentUrl}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Tab 2: Quality Verification Checklist */}
              {logFilter === 'verification' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>三维自动化质量校验总览</span>
                      </h4>
                      <p className="text-slate-500 text-2xs">
                        {task.verificationReport?.summary || '执行闭环自验检测通过'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        task.verificationReport?.passed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {task.verificationReport?.passed ? '全项通过 (VERIFIED)' : '部分预警'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(task.verificationReport?.checks || []).map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="font-semibold text-slate-800">{c.name}</span>
                        </div>
                        <span className="text-2xs text-emerald-700 font-medium">{c.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Raw JSON */}
              {logFilter === 'raw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-2xs text-slate-500 px-1 font-mono">
                    <span>完整的任务运行台账与全链路元数据结构 (JSON)</span>
                    <button
                      onClick={handleCopyLogJson}
                      className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      {copiedLogJson ? '已复制！' : '复制 JSON 源码'}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-2xs font-mono overflow-x-auto max-h-[55vh] select-text">
                    {JSON.stringify(
                      {
                        taskInfo: {
                          id: task.id,
                          title: task.title,
                          prompt: task.prompt,
                          model: task.model,
                          workspaceId: task.workspaceId,
                          status: task.status,
                          executionMode: task.executionMode,
                          skillMode: task.skillMode,
                          selectedSkill: task.selectedSkill,
                          durationMs: task.durationMs,
                          createdAt: task.createdAt,
                          completedAt: task.completedAt,
                        },
                        verificationReport: task.verificationReport,
                        browserSession: task.browserSession,
                        steps: task.steps,
                        outputFiles: task.outputFiles,
                        finalResultPreview: task.finalResult?.slice(0, 300) + '...',
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
              <span className="text-2xs text-slate-500 font-mono">
                日志已签名并就绪导出 · 支持系统外部第三方审计复现
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload('json')}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-purple-700 border border-purple-200 font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 .json</span>
                </button>
                <button
                  onClick={() => handleDownload('txt')}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>下载 .log</span>
                </button>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs transition-all cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
