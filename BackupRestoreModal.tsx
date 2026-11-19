import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type { BackupRestoreResult, StoragePersistenceInfo } from '../../api/client.ts';

interface BackupRestoreModalProps {
  open: boolean;
  onClose: () => void;
  persistenceInfo: StoragePersistenceInfo | null;
  onRefreshPersistence: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (
    rawJson: string,
    options?: { mode?: 'merge' | 'replace' }
  ) => Promise<BackupRestoreResult>;
}

export function BackupRestoreModal({
  open,
  onClose,
  persistenceInfo,
  onRefreshPersistence,
  onExportBackup,
  onImportBackup,
}: BackupRestoreModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [busyAction, setBusyAction] = useState<'export' | 'import' | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setStatusMessage('');
    setErrorMessage('');
    onRefreshPersistence().catch(() => {});
  }, [open, onRefreshPersistence]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleExportClick = async () => {
    setStatusMessage('');
    setErrorMessage('');
    setBusyAction('export');
    try {
      await onExportBackup();
      await onRefreshPersistence();
      setStatusMessage(
        'Backup completo em JSON exportado com sucesso, preservando todas as correlações e itens anexados.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível exportar o arquivo JSON.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage('');
    setErrorMessage('');
    setBusyAction('import');
    try {
      const rawJson = await file.text();
      const res = await onImportBackup(rawJson, { mode: restoreMode });
      await onRefreshPersistence();
      if (res.mode === 'merge') {
        setStatusMessage(
          `Restauração concluída mantendo os itens já anexados no app: ${res.addedCount} registro(s) novo(s) incorporado(s). Total atual: ${res.journeysCount} jornada(s), ${res.documentsCount} documento(s), ${res.questionsCount} questão(ões) e ${res.attemptsCount} tentativa(s).`
        );
      } else {
        setStatusMessage(
          `Base substituída pelo arquivo selecionado: ${res.journeysCount} jornada(s), ${res.documentsCount} documento(s), ${res.questionsCount} questão(ões) e ${res.attemptsCount} tentativa(s).`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao validar ou restaurar o arquivo JSON.');
    } finally {
      setBusyAction(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const counts = persistenceInfo?.counts;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-backup-restore-title"
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="app-surface w-full max-w-2xl p-6 space-y-6 shadow-[var(--shadow-modal)] view-enter my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-primary)]">
              <Database className="w-4 h-4" aria-hidden="true" />
              <span>Persistência Relacional JSON (IndexedDB)</span>
            </div>
            <h2
              id="modal-backup-restore-title"
              className="text-lg font-bold text-[var(--text-primary)]"
            >
              Backup e Restauração em JSON
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Exporte todo o banco relacional em um único arquivo .json ou restaure um backup sem perder os documentos, provas e tentativas já anexados neste navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de backup e restauração"
            className="p-2 -mr-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] rounded-[var(--radius-sm)]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Estado atual persistido */}
        <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
              <ShieldCheck
                className="w-4 h-4 text-[var(--color-success)] shrink-0"
                aria-hidden="true"
              />
              <span>
                {persistenceInfo?.persistentStorage === 'granted'
                  ? 'Armazenamento persistente ativo e protegido no navegador'
                  : 'Armazenamento local ativo em IndexedDB'}
              </span>
            </div>
            {persistenceInfo?.lastBackupAt && (
              <span className="text-[12px] font-mono text-[var(--text-muted)]">
                Último backup:{' '}
                {new Date(persistenceInfo.lastBackupAt).toLocaleString('pt-BR')}
              </span>
            )}
          </div>

          {counts && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="text-[11px] text-[var(--text-muted)]">Jornadas</div>
                <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {counts.journeys}
                </div>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="text-[11px] text-[var(--text-muted)]">Documentos</div>
                <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {counts.documents}
                </div>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="text-[11px] text-[var(--text-muted)]">Provas</div>
                <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {counts.exams}
                </div>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="text-[11px] text-[var(--text-muted)]">Questões</div>
                <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {counts.questions}
                </div>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-[var(--text-muted)]">Tentativas</div>
                <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {counts.attempts}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Exportar */}
        <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              1. Exportar Backup Completo (.json)
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Gera um arquivo JSON portátil com todas as 12 tabelas e chaves estrangeiras intactas.
            </p>
          </div>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleExportClick}
            className="btn-primary shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{busyAction === 'export' ? 'Exportando...' : 'Exportar Backup JSON'}</span>
          </button>
        </section>

        {/* Restaurar */}
        <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              2. Restaurar Backup JSON
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Escolha como aplicar o arquivo selecionado sobre os itens atualmente salvos no aplicativo.
            </p>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="sr-only">Modo de restauração do backup JSON</legend>

            <label
              className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                restoreMode === 'merge'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/50'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <input
                type="radio"
                name="backup-restore-mode"
                value="merge"
                checked={restoreMode === 'merge'}
                onChange={() => setRestoreMode('merge')}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[var(--color-success)] shrink-0"
                    aria-hidden="true"
                  />
                  <span>Manter itens já anexados no app e mesclar o backup (Recomendado)</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Preserva integralmente todos os documentos, questões, provas, jornadas e tentativas que já estão no app, adicionando apenas os registros novos do arquivo JSON.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                restoreMode === 'replace'
                  ? 'border-[var(--color-warning)] bg-[var(--color-warning-soft)]/40'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <input
                type="radio"
                name="backup-restore-mode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="mt-1 accent-[var(--color-primary)]"
              />
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Substituir toda a base atual pelo conteúdo do backup
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Sobrescreve os dados atuais deste navegador exatamente pelo estado gravado no arquivo selecionado.
                </p>
              </div>
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>
                {busyAction === 'import'
                  ? 'Validando e restaurando...'
                  : 'Selecionar arquivo .json para restaurar'}
              </span>
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Fechar
            </button>
          </div>
        </section>

        {statusMessage && (
          <div className="alert-box alert-success" role="status">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="alert-box alert-danger" role="alert">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
