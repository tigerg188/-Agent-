import React, { useState, useEffect } from 'react';
import {
  Globe,
  Camera,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  MousePointer,
  Type,
  FileText,
  RotateCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';

interface BrowserViewProps {
  workspaceId: string;
}

export const BrowserView: React.FC<BrowserViewProps> = ({ workspaceId }) => {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [pageTitle, setPageTitle] = useState('Hacker News');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [selector, setSelector] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Playwright 原生内核已就绪');

  // Load initial state
  useEffect(() => {
    (async () => {
      try {
        const state = await api.getBrowserState();
        if (state) {
          if (state.currentUrl) setUrl(state.currentUrl);
          if (state.pageTitle) setPageTitle(state.pageTitle);
          if (state.lastScreenshotBase64) setScreenshot(state.lastScreenshotBase64);
        }
      } catch (e) {
        // Ignore
      }
    })();
  }, []);

  const handleNavigate = async (targetUrl?: string) => {
    const navUrl = targetUrl || url;
    if (!navUrl) return;

    setIsLoading(true);
    setStatusMessage(`正在导航至 ${navUrl}...`);
    try {
      const res = await api.runBrowserCommand({
        action: 'navigate',
        url: navUrl,
      });

      if (res && res.success) {
        setPageTitle(res.title || '网页已加载');
        if (res.url) setUrl(res.url);
        if (res.screenshotBase64) setScreenshot(res.screenshotBase64);
        setStatusMessage(`成功打开网页：${res.title || navUrl}`);
      } else {
        setStatusMessage(`访问提示：${res.error || '网络访问未就绪'}`);
      }
    } catch (err: any) {
      setStatusMessage(`导航异常: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeScreenshot = async () => {
    setIsLoading(true);
    setStatusMessage('正在截取页面快照...');
    try {
      const res = await api.runBrowserCommand({ action: 'screenshot' });
      if (res && res.screenshotBase64) {
        setScreenshot(res.screenshotBase64);
        setStatusMessage('快照截取成功');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractText = async () => {
    setIsLoading(true);
    setStatusMessage('正在提取页面正文与表格...');
    try {
      const res = await api.runBrowserCommand({ action: 'extract_text' });
      if (res && res.text) {
        setExtractedContent(res.text);
        setStatusMessage(`已提取 ${res.text.length} 字符页面正文`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleScroll = async (direction: 'up' | 'down') => {
    setIsLoading(true);
    setStatusMessage(`正在${direction === 'down' ? '向下' : '向上'}滚动页面...`);
    try {
      const res = await api.runBrowserCommand({
        action: 'scroll',
        scrollDirection: direction,
        scrollAmount: 500,
      });
      if (res && res.screenshotBase64) {
        setScreenshot(res.screenshotBase64);
      }
      setStatusMessage('滚动完成');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClickElement = async () => {
    if (!selector) return;
    setIsLoading(true);
    setStatusMessage(`正在点击选择器: ${selector}...`);
    try {
      const res = await api.runBrowserCommand({
        action: 'click',
        selector,
      });
      if (res && res.screenshotBase64) {
        setScreenshot(res.screenshotBase64);
      }
      setStatusMessage(res.success ? '元素点击成功' : `点击失败: ${res.error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeText = async () => {
    if (!selector || !inputText) return;
    setIsLoading(true);
    setStatusMessage(`正在向 ${selector} 填入内容...`);
    try {
      const res = await api.runBrowserCommand({
        action: 'type',
        selector,
        text: inputText,
      });
      if (res && res.screenshotBase64) {
        setScreenshot(res.screenshotBase64);
      }
      setStatusMessage(res.success ? '文本输入完成' : `输入失败: ${res.error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsMarkdown = async () => {
    if (!extractedContent) {
      await handleExtractText();
    }
    const docTitle = (pageTitle || 'WebExtract').slice(0, 20);
    const fileName = `${docTitle}-${Date.now().toString().slice(-4)}.md`;
    const content = `# 网页提取资料：${pageTitle}\n- 网址来源: ${url}\n- 提取时间: ${new Date().toLocaleString()}\n\n## 页面正文摘录\n${extractedContent || '无提取文本'}`;

    try {
      await api.testMcpTool('file_write_markdown_report', { fileName, content }, workspaceId);
      setStatusMessage(`已将页面资料保存为工作区文件：${fileName}`);
    } catch (e: any) {
      setStatusMessage(`保存失败: ${e.message}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>Playwright 浏览器实况与交互平台</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            提供云端原生 Playwright 渲染引擎。Agent 执行网页调研、正文抓取、表单填写与截图快照时均通过此环境运转。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-medium rounded-lg border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Chromium Native Active</span>
          </span>
        </div>
      </div>

      {/* Browser Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            onClick={() => handleNavigate()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all shrink-0"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{isLoading ? '加载中...' : '打开网页'}</span>
          </button>
        </div>

        {/* Quick URL Suggestions */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>快捷目标：</span>
          {[
            { name: 'Hacker News', url: 'https://news.ycombinator.com' },
            { name: 'GitHub Trending', url: 'https://github.com/trending' },
            { name: 'DuckDuckGo', url: 'https://duckduckgo.com' },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setUrl(item.url);
                handleNavigate(item.url);
              }}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTakeScreenshot}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>截取快照</span>
          </button>
          <button
            onClick={handleExtractText}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>提取页面文本</span>
          </button>
          <button
            onClick={() => handleScroll('down')}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>向下滚动</span>
          </button>
          <button
            onClick={() => handleScroll('up')}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>向上滚动</span>
          </button>
        </div>

        <button
          onClick={handleSaveAsMarkdown}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>保存页面资料为 Markdown</span>
        </button>
      </div>

      {/* Main Grid: Screen Viewport & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Viewport 8 cols */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate pr-4">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-medium truncate">{pageTitle || '无标题页面'}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 shrink-0">{statusMessage}</span>
          </div>

          <div className="bg-slate-950 aspect-16/10 flex items-center justify-center relative overflow-hidden">
            {screenshot ? (
              <img
                src={
                  screenshot.startsWith('data:')
                    ? screenshot
                    : screenshot.startsWith('PHN2Zy') || screenshot.startsWith('PD94bW')
                    ? `data:image/svg+xml;base64,${screenshot}`
                    : `data:image/png;base64,${screenshot}`
                }
                alt="Playwright Viewport"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-8 text-slate-500">
                <Globe className="w-12 h-12 mx-auto mb-2 text-slate-700" />
                <p className="text-xs">输入网址并点击「打开网页」获取实时渲染视窗</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Tools 4 cols */}
        <div className="lg:col-span-4 space-y-4">
          {/* DOM Interaction form */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <MousePointer className="w-4 h-4 text-blue-600" />
              <span>精细元素交互测试</span>
            </h3>

            <div>
              <label className="text-slate-600 block mb-1">CSS 选择器 (Selector)</label>
              <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="例如：button.submit, input[name='q']"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">拟输入的文本</label>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如：Agent MCP Framework"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClickElement}
                disabled={isLoading || !selector}
                className="flex-1 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
              >
                点击元素
              </button>
              <button
                onClick={handleTypeText}
                disabled={isLoading || !selector || !inputText}
                className="flex-1 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
              >
                输入文本
              </button>
            </div>
          </div>

          {/* Extracted text card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>抓取到的内容文本</span>
              </h3>
              <span className="text-[10px] text-slate-400">{extractedContent.length} 字符</span>
            </div>

            <div className="max-h-52 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
              {extractedContent || '点击上方「提取页面文本」读取网页正文与表格要素。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
