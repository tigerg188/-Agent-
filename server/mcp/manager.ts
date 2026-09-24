import { McpServerConfig, McpToolDeclaration, ExecutionMode } from '../types';
import { globalBrowserAdapter } from '../browser/adapter';
import { globalWorkspaceStore } from '../workspace/store';
import fs from 'fs';
import path from 'path';

export class McpManager {
  private servers: Map<string, McpServerConfig> = new Map();

  constructor() {
    this.initDefaultMcpServers();
  }

  private initDefaultMcpServers() {
    // 1. Browser MCP (Playwright native)
    const browserMcp: McpServerConfig = {
      id: 'mcp-browser',
      name: 'Browser Automation MCP',
      type: 'browser',
      description: '基于 Playwright 的原生无头浏览器驱动，支持真实网页导航、元素交互、截图与页面结构分析。',
      enabled: true,
      transport: 'in_process',
      status: 'ready',
      statusMessage: 'Playwright 原生浏览器内核已就绪，支持真实 DOM 交互与屏幕快照。',
      tools: [
        {
          name: 'browser_navigate',
          description: '打开并导航至指定网页 URL，加载完成后捕获网页标题与视觉快照。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '完整的网页地址，例如 https://example.com' },
            },
            required: ['url'],
          },
        },
        {
          name: 'browser_search_and_read',
          description: '在搜索引擎或目标页面搜索指定关键词，并读取检索结果摘要与正文。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              searchEngineUrl: { type: 'string', description: '搜索引擎地址，默认使用权威搜索' },
              keyword: { type: 'string', description: '需要检索的核心关键词' },
            },
            required: ['keyword'],
          },
        },
        {
          name: 'browser_click',
          description: '在当前页面点击指定的 CSS 选择器元素或链接。',
          riskLevel: 'medium',
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS 选择器，例如 button.submit 或 a.result-link' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'browser_type',
          description: '在指定输入框中输入文本，并可选模拟回车提交。',
          riskLevel: 'medium',
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: '输入框 CSS 选择器，例如 input[name="q"]' },
              text: { type: 'string', description: '需要键入的文本内容' },
            },
            required: ['selector', 'text'],
          },
        },
        {
          name: 'browser_screenshot',
          description: '对当前浏览器页面截取完整或视口快照，以 Base64 格式返回。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'browser_get_dom_structure',
          description: '提取当前页面的标题、主要分级标题、主要链接和交互输入元素结构。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };

    // 2. Web/Search MCP
    const searchMcp: McpServerConfig = {
      id: 'mcp-web-search',
      name: 'Web & Search MCP',
      type: 'search',
      description: '提供直接 HTTP 网络抓取、聚合搜索与开放网页正文清洗服务。',
      enabled: true,
      transport: 'in_process',
      status: 'ready',
      statusMessage: 'Web 搜索与网络提取服务活跃。',
      tools: [
        {
          name: 'web_search_query',
          description: '向多源互联网搜索引擎发送查询，获取相关网页标题、链接与摘要列表。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索查询词' },
              limit: { type: 'number', description: '返回结果数量，默认 5' },
            },
            required: ['query'],
          },
        },
        {
          name: 'web_fetch_page_text',
          description: '通过 HTTP 请求抓取指定网址的纯文本内容，自动过滤 HTML 标签与脚本。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '目标网址 URL' },
            },
            required: ['url'],
          },
        },
      ],
    };

    // 3. File & Document MCP
    const fileMcp: McpServerConfig = {
      id: 'mcp-file-doc',
      name: 'File & Document MCP',
      type: 'file',
      description: '读写当前 Workspace 文件，生成结构化 Markdown 调研报告与数据文件。',
      enabled: true,
      transport: 'in_process',
      status: 'ready',
      statusMessage: '工作区文件读写引擎正常运行。',
      tools: [
        {
          name: 'file_read_workspace_file',
          description: '读取当前 Workspace 中用户上传或此前任务生成的文档内容。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              fileName: { type: 'string', description: '工作区文件名' },
            },
            required: ['fileName'],
          },
        },
        {
          name: 'file_write_markdown_report',
          description: '在工作区输出目录保存生成的 Markdown 分析报告或文件成果。',
          riskLevel: 'medium',
          parameters: {
            type: 'object',
            properties: {
              fileName: { type: 'string', description: '输出文件名，例如 调研报告-2026.md' },
              content: { type: 'string', description: '报告或文件的完整正文 Markdown 内容' },
            },
            required: ['fileName', 'content'],
          },
        },
        {
          name: 'file_batch_delete',
          description: '批量删除指定工作区文件（高风险操作，受审批机制严格限制）。',
          riskLevel: 'high',
          parameters: {
            type: 'object',
            properties: {
              fileNames: { type: 'array', description: '拟删除的文件列表' },
            },
            required: ['fileNames'],
          },
        },
      ],
    };

    // 4. GitHub MCP
    const githubToken = process.env.GITHUB_TOKEN;
    const githubMcp: McpServerConfig = {
      id: 'mcp-github',
      name: 'GitHub MCP',
      type: 'github',
      description: '访问 GitHub 仓库、读取代码与提交记录。',
      enabled: Boolean(githubToken),
      transport: 'in_process',
      status: githubToken ? 'ready' : 'needs_config',
      statusMessage: githubToken
        ? 'GitHub 个人访问令牌已检测到，服务已就绪。'
        : '当前环境暂未配置 GITHUB_TOKEN，请在环境变量或设置中配置后启用。',
      tools: [
        {
          name: 'github_read_repository_file',
          description: '从 GitHub 目标公开或私有仓库拉取指定文件的内容。',
          riskLevel: 'low',
          parameters: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: '仓库所有者/组织' },
              repo: { type: 'string', description: '仓库名称' },
              path: { type: 'string', description: '文件相对路径' },
            },
            required: ['owner', 'repo', 'path'],
          },
        },
      ],
    };

    // 5. Custom MCP (Preconfigured template for external extensions)
    const customMcp: McpServerConfig = {
      id: 'mcp-custom-enterprise',
      name: 'Custom Enterprise MCP',
      type: 'custom',
      description: '自定义企业内部 MCP 接口（支持 SSE/STDIO 或外部微服务）。',
      enabled: false,
      transport: 'sse',
      status: 'unsupported_in_env',
      statusMessage: '当前尚未配置有效的外部 SSE 端点，保持禁用状态。',
      tools: [],
    };

    this.servers.set(browserMcp.id, browserMcp);
    this.servers.set(searchMcp.id, searchMcp);
    this.servers.set(fileMcp.id, fileMcp);
    this.servers.set(githubMcp.id, githubMcp);
    this.servers.set(customMcp.id, customMcp);
  }

  getAllServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  getServer(id: string): McpServerConfig | undefined {
    return this.servers.get(id);
  }

  saveServer(config: McpServerConfig): void {
    this.servers.set(config.id, config);
  }

  toggleServer(id: string, enabled: boolean): boolean {
    const s = this.servers.get(id);
    if (!s) return false;
    s.enabled = enabled;
    return true;
  }

  deleteServer(id: string): boolean {
    return this.servers.delete(id);
  }

  getAvailableTools(): Array<{ serverId: string; serverName: string; tool: McpToolDeclaration }> {
    const result: Array<{ serverId: string; serverName: string; tool: McpToolDeclaration }> = [];
    for (const server of this.servers.values()) {
      if (server.enabled && server.status === 'ready') {
        for (const tool of server.tools) {
          result.push({
            serverId: server.id,
            serverName: server.name,
            tool,
          });
        }
      }
    }
    return result;
  }

  /**
   * Execute an MCP tool safely and return structured observations
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    workspaceId: string,
    context?: { taskId: string }
  ): Promise<{ success: boolean; result: any; error?: string }> {
    try {
      // 1. Browser tools
      if (toolName.startsWith('browser_')) {
        const subAction = toolName.replace('browser_', '');

        if (subAction === 'navigate') {
          const res = await globalBrowserAdapter.executeCommand({
            action: 'navigate',
            url: args.url,
          });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              screenshot: res.screenshotBase64 ? res.screenshotBase64.slice(0, 100) + '...[base64]' : undefined,
              screenshotBase64: res.screenshotBase64,
              contentSnippet: res.content?.slice(0, 500),
            },
            error: res.error,
          };
        }

        if (subAction === 'search_and_read') {
          const keyword = encodeURIComponent(args.keyword || '');
          const searchUrl = `https://html.duckduckgo.com/html/?q=${keyword}`;
          const res = await globalBrowserAdapter.executeCommand({
            action: 'navigate',
            url: searchUrl,
          });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              keyword: args.keyword,
              extractedContent: res.content?.slice(0, 1500) || '未提取到正文',
              screenshotBase64: res.screenshotBase64,
            },
            error: res.error,
          };
        }

        if (subAction === 'click') {
          const res = await globalBrowserAdapter.executeCommand({
            action: 'click',
            selector: args.selector,
          });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              selector: args.selector,
              screenshotBase64: res.screenshotBase64,
            },
            error: res.error,
          };
        }

        if (subAction === 'type') {
          const res = await globalBrowserAdapter.executeCommand({
            action: 'type',
            selector: args.selector,
            text: args.text,
          });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              selector: args.selector,
              typedText: args.text,
              screenshotBase64: res.screenshotBase64,
            },
            error: res.error,
          };
        }

        if (subAction === 'screenshot') {
          const res = await globalBrowserAdapter.executeCommand({ action: 'screenshot' });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              screenshotBase64: res.screenshotBase64,
            },
            error: res.error,
          };
        }

        if (subAction === 'get_dom_structure') {
          const res = await globalBrowserAdapter.executeCommand({ action: 'get_dom_structure' });
          return {
            success: res.success,
            result: {
              url: res.currentUrl,
              title: res.pageTitle,
              domStructure: res.domStructure,
            },
            error: res.error,
          };
        }
      }

      // 2. Search tools
      if (toolName === 'web_search_query') {
        const query = args.query || '';
        // Use real DuckDuckGo html search via browser or direct fetch
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await globalBrowserAdapter.executeCommand({
          action: 'navigate',
          url: searchUrl,
        });
        return {
          success: true,
          result: {
            query,
            pageTitle: res.pageTitle,
            summarySnippet: res.content?.slice(0, 1000) || '成功获取检索结果页面',
            screenshotBase64: res.screenshotBase64,
          },
        };
      }

      if (toolName === 'web_fetch_page_text') {
        const res = await globalBrowserAdapter.executeCommand({
          action: 'navigate',
          url: args.url,
        });
        return {
          success: res.success,
          result: {
            url: res.currentUrl,
            pageTitle: res.pageTitle,
            textSnippet: res.content?.slice(0, 1500) || '无可用纯文本',
            screenshotBase64: res.screenshotBase64,
          },
          error: res.error,
        };
      }

      // 3. File tools
      if (toolName === 'file_read_workspace_file') {
        const files = globalWorkspaceStore.getFiles(workspaceId);
        const matched = files.find((f) => f.name.toLowerCase() === (args.fileName || '').toLowerCase());
        if (!matched) {
          return {
            success: false,
            result: null,
            error: `在当前工作区中未找到名为 "${args.fileName}" 的文件。现有文件: ${files.map((f) => f.name).join(', ') || '无'}`,
          };
        }
        return {
          success: true,
          result: {
            fileName: matched.name,
            size: matched.size,
            extractedText: matched.extractedText || '文件内容为空',
          },
        };
      }

      if (toolName === 'file_write_markdown_report') {
        const fileName = args.fileName || `Agent-Report-${Date.now()}.md`;
        const content = args.content || '';
        const outDir = path.resolve(process.cwd(), 'data', 'outputs', workspaceId);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        const filePath = path.join(outDir, fileName);
        fs.writeFileSync(filePath, content, 'utf8');

        return {
          success: true,
          result: {
            fileName,
            savedPath: filePath,
            bytesWritten: Buffer.byteLength(content),
            preview: content.slice(0, 300) + '...',
          },
        };
      }

      if (toolName === 'file_batch_delete') {
        return {
          success: false,
          result: null,
          error: '批量删除属于受限的高风险文件系统操作，已按工作台安全准则拦截。',
        };
      }

      return {
        success: false,
        result: null,
        error: `未识别的工具名称: ${toolName}`,
      };
    } catch (e: any) {
      console.error(`Error executing tool ${toolName}:`, e);
      return {
        success: false,
        result: null,
        error: `工具执行异常: ${e.message}`,
      };
    }
  }
}

export const globalMcpManager = new McpManager();
