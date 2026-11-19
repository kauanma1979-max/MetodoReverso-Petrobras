import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Scissors,
  Send,
  XCircle,
} from 'lucide-react';
import {
  CONFIDENCE_LABELS,
  DIFFICULTY_LABELS,
} from '../shared/engine.ts';
import type {
  Attempt,
  AttemptAnswerInput,
  ConfidenceLevel,
  Exam,
  OptionLetter,
  PerceivedDifficulty,
  Question,
} from '../shared/types.ts';
import { AptitudeIndicator, PriorityBadge, originLabel } from './PriorityTag.tsx';
import type { ToastMessage } from './ui/FeedbackToast.tsx';

interface ExamRunnerViewProps {
  exam: Exam;
  questions: Question[];
  initialAttemptToInspect?: Attempt | null;
  onSubmitAttempt: (answers: AttemptAnswerInput[]) => Promise<Attempt>;
  onExit: () => void;
  onNotify?: (toast: Omit<ToastMessage, 'id'>) => void;
}

const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
const CONFIDENCE_KEYS: ConfidenceLevel[] = [
  'certeza_absoluta',
  'quase_certeza',
  'com_duvida',
  'muita_duvida',
  'chute',
];
const DIFFICULTY_KEYS: PerceivedDifficulty[] = [
  'muito_facil',
  'facil',
  'media',
  'dificil',
  'muito_dificil',
];

