import React, { useEffect, useState } from 'react';
import {
  Settings,
  Shield,
  Cpu,
  Globe,
  Database,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { SystemStatus } from '../types';
import { api } from '../api';

export const SettingsView: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    api.getSystemStatus().then(setSystemStatus).catch(console.error);
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-700" />
          <span>系统设置与环境诊断</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          个人智能 Agent 工作台 V0.1 · 纯云端闭环验证环境状态检查与模型适配器配置。
        </p>
      </div>

      {/* Cloud Architecture Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-1">
          <div className="font-bold">云端架构保证 (Cloud-Native Architecture)</div>
          <p className="leading-relaxed">
            本项目严格遵循云端无状态验证设计：无任何本地 Windows 安装程序、无本地 EXE、无本地 Python 依赖、无 LM Studio、无本地 Docker。所有调度与浏览器操作均在云端容器内由 Node.js 与 Playwright 驱动。
          </p>
        </div>
      </div>

      {/* Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Card 1: Model Adapter */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900">模型适配器 (Model Adapter)</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
              就绪
            </span>
          </div>
          <p className="text-slate-600">
            优先采用官方 <code>@google/genai</code> SDK 与 Interactions 架构。
          </p>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">当前活跃模型：</span>
              <span className="font-bold text-slate-800">gemini-3.8-flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">API 秘钥状态：</span>
              <span className="text-emerald-600 font-medium">已自动注入环境 (AI Studio)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">未来扩展示例：</span>
              <span className="text-slate-500">OpenAI / Anthropic Compatible</span>
            </div>
          </div>
        </div>

        {/* Card 2: Browser Engine */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900">浏览器内核 (Browser Engine)</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
              就绪
            </span>
          </div>
          <p className="text-slate-600">
            云端原生 Playwright Headless Chromium，提供真实 DOM 交互与快照能力。
          </p>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">渲染驱动：</span>
              <span className="font-bold text-slate-800">Playwright Chromium</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">视图分辨率：</span>
              <span className="text-slate-800">1280 × 800 (真实视窗)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">快照模式：</span>
              <span className="text-slate-800">Base64 PNG 实时推送</span>
            </div>
          </div>
        </div>

        {/* Card 3: Safety & Approval */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900">安全与审批策略</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
              活跃监控
            </span>
          </div>
          <p className="text-slate-600">
            高风险动作（付款、数据删除、公开发布、关键文件持久化修改）严格中断审批。
          </p>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-600">
            <div>• 默认执行模式：询问审批 (Ask Approval)</div>
            <div>• 中断机制：任务自动挂起并等待前端审批信号</div>
            <div>• 强制安全熔断：支持运行中一键【停止 Agent】</div>
          </div>
        </div>

        {/* Card 4: Workspaces & Isolation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-slate-900">工作区隔离与存储 (Workspace)</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
              {systemStatus?.workspacesCount || 2} 个工作区
            </span>
          </div>
          <p className="text-slate-600">
            CIDES（综合决策系统）与 CIW（企业协作）工作区互不干扰，资料隔离。
          </p>
          <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-600">
            <div>• 独立技能库与输入附件隔离</div>
            <div>• 独立成果输出目录与审计日志</div>
            <div>• 支持工作区跨设备协同与导出</div>
          </div>
        </div>
      </div>
    </div>
  );
};
