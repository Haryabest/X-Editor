import * as monaco from 'monaco-editor';
import { getLanguageFromExtension } from './language-detector';
import { configureJSXTypes, jsxIntrinsicElementsDefinitions } from './jsx-types';
import { FileItem } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { applyLanguageConfiguration, getFileExtension, isJavaScriptFile, isJSXFile, isScriptFile, isTypeScriptFile } from '../utils/fileExtensions';
import { configureTypeScript } from './typescript-config'; // Импортируем нашу функцию конфигурации TypeScript
import { safeSetModelMarkers } from './fixMarker';
import { configureHover } from './hover-config'; // Импортируем конфигурацию hover-подсказок
import { registerImportCompletionProvider } from './import-completion'; // Импортируем провайдер автодополнения импортов

// Игнорирование ошибок импорта для интеграционного модуля
// @ts-ignore
import { createTestButton, enableMonacoDebugTools } from '../monaco-tests/integration';

// Расширяем тип Window для добавления отладочной функции
declare global {
  interface Window {
    monaco: any;
    logMonacoDiagnostics?: () => { markers: any[], errorCounts: Record<string, number> };
    monacoDebug?: any;
    setupErrorDecorations?: (editor: any) => void;
    validatePythonSyntax?: (content: string, modelUri: any) => any[];
  }
}

// Флаг режима разработки (для включения тестов и отладочных инструментов)
const isDevelopmentMode = process.env.NODE_ENV === 'development';

// Экспортируем тип Monaco для использования в других модулях
export type Monaco = typeof monaco;

// Расширяем существующий интерфейс FileItem для поддержки filePath
interface MonacoFileConfig extends FileItem {
  filePath?: string; // Для обратной совместимости
}

/**
 * Проверяет существование импортируемых модулей и настраивает отображение ошибок
 */
