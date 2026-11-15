import {
  AptitudeStatus,
  Attempt,
  AttemptAnswerInput,
  ConfidenceLevel,
  EditalOfficialRules,
  EngineConfig,
  OptionLetter,
  PerceivedDifficulty,
  PriorityLevel,
  Question,
} from './types.ts';

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  primaryDenominator: 'respondidas',
  minAproveitamentoToAdvance: 70,
  minDominioToAdvance: 60,
  maxPrioridadeMaximaAllowed: 0,
  confirmationsForFullMastery: 2,
  treatLuckyGuessAsPriorityMax: true,
};

export const DEFAULT_EDITAL_RULES: EditalOfficialRules = {
  hasImportedEdital: false,
  sourceDocumentTitle: 'Nenhum edital importado ainda',
  minimumOverallPercent: null,
  minimumBasicPercent: null,
  minimumSpecificPercent: null,
  eliminationRuleSummary:
    'A definir após importação do Edital Oficial correspondente à ênfase/cargo.',
  classificationRuleSummary:
    'A definir após importação do Edital Oficial (pesos, notas mínimas e critérios de desempate não são universais).',
  tieBreakerSummary: 'Importe o edital para registrar os critérios oficiais de desempate.',
  notes: '',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  certeza_absoluta: '1 · Certeza absoluta',
  quase_certeza: '2 · Quase certeza',
  com_duvida: '3 · Com dúvida',
  muita_duvida: '4 · Muita dúvida',
  chute: '5 · Chute / Não sei nada',
};

export const DIFFICULTY_LABELS: Record<PerceivedDifficulty, string> = {
  muito_facil: 'Muito fácil',
  facil: 'Fácil',
  media: 'Média',
  dificil: 'Difícil',
  muito_dificil: 'Muito difícil',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  prioridade_maxima: 'Prioridade Máxima',
  prioridade_alta: 'Prioridade Alta',
  revisao: 'Revisão',
  dominio: 'Domínio',
  nao_avaliado: 'Não avaliado',
};

/**
 * Classifica uma resposta individual cruzando Resultado x Confiança x Dificuldade percebida.
 * Regra explícita e transparente do aplicativo (sem atribuir fórmula matemática fictícia ao vídeo original):
 * - Questão em branco: nunca contabilizada como erro.
 * - Acerto por chute: nunca considerado domínio; exige estudo.
 * - Erro com alta confiança (certeza absoluta / quase certeza): falha conceitual grave -> Prioridade Máxima.
 * - Acerto com certeza absoluta (ou quase certeza em fácil/média): Domínio.
 */
export function classifyQuestionPerformance(params: {
  isCorrect: boolean | null;
  confidence: ConfidenceLevel | null;
  difficulty: PerceivedDifficulty | null;
  config?: EngineConfig;
}): { priority: PriorityLevel; action: string } {
  const cfg = params.config ?? DEFAULT_ENGINE_CONFIG;
  const { isCorrect, confidence, difficulty } = params;

  // Em branco: separada e nunca tratada como erro
  if (isCorrect === null) {
    return {
      priority: 'nao_avaliado',
      action: 'Questão deixada em branco (não contabilizada como erro)',
    };
  }

  const conf: ConfidenceLevel = confidence ?? 'com_duvida';
  const diff: PerceivedDifficulty = difficulty ?? 'media';

  if (isCorrect) {
    if (conf === 'chute') {
      return {
        priority: cfg.treatLuckyGuessAsPriorityMax ? 'prioridade_maxima' : 'prioridade_alta',
        action: 'Estudar: acerto por chute não comprova domínio',
      };
    }
    if (conf === 'muita_duvida') {
      return {
        priority: 'prioridade_alta',
        action: 'Estudar base conceitual: acerto com muita dúvida',
      };
    }
    if (conf === 'com_duvida') {
      return {
        priority: 'revisao',
        action: 'Revisar assunto para consolidar segurança',
      };
    }
    if (conf === 'quase_certeza') {
      if (diff === 'dificil' || diff === 'muito_dificil') {
        return {
          priority: 'revisao',
          action: 'Revisão pontual em questão de alta dificuldade',
        };
      }
      return {
        priority: 'dominio',
        action: 'Sem ação imediata (domínio consistente)',
      };
    }
    // certeza_absoluta + acertou
    return {
      priority: 'dominio',
      action: 'Sem ação imediata (domínio confirmado)',
    };
  }

  // Errou a questão
  if (conf === 'certeza_absoluta' || conf === 'quase_certeza') {
    return {
      priority: 'prioridade_maxima',
      action: 'Investigar falha conceitual urgente (errou com confiança alta)',
    };
  }

  if (diff === 'muito_facil' || diff === 'facil') {
    return {
      priority: 'prioridade_maxima',
      action: 'Estudo imediato: erro em questão considerada fácil',
    };
  }

  if (conf === 'chute') {
    return {
      priority: 'prioridade_maxima',
      action: 'Estudo imediato: desconhecimento total do tópico',
    };
  }

  return {
    priority: 'prioridade_alta',
    action: 'Estudar prioritariamente e refazer exercícios do tópico',
  };
}

