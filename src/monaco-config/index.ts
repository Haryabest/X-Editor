import * as monaco from 'monaco-editor';
import { getLanguageFromExtension } from './language-detector';
import { configureJSXTypes, jsxIntrinsicElementsDefinitions } from './jsx-types';
import { FileItem } from '../types';

// Игнорирование ошибок импорта для интеграционного модуля
// @ts-ignore
import { createTestButton, enableMonacoDebugTools } from '../monaco-tests/integration';

// Расширяем тип Window для добавления отладочной функции
declare global {
  interface Window {
    monaco: any;
    logMonacoDiagnostics?: () => { markers: any[], errorCounts: Record<string, number> };
    monacoDebug?: any;
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
 * Настраивает умный анализатор кода для различных типов файлов
 * @param monaco - Объект Monaco
 * @param filePath - Путь к файлу
 */
export function setupSmartCodeAnalyzer(monaco: Monaco, filePath: string) {
  // Определяем тип файла
  const isJsxFile = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
  
  // Список критических кодов ошибок, которые всегда должны отображаться
  const criticalErrorCodes = [
    // Критические синтаксические ошибки
    1002, // Unexpected end of file
    1012, // Requires dot
    1014, // Semicolon required
    1035, // Invalid arrow function
    1068, // Unexpected curly brace
    
    // Важные логические ошибки
    2440, // Type is not constructable
    2448, // Declaration not found
    2451, // Cannot be assigned
    2420, // Property doesn't exist on type
    2554, // Wrong function arguments
    2575, // No default value for parameter
    
    // Другие важные ошибки
    2391, // Duplicate names
    2322, // Type mismatch
    2349, // No constructor
  ];
  
  // Список кодов ошибок, которые можно игнорировать
  const diagnosticCodesToIgnore = [
    2669, // Augmentations for the global scope can only be directly nested
    1046, // Top-level declarations in .d.ts files must start with 'declare' or 'export'
    2307, // Cannot find module
    7031, // Initializers are not allowed in ambient contexts
    1161, // Unterminated regular expression literal
    2304, // Cannot find name (HTML elements)
    7026, // JSX element implicitly has type 'any'
    7006, // Parameter implicitly has an 'any' type
    2740,  // Type 'string | undefined' is missing the following properties
    2339,  // Property does not exist on type
    2531,  // Object is possibly 'null'
    2786,  // 'x' cannot be used as a JSX component
    2605,  // JSX element type 'x' is not a constructor function
    1005,  // '>' expected.
    1003,  // Identifier expected.
    17008, // JSX element 'x' has no corresponding closing tag.
    2693,  // 'x' only refers to a type, but is being used as a value here.
    1109,  // Expression expected.
    1128,  // Declaration or statement expected.
    1434,  // Unexpected keyword or identifier.
    1136,  // Property assignment expected.
    1110,  // Type expected.
    8006,  // 'module' declarations can only be used in TypeScript files.
    8010,  // Type annotations can only be used in TypeScript files.
    2688,  // Cannot find type definition file.
    1039,  // Initializers are not allowed in ambient contexts.
    2792,  // Cannot find module 'next'. Did you mean to set the 'moduleResolution' option to 'nodenext'
    1183,  // An implementation cannot be declared in ambient contexts.
    1254,  // A 'const' initializer in an ambient context must be a string or numeric literal.
    2695,  // Left side of comma operator is unused and has no side effects.
    2365,  // Operator '<' cannot be applied to types 'boolean' and 'number'.
    2714,  // The expression of an export assignment must be an identifier or qualified name in an ambient context.
    2552,  // Cannot find name 'body'. Did you mean 'Body'?
    2362,  // The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
    2503,  // Cannot find namespace 'React'.
    2363,  // The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
    18004   // No value exists in scope for the shorthand property 'x'. Either declare one or provide an initializer.
  ];
  
  // Для JSX файлов игнорируем больше ошибок, связанных с синтаксисом JSX и типами
  if (isJsxFile) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
        2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
        1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
        1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004
      ]
    });
    
    // Для JavaScript файлов (.jsx) также устанавливаем соответствующие опции
    if (filePath.endsWith('.jsx')) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: true,
        diagnosticCodesToIgnore: [
          2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
          2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
          1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
          1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004
        ]
      });
    }
  } else {
    // Для обычных TS файлов используем более строгую проверку
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      // Для не-JSX файлов игнорируем меньше ошибок
      diagnosticCodesToIgnore: diagnosticCodesToIgnore.filter(code => 
        // Не игнорируем некоторые коды в обычных TS файлах
        ![2322, 2339].includes(code)
      ),
    });
  }
  
  // Добавляем кастомный обработчик для фильтрации ошибок, если в режиме разработки
  if (isDevelopmentMode) {
    // Логгируем для отладки
    console.log(`Setting up smart analyzer for ${filePath}, JSX: ${isJsxFile}`);
    
    // Функция для отладки диагностики (вызывается при необходимости)
    window.logMonacoDiagnostics = () => {
      const markers = monaco.editor.getModelMarkers({});
      console.log('All diagnostic messages:', markers);
      
      // Группировка по кодам ошибок
      const errorCounts: Record<string, number> = {};
      markers.forEach((marker: any) => {
        const code = marker.code as string;
        errorCounts[code] = (errorCounts[code] || 0) + 1;
      });
      console.log('Error code statistics:', errorCounts);
      return { markers, errorCounts };
    };
  }
}

/**
 * Конфигурирует Monaco Editor
 * @param openedFiles - Массив открытых файлов
 */
export function configureMonaco(openedFiles: MonacoFileConfig[]): void {
  try {
    // Логгируем информацию о версии
    console.log('Configuring Monaco with TypeScript support');
    
    // Настраиваем умный анализатор кода
    openedFiles.forEach(file => {
      // Используем либо filePath, либо path
      const filePath = file.filePath || file.path;
      if (filePath) {
        setupSmartCodeAnalyzer(monaco, filePath);
      }
    });

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
      allowSyntheticDefaultImports: true
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
              useLayoutEffect: 'Версия useEffect, которая запускается синхронно после всех DOM-изменений, но до отрисовки экрана браузером.'
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
            autoFocus: 'Флаг, указывающий, что элемент должен получить фокус при загрузке страницы.'
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
    
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
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
  } catch (error) {
    console.error('Error configuring Monaco:', error);
  }
}
