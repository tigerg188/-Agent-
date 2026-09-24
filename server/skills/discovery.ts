import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export interface ScannedFile {
  path: string;
  size: number;
  isDir: boolean;
  content?: string;
}

export interface RawProjectDiscovery {
  sourceType: 'github' | 'local_folder' | 'zip' | 'builtin';
  sourceUrl?: string;
  inferredProjectName: string;
  files: ScannedFile[];
  manifests: Record<string, any>;
  readmeContent?: string;
  rootSkillMdContent?: string;
  allSkillMds: Array<{ path: string; content: string }>;
}

export class SkillProjectDiscovery {
  /**
   * 1. Discover from GitHub repository
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

    // Try downloading the zip archive of the repository across common branches
    const branches = ['main', 'master', 'release', 'dev'];
    let zipBuffer: Buffer | null = null;
    let successfulBranch = 'main';

    for (const branch of branches) {
      const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
      try {
        const resp = await fetch(archiveUrl, {
          headers: { 'User-Agent': 'UniversalSkillRuntime/0.2' },
          redirect: 'follow',
        });
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          zipBuffer = Buffer.from(arrayBuffer);
          successfulBranch = branch;
          break;
        }
      } catch (e) {
        // Continue trying next branch
      }
    }

    if (!zipBuffer) {
      // Fallback: check if we can fetch raw files via github API or raw content
      throw new Error(`未能从 GitHub 仓库 ${owner}/${repo} 下载到内容包，请确认仓库公开可访问，且主分支为 main 或 master。`);
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
    const allSkillMds: Array<{ path: string; content: string }> = [];
    const manifests: Record<string, any> = {};
    let readmeContent: string | undefined;
    let rootSkillMdContent: string | undefined;

    const walk = (currentDir: string, relativePrefix = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === '.venv') {
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

          // Read text files for analysis
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
            lowerName.endsWith('.ts');

          if (isText && fileStat.size < 1024 * 1024) {
            try {
              content = fs.readFileSync(fullPath, 'utf-8');
            } catch {}
          }

          files.push({
            path: relPath,
            size: fileStat.size,
            isDir: false,
            content,
          });

          // Check for README
          if (relPath.toLowerCase() === 'readme.md' && content) {
            readmeContent = content;
          }

          // Check for SKILL.md
          if (lowerName === 'skill.md' && content) {
            allSkillMds.push({ path: relPath, content });
            if (relPath.toLowerCase() === 'skill.md') {
              rootSkillMdContent = content;
            }
          }

          // Check for Manifests
          if (
            (lowerName.endsWith('manifest.json') ||
              lowerName === 'package.json' ||
              lowerName === 'pyproject.toml') &&
            content
          ) {
            try {
              if (lowerName.endsWith('.json')) {
                manifests[relPath] = JSON.parse(content);
              } else {
                manifests[relPath] = content;
              }
            } catch {}
          }
        }
      }
    };

    walk(resolvedPath);

    const folderBaseName = path.basename(resolvedPath);

    return {
      sourceType: 'local_folder',
      sourceUrl: folderPath,
      inferredProjectName: folderBaseName,
      files,
      manifests,
      readmeContent,
      rootSkillMdContent,
      allSkillMds,
    };
  }

  /**
   * 3. Discover from ZIP Archive Buffer
   */
  async discoverFromZip(zipBuffer: Buffer, zipNameHint = 'skill-project'): Promise<RawProjectDiscovery> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const files: ScannedFile[] = [];
    const allSkillMds: Array<{ path: string; content: string }> = [];
    const manifests: Record<string, any> = {};
    let readmeContent: string | undefined;
    let rootSkillMdContent: string | undefined;

    const entries = Object.keys(zip.files);
    if (entries.length === 0) {
      throw new Error('ZIP 压缩包为空，未包含任何有效文件。');
    }

    // Detect if entire archive is wrapped in a single top-level folder (e.g. repo-main/...)
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
      // Check if all files start with this folder
      if (entries.every((e) => e.startsWith(soleTop + '/') || e === soleTop || e === soleTop + '/')) {
        rootPrefix = soleTop + '/';
      }
    }

    for (const entryName of entries) {
      const zipEntry = zip.files[entryName];
      if (zipEntry.dir) {
        continue;
      }

      // Strip root folder prefix if wrapped
      const cleanPath = rootPrefix && entryName.startsWith(rootPrefix) ? entryName.slice(rootPrefix.length) : entryName;
      if (!cleanPath) continue;

      const lowerName = path.basename(cleanPath).toLowerCase();
      let textContent: string | undefined;

      const isText =
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.yaml') ||
        lowerName.endsWith('.yml') ||
        lowerName.endsWith('.toml') ||
        lowerName.endsWith('.py') ||
        lowerName.endsWith('.js') ||
        lowerName.endsWith('.ts');

      if (isText) {
        try {
          textContent = await zipEntry.async('string');
        } catch {}
      }

      files.push({
        path: cleanPath,
        size: (zipEntry as any)._data?.uncompressedSize || 100,
        isDir: false,
        content: textContent,
      });

      // README
      if (cleanPath.toLowerCase() === 'readme.md' && textContent) {
        readmeContent = textContent;
      }

      // SKILL.md
      if (lowerName === 'skill.md' && textContent) {
        allSkillMds.push({ path: cleanPath, content: textContent });
        if (cleanPath.toLowerCase() === 'skill.md') {
          rootSkillMdContent = textContent;
        }
      }

      // Manifests
      if (
        (lowerName.endsWith('manifest.json') ||
          lowerName === 'package.json' ||
          lowerName === 'pyproject.toml') &&
        textContent
      ) {
        try {
          if (lowerName.endsWith('.json')) {
            manifests[cleanPath] = JSON.parse(textContent);
          } else {
            manifests[cleanPath] = textContent;
          }
        } catch {}
      }
    }

    return {
      sourceType: 'zip',
      sourceUrl: zipNameHint,
      inferredProjectName: zipNameHint.replace(/\.zip$/i, ''),
      files,
      manifests,
      readmeContent,
      rootSkillMdContent,
      allSkillMds,
    };
  }
}

export const globalSkillProjectDiscovery = new SkillProjectDiscovery();
