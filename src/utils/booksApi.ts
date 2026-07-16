// src/utils/booksApi.ts
export interface BookInfo {
  title: string;
  authors: string;
  publisher: string;
  isbn13: string;
  isbn10: string;
  coverImage: string | null;
  description: string;
  amazonLink: string;
}

export type BookSource = 'google' | 'ndl';

export interface KeywordSearchResult {
  books: BookInfo[];
  source: BookSource;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const GOOGLE_API_BASE = 'https://www.googleapis.com/books/v1/volumes';
// 使う項目だけ取得してレスポンスサイズを抑える
const GOOGLE_FIELDS = 'items(volumeInfo(title,authors,publisher,industryIdentifiers,imageLinks/thumbnail,description))';
// キー無しだと接続元IP共有のクォータ(上限0のことがある)になる。
// 自分のAPIキーを .env の VITE_GOOGLE_BOOKS_API_KEY に設定すると確実になる
const GOOGLE_API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;

const DC_NS = 'http://purl.org/dc/elements/1.1/';
const DCTERMS_NS = 'http://purl.org/dc/terms/';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

// ---------- Googleクォータ超過時の一時停止 ----------
// 429/403を受けたら一定時間Googleを呼ばず、失敗を待たずに即フォールバックへ行く

const GOOGLE_SKIP_MS = 10 * 60 * 1000;
let googleDisabledUntil = 0;

function googleAvailable(): boolean {
  return Date.now() >= googleDisabledUntil;
}

function noteGoogleError(error: unknown) {
  if (error instanceof ApiError && (error.status === 429 || error.status === 403)) {
    googleDisabledUntil = Date.now() + GOOGLE_SKIP_MS;
  }
}

function googleSkippedError(): ApiError {
  return new ApiError('Google Books APIエラー (クォータ超過のため一時停止中)', 429);
}

// ---------- ISBNユーティリティ ----------

function formatISBN13(isbn: string): string {
  if (isbn.length !== 13) return isbn;
  return `${isbn.slice(0, 3)}-${isbn.slice(3)}`;
}

function generateAmazonLink(isbn10: string): string {
  return `https://www.amazon.co.jp/dp/${isbn10.replace(/-/g, '')}`;
}

function isbn13To10(isbn13: string): string | null {
  const clean = isbn13.replace(/-/g, '');
  if (clean.length !== 13 || !clean.startsWith('978')) return null;
  const core = clean.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

function isbn10To13(isbn10: string): string | null {
  const clean = isbn10.replace(/-/g, '');
  if (clean.length !== 10) return null;
  const core = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return core + String((10 - (sum % 10)) % 10);
}

// ---------- Google Books API ----------

function googleUrl(query: string): string {
  const key = GOOGLE_API_KEY ? `&key=${encodeURIComponent(GOOGLE_API_KEY)}` : '';
  return `${GOOGLE_API_BASE}?${query}&fields=${encodeURIComponent(GOOGLE_FIELDS)}${key}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGoogleVolume(item: any): BookInfo {
  const book = item.volumeInfo || {};
  const industryIdentifiers = book.industryIdentifiers || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isbn13 = industryIdentifiers.find((id: any) => id.type === 'ISBN_13')?.identifier || '不明';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isbn10 = industryIdentifiers.find((id: any) => id.type === 'ISBN_10')?.identifier || '不明';

  return {
    title: book.title || '不明',
    authors: book.authors ? book.authors.join(', ') : '不明',
    publisher: book.publisher || '不明',
    isbn13: formatISBN13(isbn13),
    isbn10: isbn10,
    coverImage: book.imageLinks?.thumbnail || null,
    description: book.description || '説明なし',
    amazonLink: isbn10 !== '不明' ? generateAmazonLink(isbn10) : '#',
  };
}

async function searchGoogleByKeyword(keyword: string): Promise<BookInfo[]> {
  const response = await fetch(googleUrl(`q=${encodeURIComponent(keyword)}&maxResults=20`));
  if (!response.ok) throw new ApiError(`Google Books APIエラー (HTTP ${response.status})`, response.status);
  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items || []).map((item: any) => mapGoogleVolume(item));
}

async function fetchGoogleByIsbn(isbn: string): Promise<BookInfo | null> {
  const response = await fetch(googleUrl(`q=isbn:${isbn}`));
  if (!response.ok) throw new ApiError(`Google Books APIエラー (HTTP ${response.status})`, response.status);
  const data = await response.json();
  return data.items && data.items.length > 0 ? mapGoogleVolume(data.items[0]) : null;
}

// ---------- フォールバック: 国立国会図書館サーチ (キーワード検索) ----------
// APIキー不要・クォータ制限なし。ただし結果はタイトル五十音順なので、
// 出版年の新しい順に並べ直して返す

function parseIssued(item: Element): number {
  const text = item.getElementsByTagNameNS(DCTERMS_NS, 'issued')[0]?.textContent || '';
  const m = text.match(/(\d{4})(?:\.(\d{1,2}))?/);
  return m ? Number(m[1]) * 100 + Number(m[2] || '0') : 0;
}

async function searchNdlByKeyword(keyword: string): Promise<BookInfo[]> {
  const url = `https://ndlsearch.ndl.go.jp/api/opensearch?title=${encodeURIComponent(keyword)}&cnt=20`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NDLサーチAPIエラー (HTTP ${response.status})`);
  const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');

  const entries: { book: BookInfo; issued: number }[] = [];
  const seen = new Set<string>();
  for (const item of Array.from(xml.getElementsByTagName('item'))) {
    const identifiers = Array.from(item.getElementsByTagNameNS(DC_NS, 'identifier'));
    const isbnRaw = identifiers
      .find(el => (el.getAttributeNS(XSI_NS, 'type') || '').includes('ISBN'))
      ?.textContent?.replace(/-/g, '') || '';
    const isbn13 = isbnRaw.length === 13 ? isbnRaw : isbn10To13(isbnRaw);
    // ISBNの無い資料や同じ本の重複レコードは除外
    if (!isbn13 || seen.has(isbn13)) continue;
    seen.add(isbn13);

    const isbn10 = isbnRaw.length === 10 ? isbnRaw : (isbn13To10(isbn13) || '不明');
    entries.push({
      issued: parseIssued(item),
      book: {
        title: item.getElementsByTagNameNS(DC_NS, 'title')[0]?.textContent
          || item.getElementsByTagName('title')[0]?.textContent || '不明',
        // NDLの著者名は「姓, 名」形式のため、人の区切りには「／」を使う
        authors: Array.from(item.getElementsByTagNameNS(DC_NS, 'creator'))
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .join('／') || '不明',
        publisher: item.getElementsByTagNameNS(DC_NS, 'publisher')[0]?.textContent || '不明',
        isbn13: formatISBN13(isbn13),
        isbn10,
        coverImage: `https://ndlsearch.ndl.go.jp/thumbnail/${isbn13}.jpg`,
        description: '説明なし',
        amazonLink: isbn10 !== '不明' ? generateAmazonLink(isbn10) : '#',
      },
    });
  }

  entries.sort((a, b) => b.issued - a.issued);
  return entries.map(entry => entry.book);
}

// ---------- フォールバック: openBD (ISBN検索) ----------
// APIキー不要・クォータ制限なし。日本の書誌情報を取得できる

async function fetchOpenBdByIsbn(isbn: string): Promise<BookInfo | null> {
  const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`);
  if (!response.ok) throw new Error(`openBD APIエラー (HTTP ${response.status})`);
  const data = await response.json();
  const record = data?.[0];
  if (!record?.summary) return null;

  const summary = record.summary;
  const cleanIsbn13 = (summary.isbn || '').replace(/-/g, '');
  const isbn10 = isbn13To10(cleanIsbn13) || '不明';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textContents = record.onix?.CollateralDetail?.TextContent as any[] | undefined;
  const description = textContents?.find(t => t.Text)?.Text || '説明なし';

  return {
    title: summary.title || '不明',
    authors: summary.author || '不明',
    publisher: summary.publisher || '不明',
    isbn13: formatISBN13(cleanIsbn13),
    isbn10,
    coverImage: summary.cover || null,
    description,
    amazonLink: isbn10 !== '不明' ? generateAmazonLink(isbn10) : '#',
  };
}

// ---------- キャッシュ付きの公開API ----------

// セッション中のインメモリキャッシュ。isbnCacheはnull（=見つからなかった）もキャッシュする
const isbnCache = new Map<string, BookInfo | null>();

interface KeywordCacheEntry {
  result: KeywordSearchResult;
  // Googleが正常なときの結果か。フォールバック中の結果はGoogle復旧後に取り直す
  googleHealthy: boolean;
}
const keywordCache = new Map<string, KeywordCacheEntry>();

function seedIsbnCache(book: BookInfo) {
  const cleanIsbn13 = book.isbn13.replace(/-/g, '');
  if (cleanIsbn13 !== '不明') isbnCache.set(cleanIsbn13, book);
  if (book.isbn10 !== '不明') isbnCache.set(book.isbn10, book);
}

export async function searchBooksByKeyword(keyword: string): Promise<KeywordSearchResult> {
  const cached = keywordCache.get(keyword);
  if (cached && (cached.googleHealthy || !googleAvailable())) return cached.result;

  let books: BookInfo[] = [];
  let usedNdl = false;
  let googleError: unknown = null;

  if (googleAvailable()) {
    try {
      books = await searchGoogleByKeyword(keyword);
    } catch (error) {
      googleError = error;
      noteGoogleError(error);
      console.warn('Google Books APIに失敗したためNDLサーチにフォールバックします:', error);
    }
  } else {
    googleError = googleSkippedError();
  }

  // Googleが失敗した場合と、正常でも0件だった場合はNDLサーチでも探す
  if (books.length === 0) {
    try {
      books = await searchNdlByKeyword(keyword);
      usedNdl = true;
    } catch (error) {
      if (googleError) throw googleError;
      console.warn('NDLサーチにも失敗しました:', error);
    }
  }

  const result: KeywordSearchResult = {
    books,
    source: usedNdl && books.length > 0 ? 'ndl' : 'google',
  };
  keywordCache.set(keyword, { result, googleHealthy: googleError === null });
  // キーワード検索で取得済みの本はISBN検索でもAPIを呼ばずに使えるようにする
  books.forEach(seedIsbnCache);
  return result;
}

export async function fetchBookByIsbn(isbn: string): Promise<BookInfo | null> {
  const cached = isbnCache.get(isbn);
  if (cached !== undefined) return cached;

  let book: BookInfo | null = null;
  let googleError: unknown = null;

  if (googleAvailable()) {
    try {
      book = await fetchGoogleByIsbn(isbn);
    } catch (error) {
      googleError = error;
      noteGoogleError(error);
      console.warn('Google Books APIに失敗したためopenBDにフォールバックします:', error);
    }
  } else {
    googleError = googleSkippedError();
  }

  if (!book) {
    try {
      book = await fetchOpenBdByIsbn(isbn);
    } catch (error) {
      if (googleError) throw googleError;
      console.warn('openBDにも失敗しました:', error);
    }
  }

  // Googleが使えずフォールバックでも見つからなかった場合は、
  // 「見つからなかった」とはキャッシュせずリトライ可能にしておく
  if (!book && googleError) throw googleError;

  isbnCache.set(isbn, book);
  if (book) seedIsbnCache(book);
  return book;
}
