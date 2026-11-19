export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type ConfidenceLevel =
  | 'certeza_absoluta'
  | 'quase_certeza'
  | 'com_duvida'
  | 'muita_duvida'
  | 'chute';

export type PerceivedDifficulty =
  | 'muito_facil'
  | 'facil'
  | 'media'
  | 'dificil'
  | 'muito_dificil';

export type PriorityLevel =
  | 'prioridade_maxima'
  | 'prioridade_alta'
  | 'revisao'
  | 'dominio'
  | 'nao_avaliado';

export type AptitudeStatus = 'APTO' | 'EM_EVOLUCAO' | 'NAO_APTO';

export type ExamStage = 'diagnostico' | 'prova_anterior' | 'simulado_inedito';

export type QuestionOrigin = 'oficial' | 'inedita_ia' | 'demonstracao' | 'autoral';

export type DocumentType =
  | 'edital'
  | 'conteudo_programatico'
  | 'prova_anterior'
  | 'gabarito_preliminar'
  | 'gabarito_definitivo'
  | 'retificacao'
  | 'apostila'
  | 'livro'
  | 'resumo'
  | 'anotacao';

export interface EngineConfig {
  // Primary denominator for Aproveitamento display: 'respondidas' or 'total'
  primaryDenominator: 'respondidas' | 'total';
  // Aptitude thresholds (Methodological readiness, distinct from official Edital rules)
  minAproveitamentoToAdvance: number; // default 70
  minDominioToAdvance: number; // default 60
  maxPrioridadeMaximaAllowed: number; // default 0 (prevents high score from hiding critical gaps)
  confirmationsForFullMastery: number; // default 2 confident correct attempts
  treatLuckyGuessAsPriorityMax: boolean; // default true
}

export interface EditalOfficialRules {
  hasImportedEdital: boolean;
  sourceDocumentTitle: string;
  minimumOverallPercent: number | null;
  minimumBasicPercent: number | null;
  minimumSpecificPercent: number | null;
  eliminationRuleSummary: string;
  classificationRuleSummary: string;
  tieBreakerSummary: string;
  notes: string;
}

export interface Journey {
  id: string;
  title: string;
  organization: string;
  roleEmphasis: string;
  board: string;
  year: number | null;
  targetDate: string | null;
  dailyMinutes: number;
  simuladosCount: number;
  defaultCustomExamQuestions: number;
  isDemoStructure: boolean;
  engineConfig: EngineConfig;
  editalRules: EditalOfficialRules;
  createdAt: string;
}

export interface Discipline {
  id: string;
  journeyId: string;
  macroDiscipline: string;
  name: string;
  weight: number;
  orderIndex: number;
}

export interface Subtopic {
  id: string;
  journeyId: string;
  disciplineId: string;
  title: string;
  code: string;
  lastReviewedAt: string | null;
}

export interface DocumentRecord {
  id: string;
  journeyId: string;
  docType: DocumentType;
  title: string;
  sourceFilename: string;
  mimeType: string;
  rawText: string;
  extractedMetadata: Record<string, unknown>;
  needsManualReview: boolean;
  reviewNotes: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  journeyId: string;
  title: string;
  stage: ExamStage;
  orderIndex: number;
  originConcurso: string;
  year: number | null;
  board: string;
  roleEmphasis: string;
  disciplineScope: string;
  documentId: string | null;
  answerKeyDocumentId: string | null;
  isOfficial: boolean;
  isDemo: boolean;
  questionCount: number;
  status: 'nao_iniciada' | 'em_andamento' | 'concluida';
  createdAt: string;
}

export interface Question {
  id: string;
  journeyId: string;
  examId: string | null;
  disciplineId: string | null;
  subtopicId: string | null;
  questionNumber: number;
  stem: string;
  options: Record<OptionLetter, string>;
  officialAnswer: OptionLetter | null;
  preliminaryAnswer: OptionLetter | null;
  answerDivergenceNote: string;
  explanation: string;
  distractorAnalysis: Partial<Record<OptionLetter, string>>;
  originType: QuestionOrigin;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  sourceReference: string;
  needsManualReview: boolean;
  isFavorite: boolean;
  markedForReview: boolean;
  classificationReviewed: boolean;
  year: number | null;
  board: string;
  concurso: string;
  roleEmphasis: string;
  createdAt: string;
}

