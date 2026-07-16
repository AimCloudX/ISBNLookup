import React, { useState, useEffect, useRef } from 'react';
import { formatBookRow } from '../utils/bookCopy';
import { BookInfo, fetchBookByIsbn } from '../utils/booksApi';

interface ISBNSearchProps {
  isbns: string;
  setIsbns: React.Dispatch<React.SetStateAction<string>>;
}

function ISBNSearch({ isbns, setIsbns }: ISBNSearchProps) {
  const [bookDataList, setBookDataList] = useState<BookInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const copyTimerRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isbns.trim()) {
      requestIdRef.current++;
      setBookDataList([]);
      setErrorMessages([]);
      setLoading(false);
      return;
    }
    // 入力中に1文字ごとへ問い合わせないよう、少し待ってから検索する
    const timer = window.setTimeout(() => searchBooks(), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isbns]);

  async function searchBooks(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const isbnArray = [...new Set(
      isbns.split(' ').map(isbn => isbn.trim().replace(/-/g, '')).filter(isbn => isbn !== '')
    )];
    if (isbnArray.length === 0) return;

    // 古いリクエストの結果で新しい結果を上書きしないようにする
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const settled = await Promise.all(isbnArray.map(async isbn => {
      try {
        return { isbn, book: await fetchBookByIsbn(isbn) };
      } catch (error) {
        console.error(`ISBN ${isbn} の取得に失敗しました:`, error);
        return { isbn, book: null };
      }
    }));

    if (requestId !== requestIdRef.current) return;

    const results: BookInfo[] = [];
    const notFound: string[] = [];
    for (const { isbn, book } of settled) {
      if (book) {
        results.push(book);
      } else {
        notFound.push(isbn);
      }
    }

    setErrorMessages(notFound);
    setBookDataList(results);
    setLoading(false);
  }

  function copyAllBookInfo() {
    if (bookDataList.length === 0) return;

    const copyText = bookDataList.map(bookData =>
      formatBookRow(bookData.title, bookData.authors, bookData.publisher, bookData.isbn13)
    ).join('\n');

    navigator.clipboard.writeText(copyText).then(() => {
      setCopiedAll(true);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedAll(false), 1500);
    }, (err) => {
      console.error('コピーに失敗しました: ', err);
    });
  }

  function copyBookInfo(bookData: BookInfo, index: number) {
    const copyText = formatBookRow(bookData.title, bookData.authors, bookData.publisher, bookData.isbn13);
    navigator.clipboard.writeText(copyText).then(() => {
      setCopiedIndex(index);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedIndex(null), 1500);
    }, (err) => {
      console.error('コピーに失敗しました: ', err);
    });
  }

  function removeIsbn(isbn13: string) {
    const cleanIsbn = isbn13.replace(/-/g, '');
    const isbnArray = isbns.split(' ').map(isbn => isbn.trim());
    const updatedIsbnArray = isbnArray.filter(isbn => isbn !== cleanIsbn);
    setIsbns(updatedIsbnArray.join(' '));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <form onSubmit={searchBooks} className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 flex-none">
        <div className="mb-6">
          <label htmlFor="isbns" className="block text-gray-700 font-semibold text-lg mb-2">ISBNを入力（スペース区切りで複数可）:</label>
          <input
            type="text"
            id="isbns"
            value={isbns}
            onChange={(e) => setIsbns(e.target.value)}
            placeholder="例: 978-4-XX-XXXXXX-X 978-4-XX-XXXXXX-X"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg"
          />
        </div>
        <div className="flex justify-between items-center">
          <button
            type="submit"
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center justify-center"
          >
            🔍 検索
          </button>
          <button
            onClick={copyAllBookInfo}
            type="button"
            disabled={bookDataList.length === 0}
            className={`${copiedAll ? 'bg-green-600' : 'bg-green-500 hover:bg-green-600'} text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center ${bookDataList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {copiedAll ? '✓ コピーしました' : '📋 すべての書籍情報をコピー'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex justify-center mt-4 flex-none">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
        </div>
      )}
      {errorMessages.length > 0 && (
        <div>
          <p className="text-red-500 text-center mt-4 text-lg flex-none">ISBN検索で見つかりませんでした。</p>
          {errorMessages.map((error, index) => (
            <div key={index} className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-6 relative">
              <button
                onClick={() => removeIsbn(error)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-full transition duration-300 text-sm"
                title="この書籍を削除"
              >
                ✖
              </button>
              <p className="text-red-500 text-center mt-4 text-lg flex-none">{error}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1 overflow-y-auto">
        {bookDataList.length > 0 && (
          <div className="mt-4">
            {bookDataList.map((bookData, index) => (
              <div key={index} className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 mb-6 relative">
                <button
                  onClick={() => removeIsbn(bookData.isbn13)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-full transition duration-300 text-sm"
                  title="この書籍を削除"
                >
                  ✖
                </button>
                <div className="flex flex-col md:flex-row">
                  <div className="w-32 h-48 mb-4 md:mb-0 md:mr-6 flex-shrink-0">
                    {bookData.coverImage ? (
                      <img
                        src={bookData.coverImage}
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
                    <h2 className="text-2xl font-bold text-orange-700 mb-2">{bookData.title}</h2>
                    <p className="text-gray-700 mb-1 text-lg"><strong>著者:</strong> {bookData.authors}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>出版社:</strong> {bookData.publisher}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-13:</strong> {bookData.isbn13}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-10:</strong> {bookData.isbn10}</p>
                    <div className="mt-4 flex items-center space-x-4">
                      {bookData.amazonLink !== '#' ? (
                        <a
                          href={bookData.amazonLink}
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
                        onClick={() => copyBookInfo(bookData, index)}
                        className={`${copiedIndex === index ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-semibold py-2 px-4 rounded-lg transition duration-300`}
                      >
                        {copiedIndex === index ? '✓ コピーしました' : '📋 書籍情報をコピー'}
                      </button>
                    </div>
                    <p className="text-gray-700 mt-4 text-lg"><strong>説明:</strong> {bookData.description.substring(0, 200)}...</p>
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

export default ISBNSearch;
