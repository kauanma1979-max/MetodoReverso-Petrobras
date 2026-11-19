import { useState } from 'react';
import { Info } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import { PriorityBadge, originLabel } from './PriorityTag.tsx';

interface PerformanceViewProps {
  workspace: WorkspaceData;
}

export function PerformanceView({ workspace }: PerformanceViewProps) {
  const { journey, performance, questions, attempts } = workspace;
  const [dimensionTab, setDimensionTab] = useState<
    'macro' | 'disciplina' | 'subtopico' | 'questao'
  >('subtopico');

  const evaluatedSubtopics = performance.bySubtopic.filter((s) => s.answeredQuestions > 0);
  const bestTopics = [...evaluatedSubtopics]
    .sort((a, b) => b.masteryPercent - a.masteryPercent || b.accuracyPercent - a.accuracyPercent)
    .slice(0, 5);
  const worstTopics = [...evaluatedSubtopics]
    .sort((a, b) => a.masteryPercent - b.masteryPercent || a.accuracyPercent - b.accuracyPercent)
    .slice(0, 5);

  const latestAnswerMap = new Map<string, any>();
  const orderedAttempts = [...attempts]
    .filter((a) => a.status === 'finalizada')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const att of orderedAttempts) {
    for (const ans of att.answers ?? []) {
      latestAnswerMap.set(ans.questionId, ans);
    }
  }

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 space-y-1.5">
        <div className="text-[13px] font-medium text-[var(--text-muted)]">
          Quadro Permanente de Performance · {journey.organization} · {journey.roleEmphasis}
        </div>
        <h1 className="font-bold text-[var(--text-primary)]">
          Análise de Aproveitamento, Domínio e Evolução
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] max-w-3xl">
          Indicadores calculados exclusivamente sobre tentativas reais registradas. Questões em branco nunca são contabilizadas como erros.
        </p>
      </section>

      {/* Faixa de Métricas Permanentes */}
      <section aria-label="Resumo numérico de desempenho">
        <div className="app-surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">
              Provas / Tentativas
            </div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--text-primary)]">
              {performance.totalExamsCompleted} / {performance.totalAttempts}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">
              Respondidas / Em Branco
            </div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--text-primary)]">
              {performance.totalAnswerRecords} / {performance.totalBlankRecords}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">
              Acertos / Erros
            </div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
              <span className="text-[var(--color-success)]">{performance.totalCorrect}</span>
              <span className="text-[var(--text-muted)]"> / </span>
              <span className="text-[var(--color-danger)]">{performance.totalWrong}</span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Aproveitamento</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-primary)]">
              {performance.totalAttempts > 0 ? `${performance.accuracyAnswered.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
              Sobre total: {performance.accuracyTotal.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 sm:p-5 col-span-2 sm:col-span-1">
            <div className="text-[12px] font-medium text-[var(--text-muted)]">Domínio Real</div>
            <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-[var(--color-success)]">
              {performance.totalAttempts > 0 ? `${performance.masteryIndex.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Exclui acertos por chute
            </div>
          </div>
        </div>
      </section>

      {/* Separação de Origens + Distribuição de Prioridades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 app-surface p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Separação por Origem e Cobertura do Acervo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                  <th className="py-2.5 pr-3 font-semibold">Origem das Questões</th>
                  <th className="py-2.5 px-2 font-semibold text-right">No Banco</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Respond.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Acertos</th>
                  <th className="py-2.5 pl-2 font-semibold text-right">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                {(['oficial', 'inedita_ia', 'demonstracao', 'autoral'] as const).map((orig) => {
                  const row = performance.originBreakdown[orig];
                  return (
                    <tr key={orig} className="hover:bg-[var(--bg-surface-hover)]">
                      <td className="py-3 pr-3 font-sans font-medium text-[var(--text-primary)]">
                        {originLabel(orig)}
                      </td>
                      <td className="py-3 px-2 text-right">{row.total}</td>
                      <td className="py-3 px-2 text-right">{row.answered}</td>
                      <td className="py-3 px-2 text-right text-[var(--color-success)] font-semibold">
                        {row.correct}
                      </td>
                      <td className="py-3 pl-2 text-right text-[var(--color-danger)] font-semibold">
                        {row.wrong}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[12px] text-[var(--text-muted)] font-mono tabular-nums pt-1">
            Questões distintas respondidas: {performance.questionsAnsweredDistinct} · Ainda não respondidas:{' '}
            {performance.questionsNeverAnswered}
          </div>
        </section>

        <section className="lg:col-span-6 app-surface p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Classificação das Questões Avaliadas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
            <div className="p-3.5 border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] rounded-[var(--radius-md)]">
              <div className="text-[var(--color-danger)] font-semibold text-[12px]">
                Prioridade Máxima
              </div>
              <div className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
                {performance.countPrioridadeMaxima}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Estudo imediato / chutes
              </div>
            </div>
            <div className="p-3.5 border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] rounded-[var(--radius-md)]">
              <div className="text-[var(--color-warning)] font-semibold text-[12px]">
                Prioridade Alta
              </div>
              <div className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
                {performance.countPrioridadeAlta}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Erros / muita dúvida
              </div>
            </div>
            <div className="p-3.5 border border-[var(--color-info-border)] bg-[var(--color-info-bg)] rounded-[var(--radius-md)]">
              <div className="text-[var(--color-info)] font-semibold text-[12px]">Revisão</div>
              <div className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
                {performance.countRevisao}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Acertos com dúvida
              </div>
            </div>
            <div className="p-3.5 border border-[var(--color-success-border)] bg-[var(--color-success-bg)] rounded-[var(--radius-md)]">
              <div className="text-[var(--color-success)] font-semibold text-[12px]">Domínio</div>
              <div className="text-2xl font-mono font-semibold text-[var(--text-primary)] mt-1 tabular-nums">
                {performance.countDominio}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Segurança confirmada
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-[12px] text-[var(--text-secondary)] pt-1 leading-relaxed">
            <Info className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Transparência metodológica: a metodologia cruza acerto, confiança e dificuldade sem impor fórmula numérica rígida. As faixas e limiares deste painel são configuráveis na aba Minha Jornada.
            </span>
          </div>
        </section>
      </div>

      {/* Gráfico SVG de Evolução + Ranking Pessoal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 app-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Evolução Temporal (Aproveitamento vs Domínio Real)
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Cada ponto representa uma tentativa finalizada sem sobrescrever tentativas anteriores.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium shrink-0">
              <span className="inline-flex items-center gap-1.5 text-[var(--color-primary)]">
                <span className="w-3 h-0.5 bg-[var(--color-primary)] inline-block" />
                <span>Aproveitamento</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                <span className="w-3 h-0.5 bg-[var(--color-success-solid)] inline-block" />
                <span>Domínio</span>
              </span>
            </div>
          </div>

          {performance.evolutionSeries.length === 0 ? (
            <div className="h-52 flex items-center justify-center border border-dashed border-[var(--border-control)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-muted)] px-4 text-center">
              Realize ao menos uma avaliação para visualizar a curva real de evolução.
            </div>
          ) : (
            <EvolutionSvgChart series={performance.evolutionSeries} />
          )}
        </section>

        <section className="lg:col-span-5 app-surface p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Ranking Pessoal de Desempenho por Assunto
          </h2>
          {evaluatedSubtopics.length === 0 ? (
            <div className="text-[13px] text-[var(--text-muted)] py-6">
              Nenhum subtópico avaliado ainda.
            </div>
          ) : (
            <div className="space-y-5 text-[13px]">
              <div>
                <h3 className="font-semibold text-[var(--color-danger)] mb-2">
                  Maiores Lacunas (Menor Domínio)
                </h3>
                <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
                  {worstTopics.map((t) => (
                    <div
                      key={t.subtopicId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="truncate text-[var(--text-primary)]">{t.subtopicTitle}</span>
                      <span className="font-mono tabular-nums text-[12px] text-[var(--color-danger)] font-semibold shrink-0">
                        {t.masteryPercent.toFixed(0)}% dom · {t.accuracyPercent.toFixed(0)}% acr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-success)] mb-2">
                  Melhores Desempenhos
                </h3>
                <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
                  {bestTopics.map((t) => (
                    <div
                      key={t.subtopicId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="truncate text-[var(--text-primary)]">{t.subtopicTitle}</span>
                      <span className="font-mono tabular-nums text-[12px] text-[var(--color-success)] font-semibold shrink-0">
                        {t.masteryPercent.toFixed(0)}% dom · {t.accuracyPercent.toFixed(0)}% acr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Tabela Multidimensional */}
      <section className="app-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Detalhamento por Dimensão
          </h2>
          <div className="segmented-group" role="group" aria-label="Dimensão da tabela">
            {(
              [
                ['macro', 'Macrodisciplina'],
                ['disciplina', 'Disciplina'],
                ['subtopico', 'Subtópico'],
                ['questao', 'Questão Específica'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={dimensionTab === k}
                onClick={() => setDimensionTab(k)}
                className="segmented-btn"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {dimensionTab === 'macro' && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                  <th className="py-2.5 pr-4 font-semibold">Macrodisciplina</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Respondidas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Acertos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aproveitamento</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Domínio Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {performance.byMacroDiscipline.map((m) => (
                  <tr key={m.name} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">{m.name}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{m.answered}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{m.correct}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {m.accuracy.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold text-[var(--color-success)]">
                      {m.mastery.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {dimensionTab === 'disciplina' && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                  <th className="py-2.5 pr-4 font-semibold">Disciplina</th>
                  <th className="py-2.5 px-3 font-semibold">Macrodisciplina</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Respondidas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Acertos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aproveitamento</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Domínio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {performance.byDiscipline.map((d) => (
                  <tr key={d.disciplineId} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">{d.name}</td>
                    <td className="py-3 px-3 text-[var(--text-muted)]">{d.macroDiscipline}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{d.answered}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{d.correct}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {d.accuracy.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold">
                      {d.mastery.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {dimensionTab === 'subtopico' && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                  <th className="py-2.5 pr-4 font-semibold">Subtópico do Edital</th>
                  <th className="py-2.5 px-3 font-semibold">Disciplina</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Respondidas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aproveitamento</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Domínio</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {performance.bySubtopic.map((s) => (
                  <tr key={s.subtopicId} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="py-3 pr-4 font-medium text-[var(--text-primary)]">
                      {s.subtopicTitle}
                    </td>
                    <td className="py-3 px-3 text-[var(--text-muted)]">{s.disciplineName}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {s.answeredQuestions}/{s.availableQuestions}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {s.answeredQuestions > 0 ? `${s.accuracyPercent.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {s.answeredQuestions > 0 ? `${s.masteryPercent.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <PriorityBadge priority={s.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {dimensionTab === 'questao' && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                  <th className="py-2.5 pr-3 font-semibold">Nº</th>
                  <th className="py-2.5 px-3 font-semibold">Enunciado</th>
                  <th className="py-2.5 px-3 font-semibold">Origem</th>
                  <th className="py-2.5 px-3 font-semibold">Última Situação</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Prioridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {questions.slice(0, 50).map((q) => {
                  const lat = latestAnswerMap.get(q.id);
                  return (
                    <tr key={q.id} className="hover:bg-[var(--bg-surface-hover)]">
                      <td className="py-3 pr-3 font-mono font-semibold">Q{q.questionNumber}</td>
                      <td className="py-3 px-3 max-w-md truncate text-[var(--text-primary)]">
                        {q.stem}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-muted)] whitespace-nowrap">
                        {originLabel(q.originType)}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {!lat
                          ? 'Não respondida'
                          : !lat.selectedOption
                          ? 'Em branco'
                          : lat.isCorrect
                          ? `Acertou (${lat.confidence || '—'})`
                          : `Errou (${lat.confidence || '—'})`}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <PriorityBadge priority={lat?.computedPriority ?? 'nao_avaliado'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function EvolutionSvgChart({
  series,
}: {
  series: WorkspaceData['performance']['evolutionSeries'];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 620;
  const height = 220;
  const padX = 44;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = series.map((item, idx) => {
    const x =
      series.length === 1
        ? padX + innerW / 2
        : padX + (idx / (series.length - 1)) * innerW;
    const yAcc = padY + innerH - (item.accuracyAnswered / 100) * innerH;
    const yMas = padY + innerH - (item.masteryScore / 100) * innerH;
    return { x, yAcc, yMas, item };
  });

  const accPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yAcc}`).join(' ');
  const masPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yMas}`).join(' ');
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="space-y-2">
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 rounded-[var(--radius-sm)] font-mono tabular-nums">
          <span className="font-sans font-medium text-[var(--text-primary)] truncate">
            {activePoint.item.examTitle} (T{activePoint.item.attemptNumber})
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[var(--color-primary)] font-semibold">
              Aproveitamento: {activePoint.item.accuracyAnswered.toFixed(1)}%
            </span>
            <span className="text-[var(--color-success)] font-semibold">
              Domínio: {activePoint.item.masteryScore.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56"
          role="img"
          aria-label="Gráfico de evolução de aproveitamento e domínio ao longo das tentativas"
        >
          {[0, 25, 50, 75, 100].map((val) => {
            const y = padY + innerH - (val / 100) * innerH;
            return (
              <g key={val}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[var(--text-muted)] text-[10px] font-mono"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <>
              <path d={accPath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
              <path d={masPath} fill="none" stroke="var(--color-success-solid)" strokeWidth="2.5" />
            </>
          )}

          {points.map((p, i) => (
            <g
              key={p.item.attemptId}
              onMouseEnter={() => setHoveredIdx(i)}
              onFocus={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              tabIndex={0}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={p.x}
                cy={p.yAcc}
                r={hoveredIdx === i ? '6' : '4.5'}
                fill="var(--color-primary)"
                stroke="#FFFFFF"
                strokeWidth="1.75"
              />
              <circle
                cx={p.x}
                cy={p.yMas}
                r={hoveredIdx === i ? '6' : '4.5'}
                fill="var(--color-success-solid)"
                stroke="#FFFFFF"
                strokeWidth="1.75"
              />
              <text
                x={p.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-[10px] font-mono"
              >
                T{i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