async function setupDependencyAnalysis(monaco: Monaco, model: any) {
  try {
    // Получаем текст файла
    const text = model.getValue();
    const filePath = model.uri.path;
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    
    // Только для TypeScript/JavaScript файлов
    if (!['ts', 'tsx', 'js', 'jsx'].includes(fileExtension || '')) {
      return;
    }

    // Регулярное выражение для поиска импортов
    const importRegex = /import\s+(?:(?:(?:{[^}]*}|\*\s+as\s+[^,]*|[^\s,]*)\s*,?\s*)(?:,\s*(?:{[^}]*}|\*\s+as\s+[^,]*|[^\s,]*))*\s*from\s+)?['"]([^'"]+)['"]/g;
    
    // Регулярное выражение для поиска require
    const requireRegex = /(?:const|let|var)\s+(?:.*?)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    
    // Собираем все импорты
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(text)) !== null) {
      const modulePath = match[1].trim();
      imports.push(modulePath);
    }
    
    while ((match = requireRegex.exec(text)) !== null) {
      const modulePath = match[1].trim();
      imports.push(modulePath);
    }
    
    if (imports.length === 0) {
      return; // Нет импортов для проверки
    }
    
    console.log(`Found ${imports.length} imports in ${filePath}:`, imports);
    
    // Функция для проверки существования модуля
    const checkModuleExists = async (modulePath: string): Promise<boolean> => {
      // Если это относительный путь, проверяем существование файла
      if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        try {
          // Определяем полный путь к файлу
          const basePath = filePath.split('/').slice(0, -1).join('/');
          const fullPath = `${basePath}/${modulePath}`;
          
          // Пытаемся проверить существование через Tauri API
          return await invoke<boolean>('check_path_exists', { path: fullPath })
            .then((exists) => {
              return exists;
            })
            .catch(() => {
              // В случае ошибки предполагаем, что файла нет
              return false;
            });
        } catch (error) {
          console.warn(`Error checking file existence: ${modulePath}`, error);
          return false;
        }
      }
      
      // Для npm-пакетов предполагаем, что они существуют
      // В реальном приложении здесь можно добавить проверку package.json
      return true;
    };
    
    // Проверяем каждый импортированный модуль
    const checkResults = await Promise.all(
      imports.map(async (modulePath) => {
        const exists = await checkModuleExists(modulePath);
        return { modulePath, exists };
      })
    );
    
    // Получаем несуществующие модули
    const nonExistentModules = checkResults
      .filter(result => !result.exists)
      .map(result => result.modulePath);
    
    if (nonExistentModules.length > 0) {
      console.warn(`Found non-existent modules in ${filePath}:`, nonExistentModules);
      
      // Создаем маркеры для отображения ошибок
      const markers = [];
      
      // Заново проходим по всем импортам и создаем маркеры для несуществующих модулей
      let importMatch;
      importRegex.lastIndex = 0; // Сбрасываем индекс
      
      while ((importMatch = importRegex.exec(text)) !== null) {
        const modulePath = importMatch[1].trim();
        if (nonExistentModules.includes(modulePath)) {
          // Определяем позицию модуля в строке
          const lineContent = text.substring(0, importMatch.index).split('\n');
          const lineNumber = lineContent.length;
          const startColumn = importMatch[0].indexOf(modulePath) + importMatch.index - lineContent[lineContent.length - 1].length + 1;
          
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Cannot find module '${modulePath}'`,
            startLineNumber: lineNumber,
            startColumn: startColumn,
            endLineNumber: lineNumber,
            endColumn: startColumn + modulePath.length,
            code: 2307, // Код ошибки Cannot find module
            source: 'ts'
          });
        }
      }
      
      // То же самое для require
      let requireMatch;
      requireRegex.lastIndex = 0;
      
      while ((requireMatch = requireRegex.exec(text)) !== null) {
        const modulePath = requireMatch[1].trim();
        if (nonExistentModules.includes(modulePath)) {
          const lineContent = text.substring(0, requireMatch.index).split('\n');
          const lineNumber = lineContent.length;
          const startColumn = requireMatch[0].indexOf(modulePath) + requireMatch.index - lineContent[lineContent.length - 1].length + 1;
          
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: `Cannot find module '${modulePath}'`,
            startLineNumber: lineNumber,
            startColumn: startColumn,
            endLineNumber: lineNumber,
            endColumn: startColumn + modulePath.length,
            code: 2307,
            source: 'ts'
          });
        }
      }
      
      // Устанавливаем маркеры для модели
      safeSetModelMarkers(monaco, model, 'dependency-checker', markers);
    }
  } catch (error) {
    console.error('Error in setupDependencyAnalysis:', error);
  }
}

/**
 * Настраивает умный анализатор кода для различных типов файлов
 * @param monaco - Объект Monaco
 * @param filePath - Путь к файлу
 */
export function setupSmartCodeAnalyzer(monaco: Monaco, filePath: string) {
  try {
    console.log(`Setting up smart code analyzer for ${filePath}`);
    
    // Получаем расширение файла
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    
    // Определяем язык на основе расширения
    let language = 'plaintext';
    if (fileExtension === 'tsx') {
      language = 'typescriptreact';
    } else if (fileExtension === 'ts') {
      language = 'typescript';
    } else if (fileExtension === 'jsx') {
      language = 'javascriptreact';
    } else if (fileExtension === 'js') {
      language = 'javascript';
    } else if (fileExtension === 'json') {
      language = 'json';
    } else if (fileExtension === 'css') {
      language = 'css';
    } else if (fileExtension === 'html') {
      language = 'html';
    } else if (['md', 'markdown'].includes(fileExtension || '')) {
      language = 'markdown';
    }
    
    // Список кодов ошибок, которые можно игнорировать
    const diagnosticCodesToIgnore = [
      2669, 1046, 7031, 1161, 2304, 7026, 7006, 2740, 2339, 2531, 2786, 
      2605, 1005, 1003, 17008, 2693, 1109, 1128, 1434, 1136, 1110, 8006, 
      8010, 2688, 1039, 2792, 1183, 1254, 2695, 2365, 2714, 2552, 2362, 
      2503, 2363, 18004, 7027, 2322, 2741, 2345, 2451, 2612, 2454, 2306, 
      6133, 2769, 7005, 2355, 2540, 2665, 2694, 1108, 6196, 80001, 80002, 
      80003, 18002, 18003, 2614, 2459, 2580, 2487, 7053, 2602, 2551, 
      2578, 7008, 2525, 2683, 2821, 1011, 8016
    ];
    
    // Для TypeScript и JavaScript отдельно настраиваем параметры диагностики
    if (language === 'typescript' || language === 'javascript') {
      const isJSX = fileExtension?.endsWith('x') || false;
      
      // Настраиваем диагностику в зависимости от типа файла
      if (language === 'typescript') {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: isJSX, // Отключаем suggestion diagnostics для JSX файлов
          diagnosticCodesToIgnore: isJSX 
            ? [...diagnosticCodesToIgnore, 2307] // Для JSX игнорируем "Cannot find module" по умолчанию
            : diagnosticCodesToIgnore.filter(code => code !== 2307) // Для не-JSX удаляем 2307, чтобы показывать ошибки
        });
      } else {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: isJSX,
          diagnosticCodesToIgnore: isJSX 
            ? [...diagnosticCodesToIgnore, 2307]
            : diagnosticCodesToIgnore.filter(code => code !== 2307)
        });
      }
      
      // Подписываемся на событие создания модели
      monaco.editor.onDidCreateModel((model: any) => {
        if (model.uri.path === filePath) {
          // Запускаем проверку зависимостей
          setupDependencyAnalysis(monaco, model);
          
          // Подписываемся на изменения модели
          model.onDidChangeContent(() => {
            // Если содержимое изменилось, повторно проверяем зависимости
            setupDependencyAnalysis(monaco, model);
          });
        }
      });
    }
  } catch (error) {
    console.error(`Error setting up analyzer for ${filePath}:`, error);
  }
}

// Проверка моделей при инициализации
function setupLanguageDetectionForExistingModels() {
  try {
    // Получаем все модели и устанавливаем правильный язык на основе имени файла
    const models = monaco.editor.getModels();
    
    models.forEach(model => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      
      // Определяем расширение файла
      const getExtension = (filename: string): string => {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
      };
      
      const ext = getExtension(fileName).toLowerCase();
      let language = model.getLanguageId();
      
      // Явно устанавливаем язык на основе расширения
      if (ext === '.ts' && !fileName.endsWith('.d.ts')) {
        language = 'typescript';
      } else if (ext === '.tsx') {
        language = 'typescriptreact';
      } else if (ext === '.d.ts') {
        language = 'typescript';
      } else if (ext === '.js') {
        language = 'javascript';
      } else if (ext === '.jsx') {
        language = 'javascriptreact';
      }
      
      // Если текущий язык не совпадает с определенным, устанавливаем новый
      if (language !== model.getLanguageId()) {
        console.log(`Изменение языка для ${fileName} с ${model.getLanguageId()} на ${language}`);
        monaco.editor.setModelLanguage(model, language);
      }
    });
    
    console.log('Проверка и настройка языка для существующих моделей завершена');
  } catch (error) {
    console.error('Ошибка при настройке языка для существующих моделей:', error);
  }
}

/**
 * Настраивает компилятор и диагностику для TypeScript и JavaScript
 */
function setupDiagnosticsConfiguration() {
  try {
    if (!monaco.languages || !monaco.languages.typescript) {
      console.error('Отсутствует поддержка TypeScript в Monaco Editor');
      return;
    }

    // Диагностика для TypeScript
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // Игнорируем ошибки, связанные с отсутствующими модулями
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016  // Could not find a declaration file for module 'X'
      ]
    });

    // Диагностика для JavaScript - игнорируем ошибки TypeScript конструкций
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // TypeScript-специфичные конструкции в JavaScript
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        // Ошибки модулей
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016  // Could not find a declaration file for module 'X'
      ]
    });

    // Игнорируем ошибки в режиме ожидания сервера
    monaco.languages.typescript.typescriptDefaults.setMaximumWorkerIdleTime(-1);
    monaco.languages.typescript.javascriptDefaults.setMaximumWorkerIdleTime(-1);

    // Включаем синхронизацию моделей, чтобы предотвратить перезагрузку
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    console.log('Конфигурация диагностики TypeScript и JavaScript завершена');
  } catch (error) {
    console.error('Ошибка при настройке диагностики:', error);
  }
}

/**
 * Конфигурирует Monaco Editor
 * @param openedFiles - Массив открытых файлов
 */
export function configureMonaco(openedFiles: MonacoFileConfig[]): void {
  try {
    // Предотвращаем повторную инициализацию
    if (window.monaco) {
      console.log('Monaco уже инициализирован, пропускаем инициализацию');
      return;
    }

    console.log('Configuring Monaco with opened files:', openedFiles);

    // Устанавливаем параметры Monaco Editor
    window.monaco = monaco;

    // Сначала настраиваем TypeScript для корректной работы с React и TSX
    configureTypeScript(monaco);
    
    // Настраиваем hover-подсказки
    configureHover(monaco);
    
    // Регистрируем провайдер автодополнения импортов
    registerImportCompletionProvider(monaco);
    
    // Настраиваем диагностику
    setupDiagnosticsConfiguration();
    
    // Проверяем и устанавливаем правильный язык для существующих моделей
    setupLanguageDetectionForExistingModels();
    
    // Добавляем обработчик для новых моделей
    monaco.editor.onDidCreateModel((model) => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      
      // Определяем расширение файла
      const getExtension = (filename: string): string => {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
      };
      
      const ext = getExtension(fileName).toLowerCase();
      let language = model.getLanguageId();
      
      // Явно устанавливаем язык на основе расширения
      if (ext === '.ts' && !fileName.endsWith('.d.ts')) {
        language = 'typescript';
        console.log(`Установлен язык typescript для ${fileName}`);
      } else if (ext === '.tsx') {
        language = 'typescriptreact';
        console.log(`Установлен язык typescriptreact для ${fileName}`);
      } else if (ext === '.d.ts') {
        language = 'typescript';
        console.log(`Установлен язык typescript для declaration file ${fileName}`);
      } else if (ext === '.js') {
        language = 'javascript';
        console.log(`Установлен язык javascript для ${fileName}`);
      } else if (ext === '.jsx') {
        language = 'javascriptreact';
        console.log(`Установлен язык javascriptreact для ${fileName}`);
      }
      
      // Если текущий язык не совпадает с определенным, устанавливаем новый
      if (language !== model.getLanguageId()) {
        monaco.editor.setModelLanguage(model, language);
      }
    });

    // Используем явное приведение типа для monaco
    const monacoInstance: any = monaco;
    
    // Настраиваем базовые компиляторы для TypeScript и JavaScript
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      strict: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      typeRoots: ["node_modules/@types"]
    });

    // Настраиваем диагностику для TypeScript
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // Игнорируем только ошибки, связанные с отсутствующими модулями
        2307, // Cannot find module 'X'
        2304, // Cannot find name 'X'
        2552, // Cannot find name 'require'
        2580, // Cannot find name 'module'
        7016  // Could not find a declaration file for module 'X'
      ]
    });

    // Настраиваем JavaScript
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      module: monacoInstance.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monacoInstance.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monacoInstance.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      strict: false,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true
    });
    
    // Настраиваем диагностику для JavaScript
    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        // Игнорируем ошибки TypeScript в JavaScript файлах
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        // Другие коды ошибок, которые нужно игнорировать
        2307, // Cannot find module 'X'
        2304, // Cannot find name 'X'
        2552, // Cannot find name 'require'
        2580, // Cannot find name 'module'
        2692, // Imports are only allowed in TypeScript files
        7016  // Could not find a declaration file for module 'X'
      ]
    });
    
    // Также настраиваем TypeScript для совместимости с файлами JS
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        8006, 8010, 2307, 2304, 2552, 2580, 2692, 7016, 1005, 1003, 2551, 7006, 7031
      ]
    });
    
    // Логгируем информацию о версии
    console.log('Configuring Monaco with TypeScript support');
    
    // Настраиваем умный анализатор кода с проверкой зависимостей
    // Импорты проверяются на существование файлов:
    // - Для относительных путей (./file.js, ../components/Button.tsx)
    //   проверяется реальное существование файла
    // - Если файл не существует, показывается ошибка "Cannot find module"
    // - Для npm-пакетов (react, lodash и т.д.) ошибки не отображаются
    openedFiles.forEach(file => {
      // Используем либо filePath, либо path
      const filePath = file.filePath || file.path;
      if (filePath) {
        setupSmartCodeAnalyzer(monaco, filePath);
      }
    });
    
    // Загружаем VSCode-подобные настройки если они есть
    tryLoadVSCodeSettings();

    // Определяем константы для типов JSX
    const JsxEmit = {
      None: 0,
      Preserve: 1,
      React: 2,
      ReactNative: 3,
      ReactJSX: 4,
      ReactJSXDev: 5
    };
    
    // Определяем константы для целевых версий JavaScript
    const ScriptTarget = {
      ES3: 0,
      ES5: 1,
      ES2015: 2,
      ES2016: 3,
      ES2017: 4,
      ES2018: 5,
      ES2019: 6,
      ES2020: 7,
      ESNext: 99,
      JSON: 100,
      Latest: 99
    };
    
    // Определяем константы для разрешения модулей
    const ModuleResolutionKind = {
      Classic: 1,
      NodeJs: 2
    };
    
    // Определяем константы для типов модулей
    const ModuleKind = {
      None: 0,
      CommonJS: 1,
      AMD: 2,
      UMD: 3,
      System: 4,
      ES2015: 5,
      ESNext: 99
    };

    // Настройка виртуальной файловой системы с использованием числовых значений вместо перечислений
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: JsxEmit.React, // 2
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      target: ScriptTarget.ESNext, // 99
      allowNonTsExtensions: true,
      moduleResolution: ModuleResolutionKind.NodeJs, // 2
      module: ModuleKind.ESNext, // 99
      experimentalDecorators: true,
      noEmit: true,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noImplicitAny: false,
      strict: false,
      alwaysStrict: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      checkJs: false,
      strictNullChecks: false,
      noImplicitThis: false,
      noImplicitReturns: false,
      baseUrl: ".",
      suppressImplicitAnyIndexErrors: true,
      noStrictGenericChecks: true,
      paths: {
        "*": ["*", "node_modules/*", "src/*"],
        "@/*": ["./src/*", "./components/*"],
        "../*": ["../src/*", "../*"],
        "~/*": ["./*"],
        "next": ["./node_modules/next", "./src/types/next"],
        "next/*": ["./node_modules/next/*", "./src/types/next/*"],
        "react": ["./node_modules/react", "./src/types/react"],
        "react/*": ["./node_modules/react/*", "./src/types/react/*"],
        "react-dom": ["./node_modules/react-dom", "./src/types/react-dom"],
        "react-dom/*": ["./node_modules/react-dom/*", "./src/types/react-dom/*"],
        "@prisma/client": ["./node_modules/@prisma/client", "./src/types/prisma-client"],
        "../components/*": ["../components/*", "../src/components/*", "./components/*"]
      }
    });
    
    // Настройка отображения полного пути модуля при наведении
    // @ts-ignore - игнорируем несоответствие типов для registerHoverProvider
    monaco.languages.registerHoverProvider('typescript', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const text = model.getValue();
        const lineContent = model.getLineContent(position.lineNumber);
        
        // Ищем разные типы импортов
        // 1. ES6 import from
        const importFromMatch = lineContent.match(/import\s+(?:type\s+)?(?:.*?)\s+from\s+['"]([^'"]+)['"]/);
        // 2. import('path')
        const dynamicImportMatch = lineContent.match(/import\(\s*['"]([^'"]+)['"]\s*\)/);
        // 3. require('path')
        const requireMatch = lineContent.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
        // 4. /// <reference path="..." />
        const referencePathMatch = lineContent.match(/<reference\s+path=['"]([^'"]+)['"]/);
        // 5. URL в строке
        const urlMatch = lineContent.match(/['"]((https?|file):\/\/[^'"]+)['"]/);
        // 6. import type { X } from "module"
        const typeImportMatch = lineContent.match(/import\s+type\s+(?:{[^}]*})\s+from\s+['"]([^'"]+)['"]/);
        
        let modulePath = null;
        let isTypeImport = false;
        let isNpmPackage = false;
        
        if (importFromMatch && lineContent.includes(word.word)) {
          modulePath = importFromMatch[1];
          isTypeImport = lineContent.includes('import type');
        } else if (typeImportMatch && lineContent.includes(word.word)) {
          modulePath = typeImportMatch[1];
          isTypeImport = true;
        } else if (dynamicImportMatch && lineContent.includes(word.word)) {
          modulePath = dynamicImportMatch[1];
        } else if (requireMatch && lineContent.includes(word.word)) {
          modulePath = requireMatch[1];
        } else if (referencePathMatch && lineContent.includes(word.word)) {
          modulePath = referencePathMatch[1];
        } else if (urlMatch && lineContent.includes(word.word)) {
          modulePath = urlMatch[1];
        }
        
        if (modulePath) {
          // Проверяем, является ли это npm пакетом (не начинается с ./ или ../)
          isNpmPackage = !modulePath.startsWith('./') && !modulePath.startsWith('../') && !modulePath.startsWith('/');
          
          // Формируем дополнительную информацию о пути
          let additionalInfo = '';
          
          if (isNpmPackage) {
            // Получаем имя пакета (до первого /)
            const packageName = modulePath.split('/')[0];
            
            // Предоставляем информацию о популярных пакетах
            const packageInfo: Record<string, string> = {
              'react': 'Библиотека для создания пользовательских интерфейсов',
              'react-dom': 'DOM-рендерер для React',
              'next': 'Фреймворк для React с серверным рендерингом',
              '@next': 'Модули фреймворка Next.js',
              'express': 'Веб-фреймворк для Node.js',
              'axios': 'HTTP-клиент на основе Promise',
              'lodash': 'Утилитарная библиотека для JavaScript',
              '@types': 'TypeScript типы для библиотек',
              'redux': 'Контейнер состояния для JavaScript приложений',
              'vue': 'Прогрессивный JavaScript-фреймворк',
              'angular': 'Фреймворк для создания одностраничных приложений',
              'jQuery': 'Библиотека для упрощения работы с DOM',
              'mongoose': 'MongoDB ODM для Node.js',
              'sequelize': 'ORM для Node.js (поддерживает MySQL, PostgreSQL, SQLite)',
              'webpack': 'Сборщик модулей для JavaScript',
              'babel': 'Транспилятор JavaScript',
              'eslint': 'Инструмент для статического анализа кода',
              'jest': 'Фреймворк для тестирования JavaScript',
              'mocha': 'Фреймворк для тестирования JavaScript',
              'chai': 'Библиотека утверждений для тестирования',
              'moment': 'Библиотека для работы с датами и временем',
              'date-fns': 'Современная библиотека для работы с датами',
              'styled-components': 'Библиотека для стилизации компонентов в React',
              'tailwindcss': 'CSS-фреймворк для быстрой разработки интерфейсов',
              'bootstrap': 'CSS-фреймворк для быстрого создания адаптивных сайтов',
              'material-ui': 'React компоненты в стиле Material Design',
              '@mui': 'Material-UI компоненты (новая версия)',
              'antd': 'React UI-библиотека с дизайном Ant Design',
              'apollo-client': 'Клиент для работы с GraphQL',
              'graphql': 'Язык запросов для API',
              'rxjs': 'Библиотека для реактивного программирования',
              'typescript': 'Строго типизированный надмножество JavaScript',
              'node-fetch': 'Реализация fetch API для Node.js',
              'fs-extra': 'Расширенная библиотека файловой системы для Node.js',
              'path': 'Встроенный модуль Node.js для работы с путями',
              'fs': 'Встроенный модуль Node.js для работы с файловой системой',
              'http': 'Встроенный модуль Node.js для HTTP-сервера',
              'https': 'Встроенный модуль Node.js для HTTPS-сервера',
              'url': 'Встроенный модуль Node.js для работы с URL',
              'util': 'Встроенный модуль Node.js с утилитами',
              'crypto': 'Встроенный модуль Node.js для криптографии',
              'events': 'Встроенный модуль Node.js для работы с событиями',
              'stream': 'Встроенный модуль Node.js для потоковой обработки данных',
              'zlib': 'Встроенный модуль Node.js для сжатия данных',
              'querystring': 'Встроенный модуль Node.js для работы с query string',
              'os': 'Встроенный модуль Node.js для работы с операционной системой',
              'child_process': 'Встроенный модуль Node.js для работы с дочерними процессами',
            };
            
            // Получаем информацию о пакете, если она доступна
            const packageInfoText = packageInfo[packageName] || '';
            
            // Формируем дополнительную информацию
            additionalInfo = `**NPM пакет**: \`${packageName}\`${packageInfoText ? '\n\n' + packageInfoText : ''}`;
            
            // Дополнительная информация для пакетов Next.js
            if (packageName === 'next' || packageName === '@next') {
              const nextModulePath = modulePath.substring(packageName.length + 1);
              const nextModuleInfo: Record<string, string> = {
                'router': 'API для маршрутизации в Next.js приложениях',
                'link': 'Компонент для клиентской навигации между страницами',
                'head': 'Компонент для изменения заголовка и метаданных страницы',
                'script': 'Компонент для загрузки внешних скриптов',
                'image': 'Компонент для оптимизации изображений',
                'document': 'Компонент для настройки общей структуры документа',
                'app': 'Компонент для настройки глобального состояния приложения',
                'error': 'Компонент для обработки ошибок',
                'config': 'Функции для доступа к конфигурации Next.js',
                'server': 'API для серверной части Next.js',
                'dynamic': 'Функция для динамической загрузки компонентов',
                'types': 'TypeScript типы для Next.js',
                'cache': 'API для кэширования в Next.js',
                'font': 'API для оптимизации шрифтов в Next.js',
                'headers': 'API для установки HTTP-заголовков',
                'constants': 'Константы, используемые в Next.js',
                'future': 'Экспериментальные возможности Next.js',
              };
              
              let nextModuleInfoText = '';
              for (const [key, value] of Object.entries(nextModuleInfo)) {
                if (nextModulePath === key || nextModulePath.startsWith(key + '/')) {
                  nextModuleInfoText = value;
                  break;
                }
              }
              
              if (nextModuleInfoText) {
                additionalInfo += `\n\n**Next.js модуль**: \`${nextModulePath}\`\n\n${nextModuleInfoText}`;
              }
            }
          } else if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            // Относительный путь к локальному файлу
            additionalInfo = 'Относительный путь к файлу в проекте. ' + 
              (modulePath.startsWith('./') 
                ? 'Указывает на файл в текущей директории.' 
                : 'Указывает на файл в родительской директории.');
          } else if (modulePath.startsWith('/')) {
            // Абсолютный путь
            additionalInfo = 'Абсолютный путь к файлу, отсчитываемый от корня проекта.';
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `Путь к модулю${isTypeImport ? ' (импорт только типов)' : ''}, который импортируется в текущий файл.\n\n${additionalInfo}` }
            ]
          };
        }
        
        // Поиск относительных путей в импортах
        const pathMatch = lineContent.match(/['"]([\.\/][^'"]+)['"]/);
        if (pathMatch && lineContent.includes(word.word)) {
          return {
            contents: [
              { value: `**Относительный путь:** \`${pathMatch[1]}\`` },
              { value: 'Относительный путь к файлу в проекте. Пути начинающиеся с `./` указывают на файлы в текущей директории, а `../` - на файлы в родительской директории.' }
            ]
          };
        }
        
        // Проверка на функцию
        const functionMatch = new RegExp(`function\\s+${word.word}\\s*\\(`).exec(text);
        const arrowFunctionMatch = new RegExp(`const\\s+${word.word}\\s*=\\s*\\([^)]*\\)\\s*=>`).exec(text);
        
        if (functionMatch || arrowFunctionMatch) {
          // Находим JSDoc комментарий перед функцией
          const lines = text.split('\n');
          const wordLine = position.lineNumber - 1; // Индексация с 0
          let docString = '';
          
          // Ищем JSDoc комментарий перед функцией (до 10 строк назад)
          for (let i = wordLine - 1; i >= Math.max(0, wordLine - 10); i--) {
            if (lines[i].trim().match(/\/\*\*/)) {
              // Нашли начало JSDoc комментария
              let docEnd = i;
              for (let j = i; j <= wordLine; j++) {
                if (lines[j].trim().match(/\*\//)) {
                  docEnd = j;
                  break;
                }
              }
              
              // Собираем комментарий
              for (let j = i; j <= docEnd; j++) {
                docString += lines[j] + '\n';
              }
              break;
            }
          }
          
          const defaultDescription = functionMatch 
            ? 'Функция, определенная в текущем модуле.'
            : 'Стрелочная функция или функциональный компонент.';
          
          return {
            contents: [
              { value: `**Функция:** \`${word.word}\`` },
              { value: docString || defaultDescription }
            ]
          };
        }
        
        // Проверка на интерфейс или тип
        const typeMatch = new RegExp(`(interface|type)\\s+${word.word}`).exec(text);
        if (typeMatch) {
          return {
            contents: [
              { value: `**${typeMatch[1] === 'interface' ? 'Интерфейс' : 'Тип'}:** \`${word.word}\`` },
              { value: 'Пользовательский тип, определенный в текущем модуле. Используется для типизации данных в TypeScript.' }
            ]
          };
        }
        
        // Проверка на JSX компонент
        const jsxComponentMatch = new RegExp(`<${word.word}[\\s/>]`).exec(text);
        if (jsxComponentMatch) {
          return {
            contents: [
              { value: `**Компонент:** \`${word.word}\`` },
              { value: 'React компонент, используемый в JSX разметке. Обычно компоненты должны начинаться с заглавной буквы.' }
            ]
          };
        }
        
        // Проверка на константу или переменную
        const constMatch = new RegExp(`(const|let|var)\\s+${word.word}`).exec(text);
        if (constMatch) {
          return {
            contents: [
              { value: `**${constMatch[1] === 'const' ? 'Константа' : 'Переменная'}:** \`${word.word}\`` },
              { value: constMatch[1] === 'const' 
                ? 'Константа, значение которой не может быть изменено после инициализации.' 
                : 'Переменная, значение которой может изменяться в течение выполнения программы.' }
            ]
          };
        }
        
        // Проверка на импортированный символ
        const importedSymbolMatch = new RegExp(`import\\s+{[^}]*\\b${word.word}\\b[^}]*}`).exec(text);
        if (importedSymbolMatch) {
          return {
            contents: [
              { value: `**Импортированный символ:** \`${word.word}\`` },
              { value: 'Символ, импортированный из другого модуля. Может быть функцией, классом, переменной или типом.' }
            ]
          };
        }
        
        return null;
      }
    });

    // @ts-ignore - игнорируем несоответствие типов для registerHoverProvider
    monaco.languages.registerHoverProvider('javascript', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const text = model.getValue();
        const lineContent = model.getLineContent(position.lineNumber);
        
        // Ищем разные типы импортов
        // 1. ES6 import from
        const importFromMatch = lineContent.match(/import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/);
        // 2. import('path')
        const dynamicImportMatch = lineContent.match(/import\(\s*['"]([^'"]+)['"]\s*\)/);
        // 3. require('path')
        const requireMatch = lineContent.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
        // 4. URL в строке
        const urlMatch = lineContent.match(/['"]((https?|file):\/\/[^'"]+)['"]/);
        
        let modulePath = null;
        let isNpmPackage = false;
        
        if (importFromMatch && lineContent.includes(word.word)) {
          modulePath = importFromMatch[1];
        } else if (dynamicImportMatch && lineContent.includes(word.word)) {
          modulePath = dynamicImportMatch[1];
        } else if (requireMatch && lineContent.includes(word.word)) {
          modulePath = requireMatch[1];
        } else if (urlMatch && lineContent.includes(word.word)) {
          modulePath = urlMatch[1];
        }
        
        if (modulePath) {
          // Проверяем, является ли это npm пакетом (не начинается с ./ или ../)
          isNpmPackage = !modulePath.startsWith('./') && !modulePath.startsWith('../') && !modulePath.startsWith('/');
          
          // Формируем дополнительную информацию о пути
          let additionalInfo = '';
          
          if (isNpmPackage) {
            // Получаем имя пакета (до первого /)
            const packageName = modulePath.split('/')[0];
            
            // Предоставляем информацию о популярных пакетах
            const packageInfo: Record<string, string> = {
              'react': 'Библиотека для создания пользовательских интерфейсов',
              'react-dom': 'DOM-рендерер для React',
              'next': 'Фреймворк для React с серверным рендерингом',
              '@next': 'Модули фреймворка Next.js',
              'express': 'Веб-фреймворк для Node.js',
              'axios': 'HTTP-клиент на основе Promise',
              'lodash': 'Утилитарная библиотека для JavaScript',
              '@types': 'TypeScript типы для библиотек',
              'redux': 'Контейнер состояния для JavaScript приложений',
              'vue': 'Прогрессивный JavaScript-фреймворк',
              'angular': 'Фреймворк для создания одностраничных приложений',
              'jQuery': 'Библиотека для упрощения работы с DOM',
              'mongoose': 'MongoDB ODM для Node.js',
              'sequelize': 'ORM для Node.js (поддерживает MySQL, PostgreSQL, SQLite)',
              'webpack': 'Сборщик модулей для JavaScript',
              'babel': 'Транспилятор JavaScript',
              'eslint': 'Инструмент для статического анализа кода',
              'jest': 'Фреймворк для тестирования JavaScript',
              'mocha': 'Фреймворк для тестирования JavaScript',
              'chai': 'Библиотека утверждений для тестирования',
              'moment': 'Библиотека для работы с датами и временем',
              'date-fns': 'Современная библиотека для работы с датами',
              'styled-components': 'Библиотека для стилизации компонентов в React',
              'tailwindcss': 'CSS-фреймворк для быстрой разработки интерфейсов',
              'bootstrap': 'CSS-фреймворк для быстрого создания адаптивных сайтов',
              'material-ui': 'React компоненты в стиле Material Design',
              '@mui': 'Material-UI компоненты (новая версия)',
              'antd': 'React UI-библиотека с дизайном Ant Design',
              'apollo-client': 'Клиент для работы с GraphQL',
              'graphql': 'Язык запросов для API',
              'rxjs': 'Библиотека для реактивного программирования',
              'typescript': 'Строго типизированный надмножество JavaScript',
              'node-fetch': 'Реализация fetch API для Node.js',
              'fs-extra': 'Расширенная библиотека файловой системы для Node.js',
              'path': 'Встроенный модуль Node.js для работы с путями',
              'fs': 'Встроенный модуль Node.js для работы с файловой системой',
              'http': 'Встроенный модуль Node.js для HTTP-сервера',
              'https': 'Встроенный модуль Node.js для HTTPS-сервера',
              'url': 'Встроенный модуль Node.js для работы с URL',
              'util': 'Встроенный модуль Node.js с утилитами',
              'crypto': 'Встроенный модуль Node.js для криптографии',
              'events': 'Встроенный модуль Node.js для работы с событиями',
              'stream': 'Встроенный модуль Node.js для потоковой обработки данных',
              'zlib': 'Встроенный модуль Node.js для сжатия данных',
              'querystring': 'Встроенный модуль Node.js для работы с query string',
              'os': 'Встроенный модуль Node.js для работы с операционной системой',
              'child_process': 'Встроенный модуль Node.js для работы с дочерними процессами',
            };
            
            // Получаем информацию о пакете, если она доступна
            const packageInfoText = packageInfo[packageName] || '';
            
            // Формируем дополнительную информацию
            additionalInfo = `**NPM пакет**: \`${packageName}\`${packageInfoText ? '\n\n' + packageInfoText : ''}`;
            
            // Дополнительная информация для пакетов Next.js
            if (packageName === 'next' || packageName === '@next') {
              const nextModulePath = modulePath.substring(packageName.length + 1);
              const nextModuleInfo: Record<string, string> = {
                'router': 'API для маршрутизации в Next.js приложениях',
                'link': 'Компонент для клиентской навигации между страницами',
                'head': 'Компонент для изменения заголовка и метаданных страницы',
                'script': 'Компонент для загрузки внешних скриптов',
                'image': 'Компонент для оптимизации изображений',
                'document': 'Компонент для настройки общей структуры документа',
                'app': 'Компонент для настройки глобального состояния приложения',
                'error': 'Компонент для обработки ошибок',
                'config': 'Функции для доступа к конфигурации Next.js',
                'server': 'API для серверной части Next.js',
                'dynamic': 'Функция для динамической загрузки компонентов',
                'types': 'TypeScript типы для Next.js',
              };
              
              let nextModuleInfoText = '';
              for (const [key, value] of Object.entries(nextModuleInfo)) {
                if (nextModulePath === key || nextModulePath.startsWith(key + '/')) {
                  nextModuleInfoText = value;
                  break;
                }
              }
              
              if (nextModuleInfoText) {
                additionalInfo += `\n\n**Next.js модуль**: \`${nextModulePath}\`\n\n${nextModuleInfoText}`;
              }
            }
          } else if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
            // Относительный путь к локальному файлу
            additionalInfo = 'Относительный путь к файлу в проекте. ' + 
              (modulePath.startsWith('./') 
                ? 'Указывает на файл в текущей директории.' 
                : 'Указывает на файл в родительской директории.');
          } else if (modulePath.startsWith('/')) {
            // Абсолютный путь
            additionalInfo = 'Абсолютный путь к файлу, отсчитываемый от корня проекта.';
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `Путь к модулю, который импортируется в текущий файл.\n\n${additionalInfo}` }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Добавляем поддержку отображения путей в JSX/TSX файлах
    // @ts-ignore
    monaco.languages.registerHoverProvider('typescriptreact', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const text = model.getValue();
        const lineContent = model.getLineContent(position.lineNumber);
        
        // Проверяем пути в атрибутах JSX
        const srcMatch = lineContent.match(/src=["']([^"']+)["']/);
        const hrefMatch = lineContent.match(/href=["']([^"']+)["']/);
        const pathMatch = lineContent.match(/path=["']([^"']+)["']/);
        
        let attributePath = null;
        let attributeType = '';
        
        if (srcMatch && lineContent.includes(word.word)) {
          attributePath = srcMatch[1];
          attributeType = 'src';
        } else if (hrefMatch && lineContent.includes(word.word)) {
          attributePath = hrefMatch[1];
          attributeType = 'href';
        } else if (pathMatch && lineContent.includes(word.word)) {
          attributePath = pathMatch[1];
          attributeType = 'path';
        }
        
        if (attributePath) {
          let description = '';
          
          switch (attributeType) {
            case 'src':
              description = 'Путь к ресурсу (изображение, видео, скрипт). Используется в тегах img, script, iframe и др.';
              break;
            case 'href':
              description = 'Гиперссылка на другую страницу или ресурс. Используется в тегах a, link и др.';
              break;
            case 'path':
              description = 'Путь к ресурсу или маршрут приложения.';
              break;
          }
          
          return {
            contents: [
              { value: `**Ресурс (${attributeType}):** \`${attributePath}\`` },
              { value: description }
            ]
          };
        }
        
        // Проверяем импорты как в обычных .ts файлах
        const importFromMatch = new RegExp(`import\\s+.*?\\s+from\\s+['"](.+?)['"]`).exec(lineContent);
        if (importFromMatch && lineContent.includes(word.word)) {
          return {
            contents: [
              { value: `**Модуль:** \`${importFromMatch[1]}\`` },
              { value: 'Путь к модулю, который импортируется в текущий файл. Может содержать React компоненты, хуки, утилиты или типы.' }
            ]
          };
        }
        
        // Проверка на React компонент
        const componentMatch = new RegExp(`(function|const)\\s+${word.word}\\s*[:=]\\s*(React\\.FC|\\(props)`).exec(text);
        if (componentMatch || (word.word.match(/^[A-Z]/) && text.includes(`<${word.word}`))) {
          return {
            contents: [
              { value: `**React компонент:** \`${word.word}\`` },
              { value: 'React компонент, который возвращает JSX элементы. Компоненты в React всегда должны начинаться с заглавной буквы.' }
            ]
          };
        }
        
        // Проверка на React хук
        const hookMatch = new RegExp(`\\b(use[A-Z][a-zA-Z]*)`).exec(word.word);
        if (hookMatch) {
          const hookDescriptions: Record<string, string> = {
            useState: 'Хук для добавления состояния в функциональный компонент. Возвращает текущее значение состояния и функцию для его обновления.',
            useEffect: 'Хук для выполнения побочных эффектов в функциональных компонентах. Позволяет выполнять код при монтировании, обновлении и размонтировании компонента.',
            useContext: 'Хук для доступа к значению контекста React. Принимает объект контекста и возвращает текущее значение этого контекста.',
            useReducer: 'Альтернатива useState для более сложной логики состояния. Принимает редуктор и начальное состояние, возвращает текущее состояние и функцию dispatch.',
            useCallback: 'Возвращает мемоизированную версию колбэк-функции, которая изменяется только при изменении зависимостей.',
            useMemo: 'Возвращает мемоизированное значение, которое пересчитывается только при изменении зависимостей.',
            useRef: 'Возвращает изменяемый ref-объект, .current свойство которого инициализируется переданным аргументом.',
            useLayoutEffect: 'Версия useEffect, которая запускается синхронно после всех DOM-изменений, но до отрисовки экрана браузером.',
            useImperativeHandle: 'Позволяет кастомизировать экземпляр, который предоставляется родительскому компоненту при использовании ref.',
            useDebugValue: 'Используется для отображения метки для пользовательских хуков в React DevTools.',
            useTransition: 'Позволяет помечать некоторые обновления состояния как некритичные, чтобы они могли быть прерваны более важными обновлениями.',
            useDeferredValue: 'Принимает значение и возвращает новую копию этого значения, которая может "отставать" от оригинала.',
          };
          
          return {
            contents: [
              { value: `**React хук:** \`${word.word}\`` },
              { value: hookDescriptions[word.word] || 'Пользовательский React хук. Хуки в React всегда должны начинаться с "use" и вызываться только на верхнем уровне функционального компонента.' }
            ]
          };
        }
        
        // Проверка на JSX атрибуты
        const jsxAttributeMatch = lineContent.match(new RegExp(`\\b${word.word}\\s*=\\s*["{\\[]`));
        if (jsxAttributeMatch) {
          const commonAttributes: Record<string, string> = {
            className: 'Определяет CSS класс для элемента (аналог атрибута class в HTML).',
            style: 'Объект со стилями для элемента. Свойства записываются в camelCase (например, backgroundColor вместо background-color).',
            onClick: 'Обработчик события клика по элементу.',
            onChange: 'Обработчик события изменения значения (для input, select и textarea).',
            onSubmit: 'Обработчик отправки формы.',
            value: 'Значение элемента формы.',
            placeholder: 'Подсказка, отображаемая в элементе формы, когда он пуст.',
            disabled: 'Флаг, указывающий, что элемент отключен.',
            required: 'Флаг, указывающий, что поле обязательно для заполнения.',
            id: 'Уникальный идентификатор элемента.',
            key: 'Специальный атрибут React для идентификации элементов в списке.',
            ref: 'Ссылка на DOM-элемент или инстанс компонента.',
            type: 'Тип элемента (для input, button и др.).',
            href: 'Адрес, на который указывает ссылка.',
            src: 'Путь к ресурсу (изображение, видео и др.).',
            alt: 'Альтернативный текст для изображения.',
            target: 'Определяет, где открывать ссылку (для тега a).',
            name: 'Имя элемента формы.',
            checked: 'Флаг, указывающий, что чекбокс или радиокнопка отмечены.',
            autoFocus: 'Флаг, указывающий, что элемент должен получить фокус при загрузке страницы.',
          };
          
          return {
            contents: [
              { value: `**JSX атрибут:** \`${word.word}\`` },
              { value: commonAttributes[word.word] || 'Атрибут JSX элемента. Может быть стандартным HTML атрибутом или пропсом компонента.' }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Добавляем поддержку отображения подсказок для javascriptreact (JSX)
    // @ts-ignore
    monaco.languages.registerHoverProvider('javascriptreact', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const text = model.getValue();
        const lineContent = model.getLineContent(position.lineNumber);
        
        // Проверяем, находится ли курсор на строке импорта
        if (lineContent.includes('import') || lineContent.includes('require')) {
          // Проверяем, находится ли курсор на пути в кавычках
          const modulePathMatch = lineContent.match(/['"]([^'"]+)['"]/);
          if (modulePathMatch && lineContent.indexOf(modulePathMatch[0]) <= position.column &&
              lineContent.indexOf(modulePathMatch[0]) + modulePathMatch[0].length >= position.column) {
            const modulePath = modulePathMatch[1];
            
            // Проверяем, является ли это npm пакетом
            const isNpmPackage = !modulePath.startsWith('./') && !modulePath.startsWith('../') && !modulePath.startsWith('/');
            
            // Формируем дополнительную информацию о пути
            let additionalInfo = '';
            
            if (isNpmPackage) {
              // Получаем имя пакета (до первого /)
              const packageName = modulePath.split('/')[0];
              
              // Предоставляем информацию о популярных пакетах
              const packageInfo: Record<string, string> = {
                'react': 'Библиотека для создания пользовательских интерфейсов',
                'react-dom': 'DOM-рендерер для React',
                'next': 'Фреймворк для React с серверным рендерингом',
                '@next': 'Модули фреймворка Next.js',
                'express': 'Веб-фреймворк для Node.js',
                'axios': 'HTTP-клиент на основе Promise',
                'lodash': 'Утилитарная библиотека для JavaScript',
                '@types': 'TypeScript типы для библиотек',
                'redux': 'Контейнер состояния для JavaScript приложений',
                'vue': 'Прогрессивный JavaScript-фреймворк',
                'angular': 'Фреймворк для создания одностраничных приложений',
                'jQuery': 'Библиотека для упрощения работы с DOM',
                'mongoose': 'MongoDB ODM для Node.js',
                'sequelize': 'ORM для Node.js (поддерживает MySQL, PostgreSQL, SQLite)',
                'webpack': 'Сборщик модулей для JavaScript',
                'babel': 'Транспилятор JavaScript',
                'eslint': 'Инструмент для статического анализа кода',
                'jest': 'Фреймворк для тестирования JavaScript',
                'mocha': 'Фреймворк для тестирования JavaScript',
                'chai': 'Библиотека утверждений для тестирования',
                'moment': 'Библиотека для работы с датами и временем',
                'date-fns': 'Современная библиотека для работы с датами',
                'styled-components': 'Библиотека для стилизации компонентов в React',
                'tailwindcss': 'CSS-фреймворк для быстрой разработки интерфейсов',
                'bootstrap': 'CSS-фреймворк для быстрого создания адаптивных сайтов',
                'material-ui': 'React компоненты в стиле Material Design',
                '@mui': 'Material-UI компоненты (новая версия)',
                'antd': 'React UI-библиотека с дизайном Ant Design',
                'apollo-client': 'Клиент для работы с GraphQL',
                'graphql': 'Язык запросов для API',
                'rxjs': 'Библиотека для реактивного программирования',
                'typescript': 'Строго типизированный надмножество JavaScript',
                'node-fetch': 'Реализация fetch API для Node.js',
                'fs-extra': 'Расширенная библиотека файловой системы для Node.js',
                'path': 'Встроенный модуль Node.js для работы с путями',
                'fs': 'Встроенный модуль Node.js для работы с файловой системой',
                'http': 'Встроенный модуль Node.js для HTTP-сервера',
                'https': 'Встроенный модуль Node.js для HTTPS-сервера',
                'url': 'Встроенный модуль Node.js для работы с URL',
                'util': 'Встроенный модуль Node.js с утилитами',
                'crypto': 'Встроенный модуль Node.js для криптографии',
                'events': 'Встроенный модуль Node.js для работы с событиями',
                'stream': 'Встроенный модуль Node.js для потоковой обработки данных',
                'zlib': 'Встроенный модуль Node.js для сжатия данных',
                'querystring': 'Встроенный модуль Node.js для работы с query string',
                'os': 'Встроенный модуль Node.js для работы с операционной системой',
                'child_process': 'Встроенный модуль Node.js для работы с дочерними процессами',
              };
              
              // Получаем информацию о пакете, если она доступна
              const packageInfoText = packageInfo[packageName] || '';
              
              // Формируем дополнительную информацию
              additionalInfo = `**NPM пакет**: \`${packageName}\`${packageInfoText ? '\n\n' + packageInfoText : ''}`;
              
              // Дополнительная информация для пакетов Next.js
              if (packageName === 'next' || packageName === '@next') {
                const nextModulePath = modulePath.substring(packageName.length + 1);
                const nextModuleInfo: Record<string, string> = {
                  'router': 'API для маршрутизации в Next.js приложениях',
                  'link': 'Компонент для клиентской навигации между страницами',
                  'head': 'Компонент для изменения заголовка и метаданных страницы',
                  'script': 'Компонент для загрузки внешних скриптов',
                  'image': 'Компонент для оптимизации изображений',
                  'document': 'Компонент для настройки общей структуры документа',
                  'app': 'Компонент для настройки глобального состояния приложения',
                  'error': 'Компонент для обработки ошибок',
                  'config': 'Функции для доступа к конфигурации Next.js',
                  'server': 'API для серверной части Next.js',
                  'dynamic': 'Функция для динамической загрузки компонентов',
                  'types': 'TypeScript типы для Next.js',
                };
                
                let nextModuleInfoText = '';
                for (const [key, value] of Object.entries(nextModuleInfo)) {
                  if (nextModulePath === key || nextModulePath.startsWith(key + '/')) {
                    nextModuleInfoText = value;
                    break;
                  }
                }
                
                if (nextModuleInfoText) {
                  additionalInfo += `\n\n**Next.js модуль**: \`${nextModulePath}\`\n\n${nextModuleInfoText}`;
                }
              }
            } else if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
              // Относительный путь к локальному файлу
              additionalInfo = 'Относительный путь к файлу в проекте. ' + 
                (modulePath.startsWith('./') 
                  ? 'Указывает на файл в текущей директории.' 
                  : 'Указывает на файл в родительской директории.');
            } else if (modulePath.startsWith('/')) {
              // Абсолютный путь
              additionalInfo = 'Абсолютный путь к файлу, отсчитываемый от корня проекта.';
            }
            
            return {
              contents: [
                { value: `**Модуль:** \`${modulePath}\`` },
                { value: `Путь к модулю, который импортируется в текущий файл.\n\n${additionalInfo}` }
              ]
            };
          }
        }
        
        // Проверяем пути в атрибутах JSX
        const attributeMatches = [
          { regex: /src=["']([^"']+)["']/, name: 'src', desc: 'Путь к ресурсу (изображение, видео, скрипт). Используется в тегах img, script, iframe и др.' },
          { regex: /href=["']([^"']+)["']/, name: 'href', desc: 'Гиперссылка на другую страницу или ресурс. Используется в тегах a, link и др.' },
          { regex: /path=["']([^"']+)["']/, name: 'path', desc: 'Путь к ресурсу или маршрут приложения.' },
          { regex: /to=["']([^"']+)["']/, name: 'to', desc: 'Адрес назначения, обычно используется в компонентах маршрутизации, таких как React Router.' },
          { regex: /url=["']([^"']+)["']/, name: 'url', desc: 'URL-адрес ресурса или API.' },
          { regex: /source=["']([^"']+)["']/, name: 'source', desc: 'Источник данных или пути к ресурсу.' },
        ];
        
        for (const { regex, name, desc } of attributeMatches) {
          const match = lineContent.match(regex);
          if (match && match[1] && lineContent.indexOf(match[0]) <= position.column && 
              lineContent.indexOf(match[0]) + match[0].length >= position.column) {
            const path = match[1];
            
            // Определяем тип пути
            let pathDesc = desc;
            if (path.startsWith('http://') || path.startsWith('https://')) {
              pathDesc += '\n\nАбсолютный URL-адрес внешнего ресурса.';
            } else if (path.startsWith('./') || path.startsWith('../')) {
              pathDesc += '\n\nОтносительный путь к файлу в проекте.';
            } else if (path.startsWith('/')) {
              pathDesc += '\n\nАбсолютный путь от корня приложения.';
            } else if (!path.includes('/') && !path.includes('.')) {
              pathDesc += '\n\nВозможно, это внутренний маршрут приложения или ключ для динамического ресурса.';
            }
            
            return {
              contents: [
                { value: `**${name}:** \`${path}\`` },
                { value: pathDesc }
              ]
            };
          }
        }
        
        // Проверка на React компонент
        const componentMatch = new RegExp(`(function|const)\\s+${word.word}\\s*[:=]\\s*(React\\.FC|\\(props)`).exec(text);
        if (componentMatch || (word.word.match(/^[A-Z]/) && text.includes(`<${word.word}`))) {
          return {
            contents: [
              { value: `**React компонент:** \`${word.word}\`` },
              { value: 'React компонент, который возвращает JSX элементы. Компоненты в React всегда должны начинаться с заглавной буквы.' }
            ]
          };
        }
        
        // Проверка на React хуки
        if (word.word.startsWith('use') && word.word.length > 3) {
          const secondChar = word.word.charAt(3);
          if (secondChar === secondChar.toUpperCase()) {
            const hookDescriptions: Record<string, string> = {
              useState: 'Хук для добавления состояния в функциональный компонент. Возвращает текущее значение состояния и функцию для его обновления.',
              useEffect: 'Хук для выполнения побочных эффектов в функциональных компонентах. Позволяет выполнять код при монтировании, обновлении и размонтировании компонента.',
              useContext: 'Хук для доступа к значению контекста React. Принимает объект контекста и возвращает текущее значение этого контекста.',
              useReducer: 'Альтернатива useState для более сложной логики состояния. Принимает редуктор и начальное состояние, возвращает текущее состояние и функцию dispatch.',
              useCallback: 'Возвращает мемоизированную версию колбэк-функции, которая изменяется только при изменении зависимостей.',
              useMemo: 'Возвращает мемоизированное значение, которое пересчитывается только при изменении зависимостей.',
              useRef: 'Возвращает изменяемый ref-объект, .current свойство которого инициализируется переданным аргументом.',
              useLayoutEffect: 'Версия useEffect, которая запускается синхронно после всех DOM-изменений, но до отрисовки экрана браузером.',
              useImperativeHandle: 'Позволяет кастомизировать экземпляр, который предоставляется родительскому компоненту при использовании ref.',
              useDebugValue: 'Используется для отображения метки для пользовательских хуков в React DevTools.',
              useTransition: 'Позволяет помечать некоторые обновления состояния как некритичные, чтобы они могли быть прерваны более важными обновлениями.',
              useDeferredValue: 'Принимает значение и возвращает новую копию этого значения, которая может "отставать" от оригинала.',
            };
            
            return {
              contents: [
                { value: `**React хук:** \`${word.word}\`` },
                { value: hookDescriptions[word.word] || 'Хук React, используемый для добавления состояния и других возможностей React в функциональные компоненты.' }
              ]
            };
          }
        }
        
        // Проверка на JSX атрибуты
        const jsxAttributeMatch = lineContent.match(new RegExp(`\\b${word.word}\\s*=\\s*["{\\[]`));
        if (jsxAttributeMatch) {
          const commonAttributes: Record<string, string> = {
            className: 'Определяет CSS класс для элемента (аналог атрибута class в HTML).',
            style: 'Объект со стилями для элемента. Свойства записываются в camelCase (например, backgroundColor вместо background-color).',
            onClick: 'Обработчик события клика по элементу.',
            onChange: 'Обработчик события изменения значения (для input, select и textarea).',
            onSubmit: 'Обработчик отправки формы.',
            value: 'Значение элемента формы.',
            placeholder: 'Подсказка, отображаемая в элементе формы, когда он пуст.',
            disabled: 'Флаг, указывающий, что элемент отключен.',
            required: 'Флаг, указывающий, что поле обязательно для заполнения.',
            id: 'Уникальный идентификатор элемента.',
            key: 'Специальный атрибут React для идентификации элементов в списке.',
            ref: 'Ссылка на DOM-элемент или инстанс компонента.',
            type: 'Тип элемента (для input, button и др.).',
            href: 'Адрес, на который указывает ссылка.',
            src: 'Путь к ресурсу (изображение, видео и др.).',
            alt: 'Альтернативный текст для изображения.',
            target: 'Определяет, где открывать ссылку (для тега a).',
            name: 'Имя элемента формы.',
            checked: 'Флаг, указывающий, что чекбокс или радиокнопка отмечены.',
            autoFocus: 'Флаг, указывающий, что элемент должен получить фокус при загрузке страницы.',
          };
          
          return {
            contents: [
              { value: `**JSX атрибут:** \`${word.word}\`` },
              { value: commonAttributes[word.word] || 'Атрибут JSX элемента. Может быть стандартным HTML атрибутом или пропсом компонента.' }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Настройка JSX типов
    // @ts-ignore - игнорируем несоответствие типов для configureJSXTypes
    configureJSXTypes(monaco);
    
    // Добавляем определение общих модулей и компонентов, которые могут отсутствовать
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module '../components/app_topbar/topbar' {
        export interface TopbarProps {
          [key: string]: any;
        }
        const Topbar: React.FC<TopbarProps>;
        export default Topbar;
      }
      
      declare module '../components/*' {
        const Component: React.FC<any>;
        export default Component;
      }

      declare module '@/components/*' {
        const Component: React.FC<any>;
        export default Component;
      }

      declare module 'components/*' {
        const Component: React.FC<any>;
        export default Component;
      }
      `,
      'file:///node_modules/app-components.d.ts'
    );
    
    // Добавляем определения для Next.js
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module 'next' {
        export type NextPage<P = {}, IP = P> = React.FC<P>;
        export type GetServerSideProps<P = {}> = (context: any) => Promise<{ props: P }>;
        export type GetStaticProps<P = {}> = (context: any) => Promise<{ props: P }>;
        export type GetStaticPaths = () => Promise<{ paths: any[], fallback: boolean | 'blocking' }>;
        export default function createNext(options?: any): any;
      }
      
      declare module 'next/app' {
        export type AppProps = any;
        export default function App(props: AppProps): JSX.Element;
      }
      
      declare module 'next/head' {
        export default function Head(props: any): JSX.Element;
      }
      
      declare module 'next/link' {
        export interface LinkProps {
          href: string;
          as?: string;
          replace?: boolean;
          scroll?: boolean;
          shallow?: boolean;
          passHref?: boolean;
          prefetch?: boolean;
          locale?: string | false;
          [key: string]: any;
        }
        export default function Link(props: LinkProps): JSX.Element;
      }
      
      declare module 'next/router' {
        export interface Router {
          route: string;
          pathname: string;
          query: any;
          asPath: string;
          push(url: string, as?: string, options?: any): Promise<boolean>;
          replace(url: string, as?: string, options?: any): Promise<boolean>;
          reload(): void;
          back(): void;
          prefetch(url: string, as?: string, options?: any): Promise<void>;
          events: {
            on(event: string, callback: (...args: any[]) => void): void;
            off(event: string, callback: (...args: any[]) => void): void;
            emit(event: string, ...args: any[]): void;
          };
        }
        export function useRouter(): Router;
      }
      `,
      'file:///node_modules/@types/next/index.d.ts'
    );
    
    // Добавляем определения для Prisma Client
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module '@prisma/client' {
        export class PrismaClient {
          constructor(options?: any);
          connect(): Promise<void>;
          disconnect(): Promise<void>;
          $use(middleware: any): void;
          $on(eventType: any, callback: any): void;
          $executeRaw(query: any, ...values: any[]): Promise<number>;
          $queryRaw(query: any, ...values: any[]): Promise<any[]>;
          $transaction<R>(fn: (prisma: PrismaClient) => Promise<R>): Promise<R>;
          [modelName: string]: any;
        }
        export namespace Prisma {
          export type Decimal = number;
          export class Decimal {
            constructor(value: number | string);
            toFixed(precision?: number): string;
            toString(): string;
            toNumber(): number;
          }
        }
      }
      `,
      'file:///node_modules/@types/prisma/index.d.ts'
    );
    
    // Конфигурация для JSON файлов, если они поддерживаются
    // @ts-ignore - игнорируем несоответствие типов для monaco.languages.json
    if (monaco.languages.json) {
      // @ts-ignore - игнорируем несоответствие типов для jsonDefaults
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemaValidation: 'error',
        schemaRequest: 'warning'
      });
    }

    // Добавляем расширенные типы для JSX
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      jsxIntrinsicElementsDefinitions,
      'file:///node_modules/@types/react/index.d.ts'
    );

    // Если режим разработки, добавляем тестовую кнопку и отладочные инструменты
    if (isDevelopmentMode) {
      // Добавляем тестовую кнопку только в режиме разработки
      setTimeout(() => {
        try {
          createTestButton();
          enableMonacoDebugTools();
          console.log('Monaco Editor test tools enabled');
        } catch (error) {
          console.error('Failed to enable Monaco test tools:', error);
        }
      }, 1000);
    }

    // Добавляем определения для распространенных веб-платформенных типов, 
    // которые могут использоваться с type assertions в .js/.jsx файлах
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      `
      interface HTMLElement {
        id: string;
        className: string;
        style: any;
        dataset: any;
        addEventListener(event: string, callback: Function): void;
        removeEventListener(event: string, callback: Function): void;
        appendChild(node: any): any;
        removeChild(node: any): any;
        getAttribute(name: string): string | null;
        setAttribute(name: string, value: string): void;
        removeAttribute(name: string): void;
        focus(): void;
        blur(): void;
        click(): void;
      }
      
      interface CSSStyleDeclaration {
        backgroundColor: string;
        color: string;
        display: string;
        position: string;
        width: string;
        height: string;
        margin: string;
        padding: string;
        border: string;
        fontSize: string;
        fontFamily: string;
        [key: string]: any;
      }
      
      interface UIFileItem {
        name: string;
        path: string;
        isFolder?: boolean;
        expanded?: boolean;
        loaded?: boolean;
        icon?: string;
        type?: string;
        isDirectory?: boolean;
        content?: string;
      }
      `,
      'file:///global-types.d.ts'
    );

    // Применяем специфичные настройки для каждого открытого файла
    openedFiles.forEach(file => {
      try {
        const filePath = file.path || file.filePath || '';
        if (!filePath) return;
        
        // Применяем конфигурацию языка для файла - это включает настройку компилятора и 
        // обработку модели, включая игнорирование ошибок TypeScript в JS файлах
        applyLanguageConfiguration(filePath, monacoInstance);
        
        // Определяем тип файла и язык
        const extension = getFileExtension(filePath);
        const language = getLanguageFromExtension(extension);
        
        // Настраиваем JSX поддержку если нужно
        if (isJSXFile(filePath)) {
          configureJSXTypes(monaco);
        }
      } catch (err) {
        console.error(`Error configuring file: ${file.path}`, err);
      }
    });

    // Добавляем функцию для отображения ошибок непосредственно в редакторе
    window.setupErrorDecorations = (editor: any) => {
      if (!editor || !window.monaco) return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Получаем все маркеры для текущей модели
      const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
      console.log(`Найдено ${markers.length} маркеров для модели ${model.uri.toString()}`);
      
      // Создаем декорации для ошибок и предупреждений
      const errorDecorations = markers.map((marker: any) => {
        const isError = marker.severity === window.monaco.MarkerSeverity.Error;
        const isWarning = marker.severity === window.monaco.MarkerSeverity.Warning;
        
        if (!isError && !isWarning) return null;
        
        // Тип декорации в зависимости от типа ошибки
        const className = isError ? 'monaco-error-decoration' : 'monaco-warning-decoration';
        
        // Формируем полное сообщение с указанием типа ошибки
        const messagePrefix = isError ? '🔴 Ошибка: ' : '⚠️ Предупреждение: ';
        
        return {
          range: new window.monaco.Range(
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn
          ),
          options: {
            inlineClassName: className,
            hoverMessage: {
              value: messagePrefix + marker.message
            },
            className: isError ? 'squiggly-error' : 'squiggly-warning',
            marginClassName: isError ? 'margin-error' : 'margin-warning',
            isWholeLine: false,
            stickiness: 1 // Сохраняем декорации при редактировании
          }
        };
      }).filter(Boolean);
      
      // Получаем текущие декорации, если они есть
      let currentDecorations: string[] = [];
      if (editor._errorDecorations) {
        currentDecorations = editor._errorDecorations;
      }
      
      // Применяем декорации к редактору и сохраняем их ID
      editor._errorDecorations = editor.deltaDecorations(currentDecorations, errorDecorations);
      
      console.log(`Применено ${errorDecorations.length} декораций к редактору`);
    };
    
    // Добавляем стили для декораций ошибок с более яркими цветами
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .monaco-error-decoration {
        background-color: rgba(255, 0, 0, 0.3) !important;
        border-bottom: 2px wavy #ff0000 !important;
        font-weight: bold;
      }
      .monaco-warning-decoration {
        background-color: rgba(255, 166, 0, 0.2) !important;
        border-bottom: 2px wavy #ff9800 !important;
      }
      .squiggly-error {
        background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ff0000'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
      }
      .squiggly-warning {
        background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ff9800'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
      }
      .margin-error {
        background-color: #ff0000 !important;
        width: 5px !important;
      }
      .margin-warning {
        background-color: #ff9800 !important;
        width: 5px !important;
      }
    `;
    document.head.appendChild(styleSheet);
    
    // Регистрируем обработчик события изменения маркеров
    window.monaco.editor.onDidChangeMarkers((e: any) => {
      const editors = window.monaco.editor.getEditors();
      editors.forEach((editor: any) => {
        const model = editor.getModel();
        if (model && e.includes(model.uri)) {
          window.setupErrorDecorations(editor);
        }
      });
    });

    // Принудительно применяем декорации ко всем существующим редакторам
    const existingEditors = window.monaco.editor.getEditors();
    for (const editor of existingEditors) {
      window.setupErrorDecorations(editor);
    }

    // Добавляем обработчик события создания редактора
    window.monaco.editor.onDidCreateEditor((editor: any) => {
      setTimeout(() => {
        window.setupErrorDecorations(editor);
      }, 100);
    });

    // Также отслеживаем событие смены модели редактора
    window.monaco.editor.onDidChangeModelContent((e: any) => {
      const model = e.model;
      if (model && model.uri.path.endsWith('.py')) {
        const editors = window.monaco.editor.getEditors().filter(
          (editor: any) => editor.getModel() && editor.getModel().uri.toString() === model.uri.toString()
        );
        
        editors.forEach((editor: any) => {
          setTimeout(() => {
            window.setupErrorDecorations(editor);
          }, 100);
        });
      }
    });

    // Добавляем функцию для быстрой проверки Python-кода на ошибки синтаксиса без LSP
    window.validatePythonSyntax = (content: string, modelUri: any): any[] => {
      if (!content || !window.monaco) return [];
      
      const markers: any[] = [];
      
      try {
        // Основные ошибки синтаксиса Python, которые можно обнаружить с помощью регулярных выражений
        const lines = content.split('\n');
        
        lines.forEach((line, lineIndex) => {
          const trimmedLine = line.trim();
          
          // Игнорируем пустые строки и комментарии
          if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            return;
          }
          
          // Проверка функции print без скобок (Python 3 требует скобки)
          if (/^print\s+[^(]/.test(trimmedLine)) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'В Python 3 функция print требует скобки',
              startLineNumber: lineIndex + 1,
              startColumn: line.indexOf('print') + 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.indexOf('print') + 6,
              source: 'python-syntax'
            });
          }
          
          // Пропущенные ":" после блочных конструкций
          if (/^(if|elif|else|for|while|def|class|with|try|except|finally)\b.*[^:)]\s*$/.test(trimmedLine)) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Ожидается двоеточие ":" в конце блочной конструкции',
              startLineNumber: lineIndex + 1,
              startColumn: line.length,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-syntax'
            });
          }
          
          // Проверка незакрытых скобок в строке
          const openParens = (line.match(/\(/g) || []).length;
          const closeParens = (line.match(/\)/g) || []).length;
          
          if (openParens !== closeParens && !line.trim().endsWith('\\')) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Непарные круглые скобки в строке',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-syntax'
            });
          }
          
          // Проверка незакрытых кавычек
          const singleQuotes = (line.match(/'/g) || []).length;
          const doubleQuotes = (line.match(/"/g) || []).length;
          
          if ((singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) && 
              !line.includes('"""') && !line.includes("'''")) {
            markers.push({
              severity: window.monaco.MarkerSeverity.Error,
              message: 'Незакрытые строковые литералы',
              startLineNumber: lineIndex + 1,
              startColumn: 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.length + 1,
              source: 'python-syntax'
            });
          }
        });
        
        // Если найдены маркеры, устанавливаем их для модели
        if (markers.length > 0) {
          window.monaco.editor.setModelMarkers(
            window.monaco.editor.getModel(modelUri), 
            'python-syntax-check', 
            markers
          );
        }
        
        return markers;
      } catch (error) {
        console.error('Ошибка при проверке Python синтаксиса:', error);
        return [];
      }
    };

    // Добавляем слушатель изменений моделей для проверки синтаксиса Python на лету
    window.monaco.editor.onDidCreateModel((model: any) => {
      const uri = model.uri.toString();
      
      // Проверяем, что это Python файл
      if (uri.endsWith('.py') || getLanguageFromExtension(uri.split('.').pop()) === 'python') {
        console.log(`Зарегистрирован слушатель изменений для Python файла: ${uri}`);
        
        // Начальная проверка синтаксиса
        if (window.validatePythonSyntax) {
          window.validatePythonSyntax(model.getValue(), model.uri);
        }
        
        // Слушатель изменений содержимого модели
        model.onDidChangeContent(() => {
          console.log(`Изменение содержимого Python модели: ${uri}`);
          
          // Запускаем немедленную проверку синтаксиса
          if (window.validatePythonSyntax) {
            window.validatePythonSyntax(model.getValue(), model.uri);
          }
          
          // Обновляем декорации во всех редакторах для этой модели
          if (window.setupErrorDecorations) {
            const editors = window.monaco.editor.getEditors();
            editors.forEach((editor: any) => {
              if (editor.getModel().uri.toString() === uri) {
                window.setupErrorDecorations(editor);
              }
            });
          }
          
          // Запускаем полную Python диагностику с небольшой задержкой
          if (window.updatePythonDiagnostics) {
            // Используем объект как хранилище таймаута, добавляя проверку
            if (!model._pythonDiagnosticsTimeout) {
              model._pythonDiagnosticsTimeout = null;
            }
            
            clearTimeout(model._pythonDiagnosticsTimeout);
            model._pythonDiagnosticsTimeout = setTimeout(() => {
              if (window.updatePythonDiagnostics) {
                window.updatePythonDiagnostics(uri);
              }
            }, 500);
          }
        });
      }
    });
  } catch (error) {
    console.error('Error configuring Monaco:', error);
  }
}