export interface AttemptAnswerInput {
  questionId: string;
  selectedOption: OptionLetter | null;
  eliminatedOptions: OptionLetter[];
  confidence: ConfidenceLevel | null;
  perceivedDifficulty: PerceivedDifficulty | null;
}

export interface EvaluatedAnswer extends AttemptAnswerInput {
  id: string;
  attemptId: string;
  isCorrect: boolean | null; // null when blank
  computedPriority: PriorityLevel;
  computedAction: string;
  answeredAt: string;
}

export interface Attempt {
  id: string;
  journeyId: string;
  examId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'em_andamento' | 'finalizada';
  totalQuestions: number;
  answeredCount: number;
  blankCount: number;
  correctCount: number;
  wrongCount: number;
  accuracyAnswered: number; // % over answered questions
  accuracyTotal: number; // % over total questions
  masteryScore: number; // % considering confidence + accuracy (excludes lucky guesses)
  aptitudeStatus: AptitudeStatus;
  aptitudeReasons: string[];
  answers?: EvaluatedAnswer[];
}

export interface StudyPlanItem {
  id: string;
  planId: string;
  dayOfWeek: string;
  subtopicId: string | null;
  disciplineName: string;
  title: string;
  description: string;
  activityType: 'estudo_lacuna' | 'revisao_duvida' | 'resolucao_questoes' | 'reavaliacao';
  priority: PriorityLevel;
  estimatedMinutes: number;
  completed: boolean;
  completedAt: string | null;
}

export interface StudyPlan {
  id: string;
  journeyId: string;
  weekLabel: string;
  generatedBy: 'motor_deterministico' | 'tutor_ia';
  dailyMinutes: number;
  createdAt: string;
  items: StudyPlanItem[];
}

export interface StudyMaterial {
  id: string;
  journeyId: string;
  subtopicId: string | null;
  materialType:
    | 'aula'
    | 'resumo'
    | 'mapa_mental'
    | 'flashcards'
    | 'lista_exercicios'
    | 'revisao_rapida'
    | 'apostila';
  title: string;
  contentMarkdown: string;
  structuredData: Record<string, unknown> | null;
  sourceBasis: string;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface TutorMessage {
  id: string;
  journeyId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SubtopicPerformance {
  subtopicId: string;
  subtopicTitle: string;
  disciplineId: string;
  disciplineName: string;
  macroDiscipline: string;
  availableQuestions: number;
  attemptedQuestions: number;
  answeredQuestions: number;
  blankQuestions: number;
  correctCount: number;
  wrongCount: number;
  masteryConfirmedCount: number;
  accuracyPercent: number;
  masteryPercent: number;
  priority: PriorityLevel;
  lastReviewedAt: string | null;
  historyPoints: Array<{ attemptNumber: number; accuracyPercent: number; date: string }>;
}

export interface PerformanceOverview {
  totalExamsCompleted: number;
  totalAttempts: number;
  totalQuestionsInBank: number;
  questionsAnsweredDistinct: number;
  questionsNeverAnswered: number;
  totalAnswerRecords: number;
  totalBlankRecords: number;
  totalCorrect: number;
  totalWrong: number;
  accuracyAnswered: number;
  accuracyTotal: number;
  masteryIndex: number;
  countDominio: number;
  countRevisao: number;
  countPrioridadeAlta: number;
  countPrioridadeMaxima: number;
  originBreakdown: Record<
    QuestionOrigin,
    { total: number; answered: number; correct: number; wrong: number }
  >;
  byMacroDiscipline: Array<{
    name: string;
    answered: number;
    correct: number;
    accuracy: number;
    mastery: number;
  }>;
  byDiscipline: Array<{
    disciplineId: string;
    name: string;
    macroDiscipline: string;
    answered: number;
    correct: number;
    accuracy: number;
    mastery: number;
  }>;
  bySubtopic: SubtopicPerformance[];
  evolutionSeries: Array<{
    attemptId: string;
    examTitle: string;
    attemptNumber: number;
    date: string;
    accuracyAnswered: number;
    accuracyTotal: number;
    masteryScore: number;
    aptitudeStatus: AptitudeStatus;
  }>;
  latestAptitude: {
    status: AptitudeStatus;
    reasons: string[];
  };
}
