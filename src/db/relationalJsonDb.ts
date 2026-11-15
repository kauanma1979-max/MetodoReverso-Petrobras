import type {
  Attempt,
  Discipline,
  DocumentRecord,
  EvaluatedAnswer,
  Exam,
  Journey,
  Question,
  StudyMaterial,
  StudyPlan,
  StudyPlanItem,
  Subtopic,
  TutorMessage,
} from '../shared/types.ts';
import { createInitialRelationalStore } from './seedData.ts';

/**
 * Banco Relacional em JSON armazenado no IndexedDB.
 * Todas as 12 tabelas mantêm suas chaves estrangeiras (journeyId, disciplineId,
 * subtopicId, documentId, examId, questionId, attemptId, planId) preservadas
 * integralmente para exportação/importação portátil em um único arquivo .json.
 */
export interface RelationalJsonStore {
  schemaVersion: number;
  updatedAt: string;
  journeys: Journey[];
  disciplines: Discipline[];
  subtopics: Subtopic[];
  documents: DocumentRecord[];
  exams: Exam[];
  questions: Question[];
  attempts: Attempt[];
  attemptAnswers: EvaluatedAnswer[];
  studyPlans: Array<Omit<StudyPlan, 'items'>>;
  studyPlanItems: StudyPlanItem[];
  studyMaterials: StudyMaterial[];
  tutorMessages: TutorMessage[];
}

const IDB_NAME = 'metodo_reverso_json_db';
const IDB_VERSION = 1;
const STORE_NAME = 'relational_store';
const ROOT_KEY = 'root';

let memoryFallbackStore: RelationalJsonStore | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir IndexedDB'));
  });
}

export async function loadRelationalStore(): Promise<RelationalJsonStore> {
  if (!hasIndexedDB()) {
    if (!memoryFallbackStore) {
      memoryFallbackStore = createInitialRelationalStore();
    }
    return memoryFallbackStore;
  }

  const db = await openIdb();
  const existing = await new Promise<RelationalJsonStore | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(ROOT_KEY);
    req.onsuccess = () => resolve(req.result as RelationalJsonStore | undefined);
    req.onerror = () => reject(req.error || new Error('Erro ao ler banco JSON no IndexedDB'));
  });

  if (existing && Array.isArray(existing.journeys) && existing.journeys.length > 0) {
    return normalizeStoreShape(existing);
  }

  const initial = createInitialRelationalStore();
  await saveRelationalStore(initial);
  return initial;
}

export async function saveRelationalStore(storeData: RelationalJsonStore): Promise<void> {
  const updated: RelationalJsonStore = {
    ...storeData,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  if (!hasIndexedDB()) {
    memoryFallbackStore = updated;
    return;
  }

  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(updated, ROOT_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Erro ao gravar banco JSON no IndexedDB'));
  });
}

function normalizeStoreShape(raw: Partial<RelationalJsonStore>): RelationalJsonStore {
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    journeys: Array.isArray(raw.journeys) ? raw.journeys : [],
    disciplines: Array.isArray(raw.disciplines) ? raw.disciplines : [],
    subtopics: Array.isArray(raw.subtopics) ? raw.subtopics : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    exams: Array.isArray(raw.exams) ? raw.exams : [],
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    attempts: Array.isArray(raw.attempts) ? raw.attempts : [],
    attemptAnswers: Array.isArray(raw.attemptAnswers) ? raw.attemptAnswers : [],
    studyPlans: Array.isArray(raw.studyPlans) ? raw.studyPlans : [],
    studyPlanItems: Array.isArray(raw.studyPlanItems) ? raw.studyPlanItems : [],
    studyMaterials: Array.isArray(raw.studyMaterials) ? raw.studyMaterials : [],
    tutorMessages: Array.isArray(raw.tutorMessages) ? raw.tutorMessages : [],
  };
}

/**
 * Valida integridade referencial de um arquivo .json exportado (completo ou de uma jornada)
 * antes de restaurar no IndexedDB.
 */