/**
 * Пытается загрузить VSCode-подобные настройки линтера из проекта
 */
function tryLoadVSCodeSettings() {
  try {
    console.log('Пытаюсь загрузить настройки VSCode...');
    // Проверка на наличие локальных настроек VSCode
    fetch('.vscode/settings.json')
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Файл настроек VSCode не найден');
      })
      .then(settings => {
        console.log('Загружены настройки VSCode:', settings);
        
        // Создаём объект с настройками компилятора
        const compilerOptions: any = {};
                
        // Применяем настройки форматирования
        if (settings['editor.formatOnSave']) {
          console.log('Включено форматирование при сохранении');
        }
        
        // Применяем настройки линтера TypeScript
        if (settings['typescript.tsdk']) {
          console.log('Используется пользовательский TypeScript SDK:', settings['typescript.tsdk']);
        }
        
        // Применяем настройки tabSize к редактору
        if (settings['editor.tabSize']) {
          const models = monaco.editor.getModels();
          for (let i = 0; i < models.length; i++) {
            models[i].updateOptions({
              tabSize: settings['editor.tabSize']
            });
          }
        }
        
        // Применяем настройки noImplicitAny
        if (settings['typescript.preferences.noImplicitAny'] === false) {
          compilerOptions.noImplicitAny = false;
        }
        
        // Применяем строгую проверку типов
        if (settings['typescript.preferences.strictNullChecks'] === false) {
          compilerOptions.strictNullChecks = false;
        }
        
        // Применяем настройки moduleResolution
        if (settings['typescript.preferences.moduleResolution']) {
          const moduleResolution = settings['typescript.preferences.moduleResolution'];
          if (moduleResolution === 'node') {
            compilerOptions.moduleResolution = 2; // NodeJs
          } else if (moduleResolution === 'classic') {
            compilerOptions.moduleResolution = 1; // Classic
          } else if (moduleResolution === 'nodenext') {
            compilerOptions.moduleResolution = 3; // NodeNext
          }
        }
        
        // Игнорируемые диагностические коды
        if (settings['typescript.tsserver.ignoreDiagnostics']) {
          const ignoreDiagnostics = settings['typescript.tsserver.ignoreDiagnostics'];
          // Коды ошибок, которые нужно игнорировать
          let codesToIgnore: number[] = [];
          
          if (Array.isArray(ignoreDiagnostics)) {
            codesToIgnore = ignoreDiagnostics.map(code => Number(code));
          } else if (typeof ignoreDiagnostics === 'string') {
            codesToIgnore = ignoreDiagnostics.split(',').map(code => parseInt(code.trim(), 10));
          }
          
          if (codesToIgnore.length > 0) {
            // Добавляем игнорируемые коды к существующим диагностическим настройкам
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
              noSemanticValidation: false,
              noSyntaxValidation: false,
              diagnosticCodesToIgnore: [
                2307, 2792, 2688, 7027, 2304, 1005, 
                2451, 6133, 2769, 7005, 2355, 18002, 18003, 
                2306, 2665, 6196,
                ...codesToIgnore
              ]
            });
          }
        }
        
        // Применяем обновленные настройки компилятора если есть изменения
        if (Object.keys(compilerOptions).length > 0) {
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            ...compilerOptions,
            jsx: 2, // React
            target: 99, // ESNext
            moduleResolution: 2, // NodeJs
            module: 99, // ESNext
            allowNonTsExtensions: true,
            experimentalDecorators: true,
            noEmit: true,
            allowJs: true,
            typeRoots: ['node_modules/@types'],
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            esModuleInterop: true,
            skipLibCheck: true,
            noImplicitAny: false,
            strict: false,
            alwaysStrict: false
          });
        }
        
        console.log('Настройки VSCode применены к Monaco Editor');
      })
      .catch(error => {
        console.log('Не удалось загрузить настройки VSCode:', error.message);
      });
  } catch (error) {
    console.log('Ошибка при попытке загрузки настроек VSCode:', error);
  }
}

