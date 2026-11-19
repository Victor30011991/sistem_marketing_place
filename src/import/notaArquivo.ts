import { decodeText } from './text';
import { lerNFeXml, lerTextoNota, type ResultadoNota } from '../core/nota';

export const EXTENSOES_NOTA = ['pdf', 'xml'];

const extensao = (nome: string) => nome.split('.').pop()?.toLowerCase() ?? '';

/**
 * Lê uma nota de compra de um arquivo: PDF (DANFE com texto), XML da NF-e ou texto copiado da nota.
 * Devolve null quando o arquivo claramente não é uma nota (ex.: um .txt qualquer).
 */
export async function notaDoArquivo(file: File): Promise<ResultadoNota | null> {
  const ext = extensao(file.name);
  const buf = await file.arrayBuffer();
  if (ext === 'pdf') {
    let texto = '';
    try {
      const { textoDoPdf } = await import('./pdfTexto');
      texto = await textoDoPdf(buf);
    } catch {
      return { ok: false, motivo: 'Não foi possível abrir este PDF. Ele pode estar protegido ou danificado. Tente o XML da nota.' };
    }
    if (!texto.trim()) return { ok: false, motivo: 'Este PDF não tem texto (parece uma foto ou nota escaneada). Use o XML da nota ou digite os itens.' };
    const r = lerTextoNota(texto);
    return r.ok ? r : { ok: false, motivo: 'Não reconheci os itens da nota neste PDF. Use o XML da nota ou cole o texto.' };
  }
  const texto = decodeText(buf);
  if (ext === 'xml') return lerNFeXml(texto);
  if (ext === 'txt' && /DANFE|NF-e|NOTA FISCAL/i.test(texto)) return lerTextoNota(texto);
  return null;
}

/** O arquivo parece um backup .txt do próprio sistema? */
export async function pareceBackup(file: File): Promise<string | null> {
  if (extensao(file.name) !== 'txt') return null;
  const t = await file.text();
  return t.includes('temperei-backup') ? t : null;
}