export function validateRelationalBackupPayload(parsed: unknown): {
  valid: boolean;
  error?: string;
  store?: RelationalJsonStore;
} {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'O arquivo JSON não contém um objeto válido.' };
  }

  const obj = parsed as Record<string, any>;

  // Suporta tanto backup completo (RelationalJsonStore) quanto backup de jornada única ({ journey, disciplines, ... })
  let candidate: RelationalJsonStore;
  if (Array.isArray(obj.journeys)) {
    candidate = normalizeStoreShape(obj);
  } else if (obj.journey && typeof obj.journey === 'object') {
    const planItems: StudyPlanItem[] = Array.isArray(obj.latestPlan?.items)
      ? obj.latestPlan.items
      : Array.isArray(obj.studyPlanItems)
      ? obj.studyPlanItems
      : [];
    const studyPlans = obj.latestPlan
      ? [
          {
            id: obj.latestPlan.id,
            journeyId: obj.latestPlan.journeyId,
            weekLabel: obj.latestPlan.weekLabel,
            generatedBy: obj.latestPlan.generatedBy,
            dailyMinutes: obj.latestPlan.dailyMinutes,
            createdAt: obj.latestPlan.createdAt,
          },
        ]
      : Array.isArray(obj.studyPlans)
      ? obj.studyPlans
      : [];

    const attempts: Attempt[] = Array.isArray(obj.attempts) ? obj.attempts : [];
    const attemptAnswers: EvaluatedAnswer[] = Array.isArray(obj.attemptAnswers)
      ? obj.attemptAnswers
      : attempts.flatMap((a) => (Array.isArray(a.answers) ? a.answers : []));

    candidate = normalizeStoreShape({
      journeys: [obj.journey],
      disciplines: obj.disciplines ?? [],
      subtopics: obj.subtopics ?? [],
      documents: obj.documents ?? [],
      exams: obj.exams ?? [],
      questions: obj.questions ?? [],
      attempts: attempts.map(({ answers: _ignored, ...rest }) => rest),
      attemptAnswers,
      studyPlans,
      studyPlanItems: planItems,
      studyMaterials: obj.materials ?? obj.studyMaterials ?? [],
      tutorMessages: obj.tutorMessages ?? [],
    });
  } else {
    return {
      valid: false,
      error: 'Formato JSON incompatível: esperado banco relacional (journeys) ou backup de jornada.',
    };
  }

  if (candidate.journeys.length === 0) {
    return { valid: false, error: 'O backup JSON não possui nenhuma jornada cadastrada.' };
  }

  // Verifica integridade referencial das chaves estrangeiras principais
  const journeyIds = new Set(candidate.journeys.map((j) => j.id));
  const discIds = new Set(candidate.disciplines.map((d) => d.id));
  const examIds = new Set(candidate.exams.map((e) => e.id));
  const attemptIds = new Set(candidate.attempts.map((a) => a.id));
  const questionIds = new Set(candidate.questions.map((q) => q.id));

  for (const d of candidate.disciplines) {
    if (!journeyIds.has(d.journeyId)) {
      return {
        valid: false,
        error: `Integridade violada: disciplina "${d.name}" aponta para jornada inexistente (${d.journeyId}).`,
      };
    }
  }
  for (const s of candidate.subtopics) {
    if (!discIds.has(s.disciplineId)) {
      return {
        valid: false,
        error: `Integridade violada: subtópico "${s.title}" aponta para disciplina inexistente (${s.disciplineId}).`,
      };
    }
  }
  for (const att of candidate.attempts) {
    if (!journeyIds.has(att.journeyId) || !examIds.has(att.examId)) {
      return {
        valid: false,
        error: `Integridade violada: tentativa ${att.id} referencia prova ou jornada ausente.`,
      };
    }
  }
  for (const ans of candidate.attemptAnswers) {
    if (!attemptIds.has(ans.attemptId) || !questionIds.has(ans.questionId)) {
      return {
        valid: false,
        error: `Integridade violada: resposta ${ans.id} referencia tentativa ou questão ausente.`,
      };
    }
  }

  return { valid: true, store: candidate };
}

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}
