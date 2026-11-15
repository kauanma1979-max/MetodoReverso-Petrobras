import { useEffect, useRef, useState } from 'react';
import { BookOpen, Copy, Download, MessageSquare, Printer, Send } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import type { StudyMaterial } from '../shared/types.ts';
import type { ToastMessage } from './ui/FeedbackToast.tsx';

interface TutorAndMaterialsViewProps {
  workspace: WorkspaceData;
  initialSubView?: 'tutor' | 'materials';
  onAskTutor: (message: string) => Promise<void>;
  onGenerateMaterial: (payload: {
    subtopicId?: string;
    materialType: StudyMaterial['materialType'];
  }) => Promise<void>;
  aiConfigured: boolean;
  onNotify?: (toast: Omit<ToastMessage, 'id'>) => void;
}

const MATERIAL_TYPES: Array<{ value: StudyMaterial['materialType']; label: string }> = [
  { value: 'aula', label: 'Aula Direcionada (Padrão CESGRANRIO)' },
  { value: 'resumo', label: 'Resumo Executivo' },
  { value: 'mapa_mental', label: 'Mapa Mental Estruturado' },
  { value: 'flashcards', label: 'Flashcards de Fixação' },
  { value: 'lista_exercicios', label: 'Lista de Exercícios Comentada' },
  { value: 'revisao_rapida', label: 'Revisão Rápida Pré-Prova' },
  { value: 'apostila', label: 'Apostila Personalizada (PDF/Impressão)' },
];

const QUICK_PROMPTS = [
  'Quais são minhas principais dificuldades?',
  'O que devo estudar primeiro?',
  'Quais assuntos já domino?',
  'Quais questões acertei chutando?',
  'Estou preparado para avançar?',
];

