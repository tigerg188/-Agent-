import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import YAML from 'yaml';
import { SkillMetadata } from '../types';

export class SkillEngine {
  private skills: Map<string, SkillMetadata> = new Map();
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'data', 'skills');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    this.initDefaultSkills();
  }

  private parseSkillMd(rawContent: string): { frontmatter: Record<string, any>; body: string } {
    const trimmed = rawContent.trim();
    if (!trimmed.startsWith('---')) {
      return { frontmatter: {}, body: trimmed };
    }

    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) {
      return { frontmatter: {}, body: trimmed };
    }

    const yamlStr = trimmed.slice(3, endIdx).trim();
    const body = trimmed.slice(endIdx + 3).trim();

    try {
      const parsed = YAML.parse(yamlStr) || {};
      return { frontmatter: parsed, body };
    } catch (e) {
      console.warn('YAML parse error in SKILL.md:', e);
      return { frontmatter: {}, body };
    }
  }

  private initDefaultSkills() {
    // 1. Web Research & Summary Skill
    const webResearchSkill: SkillMetadata = {
      id: 'web-research-summary',
      name: 'web-research-summary',
      displayName: '网络多源情报调研与报告生成',
      description: '自动化打开目标网络、检索最新资讯、深度抓取核心正文并输出结构化 Markdown 调研报告。',
      version: '1.0.0',
      category: '调研分析',
      enabled: true,
      hasReferences: true,
      hasExamples: true,
      hasTemplates: true,
      content: `---
name: web-research-summary
description: 自动化打开目标网络、检索最新资讯、深度抓取核心正文并输出结构化 Markdown 调研报告。
category: 调研分析
version: 1.0.0
---

# Web Research & Summary Skill

## 目标与原则
利用 Browser 与 Search MCP，执行可靠的网络调研，并对获取到的网页正文做客观、条理清晰的梳理总结。

## 执行标准步骤
1. **分析调研目标**：从用户任务中提取关键检索词、目标行业、时间窗口与输出偏好。
2. **检索与导航**：
   - 优先通过搜索 MCP 或浏览器搜索框输入关键词。
   - 打开搜索结果中的前 2~3 个权威目标网页。
3. **内容抓取与审查**：
   - 调用浏览器读取页面结构与正文文字。
   - 剔除无关广告与导航噪音，捕获关键数据、事实陈述、时间与引用源。
4. **整理与报告生成**：
   - 生成包含核心发现、背景梳理、对比分析与结论建议的结构化 Markdown 报告。
   - 保存至 Workspace 输出文件目录。
5. **结果自查验证**：
   - 验证报告中是否包含具体事实数据、是否满足用户的全部问题要求。
`,
      files: [
        { path: 'SKILL.md', size: 1024, isDir: false },
        { path: 'templates/report-template.md', size: 512, isDir: false, content: '# [主题] 调研分析报告\n\n## 一、核心结论\n\n## 二、详细事实与依据\n\n## 三、建议与后续行动\n' },
        { path: 'references/guidelines.md', size: 400, isDir: false, content: '必须验证引用来源可信度，优先采用官方网站与权威行业研报。' },
      ],
    };

    // 2. Contract Review Skill
    const contractReviewSkill: SkillMetadata = {
      id: 'contract-review',
      name: 'contract-review',
      displayName: '合同合规审查与风险识别',
      description: '根据商事法律与合规准则审查合同协议，精准识别违约责任、付款节点、知识产权归属及免责争议条款。',
      version: '1.0.0',
      category: '法务合规',
      enabled: true,
      hasReferences: true,
      hasExamples: true,
      hasTemplates: true,
      content: `---
name: contract-review
description: 根据商事法律与合规准则审查合同协议，精准识别违约责任、付款节点、知识产权归属及免责争议条款。
category: 法务合规
version: 1.0.0
---

# Contract Review Skill (商业合同审查规范)

## 审查重点维度
1. **合同主体与资格**：确认当事人权利义务对等性。
2. **价款与支付节点**：审核付款前提条件、违约金计算上限（建议约定不得超过实际损失的 30%）。
3. **交付物与验收标准**：确认是否有量化可验证的交付物验收条款与确认时限。
4. **知识产权与保密**：严防关键资产所有权外溢，约定明确的保密期限与违约赔偿。
5. **争议管辖与不可抗力**：优先选用守约方所在地人民法院管辖或知名仲裁委员会。

## 输出成果
生成《合同专项审查意见书》（包含：高风险条款清单、修改建议对照表、合规评分）。
`,
      files: [
        { path: 'SKILL.md', size: 980, isDir: false },
        { path: 'templates/review-opinion.md', size: 620, isDir: false, content: '# 合同法律审查意见书\n\n- 审查对象：[合同名称]\n- 风险等级：[高/中/低]\n\n### 一、重点风险条款提示\n### 二、逐条修订建议对照表\n' },
      ],
    };

    // 3. Data Report Extractor Skill
    const dataReportSkill: SkillMetadata = {
      id: 'data-report-extractor',
      name: 'data-report-extractor',
      displayName: '结构化数据提取与表格生成',
      description: '从杂乱网页、文档文本或报告中提取数字指标、表格矩阵与对比参数，清洗整理为规范的 Markdown 表格与 CSV。',
      version: '1.0.0',
      category: '数据处理',
      enabled: true,
      hasReferences: true,
      hasExamples: true,
      hasTemplates: true,
      content: `---
name: data-report-extractor
description: 从杂乱网页、文档文本或报告中提取数字指标、表格矩阵与对比参数，清洗整理为规范的 Markdown 表格与 CSV。
category: 数据处理
version: 1.0.0
---

# Data Report Extractor Skill

## 规范与流程
1. 读取用户上传的文档或浏览器页面中的表格与数据序列。
2. 识别字段属性（名称、数值、单位、时间戳）。
3. 补齐缺失值，标注异常离群值。
4. 格式化输出为排版对齐的标准 Markdown 表格与结构化数据文件。
`,
      files: [
        { path: 'SKILL.md', size: 680, isDir: false },
      ],
    };

    this.skills.set(webResearchSkill.id, webResearchSkill);
    this.skills.set(contractReviewSkill.id, contractReviewSkill);
    this.skills.set(dataReportSkill.id, dataReportSkill);
  }

  getAllSkills(workspaceId?: string, options?: { topLevelOnly?: boolean }): SkillMetadata[] {
    this.reorganizePacks();
    const list = Array.from(this.skills.values());
    const filtered = !workspaceId ? list : list.filter((s) => !s.workspaceId || s.workspaceId === workspaceId);
    if (options?.topLevelOnly) {
      return filtered.filter((s) => !s.parentSkillId);
    }
    return filtered;
  }

  getSkillById(id: string): SkillMetadata | undefined {
    return this.skills.get(id);
  }

  toggleSkill(id: string, enabled: boolean): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = enabled;
    return true;
  }

  deleteSkill(id: string): boolean {
    return this.skills.delete(id);
  }

  /**
   * Import Skill from raw SKILL.md text
   */
  importFromMarkdown(rawContent: string, workspaceId?: string): { success: boolean; skill?: SkillMetadata; error?: string } {
    try {
      const { frontmatter, body } = this.parseSkillMd(rawContent);
      const name = frontmatter.name || 'imported-skill-' + Date.now();
      const description = frontmatter.description || '自定义导入的 Skill 工作规范';
      const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      const skill: SkillMetadata = {
        id,
        name,
        displayName: frontmatter.displayName || name,
        description,
        version: frontmatter.version || '1.0.0',
        category: frontmatter.category || '自定义技能',
        enabled: true,
        workspaceId,
        content: rawContent,
        files: [
          { path: 'SKILL.md', size: Buffer.byteLength(rawContent), isDir: false, content: rawContent },
        ],
      };

      this.skills.set(id, skill);
      return { success: true, skill };
    } catch (e: any) {
      return { success: false, error: `解析 SKILL.md 失败: ${e.message}` };
    }
  }

  /**
   * Import Skill(s) from ZIP buffer (standard skill directory or skill pack)
   * Validates ZIP structure:
   * skill-name/
   *   SKILL.md
   *   references/
   *   examples/
   *   scripts/
   *   templates/
   * Or multi-skill pack:
   * repo/skills/skill-1/SKILL.md
   * repo/skills/skill-2/SKILL.md
   */
  async importFromZip(
    zipBuffer: Buffer,
    workspaceId?: string
  ): Promise<{ success: boolean; skill?: SkillMetadata; skills?: SkillMetadata[]; count?: number; error?: string }> {
    try {
      const zip = await JSZip.loadAsync(zipBuffer);
      const fileNames = Object.keys(zip.files);

      if (fileNames.length === 0) {
        return {
          success: false,
          error: 'ZIP 压缩包为空，请上传包含标准技能目录与 SKILL.md 的压缩包。',
        };
      }

      // Find all SKILL.md files (case-insensitive)
      const skillMdPaths = fileNames.filter(
        (f) => !zip.files[f].dir && (f.toLowerCase() === 'skill.md' || f.toLowerCase().endsWith('/skill.md'))
      );

      if (skillMdPaths.length === 0) {
        return {
          success: false,
          error: 'ZIP 结构不正确：压缩包根目录或子目录中未找到有效的 SKILL.md 文件，请确认包含该文件后重新上传。',
        };
      }

      // Check for manifest file (release-manifest.json, skill-pack.json, manifest.json)
      const manifestPath = fileNames.find(
        (f) =>
          !zip.files[f].dir &&
          (f.toLowerCase().endsWith('release-manifest.json') ||
            f.toLowerCase().endsWith('skill-pack.json') ||
            f.toLowerCase().endsWith('manifest.json'))
      );

      let packManifest: any = null;
      if (manifestPath) {
        try {
          const raw = await zip.file(manifestPath)!.async('string');
          packManifest = JSON.parse(raw);
          console.log(`[SkillEngine] Detected Skill Pack manifest: "${packManifest.display_name || packManifest.repository_slug}" with entry skill: "${packManifest.entry_skill}"`);
        } catch (e) {
          console.warn('[SkillEngine] Failed to parse skill manifest:', e);
        }
      }

      const importedSkills: SkillMetadata[] = [];

      for (const skillMdPath of skillMdPaths) {
        const skillMdFile = zip.file(skillMdPath);
        if (!skillMdFile) continue;

        const rawContent = await skillMdFile.async('string');
        const { frontmatter } = this.parseSkillMd(rawContent);

        // Determine directory prefix for this specific skill
        const lastSlash = skillMdPath.lastIndexOf('/');
        const skillDirPrefix = lastSlash !== -1 ? skillMdPath.slice(0, lastSlash + 1) : '';

        // Folder name of this skill
        let folderName = 'custom-skill';
        if (skillDirPrefix) {
          const parts = skillDirPrefix.replace(/\/$/, '').split('/');
          folderName = parts[parts.length - 1];
        }

        const name = String(frontmatter.name || folderName).trim();
        const displayName = frontmatter.displayName || frontmatter.title || name;
        const description = frontmatter.description
          ? String(frontmatter.description).trim()
          : `${name} 技能执行规范`;
        const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

        // Inspect subfolders relative to this skill
        const hasReferences = fileNames.some(
          (f) => f.startsWith(skillDirPrefix) && f.toLowerCase().includes('/references/')
        );
        const hasExamples = fileNames.some(
          (f) => f.startsWith(skillDirPrefix) && f.toLowerCase().includes('/examples/')
        );
        const hasScripts = fileNames.some(
          (f) => f.startsWith(skillDirPrefix) && f.toLowerCase().includes('/scripts/')
        );
        const hasTemplates = fileNames.some(
          (f) => f.startsWith(skillDirPrefix) && f.toLowerCase().includes('/templates/')
        );

        // Collect files belonging to this skill
        const filesList: Array<{ path: string; size: number; isDir: boolean; content?: string }> = [];
        for (const [relPath, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir && (relPath === skillMdPath || (skillDirPrefix && relPath.startsWith(skillDirPrefix)))) {
            let textSnippet: string | undefined;
            if (relPath.endsWith('.md') || relPath.endsWith('.txt') || relPath.endsWith('.json')) {
              try {
                textSnippet = (await zipEntry.async('string')).slice(0, 1000);
              } catch (e) {}
            }
            filesList.push({
              path: skillDirPrefix ? relPath.slice(skillDirPrefix.length) : relPath,
              size: (zipEntry as any)._data?.uncompressedSize || 100,
              isDir: false,
              content: textSnippet,
            });
          }
        }

        const skill: SkillMetadata = {
          id,
          name,
          displayName,
          description,
          version: frontmatter.version || packManifest?.version || '1.0.0',
          category: frontmatter.category || '行研合集包',
          enabled: true,
          workspaceId,
          hasReferences,
          hasExamples,
          hasScripts,
          hasTemplates,
          content: rawContent,
          files: filesList,
          role: 'standalone',
        };

        this.skills.set(id, skill);
        importedSkills.push(skill);
      }

      // Identify Master Router Entry vs Specialty Branches
      let entrySkillName = packManifest?.entry_skill;
      if (!entrySkillName) {
        // Heuristic detection: scan for "总路由" / "总入口" / "router" / "*-researcher"
        const routerCandidate = importedSkills.find((s) => {
          const combined = (s.name + ' ' + s.description + ' ' + (s.content || '')).toLowerCase();
          return (
            combined.includes('总路由') ||
            combined.includes('总入口') ||
            combined.includes('router') ||
            s.name.endsWith('-researcher') ||
            s.name === 'researcher'
          );
        });
        if (routerCandidate) {
          entrySkillName = routerCandidate.name;
        }
      }

      const packId = packManifest?.repository_slug || (entrySkillName ? `${entrySkillName}-pack` : undefined);
      const packName = packManifest?.display_name || (entrySkillName ? `${entrySkillName} 技能合集包` : undefined);

      let masterSkill = importedSkills.find((s) => s.name === entrySkillName || s.id === entrySkillName);
      if (!masterSkill && importedSkills.length > 1) {
        masterSkill = importedSkills[0];
      }

      if (masterSkill && importedSkills.length > 1) {
        const masterId = masterSkill.id;
        masterSkill.isPackMaster = true;
        masterSkill.role = 'router';
        masterSkill.packId = packId;
        masterSkill.packName = packName;
        masterSkill.category = '合集总路由';

        const subSkillsList: any[] = [];

        for (const s of importedSkills) {
          if (s.id === masterId) continue;
          s.role = 'specialty';
          s.parentSkillId = masterId;
          s.packId = packId;
          s.packName = packName;
          s.category = s.category || '专项分支';

          subSkillsList.push({
            id: s.id,
            name: s.name,
            displayName: s.displayName || s.name,
            description: s.description,
            role: 'specialty',
            enabled: s.enabled,
            category: s.category,
          });

          this.skills.set(s.id, s);
        }

        masterSkill.subSkills = subSkillsList;
        this.skills.set(masterSkill.id, masterSkill);
      }

      const primarySkill = masterSkill || importedSkills[0];

      return {
        success: true,
        skill: primarySkill,
        skills: importedSkills,
        count: importedSkills.length,
      };
    } catch (e: any) {
      console.error('Error importing ZIP skill:', e);
      return {
        success: false,
        error: `ZIP 解压与识别失败: ${e.message}`,
      };
    }
  }

  /**
   * Reorganize any already imported skills into Master/Specialty pack structure
   */
  reorganizePacks() {
    const all = Array.from(this.skills.values());
    const heheSkills = all.filter((s) => s.name.startsWith('hehe-'));
    if (heheSkills.length > 1) {
      const master = heheSkills.find((s) => s.name === 'hehe-industry-researcher');
      if (master) {
        master.isPackMaster = true;
        master.role = 'router';
        master.packId = 'hehe-industry-research-skill-pack';
        master.packName = '盒盒行业研究技能包';
        master.category = '合集总路由';

        const subList: any[] = [];
        for (const s of heheSkills) {
          if (s.id === master.id) continue;
          s.role = 'specialty';
          s.parentSkillId = master.id;
          s.packId = 'hehe-industry-research-skill-pack';
          s.packName = '盒盒行业研究技能包';
          s.category = '专项分支';

          subList.push({
            id: s.id,
            name: s.name,
            displayName: s.displayName || s.name,
            description: s.description,
            role: 'specialty',
            enabled: s.enabled,
            category: s.category,
          });
          this.skills.set(s.id, s);
        }
        master.subSkills = subList;
        this.skills.set(master.id, master);
      }
    }
  }

  /**
   * Automatically select best matching skill given task prompt
   */
  matchSkill(prompt: string, workspaceId?: string): SkillMetadata | null {
    const activeSkills = this.getAllSkills(workspaceId).filter((s) => s.enabled);
    if (activeSkills.length === 0) return null;

    const lowerPrompt = prompt.toLowerCase();
    let bestScore = 0;
    let bestSkill: SkillMetadata | null = null;

    for (const skill of activeSkills) {
      let score = 0;
      const keywords = (skill.name + ' ' + skill.description + ' ' + (skill.displayName || '')).toLowerCase().split(/[\s,，、/]+/);

      for (const kw of keywords) {
        if (kw.length >= 2 && lowerPrompt.includes(kw)) {
          score += 2;
        }
      }

      // Master Router bonus: if prompt asks for general research/analysis/survey, heavily prioritize the Master Router
      if (skill.isPackMaster && (skill.subSkills?.length || 0) > 0) {
        if (
          lowerPrompt.includes('研究') ||
          lowerPrompt.includes('分析') ||
          lowerPrompt.includes('调研') ||
          lowerPrompt.includes('行业') ||
          lowerPrompt.includes('企业') ||
          lowerPrompt.includes('全景') ||
          lowerPrompt.includes('商业')
        ) {
          score += 15;
        }
      }

      // Domain matches
      if ((lowerPrompt.includes('合同') || lowerPrompt.includes('协议') || lowerPrompt.includes('合规') || lowerPrompt.includes('条款')) && skill.id === 'contract-review') {
        score += 10;
      }
      if ((lowerPrompt.includes('搜索') || lowerPrompt.includes('调研') || lowerPrompt.includes('查阅') || lowerPrompt.includes('网站') || lowerPrompt.includes('网页')) && skill.id === 'web-research-summary') {
        score += 8;
      }
      if ((lowerPrompt.includes('数据') || lowerPrompt.includes('表格') || lowerPrompt.includes('指标') || lowerPrompt.includes('清洗')) && skill.id === 'data-report-extractor') {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSkill = skill;
      }
    }

    return bestScore >= 4 ? bestSkill : null;
  }
}

export const globalSkillEngine = new SkillEngine();
