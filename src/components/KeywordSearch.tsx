// src/components/KeywordSearch.tsx
import React, { useState } from 'react';

interface Suggestion {
  title: string;
  authors: string;
  publisher: string;
  isbn13: string;
  isbn10: string;
  coverImage: string | null;
  amazonLink: string;
}

interface KeywordSearchProps {
  setIsbns: React.Dispatch<React.SetStateAction<string>>;
}

function KeywordSearch({ setIsbns }: KeywordSearchProps) {
  const [keyword, setKeyword] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function formatISBN13(isbn: string): string {
    if (isbn.length !== 13) return isbn;
    return `${isbn.slice(0, 3)}-${isbn.slice(3)}`;
  }

  function generateAmazonLink(isbn10: string): string {
    const cleanIsbn = isbn10.replace(/-/g, '');
    return `https://www.amazon.co.jp/dp/${cleanIsbn}`;
  }

  async function searchKeyword(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!keyword.trim()) {
      setError('キーワードを入力してください。');
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const results = data.items.map((item: any) => {
          const book = item.volumeInfo;
          const industryIdentifiers = book.industryIdentifiers || [];
          const isbn13 = industryIdentifiers.find((id: any) => id.type === 'ISBN_13')?.identifier || '不明';
          const isbn10 = industryIdentifiers.find((id: any) => id.type === 'ISBN_10')?.identifier || '不明';
          const formattedISBN13 = formatISBN13(isbn13);

          const suggestion: Suggestion = {
            title: book.title || '不明',
            authors: book.authors ? book.authors.join(', ') : '不明',
            publisher: book.publisher || '不明',
            isbn13: formattedISBN13,
            isbn10: isbn10,
            coverImage: book.imageLinks?.thumbnail || null,
            amazonLink: isbn10 !== '不明' ? generateAmazonLink(isbn10) : '#',
          };

          return suggestion;
        });

        setSuggestions(results);
      } else {
        setError('本が見つかりませんでした。');
      }
    } catch (error: any) {
      setError('エラーが発生しました。もう一度お試しください。');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSetIsbn(isbn: string) {
    setIsbns(prevIsbns => {
      if (prevIsbns) {
        return `${prevIsbns},${isbn}`;
      } else {
        return isbn;
      }
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
                        <span className="text-gray-500 text-lg">Amazonで見る（ISBN不明）</span>
                      )}
                      <button
                        onClick={() => handleSetIsbn(suggestion.isbn13.replace(/-/g, ''))}
                        className={`bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center ${suggestion.isbn13 === '不明' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={suggestion.isbn13 === '不明'}
                      >
                        ➕ ISBN検索にセット
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