export function ExamRunnerView({
  exam,
  questions,
  initialAttemptToInspect = null,
  onSubmitAttempt,
  onExit,
  onNotify,
}: ExamRunnerViewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [finishedAttempt, setFinishedAttempt] = useState<Attempt | null>(
    initialAttemptToInspect
  );

  // Estado local das respostas durante o modo prova (nunca revela gabarito antes de finalizar)
  const [answersMap, setAnswersMap] = useState<Record<string, AttemptAnswerInput>>(() => {
    const init: Record<string, AttemptAnswerInput> = {};
    for (const q of questions) {
      init[q.id] = {
        questionId: q.id,
        selectedOption: null,
        eliminatedOptions: [],
        confidence: null,
        perceivedDifficulty: null,
      };
    }
    return init;
  });

  const currentQuestion = questions[currentIdx];

  const stats = useMemo(() => {
    let answered = 0;
    let missingMeta = 0;
    for (const q of questions) {
      const a = answersMap[q.id];
      if (a?.selectedOption) {
        answered++;
        if (!a.confidence || !a.perceivedDifficulty) {
          missingMeta++;
        }
      }
    }
    return {
      total: questions.length,
      answered,
      blank: questions.length - answered,
      missingMeta,
    };
  }, [answersMap, questions]);

  // Navegação por teclado (setas esquerda/direita) durante modo prova
  useEffect(() => {
    if (finishedAttempt || questions.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finishedAttempt, questions.length]);

  const updateCurrent = (patch: Partial<AttemptAnswerInput>) => {
    if (!currentQuestion) return;
    setAnswersMap((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        ...patch,
      },
    }));
  };

  // Eliminação visual com a tesoura: NÃO altera automaticamente a resposta selecionada
  const toggleEliminateOption = (letter: OptionLetter) => {
    if (!currentQuestion) return;
    const cur = answersMap[currentQuestion.id];
    const exists = cur.eliminatedOptions.includes(letter);
    const nextElim = exists
      ? cur.eliminatedOptions.filter((l) => l !== letter)
      : [...cur.eliminatedOptions, letter];
    updateCurrent({ eliminatedOptions: nextElim });
  };

  const handleFinish = async () => {
    setErrorMsg('');
    if (stats.missingMeta > 0) {
      setErrorMsg(
        `Falta registrar Grau de Confiança e Dificuldade Percebida em ${stats.missingMeta} questão(ões) respondida(s). Esses dados são obrigatórios no Método Reverso.`
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload = questions.map((q) => answersMap[q.id]);
      const result = await onSubmitAttempt(payload);
      setFinishedAttempt(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao finalizar tentativa.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===========================================================================
  // MODO RELATÓRIO PÓS-PROVA (com gabarito, explicações, distratores e análise)
  // ===========================================================================
  if (finishedAttempt) {
    const evalMap = new Map(
      (finishedAttempt.answers ?? []).map((a) => [a.questionId, a])
    );

    return (
      <div className="space-y-8">
        <section className="app-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">
              Relatório Pós-Prova · Tentativa #{finishedAttempt.attemptNumber} ·{' '}
              {new Date(finishedAttempt.finishedAt || finishedAttempt.startedAt).toLocaleString('pt-BR')}
            </div>
            <h1 className="font-bold text-[var(--text-primary)]">{exam.title}</h1>
            <ul className="text-[13px] text-[var(--text-secondary)] space-y-1 pt-1">
              {finishedAttempt.aptitudeReasons.map((r, idx) => (
                <li key={idx}>· {r}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <AptitudeIndicator status={finishedAttempt.aptitudeStatus} />
            <button
              type="button"
              onClick={onExit}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Voltar à Jornada</span>
            </button>
          </div>
        </section>

        {/* Painel quantitativo explícito separando respondidas vs em branco */}
        <section
          aria-label="Resumo quantitativo da tentativa"
          className="app-surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden"
        >
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Respondidas</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--text-primary)]">
              {finishedAttempt.answeredCount}/{finishedAttempt.totalQuestions}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Em Branco (Não Erro)</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--text-secondary)]">
              {finishedAttempt.blankCount}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Acertos</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-success)]">
              {finishedAttempt.correctCount}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Erros</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-danger)]">
              {finishedAttempt.wrongCount}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Aprov. (Respondidas)</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-primary)]">
              {finishedAttempt.accuracyAnswered.toFixed(1)}%
            </div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
              Sobre total: {finishedAttempt.accuracyTotal.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Domínio Real</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-success)]">
              {finishedAttempt.masteryScore.toFixed(1)}%
            </div>
          </div>
        </section>

        {/* Gabarito comentado questão a questão */}
        <div className="space-y-5">
          {questions.map((q) => {
            const ans = evalMap.get(q.id);
            const isBlank = !ans?.selectedOption;

            return (
              <article key={q.id} className="app-surface p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      Questão {String(q.questionNumber).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{originLabel(q.originType)}</span>
                    {q.sourceReference && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{q.sourceReference}</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {isBlank ? (
                      <span className="text-[12px] font-medium text-[var(--text-secondary)] px-2.5 py-1 border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] rounded-[var(--radius-sm)]">
                        Em branco (não contabilizada como erro)
                      </span>
                    ) : ans?.isCorrect === true ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-success)]">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>Acertou ({ans.selectedOption})</span>
                      </span>
                    ) : ans?.isCorrect === false ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-danger)]">
                        <XCircle className="w-4 h-4" aria-hidden="true" />
                        <span>
                          Errou (Marcou {ans.selectedOption} · Gabarito {q.officialAnswer})
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-[var(--text-muted)]">
                        Sem gabarito cadastrado
                      </span>
                    )}
                    {ans && <PriorityBadge priority={ans.computedPriority} />}
                  </div>
                </div>

                <p className="text-[15px] text-[var(--text-primary)] leading-relaxed whitespace-pre-line max-w-[72ch]">
                  {q.stem}
                </p>

                {ans && ans.selectedOption && (
                  <div className="app-inset px-4 py-3 text-[13px] text-[var(--text-secondary)] flex flex-wrap gap-x-6 gap-y-2">
                    <span>
                      Confiança:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {ans.confidence ? CONFIDENCE_LABELS[ans.confidence] : '—'}
                      </strong>
                    </span>
                    <span>
                      Dificuldade percebida:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {ans.perceivedDifficulty ? DIFFICULTY_LABELS[ans.perceivedDifficulty] : '—'}
                      </strong>
                    </span>
                    <span>
                      Diagnóstico:{' '}
                      <strong className="text-[var(--text-primary)]">{ans.computedAction}</strong>
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {OPTION_LETTERS.map((letter) => {
                    const isOfficial = q.officialAnswer === letter;
                    const isSelected = ans?.selectedOption === letter;
                    const wasEliminated = ans?.eliminatedOptions?.includes(letter);
                    const distractorNote = q.distractorAnalysis?.[letter];

                    return (
                      <div
                        key={letter}
                        className={`p-3.5 border rounded-[var(--radius-md)] text-[14px] space-y-1 ${
                          isOfficial
                            ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]'
                            : isSelected && !isOfficial
                            ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono font-semibold shrink-0">{letter})</span>
                          <span
                            className={`text-[var(--text-primary)] ${
                              wasEliminated ? 'line-through text-[var(--text-muted)]' : ''
                            }`}
                          >
                            {q.options[letter] || '(Alternativa não preenchida)'}
                          </span>
                          {isOfficial && (
                            <span className="ml-auto text-[12px] font-semibold text-[var(--color-success)] shrink-0">
                              Gabarito
                            </span>
                          )}
                        </div>
                        {distractorNote && (
                          <div className="text-[12px] text-[var(--text-secondary)] pl-6">
                            Análise do distrator: {distractorNote}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="app-inset p-4 text-[13px] text-[var(--text-secondary)] space-y-1.5 leading-relaxed">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Comentário e Fundamentação
                    </div>
                    <div>{q.explanation}</div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MODO PROVA ATIVO (sem revelar gabarito, tesoura por alternativa, confiança + dificuldade)
  // ===========================================================================
  if (!currentQuestion) {
    return (
      <div className="app-surface p-8 text-center space-y-4">
        <div className="text-base font-semibold text-[var(--text-primary)]">
          Esta avaliação ainda não possui questões cadastradas.
        </div>
        <button type="button" onClick={onExit} className="btn-primary">
          Voltar
        </button>
      </div>
    );
  }

  const curAns = answersMap[currentQuestion.id];
  const progressRatio = stats.total > 0 ? stats.answered / stats.total : 0;

  return (
    <div className="space-y-6">
      {/* Barra superior da prova + progresso */}
      <section className="app-surface p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center justify-center w-11 h-11 border border-[var(--border-control)] hover:bg-[var(--bg-surface-subtle)] rounded-[var(--radius-md)] text-[var(--text-secondary)] shrink-0"
              aria-label="Sair sem finalizar"
              title="Sair sem finalizar"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="text-[12px] text-[var(--text-muted)] truncate">
                Modo Prova · Gabarito oculto durante a resolução ·{' '}
                {originLabel(currentQuestion.originType)}
              </div>
              <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
                {exam.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 shrink-0">
            <div className="text-[13px] font-mono tabular-nums text-[var(--text-secondary)]">
              Respondidas: <strong className="text-[var(--text-primary)]">{stats.answered}</strong>/
              {stats.total} · Em branco: <strong>{stats.blank}</strong>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinish}
              className="btn-primary"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Corrigindo...' : 'Finalizar e Corrigir'}</span>
            </button>
          </div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div
            className="progress-fill"
            style={{ transform: `scaleX(${progressRatio})` }}
          />
        </div>
      </section>

      {errorMsg && (
        <div className="alert-box alert-danger" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Questão Principal */}
        <section className="lg:col-span-8 app-surface p-5 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-muted)]">
              <span className="font-mono font-semibold text-[15px] text-[var(--text-primary)]">
                Questão {String(currentQuestion.questionNumber).padStart(2, '0')} de{' '}
                {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentQuestion.board}</span>
              {currentQuestion.sourceReference && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-xs">{currentQuestion.sourceReference}</span>
                </>
              )}
            </div>

            {curAns.selectedOption && (
              <button
                type="button"
                onClick={() => {
                  const snapshot = { ...curAns };
                  updateCurrent({
                    selectedOption: null,
                    confidence: null,
                    perceivedDifficulty: null,
                  });
                  onNotify?.({
                    tone: 'info',
                    message: `Questão ${currentQuestion.questionNumber} deixada em branco.`,
                    onUndo: () => updateCurrent(snapshot),
                  });
                }}
                className="text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--color-danger)] underline py-1"
              >
                Deixar em branco
              </button>
            )}
          </div>

          <p className="text-[16px] text-[var(--text-primary)] leading-[1.68] whitespace-pre-line max-w-[70ch]">
            {currentQuestion.stem}
          </p>

          {/* 5 Alternativas com botão circular de tesoura independente */}
          <div className="space-y-3" role="radiogroup" aria-label="Alternativas da questão">
            {OPTION_LETTERS.map((letter) => {
              const isSelected = curAns.selectedOption === letter;
              const isEliminated = curAns.eliminatedOptions.includes(letter);

              return (
                <div
                  key={letter}
                  className={`flex items-stretch gap-2 border rounded-[var(--radius-md)] transition-colors ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => updateCurrent({ selectedOption: letter })}
                    className="flex-1 flex items-start gap-3.5 p-3.5 sm:p-4 text-left min-h-[48px]"
                  >
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-[13px] font-mono font-semibold shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-control)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {letter}
                    </span>
                    <span
                      className={`text-[15px] leading-relaxed ${
                        isEliminated
                          ? 'line-through text-[var(--text-muted)] opacity-70'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {currentQuestion.options[letter] || '(Alternativa vazia — conferir documento)'}
                    </span>
                  </button>

                  {/* Ícone circular de tesoura para riscar/desfazer eliminação sem alterar resposta */}
                  <div className="flex items-center pr-3">
                    <button
                      type="button"
                      aria-pressed={isEliminated}
                      onClick={() => toggleEliminateOption(letter)}
                      title={
                        isEliminated
                          ? `Restaurar alternativa ${letter}`
                          : `Eliminar alternativa ${letter} com tesoura`
                      }
                      aria-label={
                        isEliminated
                          ? `Restaurar alternativa ${letter}`
                          : `Eliminar alternativa ${letter}`
                      }
                      className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                        isEliminated
                          ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-control)]'
                      }`}
                    >
                      <Scissors className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Registro obrigatório de Confiança e Dificuldade Percebida */}
          <div className="pt-5 border-t border-[var(--border-subtle)] space-y-5">
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">
                B. Grau de Confiança nesta Questão{' '}
                {curAns.selectedOption && !curAns.confidence && (
                  <span className="text-[var(--color-danger)] font-medium">
                    (Obrigatório para corrigir)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {CONFIDENCE_KEYS.map((c) => {
                  const active = curAns.confidence === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateCurrent({ confidence: c })}
                      className={`px-3 py-2.5 min-h-[44px] text-[12px] font-semibold border rounded-[var(--radius-md)] text-center transition-colors ${
                        active
                          ? 'bg-[var(--color-secondary)] border-[var(--color-secondary)] text-white'
                          : 'bg-[var(--bg-surface)] border-[var(--border-control)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      {CONFIDENCE_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">
                C. Dificuldade Percebida{' '}
                {curAns.selectedOption && !curAns.perceivedDifficulty && (
                  <span className="text-[var(--color-danger)] font-medium">
                    (Obrigatório para corrigir)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {DIFFICULTY_KEYS.map((d) => {
                  const active = curAns.perceivedDifficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateCurrent({ perceivedDifficulty: d })}
                      className={`px-3 py-2.5 min-h-[44px] text-[12px] font-semibold border rounded-[var(--radius-md)] text-center transition-colors ${
                        active
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                          : 'bg-[var(--bg-surface)] border-[var(--border-control)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Navegação anterior / próxima */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Anterior</span>
            </button>
            <span className="hidden sm:inline text-[12px] text-[var(--text-muted)]">
              Atalho: use as setas ← e → do teclado
            </span>
            <button
              type="button"
              disabled={currentIdx === questions.length - 1}
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="btn-secondary"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Cartão de Navegação Lateral */}
        <aside
          aria-label="Cartão de questões"
          className="lg:col-span-4 app-surface p-5 space-y-4 lg:sticky lg:top-24"
        >
          <div className="border-b border-[var(--border-subtle)] pb-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Cartão de Questões
            </h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Questões deixadas em branco não serão contabilizadas como erro.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const a = answersMap[q.id];
              const isCur = idx === currentIdx;
              const isAnswered = Boolean(a?.selectedOption);
              const isComplete = isAnswered && Boolean(a?.confidence && a?.perceivedDifficulty);

              return (
                <button
                  key={q.id}
                  type="button"
                  aria-current={isCur ? 'step' : undefined}
                  aria-label={`Ir para questão ${q.questionNumber}`}
                  onClick={() => setCurrentIdx(idx)}
                  className={`min-h-[40px] rounded-[var(--radius-sm)] text-[13px] font-mono font-semibold border transition-colors ${
                    isCur
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                      : isComplete
                      ? 'bg-[var(--color-secondary)] border-[var(--color-secondary)] text-white'
                      : isAnswered
                      ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning)]'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-control)]'
                  }`}
                >
                  {String(q.questionNumber).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 text-[12px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-xs bg-[var(--color-secondary)] inline-block shrink-0" />
              <span>Respondida com confiança e dificuldade</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-xs bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] inline-block shrink-0" />
              <span>Respondida (falta confiança ou dificuldade)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] inline-block shrink-0" />
              <span>Em branco (não conta como erro)</span>
            </div>
          </div>

          {currentQuestion.needsManualReview && (
            <div className="alert-box alert-warning text-[12px]">
              <Flag className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Questão sinalizada para conferência manual do documento original.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
