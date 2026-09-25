import crypto from 'crypto';
import {
  SkillProjectMap,
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
    const parallelStepIds: string[] = [];

    // Filter relevant specialty skills
    const specialtySkills = entries.filter((e) => e.path !== mainEntry?.path);
    const chosenSpecialties = specialtySkills.length > 0 ? specialtySkills.slice(0, 4) : [];

    if (chosenSpecialties.length > 0) {
      for (let i = 0; i < chosenSpecialties.length; i++) {
        const spec = chosenSpecialties[i];
        const stepId = `step_3_${i + 1}_${spec.id || i}`;
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
    }

    // Step 4: Cross-Validation & Synthesis (Action: model / file)
    // Depends on all parallel steps!
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

    // Section 26: Group parallel steps
    parallelGroups.push([step1Id]);
    parallelGroups.push([step2Id]);
    parallelGroups.push(parallelStepIds);
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
