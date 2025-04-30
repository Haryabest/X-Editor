/**
 * Точка входа в приложение.
 * Здесь добавляем проверку параметров URL для запуска тестового режима при необходимости.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import './monaco-config/monaco-styles.css'; // Импортируем стили для Monaco Editor
import { setupModulePaths } from './monaco-config';
import { registerTypeScriptSupport } from './monaco-config/register-typescript';
import { fixTypeScriptErrors } from './monaco-config/ts-error-fix';
import { setupTypeScriptDirect } from './monaco-config/ts-config-override';
import { registerImportCompletionProvider } from './monaco-config/import-completion'; // Импортируем провайдер автодополнения
import * as monaco from 'monaco-editor';
import { registerMonacoThemes, initializeSettings } from './utils/settingsManager';

// Добавим явную принудительную регистрацию поддержки Python и инициализацию диагностики
import { registerPython } from './monaco-config/register-python';

// Конфигурация глобальных переменных
declare global {
  interface Window {
    monaco: typeof monaco;
    terminalInstance?: {
      clear: () => void;
      write: (content: string) => void;
      focus: () => void;
    };
    clearTerminal?: () => void;
    customSendMessage?: (message: string) => void;
    toggleTerminal?: () => void;
    showTerminal?: () => void;
    hideTerminal?: () => void;
    restartTerminal?: () => void;
    executeInTerminal?: (command: string) => void;
    pythonCheckErrors?: (code: string, model?: any) => Promise<any[]>;
    pythonAddErrorListener?: (callback: (errors: any[]) => void) => void;
    pythonShowProblemsInEditor?: (editor: any, errors: any[]) => void;
    pythonForceValidateEditor?: (editor: any) => void;
    setupErrorDecorations?: (editor: any) => void;
    setupAllErrorDecorations?: () => void;
    validatePythonSyntax?: (content: string, modelUri: any) => any[];
    getPythonDiagnostics: () => any[];
    updatePythonDiagnostics: () => Promise<any[]>;
    lastActiveFilePath?: string; // Путь к последнему активному файлу
    pythonDiagnostics: Map<string, any>;
    lastKnownMarkers: Record<string, any[]>;
    forceDiagnosticsRefresh: () => void;
  }
}

// Конфигурация для улучшения автодополнения путей
// Настраиваем типы точек (.) для автодополнения путей
function configurePathsAutocomplete() {
  if (!monaco || !monaco.languages || !monaco.languages.typescript) {
    console.warn('Monaco не инициализирован полностью, невозможно настроить автодополнение путей');
    return;
  }

  try {
    // Добавляем настройки для TypeScript
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      // Добавляем настройку для улучшения работы с путями
      pathsSupport: {
        allowSingleCharacterLiterals: true,
        allowImportingFromDotAsRelativePath: true
      }
    });

    // Настраиваем параметры компилятора для TS/JS
    const languagesToEnhance = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
    languagesToEnhance.forEach(language => {
      // Получаем настройки для языка
      const defaults = language.startsWith('typescript') 
        ? monaco.languages.typescript.typescriptDefaults 
        : monaco.languages.typescript.javascriptDefaults;
      
      // Настраиваем компиляцию для улучшенной работы с импортами
      defaults.setCompilerOptions({
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        baseUrl: '.',
        paths: {
          "*": ["*", "./src/*", "./app/*", "./*"]
        }
      });
    });

    // Добавляем свой хук для улучшения подсказок с './'
    if (window.monaco) {
      // Проверяем наличие функции completionItemProvider
      if (window.monaco.languages && window.monaco.languages.registerCompletionItemProvider) {
        console.log('Добавляем дополнительную поддержку для автодополнения путей');
        
        // Улучшаем приоритет для автодополнения путей
        window.monaco.languages.registerCompletionItemProvider('typescript', {
          triggerCharacters: ['.', '/'],
          provideCompletionItems: (model: any, position: any) => {
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });
            
            // Проверяем, что мы в контексте импортов и есть точка
            if (textUntilPosition.includes('import') && textUntilPosition.includes('.')) {
              const dotMatch = textUntilPosition.match(/import.*['"]\.(.*)/);
              if (dotMatch) {
                // Предоставляем подсказки для "."
                return {
                  suggestions: [
                    {
                      label: './',
                      kind: window.monaco.languages.CompletionItemKind.Folder,
                      detail: 'Текущая директория',
                      insertText: './',
                      sortText: '0', // Самый высокий приоритет
                      range: {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: position.column - 1,
                        endColumn: position.column
                      },
                      command: {
                        id: 'editor.action.triggerSuggest',
                        title: 'Показать подсказки'
                      }
                    }
                  ]
                };
              }
            }
            
            return { suggestions: [] };
          }
        });
        
        window.monaco.languages.registerCompletionItemProvider('typescriptreact', {
          triggerCharacters: ['.', '/'],
          provideCompletionItems: (model: any, position: any) => {
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });
            
            // Проверяем, что мы в контексте импортов и есть точка
            if (textUntilPosition.includes('import') && textUntilPosition.includes('.')) {
              const dotMatch = textUntilPosition.match(/import.*['"]\.(.*)/);
              if (dotMatch) {
                // Предоставляем подсказки для "."
                return {
                  suggestions: [
                    {
                      label: './',
                      kind: window.monaco.languages.CompletionItemKind.Folder,
                      detail: 'Текущая директория',
                      insertText: './',
                      sortText: '0', // Самый высокий приоритет
                      range: {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: position.column - 1,
                        endColumn: position.column
                      },
                      command: {
                        id: 'editor.action.triggerSuggest',
                        title: 'Показать подсказки'
                      }
                    }
                  ]
                };
              }
            }
            
            return { suggestions: [] };
          }
        });
      }
    }

    console.log('Настройки автодополнения путей успешно применены');
  } catch (error) {
    console.error('Ошибка при настройке автодополнения путей:', error);
  }
}

// Регистрируем поддержку TypeScript сразу при загрузке
console.log('Первичная регистрация TypeScript на старте приложения');
registerTypeScriptSupport();

// Инициализируем Tauri интеграцию для модулей после загрузки
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM загружен, повторная регистрация TypeScript');
    registerTypeScriptSupport();
    
    // Запускаем интеграцию с Tauri для путей модулей
    const result = await setupModulePaths();
    console.log('Интеграция модульных путей с Tauri:', result ? 'успешно' : 'не удалось');
    
    // Когда Monaco становится доступным, регистрируем поддержку и исправляем ошибки
    const checkMonaco = () => {
      if (window.monaco) {
        console.log('Monaco доступен в DOMContentLoaded, применяем настройки TypeScript');
        
        // Последовательно применяем все настройки и исправления
        registerTypeScriptSupport();
        setupTypeScriptDirect();
        fixTypeScriptErrors();
        
        // Применяем настройки для автодополнения путей
        configurePathsAutocomplete();
        
        // Регистрируем автодополнение импортов
        try {
          console.log('Регистрация провайдера автодополнения импортов...');
          registerImportCompletionProvider(window.monaco);
          console.log('Провайдер автодополнения импортов зарегистрирован успешно');
        } catch (error) {
          console.error('Ошибка при регистрации провайдера автодополнения импортов:', error);
        }
        
        try {
          // Регистрируем поддержку TSX
          import('./monaco-config/register-tsx').then(module => {
            console.log('Модуль register-tsx успешно импортирован');
            if (typeof module.registerTSX === 'function') {
              const result = module.registerTSX();
              console.log('Регистрация TSX завершена с результатом:', result);
              
              // После регистрации TSX снова применяем все настройки
              registerTypeScriptSupport();
              setupTypeScriptDirect();
              fixTypeScriptErrors();
              configurePathsAutocomplete(); // Повторно применяем настройки путей
              
              // Проверка успешности регистрации
              if (result) {
                console.log('Поддержка TSX успешно активирована. Теперь доступны автодополнения для React компонентов и информация при наведении на пути импорта.');
              } else {
                console.warn('Регистрация TSX не удалась. Автодополнения и подсказки для React могут работать некорректно.');
              }
              
              // Добавляем проверку наличия диагностики по TypeScript
              setTimeout(() => {
                if (window.logMonacoDiagnostics) {
                  const diagnostics = window.logMonacoDiagnostics();
                  console.log('Текущие диагностики Monaco:', diagnostics);
                }
              }, 2000);
            } else {
              console.error('Функция registerTSX не найдена в импортированном модуле');
            }
          }).catch(error => {
            console.error('Ошибка при импорте register-tsx:', error);
          });
          
          // Регистрируем поддержку Python
          import('./monaco-config/register-python').then(module => {
            console.log('Модуль register-python успешно импортирован');
            if (typeof module.registerPython === 'function') {
              const result = module.registerPython();
              console.log('Регистрация Python завершена с результатом:', result);
              
              if (result) {
                console.log('Поддержка Python успешно активирована. Теперь доступны автодополнения для Python кода.');
                
                // Запускаем обновление диагностики для Python файлов
                setTimeout(async () => {
                  if (window.updatePythonDiagnostics) {
                    console.log("Обновляем диагностику Python файлов...");
                    try {
                      const result = await window.updatePythonDiagnostics();
                      console.log("Результат обновления диагностики:", result);
                    } catch (error) {
                      console.error("Ошибка при обновлении Python диагностики:", error);
                    }
                  }
                }, 1000);
              } else {
                console.warn('Регистрация Python не удалась. Автодополнения и подсказки для Python могут работать некорректно.');
              }
            } else {
              console.error('Функция registerPython не найдена в импортированном модуле');
            }
          }).catch(error => {
            console.error('Ошибка при импорте register-python:', error);
          });
        } catch (error) {
          console.error('Ошибка при импорте и выполнении модулей поддержки языков:', error);
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

// Initialize all application settings
document.addEventListener('DOMContentLoaded', () => {
  // Register Monaco themes as soon as Monaco is available
  const checkMonaco = () => {
    if (window.monaco && window.monaco.editor) {
      registerMonacoThemes();
      initializeSettings();
    } else {
      setTimeout(checkMonaco, 500);
    }
  };
  
  checkMonaco();
});

// Применяем глобальные стили для панели проблем
function applyProblemPanelStyles() {
  const style = document.createElement('style');
  style.id = 'global-problem-panel-styles';
  style.textContent = `
    /* Элемент сообщения об ошибке */
    .problem-panel .issue-item,
    div[class*="problem-panel"] div[class*="issue-item"],
    .problem-issues div,
    .issue-item {
      height: 14px !important;
      min-height: 14px !important;
      max-height: 14px !important;
      line-height: 14px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    
    /* Иконки */
    .problem-panel svg,
    div[class*="problem-panel"] svg {
      width: 8px !important;
      height: 8px !important;
    }
  `;
  document.head.appendChild(style);
}

// Вызываем функцию сразу
if (typeof document !== 'undefined') {
  applyProblemPanelStyles();
}

// Добавим код для принудительной регистрации Python и инициализации диагностики
window.addEventListener('load', () => {
  // Вызываем проверку ошибок Python немедленно и повторно через интервалы
  setTimeout(() => {
    try {
      console.log('🔄 Запуск принудительной проверки ошибок Python...');
      
      // Принудительно запускаем функцию checkPythonErrorsInFile для обнаружения ошибок
      if (window.monaco && window.monaco.editor) {
        // Явно импортируем модуль с функцией checkPythonErrorsInFile
        import('./monaco-config/fixMarker').then(module => {
          console.log('📊 Модуль fixMarker загружен, проверяем ошибки...');
          // Запускаем функцию из модуля
          if (typeof module.initPeriodicDiagnosticChecks === 'function') {
            module.initPeriodicDiagnosticChecks();
          }
          
          // Обновляем маркеры и проблемы
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('markers-updated'));
            document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
          }, 1000);
        });
      }
      
      // Регистрируем обработчик для проверки ошибок при изменении активного файла
      document.addEventListener('active-file-changed', () => {
        setTimeout(() => {
          if (window.forceDiagnosticsRefresh) {
            window.forceDiagnosticsRefresh();
          }
          document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
        }, 300);
      });
      
      // Запускаем проверку повторно через 3 и 5 секунд для надежности
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
        if (window.forceDiagnosticsRefresh) {
          window.forceDiagnosticsRefresh();
        }
      }, 3000);
      
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
        if (window.forceDiagnosticsRefresh) {
          window.forceDiagnosticsRefresh();
        }
      }, 5000);
    } catch (error) {
      console.error('❌ Ошибка при инициализации проверки ошибок Python:', error);
    }
  }, 2000);
});