/**
 * Настраивает отображение подсказок при наведении на элементы
 */
function setupHoverProviders(monaco: any) {
  // Общая функция для обработки наведения
  const provideHoverFunction = function(model: any, position: any) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    
    const lineContent = model.getLineContent(position.lineNumber);
    
    // Различные регулярные выражения для поиска импортов
    const importPatterns = [
      // import ... from 'module'
      /import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/,
      // import('module')
      /import\(\s*['"]([^'"]+)['"]\s*\)/,
      // require('module')
      /require\(\s*['"]([^'"]+)['"]\s*\)/,
      // import type ... from 'module'
      /import\s+type\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/,
      // /// <reference path="module" />
      /<reference\s+path=['"]([^'"]+)['"]/,
      // @import 'module' (CSS импорты)
      /@import\s+['"]([^'"]+)['"]/
    ];
    
    // Проверяем каждый тип импорта
    for (const pattern of importPatterns) {
      const match = lineContent.match(pattern);
      if (match && lineContent.includes(word.word)) {
        const modulePath = match[1];
        const isNpmPackage = !modulePath.startsWith('./') && !modulePath.startsWith('../');
        
        let hoverContent = '';
        
        if (isNpmPackage) {
          // Информация о npm пакете
          const packageInfo: Record<string, string> = {
            'react': 'React - библиотека для создания пользовательских интерфейсов',
            'react-dom': 'ReactDOM - рендерер для React в браузере',
            'next': 'Next.js - фреймворк для React с SSR',
            '@tauri-apps': 'Tauri - фреймворк для создания нативных приложений',
            'monaco-editor': 'Monaco Editor - редактор кода, используемый в VS Code',
            '@monaco-editor/react': 'React компонент для Monaco Editor',
            'clsx': 'Утилита для условной конкатенации строк CSS классов',
            'tailwind-merge': 'Утилита для объединения Tailwind CSS классов без конфликтов',
            'react-player': 'Компонент для воспроизведения видео',
            'axios': 'HTTP-клиент для выполнения запросов',
            'lodash': 'Утилитарная библиотека для JavaScript',
            'date-fns': 'Библиотека для работы с датами',
            'framer-motion': 'Библиотека для анимаций в React',
            'fs': 'Node.js модуль для работы с файловой системой',
            'path': 'Node.js модуль для работы с путями файлов',
            'crypto': 'Node.js модуль для криптографических операций',
            'os': 'Node.js модуль для работы с операционной системой',
            'child_process': 'Node.js модуль для создания дочерних процессов',
            'util': 'Node.js модуль с утилитарными функциями',
            'stream': 'Node.js модуль для работы с потоками данных',
            'events': 'Node.js модуль для работы с событиями',
            'buffer': 'Node.js модуль для работы с бинарными данными',
          };
          
          const packageName = modulePath.split('/')[0];
          hoverContent = `**${modulePath}**\n\n`;
          
          if (packageInfo[packageName]) {
            hoverContent += packageInfo[packageName] + '\n\n';
          }
          
          hoverContent += 'Полный путь: `node_modules/' + modulePath + '`';
          
          // Показываем тип импорта
          if (pattern.source.includes('require')) {
            hoverContent += '\n\nТип: CommonJS импорт (require)';
          } else if (pattern.source.includes('import\\(')) {
            hoverContent += '\n\nТип: Динамический импорт';
          } else if (pattern.source.includes('type')) {
            hoverContent += '\n\nТип: Импорт типов TypeScript';
          } else if (pattern.source.includes('reference')) {
            hoverContent += '\n\nТип: Ссылка на определение типов';
          } else if (pattern.source.includes('@import')) {
            hoverContent += '\n\nТип: CSS импорт';
          } else {
            hoverContent += '\n\nТип: ES модуль';
          }
        } else {
          // Относительный импорт
          const filePath = model.uri.path;
          const basePath = filePath.substring(0, filePath.lastIndexOf('/'));
          
          // Реализация resolvePath
          const resolveRelativePath = (base: string, relative: string): string => {
            if (relative.startsWith('/')) {
              return relative;
            }
            
            // Удаляем file:// префикс и нормализуем путь
            const normalizedBase = base.replace(/^file:\/\//, '');
            
            // Получаем путь до корня проекта (предполагаем, что корень проекта - это папка src)
            const projectRoot = normalizedBase.includes('/src/') 
              ? normalizedBase.substring(0, normalizedBase.indexOf('/src/') + 4) // +4 чтобы включить '/src'
              : normalizedBase;
              
            // Добавляем информацию о диске, если ее нет
            const fullProjectRoot = projectRoot.match(/^[A-Z]:/i) 
              ? projectRoot 
              : `C:/PROJECTS/X-Editor${projectRoot.startsWith('/') ? '' : '/'}${projectRoot}`;
            
            // Для путей вида ./something
            if (relative.startsWith('./')) {
              // Получаем путь без первых двух символов (./)
              const cleanPath = relative.slice(2);
              // Получаем директорию текущего файла
              const currentDir = normalizedBase.substring(0, normalizedBase.lastIndexOf('/'));
              return `${currentDir}/${cleanPath}`;
            }
            
            // Для путей вида ../something
            if (relative.startsWith('../')) {
              let currentPath = normalizedBase;
              let relPath = relative;
              
              // Поднимаемся по "../" вверх по дереву директорий
              while (relPath.startsWith('../')) {
                currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                relPath = relPath.slice(3);
              }
              
              return `${currentPath}/${relPath}`;
            }
            
            // Для импортов без ./ или ../ (модули или абсолютные пути)
            // Просто возвращаем путь как есть
            if (!relative.startsWith('.')) {
              // Если путь выглядит как путь к модулю проекта, добавляем полный путь
              if (relative.includes('/') && !relative.startsWith('@')) {
                return `${fullProjectRoot}/${relative}`;
              }
              return relative;
            }
            
            // Для остальных случаев используем стандартную логику
            // Разбиваем пути на сегменты
            const baseSegments = normalizedBase.split('/');
            const relativeSegments = relative.split('/');
            
            // Создаем новый результирующий массив сегментов
            const resultSegments = [...baseSegments.slice(0, baseSegments.length - 1)]; // Удаляем последний сегмент, который обычно содержит имя файла
            
            for (const segment of relativeSegments) {
              if (segment === '..') {
                // Поднимаемся на уровень выше
                resultSegments.pop();
              } else if (segment !== '.' && segment !== '') {
                // Добавляем сегмент к пути
                resultSegments.push(segment);
              }
            }
            
            // Собираем путь обратно
            return resultSegments.join('/');
          };
          
          const fullPath = resolveRelativePath(basePath, modulePath);
          
          // Проверяем на дублирование пути в тексте подсказки
          const modulePathClean = modulePath.endsWith('/') ? modulePath.slice(0, -1) : modulePath;
          const fullPathClean = fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
          
          // Проверяем, не повторяет ли полный путь уже показанный относительный
          const showBothPaths = !fullPathClean.endsWith(modulePathClean) && 
                               !modulePathClean.endsWith(fullPathClean);
          
          hoverContent = `**${modulePath}**\n\n`;
          
          if (showBothPaths) {
            hoverContent += `Полный путь: \`${fullPath}\``;
          } else {
            // Если один путь содержит другой, показываем только полный
            hoverContent += `Путь: \`${fullPath}\``;
          }
          
          // Определение типа файла
          let fileExtension = '';
          
          // Извлекаем расширение из пути модуля
          if (modulePath.includes('.')) {
            fileExtension = modulePath.split('.').pop() || '';
          } else {
            // Если расширение не указано, предполагаем несколько вариантов
            const possibleExts = ['ts', 'tsx', 'js', 'jsx'];
            hoverContent += '\n\nРасширение не указано, может быть один из следующих файлов:';
            for (const ext of possibleExts) {
              hoverContent += `\n- \`${fullPath}.${ext}\``;
            }
            hoverContent += `\n- \`${fullPath}/index.[ts|tsx|js|jsx]\``;
          }
          
          if (fileExtension) {
            const fileTypeInfo: Record<string, string> = {
              'ts': 'TypeScript файл',
              'tsx': 'TypeScript с JSX компонентами',
              'js': 'JavaScript файл',
              'jsx': 'JavaScript с JSX компонентами',
              'css': 'CSS стили',
              'scss': 'SCSS стили',
              'less': 'LESS стили',
              'json': 'JSON файл данных',
              'md': 'Markdown документация',
              'mdx': 'MDX документация с компонентами',
              'svg': 'SVG векторная графика',
              'png': 'PNG изображение',
              'jpg': 'JPEG изображение',
              'jpeg': 'JPEG изображение',
              'gif': 'GIF изображение',
              'webp': 'WebP изображение',
              'woff': 'Web Open Font Format шрифт',
              'woff2': 'Web Open Font Format 2 шрифт',
              'eot': 'Embedded OpenType шрифт',
              'ttf': 'TrueType шрифт',
              'otf': 'OpenType шрифт',
              'html': 'HTML файл',
              'htm': 'HTML файл',
              'xml': 'XML файл',
              'yml': 'YAML файл конфигурации',
              'yaml': 'YAML файл конфигурации',
              'toml': 'TOML файл конфигурации',
              'csv': 'CSV файл с данными',
              'txt': 'Текстовый файл',
            };
            
            if (fileTypeInfo[fileExtension]) {
              hoverContent += `\n\nТип: ${fileTypeInfo[fileExtension]}`;
            }
          }
          
          // Показываем тип импорта
          if (pattern.source.includes('require')) {
            hoverContent += '\n\nТип: CommonJS импорт (require)';
          } else if (pattern.source.includes('import\\(')) {
            hoverContent += '\n\nТип: Динамический импорт';
          } else if (pattern.source.includes('type')) {
            hoverContent += '\n\nТип: Импорт типов TypeScript';
          } else if (pattern.source.includes('reference')) {
            hoverContent += '\n\nТип: Ссылка на определение типов';
          } else if (pattern.source.includes('@import')) {
            hoverContent += '\n\nТип: CSS импорт';
          } else {
            hoverContent += '\n\nТип: ES модуль';
          }
        }
        
        return {
          contents: [
            { value: hoverContent }
          ]
        };
      }
    }
    
    // Проверяем, является ли это переменной или функцией
    const declarationPatterns = [
      /(const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_$]+)/,
      /export\s+(const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_$]+)/,
      /export\s+default\s+(function|class)\s+([a-zA-Z0-9_$]+)/,
      /async\s+function\s+([a-zA-Z0-9_$]+)/
    ];
    
    for (const pattern of declarationPatterns) {
      const match = lineContent.match(pattern);
      if (match) {
        const declarationType = match[1] || match[0].includes('function') ? 'function' : match[0].includes('class') ? 'class' : 'unknown';
        const name = match[2] || match[1];
        
        if (word.word === name) {
          // Функция для определения описания
          const getTypeDescription = (type: string, name: string): string => {
            switch (type) {
              case 'const':
                return `Константа, объявленная с помощью 'const'`;
              case 'let':
                return `Переменная, объявленная с помощью 'let'`;
              case 'var':
                return `Переменная, объявленная с помощью 'var'`;
              case 'function':
                return `Функция '${name}'`;
              case 'class':
                return `Класс '${name}'`;
              case 'interface':
                return `Интерфейс TypeScript '${name}'`;
              case 'type':
                return `Пользовательский тип TypeScript '${name}'`;
              default:
                return `Объявление '${name}'`;
            }
          };
          
          return {
            contents: [
              { value: `**${word.word}** - ${getTypeDescription(declarationType, word.word)}` }
            ]
          };
        }
      }
    }
    
    // Проверяем JSX компоненты
    if (model.getLanguageId() === 'typescript' || model.getLanguageId() === 'javascript') {
      const jsxComponentPattern = /<([A-Z][a-zA-Z0-9_$]*)(?:\s|\/|>)/;
      const match = lineContent.match(jsxComponentPattern);
      
      if (match && word.word === match[1]) {
        return {
          contents: [
            { value: `**${word.word}** - React компонент` }
          ]
        };
      }
    }
    
    return null;
  };
  
  // Регистрируем провайдер для TypeScript
  monaco.languages.registerHoverProvider('typescript', {
    provideHover: provideHoverFunction
  });
  
  // Регистрируем провайдер для JavaScript
  monaco.languages.registerHoverProvider('javascript', {
    provideHover: provideHoverFunction
  });
  
  // Регистрируем тот же провайдер для JSX/TSX файлов
  monaco.languages.registerHoverProvider('javascriptreact', {
    provideHover: provideHoverFunction
  });
  
  monaco.languages.registerHoverProvider('typescriptreact', {
    provideHover: provideHoverFunction
  });
}

