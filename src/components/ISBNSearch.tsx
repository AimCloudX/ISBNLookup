import React, { useState, useEffect } from 'react';

interface BookData {
  title: string;
  publisher: string;
  author: string;
  isbn13: string;
  isbn10: string;
  coverImage: string | null;
  description: string;
  amazonLink: string;
}

interface ISBNSearchProps {
  isbns: string;
  setIsbns: React.Dispatch<React.SetStateAction<string>>;
}

function ISBNSearch({ isbns, setIsbns }: ISBNSearchProps) {
  const [bookDataList, setBookDataList] = useState<BookData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isbns) {
      searchBooks();
    } else {
      setBookDataList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isbns]);

  function formatISBN13(isbn: string): string {
    if (isbn.length !== 13) return isbn;
    return `${isbn.slice(0, 3)}-${isbn.slice(3)}`;
  }

  function generateAmazonLink(isbn10: string): string {
    const cleanIsbn = isbn10.replace(/-/g, '');
    return `https://www.amazon.co.jp/dp/${cleanIsbn}`;
  }

async function searchBooks(e?: React.FormEvent) {
  if (e) e.preventDefault();
  
  // ISBNの整形
  const isbnArray = isbns.split(' ').map(isbn => isbn.trim().replace(/-/g, '')).filter(isbn => isbn !== '');
  
  setLoading(true);
  setErrorMessages([]);
  setBookDataList([]);

  try {
    // 結果を格納する配列
    const results: BookData[] = [];
    const errorMessages:string[] = [];

    // ISBNごとに処理
    for (const isbn of isbnArray) {
      try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
          const book = data.items[0].volumeInfo;
          const industryIdentifiers = book.industryIdentifiers || [];
          const isbn13 = industryIdentifiers.find((id: any) => id.type === 'ISBN_13')?.identifier || '不明';
          const isbn10 = industryIdentifiers.find((id: any) => id.type === 'ISBN_10')?.identifier || '不明';
          const formattedISBN13 = formatISBN13(isbn13);

          const bookInfo: BookData = {
            title: book.title || '不明',
            publisher: book.publisher || '不明',
            author: book.authors ? book.authors.join(', ') : '不明',
            isbn13: formattedISBN13,
            isbn10: isbn10,
            coverImage: book.imageLinks?.thumbnail || null,
            description: book.description || '説明なし',
            amazonLink: isbn10 !== '不明' ? generateAmazonLink(isbn10) : '#',
          };

          // 成功した場合は結果に追加
          results.push(bookInfo);
        } else {
          // 本が見つからなかった場合はエラーメッセージを追加
          errorMessages.push(`${isbn}`);
        }
      } catch (error: any) {
        // エラーが発生した場合はエラーメッセージを追加
        errorMessages.push(`${isbn}`);
      }
    }

    // エラーがあればエラーメッセージを表示
    if (errorMessages.length > 0) {
      setErrorMessages(errorMessages);
    }

    // 取得した書籍情報を表示
    setBookDataList(results);
  } catch (error: any) {
  } finally {
    setLoading(false);
  }
}

  function copyAllBookInfo() {
    if (bookDataList.length === 0) {
      alert('コピーする書籍情報がありません。');
      return;
    }

    const copyText = bookDataList.map(bookData =>
      `${bookData.title}\t${bookData.publisher}\t${bookData.author}\t\t1\t\t\t\t\t${bookData.isbn13}`
    ).join('\n');

    navigator.clipboard.writeText(copyText).then(() => {
      alert('すべての書籍情報をクリップボードにコピーしました。');
    }, (err) => {
      console.error('コピーに失敗しました: ', err);
      alert('コピーに失敗しました。');
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
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 text-lg flex items-center"
          >
            📋 すべての書籍情報をコピー
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
                 <p className="text-red-500 text-center mt-4 text-lg flex-none" >{error}</p>
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
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-lg">
                        <span className="text-gray-500">表紙画像なし</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-orange-700 mb-2">{bookData.title}</h2>
                    <p className="text-gray-700 mb-1 text-lg"><strong>著者:</strong> {bookData.author}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>出版社:</strong> {bookData.publisher}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-13:</strong> {bookData.isbn13}</p>
                    <p className="text-gray-700 mb-1 text-lg"><strong>ISBN-10:</strong> {bookData.isbn10}</p>
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