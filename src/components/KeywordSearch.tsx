// src/components/KeywordSearch.tsx
import React, { useRef, useState } from 'react';
import { formatBookRow } from '../utils/bookCopy';
import { BookInfo, BookSource, searchBooksByKeyword } from '../utils/booksApi';

interface KeywordSearchProps {
  setIsbns: React.Dispatch<React.SetStateAction<string>>;
}

function KeywordSearch({ setIsbns }: KeywordSearchProps) {
  const [keyword, setKeyword] = useState<string>('');
  const [suggestions, setSuggestions] = useState<BookInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<BookSource>('google');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(0);

  async function searchKeyword(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!keyword.trim()) {
      setError('キーワードを入力してください。');
      return;
    }

    // 古いリクエストの結果で新しい結果を上書きしないようにする
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await searchBooksByKeyword(keyword.trim());
      if (requestId !== requestIdRef.current) return;
      setSuggestions(result.books);
      setSource(result.source);
      if (result.books.length === 0) {
        setError('本が見つかりませんでした。');
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setError(`検索に失敗しました。しばらくしてからもう一度お試しください。(${message})`);
      console.error('Error:', error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function handleSetIsbn(isbn: string) {
    setIsbns(prevIsbns => {
      if (prevIsbns) {
        return `${prevIsbns} ${isbn}`;
      } else {
        return isbn;
      }
    });
  }

  function copyBookInfo(suggestion: BookInfo, index: number) {
    const copyText = formatBookRow(suggestion.title, suggestion.authors, suggestion.publisher, suggestion.isbn13);
    navigator.clipboard.writeText(copyText).then(() => {
      setCopiedIndex(index);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedIndex(null), 1500);
    }, (err) => {
      console.error('コピーに失敗しました: ', err);
      setError('クリップボードへのコピーに失敗しました。');
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <form onSubmit={searchKeyword} className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 flex-none">
        <div className="mb-6">
          <label htmlFor="keyword" className="block text-gray-700 font-semibold text-lg mb-2">キーワード検索:</label>
          <input
            type="text"
            id="keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例: プログラミング, デザイン"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center justify-center"
        >
          🔍 キーワードで検索
        </button>
      </form>

      {loading && (
        <div className="flex justify-center mt-4 flex-none">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
        </div>
      )}

      {error && <p className="text-red-500 text-center mt-4 text-lg flex-none">{error}</p>}

      {!loading && source === 'ndl' && suggestions.length > 0 && (
        <p className="text-amber-700 bg-amber-100 rounded-lg max-w-3xl mx-auto px-4 py-2 text-center mt-4 flex-none">
          ⚠ Google Books APIが利用できないため、国立国会図書館サーチの結果（出版年の新しい順）を表示しています。
        </p>
      )}

      <div className="mt-4 flex-1 overflow-y-auto">
        {suggestions.length > 0 && (
          <div className="mt-4">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex flex-col md:flex-row">
                  <div className="w-32 h-48 mb-4 md:mb-0 md:mr-6 flex-shrink-0">
                    {suggestion.coverImage ? (
                      <img
                        src={suggestion.coverImage}
                        alt="書籍の表紙"
                        className="w-full h-full object-contain rounded-lg shadow"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-lg">
                        <span className="text-gray-500">表紙画像なし</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-orange-700 mb-2">{suggestion.title}</h2>
                    <p className="text-gray-700 mb-1 text-lg"><strong>著者:</strong> {suggestion.authors}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>出版社:</strong> {suggestion.publisher}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-13:</strong> {suggestion.isbn13}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-10:</strong> {suggestion.isbn10}</p>
                    <div className="mt-4 flex items-center space-x-4">
                      {suggestion.amazonLink !== '#' ? (
                        <a
                          href={suggestion.amazonLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline text-lg"
                        >
                          Amazonで見る
                        </a>
                      ) : (
                        <a
                          href={"https://www.amazon.co.jp/s?k=" + suggestion.title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline text-lg"
                        >
                          Amazonで検索
                        </a>
                      )}
                      <button
                        onClick={() => handleSetIsbn(suggestion.isbn13.replace(/-/g, ''))}
                        className={`bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center ${suggestion.isbn13 === '不明' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={suggestion.isbn13 === '不明'}
                      >
                        ➕ ISBN検索にセット
                      </button>
                      <button
                        onClick={() => copyBookInfo(suggestion, index)}
                        className={`${copiedIndex === index ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-semibold py-2 px-4 rounded-lg transition duration-300`}
                      >
                        {copiedIndex === index ? '✓ コピーしました' : '📋 書籍情報をコピー'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default KeywordSearch;