export interface EvaluatedAttemptSummary {
  totalQuestions: number;
  answeredCount: number;
  blankCount: number;
  correctCount: number;
  wrongCount: number;
  accuracyAnswered: number;
  accuracyTotal: number;
  masteryScore: number;
  priorityCounts: Record<PriorityLevel, number>;
  aptitudeStatus: AptitudeStatus;
  aptitudeReasons: string[];
  evaluatedRows: Array<{
    input: AttemptAnswerInput;
    isCorrect: boolean | null;
    priority: PriorityLevel;
    action: string;
  }>;
}

/**
 * Avalia uma tentativa completa de prova/simulado.
 * Separa integralmente questões em branco, calcula Aproveitamento (respondidas e total),
 * Domínio do Conteúdo (excluindo chutes) e Aptidão Metodológica para avançar.
 */
export function evaluateExamAttempt(params: {
  questions: Question[];
  answers: AttemptAnswerInput[];
  previousAttempts?: Attempt[];
  config?: EngineConfig;
}): EvaluatedAttemptSummary {
  const cfg = params.config ?? DEFAULT_ENGINE_CONFIG;
  const answerMap = new Map<string, AttemptAnswerInput>();
  for (const ans of params.answers) {
    answerMap.set(ans.questionId, ans);
  }

  const priorityCounts: Record<PriorityLevel, number> = {
    prioridade_maxima: 0,
    prioridade_alta: 0,
    revisao: 0,
    dominio: 0,
    nao_avaliado: 0,
  };

  let answeredCount = 0;
  let blankCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let domainCount = 0;

  const evaluatedRows: EvaluatedAttemptSummary['evaluatedRows'] = [];

  for (const q of params.questions) {
    const input = answerMap.get(q.id) ?? {
      questionId: q.id,
      selectedOption: null,
      eliminatedOptions: [],
      confidence: null,
      perceivedDifficulty: null,
    };

    if (!input.selectedOption) {
      blankCount++;
      priorityCounts.nao_avaliado++;
      evaluatedRows.push({
        input,
        isCorrect: null,
        priority: 'nao_avaliado',
        action: 'Questão em branco (não contabilizada como erro)',
      });
      continue;
    }

    answeredCount++;
    // Se gabarito oficial ainda não foi cadastrado, não força erro falso; marca como pendente?
    // Caso exista officialAnswer, corrige normalmente.
    let isCorrect: boolean | null = null;
    if (q.officialAnswer) {
      isCorrect = input.selectedOption === q.officialAnswer;
      if (isCorrect) correctCount++;
      else wrongCount++;
    } else {
      // Sem gabarito cadastrado ainda: não computar como erro
      isCorrect = null;
    }

    const { priority, action } = classifyQuestionPerformance({
      isCorrect,
      confidence: input.confidence,
      difficulty: input.perceivedDifficulty,
      config: cfg,
    });

    priorityCounts[priority]++;
    if (priority === 'dominio') {
      domainCount++;
    }

    evaluatedRows.push({
      input,
      isCorrect,
      priority,
      action,
    });
  }

  const totalQuestions = params.questions.length;
  const gradedCount = correctCount + wrongCount;
  const accuracyAnswered = gradedCount > 0 ? round1((correctCount / gradedCount) * 100) : 0;
  const accuracyTotal = totalQuestions > 0 ? round1((correctCount / totalQuestions) * 100) : 0;
  const masteryScore = gradedCount > 0 ? round1((domainCount / gradedCount) * 100) : 0;

  const primaryAccuracy =
    cfg.primaryDenominator === 'total' ? accuracyTotal : accuracyAnswered;

  const aptitude = computeAptitudeStatus({
    primaryAccuracy,
    masteryScore,
    priorityMaximaCount: priorityCounts.prioridade_maxima,
    priorityAltaCount: priorityCounts.prioridade_alta,
    gradedCount,
    previousAttempts: params.previousAttempts ?? [],
    config: cfg,
  });

  return {
    totalQuestions,
    answeredCount,
    blankCount,
    correctCount,
    wrongCount,
    accuracyAnswered,
    accuracyTotal,
    masteryScore,
    priorityCounts,
    aptitudeStatus: aptitude.status,
    aptitudeReasons: aptitude.reasons,
    evaluatedRows,
  };
}

