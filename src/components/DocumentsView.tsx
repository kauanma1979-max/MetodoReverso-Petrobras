import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Upload, X } from 'lucide-react';
import type { WorkspaceData } from '../api/client.ts';
import type { DocumentType } from '../shared/types.ts';

interface DocumentsViewProps {
  workspace: WorkspaceData;
  onImportDocument: (payload: {
    docType: DocumentType;
    title: string;
    file?: File | null;
    filename?: string;
    mimeType?: string;
    rawTextInput?: string;
    targetExamId?: string | null;
    examMeta?: {
      year?: number | null;
      board?: string;
      concurso?: string;
      roleEmphasis?: string;
    };
  }) => Promise<{
    needsManualReview: boolean;
    reviewNotes: string;
    extractedQuestionsCount: number;
    appliedKeysCount: number;
    divergencesCount: number;
    updatedEditalRules: boolean;
    createdDisciplinesCount: number;
  }>;
  aiConfigured: boolean;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  edital: '1. Edital Oficial',
  conteudo_programatico: '2. Conteúdo Programático',
  prova_anterior: '3. Prova Anterior',
  gabarito_preliminar: '4. Gabarito Preliminar',
  gabarito_definitivo: '5. Gabarito Definitivo',
  retificacao: '6. Retificação do Edital',
  apostila: '7. Apostila',
  livro: '8. Livro / Material Próprio',
  resumo: '9. Resumo Pessoal',
  anotacao: '10. Anotação Pessoal',
};

