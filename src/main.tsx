/**
 * Точка входа в приложение.
 * Здесь добавляем проверку параметров URL для запуска тестового режима при необходимости.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';


// Определяем, нужно ли запустить тесты Monaco
const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.get('test') === 'monaco';

// Если в режиме тестирования, загружаем тестовый интерфейс
if (isTestMode) {
  // Директива игнорирования ошибки для конкретной строки импорта
  // @ts-ignore
  import('./monaco-tests/test-runner')
    .then(({ initTestRunner }) => {
      document.body.innerHTML = '<div id="test-container"></div>';
      document.title = 'Monaco Editor Tests';
      
      // Стилизуем тестовую страницу
      const style = document.createElement('style');
      style.textContent = `
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
      `;
      document.head.appendChild(style);
      
      // Инициализируем тестовую среду
      initTestRunner();
    })
    .catch(error => {
      console.error('Failed to load test environment:', error);
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1>Error Loading Tests</h1>
          <p>${error.message}</p>
          <button onclick="window.location.href='/'">Back to App</button>
        </div>
      `;
    });
} else {
  // Обычный запуск приложения
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