export function computeAptitudeStatus(params: {
  primaryAccuracy: number;
  masteryScore: number;
  priorityMaximaCount: number;
  priorityAltaCount: number;
  gradedCount: number;
  previousAttempts: Attempt[];
  config: EngineConfig;
}): { status: AptitudeStatus; reasons: string[] } {
  const {
    primaryAccuracy,
    masteryScore,
    priorityMaximaCount,
    priorityAltaCount,
    gradedCount,
    previousAttempts,
    config,
  } = params;

  const reasons: string[] = [];

  if (gradedCount === 0) {
    return {
      status: 'NAO_APTO',
      reasons: ['Nenhuma questão com gabarito foi respondida nesta tentativa.'],
    };
  }

  const meetsAccuracy = primaryAccuracy >= config.minAproveitamentoToAdvance;
  const meetsMastery = masteryScore >= config.minDominioToAdvance;
  const meetsCriticalGaps = priorityMaximaCount <= config.maxPrioridadeMaximaAllowed;

  if (!meetsAccuracy) {
    reasons.push(
      `Aproveitamento (${primaryAccuracy.toFixed(1)}%) abaixo do mínimo configurado (${config.minAproveitamentoToAdvance}%).`
    );
  }
  if (!meetsMastery) {
    reasons.push(
      `Domínio real (${masteryScore.toFixed(1)}%) abaixo do mínimo (${config.minDominioToAdvance}%), desconsiderando chutes.`
    );
  }
  if (!meetsCriticalGaps) {
    reasons.push(
      `Existem ${priorityMaximaCount} questão(ões) em Prioridade Máxima (chutes ou erros graves) que não podem ser mascaradas pela nota.`
    );
  }

  if (meetsAccuracy && meetsMastery && meetsCriticalGaps) {
    reasons.push(
      `Critérios atingidos: aproveitamento de ${primaryAccuracy.toFixed(1)}%, domínio de ${masteryScore.toFixed(1)}% e lacunas críticas controladas.`
    );
    if (priorityAltaCount > 0) {
      reasons.push(
        `Observação: mantenha revisão de ${priorityAltaCount} item(ns) em Prioridade Alta enquanto avança.`
      );
    }
    return { status: 'APTO', reasons };
  }

  // Verifica evolução em relação às tentativas anteriores
  const finalizedPrev = previousAttempts.filter((a) => a.status === 'finalizada');
  if (finalizedPrev.length > 0) {
    const lastPrev = finalizedPrev[finalizedPrev.length - 1];
    const improvedMastery = masteryScore > lastPrev.masteryScore;
    const improvedAccuracy = primaryAccuracy > lastPrev.accuracyAnswered;
    if (improvedMastery || improvedAccuracy || meetsAccuracy) {
      reasons.push(
        `Evolução detectada em relação à tentativa anterior (Domínio: ${lastPrev.masteryScore.toFixed(1)}% -> ${masteryScore.toFixed(1)}%).`
      );
      return { status: 'EM_EVOLUCAO', reasons };
    }
  } else if (meetsAccuracy && (!meetsMastery || !meetsCriticalGaps)) {
    reasons.push(
      'Nota suficiente, porém há lacunas de confiança/chutes que exigem consolidação antes de avançar.'
    );
    return { status: 'EM_EVOLUCAO', reasons };
  }

  return { status: 'NAO_APTO', reasons };
}

