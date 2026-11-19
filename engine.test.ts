import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENGINE_CONFIG,
  classifyQuestionPerformance,
  evaluateExamAttempt,
  parseAnswerKeyFromRawText,
  parseQuestionsFromRawText,
} from '../src/shared/engine.ts';
import {
  createJourney,
  exportFullRelationalJson,
  getWorkspace,
  importDocumentToStore,
  importFullRelationalJson,
  listJourneys,
  submitExamAttempt,
} from '../src/db/storeActions.ts';
import { validateRelationalBackupPayload } from '../src/db/relationalJsonDb.ts';
import type { Attempt, Question } from '../src/shared/types.ts';

function makeQuestion(id: string, num: number, answer: 'A' | 'B' | 'C' | 'D' | 'E'): Question {
  return {
    id,
    journeyId: 'j1',
    examId: 'e1',
    disciplineId: 'd1',
    subtopicId: 's1',
    questionNumber: num,
    stem: `Questão ${num}`,
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D', E: 'Opt E' },
    officialAnswer: answer,
    preliminaryAnswer: null,
    answerDivergenceNote: '',
    explanation: '',
    distractorAnalysis: {},
    originType: 'oficial',
    sourceDocumentId: null,
    sourcePage: null,
    sourceReference: '',
    needsManualReview: false,
    isFavorite: false,
    markedForReview: false,
    classificationReviewed: true,
    year: 2023,
    board: 'CESGRANRIO',
    concurso: 'Petrobras',
    roleEmphasis: 'Operação',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

test('Questões em branco são separadas e nunca contabilizadas como erro', () => {
  const questions = [
    makeQuestion('q1', 1, 'A'),
    makeQuestion('q2', 2, 'B'),
    makeQuestion('q3', 3, 'C'),
    makeQuestion('q4', 4, 'D'),
  ];

  const result = evaluateExamAttempt({
    questions,
    answers: [
      {
        questionId: 'q1',
        selectedOption: 'A',
        eliminatedOptions: ['B'],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'facil',
      },
      {
        questionId: 'q2',
        selectedOption: 'B',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'media',
      },
    ],
  });

  assert.equal(result.totalQuestions, 4);
  assert.equal(result.answeredCount, 2);
  assert.equal(result.blankCount, 2);
  assert.equal(result.correctCount, 2);
  assert.equal(result.wrongCount, 0);
  assert.equal(result.accuracyAnswered, 100);
  assert.equal(result.accuracyTotal, 50);
  assert.equal(result.evaluatedRows[2].isCorrect, null);
  assert.equal(result.evaluatedRows[2].priority, 'nao_avaliado');
});

test('Acerto por chute nunca é classificado como domínio', () => {
  const res = classifyQuestionPerformance({
    isCorrect: true,
    confidence: 'chute',
    difficulty: 'facil',
    config: DEFAULT_ENGINE_CONFIG,
  });
  assert.equal(res.priority, 'prioridade_maxima');
  assert.notEqual(res.priority, 'dominio');
});

test('Erro com certeza absoluta gera Prioridade Máxima por falha conceitual', () => {
  const res = classifyQuestionPerformance({
    isCorrect: false,
    confidence: 'certeza_absoluta',
    difficulty: 'media',
    config: DEFAULT_ENGINE_CONFIG,
  });
  assert.equal(res.priority, 'prioridade_maxima');
});

test('Nota alta com acerto por chute não permite status APTO (não mascara lacuna)', () => {
  const questions = [
    makeQuestion('q1', 1, 'A'),
    makeQuestion('q2', 2, 'B'),
    makeQuestion('q3', 3, 'C'),
    makeQuestion('q4', 4, 'D'),
  ];

  const result = evaluateExamAttempt({
    questions,
    answers: [
      {
        questionId: 'q1',
        selectedOption: 'A',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'facil',
      },
      {
        questionId: 'q2',
        selectedOption: 'B',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'facil',
      },
      {
        questionId: 'q3',
        selectedOption: 'C',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'facil',
      },
      {
        questionId: 'q4',
        selectedOption: 'D',
        eliminatedOptions: [],
        confidence: 'chute',
        perceivedDifficulty: 'dificil',
      },
    ],
  });

  assert.equal(result.accuracyAnswered, 100);
  assert.equal(result.masteryScore, 75);
  assert.equal(result.priorityCounts.prioridade_maxima, 1);
  assert.notEqual(result.aptitudeStatus, 'APTO');
});

test('Evolução entre tentativas altera aptidão para EM_EVOLUCAO e depois APTO ao consolidar domínio', () => {
  const questions = [makeQuestion('q1', 1, 'A'), makeQuestion('q2', 2, 'B')];

  const prevAttempt: Attempt = {
    id: 'att_0',
    journeyId: 'j1',
    examId: 'e1',
    attemptNumber: 1,
    startedAt: '2026-01-01T10:00:00Z',
    finishedAt: '2026-01-01T10:30:00Z',
    status: 'finalizada',
    totalQuestions: 2,
    answeredCount: 2,
    blankCount: 0,
    correctCount: 0,
    wrongCount: 2,
    accuracyAnswered: 0,
    accuracyTotal: 0,
    masteryScore: 0,
    aptitudeStatus: 'NAO_APTO',
    aptitudeReasons: [],
  };

  const res2 = evaluateExamAttempt({
    questions,
    answers: [
      {
        questionId: 'q1',
        selectedOption: 'A',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'media',
      },
      {
        questionId: 'q2',
        selectedOption: 'E',
        eliminatedOptions: [],
        confidence: 'com_duvida',
        perceivedDifficulty: 'dificil',
      },
    ],
    previousAttempts: [prevAttempt],
  });
  assert.equal(res2.aptitudeStatus, 'EM_EVOLUCAO');

  const res3 = evaluateExamAttempt({
    questions,
    answers: [
      {
        questionId: 'q1',
        selectedOption: 'A',
        eliminatedOptions: [],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'media',
      },
      {
        questionId: 'q2',
        selectedOption: 'B',
        eliminatedOptions: ['C'],
        confidence: 'certeza_absoluta',
        perceivedDifficulty: 'media',
      },
    ],
    previousAttempts: [prevAttempt],
  });
  assert.equal(res3.aptitudeStatus, 'APTO');
});

test('Parser determinístico extrai questões preservando enunciado e sinaliza alternativas ausentes', () => {
  const sample = `
QUESTÃO 01
Na mecânica dos fluidos, a equação da continuidade em regime permanente expressa:
(A) Conservação de energia térmica.
(B) Conservação de massa / vazão mássica constante.
(C) Aumento exponencial de viscosidade.
(D) Perda de carga nula em qualquer duto.
(E) Variação livre de densidade sem fluxo.

QUESTÃO 02
Enunciado com leitura parcial sem alternativa E:
A) Opção 1
B) Opção 2
C) Opção 3
D) Opção 4
`;

  const parsed = parseQuestionsFromRawText(sample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].questionNumber, 1);
  assert.equal(parsed[0].needsManualReview, false);
  assert.equal(parsed[0].options.B, 'Conservação de massa / vazão mássica constante.');
  assert.equal(parsed[1].needsManualReview, true);

  const gabarito = parseAnswerKeyFromRawText('01-B  02: D');
  assert.equal(gabarito[1], 'B');
  assert.equal(gabarito[2], 'D');
});

test('Persistência Relacional JSON mantém correlações, preserva tentativas imutáveis e valida backup', async () => {
  const wsInitial = await getWorkspace('jrn_petrobras_op');
  assert.equal(wsInitial.disciplines.length, 7);
  assert.equal(wsInitial.subtopics.length, 55);
  assert.equal(wsInitial.attempts.length, 0);

  // Registra 1ª tentativa (q_pb_1 certa com certeza, q_pb_2 em branco)
  await submitExamAttempt('jrn_petrobras_op', 'exm_pb_diag', [
    {
      questionId: 'q_pb_1',
      selectedOption: 'C',
      eliminatedOptions: ['A'],
      confidence: 'certeza_absoluta',
      perceivedDifficulty: 'media',
    },
  ]);

  // Registra 2ª tentativa sem apagar a 1ª
  await submitExamAttempt('jrn_petrobras_op', 'exm_pb_diag', [
    {
      questionId: 'q_pb_1',
      selectedOption: 'C',
      eliminatedOptions: [],
      confidence: 'certeza_absoluta',
      perceivedDifficulty: 'facil',
    },
    {
      questionId: 'q_pb_2',
      selectedOption: 'B',
      eliminatedOptions: [],
      confidence: 'certeza_absoluta',
      perceivedDifficulty: 'facil',
    },
  ]);

  const exported = await exportFullRelationalJson();
  assert.equal(exported.attempts.length, 2);
  assert.equal(exported.attempts[0].attemptNumber, 1);
  assert.equal(exported.attempts[1].attemptNumber, 2);

  // Roundtrip de importação JSON mantendo correlações
  const rawJson = JSON.stringify(exported);
  const restored = await importFullRelationalJson(rawJson);
  assert.equal(restored.attemptsCount, 2);
  assert.equal(restored.journeysCount, 1);

  // Rejeição de JSON com chave estrangeira quebrada
  const broken = {
    ...exported,
    subtopics: [
      {
        id: 'sub_broken',
        journeyId: 'jrn_petrobras_op',
        disciplineId: 'disc_inexistente',
        title: 'Quebrado',
        code: '[Comum]',
        lastReviewedAt: null,
      },
    ],
  };
  const validation = validateRelationalBackupPayload(broken);
  assert.equal(validation.valid, false);
});

test('Restauração JSON em modo padrão (merge) preserva todos os itens já anexados no app', async () => {
  // 1. Exporta um backup inicial (contém apenas jrn_petrobras_op e as 2 tentativas do teste anterior)
  const snapshotBeforeAttach = await exportFullRelationalJson();
  const initialBackupJson = JSON.stringify(snapshotBeforeAttach);

  // 2. Anexa novos itens no app APÓS o backup ter sido exportado:
  //    - Um documento de prova com questões
  //    - Uma nova jornada separada
  //    - Uma nova tentativa
  await importDocumentToStore('jrn_petrobras_op', {
    docType: 'prova_anterior',
    title: 'Prova Anexada Localmente 2026',
    filename: 'prova_local_2026.txt',
    mimeType: 'text/plain',
    needsManualReview: false,
    reviewNotes: '',
    rawText: `
QUESTÃO 01
Sobre vasos de pressão, assinale a correta:
(A) Operam apenas em vácuo absoluto.
(B) Exigem inspeção periódica conforme NR-13.
(C) Não possuem válvula de segurança.
(D) São dispensados de registro de prontuário.
(E) Nunca sofrem corrosão sob tensão.
`,
  });

  const extraJourney = await createJourney({
    title: 'Transpetro — Dutos e Terminais (Anexada)',
    organization: 'Transpetro',
    roleEmphasis: 'Dutos e Terminais',
    board: 'CESGRANRIO',
  });

  // Também cria uma jornada externa apenas no JSON de backup a ser restaurado
  const externalBackup = {
    ...snapshotBeforeAttach,
    journeys: [
      ...snapshotBeforeAttach.journeys,
      {
        ...snapshotBeforeAttach.journeys[0],
        id: 'jrn_backup_externa',
        title: 'Jornada Vinda do Backup Externo',
      },
    ],
    documents: [
      ...snapshotBeforeAttach.documents,
      {
        id: 'doc_backup_externo',
        journeyId: 'jrn_backup_externa',
        docType: 'edital' as const,
        title: 'Edital do Backup Externo',
        filename: 'edital_externo.pdf',
        mimeType: 'application/pdf',
        rawText: 'Conteúdo do edital externo',
        needsManualReview: false,
        reviewNotes: '',
        importedAt: new Date().toISOString(),
      },
    ],
  };

  // 3. Restaura no modo padrão ('merge'): deve manter a prova anexada localmente e extraJourney,
  //    além de incorporar jrn_backup_externa e doc_backup_externo!
  const mergeResult = await importFullRelationalJson(JSON.stringify(externalBackup));
  assert.equal(mergeResult.mode, 'merge');
  assert.equal(mergeResult.addedCount, 2);

  const journeysAfterMerge = await listJourneys();
  assert.equal(journeysAfterMerge.some((j) => j.id === extraJourney.id), true);
  assert.equal(journeysAfterMerge.some((j) => j.id === 'jrn_backup_externa'), true);

  const wsMainAfterMerge = await getWorkspace('jrn_petrobras_op');
  assert.equal(
    wsMainAfterMerge.documents.some((d) => d.title === 'Prova Anexada Localmente 2026'),
    true
  );

  // 4. Quando explicitamente solicitado mode: 'replace', substitui pelo backup inicial
  const replaceResult = await importFullRelationalJson(initialBackupJson, { mode: 'replace' });
  assert.equal(replaceResult.mode, 'replace');
  const journeysAfterReplace = await listJourneys();
  assert.equal(journeysAfterReplace.length, 1);
  assert.equal(journeysAfterReplace[0].id, 'jrn_petrobras_op');
});
