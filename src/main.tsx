/**
 * Точка входа в приложение.
 * Здесь добавляем проверку параметров URL для запуска тестового режима при необходимости.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { setupModulePaths } from './monaco-config';

declare global {
  interface Window {
    monaco: any;
    terminalInstance?: {
      clear: () => void;
      restart: () => void;
      showSettings: () => void;
    };
  }
}

// Инициализируем Tauri интеграцию для модулей после загрузки
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Запускаем интеграцию с Tauri для путей модулей
    const result = await setupModulePaths();
    console.log('Интеграция модульных путей с Tauri:', result ? 'успешно' : 'не удалось');
    
    // Когда Monaco становится доступным, регистрируем поддержку TSX
    const checkMonaco = () => {
      if (window.monaco) {
        console.log('Monaco доступен в DOMContentLoaded, регистрируем TSX');
        try {
          import('./monaco-config/register-tsx').then(module => {
            console.log('Модуль register-tsx успешно импортирован');
            if (typeof module.registerTSX === 'function') {
              const result = module.registerTSX();
              console.log('Регистрация TSX завершена с результатом:', result);
              
              // Проверка успешности регистрации
              if (result) {
                console.log('Поддержка TSX успешно активирована. Теперь доступны автодополнения для React компонентов и информация при наведении на пути импорта.');
              } else {
                console.warn('Регистрация TSX не удалась. Автодополнения и подсказки для React могут работать некорректно.');
              }
            } else {
              console.error('Функция registerTSX не найдена в импортированном модуле');
            }
          }).catch(error => {
            console.error('Ошибка при импорте register-tsx:', error);
          });
        } catch (error) {
          console.error('Ошибка при импорте и выполнении register-tsx:', error);
        }
      } else {
        console.log('Monaco еще не доступен, повторная проверка через 1 секунду');
        setTimeout(checkMonaco, 1000);
      }
    };
    
    checkMonaco();
  } catch (error) {
    console.error('Ошибка при инициализации интеграции с Tauri:', error);
  }
});

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
  const rootElement = document.getElementById('root') as Element;
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    console.error('Корневой элемент #root не найден');
  }
}
