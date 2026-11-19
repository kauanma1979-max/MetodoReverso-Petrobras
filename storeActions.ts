import {
  DEFAULT_EDITAL_RULES,
  DEFAULT_ENGINE_CONFIG,
  evaluateExamAttempt,
  parseAnswerKeyFromRawText,
  parseQuestionsFromRawText,
  round1,
} from '../shared/engine.ts';
import type {
  AptitudeStatus,
  Attempt,
  AttemptAnswerInput,
  Discipline,
  DocumentRecord,
  DocumentType,
  EvaluatedAnswer,
  Exam,
  Journey,
  PerformanceOverview,
  PriorityLevel,
  Question,
  QuestionOrigin,
  StudyMaterial,
  StudyPlan,
  StudyPlanItem,
  Subtopic,
  SubtopicPerformance,
  TutorMessage,
} from '../shared/types.ts';
import {
  getLastBackupTimestamp,
  loadRelationalStore,
  mergeRelationalStores,
  recordLastBackupTimestamp,
  requestBrowserStoragePersistence,
  saveRelationalStore,
  uid,
  validateRelationalBackupPayload,
  type RelationalJsonStore,
} from './relationalJsonDb.ts';

export interface WorkspaceData {
  journey: Journey;
  disciplines: Discipline[];
  subtopics: Subtopic[];
  documents: DocumentRecord[];
  exams: Exam[];
  questions: Question[];
  attempts: Attempt[];
  performance: PerformanceOverview;
  latestPlan: StudyPlan | null;
  materials: StudyMaterial[];
  tutorMessages: TutorMessage[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listJourneys(): Promise<Journey[]> {
  const store = await loadRelationalStore();
  return [...store.journeys].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createJourney(payload: {
  title: string;
  organization: string;
  roleEmphasis: string;
  board: string;
  year?: number | null;
  targetDate?: string | null;
  dailyMinutes?: number;
  simuladosCount?: number;
  defaultCustomExamQuestions?: number;
}): Promise<Journey> {
  const store = await loadRelationalStore();
  const journey: Journey = {
    id: uid('jrn'),
    title: payload.title.trim(),
    organization: String(payload.organization || 'Petrobras').trim(),
    roleEmphasis: String(payload.roleEmphasis || 'Geral').trim(),
    board: String(payload.board || 'CESGRANRIO').trim(),
    year: payload.year ? Number(payload.year) : null,
    targetDate: payload.targetDate || null,
    dailyMinutes: Number(payload.dailyMinutes) || 90,
    simuladosCount: Number(payload.simuladosCount) || 3,
    defaultCustomExamQuestions: Number(payload.defaultCustomExamQuestions) || 15,
    isDemoStructure: false,
    engineConfig: { ...DEFAULT_ENGINE_CONFIG },
    editalRules: { ...DEFAULT_EDITAL_RULES },
    createdAt: nowIso(),
  };
  store.journeys.push(journey);
  await saveRelationalStore(store);
  return journey;
}

export async function updateJourney(id: string, payload: Partial<Journey>): Promise<Journey> {
  const store = await loadRelationalStore();
  const idx = store.journeys.findIndex((j) => j.id === id);
  if (idx === -1) throw new Error('Jornada não encontrada.');
  const cur = store.journeys[idx];
  const updated: Journey = {
    ...cur,
    ...payload,
    engineConfig: payload.engineConfig
      ? { ...cur.engineConfig, ...payload.engineConfig }
      : cur.engineConfig,
    editalRules: payload.editalRules
      ? { ...cur.editalRules, ...payload.editalRules }
      : cur.editalRules,
  };
  store.journeys[idx] = updated;
  await saveRelationalStore(store);
  return updated;
}

export async function deleteJourney(id: string): Promise<void> {
  const store = await loadRelationalStore();
  const attemptIds = new Set(
    store.attempts.filter((a) => a.journeyId === id).map((a) => a.id)
  );
  const planIds = new Set(
    store.studyPlans.filter((p) => p.journeyId === id).map((p) => p.id)
  );

  store.journeys = store.journeys.filter((j) => j.id !== id);
  store.disciplines = store.disciplines.filter((d) => d.journeyId !== id);
  store.subtopics = store.subtopics.filter((s) => s.journeyId !== id);
  store.documents = store.documents.filter((d) => d.journeyId !== id);
  store.exams = store.exams.filter((e) => e.journeyId !== id);
  store.questions = store.questions.filter((q) => q.journeyId !== id);
  store.attempts = store.attempts.filter((a) => a.journeyId !== id);
  store.attemptAnswers = store.attemptAnswers.filter((aa) => !attemptIds.has(aa.attemptId));
  store.studyPlans = store.studyPlans.filter((p) => p.journeyId !== id);
  store.studyPlanItems = store.studyPlanItems.filter((pi) => !planIds.has(pi.planId));
  store.studyMaterials = store.studyMaterials.filter((m) => m.journeyId !== id);
  store.tutorMessages = store.tutorMessages.filter((t) => t.journeyId !== id);

  await saveRelationalStore(store);
}

export async function getWorkspace(journeyId: string): Promise<WorkspaceData> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const disciplines = store.disciplines
    .filter((d) => d.journeyId === journeyId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name));

  const subtopics = store.subtopics.filter((s) => s.journeyId === journeyId);

  const documents = store.documents
    .filter((d) => d.journeyId === journeyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const exams = store.exams
    .filter((e) => e.journeyId === journeyId)
    .sort((a, b) => a.stage.localeCompare(b.stage) || a.orderIndex - b.orderIndex);

  const questions = store.questions
    .filter((q) => q.journeyId === journeyId)
    .sort((a, b) => a.questionNumber - b.questionNumber);

  const ansByAttempt = new Map<string, EvaluatedAnswer[]>();
  for (const ans of store.attemptAnswers) {
    const arr = ansByAttempt.get(ans.attemptId) ?? [];
    arr.push(ans);
    ansByAttempt.set(ans.attemptId, arr);
  }

  const attempts = store.attempts
    .filter((a) => a.journeyId === journeyId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((a) => ({
      ...a,
      answers: ansByAttempt.get(a.id) ?? [],
    }));

  const plans = store.studyPlans
    .filter((p) => p.journeyId === journeyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestPlanHead = plans[0] ?? null;
  const latestPlan: StudyPlan | null = latestPlanHead
    ? {
        ...latestPlanHead,
        items: store.studyPlanItems.filter((i) => i.planId === latestPlanHead.id),
      }
    : null;

  const materials = store.studyMaterials
    .filter((m) => m.journeyId === journeyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const tutorMessages = store.tutorMessages
    .filter((m) => m.journeyId === journeyId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const performance = computePerformanceOverviewFromStore(store, journeyId);

  return {
    journey,
    disciplines,
    subtopics,
    documents,
    exams,
    questions,
    attempts,
    performance,
    latestPlan,
    materials,
    tutorMessages,
  };
}

export function computePerformanceOverviewFromStore(
  store: RelationalJsonStore,
  journeyId: string
): PerformanceOverview {
  const journey = store.journeys.find((j) => j.id === journeyId);
  const config = journey?.engineConfig ?? DEFAULT_ENGINE_CONFIG;
  const disciplines = store.disciplines
    .filter((d) => d.journeyId === journeyId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const subtopics = store.subtopics.filter((s) => s.journeyId === journeyId);
  const exams = store.exams.filter((e) => e.journeyId === journeyId);
  const questions = store.questions.filter((q) => q.journeyId === journeyId);
  const attempts = store.attempts
    .filter((a) => a.journeyId === journeyId && a.status === 'finalizada')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const discMap = new Map(disciplines.map((d) => [d.id, d]));
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const attemptMap = new Map(attempts.map((a) => [a.id, a]));

  const allAnswerRows = store.attemptAnswers
    .filter((aa) => attemptMap.has(aa.attemptId))
    .sort((a, b) => {
      const aTime = attemptMap.get(a.attemptId)!.startedAt;
      const bTime = attemptMap.get(b.attemptId)!.startedAt;
      return aTime.localeCompare(bTime);
    });

  const latestAnswerByQuestion = new Map<string, EvaluatedAnswer>();
  const historyBySubtopic = new Map<
    string,
    Map<number, { correct: number; graded: number; date: string }>
  >();

  let totalAnswerRecords = 0;
  let totalBlankRecords = 0;
  let totalCorrect = 0;
  let totalWrong = 0;

  for (const row of allAnswerRows) {
    const att = attemptMap.get(row.attemptId)!;
    if (!row.selectedOption) {
      totalBlankRecords++;
    } else {
      totalAnswerRecords++;
      if (row.isCorrect === true) totalCorrect++;
      else if (row.isCorrect === false) totalWrong++;
    }
    latestAnswerByQuestion.set(row.questionId, row);

    const q = qMap.get(row.questionId);
    if (q?.subtopicId && row.selectedOption && row.isCorrect !== null) {
      if (!historyBySubtopic.has(q.subtopicId)) {
        historyBySubtopic.set(q.subtopicId, new Map());
      }
      const attemptHist = historyBySubtopic.get(q.subtopicId)!;
      const prev = attemptHist.get(att.attemptNumber) ?? {
        correct: 0,
        graded: 0,
        date: att.startedAt,
      };
      prev.graded += 1;
      if (row.isCorrect) prev.correct += 1;
      attemptHist.set(att.attemptNumber, prev);
    }
  }

  let countDominio = 0;
  let countRevisao = 0;
  let countPrioridadeAlta = 0;
  let countPrioridadeMaxima = 0;
  let questionsAnsweredDistinct = 0;

  const originBreakdown: PerformanceOverview['originBreakdown'] = {
    oficial: { total: 0, answered: 0, correct: 0, wrong: 0 },
    inedita_ia: { total: 0, answered: 0, correct: 0, wrong: 0 },
    demonstracao: { total: 0, answered: 0, correct: 0, wrong: 0 },
    autoral: { total: 0, answered: 0, correct: 0, wrong: 0 },
  };

  for (const q of questions) {
    const bucket = originBreakdown[q.originType] ?? originBreakdown.oficial;
    bucket.total++;
    const latest = latestAnswerByQuestion.get(q.id);
    if (latest && latest.selectedOption) {
      questionsAnsweredDistinct++;
      bucket.answered++;
      if (latest.isCorrect === true) bucket.correct++;
      else if (latest.isCorrect === false) bucket.wrong++;

      const prio = latest.computedPriority;
      if (prio === 'dominio') countDominio++;
      else if (prio === 'revisao') countRevisao++;
      else if (prio === 'prioridade_alta') countPrioridadeAlta++;
      else if (prio === 'prioridade_maxima') countPrioridadeMaxima++;
    }
  }

  const gradedTotal = totalCorrect + totalWrong;
  const accuracyAnswered = gradedTotal > 0 ? round1((totalCorrect / gradedTotal) * 100) : 0;
  const totalExamSlots = attempts.reduce((acc, a) => acc + a.totalQuestions, 0);
  const accuracyTotal = totalExamSlots > 0 ? round1((totalCorrect / totalExamSlots) * 100) : 0;
  const masteryIndex =
    questionsAnsweredDistinct > 0
      ? round1((countDominio / questionsAnsweredDistinct) * 100)
      : 0;

  const bySubtopic: SubtopicPerformance[] = subtopics.map((sub) => {
    const disc = discMap.get(sub.disciplineId);
    const subQuestions = questions.filter((q) => q.subtopicId === sub.id);
    let answeredQ = 0;
    let blankQ = 0;
    let correctQ = 0;
    let wrongQ = 0;
    let domainQ = 0;
    let maxPrioCount = 0;
    let highPrioCount = 0;
    let revPrioCount = 0;

    for (const q of subQuestions) {
      const latest = latestAnswerByQuestion.get(q.id);
      if (!latest) continue;
      if (!latest.selectedOption) {
        blankQ++;
        continue;
      }
      answeredQ++;
      if (latest.isCorrect === true) correctQ++;
      else if (latest.isCorrect === false) wrongQ++;
      if (latest.computedPriority === 'dominio') domainQ++;
      else if (latest.computedPriority === 'prioridade_maxima') maxPrioCount++;
      else if (latest.computedPriority === 'prioridade_alta') highPrioCount++;
      else if (latest.computedPriority === 'revisao') revPrioCount++;
    }

    const subQIds = new Set(subQuestions.map((q) => q.id));
    const masteryConfirmedCount = allAnswerRows.filter(
      (r) => subQIds.has(r.questionId) && r.computedPriority === 'dominio'
    ).length;

    let priority: PriorityLevel = 'nao_avaliado';
    if (answeredQ > 0) {
      if (maxPrioCount > 0) priority = 'prioridade_maxima';
      else if (highPrioCount > 0) priority = 'prioridade_alta';
      else if (revPrioCount > 0) priority = 'revisao';
      else if (domainQ > 0) priority = 'dominio';
    }

    const gradedSub = correctQ + wrongQ;
    const accuracyPercent = gradedSub > 0 ? round1((correctQ / gradedSub) * 100) : 0;
    const masteryPercent = answeredQ > 0 ? round1((domainQ / answeredQ) * 100) : 0;

    const histMap = historyBySubtopic.get(sub.id);
    const historyPoints = histMap
      ? Array.from(histMap.entries()).map(([attemptNumber, val]) => ({
          attemptNumber,
          accuracyPercent: val.graded > 0 ? round1((val.correct / val.graded) * 100) : 0,
          date: val.date,
        }))
      : [];

    return {
      subtopicId: sub.id,
      subtopicTitle: sub.title,
      disciplineId: sub.disciplineId,
      disciplineName: disc?.name ?? 'Geral',
      macroDiscipline: disc?.macroDiscipline ?? 'Conhecimentos Gerais',
      availableQuestions: subQuestions.length,
      attemptedQuestions: answeredQ + blankQ,
      answeredQuestions: answeredQ,
      blankQuestions: blankQ,
      correctCount: correctQ,
      wrongCount: wrongQ,
      masteryConfirmedCount,
      accuracyPercent,
      masteryPercent,
      priority,
      lastReviewedAt: sub.lastReviewedAt,
      historyPoints,
    };
  });

  const byDiscipline = disciplines.map((d) => {
    const subs = bySubtopic.filter((s) => s.disciplineId === d.id);
    const answered = subs.reduce((a, s) => a + s.answeredQuestions, 0);
    const correct = subs.reduce((a, s) => a + s.correctCount, 0);
    const wrong = subs.reduce((a, s) => a + s.wrongCount, 0);
    const graded = correct + wrong;
    const domainSum = subs.reduce(
      (a, s) => a + Math.round((s.masteryPercent / 100) * s.answeredQuestions),
      0
    );
    return {
      disciplineId: d.id,
      name: d.name,
      macroDiscipline: d.macroDiscipline,
      answered,
      correct,
      accuracy: graded > 0 ? round1((correct / graded) * 100) : 0,
      mastery: answered > 0 ? round1((domainSum / answered) * 100) : 0,
    };
  });

  const macroMap = new Map<
    string,
    { answered: number; correct: number; wrong: number; domainWeighted: number }
  >();
  for (const d of byDiscipline) {
    const cur = macroMap.get(d.macroDiscipline) ?? {
      answered: 0,
      correct: 0,
      wrong: 0,
      domainWeighted: 0,
    };
    cur.answered += d.answered;
    cur.correct += d.correct;
    const dSubs = bySubtopic.filter((s) => s.disciplineId === d.disciplineId);
    cur.wrong += dSubs.reduce((a, s) => a + s.wrongCount, 0);
    cur.domainWeighted += Math.round((d.mastery / 100) * d.answered);
    macroMap.set(d.macroDiscipline, cur);
  }
  const byMacroDiscipline = Array.from(macroMap.entries()).map(([name, val]) => {
    const graded = val.correct + val.wrong;
    return {
      name,
      answered: val.answered,
      correct: val.correct,
      accuracy: graded > 0 ? round1((val.correct / graded) * 100) : 0,
      mastery: val.answered > 0 ? round1((val.domainWeighted / val.answered) * 100) : 0,
    };
  });

  const evolutionSeries = attempts.map((a) => ({
    attemptId: a.id,
    examTitle: examMap.get(a.examId)?.title ?? 'Avaliação',
    attemptNumber: a.attemptNumber,
    date: a.finishedAt ?? a.startedAt,
    accuracyAnswered: a.accuracyAnswered,
    accuracyTotal: a.accuracyTotal,
    masteryScore: a.masteryScore,
    aptitudeStatus: a.aptitudeStatus,
  }));

  const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const completedExamIds = new Set(attempts.map((a) => a.examId));

  const latestAptitude = latestAttempt
    ? { status: latestAttempt.aptitudeStatus, reasons: latestAttempt.aptitudeReasons }
    : {
        status: 'NAO_APTO' as AptitudeStatus,
        reasons: [
          `Realize o Diagnóstico Inicial para medir aproveitamento (meta ${config.minAproveitamentoToAdvance}%) e domínio real (meta ${config.minDominioToAdvance}%).`,
        ],
      };

  return {
    totalExamsCompleted: completedExamIds.size,
    totalAttempts: attempts.length,
    totalQuestionsInBank: questions.length,
    questionsAnsweredDistinct,
    questionsNeverAnswered: Math.max(0, questions.length - questionsAnsweredDistinct),
    totalAnswerRecords,
    totalBlankRecords,
    totalCorrect,
    totalWrong,
    accuracyAnswered,
    accuracyTotal,
    masteryIndex,
    countDominio,
    countRevisao,
    countPrioridadeAlta,
    countPrioridadeMaxima,
    originBreakdown,
    byMacroDiscipline,
    byDiscipline,
    bySubtopic,
    evolutionSeries,
    latestAptitude,
  };
}

export async function addDiscipline(
  journeyId: string,
  payload: { macroDiscipline: string; name: string; weight?: number; subtopics?: string[] }
): Promise<void> {
  const store = await loadRelationalStore();
  const maxOrd = store.disciplines
    .filter((d) => d.journeyId === journeyId)
    .reduce((m, d) => Math.max(m, d.orderIndex), 0);
  const discId = uid('disc');

  store.disciplines.push({
    id: discId,
    journeyId,
    macroDiscipline: payload.macroDiscipline || 'Conteúdo Programático',
    name: payload.name.trim(),
    weight: Number(payload.weight) || 1,
    orderIndex: maxOrd + 1,
  });

  if (Array.isArray(payload.subtopics)) {
    payload.subtopics.forEach((title, idx) => {
      if (title.trim()) {
        store.subtopics.push({
          id: uid('sub'),
          journeyId,
          disciplineId: discId,
          title: title.trim(),
          code: `T.${idx + 1}`,
          lastReviewedAt: null,
        });
      }
    });
  }
  await saveRelationalStore(store);
}

export async function addSubtopic(
  journeyId: string,
  payload: { disciplineId: string; title: string; code?: string }
): Promise<void> {
  const store = await loadRelationalStore();
  store.subtopics.push({
    id: uid('sub'),
    journeyId,
    disciplineId: payload.disciplineId,
    title: payload.title.trim(),
    code: payload.code?.trim() || '',
    lastReviewedAt: null,
  });
  await saveRelationalStore(store);
}

export async function submitExamAttempt(
  journeyId: string,
  examId: string,
  answers: AttemptAnswerInput[]
): Promise<Attempt> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');
  const examIdx = store.exams.findIndex((e) => e.id === examId && e.journeyId === journeyId);
  if (examIdx === -1) throw new Error('Prova não encontrada.');

  const questions = store.questions
    .filter((q) => q.journeyId === journeyId && q.examId === examId)
    .sort((a, b) => a.questionNumber - b.questionNumber);

  const previousAttempts = store.attempts
    .filter((a) => a.journeyId === journeyId && a.examId === examId)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const attemptNumber = previousAttempts.length + 1;
  const summary = evaluateExamAttempt({
    questions,
    answers,
    previousAttempts,
    config: journey.engineConfig,
  });

  const attemptId = uid('att');
  const timestamp = nowIso();

  const attemptRecord: Attempt = {
    id: attemptId,
    journeyId,
    examId,
    attemptNumber,
    startedAt: timestamp,
    finishedAt: timestamp,
    status: 'finalizada',
    totalQuestions: summary.totalQuestions,
    answeredCount: summary.answeredCount,
    blankCount: summary.blankCount,
    correctCount: summary.correctCount,
    wrongCount: summary.wrongCount,
    accuracyAnswered: summary.accuracyAnswered,
    accuracyTotal: summary.accuracyTotal,
    masteryScore: summary.masteryScore,
    aptitudeStatus: summary.aptitudeStatus,
    aptitudeReasons: summary.aptitudeReasons,
  };

  store.attempts.push(attemptRecord);

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const subMap = new Map(store.subtopics.map((s) => [s.id, s]));
  const evalAnswers: EvaluatedAnswer[] = [];

  for (const row of summary.evaluatedRows) {
    const ansRec: EvaluatedAnswer = {
      id: uid('ans'),
      attemptId,
      questionId: row.input.questionId,
      selectedOption: row.input.selectedOption,
      eliminatedOptions: row.input.eliminatedOptions ?? [],
      confidence: row.input.confidence,
      perceivedDifficulty: row.input.perceivedDifficulty,
      isCorrect: row.isCorrect,
      computedPriority: row.priority,
      computedAction: row.action,
      answeredAt: timestamp,
    };
    store.attemptAnswers.push(ansRec);
    evalAnswers.push(ansRec);

    const q = qMap.get(row.input.questionId);
    if (q?.subtopicId && row.input.selectedOption) {
      const sub = subMap.get(q.subtopicId);
      if (sub) sub.lastReviewedAt = timestamp;
    }
  }

  store.exams[examIdx] = {
    ...store.exams[examIdx],
    status: 'concluida',
  };

  await saveRelationalStore(store);
  return { ...attemptRecord, answers: evalAnswers };
}

export async function updateQuestionRecord(
  questionId: string,
  payload: Partial<Question>
): Promise<void> {
  const store = await loadRelationalStore();
  const idx = store.questions.findIndex((q) => q.id === questionId);
  if (idx === -1) throw new Error('Questão não encontrada.');
  store.questions[idx] = { ...store.questions[idx], ...payload };
  await saveRelationalStore(store);
}

export async function importDocumentToStore(
  journeyId: string,
  payload: {
    docType: DocumentType;
    title: string;
    filename: string;
    mimeType: string;
    rawText: string;
    needsManualReview: boolean;
    reviewNotes: string;
    targetExamId?: string | null;
    examMeta?: {
      year?: number | null;
      board?: string;
      concurso?: string;
      roleEmphasis?: string;
    };
  }
) {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const docId = uid('doc');
  const created = nowIso();
  const docTitle = payload.title.trim() || payload.filename;

  const docRecord: DocumentRecord = {
    id: docId,
    journeyId,
    docType: payload.docType,
    title: docTitle,
    sourceFilename: payload.filename,
    mimeType: payload.mimeType,
    rawText: payload.rawText,
    extractedMetadata: { examMeta: payload.examMeta ?? {} },
    needsManualReview: payload.needsManualReview,
    reviewNotes: payload.reviewNotes,
    createdAt: created,
  };
  store.documents.push(docRecord);

  let extractedQuestionsCount = 0;
  let createdExamId: string | null = null;
  let appliedKeysCount = 0;
  let divergencesCount = 0;
  let updatedEditalRules = false;

  if (payload.docType === 'edital') {
    const jIdx = store.journeys.findIndex((j) => j.id === journeyId);
    store.journeys[jIdx].editalRules = {
      ...journey.editalRules,
      hasImportedEdital: true,
      sourceDocumentTitle: docTitle,
      notes: `Documento "${docTitle}" importado. Confira e preencha os percentuais oficiais do edital.`,
    };
    updatedEditalRules = true;
  }

  if (payload.docType === 'prova_anterior') {
    const parsedQs = parseQuestionsFromRawText(payload.rawText);
    if (parsedQs.length > 0) {
      createdExamId = uid('exm');
      const maxOrd = store.exams
        .filter((e) => e.journeyId === journeyId)
        .reduce((m, e) => Math.max(m, e.orderIndex), 0);

      store.exams.push({
        id: createdExamId,
        journeyId,
        title: docTitle,
        stage: 'prova_anterior',
        orderIndex: maxOrd + 1,
        originConcurso: payload.examMeta?.concurso || journey.organization,
        year: payload.examMeta?.year ?? journey.year,
        board: payload.examMeta?.board || journey.board,
        roleEmphasis: payload.examMeta?.roleEmphasis || journey.roleEmphasis,
        disciplineScope: 'Multidisciplinar',
        documentId: docId,
        answerKeyDocumentId: null,
        isOfficial: true,
        isDemo: false,
        questionCount: parsedQs.length,
        status: 'nao_iniciada',
        createdAt: created,
      });

      for (const pq of parsedQs) {
        store.questions.push({
          id: uid('q'),
          journeyId,
          examId: createdExamId,
          disciplineId: null,
          subtopicId: null,
          questionNumber: pq.questionNumber,
          stem: pq.stem,
          options: pq.options,
          officialAnswer: null,
          preliminaryAnswer: null,
          answerDivergenceNote: '',
          explanation: '',
          distractorAnalysis: {},
          originType: 'oficial',
          sourceDocumentId: docId,
          sourcePage: null,
          sourceReference: `${docTitle} · Q${pq.questionNumber}`,
          needsManualReview: pq.needsManualReview,
          isFavorite: false,
          markedForReview: false,
          classificationReviewed: true,
          year: payload.examMeta?.year ?? journey.year,
          board: payload.examMeta?.board || journey.board,
          concurso: payload.examMeta?.concurso || journey.organization,
          roleEmphasis: payload.examMeta?.roleEmphasis || journey.roleEmphasis,
          createdAt: created,
        });
      }
      extractedQuestionsCount = parsedQs.length;
    }
  }

  if (
    payload.docType === 'gabarito_preliminar' ||
    payload.docType === 'gabarito_definitivo'
  ) {
    const keyMap = parseAnswerKeyFromRawText(payload.rawText);
    const targetQuestions = store.questions.filter(
      (q) =>
        q.journeyId === journeyId &&
        (!payload.targetExamId || q.examId === payload.targetExamId)
    );

    for (const q of targetQuestions) {
      const parsedLetter = keyMap[q.questionNumber];
      if (!parsedLetter) continue;
      appliedKeysCount++;

      if (payload.docType === 'gabarito_preliminar') {
        if (q.officialAnswer && q.officialAnswer !== parsedLetter) {
          divergencesCount++;
          q.answerDivergenceNote = `Divergência: Preliminar (${parsedLetter}) vs Definitivo (${q.officialAnswer})`;
        }
        q.preliminaryAnswer = parsedLetter;
        if (!q.officialAnswer) q.officialAnswer = parsedLetter;
      } else {
        if (q.preliminaryAnswer && q.preliminaryAnswer !== parsedLetter) {
          divergencesCount++;
          q.answerDivergenceNote = `Gabarito alterado: Preliminar (${q.preliminaryAnswer}) -> Definitivo (${parsedLetter})`;
        }
        q.officialAnswer = parsedLetter;
      }
    }

    if (payload.targetExamId && payload.docType === 'gabarito_definitivo') {
      const ex = store.exams.find((e) => e.id === payload.targetExamId);
      if (ex) ex.answerKeyDocumentId = docId;
    }
  }

  await saveRelationalStore(store);
  return {
    documentId: docId,
    needsManualReview: payload.needsManualReview,
    reviewNotes: payload.reviewNotes,
    extractedQuestionsCount,
    createdExamId,
    appliedKeysCount,
    divergencesCount,
    updatedEditalRules,
    createdDisciplinesCount: 0,
  };
}

export async function createCustomExamInStore(
  journeyId: string,
  payload: {
    title?: string;
    mode:
      | 'erros'
      | 'duvidas'
      | 'subtopico'
      | 'proporcional_edital'
      | 'simulado_inedito'
      | 'personalizado';
    count: number;
    subtopicId?: string | null;
    disciplineId?: string | null;
  }
): Promise<{ examId: string; count: number }> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const desiredCount = Math.max(1, Math.min(60, Number(payload.count) || 15));
  const journeyQuestions = store.questions.filter((q) => q.journeyId === journeyId);

  const attemptMap = new Map(
    store.attempts
      .filter((a) => a.journeyId === journeyId && a.status === 'finalizada')
      .map((a) => [a.id, a])
  );
  const latestByQ = new Map<string, EvaluatedAnswer>();
  for (const aa of store.attemptAnswers) {
    if (attemptMap.has(aa.attemptId)) {
      latestByQ.set(aa.questionId, aa);
    }
  }

  let pool = journeyQuestions;
  if (payload.mode === 'erros') {
    pool = journeyQuestions.filter((q) => latestByQ.get(q.id)?.isCorrect === false);
  } else if (payload.mode === 'duvidas') {
    pool = journeyQuestions.filter((q) => {
      const lat = latestByQ.get(q.id);
      return (
        lat &&
        (lat.computedPriority === 'revisao' ||
          lat.computedPriority === 'prioridade_maxima')
      );
    });
  } else if (payload.mode === 'subtopico' && payload.subtopicId) {
    pool = journeyQuestions.filter((q) => q.subtopicId === payload.subtopicId);
  } else if (payload.disciplineId) {
    pool = journeyQuestions.filter((q) => q.disciplineId === payload.disciplineId);
  }

  const selected = pool.slice(0, desiredCount);
  if (selected.length === 0) {
    throw new Error('Não há questões correspondentes a este filtro no banco da jornada.');
  }

  const examId = uid('exm');
  const created = nowIso();
  const maxOrd = store.exams
    .filter((e) => e.journeyId === journeyId)
    .reduce((m, e) => Math.max(m, e.orderIndex), 0);

  store.exams.push({
    id: examId,
    journeyId,
    title:
      payload.title ||
      `Caderno Personalizado (${payload.mode}) · ${selected.length} questões`,
    stage: 'prova_anterior',
    orderIndex: maxOrd + 1,
    originConcurso: `${journey.organization} · Caderno Personalizado`,
    year: journey.year,
    board: journey.board,
    roleEmphasis: journey.roleEmphasis,
    disciplineScope: 'Personalizado',
    documentId: null,
    answerKeyDocumentId: null,
    isOfficial: false,
    isDemo: false,
    questionCount: selected.length,
    status: 'nao_iniciada',
    createdAt: created,
  });

  selected.forEach((q, idx) => {
    store.questions.push({
      ...q,
      id: uid('q'),
      examId,
      questionNumber: idx + 1,
      createdAt: created,
    });
  });

  await saveRelationalStore(store);
  return { examId, count: selected.length };
}

const WEEK_DAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export async function generatePlanInStore(
  journeyId: string,
  dailyMinutesOverride?: number
): Promise<StudyPlan> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const dailyMinutes = dailyMinutesOverride ?? journey.dailyMinutes ?? 90;
  const perf = computePerformanceOverviewFromStore(store, journeyId);

  const priorityRank: Record<PriorityLevel, number> = {
    prioridade_maxima: 0,
    prioridade_alta: 1,
    revisao: 2,
    nao_avaliado: 3,
    dominio: 4,
  };

  const candidates = perf.bySubtopic
    .filter((s) => s.priority !== 'dominio')
    .sort((a, b) => {
      const diff = priorityRank[a.priority] - priorityRank[b.priority];
      if (diff !== 0) return diff;
      return a.accuracyPercent - b.accuracyPercent;
    });

  const planId = uid('plan');
  const createdAt = nowIso();
  const weekLabel = `Ciclo Reverso · ${new Date().toLocaleDateString('pt-BR')}`;
  const items: StudyPlanItem[] = [];

  if (perf.totalAttempts === 0) {
    items.push({
      id: uid('pli'),
      planId,
      dayOfWeek: 'Segunda-feira',
      subtopicId: null,
      disciplineName: 'Diagnóstico Inicial',
      title: 'Realizar Avaliação Diagnóstica Inicial',
      description:
        'No Método Reverso, comece pela avaliação diagnóstica registrando confiança e dificuldade para mapear suas lacunas reais.',
      activityType: 'reavaliacao',
      priority: 'prioridade_maxima',
      estimatedMinutes: Math.min(dailyMinutes, 60),
      completed: false,
      completedAt: null,
    });
  } else {
    const gapPool = candidates.length > 0 ? candidates : perf.bySubtopic.slice(0, 6);
    for (let i = 0; i < WEEK_DAYS.length; i++) {
      const day = WEEK_DAYS[i];
      if (i === WEEK_DAYS.length - 1) {
        items.push({
          id: uid('pli'),
          planId,
          dayOfWeek: day,
          subtopicId: null,
          disciplineName: 'Reavaliação da Jornada',
          title: 'Refazer prova ou bateria de erros e dúvidas',
          description:
            'Validar se o estudo da semana converteu lacunas de Prioridade Máxima/Alta em Domínio real sem chutes.',
          activityType: 'reavaliacao',
          priority: 'prioridade_alta',
          estimatedMinutes: dailyMinutes,
          completed: false,
          completedAt: null,
        });
        continue;
      }

      const topic = gapPool[i % gapPool.length];
      if (!topic) continue;

      const isReview = topic.priority === 'revisao';
      const isNotEvaluated = topic.priority === 'nao_avaliado';
      const studyMinutes = Math.round(dailyMinutes * 0.6);
      const practiceMinutes = Math.max(15, dailyMinutes - studyMinutes);

      items.push({
        id: uid('pli'),
        planId,
        dayOfWeek: day,
        subtopicId: topic.subtopicId,
        disciplineName: topic.disciplineName,
        title: isReview
          ? `Revisar: ${topic.subtopicTitle}`
          : isNotEvaluated
          ? `Avaliar lacuna: ${topic.subtopicTitle}`
          : `Estudar lacuna: ${topic.subtopicTitle}`,
        description: isReview
          ? `Acertos anteriores com dúvida (${topic.accuracyPercent}% de acerto). Reforçar pegadinhas CESGRANRIO.`
          : isNotEvaluated
          ? `Tópico do edital ainda não testado (${topic.availableQuestions} questão(ões) no banco).`
          : `Prioridade identificada (${topic.accuracyPercent}% acerto, ${topic.masteryPercent}% domínio). Estudar fundamentos e resolver questões.`,
        activityType: isReview ? 'revisao_duvida' : 'estudo_lacuna',
        priority: topic.priority,
        estimatedMinutes: studyMinutes,
        completed: false,
        completedAt: null,
      });

      items.push({
        id: uid('pli'),
        planId,
        dayOfWeek: day,
        subtopicId: topic.subtopicId,
        disciplineName: topic.disciplineName,
        title: `Prática direcionada: ${topic.subtopicTitle}`,
        description:
          'Resolver questões relacionadas registrando grau de confiança e eliminando distratores com a tesoura.',
        activityType: 'resolucao_questoes',
        priority: topic.priority,
        estimatedMinutes: practiceMinutes,
        completed: false,
        completedAt: null,
      });
    }
  }

  store.studyPlans.push({
    id: planId,
    journeyId,
    weekLabel,
    generatedBy: 'motor_deterministico',
    dailyMinutes,
    createdAt,
  });
  store.studyPlanItems.push(...items);
  await saveRelationalStore(store);

  return {
    id: planId,
    journeyId,
    weekLabel,
    generatedBy: 'motor_deterministico',
    dailyMinutes,
    createdAt,
    items,
  };
}

export async function togglePlanItemInStore(
  itemId: string,
  completed: boolean
): Promise<void> {
  const store = await loadRelationalStore();
  const item = store.studyPlanItems.find((i) => i.id === itemId);
  if (!item) throw new Error('Atividade não encontrada.');
  item.completed = completed;
  item.completedAt = completed ? nowIso() : null;
  await saveRelationalStore(store);
}

export async function generateMaterialInStore(
  journeyId: string,
  payload: { subtopicId?: string; materialType: StudyMaterial['materialType'] }
): Promise<StudyMaterial[]> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const subtopics = store.subtopics.filter((s) => s.journeyId === journeyId);
  const disciplines = store.disciplines.filter((d) => d.journeyId === journeyId);
  const perf = computePerformanceOverviewFromStore(store, journeyId);

  const sub = subtopics.find((s) => s.id === payload.subtopicId) ?? subtopics[0];
  const disc = disciplines.find((d) => d.id === sub?.disciplineId) ?? disciplines[0];
  const subPerf = perf.bySubtopic.find((s) => s.subtopicId === sub?.id);
  const relatedQs = store.questions.filter(
    (q) => q.journeyId === journeyId && q.subtopicId === sub?.id
  );

  const contentMarkdown = [
    `# ${sub?.title ?? journey.roleEmphasis}`,
    `**Disciplina:** ${disc?.name ?? 'Geral'} · **Banca:** ${journey.board} · **Status no seu diagnóstico:** ${subPerf?.priority ?? 'nao_avaliado'}`,
    ``,
    `> Material estruturado com base nas lacunas reais e acervo da jornada.`,
    ``,
    `## 1. Pontos de Atenção no Diagnóstico`,
    subPerf && subPerf.answeredQuestions > 0
      ? `- Questões avaliadas: ${subPerf.answeredQuestions} · Acertos: ${subPerf.correctCount} (${subPerf.accuracyPercent}%) · Domínio: ${subPerf.masteryPercent}%`
      : `- Tópico ainda não avaliado em prova. Resolva as questões vinculadas antes de consumir teoria extensa.`,
    ``,
    `## 2. Questões e Explicações Disponíveis no Seu Acervo (${relatedQs.length})`,
    ...(relatedQs.length > 0
      ? relatedQs.slice(0, 8).map(
          (q) =>
            `### Questão ${q.questionNumber}\n${q.stem}\n- **Gabarito:** ${q.officialAnswer ?? 'Pendente'}\n- **Comentário:** ${q.explanation || 'Importe ou registre comentário.'}`
        )
      : ['Nenhuma questão vinculada a este subtópico ainda. Importe provas anteriores na Central de Documentos.']),
  ].join('\n\n');

  store.studyMaterials.push({
    id: uid('mat'),
    journeyId,
    subtopicId: sub?.id ?? null,
    materialType: payload.materialType,
    title: `${sub?.title ?? journey.roleEmphasis} — ${payload.materialType.replace('_', ' ').toUpperCase()}`,
    contentMarkdown,
    structuredData: null,
    sourceBasis: 'Histórico de desempenho e acervo da jornada',
    isAiGenerated: false,
    createdAt: nowIso(),
  });

  await saveRelationalStore(store);
  return store.studyMaterials
    .filter((m) => m.journeyId === journeyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function askTutorInStore(
  journeyId: string,
  questionText: string
): Promise<TutorMessage[]> {
  const store = await loadRelationalStore();
  const journey = store.journeys.find((j) => j.id === journeyId);
  if (!journey) throw new Error('Jornada não encontrada.');

  const perf = computePerformanceOverviewFromStore(store, journeyId);

  const attemptIds = new Set(
    store.attempts
      .filter((a) => a.journeyId === journeyId && a.status === 'finalizada')
      .map((a) => a.id)
  );
  const qMap = new Map(store.questions.map((q) => [q.id, q]));
  const subMap = new Map(store.subtopics.map((s) => [s.id, s]));

  const luckyGuessQuestions = store.attemptAnswers
    .filter(
      (aa) =>
        attemptIds.has(aa.attemptId) && aa.confidence === 'chute' && aa.isCorrect === true
    )
    .map((aa) => {
      const q = qMap.get(aa.questionId);
      const sub = q?.subtopicId ? subMap.get(q.subtopicId) : null;
      return {
        number: q?.questionNumber ?? 0,
        stem: q?.stem ?? '',
        subtopic: sub?.title ?? 'Geral',
      };
    });

  const replyText = buildGroundedTutorReply({
    journey,
    performance: perf,
    questionText,
    luckyGuessQuestions,
  });

  const t1 = new Date().toISOString();
  const t2 = new Date(Date.now() + 5).toISOString();

  store.tutorMessages.push(
    { id: uid('msg'), journeyId, role: 'user', content: questionText.trim(), createdAt: t1 },
    { id: uid('msg'), journeyId, role: 'assistant', content: replyText, createdAt: t2 }
  );

  await saveRelationalStore(store);
  return store.tutorMessages
    .filter((m) => m.journeyId === journeyId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function buildGroundedTutorReply(params: {
  journey: Journey;
  performance: PerformanceOverview;
  questionText: string;
  luckyGuessQuestions: Array<{ number: number; stem: string; subtopic: string }>;
}): string {
  const { performance, questionText, luckyGuessQuestions } = params;
  const qLower = questionText.toLowerCase();

  if (performance.totalAttempts === 0) {
    return [
      `Ainda não há tentativas registradas na jornada **${params.journey.title}**.`,
      ``,
      `Pelo **Método Reverso**, o primeiro passo é executar o **Diagnóstico Inicial** registrando seu grau de confiança e dificuldade percebida em cada questão.`,
      ``,
      `Assim que finalizar sua primeira prova, analisarei seus acertos, erros, chutes e lacunas reais.`,
    ].join('\n');
  }

  const maxTopics = performance.bySubtopic.filter((s) => s.priority === 'prioridade_maxima');
  const highTopics = performance.bySubtopic.filter((s) => s.priority === 'prioridade_alta');
  const revTopics = performance.bySubtopic.filter((s) => s.priority === 'revisao');
  const domTopics = performance.bySubtopic.filter((s) => s.priority === 'dominio');

  if (qLower.includes('chut')) {
    if (luckyGuessQuestions.length === 0) {
      return 'Nenhuma questão do seu histórico foi marcada como acerto por chute.';
    }
    return [
      `Encontrei **${luckyGuessQuestions.length} questão(ões)** acertada(s) por chute (que NÃO contam como domínio):`,
      ...luckyGuessQuestions.map(
        (q) => `- **Q${q.number}** (${q.subtopic}): ${q.stem.slice(0, 110)}...`
      ),
      ``,
      `Recomendação: estude esses subtópicos antes de avançar para a próxima etapa.`,
    ].join('\n');
  }

  if (qLower.includes('domino') || qLower.includes('forte')) {
    return [
      `**Tópicos já em Domínio (${domTopics.length}):**`,
      domTopics.length > 0
        ? domTopics
            .map((s) => `- ${s.disciplineName} · ${s.subtopicTitle} (${s.accuracyPercent}% acerto)`)
            .join('\n')
        : '- Nenhum tópico atingiu Domínio consolidado ainda.',
      ``,
      `Regra do Método Reverso: não gaste tempo revisando do zero o que já está em Domínio; concentre sua carga horária nas lacunas prioritárias.`,
    ].join('\n');
  }

  return [
    `**Diagnóstico objetivo com base no seu histórico real:**`,
    `- **Aproveitamento:** ${performance.accuracyAnswered}% (sobre ${performance.totalAnswerRecords} respondidas; ${performance.totalBlankRecords} em branco não contadas como erro).`,
    `- **Domínio Real:** ${performance.masteryIndex}% · **Aptidão atual:** ${performance.latestAptitude.status}.`,
    ``,
    `**1. O que estudar primeiro (Prioridade Máxima — ${maxTopics.length} tópico(s)):**`,
    maxTopics.length > 0
      ? maxTopics
          .map((s) => `- ${s.disciplineName} > ${s.subtopicTitle} (${s.accuracyPercent}% acerto)`)
          .join('\n')
      : '- Nenhuma lacuna em Prioridade Máxima.',
    ``,
    `**2. Prioridade Alta (${highTopics.length} tópico(s)) e Revisão (${revTopics.length} tópico(s)):**`,
    [...highTopics, ...revTopics]
      .slice(0, 5)
      .map((s) => `- ${s.subtopicTitle} (${s.priority})`)
      .join('\n') || '- Nenhum item pendente nesta faixa.',
    ``,
    `**Motivos da Aptidão:** ${performance.latestAptitude.reasons.join(' ')}`,
  ].join('\n');
}

export interface BackupRestoreResult {
  mode: 'merge' | 'replace';
  journeysCount: number;
  disciplinesCount: number;
  subtopicsCount: number;
  documentsCount: number;
  examsCount: number;
  questionsCount: number;
  attemptsCount: number;
  addedCount: number;
  preservedExistingCount: number;
}

export interface StoragePersistenceInfo {
  updatedAt: string;
  lastBackupAt: string | null;
  persistentStorage: 'granted' | 'standard' | 'unavailable';
  counts: {
    journeys: number;
    documents: number;
    exams: number;
    questions: number;
    attempts: number;
    subtopics: number;
    materials: number;
  };
}

export async function getStoragePersistenceInfo(): Promise<StoragePersistenceInfo> {
  const [store, persistentStorage] = await Promise.all([
    loadRelationalStore(),
    requestBrowserStoragePersistence(),
  ]);
  return {
    updatedAt: store.updatedAt,
    lastBackupAt: getLastBackupTimestamp(),
    persistentStorage,
    counts: {
      journeys: store.journeys.length,
      documents: store.documents.length,
      exams: store.exams.length,
      questions: store.questions.length,
      attempts: store.attempts.length,
      subtopics: store.subtopics.length,
      materials: store.studyMaterials.length,
    },
  };
}

export async function exportFullRelationalJson(): Promise<RelationalJsonStore> {
  await requestBrowserStoragePersistence();
  const store = await loadRelationalStore();
  recordLastBackupTimestamp();
  return store;
}

export async function importFullRelationalJson(
  rawJson: string,
  options?: { mode?: 'merge' | 'replace' }
): Promise<BackupRestoreResult> {
  const mode: 'merge' | 'replace' = options?.mode === 'replace' ? 'replace' : 'merge';
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Arquivo JSON inválido ou corrompido.');
  }
  const check = validateRelationalBackupPayload(parsed);
  if (!check.valid || !check.store) {
    throw new Error(check.error || 'Estrutura de backup JSON inválida.');
  }

  await requestBrowserStoragePersistence();

  if (mode === 'replace') {
    await saveRelationalStore(check.store);
    return {
      mode: 'replace',
      journeysCount: check.store.journeys.length,
      disciplinesCount: check.store.disciplines.length,
      subtopicsCount: check.store.subtopics.length,
      documentsCount: check.store.documents.length,
      examsCount: check.store.exams.length,
      questionsCount: check.store.questions.length,
      attemptsCount: check.store.attempts.length,
      addedCount:
        check.store.journeys.length +
        check.store.documents.length +
        check.store.exams.length +
        check.store.questions.length +
        check.store.attempts.length,
      preservedExistingCount: 0,
    };
  }

  const existing = await loadRelationalStore();
  const merged = mergeRelationalStores(existing, check.store);
  await saveRelationalStore(merged.store);

  return {
    mode: 'merge',
    journeysCount: merged.store.journeys.length,
    disciplinesCount: merged.store.disciplines.length,
    subtopicsCount: merged.store.subtopics.length,
    documentsCount: merged.store.documents.length,
    examsCount: merged.store.exams.length,
    questionsCount: merged.store.questions.length,
    attemptsCount: merged.store.attempts.length,
    addedCount: merged.addedCount,
    preservedExistingCount: merged.preservedExistingCount,
  };
}
