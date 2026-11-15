import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Plus, Search } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import { PriorityBadge } from './PriorityTag.tsx';

interface SyllabusViewProps {
  workspace: WorkspaceData;
  onAddDiscipline: (payload: {
    macroDiscipline: string;
    name: string;
    subtopics: string[];
  }) => Promise<void>;
  onAddSubtopic: (payload: { disciplineId: string; title: string; code?: string }) => Promise<void>;
  onPracticeSubtopic: (subtopicId: string) => Promise<void>;
}

const SCOPE_FILTERS = [
  'Todos',
  '[Comum]',
  '[Operação]',
  '[Dutos e Terminais]',
  '[Transpetro 2026]',
] as const;

const PROGRAM_DIFFERENCES = [
  'Os dois editais de Petrobras — Operação têm o mesmo programa.',
  'Os editais de Transpetro — Dutos e Terminais são muito parecidos.',
  'O edital da Transpetro de 2026 explicita tensões normais e cisalhantes em Resistência dos Materiais.',
  'Compressores, processos de refino, sistemas instrumentados de segurança, medições industriais detalhadas e resistência dos materiais aparecem nos programas de Dutos e Terminais, mas não estão explicitados no programa de Operação fornecido.',
  'Leis de Newton, condições de equilíbrio, processos naturais, tubulações industriais, válvulas e acessórios aparecem no programa de Operação, mas não estão detalhados da mesma forma nos programas de Dutos e Terminais.',
];

