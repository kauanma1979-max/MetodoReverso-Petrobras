import { useMemo, useRef, useState } from 'react';
import { Download, Search, Upload } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import { AptitudeIndicator } from './PriorityTag.tsx';

interface HistoryViewProps {
  workspace: WorkspaceData;
  onInspectAttempt: (attemptId: string) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: (
    rawJson: string
  ) => Promise<{ journeysCount: number; questionsCount: number; attemptsCount: number }>;
}

export function HistoryView({
  workspace,
  onInspectAttempt,
  onExportBackup,
  onImportBackup,
}: HistoryViewProps) {
  const { attempts, exams } = workspace;
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter((att) => {
      const title = (examMap.get(att.examId)?.title ?? 'Avaliação').toLowerCase();
      return title.includes(q);
    });
  }, [attempts, examMap, searchQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('');
    setImportError('');
    try {
      const text = await file.text();
      const res = await onImportBackup(text);
      setImportStatus(
        `Backup JSON restaurado com integridade referencial: ${res.journeysCount} jornada(s), ${res.questionsCount} questão(ões) e ${res.attemptsCount} tentativa(s).`
      );
    } catch (err: any) {
      setImportError(err?.message || 'Erro ao importar arquivo JSON.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Persistência Relacional JSON (IndexedDB) · Registro Imutável de Tentativas
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">
            Histórico Evolutivo e Backup JSON ({attempts.length})
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Seus dados ficam salvos no navegador e podem ser exportados ou restaurados entre dispositivos através de um único arquivo .json mantendo todas as correlações.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Importar Backup JSON</span>
          </button>
          <button type="button" onClick={onExportBackup} className="btn-primary">
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Exportar Backup JSON</span>
          </button>
        </div>
      </section>

      {importStatus && (
        <div className="alert-box alert-success" role="status">
          {importStatus}
        </div>
      )}
      {importError && (
        <div className="alert-box alert-danger" role="alert">
          {importError}
        </div>
      )}

      <section className="app-surface overflow-hidden">
        {attempts.length > 0 && (
          <div className="p-4 sm:px-6 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filtrar tentativas por avaliação"
                placeholder="Filtrar tentativas por avaliação..."
                className="form-input !pl-10"
              />
            </div>
            <span className="text-[12px] font-mono tabular-nums text-[var(--text-muted)]">
              {filteredAttempts.length} registro(s)
            </span>
          </div>
        )}

        {filteredAttempts.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-[var(--text-muted)]">
            {attempts.length === 0
              ? 'Nenhuma tentativa finalizada ainda nesta jornada.'
              : 'Nenhuma tentativa corresponde ao filtro digitado.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] text-left">
                    <th className="py-3 px-5 font-semibold">Data</th>
                    <th className="py-3 px-3 font-semibold">Avaliação</th>
                    <th className="py-3 px-3 font-semibold text-right">Tent.</th>
                    <th className="py-3 px-3 font-semibold text-right">Resp. / Branco</th>
                    <th className="py-3 px-3 font-semibold text-right">Acertos / Erros</th>
                    <th className="py-3 px-3 font-semibold text-right">Aproveit.</th>
                    <th className="py-3 px-3 font-semibold text-right">Domínio</th>
                    <th className="py-3 px-3 font-semibold">Aptidão</th>
                    <th className="py-3 px-5 font-semibold text-right">Relatório</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredAttempts.map((att) => {
                    const ex = examMap.get(att.examId);
                    return (
                      <tr key={att.id} className="hover:bg-[var(--bg-surface-hover)]">
                        <td className="py-3.5 px-5 font-mono text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(att.finishedAt || att.startedAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-[var(--text-primary)]">
                          {ex?.title ?? 'Avaliação'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                          #{att.attemptNumber}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                          {att.answeredCount} / {att.blankCount}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                          <span className="text-[var(--color-success)] font-semibold">
                            {att.correctCount}
                          </span>{' '}
                          /{' '}
                          <span className="text-[var(--color-danger)] font-semibold">
                            {att.wrongCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                          {att.accuracyAnswered.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-[var(--color-success)]">
                          {att.masteryScore.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-3">
                          <AptitudeIndicator status={att.aptitudeStatus} />
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onInspectAttempt(att.id)}
                            className="btn-ghost !text-[13px]"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-[var(--border-subtle)]">
              {filteredAttempts.map((att) => {
                const ex = examMap.get(att.examId);
                return (
                  <div key={att.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {ex?.title ?? 'Avaliação'}
                        </div>
                        <div className="text-[12px] font-mono text-[var(--text-muted)] mt-0.5">
                          Tentativa #{att.attemptNumber} ·{' '}
                          {new Date(att.finishedAt || att.startedAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[12px] font-mono tabular-nums text-[var(--text-secondary)]">
                      <span>
                        Resp: {att.answeredCount}/{att.answeredCount + att.blankCount}
                      </span>
                      <span>
                        Acertos: {att.correctCount} · Erros: {att.wrongCount}
                      </span>
                      <span>Aprov: {att.accuracyAnswered.toFixed(1)}%</span>
                      <span className="text-[var(--color-success)] font-semibold">
                        Dom: {att.masteryScore.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <AptitudeIndicator status={att.aptitudeStatus} />
                      <button
                        type="button"
                        onClick={() => onInspectAttempt(att.id)}
                        className="btn-secondary !min-h-[40px] !py-1.5"
                      >
                        Abrir Relatório
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
