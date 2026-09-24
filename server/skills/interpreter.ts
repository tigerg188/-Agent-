import path from 'path';
import { RawProjectDiscovery } from './discovery';
import {
  SkillProjectMap,
  RuntimeIntent,
  RelationshipGraph,
  RelationshipNode,
  RelationshipEdge,
} from './types';

export class SkillProjectInterpreter {
  /**
   * Helper to parse YAML frontmatter from markdown
   */
  private parseFrontmatter(markdown: string): { frontmatter: Record<string, any>; body: string } {
    const trimmed = markdown.trim();
    if (!trimmed.startsWith('---')) {
      return { frontmatter: {}, body: trimmed };
    }

    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) {
      return { frontmatter: {}, body: trimmed };
    }

    const yamlStr = trimmed.slice(3, endIdx).trim();
    const body = trimmed.slice(endIdx + 3).trim();

    const frontmatter: Record<string, any> = {};
    for (const line of yamlStr.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        frontmatter[key] = value;
      }
    }

    return { frontmatter, body };
  }

  /**
   * Interpret a raw project discovery into a structured SkillProjectMap and RuntimeIntent
   */
  interpret(raw: RawProjectDiscovery): {
    projectMap: SkillProjectMap;
    runtimeIntent: RuntimeIntent;
  } {
    const { files, manifests, readmeContent, rootSkillMdContent, allSkillMds, inferredProjectName } = raw;

    // 1. Identify primary manifest if any
    let packManifest: any = null;
    for (const [k, v] of Object.entries(manifests)) {
      if (
        k.toLowerCase().endsWith('release-manifest.json') ||
        k.toLowerCase().endsWith('skill-pack.json') ||
        k.toLowerCase().endsWith('manifest.json')
      ) {
        packManifest = v;
        break;
      }
    }

    // 2. Identify Project Name and Display Name
    const projectName =
      packManifest?.repository_slug ||
      packManifest?.name ||
      inferredProjectName ||
      'skill-project';
    const projectDisplayName =
      packManifest?.display_name ||
      (readmeContent ? this.extractTitleFromMarkdown(readmeContent) : null) ||
      projectName;
    const projectDescription =
      packManifest?.description ||
      (readmeContent ? this.extractSummaryFromMarkdown(readmeContent) : null) ||
      (rootSkillMdContent ? this.extractSummaryFromMarkdown(rootSkillMdContent) : null) ||
      `${projectDisplayName} 技能项目`;

    // 3. Collect Supporting Resources
    const references: Array<{ path: string; size: number; name: string }> = [];
    const templates: Array<{ path: string; size: number; name: string }> = [];
    const examples: Array<{ path: string; size: number; name: string }> = [];
    const scripts: Array<{ path: string; size: number; name: string; runtime: string }> = [];
    const configs: Array<{ path: string; size: number; name: string }> = [];

    for (const file of files) {
      const lower = file.path.toLowerCase();
      const base = path.basename(file.path);

      if (lower.includes('/references/') || lower.startsWith('references/')) {
        references.push({ path: file.path, size: file.size, name: base });
      } else if (lower.includes('/templates/') || lower.startsWith('templates/')) {
        templates.push({ path: file.path, size: file.size, name: base });
      } else if (lower.includes('/examples/') || lower.startsWith('examples/')) {
        examples.push({ path: file.path, size: file.size, name: base });
      } else if (lower.includes('/scripts/') || lower.startsWith('scripts/') || lower.endsWith('.py') || lower.endsWith('.sh')) {
        const runtime = lower.endsWith('.py') ? 'python' : lower.endsWith('.sh') ? 'bash' : 'node';
        scripts.push({ path: file.path, size: file.size, name: base, runtime });
      } else if (
        lower.endsWith('.json') ||
        lower.endsWith('.yaml') ||
        lower.endsWith('.yml') ||
        lower.endsWith('.toml') ||
        lower.includes('config') ||
        base.startsWith('.env')
      ) {
        configs.push({ path: file.path, size: file.size, name: base });
      }
    }

    // 4. Parse all discovered SKILL.md entries
    interface ParsedSkillInfo {
      id: string;
      name: string;
      displayName: string;
      description: string;
      path: string;
      category?: string;
      role: 'router' | 'specialty' | 'subskill' | 'standalone';
      content: string;
      contentPreview: string;
    }

    const parsedSkills: ParsedSkillInfo[] = [];

    for (const item of allSkillMds) {
      const { frontmatter, body } = this.parseFrontmatter(item.content);
      const dirOfSkill = path.dirname(item.path);
      const folderName = dirOfSkill === '.' ? '' : path.basename(dirOfSkill);

      const name = String(frontmatter.name || folderName || 'skill').trim();
      const displayName = frontmatter.displayName || frontmatter.title || name;
      const description = frontmatter.description
        ? String(frontmatter.description).trim()
        : this.extractSummaryFromMarkdown(body) || `${displayName} 执行规范`;
      const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const category = frontmatter.category || (allSkillMds.length > 1 ? '专项研究' : '通用技能');

      parsedSkills.push({
        id,
        name,
        displayName,
        description,
        path: item.path,
        category,
        role: 'standalone',
        content: item.content,
        contentPreview: item.content.slice(0, 500),
      });
    }

    // 5. Identify Main Entry vs Child Skills
    let entrySkillName = packManifest?.entry_skill;

    if (!entrySkillName) {
      // Heuristic 1: Look for explicit router or master declaration in skills
      const routerMatch = parsedSkills.find((s) => {
        const text = (s.name + ' ' + s.displayName + ' ' + s.description + ' ' + s.content).toLowerCase();
        return (
          text.includes('总路由') ||
          text.includes('总入口') ||
          text.includes('router') ||
          text.includes('主入口') ||
          s.name.endsWith('-researcher') ||
          s.name === 'researcher'
        );
      });
      if (routerMatch) {
        entrySkillName = routerMatch.name;
      }
    }

    if (!entrySkillName && parsedSkills.length > 0) {
      // Heuristic 2: Check root SKILL.md
      const rootSkill = parsedSkills.find((s) => s.path.toLowerCase() === 'skill.md');
      if (rootSkill) {
        entrySkillName = rootSkill.name;
      } else {
        entrySkillName = parsedSkills[0].name;
      }
    }

    let mainEntrySkill = parsedSkills.find((s) => s.name === entrySkillName || s.id === entrySkillName);
    if (!mainEntrySkill && parsedSkills.length > 0) {
      mainEntrySkill = parsedSkills[0];
    }

    // If still no SKILL.md at all, fabricate a virtual entry from README
    if (!mainEntrySkill) {
      mainEntrySkill = {
        id: projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: projectName,
        displayName: projectDisplayName,
        description: projectDescription,
        path: 'README.md',
        category: '文档驱动项目',
        role: 'standalone',
        content: readmeContent || '# ' + projectDisplayName,
        contentPreview: (readmeContent || '').slice(0, 500),
      };
      parsedSkills.push(mainEntrySkill);
    }

    // Assign roles: Main entry is router/main, rest are specialty or subskill
    mainEntrySkill.role = parsedSkills.length > 1 ? 'router' : 'standalone';
    const childSkills = parsedSkills
      .filter((s) => s.id !== mainEntrySkill!.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        path: s.path,
        role: (mainEntrySkill!.role === 'router' ? 'specialty' : 'subskill') as 'specialty' | 'subskill',
        category: s.category,
        contentPreview: s.contentPreview,
      }));

    // 6. Determine Project Type
    let projectType: SkillProjectMap['projectType'] = 'single_skill';
    if (parsedSkills.length > 1 || packManifest?.entry_skill) {
      projectType = 'skill_pack';
    } else if (scripts.length > 0) {
      projectType = 'script_skill';
    } else if (files.some((f) => f.path.includes('workflows/'))) {
      projectType = 'agent_workflow';
    } else {
      projectType = 'prompt_skill';
    }

    // 7. Detect Dependencies & Tools
    const fullTextScan = files
      .filter((f) => f.content)
      .map((f) => f.content!)
      .join('\n')
      .toLowerCase();

    const npmDeps: string[] = [];
    const pipDeps: string[] = [];
    const envVars: string[] = [];
    const requiredTools: string[] = [];
    const mcpRequirements: string[] = [];

    // Check package.json
    for (const [k, v] of Object.entries(manifests)) {
      if (k.endsWith('package.json') && typeof v === 'object') {
        const deps = { ...v.dependencies, ...v.devDependencies };
        npmDeps.push(...Object.keys(deps));
      }
    }

    // Check requirements.txt
    const reqFile = files.find((f) => f.path.toLowerCase().endsWith('requirements.txt'));
    if (reqFile && reqFile.content) {
      for (const line of reqFile.content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          pipDeps.push(trimmed.split(/[=<>~]/)[0].trim());
        }
      }
    }

    // Check .env.example
    const envFile = files.find((f) => f.path.toLowerCase().includes('.env'));
    if (envFile && envFile.content) {
      for (const line of envFile.content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          envVars.push(trimmed.split('=')[0].trim());
        }
      }
    }

    // Detect Tooling requirements from content
    const needsBrowser =
      fullTextScan.includes('browser') ||
      fullTextScan.includes('playwright') ||
      fullTextScan.includes('puppeteer') ||
      fullTextScan.includes('网页浏览') ||
      fullTextScan.includes('真实浏览器') ||
      fullTextScan.includes('dom') ||
      fullTextScan.includes('html');

    const needsSearch =
      fullTextScan.includes('search') ||
      fullTextScan.includes('搜索') ||
      fullTextScan.includes('公开信息') ||
      fullTextScan.includes('网络检索') ||
      fullTextScan.includes('industry-research');

    const needsFiles =
      fullTextScan.includes('excel') ||
      fullTextScan.includes('xlsx') ||
      fullTextScan.includes('markdown') ||
      fullTextScan.includes('文件') ||
      fullTextScan.includes('报告交付');

    if (needsBrowser) {
      requiredTools.push('Browser Automation Tool (Playwright/Chrome)');
      mcpRequirements.push('Browser MCP');
    }
    if (needsSearch) {
      requiredTools.push('Web Search Tool (Google/Bing/SearXNG)');
      mcpRequirements.push('Search MCP');
    }
    if (needsFiles) {
      requiredTools.push('Document & File Processor (Markdown/XLSX/PDF)');
      mcpRequirements.push('File MCP');
    }
    requiredTools.push('Gemini AI Inference Adapter');

    // 8. Build Relationship Graph
    const nodes: RelationshipNode[] = [];
    const edges: RelationshipEdge[] = [];

    // Main Entry node
    nodes.push({
      id: mainEntrySkill.id,
      label: mainEntrySkill.displayName || mainEntrySkill.name,
      type: 'main_entry',
      role: mainEntrySkill.role,
    });

    // Child Skills nodes and edges
    for (const child of childSkills) {
      nodes.push({
        id: child.id,
        label: child.displayName || child.name,
        type: 'child_skill',
        role: child.role,
      });

      edges.push({
        from: mainEntrySkill.id,
        to: child.id,
        type: 'orchestrates',
        label: '调度专项分析',
      });
    }

    // Tools nodes
    for (const mcp of mcpRequirements) {
      const toolId = `tool-${mcp.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      nodes.push({
        id: toolId,
        label: mcp,
        type: 'mcp',
      });

      edges.push({
        from: mainEntrySkill.id,
        to: toolId,
        type: 'uses_tool',
        label: '调用工具能力',
      });
    }

    // Structure Type
    const structureType: RelationshipGraph['structureType'] =
      childSkills.length > 5 ? 'tree' : childSkills.length > 0 ? 'parallel' : 'chain';

    const relationshipGraph: RelationshipGraph = {
      structureType,
      nodes,
      edges,
    };

    // 9. Build Runtime Intent (Understanding author intent without altering files)
    const authorIntent =
      projectDescription ||
      `利用 ${mainEntrySkill.displayName} 统筹协同各专业子能力，产出高质量可交付分析报告。`;

    const methods: string[] = [];
    if (mainEntrySkill.role === 'router') {
      methods.push('总路由调度与任务开题分析');
      methods.push('分派子专业专项深度研判');
      methods.push('交叉核对多源数据与置信度审计');
      methods.push('统筹汇总生成结构化主报告');
    } else {
      methods.push('单体专业规范引导执行');
      methods.push('按照 SKILL.md 定义的操作流程逐步落实');
    }

    const sequence = [
      {
        stepNumber: 1,
        title: '任务拆解与研究范围界定',
        skillOrTool: mainEntrySkill.name,
        action: '提取用户核心问题，划定研究标的、基准时间与边界',
        expectedOutput: '明确开题界定与分析框架',
      },
      {
        stepNumber: 2,
        title: '全网一手事实检索与数据采集',
        skillOrTool: 'Search & Browser Tools',
        action: '结合行业关键词与权威渠道抓取最新行业指标与事实',
        expectedOutput: '真实可查证的来源数据底表',
      },
      {
        stepNumber: 3,
        title: childSkills.length > 0 ? `调度下属 ${childSkills.length} 个专项分支深度分析` : '执行专业方法论推演',
        skillOrTool: childSkills.length > 0 ? childSkills.slice(0, 3).map((s) => s.name).join(', ') : mainEntrySkill.name,
        action: '依据各专项 SKILL.md 规范进行测算、对比及图谱绘制',
        expectedOutput: '专项核心结论与量化指标',
      },
      {
        stepNumber: 4,
        title: '交叉验证与结构化报告生成',
        skillOrTool: 'File & Markdown Compiler',
        action: '将事实、假设、测算与推论汇总为 Markdown 主报告',
        expectedOutput: '排版严谨的结构化研究交付物',
      },
    ];

    const runtimeIntent: RuntimeIntent = {
      goal: `根据「${projectDisplayName}」的项目规范，系统化执行用户委托任务并输出严谨结论。`,
      authorIntent,
      inputs: [
        { name: '任务主题或研究标的', description: '如指定行业、企业、产品或合同文本', required: true },
        { name: '交付要求', description: '报告深度、关键侧重点或限定时间范围', required: false },
      ],
      methods,
      skills: parsedSkills.map((s) => ({
        id: s.id,
        name: s.displayName || s.name,
        role: s.role,
        purpose: s.description,
      })),
      tools: requiredTools,
      sequence,
      dependencies: [...npmDeps, ...pipDeps],
      outputs: [
        { name: 'Markdown 专业主报告', format: 'markdown', description: '包含核心结论、推导过程与证据链' },
        ...(templates.length > 0 ? [{ name: '标准模板交付物', format: 'template/xlsx', description: '配套工作底表或模板格式' }] : []),
      ],
      verification: [
        { check: '证据来源可溯源性', standard: '每项关键数据需具备一手出处与基准日期' },
        { check: '各专项结论一致性', standard: '子模块测算与总报告结论逻辑自洽' },
      ],
      constraints: [
        '不得凭空臆造未核实的数据或引用',
        '必须显式记录研究时间基准与数据有效区间',
        '若存在未解决信息缺口需如实披露限制',
      ],
      risks: [
        '数据公开度有限可能需要扩大搜索广度',
        '多源数据可能存在统计口径冲突，需以权威官方为主',
      ],
      completionCriteria: [
        '覆盖任务核心诉求',
        '产出符合规范的结构化报告文档',
        '通过证据与方法完整性自检',
      ],
    };

    // 10. Assemble complete SkillProjectMap
    const projectMap: SkillProjectMap = {
      projectId: projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      projectName,
      projectType,
      projectDescription,
      version: packManifest?.version || '1.0.0',
      author: packManifest?.author || packManifest?.maintainer,
      sourceType: raw.sourceType,
      sourceUrl: raw.sourceUrl,

      mainEntry: {
        id: mainEntrySkill.id,
        name: mainEntrySkill.name,
        displayName: mainEntrySkill.displayName || mainEntrySkill.name,
        path: mainEntrySkill.path,
        description: mainEntrySkill.description,
        role: mainEntrySkill.role === 'router' ? 'router' : 'main',
        contentPreview: mainEntrySkill.contentPreview,
      },

      childSkills,

      supportingResources: {
        references,
        templates,
        examples,
        scripts,
        configs,
      },

      dependencies: {
        runtime: ['Node.js >= 18', ...(pipDeps.length > 0 || scripts.some((s) => s.runtime === 'python') ? ['Python 3.9+'] : [])],
        npm: npmDeps,
        pip: pipDeps,
        envVars,
        systemTools: ['git'],
      },

      requiredTools,
      mcpRequirements,
      browserRequirements: {
        needed: needsBrowser,
        reason: needsBrowser ? '需要通过真实浏览器访问目标站点并提取实时内容' : '无需浏览器交互',
      },
      externalServices: ['Gemini 2.5/3.0 推理网关'],

      relationshipGraph,
      installationSteps: [
        '勘探项目边界与文件清单',
        '提取总路由主入口与下属专项分支',
        '验证依赖与工具链适配状态',
        '构建运行时意图 (Runtime Intent) 与拓扑映射',
        '安全存入本地技能项目库',
      ],
      executionSteps: sequence.map((s) => s.title),
      outputExpectation: runtimeIntent.outputs.map((o) => `${o.name} (${o.format})`),
      verificationExpectation: runtimeIntent.verification.map((v) => v.check),

      scannedFilesCount: files.length,
    };

    return {
      projectMap,
      runtimeIntent,
    };
  }

  private extractTitleFromMarkdown(md: string): string | null {
    for (const line of md.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.replace(/^#\s+/, '').trim();
      }
    }
    return null;
  }

  private extractSummaryFromMarkdown(md: string): string | null {
    let started = false;
    const lines: string[] = [];

    for (const line of md.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        started = true;
        continue;
      }
      if (started && trimmed && !trimmed.startsWith('```') && !trimmed.startsWith('![')) {
        lines.push(trimmed);
        if (lines.length >= 2) break;
      }
    }

    return lines.length > 0 ? lines.join(' ') : null;
  }
}

export const globalSkillProjectInterpreter = new SkillProjectInterpreter();