export function TutorAndMaterialsView({
  workspace,
  initialSubView = 'tutor',
  onAskTutor,
  onGenerateMaterial,
  onNotify,
}: TutorAndMaterialsViewProps) {
  const { tutorMessages, materials, subtopics, performance } = workspace;
  const [subView, setSubView] = useState<'tutor' | 'materials'>(initialSubView);

  // Tutor state
  const [questionText, setQuestionText] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Material generator state
  const [selectedSubId, setSelectedSubId] = useState<string>(
    performance.bySubtopic.find((s) => s.priority === 'prioridade_maxima')?.subtopicId ??
      subtopics[0]?.id ??
      ''
  );
  const [matType, setMatType] = useState<StudyMaterial['materialType']>('aula');
  const [generatingMat, setGeneratingMat] = useState(false);
  const [activeMatId, setActiveMatId] = useState<string | null>(materials[0]?.id ?? null);

  const activeMaterial =
    materials.find((m) => m.id === activeMatId) ?? materials[0] ?? null;

  useEffect(() => {
    if (subView === 'tutor' && tutorMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [tutorMessages.length, subView]);

  const handleSendTutor = async (text: string) => {
    if (!text.trim() || asking) return;
    setAsking(true);
    setQuestionText('');
    try {
      await onAskTutor(text.trim());
    } finally {
      setAsking(false);
    }
  };

  const handleGenMat = async () => {
    setGeneratingMat(true);
    try {
      await onGenerateMaterial({
        subtopicId: selectedSubId || undefined,
        materialType: matType,
      });
    } finally {
      setGeneratingMat(false);
    }
  };

  const handleDownloadMarkdown = (mat: StudyMaterial) => {
    const blob = new Blob([mat.contentMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mat.title.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.({ tone: 'success', message: 'Arquivo .MD baixado com sucesso.' });
  };

  const handleCopyMaterial = async (mat: StudyMaterial) => {
    try {
      await navigator.clipboard.writeText(mat.contentMarkdown);
      onNotify?.({ tone: 'success', message: 'Conteúdo copiado para a área de transferência.' });
    } catch {
      onNotify?.({ tone: 'warning', message: 'Não foi possível copiar automaticamente.' });
    }
  };

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="text-[13px] font-medium text-[var(--text-muted)]">
            Tutor Reverso & Materiais Direcionados
          </div>
          <h1 className="font-bold text-[var(--text-primary)]">
            Mentoria Analítica e Produção de Materiais
          </h1>
        </div>

        <div className="segmented-group shrink-0" role="group" aria-label="Modo da área de estudo">
          <button
            type="button"
            aria-pressed={subView === 'tutor'}
            onClick={() => setSubView('tutor')}
            className="segmented-btn inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tutor Reverso</span>
          </button>
          <button
            type="button"
            aria-pressed={subView === 'materials'}
            onClick={() => setSubView('materials')}
            className="segmented-btn inline-flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Materiais & PDF ({materials.length})</span>
          </button>
        </div>
      </section>

      {subView === 'tutor' ? (
        <section className="app-surface p-5 sm:p-6 space-y-5">
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-[var(--text-muted)]">
              Consultas rápidas baseadas no seu histórico real:
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={asking}
                  onClick={() => handleSendTutor(q)}
                  className="btn-secondary !min-h-[38px] !py-1.5 !px-3 !text-[12px] !bg-[var(--color-primary-soft)] !border-[var(--color-primary-soft-border)] !text-[var(--color-primary-text-on-soft)] hover:!bg-[#DCEEF6]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div
            className="border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 sm:p-5 space-y-4 max-h-[480px] overflow-y-auto bg-[var(--bg-surface-subtle)]"
            aria-live="polite"
          >
            {tutorMessages.length === 0 ? (
              <div className="text-[13px] text-[var(--text-muted)] py-8 text-center max-w-lg mx-auto leading-relaxed">
                Faça uma pergunta acima ou digite abaixo. O Tutor Reverso analisa exclusivamente seu histórico real de provas, confiança, dificuldade e documentos enviados — sem inventar dados.
              </div>
            ) : (
              tutorMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-[var(--radius-md)] text-[14px] leading-relaxed whitespace-pre-line max-w-[72ch] ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-secondary)] text-white ml-auto'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] mr-auto'
                  }`}
                >
                  <div
                    className={`text-[11px] font-semibold mb-1.5 ${
                      msg.role === 'user' ? 'text-slate-300' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {msg.role === 'user' ? 'Você' : 'Tutor Reverso'}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendTutor(questionText);
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              aria-label="Pergunta para o Tutor Reverso"
              placeholder="Pergunte sobre seu desempenho, prioridades, chutes ou evolução..."
              className="form-input flex-1"
            />
            <button
              disabled={asking || !questionText.trim()}
              type="submit"
              className="btn-primary"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>{asking ? 'Analisando...' : 'Perguntar'}</span>
            </button>
          </form>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="app-surface p-5 sm:p-6 space-y-4 no-print">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Produzir Material Direcionado para Lacuna do Edital
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Subtópico Alvo
                </span>
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="form-select"
                >
                  {subtopics.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                  Formato do Material
                </span>
                <select
                  value={matType}
                  onChange={(e) =>
                    setMatType(e.target.value as StudyMaterial['materialType'])
                  }
                  className="form-select"
                >
                  {MATERIAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={generatingMat}
                onClick={handleGenMat}
                className="btn-primary w-full sm:w-auto"
              >
                {generatingMat ? 'Gerando Material...' : 'Gerar Material'}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-4 app-surface p-4 space-y-2.5 no-print">
              <div className="text-[13px] font-semibold text-[var(--text-secondary)] pb-2.5 border-b border-[var(--border-subtle)]">
                Materiais Gerados ({materials.length})
              </div>
              {materials.length === 0 ? (
                <div className="text-[13px] text-[var(--text-muted)] py-6 text-center">
                  Nenhum material gerado ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.map((m) => {
                    const active = activeMaterial?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => setActiveMatId(m.id)}
                        className={`w-full text-left p-3.5 rounded-[var(--radius-md)] border transition-colors ${
                          active
                            ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)] text-[var(--text-primary)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <div className="text-[13px] font-semibold truncate">{m.title}</div>
                        <div className="text-[12px] text-[var(--text-muted)] mt-1">
                          {m.isAiGenerated ? 'Material Direcionado' : 'Base da Jornada'} ·{' '}
                          <span className="font-mono">
                            {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="lg:col-span-8 app-surface p-5 sm:p-7 space-y-5">
              {!activeMaterial ? (
                <div className="text-[13px] text-[var(--text-muted)] py-10 text-center">
                  Selecione ou gere um material direcionado para visualizar, copiar ou imprimir em PDF.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 no-print">
                    <div className="space-y-1">
                      <div className="text-[12px] text-[var(--text-muted)]">
                        Base: {activeMaterial.sourceBasis}
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        {activeMaterial.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyMaterial(activeMaterial)}
                        className="btn-secondary"
                      >
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadMarkdown(activeMaterial)}
                        className="btn-secondary"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span>Baixar .MD</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn-primary"
                      >
                        <Printer className="w-4 h-4" aria-hidden="true" />
                        <span>Imprimir / PDF</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-[15px] text-[var(--text-primary)] leading-[1.7] whitespace-pre-line max-w-[70ch]">
                    {activeMaterial.contentMarkdown}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
