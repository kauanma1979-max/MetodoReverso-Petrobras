import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
} from 'lucide-react';
import type { AptitudeStatus, PriorityLevel, QuestionOrigin } from '../shared/types.ts';
import { PRIORITY_LABELS } from '../shared/engine.ts';

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const styles: Record<PriorityLevel, { cls: string; Icon: typeof AlertOctagon }> = {
    prioridade_maxima: {
      cls: 'text-[var(--color-danger)] bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]',
      Icon: AlertOctagon,
    },
    prioridade_alta: {
      cls: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]',
      Icon: AlertTriangle,
    },
    revisao: {
      cls: 'text-[var(--color-info)] bg-[var(--color-info-bg)] border-[var(--color-info-border)]',
      Icon: RefreshCw,
    },
    dominio: {
      cls: 'text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success-border)]',
      Icon: CheckCircle2,
    },
    nao_avaliado: {
      cls: 'text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)]',
      Icon: CircleDashed,
    },
  };

  const { cls, Icon } = styles[priority] ?? styles.nao_avaliado;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold border rounded-[var(--radius-sm)] whitespace-nowrap shrink-0 ${cls}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export function AptitudeIndicator({ status }: { status: AptitudeStatus }) {
  if (status === 'APTO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-[var(--radius-sm)] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>APTO PARA AVANÇAR</span>
      </span>
    );
  }
  if (status === 'EM_EVOLUCAO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-[var(--radius-sm)] whitespace-nowrap shrink-0">
        <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>EM EVOLUÇÃO</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded-[var(--radius-sm)] whitespace-nowrap shrink-0">
      <AlertOctagon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>NÃO APTO</span>
    </span>
  );
}

export function originLabel(origin: QuestionOrigin): string {
  switch (origin) {
    case 'oficial':
      return 'Questão Oficial';
    case 'inedita_ia':
      return 'Questão Inédita';
    case 'demonstracao':
      return 'Demonstração';
    case 'autoral':
      return 'Autoral';
  }
}
