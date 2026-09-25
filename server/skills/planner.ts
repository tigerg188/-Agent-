import crypto from 'crypto';
import {
  SkillProjectMap,
  SkillEntry,
  RuntimeIntent,
  ExecutionPlan,
  ExecutionStep,
  ExecutionDependency,
  EnvironmentProfile,
} from './types';

export class SkillPlanner {
  /**
   * Section 24, 26, 27: Build DAG-based Execution Plan
   * Organizes steps into parallel groups and dependencies without artificial serialization.
   */
  plan(
    task: string,
    runtimeIntent: RuntimeIntent,
    projectMap: SkillProjectMap,
    envProfile?: EnvironmentProfile
  ): ExecutionPlan {
    const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const steps: ExecutionStep[] = [];
    const dependencies: ExecutionDependency[] = [];
    const parallelGroups: string[][] = [];
    const expectedArtifacts: string[] = [];

    const mainEntry = projectMap.mainEntry;
    const entries = projectMap.entries || [];

    // Step 1: Task Scope & Definition (Action: model / skill router)
    const step1Id = 'step_1_scope';
    steps.push({
      stepId: step1Id,
      skillId: mainEntry?.path ? `skill_${crypto.createHash('md5').update(mainEntry.path).digest('hex').slice(0, 8)}` : undefined,
      skillName: mainEntry?.name || 'Project Router',
      title: '课题拆解与研究基准设定',
      action: 'model',
      input: {
        task,
        researchCutoff: envProfile?.currentDate || '2026-09-24',
        goal: runtimeIntent.goal,
      },
      dependsOn: [],
      expectedOutput: '课题开题报告与专项任务分解',
      status: 'pending',
    });
    expectedArtifacts.push('ResearchScopeArtifact');

    // Step 2: Live Browser & Web Intelligence Gathering (Action: browser)
    const step2Id = 'step_2_browser';
    steps.push({
      stepId: step2Id,
      title: '多源网络前沿事实与权威指标采集',
      action: 'browser',
      input: {
        keyword: task.slice(0, 30),
        researchCutoff: envProfile?.currentDate || '2026-09-24',
      },
      dependsOn: [step1Id],
      expectedOutput: '实时网页正文数据与一手事实列表',
      status: 'pending',
    });
    dependencies.push({ stepId: step2Id, dependsOnStepId: step1Id, type: 'hard' });
    expectedArtifacts.push('WebIntelligenceArtifact');

    // Steps 3.x: Parallel Specialty Analysis Skills (Action: skill)
    // Section 26 & 27: Market, Technology, Company, SupplyChain run in parallel!
    // Steps 3.x: Dynamic Specialty Analysis & Skill Execution
    // Eliminate hardcoded slice(0, 4): Select skills relevant to task & author's declared/inferred workflow
    const parallelStepIds: string[] = [];
    const nonMainEntries = entries.filter((e) => e.path !== mainEntry?.path);

    // If there are specialty skills, evaluate relevance and dependency order
    if (nonMainEntries.length > 0) {
      const lowerTask = task.toLowerCase();

      // Score each skill's relevance to the specific task prompt and goals
      const scoredSkills = nonMainEntries.map((spec) => {
        let score = 1; // baseline inclusion candidate
        const searchCorpus = `${spec.name} ${spec.displayName || ''} ${spec.description || ''} ${(spec.triggers || []).join(' ')}`.toLowerCase();

        const taskKeywords = lowerTask.split(/[\s,，、/]+/).filter((w) => w.length >= 2);
        for (const kw of taskKeywords) {
          if (searchCorpus.includes(kw)) score += 3;
        }

        // Domain affinity
        if (lowerTask.includes('人形机器人') || lowerTask.includes('机器人')) {
          if (searchCorpus.includes('市场') || searchCorpus.includes('规模') || searchCorpus.includes('market')) score += 5;
          if (searchCorpus.includes('技术') || searchCorpus.includes('架构') || searchCorpus.includes('tech')) score += 5;
          if (searchCorpus.includes('供应链') || searchCorpus.includes('硬件') || searchCorpus.includes('supply')) score += 5;
          if (searchCorpus.includes('商业') || searchCorpus.includes('场景') || searchCorpus.includes('落地') || searchCorpus.includes('投资')) score += 5;
          if (searchCorpus.includes('竞争') || searchCorpus.includes('格局') || searchCorpus.includes('company')) score += 4;
        }

        // Check if runtimeIntent explicitly specifies this skill
        const mentionsSkill = runtimeIntent.sequence?.some((seq) =>
          seq.title.toLowerCase().includes(spec.name.toLowerCase()) ||
          seq.action.toLowerCase().includes(spec.name.toLowerCase())
        );
        if (mentionsSkill) score += 10;

        return { spec, score };
      });

      // Filter and sort by relevance: include all meaningful matches (threshold >= 2)
      // If task is comprehensive/broad, include up to all relevant specialized skills
      scoredSkills.sort((a, b) => b.score - a.score);
      const chosenSkills = scoredSkills.filter((s) => s.score >= 2).map((s) => s.spec);

      // If no keyword match, take the active specialty skills (up to total available)
      const finalSpecialties = chosenSkills.length > 0 ? chosenSkills : nonMainEntries;

      // Group into tiers based on 'feeds' dependency relationships
      const upstreamSkills: SkillEntry[] = [];
      const downstreamSkills: SkillEntry[] = [];

      for (const spec of finalSpecialties) {
        // If other skills feed into this one, it should run after upstream
        const hasIncomingFeeds = (projectMap.relationships || []).some(
          (rel) => rel.to === spec.id && rel.type === 'feeds'
        );
        if (hasIncomingFeeds && finalSpecialties.length > 1) {
          downstreamSkills.push(spec);
        } else {
          upstreamSkills.push(spec);
        }
      }

      // Tier 1: Upstream / Foundation specialty skills (run in parallel after web intelligence)
      const tier1StepIds: string[] = [];
      for (let i = 0; i < upstreamSkills.length; i++) {
        const spec = upstreamSkills[i];
        const stepId = `step_3_1_${spec.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${spec.id || i}`;
        tier1StepIds.push(stepId);
        parallelStepIds.push(stepId);

        steps.push({
          stepId,
          skillId: spec.id,
          skillName: spec.name,
          title: `专项研判：${spec.displayName || spec.name}`,
          action: 'skill',
          input: {
            task,
            specialtyName: spec.name,
            specialtyPath: spec.path,
            requiresWebData: true,
          },
          dependsOn: [step2Id],
          expectedOutput: `${spec.displayName || spec.name} 结构化分析产物`,
          status: 'pending',
        });

        dependencies.push({ stepId, dependsOnStepId: step2Id, type: 'hard' });
        expectedArtifacts.push(`${spec.name}_Artifact`);
      }

      // Tier 2: Downstream synthesis specialty skills (depends on Tier 1)
      const tier2StepIds: string[] = [];
      for (let i = 0; i < downstreamSkills.length; i++) {
        const spec = downstreamSkills[i];
        const stepId = `step_3_2_${spec.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${spec.id || i}`;
        tier2StepIds.push(stepId);
        parallelStepIds.push(stepId);

        steps.push({
          stepId,
          skillId: spec.id,
          skillName: spec.name,
          title: `综合推演：${spec.displayName || spec.name}`,
          action: 'skill',
          input: {
            task,
            specialtyName: spec.name,
            specialtyPath: spec.path,
            requiresWebData: false,
          },
          dependsOn: tier1StepIds.length > 0 ? tier1StepIds : [step2Id],
          expectedOutput: `${spec.displayName || spec.name} 综合推演产物`,
          status: 'pending',
        });

        for (const t1Id of (tier1StepIds.length > 0 ? tier1StepIds : [step2Id])) {
          dependencies.push({ stepId, dependsOnStepId: t1Id, type: 'hard' });
        }
        expectedArtifacts.push(`${spec.name}_Artifact`);
      }

      // Add parallel execution groups
      parallelGroups.push([step1Id]);
      parallelGroups.push([step2Id]);
      if (tier1StepIds.length > 0) parallelGroups.push(tier1StepIds);
      if (tier2StepIds.length > 0) parallelGroups.push(tier2StepIds);
    } else {
      // Fallback single specialty skill step
      const step3Id = 'step_3_deep_analysis';
      parallelStepIds.push(step3Id);
      steps.push({
        stepId: step3Id,
        title: '专业方法论推演与量化评估',
        action: 'skill',
        input: { task },
        dependsOn: [step2Id],
        expectedOutput: '专业方法论推演产物',
        status: 'pending',
      });
      dependencies.push({ stepId: step3Id, dependsOnStepId: step2Id, type: 'hard' });
      expectedArtifacts.push('SpecialtyAnalysisArtifact');

      parallelGroups.push([step1Id]);
      parallelGroups.push([step2Id]);
      parallelGroups.push([step3Id]);
    }

    // Step 4: Cross-Validation & Synthesis (Action: file)
    // Depends on all final parallel specialty steps!
    const step4Id = 'step_4_synthesis';
    steps.push({
      stepId: step4Id,
      title: '产物交叉验证与主报告成果交付',
      action: 'file',
      input: {
        task,
        targetFilename: `${task.slice(0, 20).replace(/[/\\?%*:|"<>]/g, '_')}-研报.md`,
        expectedArtifactIds: expectedArtifacts,
      },
      dependsOn: parallelStepIds,
      expectedOutput: '完整结构化研报与证据链闭环',
      status: 'pending',
    });

    for (const pId of parallelStepIds) {
      dependencies.push({ stepId: step4Id, dependsOnStepId: pId, type: 'hard' });
    }
    expectedArtifacts.push('FinalReportArtifact');
    parallelGroups.push([step4Id]);

    return {
      planId: `plan_${runId}`,
      runId,
      projectId: projectMap.projectId,
      task,
      steps,
      dependencies,
      parallelGroups,
      expectedArtifacts,
      createdAt: new Date().toISOString(),
    };
  }
}

export const globalSkillPlanner = new SkillPlanner();
