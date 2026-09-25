import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  SkillProject,
  SkillProjectMap,
  RuntimeIntent,
  ExecutionRun,
  ExecutionStep,
  ExecutionTrace,
  Artifact,
  EvidenceRef,
  EnvironmentProfile,
} from '../skills/types';

export class SkillRuntimeDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    const dataDir = path.resolve(process.cwd(), '.runtime_data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // Ignored if exists
      }
    }

    this.dbPath = customPath || path.join(dataDir, 'skill_runtime.db');
    try {
      this.db = new DatabaseSync(this.dbPath);
    } catch (e) {
      console.warn('[DatabaseSync] File db open failed, falling back to memory db:', e);
      this.db = new DatabaseSync(':memory:');
    }

    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        version TEXT,
        author TEXT,
        project_type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        root_dir TEXT,
        main_entry_path TEXT,
        enabled INTEGER DEFAULT 1,
        installed_at TEXT NOT NULL,
        child_skills_count INTEGER DEFAULT 0,
        tools_count INTEGER DEFAULT 0,
        resources_count INTEGER DEFAULT 0,
        project_map_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS skill_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        role TEXT,
        description TEXT,
        category TEXT,
        triggers_json TEXT,
        tools_json TEXT,
        FOREIGN KEY(project_id) REFERENCES skill_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS skill_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        from_skill TEXT NOT NULL,
        to_skill TEXT NOT NULL,
        rel_type TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        evidence_json TEXT,
        FOREIGN KEY(project_id) REFERENCES skill_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS skill_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dep_type TEXT NOT NULL,
        version TEXT,
        required INTEGER DEFAULT 1,
        FOREIGN KEY(project_id) REFERENCES skill_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS skill_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        version TEXT NOT NULL,
        hash TEXT,
        installed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_intents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        task TEXT NOT NULL,
        goal TEXT,
        intent_json TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS execution_runs (
        run_id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        project_id TEXT NOT NULL,
        plan_id TEXT,
        status TEXT NOT NULL,
        research_cutoff TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        error TEXT,
        summary TEXT
      );

      CREATE TABLE IF NOT EXISTS execution_steps (
        step_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        skill_id TEXT,
        skill_name TEXT,
        title TEXT,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        depends_on_json TEXT,
        expected_output TEXT,
        input_json TEXT,
        output_json TEXT,
        error_json TEXT,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY(run_id) REFERENCES execution_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS execution_traces (
        trace_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        action TEXT NOT NULL,
        tool TEXT,
        status TEXT NOT NULL,
        duration_ms INTEGER,
        input_json TEXT,
        output_json TEXT,
        artifact_ids_json TEXT,
        error TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(run_id) REFERENCES execution_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        artifact_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        producer_step_id TEXT NOT NULL,
        producer_skill_id TEXT,
        producer_skill_name TEXT,
        content_json TEXT NOT NULL,
        input_artifact_ids_json TEXT,
        evidence_ids_json TEXT,
        confidence REAL,
        status TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY(run_id) REFERENCES execution_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS artifact_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_artifact_id TEXT NOT NULL,
        target_artifact_id TEXT NOT NULL,
        link_type TEXT NOT NULL,
        FOREIGN KEY(source_artifact_id) REFERENCES artifacts(artifact_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS evidence_refs (
        evidence_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        source TEXT NOT NULL,
        url TEXT,
        title TEXT,
        published_at TEXT,
        accessed_at TEXT,
        data_date TEXT,
        claim TEXT,
        artifact_id TEXT,
        data_type TEXT,
        has_temporal_conflict INTEGER DEFAULT 0,
        FOREIGN KEY(run_id) REFERENCES execution_runs(run_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS environment_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT DEFAULT (datetime('now')),
        os TEXT NOT NULL,
        architecture TEXT NOT NULL,
        profile_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        step_id TEXT,
        tool_name TEXT NOT NULL,
        input_json TEXT,
        output_json TEXT,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        error TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  // ==================== Skill Project Persistence ====================

  saveProject(project: SkillProject): void {
    const mainEntryPath = project.projectMap.mainEntry?.path || '';
    const insertProject = this.db.prepare(`
      INSERT OR REPLACE INTO skill_projects (
        id, name, display_name, description, version, author,
        project_type, source_type, source_url, root_dir, main_entry_path,
        enabled, installed_at, child_skills_count, tools_count,
        resources_count, project_map_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProject.run(
      project.id,
      project.name,
      project.displayName,
      project.description,
      project.version,
      project.author || '',
      project.projectType,
      project.sourceType,
      project.sourceUrl || '',
      project.projectMap.rootDir || '',
      mainEntryPath,
      project.enabled ? 1 : 0,
      project.installedAt,
      project.childSkillsCount,
      project.toolsCount,
      project.resourcesCount,
      JSON.stringify(project.projectMap)
    );

    // Save skill entries
    const deleteEntries = this.db.prepare('DELETE FROM skill_entries WHERE project_id = ?');
    deleteEntries.run(project.id);

    const insertEntry = this.db.prepare(`
      INSERT INTO skill_entries (
        id, project_id, name, path, type, role, description, category, triggers_json, tools_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of project.projectMap.entries || []) {
      insertEntry.run(
        entry.id,
        project.id,
        entry.name,
        entry.path,
        entry.type || 'skill',
        entry.role || 'subskill',
        entry.description || '',
        entry.category || 'General',
        JSON.stringify(entry.triggers || []),
        JSON.stringify(entry.tools || [])
      );
    }

    // Save relationships
    const deleteRels = this.db.prepare('DELETE FROM skill_relationships WHERE project_id = ?');
    deleteRels.run(project.id);

    const insertRel = this.db.prepare(`
      INSERT INTO skill_relationships (
        project_id, from_skill, to_skill, rel_type, confidence, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const rel of project.projectMap.relationships || []) {
      insertRel.run(
        project.id,
        rel.from,
        rel.to,
        rel.type,
        rel.confidence || 1.0,
        JSON.stringify(rel.evidence || [])
      );
    }

    // Save dependencies
    const deleteDeps = this.db.prepare('DELETE FROM skill_dependencies WHERE project_id = ?');
    deleteDeps.run(project.id);

    const insertDep = this.db.prepare(`
      INSERT INTO skill_dependencies (project_id, name, dep_type, version, required)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const dep of project.projectMap.dependencies || []) {
      insertDep.run(
        project.id,
        dep.name,
        dep.type,
        dep.version || '',
        dep.required ? 1 : 0
      );
    }
  }

  getProject(id: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM skill_projects WHERE id = ?');
    const row: any = stmt.get(id);
    if (!row) return null;

    let projectMap: SkillProjectMap | null = null;
    try {
      projectMap = JSON.parse(row.project_map_json);
    } catch {}

    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      author: row.author,
      projectType: row.project_type,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      rootDir: row.root_dir,
      enabled: Boolean(row.enabled),
      installedAt: row.installed_at,
      childSkillsCount: row.child_skills_count,
      toolsCount: row.tools_count,
      resourcesCount: row.resources_count,
      projectMap,
    };
  }

  listProjects(): any[] {
    const stmt = this.db.prepare('SELECT * FROM skill_projects ORDER BY installed_at DESC');
    const rows: any[] = stmt.all() as any[];
    return rows.map((r) => {
      let projectMap: any = null;
      try {
        projectMap = JSON.parse(r.project_map_json);
      } catch {}
      return {
        id: r.id,
        name: r.name,
        displayName: r.display_name,
        description: r.description,
        version: r.version,
        projectType: r.project_type,
        sourceType: r.source_type,
        sourceUrl: r.source_url,
        enabled: Boolean(r.enabled),
        installedAt: r.installed_at,
        childSkillsCount: r.child_skills_count,
        toolsCount: r.tools_count,
        resourcesCount: r.resources_count,
        projectMap,
      };
    });
  }

  deleteProject(id: string): void {
    const stmt = this.db.prepare('DELETE FROM skill_projects WHERE id = ?');
    stmt.run(id);
  }

  // ==================== Runtime Intent Persistence ====================

  saveRuntimeIntent(intent: RuntimeIntent): void {
    const stmt = this.db.prepare(`
      INSERT INTO runtime_intents (project_id, task, goal, intent_json)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(intent.projectId, intent.task, intent.goal, JSON.stringify(intent));
  }

  getLatestRuntimeIntent(projectId: string): RuntimeIntent | null {
    const stmt = this.db.prepare(`
      SELECT intent_json FROM runtime_intents
      WHERE project_id = ?
      ORDER BY id DESC LIMIT 1
    `);
    const row: any = stmt.get(projectId);
    if (!row) return null;
    try {
      return JSON.parse(row.intent_json);
    } catch {
      return null;
    }
  }

  // ==================== Execution Run Persistence ====================

  saveExecutionRun(run: ExecutionRun): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO execution_runs (
        run_id, task, project_id, plan_id, status, research_cutoff, started_at, finished_at, error, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      run.runId,
      run.task,
      run.projectId,
      run.planId || '',
      run.status,
      run.researchCutoff || null,
      run.startedAt,
      run.finishedAt || null,
      run.error || null,
      run.summary || null
    );
  }

  getExecutionRun(runId: string): ExecutionRun | null {
    const stmt = this.db.prepare('SELECT * FROM execution_runs WHERE run_id = ?');
    const row: any = stmt.get(runId);
    if (!row) return null;
    return {
      runId: row.run_id,
      task: row.task,
      projectId: row.project_id,
      planId: row.plan_id,
      status: row.status,
      researchCutoff: row.research_cutoff,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error,
      summary: row.summary,
    };
  }

  listExecutionRuns(limit = 20): ExecutionRun[] {
    const stmt = this.db.prepare('SELECT * FROM execution_runs ORDER BY started_at DESC LIMIT ?');
    const rows: any[] = stmt.all(limit) as any[];
    return rows.map((row) => ({
      runId: row.run_id,
      task: row.task,
      projectId: row.project_id,
      planId: row.plan_id,
      status: row.status,
      researchCutoff: row.research_cutoff,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error,
      summary: row.summary,
    }));
  }

  // ==================== Execution Step Persistence ====================

  saveExecutionStep(step: ExecutionStep, runId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO execution_steps (
        step_id, run_id, skill_id, skill_name, title, action, status,
        depends_on_json, expected_output, input_json, output_json, error_json,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      step.stepId,
      runId,
      step.skillId || null,
      step.skillName || null,
      step.title || '',
      step.action,
      step.status,
      JSON.stringify(step.dependsOn || []),
      step.expectedOutput || '',
      JSON.stringify(step.input || null),
      JSON.stringify(step.output || null),
      step.error ? JSON.stringify(step.error) : null,
      step.startedAt || null,
      step.completedAt || null
    );
  }

  getExecutionSteps(runId: string): ExecutionStep[] {
    const stmt = this.db.prepare('SELECT * FROM execution_steps WHERE run_id = ? ORDER BY rowid ASC');
    const rows: any[] = stmt.all(runId) as any[];
    return rows.map((r) => ({
      stepId: r.step_id,
      skillId: r.skill_id,
      skillName: r.skill_name,
      title: r.title,
      action: r.action,
      status: r.status,
      dependsOn: r.depends_on_json ? JSON.parse(r.depends_on_json) : [],
      expectedOutput: r.expected_output,
      input: r.input_json ? JSON.parse(r.input_json) : null,
      output: r.output_json ? JSON.parse(r.output_json) : null,
      error: r.error_json ? JSON.parse(r.error_json) : undefined,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  }

  // ==================== Execution Trace Persistence ====================

  saveExecutionTrace(trace: ExecutionTrace): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO execution_traces (
        trace_id, run_id, step_id, action, tool, status,
        duration_ms, input_json, output_json, artifact_ids_json, error, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      trace.traceId,
      trace.runId,
      trace.stepId,
      trace.action,
      trace.tool || null,
      trace.status,
      trace.durationMs || 0,
      trace.input ? JSON.stringify(trace.input) : null,
      trace.output ? JSON.stringify(trace.output) : null,
      JSON.stringify(trace.artifactIds || []),
      trace.error || null,
      trace.timestamp
    );
  }

  getExecutionTraces(runId: string): ExecutionTrace[] {
    const stmt = this.db.prepare('SELECT * FROM execution_traces WHERE run_id = ? ORDER BY timestamp ASC');
    const rows: any[] = stmt.all(runId) as any[];
    return rows.map((r) => ({
      traceId: r.trace_id,
      runId: r.run_id,
      stepId: r.step_id,
      action: r.action,
      tool: r.tool,
      status: r.status,
      durationMs: r.duration_ms,
      input: r.input_json ? JSON.parse(r.input_json) : undefined,
      output: r.output_json ? JSON.parse(r.output_json) : undefined,
      artifactIds: r.artifact_ids_json ? JSON.parse(r.artifact_ids_json) : [],
      error: r.error,
      timestamp: r.timestamp,
    }));
  }

  // ==================== Artifact Persistence ====================

  saveArtifact(artifact: Artifact, runId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO artifacts (
        artifact_id, run_id, type, name, producer_step_id,
        producer_skill_id, producer_skill_name, content_json,
        input_artifact_ids_json, evidence_ids_json, confidence,
        status, timestamp, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      artifact.artifactId,
      runId,
      artifact.type,
      artifact.name,
      artifact.producerStepId,
      artifact.producerSkillId || null,
      artifact.producerSkillName || null,
      JSON.stringify(artifact.content),
      JSON.stringify(artifact.inputArtifactIds || []),
      JSON.stringify(artifact.evidenceIds || []),
      artifact.confidence || 1.0,
      artifact.status,
      artifact.timestamp,
      artifact.metadata ? JSON.stringify(artifact.metadata) : null
    );
  }

  getArtifacts(runId: string): Artifact[] {
    const stmt = this.db.prepare('SELECT * FROM artifacts WHERE run_id = ? ORDER BY timestamp ASC');
    const rows: any[] = stmt.all(runId) as any[];
    return rows.map((r) => ({
      artifactId: r.artifact_id,
      type: r.type,
      name: r.name,
      producerStepId: r.producer_step_id,
      producerSkillId: r.producer_skill_id,
      producerSkillName: r.producer_skill_name,
      content: JSON.parse(r.content_json),
      inputArtifactIds: r.input_artifact_ids_json ? JSON.parse(r.input_artifact_ids_json) : [],
      evidenceIds: r.evidence_ids_json ? JSON.parse(r.evidence_ids_json) : [],
      confidence: r.confidence,
      status: r.status,
      timestamp: r.timestamp,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
    }));
  }

  // ==================== Evidence Reference Persistence ====================

  saveEvidenceRef(evidence: EvidenceRef, runId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO evidence_refs (
        evidence_id, run_id, source, url, title, published_at,
        accessed_at, data_date, claim, artifact_id, data_type, has_temporal_conflict
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      evidence.evidenceId,
      runId,
      evidence.source,
      evidence.url || null,
      evidence.title || null,
      evidence.publishedAt || null,
      evidence.accessedAt || null,
      evidence.dataDate || null,
      evidence.claim || null,
      evidence.artifactId || null,
      evidence.dataType || 'FACT',
      evidence.hasTemporalConflict ? 1 : 0
    );
  }

  getEvidenceRefs(runId: string): EvidenceRef[] {
    const stmt = this.db.prepare('SELECT * FROM evidence_refs WHERE run_id = ?');
    const rows: any[] = stmt.all(runId) as any[];
    return rows.map((r) => ({
      evidenceId: r.evidence_id,
      source: r.source,
      url: r.url,
      title: r.title,
      publishedAt: r.published_at,
      accessedAt: r.accessed_at,
      dataDate: r.data_date,
      claim: r.claim,
      artifactId: r.artifact_id,
      dataType: r.data_type,
      hasTemporalConflict: Boolean(r.has_temporal_conflict),
    }));
  }

  // ==================== Environment Profile Persistence ====================

  saveEnvironmentProfile(profile: EnvironmentProfile): void {
    const stmt = this.db.prepare(`
      INSERT INTO environment_profiles (os, architecture, profile_json)
      VALUES (?, ?, ?)
    `);
    stmt.run(profile.os, profile.architecture, JSON.stringify(profile));
  }

  getLatestEnvironmentProfile(): EnvironmentProfile | null {
    const stmt = this.db.prepare('SELECT profile_json FROM environment_profiles ORDER BY id DESC LIMIT 1');
    const row: any = stmt.get();
    if (!row) return null;
    try {
      return JSON.parse(row.profile_json);
    } catch {
      return null;
    }
  }

  // ==================== Tool Call Audit Log ====================

  saveToolCall(call: {
    runId?: string;
    stepId?: string;
    toolName: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    success: boolean;
    error?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO tool_calls (
        run_id, step_id, tool_name, input_json, output_json, duration_ms, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      call.runId || null,
      call.stepId || null,
      call.toolName,
      JSON.stringify(call.input),
      JSON.stringify(call.output),
      call.durationMs,
      call.success ? 1 : 0,
      call.error || null
    );
  }

  // Convenience aliases for clean API access
  getRun(runId: string): ExecutionRun | null {
    return this.getExecutionRun(runId);
  }

  listRuns(limit = 20): ExecutionRun[] {
    return this.listExecutionRuns(limit);
  }

  listArtifacts(runId: string): Artifact[] {
    return this.getArtifacts(runId);
  }

  listTraces(runId: string): ExecutionTrace[] {
    return this.getExecutionTraces(runId);
  }
}

// Global Singleton Database instance
export const globalSkillDb = new SkillRuntimeDatabase();
