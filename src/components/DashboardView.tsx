import { ArrowRight, BookOpen, CheckCircle2, Compass, FileText, Target } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import { AptitudeIndicator, PriorityBadge } from './PriorityTag.tsx';

interface DashboardViewProps {
  workspace: WorkspaceData;
  onStartExam: (examId: string) => void;
  onNavigate: (tab: string) => void;
  onGeneratePlan: () => Promise<void>;
}

export function DashboardView({
  workspace,
  onStartExam,
  onNavigate,
  onGeneratePlan,
}: DashboardViewProps) {
  const { journey, exams, performance, latestPlan, documents } = workspace;

  const diagnosticExam = exams.find((e) => e.stage === 'diagnostico') ?? exams[0];
  const nextPendingExam =
    exams.find((e) => e.status !== 'concluida') ?? diagnosticExam ?? null;

  const urgentTopics = performance.bySubtopic
    .filter((s) => s.priority === 'prioridade_maxima' || s.priority === 'prioridade_alta')
    .slice(0, 5);

  const masteredTopics = performance.bySubtopic.filter((s) => s.priority === 'dominio');
  const reviewTopics = performance.bySubtopic.filter((s) => s.priority === 'revisao');

  const currentStageLabel =
    performance.totalAttempts === 0
      ? 'Etapa 1 · Diagnóstico Inicial'
      : exams.some((e) => e.stage === 'simulado_inedito' && e.status === 'concluida')
      ? 'Etapa 3 · Simulados Inéditos'
      : exams.some((e) => e.stage === 'prova_anterior' && e.status === 'concluida')
      ? 'Etapa 2 · Provas Anteriores'
      : 'Etapa 1 · Ciclo de Estudo Reverso';

  let nextActionTitle = 'Realizar Diagnóstico Inicial';
  let nextActionDesc =
    'Comece pela prova diagnóstica registrando seu grau de confiança e dificuldade percebida. O sistema mapeará suas lacunas reais antes de sugerir teoria.';
  let primaryActionLabel = 'Iniciar Diagnóstico';
  let primaryHandler = () => {
    if (nextPendingExam) onStartExam(nextPendingExam.id);
    else onNavigate('documents');
  };

  if (performance.totalAttempts > 0) {
    if (urgentTopics.length > 0 && performance.latestAptitude.status !== 'APTO') {
      nextActionTitle = `Estudar lacuna crítica: ${urgentTopics[0].subtopicTitle}`;
      nextActionDesc = `${urgentTopics.length} subtópico(s) precisam de estudo prioritário antes de avançar para a próxima prova da jornada.`;
      primaryActionLabel = 'Abrir Planejamento';
      primaryHandler = () => onNavigate('planner');
    } else if (nextPendingExam) {
      nextActionTitle = `Avançar para: ${nextPendingExam.title}`;
      nextActionDesc =
        'Seu nível de domínio atingiu os critérios configurados para prosseguir para a próxima avaliação.';
      primaryActionLabel = 'Iniciar Avaliação';
      primaryHandler = () => onStartExam(nextPendingExam.id);
    } else {
      nextActionTitle = 'Importar próxima prova ou gerar simulado inédito';
      nextActionDesc =
        'Todas as avaliações disponíveis nesta jornada já possuem tentativa registrada. Importe uma prova oficial ou crie um simulado inédito.';
      primaryActionLabel = 'Ir para Minha Jornada';
      primaryHandler = () => onNavigate('journey');
    }
  }

  const denominatorLabel =
    journey.engineConfig.primaryDenominator === 'total'
      ? `${performance.totalCorrect} acertos / ${performance.totalAnswerRecords + performance.totalBlankRecords} itens totais`
      : `${performance.totalCorrect} acertos / ${performance.totalAnswerRecords} respondidas`;

  const primaryAccValue =
    journey.engineConfig.primaryDenominator === 'total'
      ? performance.accuracyTotal
      : performance.accuracyAnswered;

  return (
    <div className="space-y-8">
      {/* Cabeçalho de contexto da jornada — âncora focal única */}
      <section
        aria-labelledby="dashboard-journey-heading"
        className="app-surface p-5 sm:p-7"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-[13px] font-medium text-[var(--text-muted)] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{journey.organization}</span>
              <span aria-hidden="true">·</span>
              <span>{journey.board}</span>
              <span aria-hidden="true">·</span>
              <span>{currentStageLabel}</span>
              {journey.isDemoStructure && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--color-info)] font-semibold">
                    Estrutura Demonstrativa Inicial
                  </span>
                </>
              )}
            </div>
            <h1
              id="dashboard-journey-heading"
              className="font-display font-bold text-[var(--text-primary)]"
              style={{ fontSize: 'var(--text-hero)' }}
            >
              {journey.title}
            </h1>
            <p className="text-[var(--text-sm)] text-[var(--text-secondary)] leading-relaxed">
              {nextActionDesc}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <AptitudeIndicator status={performance.latestAptitude.status} />
            <button
              type="button"
              onClick={primaryHandler}
              className="btn-primary"
            >
              <span>{primaryActionLabel}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Faixa de 4 KPIs em grade responsiva com divisórias sutis */}
      <section aria-label="Indicadores principais de desempenho">
        <div className="app-surface grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">
              Aproveitamento Real
            </div>
            <div
              className="mt-2 font-semibold font-mono tabular-nums text-[var(--text-primary)]"
              style={{ fontSize: 'var(--text-kpi)' }}
            >
              {performance.totalAttempts > 0 ? `${primaryAccValue.toFixed(1)}%` : '—'}
            </div>
            <div className="mt-1.5 text-[12px] text-[var(--text-muted)] font-mono tabular-nums">
              {performance.totalAttempts > 0
                ? `${denominatorLabel} (${performance.totalBlankRecords} em branco)`
                : 'Nenhuma tentativa registrada'}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">
              Domínio do Conteúdo
            </div>
            <div
              className="mt-2 font-semibold font-mono tabular-nums text-[var(--color-success)]"
              style={{ fontSize: 'var(--text-kpi)' }}
            >
              {performance.totalAttempts > 0 ? `${performance.masteryIndex.toFixed(1)}%` : '—'}
            </div>
            <div className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Exclui acertos por chute · {performance.countDominio} questão(ões) dominadas
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">
              Lacunas Prioritárias
            </div>
            <div className="mt-2 flex items-baseline gap-2.5 flex-wrap">
              <span
                className="font-semibold font-mono tabular-nums text-[var(--color-danger)]"
                style={{ fontSize: 'var(--text-kpi)' }}
              >
                {performance.countPrioridadeMaxima + performance.countPrioridadeAlta}
              </span>
              <span className="text-[12px] text-[var(--text-muted)] font-mono tabular-nums">
                ({performance.countPrioridadeMaxima} máxima · {performance.countRevisao} revisão)
              </span>
            </div>
            <div className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              Assuntos que exigem estudo antes de avançar
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">
              Acervo da Jornada
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="font-semibold font-mono tabular-nums text-[var(--text-primary)]"
                style={{ fontSize: 'var(--text-kpi)' }}
              >
                {performance.totalQuestionsInBank}
              </span>
              <span className="text-[13px] text-[var(--text-muted)]">questões</span>
            </div>
            <div className="mt-1.5 text-[12px] text-[var(--text-muted)] font-mono tabular-nums">
              {performance.originBreakdown.oficial.total} oficiais ·{' '}
              {performance.originBreakdown.inedita_ia.total} inéditas ·{' '}
              {performance.originBreakdown.demonstracao.total} demo
            </div>
          </div>
        </div>
      </section>

      {/* Grade Principal 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Esquerda: Mapa de Lacunas e Domínio */}
        <section
          aria-labelledby="gaps-map-heading"
          className="lg:col-span-7 app-surface p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 id="gaps-map-heading" className="font-semibold text-[var(--text-primary)]">
                Mapa Imediato de Lacunas e Domínio
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                O Método Reverso direciona você apenas para o que ainda não domina.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('performance')}
              className="btn-ghost self-start sm:self-center"
            >
              Ver Quadro Completo
            </button>
          </div>

          {performance.totalAttempts === 0 ? (
            <div className="space-y-5 py-2">
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                Você ainda não finalizou nenhuma avaliação nesta jornada. Nenhum indicador de desempenho foi simulado ou inventado.
              </p>
              <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
                <li className="pt-3 border-t-2 border-[var(--color-primary)] space-y-1">
                  <div className="font-semibold text-[var(--text-primary)]">
                    1. Importar Edital e Provas
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {documents.length} documento(s) importado(s) até o momento.
                  </div>
                </li>
                <li className="pt-3 border-t-2 border-[var(--border-control)] space-y-1">
                  <div className="font-semibold text-[var(--text-primary)]">
                    2. Fazer Diagnóstico
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Registre alternativa, confiança (1–5) e dificuldade percebida.
                  </div>
                </li>
                <li className="pt-3 border-t-2 border-[var(--border-control)] space-y-1">
                  <div className="font-semibold text-[var(--text-primary)]">
                    3. Estudar Só as Lacunas
                  </div>
                  <div className="text-[var(--text-muted)]">
                    O sistema separa domínio real de chutes e gera sua rotina.
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-3">
                  Prioridades para Estudo e Revisão
                </h3>
                {urgentTopics.length === 0 && reviewTopics.length === 0 ? (
                  <div className="alert-box alert-success">
                    Nenhuma lacuna crítica aberta nos tópicos avaliados até o momento.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
                    {[...urgentTopics, ...reviewTopics].slice(0, 6).map((t) => (
                      <div
                        key={t.subtopicId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 text-[var(--text-sm)]"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text-primary)] truncate">
                            {t.subtopicTitle}
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
                            {t.disciplineName} ·{' '}
                            <span className="font-mono tabular-nums">
                              {t.accuracyPercent.toFixed(0)}% acerto
                            </span>{' '}
                            ·{' '}
                            <span className="font-mono tabular-nums">
                              {t.masteryPercent.toFixed(0)}% domínio
                            </span>
                          </div>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1">
                <h3 className="text-[13px] font-semibold text-[var(--text-secondary)] mb-2">
                  Tópicos em Domínio ({masteredTopics.length}) — Dispensados de reestudo integral
                </h3>
                {masteredTopics.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-muted)]">
                    Nenhum subtópico atingiu domínio confirmado ainda.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-[13px] text-[var(--color-success)]">
                    {masteredTopics.slice(0, 4).map((m) => (
                      <li key={m.subtopicId} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {m.disciplineName} · {m.subtopicTitle} (
                          <span className="font-mono tabular-nums">
                            {m.accuracyPercent.toFixed(0)}%
                          </span>
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Direita: Próxima atividade + Acessos Diretos */}
        <section
          aria-labelledby="next-action-heading"
          className="lg:col-span-5 app-surface p-5 sm:p-6 space-y-6"
        >
          <div className="border-b border-[var(--border-subtle)] pb-4">
            <h2 id="next-action-heading" className="font-semibold text-[var(--text-primary)]">
              Próxima Atividade
            </h2>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
              Sequência recomendada: Prova → Lacunas → Estudo → Reavaliação.
            </p>
          </div>

          <div className="app-inset p-4 sm:p-5 space-y-3">
            <div className="text-[12px] font-semibold text-[var(--color-primary)]">
              Ação Imediata
            </div>
            <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
              {nextActionTitle}
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {nextActionDesc}
            </p>
            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={primaryHandler}
                className="btn-primary"
              >
                {primaryActionLabel}
              </button>
              {!latestPlan && (
                <button
                  type="button"
                  onClick={onGeneratePlan}
                  className="btn-secondary"
                >
                  Gerar Cronograma Semanal
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-[var(--text-secondary)]">
              Acessos Diretos da Jornada
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('documents')}
                className="flex items-center gap-3 p-3.5 text-left min-h-[56px] border border-[var(--border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
              >
                <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    Importar Edital/Prova
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate font-mono tabular-nums">
                    {documents.length} arquivo(s)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('syllabus')}
                className="flex items-center gap-3 p-3.5 text-left min-h-[56px] border border-[var(--border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
              >
                <BookOpen className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    Edital Verticalizado
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate font-mono tabular-nums">
                    {performance.bySubtopic.length} subtópicos
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('journey')}
                className="flex items-center gap-3 p-3.5 text-left min-h-[56px] border border-[var(--border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
              >
                <Compass className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    Etapas da Jornada
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate font-mono tabular-nums">
                    {exams.length} avaliação(ões)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('tutor')}
                className="flex items-center gap-3 p-3.5 text-left min-h-[56px] border border-[var(--border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
              >
                <Target className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    Tutor & Materiais
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate">
                    Estudo direcionado
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
