// src/App.tsx
import { useState } from 'react';
import ISBNSearch from './components/ISBNSearch';
import KeywordSearch from './components/KeywordSearch';

function App() {
  const [isbns, setIsbns] = useState<string>('');

  return (
    <div className="bg-gradient-to-br from-orange-100 to-orange-300 h-screen flex flex-col">
      <header className="bg-white shadow-md flex-none">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-4xl font-bold text-center text-orange-700">📚 ISBN検索ツール</h1>
        </div>
      </header>

      <div className="flex-grow overflow-hidden">
        <main className="mx-auto px-6 py-4 h-full flex">
          <div className="flex flex-col lg:flex-row lg:space-x-6 h-full w-full">
            <div className="lg:w-1/2 h-full flex flex-col">
              <KeywordSearch setIsbns={setIsbns} />
            </div>
            <div className="lg:w-1/2 h-full flex flex-col">
              <ISBNSearch isbns={isbns} setIsbns={setIsbns} />
            </div>
          </div>
        </main>
      </div>

      <footer className="bg-white shadow-inner flex-none">
        <div className="container mx-auto px-6 py-4 text-center text-gray-600">
          &copy; 2024 ISBN検索ツール
        </div>
      </footer>
    </div>
  );
}

export default App;