export function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Parser determinístico de questões e gabaritos a partir de texto bruto (funciona sem IA).
 * Nunca altera o enunciado original e sinaliza itens incompletos para revisão manual.
 */
export function parseQuestionsFromRawText(rawText: string): Array<{
  questionNumber: number;
  stem: string;
  options: Record<OptionLetter, string>;
  needsManualReview: boolean;
  reviewNote: string;
}> {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Divide por marcadores comuns de questão: "Questão 01", "QUESTÃO 1", "01 -", "1.", "1)"
  const blockRegex =
    /(?:^|\n)(?:QUEST[ÃA]O\s+(\d{1,3})|(\d{1,3})\s*[-.)]\s+)/gim;
  const matches: Array<{ index: number; qNum: number; fullMatchLen: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(normalized)) !== null) {
    const num = Number(m[1] || m[2]);
    if (!Number.isNaN(num) && num > 0 && num <= 200) {
      matches.push({
        index: m.index,
        qNum: num,
        fullMatchLen: m[0].length,
      });
    }
  }

  if (matches.length === 0) {
    return [];
  }

  const parsed: Array<{
    questionNumber: number;
    stem: string;
    options: Record<OptionLetter, string>;
    needsManualReview: boolean;
    reviewNote: string;
  }> = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].fullMatchLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    const chunk = normalized.slice(start, end).trim();
    if (!chunk) continue;

    // Extrai alternativas (A), A), (A), A., A -
    const optRegex = /(?:^|\n)\s*\(?([A-E])\)?[).\-:]\s+([\s\S]*?)(?=(?:\n\s*\(?[A-E]\)?[).\-:]\s+)|$)/g;
    const options: Record<OptionLetter, string> = {
      A: '',
      B: '',
      C: '',
      D: '',
      E: '',
    };
    let firstOptionIdx = chunk.length;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optRegex.exec(chunk)) !== null) {
      const letter = optMatch[1].toUpperCase() as OptionLetter;
      if (optMatch.index < firstOptionIdx) {
        firstOptionIdx = optMatch.index;
      }
      options[letter] = optMatch[2].replace(/\s+/g, ' ').trim();
    }

    const stem = chunk.slice(0, firstOptionIdx).trim();
    const missingOpts = (['A', 'B', 'C', 'D', 'E'] as OptionLetter[]).filter(
      (l) => !options[l]
    );
    const needsManualReview = !stem || missingOpts.length > 0;
    const reviewNote = needsManualReview
      ? `Conferência manual necessária: ${!stem ? 'enunciado vazio; ' : ''}${
          missingOpts.length > 0 ? `alternativa(s) ausente(s): ${missingOpts.join(', ')}` : ''
        }`
      : '';

    parsed.push({
      questionNumber: matches[i].qNum,
      stem: stem || chunk,
      options,
      needsManualReview,
      reviewNote,
    });
  }

  return parsed;
}

/**
 * Parser determinístico de gabarito oficial em texto (ex: "1-A 2-C", "01: B", "1 A", etc.)
 */
export function parseAnswerKeyFromRawText(rawText: string): Record<number, OptionLetter> {
  const result: Record<number, OptionLetter> = {};
  const regex = /\b(\d{1,3})\s*[-.:)\s]+\s*([A-E])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(rawText)) !== null) {
    const qNum = Number(m[1]);
    const letter = m[2].toUpperCase() as OptionLetter;
    if (qNum > 0 && qNum <= 200) {
      result[qNum] = letter;
    }
  }
  return result;
}