export function SyllabusView({
  workspace,
  onAddDiscipline,
  onAddSubtopic,
  onPracticeSubtopic,
}: SyllabusViewProps) {
  const { disciplines, subtopics, performance } = workspace;
  const [showAddDisc, setShowAddDisc] = useState(false);
  const [showDifferences, setShowDifferences] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [macroName, setMacroName] = useState(
    'Conteúdo Programático Consolidado (Operação / Dutos e Terminais)'
  );
  const [discName, setDiscName] = useState('');
  const [subtopicsText, setSubtopicsText] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubCode, setNewSubCode] = useState('[Comum]');
  const [scopeFilter, setScopeFilter] = useState<(typeof SCOPE_FILTERS)[number]>('Todos');
  const [saving, setSaving] = useState(false);

  const subtopicCodeMap = useMemo(
    () => new Map(subtopics.map((s) => [s.id, s.code])),
    [subtopics]
  );

  const macroGroups = new Map<string, typeof disciplines>();
  for (const d of disciplines) {
    const list = macroGroups.get(d.macroDiscipline) ?? [];
    list.push(d);
    macroGroups.set(d.macroDiscipline, list);
  }

  const handleCreateDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discName.trim()) return;
    setSaving(true);
    try {
      const subs = subtopicsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await onAddDiscipline({
        macroDiscipline: macroName.trim() || 'Conteúdo Programático',
        name: discName.trim(),
        subtopics: subs,
      });
      setDiscName('');
      setSubtopicsText('');
      setShowAddDisc(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubtopic = async (disciplineId: string) => {
    if (!newSubTitle.trim()) return;
    setSaving(true);
    try {
      await onAddSubtopic({
        disciplineId,
        title: newSubTitle.trim(),
        code: newSubCode.trim(),
      });
      setNewSubTitle('');
      setAddingSubFor(null);
    } finally {
      setSaving(false);
    }
  };

  const unassessedCount = performance.bySubtopic.filter((s) => s.answeredQuestions === 0).length;
  const query = searchTerm.trim().toLowerCase();

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Edital Verticalizado · {performance.bySubtopic.length} subtópicos mapeados
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">
            Conteúdo Programático Consolidado (Operação / Dutos e Terminais)
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Tópicos ainda não avaliados em prova:{' '}
            <strong className="font-mono tabular-nums text-[var(--text-primary)]">
              {unassessedCount}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          aria-expanded={showAddDisc}
          onClick={() => setShowAddDisc((v) => !v)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Adicionar Disciplina</span>
        </button>
      </section>

      {/* Busca instantânea, Filtro de Escopo & Diferenças dos Programas */}
      <section className="app-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar assunto ou disciplina no edital"
              placeholder="Buscar assunto ou disciplina no edital..."
              className="form-input !pl-10"
            />
          </div>

          <div className="segmented-group" role="group" aria-label="Filtrar por escopo do edital">
            {SCOPE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={scopeFilter === f}
                onClick={() => setScopeFilter(f)}
                className="segmented-btn"
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)]">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <span>
              <strong className="font-mono text-[var(--color-success)]">[Comum]</strong> Operação e
              Dutos e Terminais
            </span>
            <span>
              <strong className="font-mono text-[var(--color-primary)]">[Dutos e Terminais]</strong>{' '}
              Editais Transpetro
            </span>
            <span>
              <strong className="font-mono text-[var(--color-warning)]">[Operação]</strong> Editais
              Petrobras Operação
            </span>
            <span>
              <strong className="font-mono text-[var(--color-scope-2026)]">[Transpetro 2026]</strong>{' '}
              Detalhamento edital 2026
            </span>
          </div>

          <button
            type="button"
            aria-expanded={showDifferences}
            onClick={() => setShowDifferences((v) => !v)}
            className="btn-ghost !text-[12px]"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Diferenças entre os programas</span>
            {showDifferences ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {showDifferences && (
          <div className="app-inset p-4 space-y-2 view-enter">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
              Diferenças importantes entre os programas
            </div>
            <ul className="text-[13px] text-[var(--text-secondary)] space-y-1.5 pl-5 list-disc leading-relaxed">
              {PROGRAM_DIFFERENCES.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {showAddDisc && (
        <form
          onSubmit={handleCreateDiscipline}
          className="app-surface p-5 sm:p-6 space-y-4 view-enter"
        >
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Nova Disciplina no Edital
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Macrodisciplina / Grupo
              </span>
              <input
                value={macroName}
                onChange={(e) => setMacroName(e.target.value)}
                className="form-input"
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Nome da Disciplina
              </span>
              <input
                required
                placeholder="Ex: Termodinâmica Aplicada"
                value={discName}
                onChange={(e) => setDiscName(e.target.value)}
                className="form-input"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
              Subtópicos (um por linha)
            </span>
            <textarea
              rows={4}
              placeholder={'Ciclos térmicos\nTransferência de calor\nEstudo dos gases'}
              value={subtopicsText}
              onChange={(e) => setSubtopicsText(e.target.value)}
              className="form-textarea"
            />
          </label>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddDisc(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button disabled={saving} type="submit" className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar Disciplina'}
            </button>
          </div>
        </form>
      )}

      {Array.from(macroGroups.entries()).map(([macro, discs]) => (
        <div key={macro} className="space-y-5">
          <div className="text-[13px] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] pb-2">
            {macro}
          </div>

          {discs.map((disc) => {
            const allDiscSubs = performance.bySubtopic.filter((s) => s.disciplineId === disc.id);
            const subRows = allDiscSubs.filter((s) => {
              if (scopeFilter !== 'Todos' && subtopicCodeMap.get(s.subtopicId) !== scopeFilter) {
                return false;
              }
              if (
                query &&
                !s.subtopicTitle.toLowerCase().includes(query) &&
                !disc.name.toLowerCase().includes(query)
              ) {
                return false;
              }
              return true;
            });

            if ((scopeFilter !== 'Todos' || query) && subRows.length === 0) {
              return null;
            }

            return (
              <section key={disc.id} className="app-surface overflow-hidden">
                <div className="px-5 py-4 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {disc.name}
                    </h2>
                    <div className="text-[12px] text-[var(--text-muted)] font-mono tabular-nums">
                      {subRows.length} subtópico(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={addingSubFor === disc.id}
                    onClick={() => setAddingSubFor(addingSubFor === disc.id ? null : disc.id)}
                    className="btn-ghost"
                  >
                    + Subtópico
                  </button>
                </div>

                {addingSubFor === disc.id && (
                  <div className="px-5 py-3.5 bg-[var(--color-primary-soft)] border-b border-[var(--color-primary-soft-border)] flex flex-wrap items-center gap-2.5">
                    <input
                      value={newSubTitle}
                      onChange={(e) => setNewSubTitle(e.target.value)}
                      placeholder="Nome do novo subtópico do edital..."
                      className="form-input flex-1 min-w-[200px]"
                    />
                    <select
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value)}
                      className="form-select !w-auto min-w-[160px]"
                    >
                      <option value="[Comum]">[Comum]</option>
                      <option value="[Operação]">[Operação]</option>
                      <option value="[Dutos e Terminais]">[Dutos e Terminais]</option>
                      <option value="[Transpetro 2026]">[Transpetro 2026]</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleCreateSubtopic(disc.id)}
                      className="btn-primary"
                    >
                      Adicionar
                    </button>
                  </div>
                )}

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-left">
                        <th className="py-3 px-5 font-semibold">Subtópico</th>
                        <th className="py-3 px-3 font-semibold">Escopo</th>
                        <th className="py-3 px-3 font-semibold text-right">Disp.</th>
                        <th className="py-3 px-3 font-semibold text-right">Realiz.</th>
                        <th className="py-3 px-3 font-semibold text-right">% Acertos</th>
                        <th className="py-3 px-3 font-semibold text-right">Domínio</th>
                        <th className="py-3 px-3 font-semibold">Última Revisão</th>
                        <th className="py-3 px-3 font-semibold">Prioridade</th>
                        <th className="py-3 px-5 font-semibold text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {subRows.map((sub) => {
                        const scopeCode = subtopicCodeMap.get(sub.subtopicId) || '';
                        const scopeColor =
                          scopeCode === '[Comum]'
                            ? 'text-[var(--color-success)]'
                            : scopeCode === '[Dutos e Terminais]'
                            ? 'text-[var(--color-primary)]'
                            : scopeCode === '[Operação]'
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-scope-2026)]';

                        return (
                          <tr key={sub.subtopicId} className="hover:bg-[var(--bg-surface-hover)]">
                            <td className="py-3 px-5 font-medium text-[var(--text-primary)]">
                              {sub.subtopicTitle}
                            </td>
                            <td className={`py-3 px-3 font-mono text-[12px] whitespace-nowrap ${scopeColor}`}>
                              {scopeCode || '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {sub.availableQuestions}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {sub.answeredQuestions}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {sub.answeredQuestions > 0
                                ? `${sub.accuracyPercent.toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                              {sub.answeredQuestions > 0
                                ? `${sub.masteryPercent.toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="py-3 px-3 text-[var(--text-muted)] font-mono text-[12px] whitespace-nowrap">
                              {sub.lastReviewedAt
                                ? new Date(sub.lastReviewedAt).toLocaleDateString('pt-BR')
                                : 'Nunca avaliado'}
                            </td>
                            <td className="py-3 px-3">
                              <PriorityBadge priority={sub.priority} />
                            </td>
                            <td className="py-3 px-5 text-right">
                              {sub.availableQuestions > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onPracticeSubtopic(sub.subtopicId)}
                                  className="btn-ghost !text-[13px]"
                                >
                                  Praticar
                                </button>
                              ) : (
                                <span className="text-[12px] text-[var(--text-muted)]">
                                  Sem questões
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Clean List (sem scroll horizontal em 320px/375px) */}
                <div className="md:hidden divide-y divide-[var(--border-subtle)]">
                  {subRows.map((sub) => {
                    const scopeCode = subtopicCodeMap.get(sub.subtopicId) || '';
                    return (
                      <div key={sub.subtopicId} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-[14px] text-[var(--text-primary)]">
                            {sub.subtopicTitle}
                          </div>
                          {scopeCode && (
                            <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                              {scopeCode}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[12px] font-mono tabular-nums text-[var(--text-secondary)]">
                          <span>Disp: {sub.availableQuestions}</span>
                          <span>Realiz: {sub.answeredQuestions}</span>
                          <span>
                            Acr:{' '}
                            {sub.answeredQuestions > 0 ? `${sub.accuracyPercent.toFixed(0)}%` : '—'}
                          </span>
                          <span>
                            Dom:{' '}
                            {sub.answeredQuestions > 0 ? `${sub.masteryPercent.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <PriorityBadge priority={sub.priority} />
                          {sub.availableQuestions > 0 ? (
                            <button
                              type="button"
                              onClick={() => onPracticeSubtopic(sub.subtopicId)}
                              className="btn-secondary !min-h-[40px] !py-1.5"
                            >
                              Praticar
                            </button>
                          ) : (
                            <span className="text-[12px] text-[var(--text-muted)]">
                              Sem questões
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
