import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import {
  SkillProjectMap,
  EntryCandidate,
  SkillProjectType,
  DiscoveryEvidence,
} from './types';
import { SkillProjectInterpreter } from './interpreter';

export interface ScannedFile {
  path: string;
  size: number;
  isDir: boolean;
  content?: string;
  hash?: string;
}

export interface RawProjectDiscovery {
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;
  inferredProjectName: string;
  files: ScannedFile[];
  manifests: Record<string, any>;
  readmeContent?: string;
  rootSkillMdContent?: string;
  allSkillMds: Array<{ path: string; content: string; hash: string }>;
  evidence: DiscoveryEvidence[];
  entryCandidates: EntryCandidate[];
}

export class SkillProjectDiscovery {
  private interpreter = new SkillProjectInterpreter();

  /**
   * Universal discover method required by V0.3.1 specification:
   * discover(rootDir: string): Promise<SkillProjectMap>
   */
  async discover(rootDir: string): Promise<SkillProjectMap> {
    const raw = await this.discoverFromLocalFolder(rootDir);
    const { projectMap } = this.interpreter.interpret(raw);
    projectMap.rootDir = rootDir;
    return projectMap;
  }

  /**
   * 1. Discover from GitHub repository URL
   */
  async discoverFromGithub(repoUrl: string): Promise<RawProjectDiscovery> {
    const cleanUrl = repoUrl.trim();
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/i;
    const match = cleanUrl.match(urlPattern);

    if (!match) {
      throw new Error(`无效的 GitHub 仓库地址: ${repoUrl}。请提供类似 https://github.com/owner/repo 格式。`);
    }

    const owner = match[1];
    let repo = match[2].replace(/\.git$/i, '');
    if (repo.includes('#') || repo.includes('?')) {
      repo = repo.split(/[#?]/)[0];
    }

    const branches = ['main', 'master', 'release', 'dev'];
    let zipBuffer: Buffer | null = null;

    for (const branch of branches) {
      const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
      try {
        const resp = await fetch(archiveUrl, {
          headers: { 'User-Agent': 'UniversalSkillRuntime/0.3' },
          redirect: 'follow',
        });
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          zipBuffer = Buffer.from(arrayBuffer);
          break;
        }
      } catch (e) {
        // Continue trying next branch
      }
    }

    if (!zipBuffer) {
      throw new Error(`未能从 GitHub 仓库 ${owner}/${repo} 获取到内容包，请确认仓库为公开可访问状态。`);
    }

    const discovery = await this.discoverFromZip(zipBuffer, repo);
    discovery.sourceType = 'github';
    discovery.sourceUrl = repoUrl;
    discovery.inferredProjectName = repo;
    return discovery;
  }

  /**
   * 2. Discover from Local Folder Path
   */
  async discoverFromLocalFolder(folderPath: string): Promise<RawProjectDiscovery> {
    const resolvedPath = path.resolve(folderPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`本地文件夹路径不存在: ${folderPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`指定的路径不是有效目录: ${folderPath}`);
    }

    const files: ScannedFile[] = [];
    const allSkillMds: Array<{ path: string; content: string; hash: string }> = [];
    const manifests: Record<string, any> = {};
    const evidence: DiscoveryEvidence[] = [];
    let readmeContent: string | undefined;
    let rootSkillMdContent: string | undefined;

    const walk = (currentDir: string, relativePrefix = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name === '.git' ||
          entry.name === 'node_modules' ||
          entry.name === '__pycache__' ||
          entry.name === '.venv' ||
          entry.name === 'dist' ||
          entry.name === '.runtime_data'
        ) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          files.push({ path: relPath, size: 0, isDir: true });
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const fileStat = fs.statSync(fullPath);
          let content: string | undefined;

          const lowerName = entry.name.toLowerCase();
          const isText =
            lowerName.endsWith('.md') ||
            lowerName.endsWith('.json') ||
            lowerName.endsWith('.txt') ||
            lowerName.endsWith('.yaml') ||
            lowerName.endsWith('.yml') ||
            lowerName.endsWith('.toml') ||
            lowerName.endsWith('.py') ||
            lowerName.endsWith('.js') ||
            lowerName.endsWith('.ts') ||
            lowerName.endsWith('.sh') ||
            lowerName === 'go.mod' ||
            lowerName === 'cargo.toml';

          let hash: string | undefined;
          if (isText && fileStat.size < 5 * 1024 * 1024) {
            try {
              content = fs.readFileSync(fullPath, 'utf-8');
              hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
            } catch {}
          }

          files.push({
            path: relPath,
            size: fileStat.size,
            isDir: false,
            content,
            hash,
          });

          // Check README
          if ((relPath.toLowerCase() === 'readme.md' || relPath.toLowerCase() === 'readme') && content) {
            readmeContent = content;
            evidence.push({
              file: relPath,
              snippet: content.slice(0, 200),
              category: 'entry',
            });
          }

          // Check SKILL.md
          if (lowerName === 'skill.md' && content) {
            allSkillMds.push({ path: relPath, content, hash: hash || '' });
            if (relPath.toLowerCase() === 'skill.md') {
              rootSkillMdContent = content;
            }
            evidence.push({
              file: relPath,
              snippet: content.slice(0, 200),
              category: 'entry',
            });
          }

          // Manifests
          if (
            (lowerName.endsWith('manifest.json') ||
              lowerName === 'package.json' ||
              lowerName === 'pyproject.toml' ||
              lowerName === 'requirements.txt' ||
              lowerName === '.mcp.json' ||
              lowerName === 'mcp.json' ||
              lowerName === '.env.example') &&
            content
          ) {
            try {
              if (lowerName.endsWith('.json')) {
                manifests[relPath] = JSON.parse(content);
              } else {
                manifests[relPath] = content;
              }
            } catch {
              manifests[relPath] = content;
            }
          }
        }
      }
    };

    walk(resolvedPath);

    const folderBaseName = path.basename(resolvedPath);
    const entryCandidates = this.scoreEntryCandidates(files, allSkillMds, readmeContent, manifests);

    return {
      sourceType: 'local_folder',
      sourceUrl: folderPath,
      inferredProjectName: folderBaseName,
      files,
      manifests,
      readmeContent,
      rootSkillMdContent,
      allSkillMds,
      evidence,
      entryCandidates,
    };
  }

  /**
   * 3. Discover from ZIP Archive Buffer (With Section 22 Zip Security Protections)
   */
  async discoverFromZip(zipBuffer: Buffer, zipNameHint = 'skill-project'): Promise<RawProjectDiscovery> {
    // ZIP Security check: size limit 50MB
    if (zipBuffer.length > 50 * 1024 * 1024) {
      throw new Error(`ZIP 压缩包体积超过安全限制 (50MB)，当前大小: ${(zipBuffer.length / 1024 / 1024).toFixed(1)}MB`);
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    const files: ScannedFile[] = [];
    const allSkillMds: Array<{ path: string; content: string; hash: string }> = [];
    const manifests: Record<string, any> = {};
    const evidence: DiscoveryEvidence[] = [];
    let readmeContent: string | undefined;
    let rootSkillMdContent: string | undefined;

    const entries = Object.keys(zip.files);
    if (entries.length === 0) {
      throw new Error('ZIP 压缩包为空，未包含任何有效文件。');
    }

    if (entries.length > 3000) {
      throw new Error(`ZIP 文件包含过多条目 (${entries.length})，超出安全上限。`);
    }

    // Detect if wrapped in a single folder
    let rootPrefix = '';
    const topLevelFolders = new Set<string>();
    for (const e of entries) {
      const parts = e.split('/');
      if (parts.length > 1 && parts[0]) {
        topLevelFolders.add(parts[0]);
      }
    }
    if (topLevelFolders.size === 1) {
      const soleTop = Array.from(topLevelFolders)[0];
      if (entries.every((e) => e.startsWith(soleTop + '/') || e === soleTop || e === soleTop + '/')) {
        rootPrefix = soleTop + '/';
      }
    }

    let totalUncompressedSize = 0;

    for (const entryName of entries) {
      const zipEntry = zip.files[entryName];
      if (zipEntry.dir) {
        continue;
      }

      // Security check: path traversal (../, absolute paths, null bytes)
      if (
        entryName.includes('../') ||
        entryName.includes('..\\') ||
        entryName.startsWith('/') ||
        entryName.includes('\0')
      ) {
        console.warn(`[ZIP Security] Skipping suspicious path in archive: ${entryName}`);
        continue;
      }

      const cleanPath = rootPrefix && entryName.startsWith(rootPrefix) ? entryName.slice(rootPrefix.length) : entryName;
      if (!cleanPath) continue;

      const lowerName = path.basename(cleanPath).toLowerCase();
      const isText =
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.yaml') ||
        lowerName.endsWith('.yml') ||
        lowerName.endsWith('.toml') ||
        lowerName.endsWith('.py') ||
        lowerName.endsWith('.js') ||
        lowerName.endsWith('.ts') ||
        lowerName.endsWith('.sh') ||
        lowerName === 'go.mod' ||
        lowerName === 'cargo.toml';

      let textContent: string | undefined;
      let fileSize = 0;
      let hash = '';

      try {
        if (isText) {
          textContent = await zipEntry.async('text');
          fileSize = Buffer.byteLength(textContent);
          totalUncompressedSize += fileSize;
          hash = crypto.createHash('sha256').update(textContent).digest('hex').slice(0, 12);
        } else {
          fileSize = (zipEntry as any)._data ? (zipEntry as any)._data.uncompressedSize : 1024;
          totalUncompressedSize += fileSize;
        }
      } catch (err) {
        continue;
      }

      // Security check: decompression bomb protection (max 200MB uncompressed)
      if (totalUncompressedSize > 200 * 1024 * 1024) {
        throw new Error('ZIP 解压总大小超过 200MB 安全限制，已被系统拦截。');
      }

      files.push({
        path: cleanPath,
        size: fileSize,
        isDir: false,
        content: textContent,
        hash,
      });

      if ((cleanPath.toLowerCase() === 'readme.md' || cleanPath.toLowerCase() === 'readme') && textContent) {
        readmeContent = textContent;
        evidence.push({
          file: cleanPath,
          snippet: textContent.slice(0, 200),
          category: 'entry',
        });
      }

      if (lowerName === 'skill.md' && textContent) {
        allSkillMds.push({ path: cleanPath, content: textContent, hash });
        if (cleanPath.toLowerCase() === 'skill.md') {
          rootSkillMdContent = textContent;
        }
        evidence.push({
          file: cleanPath,
          snippet: textContent.slice(0, 200),
          category: 'entry',
        });
      }

      if (
        (lowerName.endsWith('manifest.json') ||
          lowerName === 'package.json' ||
          lowerName === 'pyproject.toml' ||
          lowerName === 'requirements.txt' ||
          lowerName === '.mcp.json' ||
          lowerName === 'mcp.json' ||
          lowerName === '.env.example') &&
        textContent
      ) {
        try {
          if (lowerName.endsWith('.json')) {
            manifests[cleanPath] = JSON.parse(textContent);
          } else {
            manifests[cleanPath] = textContent;
          }
        } catch {
          manifests[cleanPath] = textContent;
        }
      }
    }

    const entryCandidates = this.scoreEntryCandidates(files, allSkillMds, readmeContent, manifests);

    return {
      sourceType: 'zip',
      sourceUrl: zipNameHint,
      inferredProjectName: zipNameHint.replace(/\.zip$/i, ''),
      files,
      manifests,
      readmeContent,
      rootSkillMdContent,
      allSkillMds,
      evidence,
      entryCandidates,
    };
  }

  /**
   * Section 9 & 10: Main Entry Scoring Algorithm
   * Scores all possible entry candidates based on explicit, semantic, and structural evidence.
   */
  scoreEntryCandidates(
    files: ScannedFile[],
    allSkillMds: Array<{ path: string; content: string; hash: string }>,
    readmeContent?: string,
    manifests: Record<string, any> = {}
  ): EntryCandidate[] {
    const candidates: EntryCandidate[] = [];

    // Check all SKILL.md files
    for (const smd of allSkillMds) {
      let score = 0;
      const evidence: string[] = [];
      const reasons: string[] = [];

      const lowerPath = smd.path.toLowerCase();
      const contentLower = smd.content.toLowerCase();

      // +40 Root SKILL.md
      if (lowerPath === 'skill.md' || lowerPath === './skill.md') {
        score += 40;
        evidence.push('位于项目根目录的 SKILL.md');
        reasons.push('Root SKILL.md (+40)');
      }

      // +10 Located in project root
      if (!smd.path.includes('/')) {
        score += 10;
        evidence.push('根层级文件');
        reasons.push('Root level (+10)');
      }

      // +40 Manifest specified entry
      for (const [mPath, mData] of Object.entries(manifests)) {
        if (typeof mData === 'object' && mData !== null) {
          const entrySkill = mData.entry_skill || mData.entrySkill || mData.main;
          if (entrySkill && (smd.path.includes(entrySkill) || smd.content.includes(entrySkill))) {
            score += 40;
            evidence.push(`项目配置文件 ${mPath} 中明确指定入口: ${entrySkill}`);
            reasons.push('Manifest specified entry (+40)');
            break;
          }
        }
      }

      // +30 Root README explicitly states entry
      if (readmeContent) {
        const readmeLower = readmeContent.toLowerCase();
        const baseName = path.basename(path.dirname(smd.path));
        if (
          readmeLower.includes(smd.path.toLowerCase()) ||
          (baseName && readmeLower.includes(baseName.toLowerCase()) && (readmeLower.includes('入口') || readmeLower.includes('start') || readmeLower.includes('entry')))
        ) {
          score += 30;
          evidence.push(`根目录 README 明确指引本入口: ${smd.path}`);
          reasons.push('Root README states entry (+30)');
        }
      }

      // +20 Contains "orchestrate/workflow/main/router/总入口/总路由"
      if (
        contentLower.includes('orchestrat') ||
        contentLower.includes('workflow') ||
        contentLower.includes('main') ||
        contentLower.includes('router') ||
        contentLower.includes('总入口') ||
        contentLower.includes('总路由') ||
        contentLower.includes('统筹')
      ) {
        score += 20;
        evidence.push('SKILL.md 包含统筹调度/总路由/工作流主干语义');
        reasons.push('Contains orchestrate/main semantic (+20)');
      }

      // +25 Explicitly cited/referenced by other skills
      let citedByOthers = 0;
      for (const other of allSkillMds) {
        if (other.path !== smd.path && other.content.includes(path.basename(path.dirname(smd.path)))) {
          citedByOthers++;
        }
      }
      if (citedByOthers > 0) {
        score += 25;
        evidence.push(`被其他 ${citedByOthers} 个 Skill 显式引用或指引`);
        reasons.push('Cited by other skills (+25)');
      }

      // Deductions
      // -20 Obviously a child/specialty skill
      if (
        lowerPath.includes('/subskills/') ||
        lowerPath.includes('/children/') ||
        lowerPath.includes('/specialty/') ||
        lowerPath.includes('/branches/') ||
        contentLower.includes('专项分析') ||
        contentLower.includes('子技能')
      ) {
        score -= 20;
        evidence.push('属于下属分支或专项分析技能');
        reasons.push('Obviously child skill (-20)');
      }

      // -30 Only reference
      if (lowerPath.includes('/references/') || lowerPath.includes('/reference/')) {
        score -= 30;
        evidence.push('位于参考文档目录');
        reasons.push('Reference directory (-30)');
      }

      // -30 Only template
      if (lowerPath.includes('/templates/') || lowerPath.includes('/template/')) {
        score -= 30;
        evidence.push('位于模板目录');
        reasons.push('Template directory (-30)');
      }

      candidates.push({
        path: smd.path,
        score,
        evidence,
        reason: reasons.join('; ') || '默认候选',
      });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }
}

export const globalSkillProjectDiscovery = new SkillProjectDiscovery();

