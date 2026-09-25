import crypto from 'crypto';
import { Artifact, EvidenceRef } from './types';
import { globalSkillDb } from '../database/db';

export class ArtifactBus {
  private artifacts: Map<string, Artifact> = new Map();
  private evidenceMap: Map<string, EvidenceRef> = new Map();
  private runArtifacts: Map<string, string[]> = new Map();
  private runEvidences: Map<string, string[]> = new Map();

  /**
   * Section 28: Publish a structured artifact onto the bus
   */
  publishArtifact(
    runId: string,
    params: {
      type: string;
      name: string;
      producerStepId: string;
      producerSkillId?: string;
      producerSkillName?: string;
      content: unknown;
      inputArtifactIds?: string[];
      evidenceIds?: string[];
      confidence?: number;
      metadata?: Record<string, any>;
    }
  ): Artifact {
    const artifactId = `art_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const artifact: Artifact = {
      artifactId,
      type: params.type,
      name: params.name,
      producerStepId: params.producerStepId,
      producerSkillId: params.producerSkillId,
      producerSkillName: params.producerSkillName,
      content: params.content,
      inputArtifactIds: params.inputArtifactIds || [],
      evidenceIds: params.evidenceIds || [],
      confidence: params.confidence || 0.95,
      status: 'processed',
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    this.artifacts.set(artifactId, artifact);
    const existingArts = this.runArtifacts.get(runId) || [];
    existingArts.push(artifactId);
    this.runArtifacts.set(runId, existingArts);

    // Persist to database
    try {
      globalSkillDb.saveArtifact(artifact, runId);
    } catch (e) {
      console.warn('[ArtifactBus] Failed to persist artifact:', e);
    }

    return artifact;
  }

  /**
   * Section 38: Register an Evidence Reference
   */
  registerEvidence(
    runId: string,
    evidence: {
      source: string;
      url?: string;
      title?: string;
      publishedAt?: string;
      accessedAt?: string;
      dataDate?: string;
      claim?: string;
      artifactId?: string;
      dataType?: 'FACT' | 'ESTIMATE' | 'ASSUMPTION' | 'CALCULATION' | 'FORECAST' | 'OPINION';
      hasTemporalConflict?: boolean;
    }
  ): EvidenceRef {
    const evidenceId = `evi_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const evidenceRef: EvidenceRef = {
      evidenceId,
      source: evidence.source,
      url: evidence.url,
      title: evidence.title,
      publishedAt: evidence.publishedAt || '2026-09-01',
      accessedAt: evidence.accessedAt || new Date().toISOString(),
      dataDate: evidence.dataDate || '2026-09-24',
      claim: evidence.claim,
      artifactId: evidence.artifactId,
      dataType: evidence.dataType || 'FACT',
      hasTemporalConflict: evidence.hasTemporalConflict || false,
    };

    this.evidenceMap.set(evidenceId, evidenceRef);
    const existingEvis = this.runEvidences.get(runId) || [];
    existingEvis.push(evidenceId);
    this.runEvidences.set(runId, existingEvis);

    try {
      globalSkillDb.saveEvidenceRef(evidenceRef, runId);
    } catch (e) {
      console.warn('[ArtifactBus] Failed to persist evidence:', e);
    }

    return evidenceRef;
  }

  getArtifact(artifactId: string): Artifact | undefined {
    return this.artifacts.get(artifactId);
  }

  getArtifactsByRunId(runId: string): Artifact[] {
    try {
      const dbList = globalSkillDb.getArtifacts(runId);
      if (dbList && dbList.length > 0) return dbList;
    } catch {}
    const ids = this.runArtifacts.get(runId) || [];
    return ids.map((id) => this.artifacts.get(id)!).filter(Boolean);
  }

  getEvidenceByRunId(runId: string): EvidenceRef[] {
    try {
      const dbList = globalSkillDb.getEvidenceRefs(runId);
      if (dbList && dbList.length > 0) return dbList;
    } catch {}
    const ids = this.runEvidences.get(runId) || [];
    return ids.map((id) => this.evidenceMap.get(id)!).filter(Boolean);
  }

  /**
   * Section 30: Traceability lookup
   * Traces an artifact back to its producer step, upstream input artifacts, and source evidence
   */
  traceArtifact(artifactId: string): {
    artifact: Artifact | undefined;
    upstreamArtifacts: Artifact[];
    evidence: EvidenceRef[];
  } {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return { artifact: undefined, upstreamArtifacts: [], evidence: [] };
    }

    const upstreamArtifacts = (artifact.inputArtifactIds || [])
      .map((id) => this.artifacts.get(id))
      .filter((a): a is Artifact => Boolean(a));

    const evidence = (artifact.evidenceIds || [])
      .map((id) => this.evidenceMap.get(id))
      .filter((e): e is EvidenceRef => Boolean(e));

    return { artifact, upstreamArtifacts, evidence };
  }
}

export const globalArtifactBus = new ArtifactBus();
