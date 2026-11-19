import { useState } from 'react';
import {
  CheckCircle2,
  FilePlus2,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import type { EditalOfficialRules, EngineConfig, ExamStage } from '../shared/types.ts';
import { AptitudeIndicator } from './PriorityTag.tsx';

interface JourneyViewProps {
  workspace: WorkspaceData;
  onStartExam: (examId: string) => void;
  onInspectAttempt: (attemptId: string) => void;
  onUpdateJourneySettings: (payload: {
    simuladosCount?: number;
    defaultCustomExamQuestions?: number;
    engineConfig?: EngineConfig;
    editalRules?: EditalOfficialRules;
  }) => Promise<void>;
  onCreateSimuladoInedito: (count: number) => Promise<void>;
  onNavigate: (tab: string) => void;
  aiConfigured: boolean;
}

export function JourneyView({
  workspace,
  onStartExam,
  onInspectAttempt,
  onUpdateJourneySettings,
  onCreateSimuladoInedito,
  onNavigate,
}: JourneyViewProps) {
  const { journey, exams, attempts, performance } = workspace;
  const [editingRules, setEditingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [simCountInput, setSimCountInput] = useState(journey.defaultCustomExamQuestions || 15);
  const [creatingSim, setCreatingSim] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [engineDraft, setEngineDraft] = useState<EngineConfig>(journey.engineConfig);
  const [editalDraft, setEditalDraft] = useState<EditalOfficialRules>(journey.editalRules);

  const stages: Array<{ key: ExamStage; title: string; subtitle: string }> = [
    {
      key: 'diagnostico',
      title: 'Etapa 1 · Diagnóstico Inicial',
      subtitle: 'Identifica pontos fortes, lacunas reais e nível de confiança inicial.',
    },
    {
      key: 'prova_anterior',
      title: 'Etapa 2 · Provas Anteriores (Sequência da Jornada)',
      subtitle: 'Provas oficiais importadas ou cadernos estruturados na sequência do concurso.',
    },
    {
      key: 'simulado_inedito',
      title: `Etapa 3 · Simulados Inéditos (Meta configurada: ${journey.simuladosCount} simulados)`,
      subtitle: 'Questões inéditas no estilo CESGRANRIO separadas das provas oficiais.',
    },
  ];

  const handleSaveRules = async () => {
    setErrorMsg('');
    setSavingRules(true);
    try {
      await onUpdateJourneySettings({
        engineConfig: engineDraft,
        editalRules: editalDraft,
      });
      setEditingRules(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao salvar configurações.');
    } finally {
      setSavingRules(false);
    }
  };

  const handleCreateSimulado = async () => {
    setErrorMsg('');
    setCreatingSim(true);
    try {
      await onCreateSimuladoInedito(simCountInput);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao gerar simulado inédito.');
    } finally {
      setCreatingSim(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Aptidão Atual */}
      <section className="app-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Minha Jornada · {journey.organization} · {journey.roleEmphasis} · Banca {journey.board}
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">{journey.title}</h1>
          <ul className="mt-2 text-[13px] text-[var(--text-secondary)] space-y-1">
            {performance.latestAptitude.reasons.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <AptitudeIndicator status={performance.latestAptitude.status} />
          <button
            type="button"
            aria-expanded={editingRules}
            onClick={() => setEditingRules((v) => !v)}
            className="btn-secondary"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" />
            <span>{editingRules ? 'Fechar Regras' : 'Critérios de Aptidão & Edital'}</span>
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="alert-box alert-danger" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Critérios Metodológicos vs Regras Oficiais do Edital */}
      {editingRules && (
        <section
          aria-label="Edição de critérios e regras do edital"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 view-enter"
        >
          <div className="app-surface p-5 sm:p-6 space-y-4">
            <div className="border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                1. Critérios Metodológicos (Aptidão no App)
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Regras configuráveis para liberar o avanço na metodologia. Não equivalem à aprovação oficial no edital.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Aproveitamento mínimo (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={engineDraft.minAproveitamentoToAdvance}
                  onChange={(e) =>
                    setEngineDraft({
                      ...engineDraft,
                      minAproveitamentoToAdvance: Number(e.target.value),
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Domínio real mínimo (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={engineDraft.minDominioToAdvance}
                  onChange={(e) =>
                    setEngineDraft({
                      ...engineDraft,
                      minDominioToAdvance: Number(e.target.value),
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Máx. questões em Prioridade Máxima
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={engineDraft.maxPrioridadeMaximaAllowed}
                  onChange={(e) =>
                    setEngineDraft({
                      ...engineDraft,
                      maxPrioridadeMaximaAllowed: Number(e.target.value),
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Denominador do Aproveitamento
                </span>
                <select
                  value={engineDraft.primaryDenominator}
                  onChange={(e) =>
                    setEngineDraft({
                      ...engineDraft,
                      primaryDenominator: e.target.value as 'respondidas' | 'total',
                    })
                  }
                  className="form-select"
                >
                  <option value="respondidas">Sobre questões respondidas</option>
                  <option value="total">Sobre o total de questões da prova</option>
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={engineDraft.treatLuckyGuessAsPriorityMax}
                onChange={(e) =>
                  setEngineDraft({
                    ...engineDraft,
                    treatLuckyGuessAsPriorityMax: e.target.checked,
                  })
                }
                className="mt-1 w-4 h-4 accent-[var(--color-primary)]"
              />
              <span>Tratar acertos por chute como Prioridade Máxima (nunca contar como domínio)</span>
            </label>
          </div>

          <div className="app-surface p-5 sm:p-6 space-y-4">
            <div className="border-b border-[var(--border-subtle)] pb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  2. Regras Oficiais do Edital Específico
                </h2>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Critérios de eliminação e classificação variam por edital. Nunca reproduzimos regras de um edital como universais.
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Mín. Geral (%)
                </span>
                <input
                  type="number"
                  placeholder="Ex: 50"
                  value={editalDraft.minimumOverallPercent ?? ''}
                  onChange={(e) =>
                    setEditalDraft({
                      ...editalDraft,
                      minimumOverallPercent: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Mín. Básicos (%)
                </span>
                <input
                  type="number"
                  placeholder="Do edital"
                  value={editalDraft.minimumBasicPercent ?? ''}
                  onChange={(e) =>
                    setEditalDraft({
                      ...editalDraft,
                      minimumBasicPercent: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Mín. Específicos (%)
                </span>
                <input
                  type="number"
                  placeholder="Do edital"
                  value={editalDraft.minimumSpecificPercent ?? ''}
                  onChange={(e) =>
                    setEditalDraft({
                      ...editalDraft,
                      minimumSpecificPercent: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="form-input font-mono"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Critério oficial de eliminação (texto do edital)
              </span>
              <textarea
                rows={2}
                value={editalDraft.eliminationRuleSummary}
                onChange={(e) =>
                  setEditalDraft({ ...editalDraft, eliminationRuleSummary: e.target.value })
                }
                className="form-textarea"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Critério oficial de classificação e desempate
              </span>
              <textarea
                rows={2}
                value={editalDraft.classificationRuleSummary}
                onChange={(e) =>
                  setEditalDraft({ ...editalDraft, classificationRuleSummary: e.target.value })
                }
                className="form-textarea"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={savingRules}
                onClick={handleSaveRules}
                className="btn-primary"
              >
                {savingRules ? 'Salvando...' : 'Salvar Regras da Jornada'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Resumo permanente das Regras Oficiais do Edital vs Metodologia */}
      <section className="app-surface p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px]">
        <div className="space-y-2">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Regras Oficiais do Edital Importado
          </h2>
          <div className="text-[var(--text-secondary)]">
            Fonte: <span className="font-semibold">{journey.editalRules.sourceDocumentTitle}</span>
          </div>
          <div className="text-[var(--text-secondary)]">
            Eliminação: {journey.editalRules.eliminationRuleSummary}
          </div>
          <div className="text-[var(--text-secondary)]">
            Classificação: {journey.editalRules.classificationRuleSummary}
          </div>
        </div>
        <div className="space-y-2 md:border-l md:border-[var(--border-subtle)] md:pl-6">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Critérios de Aptidão Metodológica (Avanço na Jornada)
          </h2>
          <div className="text-[var(--text-secondary)] font-mono tabular-nums">
            Aproveitamento mínimo: {journey.engineConfig.minAproveitamentoToAdvance}% · Domínio mínimo:{' '}
            {journey.engineConfig.minDominioToAdvance}% · Máx. Prioridade Máxima:{' '}
            {journey.engineConfig.maxPrioridadeMaximaAllowed}
          </div>
          <div className="text-[var(--text-muted)]">
            Nota alta não mascara lacunas críticas (erros com alta confiança ou acertos por chute).
          </div>
        </div>
      </section>

      {/* 3 Etapas da Jornada */}
      <div className="space-y-6">
        {stages.map((stage) => {
          const stageExams = exams.filter((e) => e.stage === stage.key);
          return (
            <section key={stage.key} className="app-surface p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">{stage.title}</h2>
                  <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{stage.subtitle}</p>
                </div>

                {stage.key === 'prova_anterior' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('documents')}
                    className="btn-secondary"
                  >
                    <FilePlus2 className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>Importar Prova Anterior</span>
                  </button>
                )}

                {stage.key === 'simulado_inedito' && (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                      <span>Questões:</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={simCountInput}
                        onChange={(e) => setSimCountInput(Number(e.target.value))}
                        className="form-input !w-20 font-mono text-center"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={creatingSim}
                      onClick={handleCreateSimulado}
                      className="btn-primary"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {creatingSim ? 'Gerando...' : 'Criar Simulado Personalizado'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {stageExams.length === 0 ? (
                <div className="py-4 text-[13px] text-[var(--text-muted)]">
                  {stage.key === 'prova_anterior'
                    ? 'Nenhuma prova anterior oficial importada nesta jornada ainda. Use a Central de Documentos para subir PDFs/DOCX/TXT de provas e gabaritos definitivos da CESGRANRIO.'
                    : 'Nenhum simulado inédito gerado ainda. Recomenda-se consolidar primeiro a base com provas e gabaritos oficiais.'}
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
                  {stageExams.map((exam) => {
                    const examAttempts = attempts
                      .filter((a) => a.examId === exam.id && a.status === 'finalizada')
                      .sort((a, b) => b.attemptNumber - a.attemptNumber);
                    const latestAtt = examAttempts[0] ?? null;

                    return (
                      <div
                        key={exam.id}
                        className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)]">
                            <span>{exam.originConcurso || journey.organization}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{exam.year ?? 'S/Ano'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{exam.board}</span>
                            <span aria-hidden="true">·</span>
                            <span>{exam.disciplineScope}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{exam.questionCount} questões</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                exam.isOfficial
                                  ? 'text-[var(--color-success)] font-semibold'
                                  : 'text-[var(--color-info)] font-semibold'
                              }
                            >
                              {exam.isOfficial
                                ? 'Prova Oficial'
                                : exam.isDemo
                                ? 'Demonstração'
                                : 'Questão Inédita'}
                            </span>
                          </div>
                          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                            {exam.title}
                          </div>
                          {latestAtt ? (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)] font-mono tabular-nums">
                              <span className="inline-flex items-center gap-1.5 text-[var(--color-success)] font-sans font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                {examAttempts.length} tentativa(s)
                              </span>
                              <span>Último aprov.: {latestAtt.accuracyAnswered.toFixed(1)}%</span>
                              <span>Domínio: {latestAtt.masteryScore.toFixed(1)}%</span>
                              <span>Aptidão: {latestAtt.aptitudeStatus}</span>
                            </div>
                          ) : (
                            <div className="text-[12px] text-[var(--text-muted)]">
                              Situação: Não iniciada
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          {latestAtt && (
                            <button
                              type="button"
                              onClick={() => onInspectAttempt(latestAtt.id)}
                              className="btn-secondary"
                            >
                              Ver Relatório #{latestAtt.attemptNumber}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onStartExam(exam.id)}
                            className="btn-primary"
                          >
                            {latestAtt ? (
                              <>
                                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                                <span>Refazer Prova</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" aria-hidden="true" />
                                <span>Iniciar Prova</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
