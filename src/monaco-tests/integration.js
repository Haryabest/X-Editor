/**
 * Интеграция тестов с основным приложением
 * 
 * Этот файл содержит функции для запуска тестовой среды из основного приложения.
 */

import { initTestRunner } from './test-runner';

/**
 * Создает кнопку для запуска тестовой среды в основном приложении
 * @returns {void}
 */
export function createTestButton() {
  // Создаем кнопку
  const button = document.createElement('button');
  button.textContent = 'Запустить тесты Monaco';
  button.style.position = 'fixed';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '1000';
  button.style.padding = '8px 12px';
  button.style.backgroundColor = '#3498db';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  
  // Добавляем эффекты ховера
  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#2980b9';
  });
  
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#3498db';
  });
  
  // Добавляем обработчик клика
  button.addEventListener('click', openTestWindow);
  
  // Добавляем кнопку на страницу
  document.body.appendChild(button);
}

/**
 * Открывает окно с тестовой средой
 * @returns {void}
 */
function openTestWindow() {
  // Создаем новое окно для тестов
  const testWindow = window.open('./monaco-tests/index.html', 'MonacoTests', 
    'width=900,height=800,resizable=yes,scrollbars=yes');
  
  // Проверяем, что окно успешно открыто
  if (testWindow) {
    testWindow.focus();
  } else {
    alert('Не удалось открыть окно с тестами. Возможно, блокировщик всплывающих окон запретил открытие.');
  }
}

/**
 * Запускает тестовую среду непосредственно в текущей странице
 * @param {HTMLElement} container - Контейнер для размещения тестовой среды
 * @returns {void}
 */
export function embedTestRunner(container) {
  // Очищаем контейнер
  container.innerHTML = '';
  
  // Создаем заголовок
  const header = document.createElement('h2');
  header.textContent = 'Тестирование Monaco Editor';
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';
  container.appendChild(header);
  
  // Создаем подзаголовок
  const subheader = document.createElement('p');
  subheader.textContent = 'Выберите тестовый файл из списка ниже:';
  subheader.style.textAlign = 'center';
  subheader.style.marginBottom = '20px';
  container.appendChild(subheader);
  
  // Инициализируем тестовый runner
  initTestRunner();
}

/**
 * Включает отладочные инструменты для Monaco Editor
 * @returns {void}
 */
export function enableMonacoDebugTools() {
  // Определение для monaco - безопасное получение
  const monaco = window.monaco || {};
  
  // Добавляем глобальные переменные для удобства отладки
  window.monacoDebug = {
    // Метод для получения всех маркеров (ошибок)
    getMarkers: () => {
      if (monaco.editor && monaco.editor.getModelMarkers) {
        return monaco.editor.getModelMarkers({});
      }
      return [];
    },
    
    // Метод для очистки всех маркеров
    clearMarkers: () => {
      if (monaco.editor && monaco.editor.removeAllMarkers) {
        monaco.editor.removeAllMarkers();
      }
    },
    
    // Метод для получения всех моделей
    getModels: () => {
      if (monaco.editor && monaco.editor.getModels) {
        return monaco.editor.getModels();
      }
      return [];
    },
    
    // Метод для получения опций компилятора TypeScript
    getTsCompilerOptions: () => {
      if (monaco.languages && monaco.languages.typescript && 
          monaco.languages.typescript.typescriptDefaults && 
          monaco.languages.typescript.typescriptDefaults.getCompilerOptions) {
        return monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
      }
      return {};
    },
    
    // Метод для получения опций диагностики TypeScript
    getTsDiagnosticsOptions: () => {
      if (monaco.languages && monaco.languages.typescript && 
          monaco.languages.typescript.typescriptDefaults && 
          monaco.languages.typescript.typescriptDefaults.getDiagnosticsOptions) {
        return monaco.languages.typescript.typescriptDefaults.getDiagnosticsOptions();
      }
      return {};
    }
  };
  
  console.log('Monaco Debug Tools включены. Доступ через window.monacoDebug');
}