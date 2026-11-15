import { useState } from 'react';
import { Calendar, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import { PriorityBadge } from './PriorityTag.tsx';

interface PlannerViewProps {
  workspace: WorkspaceData;
  onGeneratePlan: (dailyMinutes?: number) => Promise<void>;
  onToggleItem: (itemId: string, completed: boolean) => Promise<void>;
}

export function PlannerView({
  workspace,
  onGeneratePlan,
  onToggleItem,
}: PlannerViewProps) {
  const { journey, latestPlan } = workspace;
  const [dailyMinutes, setDailyMinutes] = useState(
    latestPlan?.dailyMinutes ?? journey.dailyMinutes ?? 90
  );
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGeneratePlan(dailyMinutes);
    } finally {
      setGenerating(false);
    }
  };

  // Agrupar itens por dia da semana
  const byDay = new Map<string, NonNullable<typeof latestPlan>['items']>();
  for (const item of latestPlan?.items ?? []) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  const totalTasks = latestPlan?.items.length ?? 0;
  const doneTasks = latestPlan?.items.filter((i) => i.completed).length ?? 0;
  const progressRatio = totalTasks > 0 ? doneTasks / totalTasks : 0;

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Planejamento Semanal Baseado em Lacunas Reais
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">
            Agenda Personalizada de Estudo Reverso
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Prioriza exclusivamente subtópicos com erro, chute ou dúvida identificados nas avaliações. Se não cumprir uma tarefa, clique em Reorganizar Ciclo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)]">
            <span>Minutos/dia:</span>
            <input
              type="number"
              min={30}
              max={480}
              step={15}
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              className="form-input !w-24 font-mono text-center"
            />
          </label>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="btn-primary"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>
              {generating
                ? 'Montando...'
                : latestPlan
                ? 'Reorganizar Ciclo Semanal'
                : 'Gerar Planejamento'}
            </span>
          </button>
        </div>
      </section>

      {!latestPlan ? (
        <section className="app-surface p-8 sm:p-12 text-center space-y-4">
          <Calendar className="w-10 h-10 text-[var(--color-primary)] mx-auto" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Nenhum ciclo semanal gerado ainda nesta jornada
          </h2>
          <p className="text-[14px] text-[var(--text-muted)] max-w-md mx-auto">
            Clique em "Gerar Planejamento" para organizar sua semana conforme as prioridades detectadas nas provas (ou iniciar pelo Diagnóstico Inicial).
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="btn-primary"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Gerar Planejamento Agora</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {/* Barra de Progresso do Ciclo */}
          <section className="app-surface p-4 sm:px-6 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold text-[var(--text-primary)]">
                {latestPlan.weekLabel}
              </span>
              <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                Concluídas: <strong className="text-[var(--text-primary)]">{doneTasks}</strong> /{' '}
                {totalTasks} atividades ({Math.round(progressRatio * 100)}%)
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ transform: `scaleX(${progressRatio})` }}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from(byDay.entries()).map(([day, items]) => (
              <section key={day} className="app-surface p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{day}</h2>
                  <span className="text-[12px] font-mono text-[var(--text-muted)] tabular-nums">
                    {items.reduce((a, b) => a + b.estimatedMinutes, 0)} min
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`py-3.5 first:pt-1 last:pb-1 transition-opacity ${
                        item.completed ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          aria-pressed={item.completed}
                          aria-label={
                            item.completed
                              ? `Desmarcar "${item.title}"`
                              : `Marcar "${item.title}" como concluída`
                          }
                          onClick={() => onToggleItem(item.id, !item.completed)}
                          className="w-10 h-10 -ml-1.5 -mt-1.5 inline-flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-subtle)] shrink-0"
                        >
                          {item.completed ? (
                            <CheckCircle2
                              className="w-5 h-5 text-[var(--color-success-solid)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <Circle
                              className="w-5 h-5 text-[var(--border-strong)]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`text-[14px] font-semibold ${
                                item.completed
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {item.title}
                            </span>
                            <PriorityBadge priority={item.priority} />
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            {item.disciplineName} ·{' '}
                            <span className="font-mono tabular-nums">
                              {item.estimatedMinutes} min
                            </span>
                          </div>
                          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
