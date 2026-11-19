import type {
  Attempt,
  AttemptAnswerInput,
  Discipline,
  DocumentRecord,
  DocumentType,
  Exam,
  Journey,
  PerformanceOverview,
  Question,
  StudyMaterial,
  StudyPlan,
  Subtopic,
  TutorMessage,
} from '../shared/types.ts';
import { extractTextFromBrowserFile } from '../parsers/clientDocumentParser.ts';
import {
  addDiscipline,
  addSubtopic,
  askTutorInStore,
  createCustomExamInStore,
  createJourney,
  deleteJourney,
  exportFullRelationalJson,
  generateMaterialInStore,
  generatePlanInStore,
  getStoragePersistenceInfo,
  getWorkspace,
  importDocumentToStore,
  importFullRelationalJson,
  listJourneys,
  submitExamAttempt,
  togglePlanItemInStore,
  updateJourney,
  updateQuestionRecord,
  type BackupRestoreResult,
  type StoragePersistenceInfo,
  type WorkspaceData,
} from '../db/storeActions.ts';

export type { BackupRestoreResult, StoragePersistenceInfo, WorkspaceData };

export interface HealthInfo {
  ok: boolean;
  storageMode: 'indexeddb_relational_json';
  ai: {
    configured: boolean;
    providerName: string;
    model: string;
  };
  timestamp: string;
}

export const api = {
  getHealth: async (): Promise<HealthInfo> => ({
    ok: true,
    storageMode: 'indexeddb_relational_json',
    ai: { configured: false, providerName: 'Local', model: 'deterministico' },
    timestamp: new Date().toISOString(),
  }),

  listJourneys: async (): Promise<{ journeys: Journey[] }> => ({
    journeys: await listJourneys(),
  }),

  createJourney: async (payload: {
    title: string;
    organization: string;
    roleEmphasis: string;
    board: string;
    year?: number | null;
    targetDate?: string | null;
    dailyMinutes?: number;
    simuladosCount?: number;
    defaultCustomExamQuestions?: number;
  }): Promise<{ journey: Journey }> => ({
    journey: await createJourney(payload),
  }),

  updateJourney: async (
    id: string,
    payload: Partial<Journey>
  ): Promise<{ journey: Journey }> => ({
    journey: await updateJourney(id, payload),
  }),

  deleteJourney: async (id: string): Promise<{ ok: boolean }> => {
    await deleteJourney(id);
    return { ok: true };
  },

  getWorkspace: async (journeyId: string): Promise<WorkspaceData> =>
    getWorkspace(journeyId),

  addDiscipline: async (
    journeyId: string,
    payload: { macroDiscipline: string; name: string; weight?: number; subtopics?: string[] }
  ): Promise<{ disciplines: Discipline[]; subtopics: Subtopic[] }> => {
    await addDiscipline(journeyId, payload);
    const ws = await getWorkspace(journeyId);
    return { disciplines: ws.disciplines, subtopics: ws.subtopics };
  },

  addSubtopic: async (
    journeyId: string,
    payload: { disciplineId: string; title: string; code?: string }
  ): Promise<{ subtopics: Subtopic[] }> => {
    await addSubtopic(journeyId, payload);
    const ws = await getWorkspace(journeyId);
    return { subtopics: ws.subtopics };
  },

  importDocument: async (
    journeyId: string,
    payload: {
      docType: DocumentType;
      title: string;
      file?: File | null;
      filename?: string;
      mimeType?: string;
      rawTextInput?: string;
      targetExamId?: string | null;
      examMeta?: {
        year?: number | null;
        board?: string;
        concurso?: string;
        roleEmphasis?: string;
      };
    }
  ) => {
    let rawText = String(payload.rawTextInput || '').trim();
    let needsManualReview = false;
    let reviewNotes = '';

    if (payload.file) {
      const extracted = await extractTextFromBrowserFile(payload.file);
      if (extracted.rawText) {
        rawText = rawText ? `${rawText}\n\n${extracted.rawText}` : extracted.rawText;
      }
      needsManualReview = extracted.needsManualReview;
      reviewNotes = extracted.reviewNotes;
    }

    if (!rawText && !payload.file) {
      throw new Error('Envie um arquivo ou cole o texto do documento.');
    }

    return importDocumentToStore(journeyId, {
      docType: payload.docType,
      title: payload.title,
      filename: payload.file?.name || payload.filename || 'texto_colado.txt',
      mimeType: payload.file?.type || payload.mimeType || 'text/plain',
      rawText,
      needsManualReview,
      reviewNotes,
      targetExamId: payload.targetExamId,
      examMeta: payload.examMeta,
    });
  },

  createCustomExam: async (
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
  ): Promise<{ examId: string; count: number }> =>
    createCustomExamInStore(journeyId, payload),

  updateQuestion: async (
    questionId: string,
    payload: Partial<Question>
  ): Promise<{ ok: boolean }> => {
    await updateQuestionRecord(questionId, payload);
    return { ok: true };
  },

  submitAttempt: async (
    journeyId: string,
    examId: string,
    answers: AttemptAnswerInput[]
  ): Promise<{ attempt: Attempt }> => ({
    attempt: await submitExamAttempt(journeyId, examId, answers),
  }),

  generatePlan: async (
    journeyId: string,
    dailyMinutes?: number
  ): Promise<{ plan: StudyPlan }> => ({
    plan: await generatePlanInStore(journeyId, dailyMinutes),
  }),

  togglePlanItem: async (itemId: string, completed: boolean): Promise<{ ok: boolean }> => {
    await togglePlanItemInStore(itemId, completed);
    return { ok: true };
  },

  generateMaterial: async (
    journeyId: string,
    payload: { subtopicId?: string; materialType: StudyMaterial['materialType'] }
  ): Promise<{ materials: StudyMaterial[] }> => ({
    materials: await generateMaterialInStore(journeyId, payload),
  }),

  askTutor: async (
    journeyId: string,
    message: string
  ): Promise<{ messages: TutorMessage[] }> => ({
    messages: await askTutorInStore(journeyId, message),
  }),

  getStoragePersistenceInfo: async (): Promise<StoragePersistenceInfo> =>
    getStoragePersistenceInfo(),

  exportBackup: async (): Promise<Record<string, unknown>> =>
    (await exportFullRelationalJson()) as unknown as Record<string, unknown>,

  importBackup: async (
    rawJson: string,
    options?: { mode?: 'merge' | 'replace' }
  ): Promise<BackupRestoreResult> => importFullRelationalJson(rawJson, options),
};