export function DocumentsView({ workspace, onImportDocument }: DocumentsViewProps) {
  const { journey, documents, exams } = workspace;

  const [docType, setDocType] = useState<DocumentType>('prova_anterior');
  const [title, setTitle] = useState('');
  const [rawTextInput, setRawTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [targetExamId, setTargetExamId] = useState<string>(exams[0]?.id ?? '');
  const [year, setYear] = useState(String(journey.year ?? 2023));
  const [board, setBoard] = useState(journey.board || 'CESGRANRIO');
  const [concurso, setConcurso] = useState(journey.organization || 'Petrobras');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setResultMsg('');
    setSubmitting(true);

    try {
      const res = await onImportDocument({
        docType,
        title: title.trim() || selectedFile?.name || `${DOC_TYPE_LABELS[docType]}`,
        file: selectedFile,
        filename: selectedFile?.name || 'texto_colado.txt',
        mimeType: selectedFile?.type || 'text/plain',
        rawTextInput,
        targetExamId:
          docType === 'gabarito_preliminar' || docType === 'gabarito_definitivo'
            ? targetExamId || null
            : null,
        examMeta: {
          year: Number(year) || null,
          board,
          concurso,
          roleEmphasis: journey.roleEmphasis,
        },
      });

      const parts: string[] = ['Documento salvo no banco JSON com rastreabilidade.'];
      if (res.extractedQuestionsCount > 0) {
        parts.push(
          `${res.extractedQuestionsCount} questão(ões) extraída(s) preservando o enunciado original.`
        );
      }
      if (res.appliedKeysCount > 0) {
        parts.push(`${res.appliedKeysCount} gabarito(s) aplicado(s).`);
      }
      if (res.divergencesCount > 0) {
        parts.push(
          `${res.divergencesCount} divergência(s) entre preliminar e definitivo registrada(s).`
        );
      }
      if (res.updatedEditalRules) {
        parts.push('Regras do edital atualizadas.');
      }
      if (res.needsManualReview) {
        parts.push(`Atenção: ${res.reviewNotes}`);
      }

      setResultMsg(parts.join(' '));
      setTitle('');
      setRawTextInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao importar documento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="app-surface p-5 sm:p-6 space-y-1.5">
        <div className="text-[13px] font-medium text-[var(--text-muted)]">
          Central de Documentos e Conteúdos · Hierarquia de Fontes Oficiais
        </div>
        <h1 className="font-bold text-[var(--text-primary)]">
          Importar Editais, Provas, Gabaritos e Apostilas
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] max-w-3xl">
          Aceita PDF, DOCX, XLSX, TXT e imagens diretamente no navegador. Enunciados oficiais não são alterados; arquivos escaneados ou incompletos são sinalizados para conferência manual.
        </p>
      </section>

      <form onSubmit={handleImport} className="app-surface p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
              Categoria do Documento
            </span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="form-select"
            >
              {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
              Título / Identificação
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Prova Petrobras Operação 2023 · Gabarito Definitivo"
              className="form-input"
            />
          </label>
        </div>

        {/* Zona de Drop / Seleção de Arquivo */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setSelectedFile(dropped);
          }}
          className={`border-2 border-dashed rounded-[var(--radius-md)] p-5 text-center transition-colors ${
            dragActive
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
              : 'border-[var(--border-control)] bg-[var(--bg-surface-subtle)]'
          }`}
        >
          <input
            ref={fileInputRef}
            id="doc-file-input"
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />

          {selectedFile ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                {selectedFile.name}
              </span>
              <span className="text-[12px] font-mono text-[var(--text-muted)]">
                ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-label="Remover arquivo selecionado"
                className="p-2 text-[var(--text-muted)] hover:text-[var(--color-danger)] rounded-[var(--radius-sm)]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-6 h-6 text-[var(--color-primary)] mx-auto" aria-hidden="true" />
              <div className="text-[14px] font-medium text-[var(--text-primary)]">
                Arraste um arquivo aqui ou{' '}
                <label
                  htmlFor="doc-file-input"
                  className="text-[var(--color-primary)] font-semibold underline cursor-pointer"
                >
                  selecione do computador
                </label>
              </div>
              <div className="text-[12px] text-[var(--text-muted)]">
                Formatos aceitos: PDF, DOCX, XLSX, TXT, MD, CSV e Imagens
              </div>
            </div>
          )}
        </div>

        {docType === 'prova_anterior' && (
          <div className="app-inset p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Concurso de Origem
              </span>
              <input
                value={concurso}
                onChange={(e) => setConcurso(e.target.value)}
                className="form-input"
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Banca
              </span>
              <input
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="form-input"
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
                Ano
              </span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="form-input font-mono"
              />
            </label>
          </div>
        )}

        {(docType === 'gabarito_preliminar' || docType === 'gabarito_definitivo') && (
          <label className="app-inset block space-y-1.5 p-4">
            <span className="block text-[13px] font-medium text-[var(--text-secondary)]">
              Prova Associada (para aplicar e detectar divergências entre preliminar e definitivo)
            </span>
            <select
              value={targetExamId}
              onChange={(e) => setTargetExamId(e.target.value)}
              className="form-select"
            >
              <option value="">Selecionar automaticamente por número da questão</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.questionCount} questões)
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
            Ou cole o texto diretamente (ex: enunciados, gabarito "01-B 02-C", texto do edital)
          </span>
          <textarea
            rows={5}
            value={rawTextInput}
            onChange={(e) => setRawTextInput(e.target.value)}
            placeholder="Cole aqui o texto do edital, questões ou gabarito caso não queira enviar arquivo..."
            className="form-textarea font-mono text-[13px]"
          />
        </label>

        <div className="flex justify-end">
          <button disabled={submitting} type="submit" className="btn-primary">
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Processando...' : 'Importar Documento'}</span>
          </button>
        </div>

        {resultMsg && (
          <div className="alert-box alert-success" role="status">
            {resultMsg}
          </div>
        )}
        {errorMsg && (
          <div className="alert-box alert-danger" role="alert">
            {errorMsg}
          </div>
        )}
      </form>

      <section className="app-surface overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Acervo Documental da Jornada ({documents.length})
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-6 text-[13px] text-[var(--text-muted)]">
            Nenhum documento oficial ou material próprio importado ainda. Comece enviando o Edital, Conteúdo Programático, Provas Anteriores e Gabaritos Definitivos.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText
                    className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                      {doc.title}
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      {DOC_TYPE_LABELS[doc.docType]} · Arquivo: {doc.sourceFilename} ·{' '}
                      <span className="font-mono">
                        {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {doc.needsManualReview && (
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-warning)] font-medium pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{doc.reviewNotes || 'Conferência manual recomendada.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
