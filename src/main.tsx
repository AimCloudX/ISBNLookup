// src/main.jsx
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind CSSをインポート

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
  }
});
