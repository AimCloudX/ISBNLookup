import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// booksApiはモジュールレベルのキャッシュとサーキットブレーカーを持つため、テストごとに再importする
let api: typeof import('./booksApi');
let fetchMock: Mock;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function xmlResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new Error('not json'); },
    text: async () => body,
  };
}

function googleCalls(): number {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('googleapis.com')).length;
}

const googleVolume = {
  volumeInfo: {
    title: 'リーダブルコード',
    authors: ['Dustin Boswell', 'Trevor Foucher'],
    publisher: 'オライリー・ジャパン',
    industryIdentifiers: [
      { type: 'ISBN_13', identifier: '9784873115658' },
      { type: 'ISBN_10', identifier: '4873115655' },
    ],
    imageLinks: { thumbnail: 'http://example.com/cover.jpg' },
    description: 'コードの読みやすさについての本',
  },
};

const openBdRecord = [{
  summary: {
    isbn: '9784873115658',
    title: 'リーダブルコード',
    author: 'ボズウェル，ダスティン／著',
    publisher: 'オライリー・ジャパン',
    cover: 'https://cover.openbd.jp/9784873115658.jpg',
  },
  onix: {
    CollateralDetail: {
      TextContent: [{ Text: 'openBDの説明文' }],
    },
  },
}];

const ndlXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0">
  <channel>
    <title>検索結果</title>
    <item>
      <title>リーダブルコード : より良いコードを書くためのテクニック</title>
      <dc:title>リーダブルコード</dc:title>
      <dc:creator>Boswell, Dustin</dc:creator>
      <dc:creator>角, 征典</dc:creator>
      <dc:publisher>オライリー・ジャパン</dc:publisher>
      <dcterms:issued>2012.6</dcterms:issued>
      <dc:identifier xsi:type="dcndl:ISBN">978-4-87311-565-8</dc:identifier>
    </item>
    <item>
      <dc:title>もっと新しい本</dc:title>
      <dc:creator>著者 太郎</dc:creator>
      <dc:publisher>新しい出版社</dc:publisher>
      <dcterms:issued>2020.2</dcterms:issued>
      <dc:identifier xsi:type="dcndl:ISBN">978-4-7710-2651-3</dc:identifier>
    </item>
    <item>
      <dc:title>リーダブルコード</dc:title>
      <dc:creator>Boswell, Dustin</dc:creator>
      <dcterms:issued>2012.6</dcterms:issued>
      <dc:identifier xsi:type="dcndl:ISBN">978-4-87311-565-8</dc:identifier>
    </item>
    <item>
      <dc:title>ISBNの無い論文レコード</dc:title>
      <dc:creator>誰か</dc:creator>
    </item>
  </channel>