/**
 * Резолвит относительный путь относительно базового пути
 */
function resolvePath(basePath: string, relativePath: string): string {
  // Если путь абсолютный, возвращаем его как есть
  if (relativePath.startsWith('/')) {
    return relativePath;
  }
  
  // Разбиваем пути на сегменты
  const baseSegments = basePath.split('/');
  const relativeSegments = relativePath.split('/');
  
  // Создаем новый результирующий массив сегментов
  const resultSegments = [...baseSegments];
  
  for (const segment of relativeSegments) {
    if (segment === '..') {
      // Поднимаемся на уровень выше
      resultSegments.pop();
    } else if (segment !== '.' && segment !== '') {
      // Добавляем сегмент к пути
      resultSegments.push(segment);
    }
  }
  
  // Собираем путь обратно
  return resultSegments.join('/');
}

/**
 * Возвращает описание для объявления на основе его типа
 */
function getDeclarationDescription(type: string, name: string): string {
  switch (type) {
    case 'const':
      return `Константа, объявленная с помощью 'const'`;
    case 'let':
      return `Переменная, объявленная с помощью 'let'`;
    case 'var':
      return `Переменная, объявленная с помощью 'var'`;
    case 'function':
      return `Функция '${name}'`;
    case 'class':
      return `Класс '${name}'`;
    case 'interface':
      return `Интерфейс TypeScript '${name}'`;
    case 'type':
      return `Пользовательский тип TypeScript '${name}'`;
    default:
      return `Объявление '${name}'`;
  }
}

