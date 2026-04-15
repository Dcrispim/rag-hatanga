import LZString from 'lz-string';

/** Max length for the entire `param=value` segment (after `?`). */
export const MAX_SHARE_QUERY_LEN = 2000;

/** Aviso prefixado ao texto quando só cabe versão truncada na URL. */
export const WARNING =
  '--- ⚠️ Texto truncado para compartilhamento ---\n\n';

export function smartCut(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  const slice = text.slice(0, maxLength);
  const lastBreak = Math.max(
    slice.lastIndexOf('\n'),
    slice.lastIndexOf(' '),
  );
  return lastBreak > 0 ? slice.slice(0, lastBreak) : slice;
}

/**
 * Segmento `nomeParam=valor` (valor já no formato da barra de endereço),
 * respeitando {@link MAX_SHARE_QUERY_LEN} para o par completo.
 */
export function buildPromptQueryPair(text: string, paramKey: string): string {
  const encoded = encodeURIComponent(text);
  const plain = `${paramKey}=${encoded}`;
  if (plain.length < MAX_SHARE_QUERY_LEN) {
    return plain;
  }

  const compressed = LZString.compressToEncodedURIComponent(text);
  const lz = `${paramKey}=lz:${compressed}`;
  if (lz.length < MAX_SHARE_QUERY_LEN) {
    return lz;
  }

  let lo = 0;
  let hi = text.length;
  let best = `${paramKey}=tr:${encodeURIComponent(WARNING)}`;

  while (lo <= hi) {
    const mid = (lo + hi + 1) >> 1;
    const cut = smartCut(text, mid);
    const pair = `${paramKey}=tr:${encodeURIComponent(WARNING + cut)}`;
    if (pair.length < MAX_SHARE_QUERY_LEN) {
      best = pair;
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

/** Compartilhamento manual: parâmetro curto `q`. */
export function generateShareQuery(text: string): string {
  return buildPromptQueryPair(text, 'q');
}

export function parseQuery(value: string): string {
  try {
    if (value.startsWith('lz:')) {
      const d = LZString.decompressFromEncodedURIComponent(value.slice(3));
      return d ?? value;
    }
    if (value.startsWith('tr:')) {
      return decodeURIComponent(value.slice(3));
    }
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Aplica `key=...` ao `URLSearchParams` (valor lógico para `.set`). */
export function applyPromptQueryPairToParams(
  params: URLSearchParams,
  pair: string,
): void {
  const idx = pair.indexOf('=');
  if (idx === -1) return;
  const key = pair.slice(0, idx);
  const encValue = pair.slice(idx + 1);
  params.set(key, decodeURIComponent(encValue));
}

/**
 * Texto inicial: `q` primeiro; senão `prompt_question` (mesmo formato lz/tr/plain).
 */
export function getInitialPromptTextFromSearch(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) return parseQuery(q);
  const legacy = params.get('prompt_question');
  if (legacy) return parseQuery(legacy);
  return '';
}
