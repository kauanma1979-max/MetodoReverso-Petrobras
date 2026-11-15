import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, RotateCcw, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  message: string;
  undoLabel?: string;
  onUndo?: () => void | Promise<void>;
}

interface FeedbackToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function FeedbackToast({ toast, onDismiss }: FeedbackToastProps) {
  useEffect(() => {
    if (!toast) return;
    const ms = toast.onUndo ? 6000 : 4000;
    const timer = window.setTimeout(() => onDismiss(), ms);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const toneStyles = {
    success: {
      box: 'bg-[var(--bg-surface)] border-[var(--color-success-border)] text-[var(--text-primary)]',
      icon: 'text-[var(--color-success)]',
      Icon: CheckCircle2,
    },
    info: {
      box: 'bg-[var(--bg-surface)] border-[var(--color-info-border)] text-[var(--text-primary)]',
      icon: 'text-[var(--color-info)]',
      Icon: Info,
    },
    warning: {
      box: 'bg-[var(--bg-surface)] border-[var(--color-warning-border)] text-[var(--text-primary)]',
      icon: 'text-[var(--color-warning)]',
      Icon: AlertCircle,
    },
    error: {
      box: 'bg-[var(--bg-surface)] border-[var(--color-danger-border)] text-[var(--text-primary)]',
      icon: 'text-[var(--color-danger)]',
      Icon: AlertCircle,
    },
  }[toast.tone];

  const { Icon } = toneStyles;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 no-print view-enter"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] border shadow-[var(--shadow-modal)] ${toneStyles.box}`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${toneStyles.icon}`} aria-hidden="true" />
        <span className="text-[var(--text-sm)] font-medium flex-1 leading-snug">
          {toast.message}
        </span>

        {toast.onUndo && (
          <button
            type="button"
            onClick={async () => {
              await toast.onUndo?.();
              onDismiss();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-[var(--text-xs)] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] rounded-[var(--radius-sm)] whitespace-nowrap shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{toast.undoLabel || 'Desfazer'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar notificação"
          className="p-2 -mr-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm)] transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