/**
 * Регистрирует функции API для работы с модулями и файловой системой через Tauri
 */
export async function setupModulePaths() {
  if (typeof window.__TAURI__ !== 'undefined' && window.__TAURI__?.invoke) {
    console.log('Установка Tauri интеграции для разрешения путей модулей...');
    try {
      // Тестовый вызов, чтобы проверить доступность API
      const exists = await window.__TAURI__.invoke('file_exists', { 
        filePath: 'package.json' 
      });
      console.log('Тестовый вызов file_exists:', exists);
      
      // Определяем все необходимые функции для работы с модулями
      const fileExists = async (path: string): Promise<boolean> => {
        try {
          const tauri = window.__TAURI__;
          if (tauri && typeof tauri.invoke === 'function') {
            return await tauri.invoke('file_exists', { filePath: path });
          }
          return false;
        } catch (error) {
          console.error('Ошибка при проверке существования файла:', error);
          return false;
        }
      };
      
      // Добавляем функцию в глобальное пространство для использования в Monaco
      (window as any).fileExists = fileExists;
      
      // Получаем корень проекта
      const projectRoot = await window.__TAURI__.invoke('get_project_root', { 
        currentFilePath: window.location.pathname 
      });
      console.log('Корень проекта через Tauri API:', projectRoot);
      
      return true;
    } catch (error) {
      console.error('Ошибка при установке Tauri интеграции:', error);
      return false;
    }
  } else {
    console.warn('Tauri API недоступен для интеграции с модулями');
    // Создаем заглушку для fileExists, чтобы избежать ошибок
    (window as any).fileExists = (path: string) => {
      console.warn('fileExists заглушка вызвана для:', path);
      return true; // Всегда возвращаем true в качестве заглушки
    };
    return false;
  }
}

