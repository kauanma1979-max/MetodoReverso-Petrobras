import { useMemo, useState } from 'react';
import { Bookmark, Check, Flag, Play, Search } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import type { OptionLetter, Question } from '../shared/types.ts';
import { PriorityBadge, originLabel } from './PriorityTag.tsx';

interface QuestionBankViewProps {
  workspace: WorkspaceData;
  onCreateCustomExam: (payload: {
    title?: string;
    mode: 'erros' | 'duvidas' | 'subtopico' | 'proporcional_edital' | 'simulado_inedito' | 'personalizado';
    count: number;
    subtopicId?: string | null;
    disciplineId?: string | null;
  }) => Promise<void>;
  onUpdateQuestion: (questionId: string, payload: Partial<Question>) => Promise<void>;
  aiConfigured: boolean;
}

export function QuestionBankView({
  workspace,
  onCreateCustomExam,
  onUpdateQuestion,
}: QuestionBankViewProps) {
  const { journey, questions, disciplines, subtopics, attempts } = workspace;

  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('todas');
  const [discFilter, setDiscFilter] = useState<string>('todas');
  const [subFilter, setSubFilter] = useState<string>('todos');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyReviewFlag, setOnlyReviewFlag] = useState(false);

  // Custom Exam Generator state (15 default, editable)
  const [customMode, setCustomMode] = useState<
    'personalizado' | 'erros' | 'duvidas' | 'subtopico' | 'proporcional_edital' | 'simulado_inedito'
  >('personalizado');
  const [customCount, setCustomCount] = useState(journey.defaultCustomExamQuestions || 15);
  const [customSubtopic, setCustomSubtopic] = useState<string>(subtopics[0]?.id ?? '');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editSubId, setEditSubId] = useState<string>('');
  const [editAns, setEditAns] = useState<string>('');

  const discMap = useMemo(() => new Map(disciplines.map((d) => [d.id, d])), [disciplines]);
  const subMap = useMemo(() => new Map(subtopics.map((s) => [s.id, s])), [subtopics]);

  const latestAnswerByQ = useMemo(() => {
    const map = new Map<string, any>();
    const sorted = [...attempts]
      .filter((a) => a.status === 'finalizada')
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const att of sorted) {
      for (const ans of att.answers ?? []) {
        map.set(ans.questionId, ans);
      }
    }
    return map;
  }, [attempts]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (originFilter !== 'todas' && q.originType !== originFilter) return false;
      if (discFilter !== 'todas' && q.disciplineId !== discFilter) return false;
      if (subFilter !== 'todos' && q.subtopicId !== subFilter) return false;
      if (onlyFavorites && !q.isFavorite) return false;
      if (onlyReviewFlag && !q.markedForReview && !q.needsManualReview) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        if (!q.stem.toLowerCase().includes(term) && !q.sourceReference.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [questions, originFilter, discFilter, subFilter, onlyFavorites, onlyReviewFlag, search]);

  const handleGenerateCustom = async () => {
    setErrorMsg('');
    setGenerating(true);
    try {
      await onCreateCustomExam({
        mode: customMode,
        count: customCount,
        subtopicId:
          customMode === 'subtopico' || customMode === 'simulado_inedito' ? customSubtopic : null,
        disciplineId: discFilter !== 'todas' ? discFilter : null,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao gerar caderno de questões.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Gerador Inteligente de Listas e Simulados */}
      <section className="app-surface p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Banco de Questões · {questions.length} questões cadastradas
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">
            Gerar Caderno Personalizado ou Refazer Lacunas
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
              Modo de Geração
            </span>
            <select
              value={customMode}
              onChange={(e) => setCustomMode(e.target.value as any)}
              className="form-select"
            >
              <option value="personalizado">Caderno geral do banco disponível</option>
              <option value="erros">Refazer apenas questões erradas</option>
              <option value="duvidas">Refazer acertos com dúvida e chutes</option>
              <option value="proporcional_edital">Proporcional ao edital cadastrado</option>
              <option value="subtopico">Focar em um subtópico específico do edital</option>
            </select>
          </label>

          {(customMode === 'subtopico' || customMode === 'simulado_inedito') && (
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Subtópico
              </span>
              <select
                value={customSubtopic}
                onChange={(e) => setCustomSubtopic(e.target.value)}
                className="form-select"
              >
                {subtopics.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1.5">
            <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
              Quantidade (padrão 15)
            </span>
            <input
              type="number"
              min={1}
              max={60}
              value={customCount}
              onChange={(e) => setCustomCount(Number(e.target.value))}
              className="form-input font-mono"
            />
          </label>

          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateCustom}
            className="btn-primary w-full lg:w-auto"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>{generating ? 'Gerando...' : 'Criar e Resolver'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="alert-box alert-danger" role="alert">
            {errorMsg}
          </div>
        )}
      </section>

      {/* Filtros do Banco e Lista */}
      <section className="app-surface p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar no enunciado ou referência"
              placeholder="Buscar no enunciado ou referência..."
              className="form-input !pl-10"
            />
          </div>

          <select
            aria-label="Filtrar por origem"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="form-select"
          >
            <option value="todas">Todas as origens</option>
            <option value="oficial">Apenas Oficiais</option>
            <option value="inedita_ia">Apenas Inéditas</option>
            <option value="demonstracao">Demonstração Inicial</option>
          </select>

          <select
            aria-label="Filtrar por disciplina"
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="form-select"
          >
            <option value="todas">Todas as disciplinas</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por subtópico"
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="form-select"
          >
            <option value="todos">Todos os subtópicos</option>
            {subtopics.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--text-secondary)]">
          <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span>Apenas favoritas</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={onlyReviewFlag}
              onChange={(e) => setOnlyReviewFlag(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span>Marcadas para revisão / conferência manual</span>
          </label>
          <span className="ml-auto font-mono tabular-nums text-[12px] text-[var(--text-muted)]">
            Exibindo {filtered.length} de {questions.length}
          </span>
        </div>

        {/* Lista de Questões */}
        <div className="divide-y divide-[var(--border-subtle)] border-t border-b border-[var(--border-subtle)]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[var(--text-muted)]">
              Nenhuma questão encontrada para os filtros selecionados.
            </div>
          ) : (
            filtered.map((q) => {
              const lat = latestAnswerByQ.get(q.id);
              const sub = q.subtopicId ? subMap.get(q.subtopicId) : null;
              const disc = q.disciplineId ? discMap.get(q.disciplineId) : null;
              const isEditing = editingQId === q.id;

              return (
                <article key={q.id} className="py-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 text-[12px]">
                    <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
                      <span className="font-mono font-semibold text-[13px] text-[var(--text-primary)]">
                        Q{q.questionNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{originLabel(q.originType)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{disc?.name ?? 'Sem disciplina'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sub?.title ?? 'Sem subtópico'}</span>
                      {q.officialAnswer && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-[var(--color-success)]">
                            Gab: {q.officialAnswer}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={lat?.computedPriority ?? 'nao_avaliado'} />
                      <button
                        type="button"
                        aria-pressed={q.isFavorite}
                        aria-label={q.isFavorite ? 'Remover dos favoritos' : 'Favoritar questão'}
                        title={q.isFavorite ? 'Remover dos favoritos' : 'Favoritar questão'}
                        onClick={() => onUpdateQuestion(q.id, { isFavorite: !q.isFavorite })}
                        className={`w-10 h-10 inline-flex items-center justify-center border rounded-[var(--radius-sm)] transition-colors ${
                          q.isFavorite
                            ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] text-[var(--color-warning)]'
                            : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-control)]'
                        }`}
                      >
                        <Bookmark className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-pressed={q.markedForReview}
                        aria-label={
                          q.markedForReview ? 'Desmarcar revisão' : 'Marcar para revisão'
                        }
                        title={q.markedForReview ? 'Desmarcar revisão' : 'Marcar para revisão'}
                        onClick={() =>
                          onUpdateQuestion(q.id, { markedForReview: !q.markedForReview })
                        }
                        className={`w-10 h-10 inline-flex items-center justify-center border rounded-[var(--radius-sm)] transition-colors ${
                          q.markedForReview
                            ? 'bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info)]'
                            : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-control)]'
                        }`}
                      >
                        <Flag className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-expanded={isEditing}
                        onClick={() => {
                          if (isEditing) {
                            setEditingQId(null);
                          } else {
                            setEditingQId(q.id);
                            setEditSubId(q.subtopicId || '');
                            setEditAns(q.officialAnswer || '');
                          }
                        }}
                        className="btn-secondary !min-h-[40px] !py-1.5 !px-3 !text-[12px]"
                      >
                        {isEditing ? 'Fechar' : 'Revisar'}
                      </button>
                    </div>
                  </div>

                  <p className="text-[14px] text-[var(--text-primary)] leading-relaxed line-clamp-3 max-w-[78ch]">
                    {q.stem}
                  </p>

                  {q.answerDivergenceNote && (
                    <div className="alert-box alert-warning text-[12px]">
                      Divergência registrada: {q.answerDivergenceNote}
                    </div>
                  )}

                  {isEditing && (
                    <div className="app-inset p-4 flex flex-wrap items-end gap-3 view-enter">
                      <label className="space-y-1.5 flex-1 min-w-[200px]">
                        <span className="block text-[12px] font-semibold text-[var(--text-secondary)]">
                          Subtópico do Edital
                        </span>
                        <select
                          value={editSubId}
                          onChange={(e) => setEditSubId(e.target.value)}
                          className="form-select"
                        >
                          <option value="">Sem subtópico</option>
                          {subtopics.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 w-36">
                        <span className="block text-[12px] font-semibold text-[var(--text-secondary)]">
                          Gabarito Oficial
                        </span>
                        <select
                          value={editAns}
                          onChange={(e) => setEditAns(e.target.value)}
                          className="form-select font-mono"
                        >
                          <option value="">Pendente</option>
                          {(['A', 'B', 'C', 'D', 'E'] as OptionLetter[]).map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={async () => {
                          const subObj = subMap.get(editSubId);
                          await onUpdateQuestion(q.id, {
                            subtopicId: editSubId || null,
                            disciplineId: subObj?.disciplineId ?? q.disciplineId,
                            officialAnswer: (editAns || null) as OptionLetter | null,
                            classificationReviewed: true,
                            needsManualReview: false,
                          });
                          setEditingQId(null);
                        }}
                        className="btn-primary"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>Confirmar</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
