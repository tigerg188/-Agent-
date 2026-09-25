import path from 'path';
import crypto from 'crypto';
import type { RawProjectDiscovery } from './discovery';
import {
  SkillProjectMap,
  SkillProjectType,
  SkillEntry,
  SkillRelationship,
  EntryCandidate,
  ScriptInfo,
  ResourceInfo,
  DependencyInfo,
  EnvironmentRequirement,
  ToolRequirement,
  CompatibilityProfile,
  RelationshipGraph,
  RelationshipNode,
  RelationshipEdge,
  RuntimeIntent,
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

  private extractTitleFromMarkdown(md: string): string | null {
    const lines = md.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.slice(2).trim();
      }
    }
    return null;
  }

  private extractSummaryFromMarkdown(md: string): string | null {
    const lines = md.split('\n');
    let titlePassed = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        titlePassed = true;
        continue;
      }
      if (titlePassed && trimmed.length > 15 && !trimmed.startsWith('```') && !trimmed.startsWith('>')) {
        return trimmed.slice(0, 160);
      }
    }
    return null;
  }

  private generateStableSkillId(filePath: string): string {
    const hash = crypto.createHash('sha256').update(filePath.toLowerCase().trim()).digest('hex');
    return `skill_${hash.slice(0, 12)}`;
  }

  /**
   * Section 14: Graph Validation & Cycle Detection
   */
  private validateAndAnalyzeGraph(nodes: RelationshipNode[], edges: RelationshipEdge[]): {
    cleanEdges: RelationshipEdge[];
    hasCycle: boolean;
    cycleNodes: string[];
    topologicalOrder: string[];
  } {
    // 1. Remove duplicate edges & self references
    const cleanEdges: RelationshipEdge[] = [];
    const edgeKeySet = new Set<string>();

    for (const edge of edges) {
      if (edge.from === edge.to) {
        continue; // Discard self-reference
      }
      const key = `${edge.from}->${edge.to}:${edge.type}`;
      if (!edgeKeySet.has(key)) {
        edgeKeySet.add(key);
        cleanEdges.push(edge);
      }
    }

    // 2. Build adjacency list for dependency tracking
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of cleanEdges) {
      if (!adj.has(edge.from)) adj.set(edge.from, []);
      if (!inDegree.has(edge.to)) inDegree.set(edge.to, 0);

      adj.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // 3. Cycle Detection using DFS
    const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
    let hasCycle = false;
    const cycleNodes: string[] = [];

    const dfs = (nodeId: string, path: string[]) => {
      visited.set(nodeId, 1);
      const neighbors = adj.get(nodeId) || [];

      for (const n of neighbors) {
        const state = visited.get(n) || 0;
        if (state === 1) {
          hasCycle = true;
          const cycleStart = path.indexOf(n);
          if (cycleStart !== -1) {
            cycleNodes.push(...path.slice(cycleStart), n);
          } else {
            cycleNodes.push(nodeId, n);
          }
        } else if (state === 0) {
          dfs(n, [...path, n]);
        }
      }
      visited.set(nodeId, 2);
    };

    for (const node of nodes) {
      if ((visited.get(node.id) || 0) === 0) {
        dfs(node.id, [node.id]);
      }
    }

    // 4. Topological Sort (Kahn's algorithm)
    const topologicalOrder: string[] = [];
    const inDegCopy = new Map(inDegree);
    const queue: string[] = [];

    for (const [id, deg] of inDegCopy.entries()) {
      if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      topologicalOrder.push(u);

      for (const v of adj.get(u) || []) {
        inDegCopy.set(v, inDegCopy.get(v)! - 1);
        if (inDegCopy.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    return {
      cleanEdges,
      hasCycle,
      cycleNodes: Array.from(new Set(cycleNodes)),
      topologicalOrder,
    };
  }

  /**
   * Main Interpret entrypoint
   */
  interpret(raw: RawProjectDiscovery): {
    projectMap: SkillProjectMap;
    runtimeIntent: RuntimeIntent;
  } {
    const {
      files,
      manifests,
      readmeContent,
      rootSkillMdContent,
      allSkillMds,
      inferredProjectName,
      entryCandidates,
      sourceType,
      sourceUrl,
    } = raw;

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
      `${projectDisplayName} 异构技能项目`;

    // 3. Collect Supporting Resources
    const references: ResourceInfo[] = [];
    const templates: ResourceInfo[] = [];
    const examples: ResourceInfo[] = [];
    const scripts: ScriptInfo[] = [];
    const configs: ResourceInfo[] = [];

    for (const file of files) {
      const lower = file.path.toLowerCase();
      const base = path.basename(file.path);

      if (lower.includes('/references/') || lower.startsWith('references/')) {
        references.push({ path: file.path, size: file.size, name: base, type: 'reference' });
      } else if (lower.includes('/templates/') || lower.startsWith('templates/')) {
        templates.push({ path: file.path, size: file.size, name: base, type: 'template' });
      } else if (lower.includes('/examples/') || lower.startsWith('examples/')) {
        examples.push({ path: file.path, size: file.size, name: base, type: 'example' });
      } else if (lower.includes('/scripts/') || lower.startsWith('scripts/') || lower.endsWith('.py') || lower.endsWith('.sh') || lower.endsWith('.js')) {
        const runtime = lower.endsWith('.py') ? 'python' : lower.endsWith('.sh') ? 'bash' : 'node';
        scripts.push({ path: file.path, size: file.size, name: base, runtime });
      } else if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.toml')) {
        configs.push({ path: file.path, size: file.size, name: base, type: 'config' });
      }
    }

    // 4. Parse all Skill Entries with Stable IDs
    const parsedEntries: SkillEntry[] = [];
    for (const item of allSkillMds) {
      const { frontmatter, body } = this.parseFrontmatter(item.content);
      const dirOfSkill = path.dirname(item.path);
      const folderName = dirOfSkill === '.' ? '' : path.basename(dirOfSkill);

      const name = String(frontmatter.name || folderName || 'skill').trim();
      const displayName = frontmatter.displayName || frontmatter.title || name;
      const description = frontmatter.description
        ? String(frontmatter.description).trim()
        : this.extractSummaryFromMarkdown(body) || `${displayName} 专业规范`;
      const id = this.generateStableSkillId(item.path);
      const category = frontmatter.category || (allSkillMds.length > 1 ? '专项分析' : '通用技能');

      parsedEntries.push({
        id,
        name,
        displayName,
        description,
        path: item.path,
        type: 'skill',
        category,
        role: 'subskill',
        content: item.content,
        contentPreview: item.content.slice(0, 500),
      });
    }

    // 5. Section 9: Select Best Main Entry from Scored Candidates
    let mainCandidate: EntryCandidate | null = null;
    if (entryCandidates && entryCandidates.length > 0) {
      mainCandidate = entryCandidates[0];
    } else if (parsedEntries.length > 0) {
      mainCandidate = {
        path: parsedEntries[0].path,
        score: 50,
        evidence: ['唯一 SKILL.md 文件'],
        reason: 'Default first entry',
      };
    }

    let mainEntrySkill = parsedEntries.find((s) => s.path === mainCandidate?.path);
    if (!mainEntrySkill && parsedEntries.length > 0) {
      mainEntrySkill = parsedEntries[0];
    }

    // If still no SKILL.md, fallback virtual entry from README
    if (!mainEntrySkill) {
      const vId = this.generateStableSkillId('README.md');
      mainEntrySkill = {
        id: vId,
        name: projectName,
        displayName: projectDisplayName,
        description: projectDescription,
        path: 'README.md',
        type: 'skill',
        category: '文档驱动项目',
        role: 'standalone',
        content: readmeContent || '# ' + projectDisplayName,
        contentPreview: (readmeContent || '').slice(0, 500),
      };
      parsedEntries.push(mainEntrySkill);
    }

    mainEntrySkill.role = parsedEntries.length > 1 ? 'router' : 'standalone';

    // 6. Section 8: Determine Project Type
    let projectType: SkillProjectType = 'skill';
    if (parsedEntries.length > 1 || packManifest?.entry_skill) {
      projectType = 'skill-pack';
    } else if (scripts.length > 0) {
      projectType = 'script-project';
    } else if (files.some((f) => f.path.includes('workflows/'))) {
      projectType = 'workflow';
    } else if (files.some((f) => f.path.endsWith('.mcp.json') || f.path.endsWith('mcp.json'))) {
      projectType = 'agent';
    } else {
      projectType = 'skill';
    }

    // 7. Detect Dependencies & Tools
    const fullTextScan = files
      .filter((f) => f.content)
      .map((f) => f.content!)
      .join('\n')
      .toLowerCase();

    const dependencies: DependencyInfo[] = [];
    const environment: EnvironmentRequirement[] = [];
    const tools: ToolRequirement[] = [];

    // Manifest deps
    for (const [k, v] of Object.entries(manifests)) {
      if (k.endsWith('package.json') && typeof v === 'object') {
        const deps = { ...v.dependencies, ...v.devDependencies };
        for (const dep of Object.keys(deps)) {
          dependencies.push({ name: dep, type: 'npm', required: true, version: deps[dep] });
        }
        environment.push({ runtime: 'node', required: true, source: k });
      } else if (k.endsWith('requirements.txt') && typeof v === 'string') {
        for (const line of v.split('\n')) {
          const clean = line.trim();
          if (clean && !clean.startsWith('#')) {
            dependencies.push({ name: clean, type: 'pip', required: true });
          }
        }
        environment.push({ runtime: 'python', required: true, source: k });
      }
    }

    // Tools detection based on explicit capability declarations
    const hasExplicitBrowserRequirement =
      fullTextScan.includes('playwright') ||
      fullTextScan.includes('puppeteer') ||
      fullTextScan.includes('web search') ||
      fullTextScan.includes('browser') ||
      fullTextScan.includes('网页检索') ||
      fullTextScan.includes('网络检索') ||
      fullTextScan.includes('实时搜索');

    if (hasExplicitBrowserRequirement) {
      tools.push({ name: 'Web Browser & Search MCP', type: 'browser', required: true, reason: '行业前沿情报采集与网页检索' });
      environment.push({ runtime: 'playwright', required: false, source: 'tool_requirement' });
    }

    if (scripts.length > 0) {
      tools.push({ name: 'Local Script Runner', type: 'script', required: false, reason: '本地 Python/Node 工具脚本执行' });
    }

    tools.push({ name: 'Document & Artifact Bus', type: 'filesystem', required: true, reason: '跨技能结构化产物生成与传递' });
    tools.push({ name: 'Gemini Model Adapter', type: 'model', required: true, reason: '专业逻辑推理与结论综合' });

    // 8. Section 12 & 13: Build Semantic Relationships Graph
    // Distinguish DECLARED (explicitly stated in manifest/SKILL.md) vs INFERRED
    const nodes: RelationshipNode[] = [];
    const rawEdges: RelationshipEdge[] = [];
    const relationships: SkillRelationship[] = [];

    // Add Main Entry Node
    nodes.push({
      id: mainEntrySkill.id,
      label: mainEntrySkill.displayName || mainEntrySkill.name,
      type: 'main_entry',
      role: mainEntrySkill.role,
    });

    // Check if main entry's SKILL.md explicitly mentions child skill names/paths
    const mainContent = (mainEntrySkill.content || '').toLowerCase();

    // Add Child Skills Nodes and Relationships
    for (const entry of parsedEntries) {
      if (entry.id === mainEntrySkill.id) continue;

      nodes.push({
        id: entry.id,
        label: entry.displayName || entry.name,
        type: 'child_skill',
        role: 'subskill',
      });

      // Check whether this relationship is declared in the main manifest/docs or structurally inferred
      const isExplicitlyReferenced =
        mainContent.includes(entry.name.toLowerCase()) ||
        mainContent.includes(entry.path.toLowerCase()) ||
        (entry.displayName && mainContent.includes(entry.displayName.toLowerCase()));

      const origin: 'declared' | 'inferred' = isExplicitlyReferenced ? 'declared' : 'inferred';
      const confidence = isExplicitlyReferenced ? 0.90 : 0.60;

      const rel: SkillRelationship = {
        from: mainEntrySkill.id,
        to: entry.id,
        type: 'invoke',
        origin,
        confidence,
        evidence: [
          isExplicitlyReferenced
            ? `主入口文档显式声明或引用专项分支技能 ${entry.name}`
            : `项目结构推断：作为下属专项候选技能 ${entry.name}`,
        ],
        label: isExplicitlyReferenced ? '显式编排调度' : '结构关联候选',
      };
      relationships.push(rel);

      rawEdges.push({
        from: mainEntrySkill.id,
        to: entry.id,
        type: 'invoke',
        origin,
        label: isExplicitlyReferenced ? '显式编排调度' : '结构关联候选',
        confidence,
        evidence: rel.evidence,
      });

      // Check cross-subskill feeding based on explicit dependency mentions
      const entryText = (entry.content || '').toLowerCase();
      for (const other of parsedEntries) {
        if (other.id !== entry.id && other.id !== mainEntrySkill.id) {
          const otherName = other.name.toLowerCase();
          // Check if entry explicitly references other subskill by name or input
          if (entryText.includes(otherName) || (entry.inputs && entry.inputs.some((inp) => inp.toLowerCase().includes(otherName)))) {
            relationships.push({
              from: other.id,
              to: entry.id,
              type: 'feeds',
              origin: 'declared',
              confidence: 0.85,
              evidence: [`专项技能 ${entry.name} 文档/输入要求中显式引用了 ${other.name}`],
              label: '声明产物依赖',
            });

            rawEdges.push({
              from: other.id,
              to: entry.id,
              type: 'feeds',
              origin: 'declared',
              label: '声明产物依赖',
              confidence: 0.85,
            });
          }
        }
      }
    }

    // Add Tool Nodes
    for (const tool of tools) {
      const toolId = `tool_${tool.type}_${crypto.createHash('md5').update(tool.name).digest('hex').slice(0, 6)}`;
      nodes.push({
        id: toolId,
        label: tool.name,
        type: tool.type === 'browser' ? 'tool' : 'mcp',
      });
      rawEdges.push({
        from: mainEntrySkill.id,
        to: toolId,
        type: 'uses_tool',
        label: '调用工具能力',
      });
    }

    // 9. Section 14: Validate Graph & Detect Cycles
    const { cleanEdges, hasCycle, cycleNodes, topologicalOrder } = this.validateAndAnalyzeGraph(nodes, rawEdges);

    const structureType: RelationshipGraph['structureType'] =
      parsedEntries.length > 5 ? 'tree' : parsedEntries.length > 1 ? 'parallel' : 'chain';

    const relationshipGraph: RelationshipGraph = {
      structureType,
      nodes,
      edges: cleanEdges,
      hasCycle,
      cycleNodes,
      topologicalOrder,
    };

    // 10. Compatibility Profile
    const compatibility: CompatibilityProfile = {
      level: parsedEntries.length > 1 ? 'L2' : 'L1',
      status: 'compatible',
      summary: `已完成自动化结构解析，识别出 ${parsedEntries.length} 个技能单元与 ${tools.length} 项工具依赖。`,
      canExecuteLocally: true,
      limitations: [],
      recommendations: ['在执行复杂任务时优先采用 DAG 编排与并行数据采集'],
    };

    // 11. Build Final SkillProjectMap
    const projectMap: SkillProjectMap = {
      projectId: `proj_${crypto.createHash('sha256').update(projectName).digest('hex').slice(0, 10)}`,
      projectName,
      projectType,
      projectDescription,
      rootDir: '',
      version: packManifest?.version || '1.0.0',
      author: packManifest?.author,
      sourceType: sourceType || 'builtin',
      sourceUrl,
      mainEntry: mainCandidate || {
        path: mainEntrySkill.path,
        score: 100,
        evidence: ['主要入口点'],
        reason: 'Main Entry',
      },
      entryCandidates: entryCandidates || [],
      entries: parsedEntries,
      relationships,
      scripts,
      references,
      templates,
      dependencies,
      environment,
      tools,
      evidence: raw.evidence,
      compatibility,
      relationshipGraph,
      childSkills: parsedEntries.filter((e) => e.id !== mainEntrySkill!.id).map((e) => ({
        id: e.id,
        name: e.name,
        displayName: e.displayName || e.name,
        description: e.description || '',
        path: e.path,
        role: 'specialty',
        category: e.category,
        contentPreview: e.contentPreview,
      })),
      supportingResources: {
        references: references.map((r) => ({ path: r.path, size: r.size, name: r.name })),
        templates: templates.map((t) => ({ path: t.path, size: t.size, name: t.name })),
        examples: examples.map((e) => ({ path: e.path, size: e.size, name: e.name })),
        scripts: scripts.map((s) => ({ path: s.path, size: s.size, name: s.name, runtime: s.runtime })),
        configs: configs.map((c) => ({ path: c.path, size: c.size, name: c.name })),
      },
      scannedFilesCount: files.length,
    };

    // 12. Build Runtime Intent
    const runtimeIntent = this.buildRuntimeIntent(projectMap, mainEntrySkill, parsedEntries, tools);

    return { projectMap, runtimeIntent };
  }

  private buildRuntimeIntent(
    projectMap: SkillProjectMap,
    mainSkill: SkillEntry,
    allSkills: SkillEntry[],
    tools: ToolRequirement[]
  ): RuntimeIntent {
    const childSkills = allSkills.filter((s) => s.id !== mainSkill.id);

    const workflow = [
      {
        stepNumber: 1,
        title: '任务拆解与研究范围界定',
        skillOrTool: mainSkill.name,
        action: '提取用户核心问题，划定研究标的、基准时间与边界',
        expectedOutput: '明确开题界定与分析框架',
      },
      {
        stepNumber: 2,
        title: '全网一手事实检索与数据采集',
        skillOrTool: 'Web Browser & Search MCP',
        action: '结合行业关键词与权威渠道抓取最新行业指标与一手证据',
        expectedOutput: '真实可查证的来源数据底表',
      },
      {
        stepNumber: 3,
        title: childSkills.length > 0 ? `调度 ${childSkills.length} 个专项分支并行分析` : '执行专业方法论推演',
        skillOrTool: childSkills.length > 0 ? childSkills.slice(0, 4).map((s) => s.name).join(', ') : mainSkill.name,
        action: '依据各专项规范进行市场规模测算、产业链梳理及技术研判',
        expectedOutput: '各专项结构化 Artifact 产物',
      },
      {
        stepNumber: 4,
        title: '交叉验证与结构化报告生成',
        skillOrTool: 'Document & Artifact Bus',
        action: '汇总各专项 Artifacts，生成可追溯交付物与证据链报告',
        expectedOutput: '排版严谨的结构化研究交付物',
      },
    ];

    return {
      projectId: projectMap.projectId,
      task: '通用异构技能调度与深度研究',
      goal: `根据「${projectMap.projectName}」项目规范，系统化调度技能与工具链，产出真实可溯源的高质量成果。`,
      authorIntent: projectMap.projectDescription,
      inputs: [
        { name: '任务主题或研究标的', description: '如指定行业、企业、技术或产品', required: true },
        { name: '研究截止日期 (Cutoff Date)', description: '默认取系统当前日期 2026-09-24', required: false },
      ],
      requiredCapabilities: [
        '自然语言解析',
        '多源信息情报检索',
        '跨技能数据流与产物汇聚',
        '事实/预测分类与一致性校验',
      ],
      selectedSkills: allSkills.map((s) => s.name),
      workflow,
      tools,
      expectedOutputs: [
        { name: 'Markdown 专业主报告', format: 'markdown', description: '包含核心结论、推导过程与证据链', required: true },
        { name: '结构化产物集合 (Artifacts)', format: 'json', description: '各专项子分析输出的结构化数据', required: true },
      ],
      constraints: [
        { description: '不得凭空臆造未核实的数据或引用', category: 'data_integrity' },
        { description: '所有研究任务显式注入当前时间基准 (2026-09-24)', category: 'temporal' },
        { description: '最终报告必须严格基于实际产生的 Artifacts 与执行链路', category: 'data_integrity' },
      ],
      completionConditions: [
        { condition: '证据可溯源性', standard: '每项关键数据需具备一手出处与基准日期' },
        { condition: '各专项产物完整性', standard: '所选专项技能产出有效 Artifact' },
      ],
      failureConditions: [
        { condition: '工具全部无法联通', handling: '生成降级提示并报告数据获取受限' },
      ],
      evidenceRequirements: [
        { type: 'FACT', description: '一手官方或权威机构公开数据', strictness: 'mandatory' },
        { type: 'FORECAST', description: '标明预测起点与预测区间的市场估算', strictness: 'mandatory' },
      ],
      // Legacy compatibility
      methods: ['总路由调度', '专项并行研究', '产物汇聚与交叉检验'],
      skills: allSkills.map((s) => ({ id: s.id, name: s.displayName || s.name, role: s.role as any, purpose: s.description || '' })),
      sequence: workflow,
      dependencies: projectMap.dependencies.map((d) => d.name),
      outputs: [
        { name: 'Markdown 专业主报告', format: 'markdown', description: '包含核心结论、推导过程与证据链' },
      ],
      risks: ['公开数据存在统计口径冲突需标明出处'],
      completionCriteria: ['完成多维事实梳理并产出结论'],
    };
  }
}

export const globalSkillProjectInterpreter = new SkillProjectInterpreter();