/**
 * Асинхронная функция для разрешения пути модуля с помощью Rust
 * @param modulePath Путь к модулю
 * @returns Полный путь к файлу
 */
export async function resolveModulePath(modulePath: string): Promise<string> {
  console.log(`[resolveModulePath] Запрос на разрешение пути модуля: ${modulePath}`);
  
  if (typeof window.__TAURI__ !== 'undefined') {
    try {
      // Получаем корень проекта
      console.log(`[resolveModulePath] Получение корня проекта через fs_get_project_root...`);
      const projectRoot = await invoke<string>('fs_get_project_root', { 
        currentFilePath: window.location.pathname 
      });
      
      console.log(`[resolveModulePath] Получен корень проекта: ${projectRoot}`);
      
      if (!projectRoot) {
        console.warn('[resolveModulePath] Не удалось определить корень проекта');
        return modulePath;
      }
      
      // Разрешаем путь модуля
      console.log(`[resolveModulePath] Вызов fs_resolve_module_path для '${modulePath}'...`);
      const resolvedPath = await invoke<string | null>('fs_resolve_module_path', { 
        projectRoot, 
        moduleName: modulePath 
      });
      
      if (!resolvedPath) {
        console.warn(`[resolveModulePath] Путь не был разрешен для '${modulePath}'`);
        return modulePath;
      }
      
      console.log(`[resolveModulePath] Модуль "${modulePath}" разрешен как: ${resolvedPath}`);
      return resolvedPath;
    } catch (error) {
      console.error('[resolveModulePath] Ошибка при разрешении пути модуля:', error);
      return modulePath;
    }
  } else {
    console.warn('[resolveModulePath] Tauri API недоступен');
  }
  
  return modulePath;
}

export { registerTypeScriptSupport } from './register-typescript';
