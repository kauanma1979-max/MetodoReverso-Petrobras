import mammoth from 'mammoth/mammoth.browser.js';
import * as XLSX from 'xlsx';
import { extractText } from 'unpdf';

export interface ExtractedDocumentContent {
  rawText: string;
  pageCount: number | null;
  needsManualReview: boolean;
  reviewNotes: string;
  isBinaryMedia: boolean;
}

export async function extractTextFromBrowserFile(file: File): Promise<ExtractedDocumentContent> {
  const lower = file.name.toLowerCase();
  const mimeType = file.type || '';

  try {
    if (
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      lower.endsWith('.csv') ||
      mimeType.startsWith('text/')
    ) {
      const text = (await file.text()).trim();
      return {
        rawText: text,
        pageCount: null,
        needsManualReview: text.length < 20,
        reviewNotes: text.length < 20 ? 'Arquivo de texto muito curto ou vazio.' : '',
        isBinaryMedia: false,
      };
    }

    const arrayBuffer = await file.arrayBuffer();

    if (lower.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      const res = await mammoth.extractRawText({ arrayBuffer });
      const text = (res.value || '').trim();
      return {
        rawText: text,
        pageCount: null,
        needsManualReview: text.length < 30,
        reviewNotes:
          text.length < 30
            ? 'Pouco texto extraído do DOCX; verifique se o conteúdo está em imagens incorporadas.'
            : '',
        isBinaryMedia: false,
      };
    }

    if (
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      mimeType.includes('spreadsheetml')
    ) {
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheets: string[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws);
        sheets.push(`--- PLANILHA: ${name} ---\n${csv}`);
      }
      const text = sheets.join('\n\n').trim();
      return {
        rawText: text,
        pageCount: wb.SheetNames.length,
        needsManualReview: text.length < 15,
        reviewNotes: '',
        isBinaryMedia: false,
      };
    }

    if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
      const uint8 = new Uint8Array(arrayBuffer);
      const { text, totalPages } = await extractText(uint8, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join('\n') : String(text || '')).trim();
      const scanned = clean.length < 60;
      return {
        rawText: clean,
        pageCount: typeof totalPages === 'number' ? totalPages : null,
        needsManualReview: scanned,
        reviewNotes: scanned
          ? 'PDF com pouco ou nenhum texto selecionável (possível arquivo escaneado). Revise manualmente ou cole o texto das questões.'
          : '',
        isBinaryMedia: scanned,
      };
    }

    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower)) {
      return {
        rawText: '',
        pageCount: 1,
        needsManualReview: true,
        reviewNotes:
          'Arquivo de imagem enviado. Cole ou revise os enunciados manualmente se necessário.',
        isBinaryMedia: true,
      };
    }

    const fallbackText = new TextDecoder().decode(arrayBuffer).trim();
    return {
      rawText: fallbackText,
      pageCount: null,
      needsManualReview: true,
      reviewNotes: 'Formato não reconhecido nativamente; conferência manual recomendada.',
      isBinaryMedia: false,
    };
  } catch (err: any) {
    return {
      rawText: '',
      pageCount: null,
      needsManualReview: true,
      reviewNotes: `Falha na leitura automática do arquivo (${err?.message || 'erro desconhecido'}). Revise manualmente.`,
      isBinaryMedia: true,
    };
  }
}