</rss>`;

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  api = await import('./booksApi');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchBookByIsbn', () => {
  it('Google Books APIの結果をBookInfoにマッピングする', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));

    const book = await api.fetchBookByIsbn('9784873115658');

    expect(book).not.toBeNull();
    expect(book!.title).toBe('リーダブルコード');
    expect(book!.authors).toBe('Dustin Boswell, Trevor Foucher');
    expect(book!.isbn13).toBe('978-4873115658');
    expect(book!.isbn10).toBe('4873115655');
    expect(book!.amazonLink).toBe('https://www.amazon.co.jp/dp/4873115655');
  });

  it('同じISBNの2回目はキャッシュを使いfetchしない', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));

    await api.fetchBookByIsbn('9784873115658');
    await api.fetchBookByIsbn('9784873115658');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('「見つからなかった」もキャッシュして再問い合わせしない', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))   // Google: 0件
      .mockResolvedValueOnce(jsonResponse([{}])); // openBD: summaryなし

    expect(await api.fetchBookByIsbn('9999999999999')).toBeNull();
    expect(await api.fetchBookByIsbn('9999999999999')).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Googleが429のときopenBDにフォールバックする', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({}, 429);
      if (url.includes('api.openbd.jp')) return jsonResponse(openBdRecord);
      throw new Error(`unexpected url: ${url}`);
    });

    const book = await api.fetchBookByIsbn('9784873115658');

    expect(book).not.toBeNull();
    expect(book!.title).toBe('リーダブルコード');
    expect(book!.authors).toBe('ボズウェル，ダスティン／著');
    expect(book!.isbn10).toBe('4873115655'); // ISBN-13から計算される
    expect(book!.description).toBe('openBDの説明文');
    expect(book!.amazonLink).toBe('https://www.amazon.co.jp/dp/4873115655');
  });

  it('Googleが0件でもopenBDにフォールバックする', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({});
      return jsonResponse(openBdRecord);
    });

    const book = await api.fetchBookByIsbn('9784873115658');
    expect(book!.title).toBe('リーダブルコード');
  });

  it('Googleが失敗しopenBDでも見つからないときはエラーになり、キャッシュせずリトライできる', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({}, 429);
      return jsonResponse([{}]);
    });

    await expect(api.fetchBookByIsbn('9784873115658')).rejects.toThrow('HTTP 429');

    // 復旧後は再問い合わせできる（「見つからなかった」としてキャッシュされていない）
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));
    const book = await api.fetchBookByIsbn('9784873115658');
    expect(book!.title).toBe('リーダブルコード');
  });
});

describe('searchBooksByKeyword', () => {
  it('Google Books APIの結果をマッピングし、2回目はキャッシュを使う', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));

    const first = await api.searchBooksByKeyword('リーダブルコード');
    const second = await api.searchBooksByKeyword('リーダブルコード');

    expect(first.source).toBe('google');
    expect(first.books).toHaveLength(1);
    expect(first.books[0].title).toBe('リーダブルコード');
    expect(second.books).toBe(first.books);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('キーワード検索の結果がISBNキャッシュに載り、fetchBookByIsbnがAPIを呼ばない', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));

    await api.searchBooksByKeyword('リーダブルコード');
    const book = await api.fetchBookByIsbn('9784873115658');

    expect(book!.title).toBe('リーダブルコード');
    expect(fetchMock).toHaveBeenCalledTimes(1); // キーワード検索の1回だけ
  });

  it('Googleが429のときNDLサーチにフォールバックし、出版年の新しい順で返す', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({}, 429);
      if (url.includes('ndlsearch.ndl.go.jp')) return xmlResponse(ndlXml);
      throw new Error(`unexpected url: ${url}`);
    });

    const { books, source } = await api.searchBooksByKeyword('リーダブルコード');

    expect(source).toBe('ndl');
    // 同一ISBNの重複レコードとISBN無しレコードは除外され、新しい順に並ぶ
    expect(books.map(b => b.title)).toEqual(['もっと新しい本', 'リーダブルコード']);
    expect(books[1].authors).toBe('Boswell, Dustin／角, 征典');
    expect(books[1].publisher).toBe('オライリー・ジャパン');
    expect(books[1].isbn13).toBe('978-4873115658');
    expect(books[1].isbn10).toBe('4873115655');
    expect(books[1].coverImage).toBe('https://ndlsearch.ndl.go.jp/thumbnail/9784873115658.jpg');
    expect(books[1].amazonLink).toBe('https://www.amazon.co.jp/dp/4873115655');
  });

  it('GoogleもNDLも失敗したときはGoogleのエラーを投げる', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({}, 429);
      return xmlResponse('error', 500);
    });

    await expect(api.searchBooksByKeyword('リーダブルコード')).rejects.toThrow('HTTP 429');
  });

  it('Googleが正常に0件のときはNDLも探し、それでも無ければ空配列を返す', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({});
      return xmlResponse('<rss version="2.0"><channel><title>0件</title></channel></rss>');
    });

    const { books } = await api.searchBooksByKeyword('存在しない本xyz');
    expect(books).toEqual([]);
  });
});

describe('Googleクォータ超過時の一時停止', () => {
  function quotaThenFallback() {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com')) return jsonResponse({}, 429);
      if (url.includes('ndlsearch.ndl.go.jp')) return xmlResponse(ndlXml);
      if (url.includes('api.openbd.jp')) return jsonResponse(openBdRecord);
      throw new Error(`unexpected url: ${url}`);
    });
  }

  it('429の後はGoogleを呼ばず、直接フォールバックへ行く', async () => {
    quotaThenFallback();

    await api.searchBooksByKeyword('リーダブルコード'); // ここで429を記録
    await api.searchBooksByKeyword('別のキーワード');
    await api.fetchBookByIsbn('9784111111111'); // ISBN検索でもスキップされる

    expect(googleCalls()).toBe(1);
  });

  it('スキップ期間が過ぎたらGoogleを再試行する', async () => {
    vi.useFakeTimers();
    quotaThenFallback();
    await api.searchBooksByKeyword('リーダブルコード');
    expect(googleCalls()).toBe(1);

    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));
    const result = await api.searchBooksByKeyword('別のキーワード');

    expect(result.source).toBe('google');
    expect(googleCalls()).toBe(2);
  });

  it('フォールバック中のキーワード結果はGoogle復旧後に取り直す', async () => {
    vi.useFakeTimers();
    quotaThenFallback();
    const fallback = await api.searchBooksByKeyword('リーダブルコード');
    expect(fallback.source).toBe('ndl');

    // 停止期間中は同じキーワードでもフォールバック結果のキャッシュを使う
    const during = await api.searchBooksByKeyword('リーダブルコード');
    expect(during.source).toBe('ndl');
    expect(googleCalls()).toBe(1);

    // 復旧後は同じキーワードでもGoogleから取り直す
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    fetchMock.mockResolvedValue(jsonResponse({ items: [googleVolume] }));
    const recovered = await api.searchBooksByKeyword('リーダブルコード');
    expect(recovered.source).toBe('google');
    expect(recovered.books[0].description).toBe('コードの読みやすさについての本');
  });
});
