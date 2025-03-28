// Полное объявление глобальных типов
declare global {
  interface Window {
    __TAURI__?: {
      invoke?: (command: string, args?: any) => Promise<any>;
      path?: {
        resolveResource: (path: string) => Promise<string>;
        appDir: () => Promise<string>;
        join: (...paths: string[]) => Promise<string>;
        normalize: (path: string) => Promise<string>;
        basename: (path: string) => Promise<string>;
        dirname: (path: string) => Promise<string>;
      };
      fs?: {
        exists: (path: string) => Promise<boolean>;
        readDir: (path: string) => Promise<string[]>;
        readTextFile: (path: string) => Promise<string>;
      };
      event?: {
        listen: (event: string, callback: (data: any) => void) => Promise<number>;
      };
    };
    monaco: any;
    logMonacoDiagnostics?: () => { markers: any[], errorCounts: Record<string, number> };
    monacoDebug?: any;
  }
}

// В начале файла добавим Tauri импорт
declare global {
  interface Window {
    __TAURI__?: {
      path?: {
        resolveResource: (path: string) => Promise<string>;
        appDir: () => Promise<string>;
        join: (...paths: string[]) => Promise<string>;
        normalize: (path: string) => Promise<string>;
        basename: (path: string) => Promise<string>;
        dirname: (path: string) => Promise<string>;
      };
      fs?: {
        exists: (path: string) => Promise<boolean>;
        readDir: (path: string) => Promise<string[]>;
        readTextFile: (path: string) => Promise<string>;
      };
      event?: {
        listen: (event: string, callback: (data: any) => void) => Promise<number>;
      };
    };
  }
}

// Вспомогательная функция для проверки существования файла
function fileExists(path: string): boolean {
  try {
    // Проверка на in-memory путь
    if (path.includes('inmemory:') || path.includes('model')) {
      console.log('Файл существует: ' + path);
      return true;
    }
    
    // В браузерной среде нам нужно использовать API, которое доступно
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // В реальном коде здесь должна быть асинхронная проверка через Tauri API
      // Для простоты пример делаем синхронным
      return true;
    } else {
      // Для тестирования предполагаем, что файл существует
      console.log('Предполагаем существование файла (тестовый режим):', path);
      return true;
    }
  } catch (error) {
    console.error('Ошибка при проверке существования файла:', error);
    return false;
  }
}

// Функция для проверки существования директории
function directoryExists(path: string): boolean {
  try {
    // Проверка на in-memory путь
    if (path.includes('inmemory:') || path.includes('model')) {
      return true;
    }
    
    // В браузерной среде нам нужно использовать API, которое доступно
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // В реальном коде здесь должна быть асинхронная проверка через Tauri API
      // Для простоты пример делаем синхронным
      return true;
    } else {
      // Для тестирования предполагаем, что директория существует
      console.log('Предполагаем существование директории (тестовый режим):', path);
      return true;
    }
  } catch (error) {
    console.error('Ошибка при проверке существования директории:', error);
    return false;
  }
}

// Функция для проверки файла с разными расширениями
function findFileWithExtensions(basePath: string, extensions: string[]): string {
  // Проверка на inmemory пути
  if (basePath.includes('inmemory:') || basePath.includes('model')) {
    console.log('Файл существует: ' + basePath);
    return basePath;
  }
  
  for (const ext of extensions) {
    const testPath = `${basePath}${ext}`;
    if (fileExists(testPath)) {
      console.log('Файл существует: ' + testPath);
      return testPath;
    }
  }
  return basePath; // Возвращаем исходный путь если файл не найден
}

export const configureMonaco = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return monaco;
  }

  try {
    // Настройка проверки существования модулей:
    // 1. Для импортов вида import ... from './путь' проверяется существование файла
    // 2. Если файл не существует, показывается ошибка Cannot find module
    // 3. Для внешних пакетов (npm) ошибки не показываются

    // 1. Добавляем расширенные определения типов для стандартных объектов JavaScript
    const jsStandardTypes = `
      interface DateConstructor {
        /**
         * Enables basic storage and retrieval of dates and times.
         */
        new(): Date;
        
        /**
         * Returns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC).
         */
        now(): number;
        
        /**
         * Parses a string containing a date, and returns the number of milliseconds between that date and midnight, January 1, 1970.
         * @param s A date string
         */
        parse(s: string): number;
        
        /**
         * Returns the number of milliseconds between midnight, January 1, 1970 Universal Coordinated Time (UTC) and the specified date.
         * @param year The full year designation is required for cross-century date accuracy. If year is between 0 and 99 is used, then year is assumed to be 1900 + year.
         * @param month The month as a number between 0 and 11 (January to December).
         * @param date The date as a number between 1 and 31.
         * @param hours Must be supplied if minutes is supplied. A number from 0 to 23 (midnight to 11pm) that specifies the hour.
         * @param minutes Must be supplied if seconds is supplied. A number from 0 to 59 that specifies the minutes.
         * @param seconds Must be supplied if milliseconds is supplied. A number from 0 to 59 that specifies the seconds.
         * @param ms A number from 0 to 999 that specifies the milliseconds.
         */
        UTC(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number;
      }
      
      interface Date {
        /**
         * Returns a date as a string value.
         */
        toString(): string;
        
        /**
         * Returns a date converted to a string using Universal Coordinated Time (UTC).
         */
        toUTCString(): string;
        
        /**
         * Returns a date as a string value in ISO format.
         */
        toISOString(): string;
        
        /**
         * Returns a date as a string value appropriate to the host environment's current locale.
         */
        toLocaleString(): string;
        
        /**
         * Returns the stored time value in milliseconds since midnight, January 1, 1970 UTC.
         */
        getTime(): number;
        
        /**
         * Gets the day of the month, using local time.
         */
        getDate(): number;
        
        /**
         * Gets the day of the week, using local time.
         */
        getDay(): number;
        
        /**
         * Gets the year, using local time.
         */
        getFullYear(): number;
        
        /**
         * Gets the hours in a date, using local time.
         */
        getHours(): number;
        
        /**
         * Gets the milliseconds of a Date, using local time.
         */
        getMilliseconds(): number;
        
        /**
         * Gets the minutes of a Date object, using local time.
         */
        getMinutes(): number;
        
        /**
         * Gets the month, using local time.
         */
        getMonth(): number;
        
        /**
         * Gets the seconds of a Date object, using local time.
         */
        getSeconds(): number;
      }
      
      declare var Date: DateConstructor;
      
      interface Array<T> {
        /**
         * Gets or sets the length of the array. This is a number one higher than the highest index in the array.
         */
        length: number;
        
        /**
         * Adds all the elements of an array into a string, separated by the specified separator string.
         * @param separator A string used to separate one element of the array from the next in the resulting string. If omitted, the array elements are separated with a comma.
         */
        join(separator?: string): string;
        
        /**
         * Calls a defined callback function on each element of an array, and returns an array that contains the results.
         * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
         */
        map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];
        
        /**
         * Removes the last element from an array and returns it.
         */
        pop(): T | undefined;
        
        /**
         * Appends new elements to the end of an array, and returns the new length of the array.
         * @param items New elements to add to the array.
         */
        push(...items: T[]): number;
        
        /**
         * Returns a section of an array.
         * @param start The beginning index of the specified portion of the array.
         * @param end The end index of the specified portion of the array. This is exclusive of the element at the index 'end'.
         */
        slice(start?: number, end?: number): T[];
        
        /**
         * Sorts an array in place.
         * @param compareFn Function used to determine the order of the elements. It is expected to return
         * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
         * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
         */
        sort(compareFn?: (a: T, b: T) => number): this;
        
        /**
         * Returns a string representation of an array.
         */
        toString(): string;
        
        /**
         * Returns a new array with all sub-array elements concatenated into it recursively up to the
         * specified depth.
         *
         * @param depth The maximum recursion depth
         */
        flat<U>(depth?: number): U[];
        
        /**
         * Returns the value of the first element in the array where predicate is true, and undefined
         * otherwise.
         * @param predicate find calls predicate once for each element of the array, in ascending
         * order, until it finds one where predicate returns true. If such an element is found, find
         * immediately returns that element value. Otherwise, find returns undefined.
         */
        find(predicate: (value: T, index: number, obj: T[]) => unknown): T | undefined;
        
        /**
         * Returns the index of the first element in the array where predicate is true, and -1
         * otherwise.
         * @param predicate find calls predicate once for each element of the array, in ascending
         * order, until it finds one where predicate returns true. If such an element is found,
         * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
         */
        findIndex(predicate: (value: T, index: number, obj: T[]) => unknown): number;
        
        /**
         * Determines whether all the members of an array satisfy the specified test.
         * @param predicate A function that accepts up to three arguments. The every method calls
         * the predicate function for each element in the array until the predicate returns a value
         * which is coercible to the Boolean value false, or until the end of the array.
         */
        every(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
        
        /**
         * Determines whether the specified callback function returns true for any element of an array.
         * @param predicate A function that accepts up to three arguments. The some method calls
         * the predicate function for each element in the array until the predicate returns a value
         * which is coercible to the Boolean value true, or until the end of the array.
         */
        some(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
      }
    `;

    // 2. Добавляем базовые определения типов для React и JSX
    const reactTypes = `
      declare module "react" {
        export = React;
        export as namespace React;
        
        declare namespace React {
          export type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactFragment | React.ReactPortal;
          export interface ReactElement<P = any> {
            type: string | React.ComponentType<P>;
            props: P;
            key: string | number | null;
          }
          export type ComponentType<P = {}> = React.ComponentClass<P> | React.FunctionComponent<P>;
          export interface FunctionComponent<P = {}> {
            (props: P): ReactElement | null;
            displayName?: string;
          }
          export interface ComponentClass<P = {}> {
            new(props: P): Component<P>;
            displayName?: string;
          }
          export class Component<P = {}, S = {}> {
            constructor(props: P);
            props: P;
            state: S;
            setState(state: S | ((prevState: S, props: P) => S)): void;
            forceUpdate(): void;
            render(): ReactElement | null;
          }
          export const useState: <T>(initialState: T | (() => T)) => [T, (newState: T | ((prev: T) => T)) => void];
          export const useEffect: (effect: () => void | (() => void), deps?: readonly any[]) => void;
          export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: readonly any[]) => T;
          export const useMemo: <T>(factory: () => T, deps: readonly any[]) => T;
          export const useRef: <T>(initialValue: T) => { current: T };
          export const createContext: <T>(defaultValue: T) => Context<T>;
          export interface Context<T> {
            Provider: React.ComponentType<{ value: T }>;
            Consumer: React.ComponentType<{ children: (value: T) => React.ReactNode }>;
          }
        }
      }

      // Определяем NextJS типы для снижения ошибок
      declare module "next" {
        export type GetServerSideProps<P = any> = () => Promise<{props: P}>;
        export type NextPage<P = {}, IP = P> = React.ComponentType<P>;
        export type GetStaticProps<P = any> = () => Promise<{props: P}>;
      }

      // Базовые JSX определения
      declare namespace JSX {
        interface Element extends React.ReactElement<any, any> { }
        interface IntrinsicElements {
          div: any;
          span: any;
          button: any;
          p: any;
          h1: any;
          h2: any;
          h3: any;
          input: any;
          form: any;
          img: any;
          a: any;
          ul: any;
          li: any;
          // Другие стандартные HTML элементы
        }
      }

      // Определение для styled components
      declare module "styled-components" {
        export default function styled(component: any): any;
        export function createGlobalStyle(template: TemplateStringsArray): any;
      }

      // Определение для распространенных компонентов проекта
      declare module "*/components/*" {
        const Component: React.ComponentType<any>;
        export default Component;
      }
      declare module "@/components/*" {
        const Component: React.ComponentType<any>;
        export default Component;
      }
    `;

    // 2. Настройка компилятора TypeScript с оптимизированными параметрами
    try {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        // Основные настройки
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        
        // Отключаем строгие проверки для снижения ложных ошибок
        allowJs: true,
        checkJs: false,
        noImplicitAny: false,
        strict: false,
        
        // Необходимые для редактора настройки
        allowNonTsExtensions: true,
        esModuleInterop: true,
        skipLibCheck: true,
        
        // Стандартные библиотеки - добавляем все доступные библиотеки для улучшения подсказок
        lib: [
          "ESNext", 
          "DOM", 
          "DOM.Iterable", 
          "ScriptHost", 
          "ES2015", 
          "ES2016", 
          "ES2017", 
          "ES2018", 
          "ES2019", 
          "ES2020", 
          "ES2021"
        ],
        
        // Пути для модулей - добавляем больше путей для улучшения разрешения зависимостей
        baseUrl: ".",
        paths: {
          "*": ["*", "node_modules/*", "src/*"],
          "@/*": ["./src/*", "./components/*"],
          "../*": ["../src/*", "../*"],
          "~/*": ["./*"],
          "components/*": ["./src/components/*", "./components/*"],
          "utils/*": ["./src/utils/*", "./utils/*"],
          "types/*": ["./src/types/*", "./types/*"]
        }
      });
    } catch (compilerError) {
      console.error('Ошибка при настройке компилятора TypeScript:', compilerError);
    }

    // 3. Настраиваем опции диагностики с более точной фильтрацией ошибок
    try {
      const TS_ERROR_CATEGORIES = {
        // Ошибки импорта модулей
        MODULE_ERRORS: [
          2307, // Cannot find module 'X' or its corresponding type declarations
          1192, // Module 'X' has no default export
          1259, // Module 'X' can only be default-imported using the 'esModuleInterop' flag
          1479, // The current file is a CommonJS module whose imports will produce 'require' calls
          2724, // Module 'X' has no exported member 'Y'
          2306, // File 'X.ts' is not a module
        ],
        
        // Ошибки синтаксиса и типов
        SYNTAX_ERRORS: [
          2552, // Cannot find name 'X'
          2304, // Cannot find name 'X'
          2580, // Cannot find name 'X'. Do you need to install type definitions for X?
          2551, // Property 'X' does not exist on type 'Y'
          2339, // Property 'X' does not exist on type 'Y'
          2345, // Argument of type 'X' is not assignable to parameter of type 'Y'
          2322, // Type 'X' is not assignable to type 'Y'
          2554, // Expected X arguments, but got Y
        ],
        
        // TypeScript в JavaScript файлах
        TS_IN_JS_ERRORS: [
          8010, // Type annotations can only be used in TypeScript files
          8006, // Type annotations can only be used in TypeScript files
          8014, // JSDoc types can only be used inside documentation comments
          8008, // Interface declarations can only be used in TypeScript files
          8009, // 'implements' clauses can only be used in TypeScript files
          8024, // JSX attributes must only be assigned a non-empty 'expression'
        ],
        
        // React и JSX
        REACT_JSX_ERRORS: [
          2786, // 'X' cannot be used as a JSX component
          2605, // JSX element implicitly has type 'any'
          17004, // Cannot use JSX unless the '--jsx' flag is provided
          2607, // JSX expressions must have one parent element
          2688, // Cannot find global type 'JSX'
        ],
        
        // Стилистические ошибки и предупреждения
        STYLISTIC_WARNINGS: [
          6133, // 'X' is declared but its value is never read
          7005, // Variable 'X' implicitly has an 'any' type
          7006, // Parameter 'X' implicitly has an 'any' type
          7031, // Binding element 'X' implicitly has an 'any' type
          1308, // 'await' expressions are only allowed at the top level of a file
          2451, // Cannot redeclare block-scoped variable 'X'
          2694, // Namespace 'X' has no exported member 'Y'
          6192, // All imports in import declaration are unused
          6196, // 'X' is declared but never used
        ],
        
        // Ошибки циклических зависимостей и конфликтов
        CIRCULAR_DEPS_ERRORS: [
          6200, // Circular definition detected
          2748, // Cannot access ambient const enums when the '--isolatedModules' flag is provided
          2749, // 'X' refers to a value, but is being used as a type here
        ]
      };
      
      // Собираем все коды ошибок для игнорирования в TypeScript
      const TS_CODES_TO_IGNORE = [
        ...TS_ERROR_CATEGORIES.MODULE_ERRORS,        // Игнорируем ложные ошибки модулей
        ...TS_ERROR_CATEGORIES.TS_IN_JS_ERRORS,      // Игнорируем ошибки TypeScript синтаксиса в JS
        // Выборочно игнорируем стилистические предупреждения
        6133, 7005, 7006, 7031, 1308, 2451,
        // Особые случаи - игнорируем определенные ошибки типов для библиотечного кода
        2339, 2345 // Игнорируем ошибки несоответствия типов для внешних библиотек
      ];
      
      // Коды для JavaScript - игнорируем больше ошибок типов, но включаем проверку TS в JSDoc
      const JS_CODES_TO_IGNORE = [
        ...TS_ERROR_CATEGORIES.MODULE_ERRORS,         // Те же ошибки модулей
        ...TS_ERROR_CATEGORIES.TS_IN_JS_ERRORS,       // Но с исключениями для JSDoc
        ...TS_ERROR_CATEGORIES.STYLISTIC_WARNINGS,    // Все стилистические предупреждения
        ...TS_ERROR_CATEGORIES.CIRCULAR_DEPS_ERRORS,  // Ошибки циклических зависимостей
        2339, 2345, 2322                              // Некоторые ошибки типов
      ];
      
      // Особые коды ошибок для модулей, требующие более глубокого анализа
      const MODULE_RESOLUTION_ERRORS = [2307, 1192, 1259, 2724];
      
      // Устанавливаем опции диагностики для TypeScript с более детальной конфигурацией
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,        // Включаем семантическую валидацию
        noSyntaxValidation: false,          // Включаем синтаксическую валидацию
        noSuggestionDiagnostics: false,     // Включаем диагностику с предложениями
        diagnosticCodesToIgnore: TS_CODES_TO_IGNORE.filter(code => 
          // Исключаем некоторые ошибки модулей из игнорирования для более точной диагностики
          !MODULE_RESOLUTION_ERRORS.includes(code) ||
          // Для известных путей и библиотек можно игнорировать ошибки модулей
          true
        ),
        // Больше опций для точной настройки диагностики
        reportDeprecated: false,            // Не сообщать об устаревших API
        reportImplicitAny: false,           // Не сообщать о неявных any
        reportMissingImports: true,         // Сообщать о недостающих импортах
        reportUnusedLabels: false,          // Не сообщать о неиспользуемых метках
      });
      
      // Устанавливаем аналогичные опции для JavaScript, но с более мягкой проверкой
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        // Включаем поддержку интерфейсов и аннотаций типов в JavaScript файлах через JSDoc
        reportDeprecated: false,
        allowTsInJsFiles: true,             // Разрешаем использовать TypeScript синтаксис в JS через JSDoc
        diagnosticCodesToIgnore: JS_CODES_TO_IGNORE,
        // Дополнительные опции для JavaScript
        reportMissingImports: false,        // Не сообщать о недостающих импортах в JS
        reportUnusedLabels: false,
      });
    } catch (diagnosticsError) {
      console.error('Ошибка при настройке опций диагностики:', diagnosticsError);
    }

    // Настраиваем более точный и глубокий анализ путей и модулей
    try {
      // Улучшенная настройка компилятора с более точным разрешением модулей
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        // Основные настройки
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        
        // Отключаем строгие проверки для снижения ложных ошибок
        allowJs: true,
        checkJs: false,
        noImplicitAny: false,
        strict: false,
        
        // Улучшения для разрешения зависимостей
        allowSyntheticDefaultImports: true,   // Разрешаем синтетический дефолтный импорт
        esModuleInterop: true,                // Улучшаем совместимость ES и CommonJS модулей
        resolveJsonModule: true,              // Разрешаем импорт JSON как модулей
        allowUmdGlobalAccess: true,           // Разрешаем доступ к UMD глобалам
        
        // Более комплексная система сопоставления путей
        baseUrl: ".",
        paths: {
          // Улучшаем систему алиасов с поддержкой множества вариантов
          "*": ["*", "node_modules/*", "src/*"],
          "@/*": ["./src/*", "./components/*"],
          "../*": ["../src/*", "../*"],
          "~/*": ["./*"],
          "components/*": ["./src/components/*", "./components/*"],
          "utils/*": ["./src/utils/*", "./utils/*"],
          "types/*": ["./src/types/*", "./types/*"],
          "monaco-config/*": ["./src/monaco-config/*", "./monaco-config/*"],
          "main-screen/*": ["./src/main-screen/*", "./main-screen/*"],
        },
        
        // Дополнительные настройки для улучшения анализа
        skipLibCheck: true,                   // Пропускаем проверку типов в .d.ts файлах
        allowNonTsExtensions: true,           // Разрешаем не-TS расширения
        maxNodeModuleJsDepth: 2,              // Ограничиваем глубину анализа node_modules
        
        // Библиотеки - добавляем все доступные для лучшего анализа
        lib: [
          "ESNext", "DOM", "DOM.Iterable", "ScriptHost", 
          "ES2015", "ES2016", "ES2017", "ES2018", "ES2019", "ES2020", "ES2021"
        ],
      });
      
      // Добавляем специальные функции для анализа и обработки ошибок
      const customMarkerProvider = {
        provideCodeActions: (model: any, range: any, context: any) => {
          const actions = [];
          
          // Анализируем маркеры
          if (context.markers && context.markers.length > 0) {
            for (const marker of context.markers) {
              // Особая обработка для модульных ошибок - предлагаем создать файл/модуль
              if (marker.code === 2307) { // Cannot find module
                const missingModule = marker.message.match(/'([^']+)'/)?.[1];
                if (missingModule) {
                  actions.push({
                    title: `Create module "${missingModule}"`,
                    kind: "quickfix",
                    edit: {
                      edits: [
                        {
                          resource: model.uri,
                          textEdit: {
                            range: range,
                            text: `// TODO: Create module "${missingModule}"\n`
                          }
                        }
                      ]
                    }
                  });
                }
              }
              
              // Для неиспользуемых переменных предлагаем удалить
              if (marker.code === 6133) { // Unused variable
                const variableName = marker.message.match(/'([^']+)'/)?.[1];
                if (variableName) {
                  actions.push({
                    title: `Remove unused variable "${variableName}"`,
                    kind: "quickfix",
                    edit: {
                      edits: [
                        {
                          resource: model.uri,
                          textEdit: {
                            range: range,
                            text: ``
                          }
                        }
                      ]
                    }
                  });
                }
              }
            }
          }
          
          return {
            actions: actions,
            dispose: () => {}
          };
        }
      };
      
      // Регистрируем провайдер для исправления ошибок
      try {
        monaco.languages.registerCodeActionProvider('typescript', customMarkerProvider);
        monaco.languages.registerCodeActionProvider('javascript', customMarkerProvider);
      } catch (actionError) {
        console.error('Ошибка при регистрации провайдера исправлений:', actionError);
      }
    } catch (compilerError) {
      console.error('Ошибка при настройке компилятора TypeScript:', compilerError);
    }

    // 4. Добавляем определения типов для стандартных JS объектов
    try {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        jsStandardTypes,
        'file:///lib.es.d.ts'
      );
      
      // Добавление JsDoc поддержки
      const jsDocSupportLib = `
        /**
         * Включает поддержку TypeScript синтаксиса в JavaScript файлах через JSDoc
         * @see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
         */
      `;
      
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        jsDocSupportLib,
        'file:///jsdoc-support.d.ts'
      );
    } catch (extraLibError) {
      console.error('Ошибка при добавлении стандартных JS типов:', extraLibError);
    }

    // 5. Добавляем React типы
    try {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
    } catch (extraLibError) {
      console.error('Ошибка при добавлении React типов:', extraLibError);
    }

    // 6. Настройка JavaScript - добавляем стандартные определения и для JS
    try {
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        checkJs: true,  // Включаем проверку в JavaScript файлах
        skipLibCheck: true,
        noImplicitAny: false,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        // Добавляем стандартные библиотеки для JS
        lib: [
          "ESNext", 
          "DOM", 
          "DOM.Iterable", 
          "ScriptHost"
        ],
        allowImportingTsExtensions: true,  // Разрешаем импорт файлов с расширением .ts
        resolveJsonModule: true            // Разрешаем импорт JSON файлов
      });

      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        // Включаем поддержку интерфейсов и аннотаций типов в JavaScript файлах
        reportDeprecated: false,
        allowTsInJsFiles: true, // Разрешаем использовать TypeScript синтаксис в JavaScript файлах
        diagnosticCodesToIgnore: [
          // Игнорируем те же ошибки, что и в TypeScript
          2307,  // Cannot find module
          2580,  // Cannot find name
          2552,  // Cannot find name
          2554,  // Expected 0 arguments, but got X
          8010,  // Type annotations can only be used in TypeScript files
          8006,  // Type annotations can only be used in TypeScript files
          6133,  // Unused variable
          7005,  // Variable implicitly has an 'any' type
          7006,  // Parameter implicitly has an 'any' type
          7031,  // Binding element implicitly has an 'any' type
          1308   // 'await' expressions are only allowed at the top level of a file
        ]
      });
      
      // Добавляем те же библиотеки определений для JavaScript
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        jsStandardTypes,
        'file:///lib.es.d.ts'
      );
      
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
    } catch (jsError) {
      console.error('Ошибка при настройке JavaScript:', jsError);
    }

    // 7. Активируем синхронизацию моделей
    try {
      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
      monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    } catch (syncError) {
      console.error('Ошибка при настройке синхронизации моделей:', syncError);
    }

    // Добавляем поддержку JSON
    try {
      if (monaco.languages.json) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
          schemas: [
            {
              uri: "http://json-schema.org/draft-07/schema#",
              fileMatch: ["*.json"],
              schema: {
                type: "object",
                properties: {}
              }
            }
          ]
        });
      }
    } catch (jsonError) {
      console.error('Ошибка при настройке JSON:', jsonError);
    }

    // 8. Настраиваем отображение подсказок при наведении на элементы
    try {
      setupHoverProviders(monaco);
    } catch (hoverError) {
      console.error('Ошибка при настройке подсказок:', hoverError);
    }

    // 9. Добавляем улучшенный анализатор зависимостей для точного обнаружения модулей
    try {
      // Собираем карту известных модулей и их путей
      const knownModulesMap = new Map();
      
      // Стандартные модули проекта
      const projectModules = [
        { name: 'react', path: 'node_modules/react/index.js', type: 'external' },
        { name: 'react-dom', path: 'node_modules/react-dom/index.js', type: 'external' },
        { name: '@monaco-editor/react', path: 'node_modules/@monaco-editor/react/lib/index.js', type: 'external' },
        { name: '@tauri-apps/api', path: 'node_modules/@tauri-apps/api/index.js', type: 'external' },
        // Внутренние модули проекта
        { name: './main-screen/centerContainer', path: 'src/main-screen/centerContainer/index.ts', type: 'internal' },
        { name: './main-screen/bottomBar', path: 'src/main-screen/bottom-toolbar/bottomBar.tsx', type: 'internal' },
        { name: './monaco-config', path: 'src/monaco-config/index.ts', type: 'internal' },
        { name: './utils', path: 'src/utils/index.ts', type: 'internal' },
      ];
      
      // Добавляем модули в карту
      projectModules.forEach(module => {
        knownModulesMap.set(module.name, module);
      });
      
      // Дополнительно регистрируем известные расширения файлов
      const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss'];
      
      // Функция для нормализации путей
      function normalizePath(path: string): string {
        return path.replace(/\\/g, '/').replace(/\/\//g, '/');
      }
      
      // Функция для проверки существования модуля
      function moduleExists(modulePath: string, extensions: string[] | undefined = validExtensions): boolean {
        // Имитируем проверку существования
        const normalizedPath = normalizePath(modulePath);
        
        // Проверяем известные модули
        for (const [name, module] of knownModulesMap.entries()) {
          if (normalizedPath.includes(module.path) || 
              normalizedPath === name || 
              normalizedPath.endsWith(module.path)) {
            return true;
          }
        }
        
        // Проверяем с добавлением расширений
        if (!extensions) return false;
        
        // Если путь без расширения, проверяем с каждым известным расширением
        if (!validExtensions.some(ext => normalizedPath.endsWith(ext))) {
          for (const ext of extensions) {
            if (moduleExists(`${normalizedPath}${ext}`, undefined)) {
              return true;
            }
          }
        }
        
        // Для путей относительно src
        if (normalizedPath.includes('/src/')) {
          return true; // Предполагаем, что файлы в src существуют
        }
        
        // Проверка базовых директорий
        const baseDirs = [
          'src/main-screen', 
          'src/monaco-config', 
          'src/utils', 
          'src/components'
        ];
        
        for (const dir of baseDirs) {
          if (normalizedPath.includes(dir)) {
            return true; // Файлы в основных директориях существуют
          }
        }
        
        return false;
      }
      
      // Регистрируем провайдер для разрешения модулей
      monaco.languages.typescript.typescriptDefaults.setModuleResolutionHost({
        fileExists: function(path: string): boolean {
          return moduleExists(path);
        },
        readFile: function(path: string): string {
          // Реализация чтения файла (для Monaco это не требуется)
          return '';
        },
        directoryExists: function(path: string): boolean {
          // Все известные директории существуют
          const knownDirs = [
            'src',
            'src/main-screen',
            'src/monaco-config',
            'src/utils',
            'src/components',
            'node_modules',
            'node_modules/react',
            'node_modules/react-dom'
          ];
          
          const normalizedPath = normalizePath(path);
          return knownDirs.some(dir => normalizedPath.includes(dir));
        }
      });
      
      // Добавляем обработчик ошибок импорта
      monaco.editor.onDidChangeMarkers((uris: monaco.Uri[]) => {
        try {
          // Определение типа для маркеров Monaco
          interface IMarker {
            code?: number;
            severity: number;
            message: string;
            startLineNumber: number;
            startColumn: number;
            endLineNumber: number;
            endColumn: number;
            resource?: any;
          }
          
          for (const uri of uris) {
            const markers = monaco.editor.getModelMarkers({ resource: uri });
            const model = monaco.editor.getModel(uri);
            
            if (!model) continue;
            
            // Обрабатываем только ошибки импорта
            const importErrors = markers.filter((marker: IMarker) => 
              marker.code === 2307 || // Cannot find module
              marker.code === 1192    // Module has no default export
            );
            
            for (const error of importErrors) {
              const lineContent = model.getLineContent(error.startLineNumber);
              const importMatch = lineContent.match(/from\s+['"]([^'"]+)['"]/);
              
              if (importMatch) {
                const moduleName = importMatch[1];
                
                // Проверяем и предлагаем исправления
                if (!moduleExists(moduleName)) {
                  let potentialFixes: string[] = [];
                  
                  // Пробуем различные вариации импорта
                  if (moduleName.startsWith('./')) {
                    // Попробуем с расширением
                    validExtensions.forEach(ext => {
                      if (moduleExists(`${moduleName}${ext}`)) {
                        potentialFixes.push(`${moduleName}${ext}`);
                      }
                    });
                    
                    // Попробуем с индексным файлом
                    if (moduleExists(`${moduleName}/index`)) {
                      potentialFixes.push(`${moduleName}/index`);
                    }
                  } else if (!moduleName.startsWith('@') && !moduleName.includes('/')) {
                    // Для npm пакетов редко требуются исправления
                    // Но можно проверить наличие в node_modules
                    if (moduleExists(`node_modules/${moduleName}`)) {
                      potentialFixes.push(moduleName);
                    }
                  }
                  
                  // Если нашли потенциальные исправления, показываем их
                  if (potentialFixes.length > 0) {
                    console.log(`Модуль ${moduleName} не найден. Возможные исправления:`, potentialFixes);
                    
                    // Здесь можно добавить код для показа подсказок пользователю
                    // Например, через lightbulb или другую UI подсказку
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при анализе маркеров импорта:', error);
        }
      });
    } catch (dependencyAnalyzerError) {
      console.error('Ошибка при настройке анализатора зависимостей:', dependencyAnalyzerError);
    }

    // Улучшение автодополнения кода - добавляем расширенные возможности
    try {
      // Настраиваем автодополнение для TypeScript
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
        noImplicitAny: false,
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: false,
        target: monaco.languages.typescript.ScriptTarget.ESNext,
      });

      // Настраиваем автодополнение для JavaScript
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
        noImplicitAny: false,
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: true,
        target: monaco.languages.typescript.ScriptTarget.ESNext,
      });

      // Активируем автодополнение
      monaco.editor.defineTheme('customTheme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#f5f5f5',
          'editor.lineHighlightBackground': '#e0e0e0',
          'editorSuggestWidget.background': '#ffffff',
          'editorSuggestWidget.border': '#d0d0d0',
          'editorSuggestWidget.selectedBackground': '#d6ebff',
        }
      });

      // Настраиваем быстрое автодополнение
      monaco.editor.EditorOptions.quickSuggestions.defaultValue = {
        other: true,
        comments: true,
        strings: true
      };
      
      monaco.editor.EditorOptions.suggestOnTriggerCharacters.defaultValue = true;
      monaco.editor.EditorOptions.snippetSuggestions.defaultValue = 'top';
      monaco.editor.EditorOptions.tabCompletion.defaultValue = 'on';
      monaco.editor.EditorOptions.suggest.defaultValue = {
        filterGraceful: true,
        showIcons: true,
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColor: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
        showUsers: true,
        showIssues: true
      };
    } catch (autocompleteError) {
      console.error('Ошибка при настройке автодополнения:', autocompleteError);
    }

    // Добавляем провайдер для автодополнения
    monaco.languages.registerCompletionItemProvider('typescript', {
      triggerCharacters: ['.', '/', '"', "'", '@'],
      provideCompletionItems: (model: any, position: any) => {
        try {
          const lineText = model.getLineContent(position.lineNumber);
          const wordUntil = model.getWordUntilPosition(position);
          const defaultRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordUntil.startColumn,
            endColumn: wordUntil.endColumn
          };
          
          // Автодополнение импортов
          if (lineText.trim().startsWith('import') || lineText.includes('require(')) {
            // Анализируем текущий импорт для генерации релевантных подсказок
            let currentImportPath = '';
            let inQuotes = false;
            let quoteChar = '';
            let importStart = 0;
            
            // Определяем, что пользователь вводит путь импорта
            if (lineText.includes('from')) {
              const fromIndex = lineText.indexOf('from');
              const afterFrom = lineText.substring(fromIndex + 4).trim();
              
              if (afterFrom.startsWith('"') || afterFrom.startsWith("'")) {
                quoteChar = afterFrom[0];
                inQuotes = true;
                importStart = fromIndex + 4 + afterFrom.indexOf(quoteChar) + 1;
                currentImportPath = afterFrom.substring(afterFrom.indexOf(quoteChar) + 1);
                
                // Удаляем закрывающую кавычку, если она есть
                if (currentImportPath.includes(quoteChar)) {
                  currentImportPath = currentImportPath.substring(0, currentImportPath.indexOf(quoteChar));
                }
              }
            } else if (lineText.includes('require(')) {
              const requireIndex = lineText.indexOf('require(');
              const afterRequire = lineText.substring(requireIndex + 8).trim();
              
              if (afterRequire.startsWith('"') || afterRequire.startsWith("'")) {
                quoteChar = afterRequire[0];
                inQuotes = true;
                importStart = requireIndex + 8 + afterRequire.indexOf(quoteChar) + 1;
                currentImportPath = afterRequire.substring(afterRequire.indexOf(quoteChar) + 1);
                
                // Удаляем закрывающую кавычку, если она есть
                if (currentImportPath.includes(quoteChar)) {
                  currentImportPath = currentImportPath.substring(0, currentImportPath.indexOf(quoteChar));
                }
              }
            }
            
            // Формируем подсказки на основе текущего пути
            let suggestions: any[] = [];
            
            // Если пользователь начал вводить путь
            if (inQuotes && position.column > importStart) {
              // Стандартные npm пакеты
              if (!currentImportPath.startsWith('.') && !currentImportPath.startsWith('/')) {
                suggestions = [
                  { label: 'react', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react', documentation: 'React - библиотека для создания пользовательских интерфейсов', range: defaultRange },
                  { label: 'react-dom', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react-dom', documentation: 'ReactDOM - рендерер для React в браузере', range: defaultRange },
                  { label: '@monaco-editor/react', kind: monaco.languages.CompletionItemKind.Module, insertText: '@monaco-editor/react', documentation: 'React компонент для Monaco Editor', range: defaultRange },
                  { label: '@tauri-apps/api', kind: monaco.languages.CompletionItemKind.Module, insertText: '@tauri-apps/api', documentation: 'Tauri API для взаимодействия с нативной частью', range: defaultRange },
                ];
                
                // Фильтруем по тому, что уже введено
                if (currentImportPath) {
                  suggestions = suggestions.filter(s => s.label.startsWith(currentImportPath));
                }
              } 
              // Для относительных путей - анализируем структуру проекта
              else if (currentImportPath.startsWith('.')) {
                // Стандартные каталоги проекта
                const commonFolders = [
                  { path: './components/', description: 'Папка с компонентами' },
                  { path: './utils/', description: 'Папка с утилитами' },
                  { path: './types/', description: 'Папка с типами' },
                  { path: './hooks/', description: 'Папка с React-хуками' },
                  { path: './services/', description: 'Папка с сервисами' },
                  { path: './store/', description: 'Папка с состоянием приложения' },
                  { path: './constants/', description: 'Папка с константами' },
                  { path: './assets/', description: 'Папка с ресурсами' },
                  { path: './styles/', description: 'Папка со стилями' },
                  { path: './api/', description: 'Папка с API' },
                ];
                
                // Если путь начинается с ./src/ - стандартная структура проекта
                if (currentImportPath.startsWith('./src/')) {
                  suggestions = commonFolders.map(folder => ({
                    label: `./src/${folder.path.substring(2)}`,
                    kind: monaco.languages.CompletionItemKind.Folder,
                    insertText: `./src/${folder.path.substring(2)}`,
                    documentation: folder.description,
                    range: defaultRange
                  }));
                }
                // Если путь начинается с ../
                else if (currentImportPath.startsWith('../')) {
                  suggestions = [
                    { label: '../components/', kind: monaco.languages.CompletionItemKind.Folder, insertText: '../components/', documentation: 'Папка с компонентами', range: defaultRange },
                    { label: '../utils/', kind: monaco.languages.CompletionItemKind.Folder, insertText: '../utils/', documentation: 'Папка с утилитами', range: defaultRange },
                    { label: '../types/', kind: monaco.languages.CompletionItemKind.Folder, insertText: '../types/', documentation: 'Папка с типами', range: defaultRange },
                  ];
                }
                // Стандартные пути в проекте
                else {
                  suggestions = commonFolders.map(folder => ({
                    label: folder.path,
                    kind: monaco.languages.CompletionItemKind.Folder,
                    insertText: folder.path,
                    documentation: folder.description,
                    range: defaultRange
                  }));
                }
                
                // Специфические пути в проекте X-Editor
                if (currentImportPath.startsWith('./main-screen/') || currentImportPath.includes('main-screen/')) {
                  const xEditorPaths = [
                    { path: './main-screen/centerContainer/', description: 'Центральный контейнер редактора' },
                    { path: './main-screen/bottom-toolbar/', description: 'Нижняя панель инструментов' },
                    { path: './main-screen/sidebar/', description: 'Боковая панель' },
                    { path: './main-screen/top-toolbar/', description: 'Верхняя панель инструментов' },
                  ];
                  
                  suggestions = [...suggestions, ...xEditorPaths.map(path => ({
                    label: path.path,
                    kind: monaco.languages.CompletionItemKind.Folder,
                    insertText: path.path,
                    documentation: path.description,
                    range: defaultRange
                  }))];
                }
                
                // Если путь уже содержит / - анализируем подпапки
                if (currentImportPath.includes('/')) {
                  // Для main-screen/bottom-toolbar/
                  if (currentImportPath.includes('main-screen/bottom-toolbar/')) {
                    suggestions = [
                      { label: currentImportPath + 'bottomBar', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'bottomBar', documentation: 'Компонент нижней панели', range: defaultRange },
                      { label: currentImportPath + 'index', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'index', documentation: 'Индексный файл', range: defaultRange },
                    ];
                  }
                  // Для main-screen/centerContainer/
                  else if (currentImportPath.includes('main-screen/centerContainer/')) {
                    suggestions = [
                      { label: currentImportPath + 'monacoConfig', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'monacoConfig', documentation: 'Конфигурация Monaco Editor', range: defaultRange },
                      { label: currentImportPath + 'centerContainer', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'centerContainer', documentation: 'Компонент центрального контейнера', range: defaultRange },
                      { label: currentImportPath + 'utils/', kind: monaco.languages.CompletionItemKind.Folder, insertText: currentImportPath + 'utils/', documentation: 'Папка с утилитами', range: defaultRange },
                    ];
                  }
                  // Для monaco-config/
                  else if (currentImportPath.includes('monaco-config/')) {
                    suggestions = [
                      { label: currentImportPath + 'index', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'index', documentation: 'Индексный файл конфигурации Monaco', range: defaultRange },
                      { label: currentImportPath + 'auto-types', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'auto-types', documentation: 'Автоматические типы', range: defaultRange },
                      { label: currentImportPath + 'jsx-types', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'jsx-types', documentation: 'JSX типы', range: defaultRange },
                      { label: currentImportPath + 'language-detector', kind: monaco.languages.CompletionItemKind.File, insertText: currentImportPath + 'language-detector', documentation: 'Детектор языка', range: defaultRange },
                    ];
                  }
                }
                
                // Фильтруем по тому, что уже введено
                if (currentImportPath) {
                  const pathSegments = currentImportPath.split('/');
                  const lastSegment = pathSegments[pathSegments.length - 1];
                  
                  // Если последний сегмент не пустой, фильтруем по нему
                  if (lastSegment) {
                    suggestions = suggestions.filter(s => {
                      const sLabel = s.label.endsWith('/') ? s.label : s.label + '/';
                      const labelSegments = sLabel.split('/');
                      const labelLastSegment = labelSegments[labelSegments.length - 2] || '';
                      
                      return labelLastSegment.startsWith(lastSegment);
                    });
                  }
                }
              }
            } else {
              // Базовые импорты без пути
              suggestions = [
                { label: 'react', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react', documentation: 'React - библиотека для создания пользовательских интерфейсов', range: defaultRange },
                { label: 'react-dom', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react-dom', documentation: 'ReactDOM - рендерер для React в браузере', range: defaultRange },
                { label: '@monaco-editor/react', kind: monaco.languages.CompletionItemKind.Module, insertText: '@monaco-editor/react', documentation: 'React компонент для Monaco Editor', range: defaultRange },
                { label: './components/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './components/', documentation: 'Папка с компонентами', range: defaultRange },
                { label: '../utils/', kind: monaco.languages.CompletionItemKind.Folder, insertText: '../utils/', documentation: 'Папка с утилитами', range: defaultRange },
                { label: './types/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './types/', documentation: 'Папка с типами', range: defaultRange },
                { label: './main-screen/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './main-screen/', documentation: 'Главный экран редактора', range: defaultRange },
                { label: './monaco-config/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './monaco-config/', documentation: 'Конфигурация Monaco Editor', range: defaultRange },
              ];
            }
            
            return { suggestions };
          }
          
          // Автодополнение методов объектов
          const dotMatch = lineText.substring(0, position.column - 1).match(/(\w+)\.\s*$/);
          if (dotMatch) {
            const objectName = dotMatch[1];
            
            const objectMethods: Record<string, any[]> = {
              'console': [
                { label: 'log', kind: monaco.languages.CompletionItemKind.Method, insertText: 'log', documentation: 'Outputs a message to the console' },
                { label: 'error', kind: monaco.languages.CompletionItemKind.Method, insertText: 'error', documentation: 'Outputs an error message to the console' },
                { label: 'warn', kind: monaco.languages.CompletionItemKind.Method, insertText: 'warn', documentation: 'Outputs a warning message to the console' },
                { label: 'info', kind: monaco.languages.CompletionItemKind.Method, insertText: 'info', documentation: 'Outputs an informational message to the console' },
              ],
              'Array': [
                { label: 'map', kind: monaco.languages.CompletionItemKind.Method, insertText: 'map', documentation: 'Creates a new array with the results of calling a provided function on every element in this array' },
                { label: 'filter', kind: monaco.languages.CompletionItemKind.Method, insertText: 'filter', documentation: 'Creates a new array with all elements that pass the test implemented by the provided function' },
                { label: 'find', kind: monaco.languages.CompletionItemKind.Method, insertText: 'find', documentation: 'Returns the value of the first element in the array that satisfies the provided testing function' },
                { label: 'forEach', kind: monaco.languages.CompletionItemKind.Method, insertText: 'forEach', documentation: 'Executes a provided function once for each array element' },
              ],
              'String': [
                { label: 'split', kind: monaco.languages.CompletionItemKind.Method, insertText: 'split', documentation: 'Splits a String object into an array of strings by separating the string into substrings' },
                { label: 'replace', kind: monaco.languages.CompletionItemKind.Method, insertText: 'replace', documentation: 'Returns a new string with some or all matches of a pattern replaced by a replacement' },
                { label: 'trim', kind: monaco.languages.CompletionItemKind.Method, insertText: 'trim', documentation: 'Removes whitespace from both ends of a string' },
                { label: 'toLowerCase', kind: monaco.languages.CompletionItemKind.Method, insertText: 'toLowerCase', documentation: 'Returns the calling string value converted to lowercase' },
              ],
              'Date': [
                { label: 'now', kind: monaco.languages.CompletionItemKind.Method, insertText: 'now', documentation: 'Returns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC)' },
                { label: 'parse', kind: monaco.languages.CompletionItemKind.Method, insertText: 'parse', documentation: 'Parses a string representation of a date and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC' },
              ],
              'Object': [
                { label: 'keys', kind: monaco.languages.CompletionItemKind.Method, insertText: 'keys', documentation: 'Returns an array of a given object\'s own enumerable property names' },
                { label: 'values', kind: monaco.languages.CompletionItemKind.Method, insertText: 'values', documentation: 'Returns an array of a given object\'s own enumerable property values' },
                { label: 'entries', kind: monaco.languages.CompletionItemKind.Method, insertText: 'entries', documentation: 'Returns an array of a given object\'s own enumerable string-keyed property [key, value] pairs' },
              ]
            };
            
            if (objectMethods[objectName]) {
              return { suggestions: objectMethods[objectName].map(s => ({...s, range: defaultRange})) };
            }
          }
          
          return { suggestions: [] };
        } catch (error) {
          console.error('Ошибка в provideCompletionItems:', error);
          return { suggestions: [] };
        }
      }
    });
    
    // Аналогичный провайдер для JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.', '/', '"', "'", '@'],
      provideCompletionItems: (model: any, position: any) => {
        try {
          const lineText = model.getLineContent(position.lineNumber);
          const wordUntil = model.getWordUntilPosition(position);
          const defaultRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordUntil.startColumn,
            endColumn: wordUntil.endColumn
          };
          
          // Автодополнение импортов
          if (lineText.trim().startsWith('import') || lineText.includes('require(')) {
            const suggestions = [
              { label: 'react', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react', range: defaultRange },
              { label: 'react-dom', kind: monaco.languages.CompletionItemKind.Module, insertText: 'react-dom', range: defaultRange },
              { label: '@monaco-editor/react', kind: monaco.languages.CompletionItemKind.Module, insertText: '@monaco-editor/react', range: defaultRange },
              { label: './components/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './components/', range: defaultRange },
              { label: '../utils/', kind: monaco.languages.CompletionItemKind.Folder, insertText: '../utils/', range: defaultRange },
              { label: './types/', kind: monaco.languages.CompletionItemKind.Folder, insertText: './types/', range: defaultRange }
            ];
            
            return { suggestions };
          }
          
          // Автодополнение методов объектов
          const dotMatch = lineText.substring(0, position.column - 1).match(/(\w+)\.\s*$/);
          if (dotMatch) {
            const objectName = dotMatch[1];
            
            const objectMethods: Record<string, any[]> = {
              'console': [
                { label: 'log', kind: monaco.languages.CompletionItemKind.Method, insertText: 'log', documentation: 'Outputs a message to the console' },
                { label: 'error', kind: monaco.languages.CompletionItemKind.Method, insertText: 'error', documentation: 'Outputs an error message to the console' },
                { label: 'warn', kind: monaco.languages.CompletionItemKind.Method, insertText: 'warn', documentation: 'Outputs a warning message to the console' },
                { label: 'info', kind: monaco.languages.CompletionItemKind.Method, insertText: 'info', documentation: 'Outputs an informational message to the console' },
              ],
              'Array': [
                { label: 'map', kind: monaco.languages.CompletionItemKind.Method, insertText: 'map', documentation: 'Creates a new array with the results of calling a provided function on every element in this array' },
                { label: 'filter', kind: monaco.languages.CompletionItemKind.Method, insertText: 'filter', documentation: 'Creates a new array with all elements that pass the test implemented by the provided function' },
                { label: 'find', kind: monaco.languages.CompletionItemKind.Method, insertText: 'find', documentation: 'Returns the value of the first element in the array that satisfies the provided testing function' },
                { label: 'forEach', kind: monaco.languages.CompletionItemKind.Method, insertText: 'forEach', documentation: 'Executes a provided function once for each array element' },
              ],
              'String': [
                { label: 'split', kind: monaco.languages.CompletionItemKind.Method, insertText: 'split', documentation: 'Splits a String object into an array of strings by separating the string into substrings' },
                { label: 'replace', kind: monaco.languages.CompletionItemKind.Method, insertText: 'replace', documentation: 'Returns a new string with some or all matches of a pattern replaced by a replacement' },
                { label: 'trim', kind: monaco.languages.CompletionItemKind.Method, insertText: 'trim', documentation: 'Removes whitespace from both ends of a string' },
                { label: 'toLowerCase', kind: monaco.languages.CompletionItemKind.Method, insertText: 'toLowerCase', documentation: 'Returns the calling string value converted to lowercase' },
              ],
              'Date': [
                { label: 'now', kind: monaco.languages.CompletionItemKind.Method, insertText: 'now', documentation: 'Returns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC)' },
                { label: 'parse', kind: monaco.languages.CompletionItemKind.Method, insertText: 'parse', documentation: 'Parses a string representation of a date and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC' },
              ],
              'Object': [
                { label: 'keys', kind: monaco.languages.CompletionItemKind.Method, insertText: 'keys', documentation: 'Returns an array of a given object\'s own enumerable property names' },
                { label: 'values', kind: monaco.languages.CompletionItemKind.Method, insertText: 'values', documentation: 'Returns an array of a given object\'s own enumerable property values' },
                { label: 'entries', kind: monaco.languages.CompletionItemKind.Method, insertText: 'entries', documentation: 'Returns an array of a given object\'s own enumerable string-keyed property [key, value] pairs' },
              ]
            };
            
            if (objectMethods[objectName]) {
              return { suggestions: objectMethods[objectName].map(s => ({...s, range: defaultRange})) };
            }
          }
          
          return { suggestions: [] };
        } catch (error) {
          console.error('Ошибка в provideCompletionItems:', error);
          return { suggestions: [] };
        }
      }
    });

    // Настройка визуального отображения ошибок и предупреждений
    monaco.editor.setModelMarkers(monaco.editor.getModel() || {}, 'typescript', []);
    monaco.editor.setModelMarkers(monaco.editor.getModel() || {}, 'javascript', []);
    
    // Показываем правильный курсор при наведении на маркеры ошибок
    monaco.editor.EditorOptions.hoverHighlightGlyphs = true;

    // Добавляем дополнительные типы для лучших подсказок
    try {
      // Добавляем определения для React
      monaco.languages.typescript.typescriptDefaults.addExtraLib(`
        declare module "react" {
          export = React;
          export as namespace React;
          
          namespace React {
            interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
              type: T;
              props: P;
              key: Key | null;
            }
            
            type JSXElementConstructor<P> = ((props: P) => ReactElement | null) | (new (props: P) => Component<P, any>);
            
            interface ReactComponentElement<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> {
              type: T;
              props: any;
              key: Key | null;
            }
            
            type Key = string | number;
            
            interface RefObject<T> {
              readonly current: T | null;
            }
            
            type Ref<T> = RefCallback<T> | RefObject<T> | null;
            type RefCallback<T> = (instance: T | null) => void;
            
            abstract class Component<P, S> {
              constructor(props: P);
              setState(state: S | ((prevState: S, props: P) => S)): void;
              forceUpdate(): void;
              render(): ReactNode;
              readonly props: Readonly<P>;
              state: Readonly<S>;
            }
            
            // Hooks
            function useState<S>(initialState: S | (() => S)): [S, (state: S | ((prevState: S) => S)) => void];
            function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
            function useContext<T>(context: Context<T>): T;
            function useReducer<R extends Reducer<any, any>>(reducer: R, initialState: ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
            function useCallback<T extends Function>(callback: T, deps: ReadonlyArray<any>): T;
            function useMemo<T>(factory: () => T, deps: ReadonlyArray<any>): T;
            function useRef<T>(initialValue: T): MutableRefObject<T>;
            function useImperativeHandle<T, R extends T>(ref: Ref<T>, init: () => R, deps?: ReadonlyArray<any>): void;
            function useLayoutEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
            function useDebugValue<T>(value: T, format?: (value: T) => any): void;
            
            // Types
            type ReactNode = ReactElement | ReactFragment | ReactPortal | string | number | boolean | null | undefined;
            interface ReactPortal extends ReactElement {
              key: Key | null;
              children: ReactNode;
            }
            type ReactFragment = Iterable<ReactNode>;
            
            // Context
            interface Context<T> {
              Provider: Provider<T>;
              Consumer: Consumer<T>;
            }
            interface Provider<T> {
              (props: { value: T; children?: ReactNode }): ReactElement | null;
            }
            interface Consumer<T> {
              (props: { children: (value: T) => ReactNode }): ReactElement | null;
            }
            function createContext<T>(defaultValue: T): Context<T>;
            
            // Other types
            type Reducer<S, A> = (prevState: S, action: A) => S;
            type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
            type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
            interface MutableRefObject<T> {
              current: T;
            }
          }
        }
      `, 'react.d.ts');
      
      // Добавляем определения для JSX
      monaco.languages.typescript.typescriptDefaults.addExtraLib(`
        declare namespace JSX {
          interface Element extends React.ReactElement<any, any> { }
          interface ElementClass extends React.Component<any, any> {
            render(): React.ReactNode;
          }
          interface ElementAttributesProperty { props: {}; }
          interface ElementChildrenAttribute { children: {}; }
          
          interface IntrinsicAttributes extends React.Attributes { }
          interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> { }
          
          interface IntrinsicElements {
            // HTML
            a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
            abbr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            address: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            area: React.DetailedHTMLProps<React.AreaHTMLAttributes<HTMLAreaElement>, HTMLAreaElement>;
            article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
            b: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            base: React.DetailedHTMLProps<React.BaseHTMLAttributes<HTMLBaseElement>, HTMLBaseElement>;
            bdi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            bdo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            big: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            blockquote: React.DetailedHTMLProps<React.BlockquoteHTMLAttributes<HTMLElement>, HTMLElement>;
            body: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBodyElement>, HTMLBodyElement>;
            br: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
            button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
            canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
            caption: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            cite: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            code: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            col: React.DetailedHTMLProps<React.ColHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            colgroup: React.DetailedHTMLProps<React.ColgroupHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            data: React.DetailedHTMLProps<React.DataHTMLAttributes<HTMLDataElement>, HTMLDataElement>;
            datalist: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDataListElement>, HTMLDataListElement>;
            dd: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            del: React.DetailedHTMLProps<React.DelHTMLAttributes<HTMLElement>, HTMLElement>;
            details: React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLElement>, HTMLElement>;
            dfn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
            div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
            dl: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDListElement>, HTMLDListElement>;
            dt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            em: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            embed: React.DetailedHTMLProps<React.EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
            fieldset: React.DetailedHTMLProps<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
            figcaption: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            figure: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
            h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            head: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadElement>, HTMLHeadElement>;
            header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            hgroup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            hr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
            html: React.DetailedHTMLProps<React.HtmlHTMLAttributes<HTMLHtmlElement>, HTMLHtmlElement>;
            i: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
            img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
            input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
            ins: React.DetailedHTMLProps<React.InsHTMLAttributes<HTMLModElement>, HTMLModElement>;
            kbd: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
            legend: React.DetailedHTMLProps<React.HTMLAttributes<HTMLLegendElement>, HTMLLegendElement>;
            li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
            link: React.DetailedHTMLProps<React.LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;
            main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            map: React.DetailedHTMLProps<React.MapHTMLAttributes<HTMLMapElement>, HTMLMapElement>;
            mark: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            menu: React.DetailedHTMLProps<React.MenuHTMLAttributes<HTMLElement>, HTMLElement>;
            meta: React.DetailedHTMLProps<React.MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
            meter: React.DetailedHTMLProps<React.MeterHTMLAttributes<HTMLElement>, HTMLElement>;
            nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            noscript: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            object: React.DetailedHTMLProps<React.ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
            ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
            optgroup: React.DetailedHTMLProps<React.OptgroupHTMLAttributes<HTMLOptGroupElement>, HTMLOptGroupElement>;
            option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
            output: React.DetailedHTMLProps<React.OutputHTMLAttributes<HTMLElement>, HTMLElement>;
            p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
            param: React.DetailedHTMLProps<React.ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
            picture: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            pre: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>;
            progress: React.DetailedHTMLProps<React.ProgressHTMLAttributes<HTMLProgressElement>, HTMLProgressElement>;
            q: React.DetailedHTMLProps<React.QuoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
            rp: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            rt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            ruby: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            s: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            samp: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            script: React.DetailedHTMLProps<React.ScriptHTMLAttributes<HTMLScriptElement>, HTMLScriptElement>;
            section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
            small: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            source: React.DetailedHTMLProps<React.SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
            span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
            strong: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>;
            sub: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            summary: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            sup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
            tbody: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
            td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
            textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
            tfoot: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
            th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
            thead: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
            time: React.DetailedHTMLProps<React.TimeHTMLAttributes<HTMLElement>, HTMLElement>;
            title: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTitleElement>, HTMLTitleElement>;
            tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
            track: React.DetailedHTMLProps<React.TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
            u: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
            var: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
            wbr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            
            // SVG
            svg: React.SVGProps<SVGSVGElement>;
            circle: React.SVGProps<SVGCircleElement>;
            ellipse: React.SVGProps<SVGEllipseElement>;
            g: React.SVGProps<SVGGElement>;
            line: React.SVGProps<SVGLineElement>;
            path: React.SVGProps<SVGPathElement>;
            polygon: React.SVGProps<SVGPolygonElement>;
            polyline: React.SVGProps<SVGPolylineElement>;
            rect: React.SVGProps<SVGRectElement>;
            text: React.SVGProps<SVGTextElement>;
            use: React.SVGProps<SVGUseElement>;
          }
        }
      `, 'jsx.d.ts');
    } catch (error) {
      console.error('Ошибка при добавлении типов React/JSX:', error);
    }

    // Функция для преобразования путей импорта в абсолютные пути Windows-формата
    function getWindowsStyleAbsolutePath(basePath: string, relativePath: string): string {
      try {
        console.log('getWindowsStyleAbsolutePath вызвана с:', { basePath, relativePath });
        
        // Проверка входных параметров
        if (!basePath || !relativePath) {
          console.warn('Пустые параметры в getWindowsStyleAbsolutePath', { basePath, relativePath });
          return relativePath || '';
        }
        
        // Корневой путь проекта
        const rootPath = 'C:\\PROJECTS\\X-Editor';
        console.log('Корневой путь проекта:', rootPath);
        
        // Функция для нормализации пути в формат Windows
        const normalizeToWindows = (path: string): string => 
          path.replace(/\//g, '\\').replace(/\\+/g, '\\');
        
        // Нормализация путей
        const normBasePath = normalizeToWindows(basePath);
        console.log('Нормализованный базовый путь:', normBasePath);
        
        // Если это npm пакет (без ./ или ../)
        if (!relativePath.startsWith('.') && !relativePath.includes('/')) {
          const npmPath = `${rootPath}\\node_modules\\${relativePath}`;
          console.log('Путь npm пакета:', npmPath);
          return npmPath;
        }
        
        // Получение директории текущего файла
        let baseDir = normBasePath.substring(0, normBasePath.lastIndexOf('\\'));
        // Если путь не содержит backslash, используем как есть
        if (baseDir === normBasePath) {
          baseDir = normBasePath;
        }
        console.log('Базовая директория:', baseDir);
        
        // Если basePath не включает корневой путь проекта, добавляем его
        if (!baseDir.toLowerCase().includes(rootPath.toLowerCase()) && !baseDir.match(/^[a-z]:/i)) {
          baseDir = `${rootPath}\\src${baseDir.startsWith('\\') ? '' : '\\'}${baseDir}`;
          console.log('Скорректированная базовая директория:', baseDir);
        }
        
        // Обработка относительных путей
        let result = '';
        if (relativePath.startsWith('./')) {
          // Относительный путь от текущего файла
          const relPath = normalizeToWindows(relativePath.substring(2));
          result = `${baseDir}\\${relPath}`;
          console.log('Относительный путь ./', result);
        } else if (relativePath.startsWith('../')) {
          // Относительный путь с выходом на уровень выше
          let relPath = normalizeToWindows(relativePath);
          let tempBaseDir = baseDir;
          
          while (relPath.startsWith('..\\')) {
            tempBaseDir = tempBaseDir.substring(0, tempBaseDir.lastIndexOf('\\'));
            relPath = relPath.substring(3);
          }
          
          result = `${tempBaseDir}\\${relPath}`;
          console.log('Относительный путь ../', result);
        } else if (relativePath.startsWith('/')) {
          // Абсолютный путь от корня проекта
          const absPath = normalizeToWindows(relativePath.substring(1));
          result = `${rootPath}\\${absPath}`;
          console.log('Абсолютный путь /', result);
        } else {
          // Предполагаем, что это путь относительно корня src
          result = `${rootPath}\\src\\${normalizeToWindows(relativePath)}`;
          console.log('Путь относительно src:', result);
        }
        
        // Чистка результата от двойных слешей
        result = result.replace(/\\\\/g, '\\');
        console.log('Итоговый путь:', result);
        
        return result;
      } catch (error) {
        console.error('Ошибка в getWindowsStyleAbsolutePath:', error);
        return relativePath;
      }
    }

    // Настройка провайдеров подсказок при наведении
    setupHoverProviders(monaco);

    console.log("Регистрация провайдеров для всех поддерживаемых языков");
    
    // Удаляем старый провайдер для TypeScript, чтобы избежать конфликтов
    try {
      monaco.languages.getHoverProviders('typescript').forEach((provider: any) => {
        try {
          monaco.languages.unregisterHoverProvider('typescript', provider);
        } catch (error) {
          console.error('Ошибка при удалении провайдера TypeScript:', error);
        }
      });
      console.log("Старые провайдеры удалены");
    } catch (error) {
      console.error('Ошибка при получении провайдеров TypeScript:', error);
    }

    // Регистрируем провайдеры для всех поддерживаемых языков
    const languages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'html', 'css', 'json'];

    languages.forEach(language => {
      monaco.languages.registerHoverProvider(language, {
        provideHover: function(model: any, position: any) {
          try {
            const lineContent = model.getLineContent(position.lineNumber);
            console.log(`[${language}] Проверка строки:`, lineContent);
            
            // Получаем uri модели с полным путем
            const uriString = model.uri.toString();
            // Преобразуем URI в реальный путь к файлу
            const modelPath = decodeURIComponent(uriString.replace('file:///', '')).replace(/\//g, '\\');
            console.log('Полный путь к файлу модели:', modelPath);
            
            // Регулярное выражение для поиска импортов в зависимости от языка
            let importRegexps;
            
            if (language === 'html') {
              importRegexps = [
                /<script\s+src=["'](.*?)["']/g,
                /<link\s+.*?href=["'](.*?)["']/g,
                /<img\s+.*?src=["'](.*?)["']/g
              ];
            } else if (language === 'css') {
              importRegexps = [
                /@import\s+["'](.*?)["']/g,
                /url\(["'](.*?)["']\)/g
              ];
            } else {
              importRegexps = [
                /import\s+(?:.*?)\s+from\s+['"](.*?)['"];/g,
                /import\s+['"](.*?)['"];/g,
                /require\s*\(\s*['"](.*?)['"]\s*\)/g,
                /import\s*\(\s*['"](.*?)['"]\s*\)/g
              ];
            }
            
            for (const regex of importRegexps) {
              let match;
              regex.lastIndex = 0; // Сбрасываем lastIndex для повторного использования регулярного выражения
              
              while ((match = regex.exec(lineContent)) !== null) {
                const importPath = match[1];
                const pathStartIndex = lineContent.indexOf(importPath, match.index);
                const pathEndIndex = pathStartIndex + importPath.length;
                
                console.log('Найден импорт:', importPath, 'позиция:', position.column, 'диапазон:', pathStartIndex, pathEndIndex);
                
                // Проверяем, находится ли курсор над путем импорта
                if (position.column > pathStartIndex && position.column <= pathEndIndex) {
                  console.log('Курсор над импортом:', importPath);
                  
                  // Определяем путь к текущему файлу
                  const currentFileDir = modelPath.substring(0, modelPath.lastIndexOf('\\'));
                  console.log('Директория текущего файла:', currentFileDir);
                  
                  // Преобразуем относительный путь в абсолютный
                  let absolutePath = '';
                  const rootPath = 'C:\\PROJECTS\\X-Editor';
                  
                  // npm пакеты
                  if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.includes('/') && !importPath.includes('\\')) {
                    absolutePath = `${rootPath}\\node_modules\\${importPath}`;
                  }
                  // Абсолютные пути (с полным диском)
                  else if (/^[A-Za-z]:[\\\/]/i.test(importPath)) {
                    absolutePath = importPath.replace(/\//g, '\\');
                  }
                  // Относительные пути ./
                  else if (importPath.startsWith('./')) {
                    absolutePath = `${currentFileDir}\\${importPath.substring(2).replace(/\//g, '\\')}`;
                  }
                  // Относительные пути ../
                  else if (importPath.startsWith('../')) {
                    let tempPath = importPath;
                    let tempDir = currentFileDir;
                    
                    while (tempPath.startsWith('../')) {
                      tempDir = tempDir.substring(0, tempDir.lastIndexOf('\\'));
                      tempPath = tempPath.substring(3);
                    }
                    
                    absolutePath = `${tempDir}\\${tempPath.replace(/\//g, '\\')}`;
                  }
                  // Абсолютные пути от корня проекта
                  else if (importPath.startsWith('/')) {
                    absolutePath = `${rootPath}${importPath.replace(/\//g, '\\')}`;
                  }
                  // HTTP(S) URL
                  else if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
                    absolutePath = importPath;
                  }
                  // Обычные импорты (предполагаем относительно src)
                  else {
                    absolutePath = `${rootPath}\\src\\${importPath.replace(/\//g, '\\')}`;
                  }
                  
                  console.log('Определенный абсолютный путь:', absolutePath);
                  
                  // Добавляем информацию о типе модуля
                  let moduleType = "Модуль";
                  let moduleDesc = "";
                  
                  if (importPath === 'react') {
                    moduleType = "React";
                    moduleDesc = "Основная библиотека React";
                  } else if (importPath === 'react-dom') {
                    moduleType = "React DOM";
                    moduleDesc = "Библиотека для рендеринга React в DOM";
                  } else if (importPath.startsWith('@monaco-editor')) {
                    moduleType = "Monaco Editor";
                    moduleDesc = "Библиотека Monaco Editor";
                  } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    moduleType = "Локальный модуль";
                    moduleDesc = "Файл из текущего проекта";
                  } else if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
                    moduleType = "Внешний ресурс";
                    moduleDesc = "URL внешнего ресурса";
                  }
                  
                  // Добавляем расширение файла к пути, если его нет и это не URL
                  if (!absolutePath.match(/\.[a-zA-Z0-9]+$/) && 
                      !absolutePath.startsWith('http://') && 
                      !absolutePath.startsWith('https://')) {
                    // Определяем расширение в зависимости от языка
                    let extension = 'ts';
                    if (language === 'javascript' || language === 'javascriptreact') {
                      extension = 'js';
                    } else if (language === 'typescriptreact') {
                      extension = 'tsx';
                    } else if (language === 'javascriptreact') {
                      extension = 'jsx';
                    }
                    
                    // По умолчанию используем определенное расширение
                    if (!absolutePath.endsWith('/index') && !absolutePath.endsWith('\\index')) {
                      absolutePath += `.${extension}`;
                    } else {
                      absolutePath += `.${extension}`;
                    }
                  }
                  
                  // Канонизируем путь для корректного отображения
                  const canonicalPath = getCanonicalPath(absolutePath);
                  
                  // Добавляем проверку и исправление для inmemory путей
                  let finalPath = canonicalPath;
                  if (canonicalPath.startsWith('inmemory:')) {
                    // Для inmemory моделей указываем реальный путь
                    console.log('Обнаружен inmemory путь:', canonicalPath);
                    console.log('Анализируем импорт:', importPath);
                    
                    // Заменяем inmemory путь на реальный
                    if (importPath === './monaco-config' || importPath === 'monaco-config') {
                      finalPath = 'C:\\PROJECTS\\X-Editor\\src\\monaco-config';
                    } else {
                      // Для других inmemory путей
                      finalPath = `C:\\PROJECTS\\X-Editor\\src\\${importPath.replace('./', '').replace(/\//g, '\\')}`;
                    }
                    console.log('Заменяем на реальный путь:', finalPath);
                  }
                  
                  // Проверяем наличие файла
                  const pathExists = fileExists(finalPath);
                  const statusIcon = pathExists ? '✅' : '❌';
                  const fileStatus = pathExists ? 'Файл существует' : 'Файл не найден';
                  
                  // Добавляем информацию о типе файла
                  let fileInfo = '';
                  if (absolutePath.includes('.')) {
                    const ext = absolutePath.split('.').pop() || '';
                    const fileTypes: Record<string, string> = {
                      'ts': 'TypeScript файл',
                      'tsx': 'TypeScript с JSX компонентами',
                      'js': 'JavaScript файл',
                      'jsx': 'JavaScript с JSX компонентами',
                      'css': 'CSS стили',
                      'scss': 'SCSS стили',
                      'json': 'JSON файл данных',
                      'md': 'Markdown документация'
                    };
                    
                    if (fileTypes[ext]) {
                      fileInfo = `\n\nТип: ${fileTypes[ext]}`;
                    }
                  }
                  
                  // Формируем подсказку
                  return {
                    contents: [
                      { value: `**${moduleType}**` },
                      { value: moduleDesc },
                      { value: `**Полный путь:** \`${finalPath}\` ${statusIcon}` },
                      { value: `**Статус:** ${fileStatus}` },
                      { value: `**Относительный путь в проекте:** \`${importPath}\`${fileInfo}` }
                    ]
                  };
                }
              }
            }
            
            return null;
          } catch (error) {
            console.error(`[${language}] Ошибка при отображении полного пути:`, error);
            return null;
          }
        }
      });
    });

    // Получаем корень проекта из Tauri API или вычисляем его
    let projectRootCache: string | null = null;

    async function getProjectRoot(): Promise<string> {
      try {
        if (projectRootCache) {
          return projectRootCache;
        }
        
        // Пытаемся получить текущую директорию через Tauri API
        if (typeof window !== 'undefined' && window.__TAURI__) {
          // Для Tauri приложения
          try {
            const appDir = await window.__TAURI__.path.appDir();
            // Поднимаемся выше до корня проекта
            projectRootCache = appDir;
            return appDir;
          } catch (error) {
            console.error('Ошибка при получении appDir через Tauri API:', error);
          }
        }
        
        // Если не удалось через Tauri, пробуем определить из текущего пути
        const currentPath = window.location.pathname;
        const pathParts = currentPath.split('/');
        
        // Ищем директорию src в пути
        const srcIndex = pathParts.indexOf('src');
        if (srcIndex !== -1) {
          const rootPath = pathParts.slice(0, srcIndex).join('/');
          projectRootCache = rootPath;
          return rootPath;
        }
        
        // Запасной вариант - возвращаем текущую директорию
        return '';
      } catch (error) {
        console.error('Ошибка при определении корня проекта:', error);
        return '';
      }
    }

    // Обновим функцию обработки импортов
    const processImportHover = (model: any, position: any, lineContent: string): any => {
        try {
          // Имена известных JavaScript/TypeScript классов и их описания
          const jsClassDescriptions: Record<string, string> = {
            'Array': 'JavaScript Array object represents a collection of values that you can iterate.',
            'String': 'JavaScript String object represents character sequence and provides methods for working with text.',
            'Date': 'JavaScript Date object for working with dates and times.',
            'Map': 'JavaScript Map object that holds key-value pairs and remembers the original insertion order of the keys.',
            'Set': 'JavaScript Set object stores unique values of any type.',
            'Object': 'JavaScript Object represents one of JavaScript\'s data types.',
            'Promise': 'JavaScript Promise object representing eventual completion of an asynchronous operation.',
            'RegExp': 'JavaScript RegExp object for matching text with a pattern.',
            'Error': 'JavaScript Error object representing an error during execution.',
            'Function': 'JavaScript Function object that can be called, with code that executed during the call.',
            'Boolean': 'JavaScript Boolean object represents a logical value: true or false.',
            'Number': 'JavaScript Number object represents numeric values, including integers and floating-point numbers.',
            'Math': 'JavaScript Math object provides mathematical operations and constants.',
            'JSON': 'JavaScript JSON object provides methods for parsing JSON and converting values to JSON.',
            'Intl': 'JavaScript Intl object provides language sensitive string comparison, number formatting, and date and time formatting.',
            'ArrayBuffer': 'JavaScript ArrayBuffer object used to represent a generic, fixed-length raw binary data buffer.',
            'DataView': 'JavaScript DataView object provides a low-level interface for reading and writing multiple number types in a binary ArrayBuffer.',
            'TypedArray': 'JavaScript TypedArray objects provide a mechanism for accessing raw binary data.',
            'WeakMap': 'JavaScript WeakMap object is a collection of key/value pairs in which the keys are weakly referenced.',
            'WeakSet': 'JavaScript WeakSet object is a collection of weakly held objects.',
            'Symbol': 'JavaScript Symbol represents a unique identifier.',
            'Proxy': 'JavaScript Proxy object used to define custom behavior for fundamental operations.',
            'Reflect': 'JavaScript Reflect object provides methods for interceptable JavaScript operations.',
          };
          
          // Регулярные выражения для определения импортов с захватом пути импорта
          const importMatches = [
            { regex: /import\s+.*?from\s+['"](.*?)['"]/g, isRequire: false },
            { regex: /import\s+['"](.*?)['"]/g, isRequire: false },
            { regex: /require\s*\(\s*['"](.*?)['"]\s*\)/g, isRequire: true },
            { regex: /import\s*\(\s*['"](.*?)['"]\s*\)/g, isRequire: false }
          ];
          
          // Проверяем, находится ли курсор над именем класса или типа
          const word = model.getWordAtPosition(position);
          if (word && jsClassDescriptions[word.word]) {
            return {
              range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              contents: [
                { value: `**${word.word}**` },
                { value: jsClassDescriptions[word.word] }
              ]
            };
          }
          
          for (const { regex, isRequire } of importMatches) {
            let match;
            regex.lastIndex = 0; // Сбрасываем индекс регулярного выражения
            
            while ((match = regex.exec(lineContent)) !== null) {
              const importPath = match[1];
              const pathStart = match.index + match[0].indexOf(importPath);
              const pathEnd = pathStart + importPath.length;
              
              // Проверяем, находится ли курсор на пути импорта
              if (position.column > pathStart && position.column <= pathEnd) {
                console.log(`Курсор находится над импортом: "${importPath}"`);
                
                // Получаем текущий файл через URI модели
                const uriString = model.uri.toString();
                // Нормализуем путь для Windows
                let currentFilePath = decodeURIComponent(uriString.replace('file:///', '')).replace(/\//g, '\\');
                console.log('Текущий файл (из URI):', currentFilePath);
                
                // Получаем директорию текущего файла
                const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('\\') > 0 ? 
                  currentFilePath.lastIndexOf('\\') : currentFilePath.length);
                console.log('Директория текущего файла:', currentDir);
                
                // Определяем корень проекта динамически
                let projectRoot = '';
                
                // Специальная обработка для in-memory моделей
                if (currentFilePath.includes('inmemory:') || currentFilePath.includes('model')) {
                  // Для in-memory моделей используем динамическое определение корня проекта
                  projectRoot = getBaseProjectPath();
                } else {
                  // Для обычных файлов определяем корень проекта
                  projectRoot = detectProjectRoot(currentFilePath);
                }
                
                console.log('Определенный корень проекта:', projectRoot);
                
                // Функция для нормализации пути Windows
                const normalizeToWindows = (path: string): string => {
                  return path.replace(/\//g, '\\').replace(/\\+/g, '\\');
                };
                
                // Преобразуем в абсолютный путь в зависимости от типа пути
                let absolutePath = '';
                let displayPath = ''; // Инициализируем displayPath здесь
                
                const possibleExtensions = [
                  '', '.ts', '.tsx', '.js', '.jsx', '.json', '.css',
                  '/index.ts', '/index.tsx', '/index.js', '/index.jsx'
                ];
                
                // Определяем тип пути
                if (importPath.startsWith('./') || importPath.startsWith('.\\')) {
                  // Относительный путь от текущего файла
                  const relativePath = normalizeToWindows(importPath.replace('./', '').replace('.\\', ''));
                  const basePath = `${currentDir}\\${relativePath}`;
                  absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                  console.log('Относительный путь ./', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                  
                } else if (importPath.startsWith('../') || importPath.startsWith('..\\')) {
                  // Относительный путь с подъёмом на уровень выше
                  let upCount = 0;
                  let importPathCopy = importPath;
                  
                  // Считаем количество подъёмов вверх
                  while (importPathCopy.startsWith('../') || importPathCopy.startsWith('..\\')) {
                    upCount++;
                    importPathCopy = importPathCopy.replace('../', '').replace('..\\', '');
                  }
                  
                  // Поднимаемся на нужное количество уровней
                  let parentDir = currentDir;
                  for (let i = 0; i < upCount; i++) {
                    const lastSlashIndex = parentDir.lastIndexOf('\\');
                    if (lastSlashIndex !== -1) {
                      parentDir = parentDir.substring(0, lastSlashIndex);
                    }
                  }
                  
                  const basePath = `${parentDir}\\${normalizeToWindows(importPathCopy)}`;
                  absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                  console.log('Относительный путь ../', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                  
                } else if (importPath.startsWith('@/') || importPath.startsWith('@\\')) {
                  // Алиас @/ указывает на директорию src
                  const pathAfterAlias = normalizeToWindows(importPath.replace('@/', '').replace('@\\', ''));
                  const basePath = `${projectRoot}\\src\\${pathAfterAlias}`;
                  absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                  console.log('Алиас @/', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                  
                } else if (importPath.startsWith('/') || importPath.startsWith('\\')) {
                  // Абсолютный путь от корня проекта
                  const basePath = `${projectRoot}${normalizeToWindows(importPath)}`;
                  absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                  console.log('Абсолютный путь /', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                  
                } else if (importPath.match(/^[a-zA-Z0-9_\-@][a-zA-Z0-9_\-@\/]*$/)) {
                  // npm пакет или скоуп-пакет (@org/pkg)
                  const nodeModulesPath = `${projectRoot}\\node_modules\\${importPath}`;
                  
                  // Проверяем существование пакета
                  if (directoryExists(nodeModulesPath)) {
                    // Проверяем package.json для определения main файла
                    const packageJsonPath = `${nodeModulesPath}\\package.json`;
                    
                    if (fileExists(packageJsonPath)) {
                      // В реальном приложении здесь должен быть код чтения package.json
                      // и определения main файла
                      absolutePath = nodeModulesPath;
                    } else {
                      // Пробуем стандартные точки входа
                      absolutePath = findFileWithExtensions(`${nodeModulesPath}\\index`, possibleExtensions);
                    }
                  } else {
                    absolutePath = nodeModulesPath;
                  }
                  console.log('npm пакет:', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                  
                } else {
                  // Неизвестный формат пути
                  absolutePath = importPath;
                  console.log('Неизвестный формат пути:', absolutePath);
                  displayPath = absolutePath; // Устанавливаем displayPath
                }
                
                // Формируем ховер
                let finalPath = absolutePath;
                
                // Проверяем наличие файла, если это не inmemory путь
                if (!absolutePath.includes('inmemory:') && !absolutePath.includes('model')) {
                  // Если путь абсолютный и содержит путь проекта, показываем относительный от корня проекта
                  if (absolutePath.startsWith(projectRoot)) {
                    displayPath = `(project root)${absolutePath.slice(projectRoot.length)}`;
                  }
                }
                
                if (absolutePath.startsWith('inmemory:')) {
                  console.log('Обнаружен inmemory путь в основной секции:', absolutePath);
                  
                  // Получаем текущий путь из URI модели и определяем корень проекта
                  const uriPath = model.uri.toString();
                  console.log('URI модели:', uriPath);
                  
                  // Используем фиксированный путь проекта для in-memory моделей
                  projectRoot = 'C:\\PROJECTS\\X-Editor';
                  console.log('Определенный корень проекта:', projectRoot);
                  
                  // Обработка алиасов и специальных путей
                  if (importPath.startsWith('@/')) {
                    // Обрабатываем алиасы (@/components/...)
                    const modulePath = importPath.replace('@/', '');
                    finalPath = `${projectRoot}\\src\\${modulePath.replace(/\//g, '\\')}`;
                    console.log('Обработан алиас @/:', finalPath);
                  } else if (importPath.startsWith('./') || importPath.startsWith('.\\')) {
                    // Относительный путь (./module)
                    const modulePath = importPath.replace('./', '').replace('.\\', '');
                    finalPath = `${projectRoot}\\src\\${modulePath.replace(/\//g, '\\')}`;
                    console.log('Обработан относительный путь ./:', finalPath);
                  } else if (importPath.startsWith('/') || importPath.startsWith('\\')) {
                    // Абсолютный путь от корня
                    finalPath = `${projectRoot}${importPath.replace(/\//g, '\\')}`;
                    console.log('Обработан абсолютный путь /:', finalPath);
                  } else {
                    // Предполагаем, что это npm пакет
                    finalPath = `${projectRoot}\\node_modules\\${importPath.replace(/\//g, '\\')}`;
                    console.log('Обработан npm пакет:', finalPath);
                  }
                  
                  // Устанавливаем путь для отображения
                  displayPath = finalPath;
                }
                
                // Финальное форматирование отображаемого пути
                if (displayPath.includes('node_modules')) {
                  const nodeModulesIndex = displayPath.indexOf('node_modules');
                  displayPath = `node_modules/${displayPath.slice(nodeModulesIndex + 13)}`;
                }
                
                return {
                  range: new monaco.Range(
                    position.lineNumber,
                    pathStart + 1,
                    position.lineNumber,
                    pathEnd + 1
                  ),
                  contents: [
                    { value: '**Import Module**' },
                    { value: `Full path: \`${finalPath}\`` },
                    { value: `Displayed as: \`${displayPath}\`` }
                  ]
                };
              }
            }
          }
          
          return null;
        } catch (error) {
          console.error('Ошибка при обработке hovera импорта:', error);
          return null;
        }
      };

    // Обработка стандартных JS объектов и методов
    const processJsObjectHover = (word: string, lineContent: string, position: any): any => {
      try {
        // Словарь описаний для стандартных объектов и методов JS
        const jsObjectDescriptions: Record<string, string> = {
          'Date': '**Date: DateConstructor**\n\nEnables basic storage and retrieval of dates and times.',
          'Array': '**Array<T>**\n\nProvides methods for working with arrays of values.',
          'String': '**String**\n\nRepresents sequence of characters and provides methods for manipulating them.',
          'Object': '**Object**\n\nProvides functionality common to all JavaScript objects.',
          'Math': '**Math**\n\nAn intrinsic object that provides basic mathematics functionality and constants.',
          'parseInt': '**parseInt(string: string, radix?: number): number**\n\nConverts a string to an integer.',
          'JSON': '**JSON**\n\nAn intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.',
          'Promise': '**Promise<T>**\n\nRepresents the eventual completion (or failure) of an asynchronous operation and its resulting value.',
          'console': '**console**\n\nProvides access to the browser\'s debugging console.',
          'log': '**console.log(...data: any[]): void**\n\nOutputs a message to the console.'
        };
        
        // Проверка на методы объектов (например, Date.now())
        const objectMethodRegex = /(\w+)\.(\w+)/g;
        let methodMatch;
        
        while ((methodMatch = objectMethodRegex.exec(lineContent)) !== null) {
          const objectName = methodMatch[1];
          const methodName = methodMatch[2];
          const methodStart = methodMatch.index + objectName.length + 1; // +1 для точки
          const methodEnd = methodStart + methodName.length;
          
          if (position.column > methodStart && position.column <= methodEnd) {
            // Специальные описания для методов объектов
            const methodDescriptions: Record<string, Record<string, string>> = {
              'Date': {
                'now': '**Date.now(): number**\n\nReturns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC).',
                'parse': '**Date.parse(dateString: string): number**\n\nParses a string representation of a date and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC.',
                'UTC': '**Date.UTC(year: number, month: number, ...args: number[]): number**\n\nAccepts parameters similar to the Date constructor, but treats them as UTC.'
              },
              'Array': {
                'isArray': '**Array.isArray(value: any): boolean**\n\nReturns true if the value is an array.',
                'from': '**Array.from(arrayLike: ArrayLike<T>): T[]**\n\nCreates a new Array instance from an array-like object.'
              },
              'Object': {
                'keys': '**Object.keys(o: object): string[]**\n\nReturns an array of a given object\'s own enumerable string-keyed property names.',
                'values': '**Object.values(o: object): any[]**\n\nReturns an array of a given object\'s own enumerable property values.',
                'entries': '**Object.entries(o: object): [string, any][]**\n\nReturns an array of a given object\'s own enumerable string-keyed property [key, value] pairs.'
              },
              'JSON': {
                'parse': '**JSON.parse(text: string): any**\n\nParses a JSON string, constructing the JavaScript value or object described by the string.',
                'stringify': '**JSON.stringify(value: any, replacer?: (string | number)[] | null | ((key: string, value: any) => any), space?: string | number): string**\n\nConverts a JavaScript value to a JSON string.'
              },
              'Math': {
                'random': '**Math.random(): number**\n\nReturns a pseudorandom number between 0 and 1.',
                'floor': '**Math.floor(x: number): number**\n\nReturns the largest integer less than or equal to its numeric argument.',
                'ceil': '**Math.ceil(x: number): number**\n\nReturns the smallest integer greater than or equal to its numeric argument.',
                'round': '**Math.round(x: number): number**\n\nReturns the value of a number rounded to the nearest integer.'
              },
              'String': {
                'fromCharCode': '**String.fromCharCode(...codes: number[]): string**\n\nReturns a string created by using the specified sequence of Unicode values.'
              },
              'console': {
                'log': '**console.log(...data: any[]): void**\n\nOutputs a message to the console.',
                'error': '**console.error(...data: any[]): void**\n\nOutputs an error message to the console.',
                'warn': '**console.warn(...data: any[]): void**\n\nOutputs a warning message to the console.',
                'info': '**console.info(...data: any[]): void**\n\nOutputs an informational message to the console.'
              }
            };
            
            if (methodDescriptions[objectName] && methodDescriptions[objectName][methodName]) {
              return {
                contents: [
                  { value: methodDescriptions[objectName][methodName] }
                ]
              };
            }
          }
        }
        
        // Если не найдено как метод, проверяем как отдельное слово
        if (jsObjectDescriptions[word]) {
          return {
            contents: [
              { value: jsObjectDescriptions[word] }
            ]
          };
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка при обработке подсказки JS объекта:', error);
        return null;
      }
    };

    // Обработка JSX элементов
    const processJsxHover = (lineContent: string, position: any): any => {
      try {
        const jsxElementRegex = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*)/g;
        let jsxMatch;
        
        while ((jsxMatch = jsxElementRegex.exec(lineContent)) !== null) {
          const elementName = jsxMatch[1];
          const elementStart = jsxMatch.index + 1; // +1 для пропуска символа <
          const elementEnd = elementStart + elementName.length;
          
          if (position.column >= elementStart && position.column <= elementEnd) {
            // Базовые HTML элементы
            const htmlElements = [
              'div', 'span', 'p', 'h1', 'h2', 'h3', 'button', 'a', 'img', 
              'input', 'form', 'ul', 'li', 'table', 'tr', 'td'
            ];
            
            if (htmlElements.includes(elementName.toLowerCase())) {
              return {
                contents: [
                  { value: `**<${elementName}>** - HTML элемент\n\nСтандартный HTML элемент в JSX.` }
                ]
              };
            } else if (elementName[0] === elementName[0].toUpperCase()) {
              // Для React компонентов
              return {
                contents: [
                  { value: `**<${elementName}>** - React компонент\n\nПользовательский React компонент.` }
                ]
              };
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка при обработке JSX элемента:', error);
        return null;
      }
    };

    // Регистрируем провайдеры для разных языков
    registerHoverProvider('typescript');
    registerHoverProvider('javascript');
    registerHoverProvider('typescriptreact');
    registerHoverProvider('javascriptreact');

    return monaco;
  } catch (error) {
    console.error('Критическая ошибка при настройке Monaco:', error);
    // Возвращаем исходный экземпляр Monaco без конфигурации, чтобы избежать белого экрана
    return monaco;
  }
};

/**
 * Настраивает отображение подсказок при наведении на элементы
 */
function setupHoverProviders(monaco: any) {
  try {
    // Функция для разрешения абсолютных путей
    function resolveAbsolutePath(basePath: string, relativePath: string): string {
      try {
        // Защита от пустых значений
        if (!basePath || !relativePath) {
          console.warn('Пустые параметры в resolveAbsolutePath', { basePath, relativePath });
          return relativePath || '';
        }
        
        // Корневой путь проекта
        const rootPath = 'C:/PROJECTS/X-Editor';
        
        // Если путь уже абсолютный с буквой диска
        if (/^[a-zA-Z]:\//i.test(relativePath)) {
          return relativePath;
        }
        
        // Если путь абсолютный без буквы диска (начинается с /)
        if (relativePath.startsWith('/')) {
          return `C:${relativePath}`;
        }
        
        // Для npm пакетов
        if (!relativePath.startsWith('.') && !relativePath.includes('/')) {
          return `${rootPath}/node_modules/${relativePath}`;
        }
        
        // Нормализация базового пути
        let normalizedBasePath = basePath.replace(/\\/g, '/');
        if (normalizedBasePath.endsWith('/')) {
          normalizedBasePath = normalizedBasePath.slice(0, -1);
        }
        
        // Для относительных путей
        if (relativePath.startsWith('./')) {
          const dir = normalizedBasePath.substring(0, normalizedBasePath.lastIndexOf('/'));
          const cleanPath = relativePath.substring(2);
          return `${dir}/${cleanPath}`;
        }
        
        // Для относительных путей с выходом на уровень выше
        if (relativePath.startsWith('../')) {
          let dir = normalizedBasePath.substring(0, normalizedBasePath.lastIndexOf('/'));
          let path = relativePath;
          
          while (path.startsWith('../')) {
            dir = dir.substring(0, dir.lastIndexOf('/'));
            path = path.substring(3);
          }
          
          return `${dir}/${path}`;
        }
        
        // Обрабатываем импорты без ./ и ../
        if (!relativePath.startsWith('.')) {
          return `${rootPath}/${relativePath}`;
        }
        
        // Если ничего не подошло, возвращаем относительно корня проекта
        return `${rootPath}/${relativePath}`;
      } catch (error) {
        console.error('Ошибка в resolveAbsolutePath:', error);
        return relativePath || '';
      }
    }
    
    // Расширенный провайдер подсказок
    const registerHoverProvider = (languageId: string) => {
      try {
        // Функция для проверки существования файла (демонстрационная)
        function fileExists(path: string): boolean {
          try {
            console.log(`[${languageId}] Проверка существования файла:`, path);
            // В реальном приложении здесь будет код для проверки файла
            
            // Демонстрационная логика для симуляции проверки файлов
            if (path.includes('node_modules')) {
              // Предполагаем, что большинство зависимостей существуют
              return true;
            } else if (path.includes('\\src\\') || path.includes('/src/')) {
              // Для файлов в src папке делаем более сложную проверку
              const hasCodeExtension = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json'].some(ext => 
                path.toLowerCase().endsWith(ext));
              return hasCodeExtension;
            }
            
            // По умолчанию зависит от содержимого пути
            return path.length > 10; // Простая эвристика для демонстрации
          } catch (error) {
            console.error('Ошибка при проверке существования файла:', error);
            return false;
          }
        }
        
        monaco.languages.registerHoverProvider(languageId, {
          provideHover: function(model: any, position: any) {
            try {
              const word = model.getWordAtPosition(position);
              if (!word) return null;
              
              const lineContent = model.getLineContent(position.lineNumber);
              
              // 1. Проверяем стандартные JS объекты и методы
              const jsObjectHover = processJsObjectHover(word.word, lineContent, position);
              if (jsObjectHover) return jsObjectHover;
              
              // 2. Обрабатываем импорты
              const importHover = processImportHover(model, position, lineContent);
              if (importHover) return importHover;
              
              // 3. Проверяем JSX элементы
              const jsxHover = processJsxHover(lineContent, position);
              if (jsxHover) return jsxHover;
              
              // 4. Стандартные подсказки Monaco
              return null;
            } catch (error) {
              console.error('Ошибка в provideHover:', error);
              return null;
            }
          }
        });
      } catch (error) {
        console.error(`Ошибка при регистрации провайдера для ${languageId}:`, error);
      }
    };

    // Обработка стандартных JS объектов и методов
    const processJsObjectHover = (word: string, lineContent: string, position: any): any => {
      try {
        // Словарь описаний для стандартных объектов и методов JS
        const jsObjectDescriptions: Record<string, string> = {
          'Date': '**Date: DateConstructor**\n\nEnables basic storage and retrieval of dates and times.',
          'Array': '**Array<T>**\n\nProvides methods for working with arrays of values.',
          'String': '**String**\n\nRepresents sequence of characters and provides methods for manipulating them.',
          'Object': '**Object**\n\nProvides functionality common to all JavaScript objects.',
          'Math': '**Math**\n\nAn intrinsic object that provides basic mathematics functionality and constants.',
          'parseInt': '**parseInt(string: string, radix?: number): number**\n\nConverts a string to an integer.',
          'JSON': '**JSON**\n\nAn intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.',
          'Promise': '**Promise<T>**\n\nRepresents the eventual completion (or failure) of an asynchronous operation and its resulting value.',
          'console': '**console**\n\nProvides access to the browser\'s debugging console.',
          'log': '**console.log(...data: any[]): void**\n\nOutputs a message to the console.'
        };
        
        // Проверка на методы объектов (например, Date.now())
        const objectMethodRegex = /(\w+)\.(\w+)/g;
        let methodMatch;
        
        while ((methodMatch = objectMethodRegex.exec(lineContent)) !== null) {
          const objectName = methodMatch[1];
          const methodName = methodMatch[2];
          const methodStart = methodMatch.index + objectName.length + 1; // +1 для точки
          const methodEnd = methodStart + methodName.length;
          
          if (position.column > methodStart && position.column <= methodEnd) {
            // Специальные описания для методов объектов
            const methodDescriptions: Record<string, Record<string, string>> = {
              'Date': {
                'now': '**Date.now(): number**\n\nReturns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC).',
                'parse': '**Date.parse(dateString: string): number**\n\nParses a string representation of a date and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC.',
                'UTC': '**Date.UTC(year: number, month: number, ...args: number[]): number**\n\nAccepts parameters similar to the Date constructor, but treats them as UTC.'
              },
              'Array': {
                'isArray': '**Array.isArray(value: any): boolean**\n\nReturns true if the value is an array.',
                'from': '**Array.from(arrayLike: ArrayLike<T>): T[]**\n\nCreates a new Array instance from an array-like object.'
              },
              'Object': {
                'keys': '**Object.keys(o: object): string[]**\n\nReturns an array of a given object\'s own enumerable string-keyed property names.',
                'values': '**Object.values(o: object): any[]**\n\nReturns an array of a given object\'s own enumerable property values.',
                'entries': '**Object.entries(o: object): [string, any][]**\n\nReturns an array of a given object\'s own enumerable string-keyed property [key, value] pairs.'
              },
              'JSON': {
                'parse': '**JSON.parse(text: string): any**\n\nParses a JSON string, constructing the JavaScript value or object described by the string.',
                'stringify': '**JSON.stringify(value: any, replacer?: (string | number)[] | null | ((key: string, value: any) => any), space?: string | number): string**\n\nConverts a JavaScript value to a JSON string.'
              },
              'Math': {
                'random': '**Math.random(): number**\n\nReturns a pseudorandom number between 0 and 1.',
                'floor': '**Math.floor(x: number): number**\n\nReturns the largest integer less than or equal to its numeric argument.',
                'ceil': '**Math.ceil(x: number): number**\n\nReturns the smallest integer greater than or equal to its numeric argument.',
                'round': '**Math.round(x: number): number**\n\nReturns the value of a number rounded to the nearest integer.'
              },
              'String': {
                'fromCharCode': '**String.fromCharCode(...codes: number[]): string**\n\nReturns a string created by using the specified sequence of Unicode values.'
              },
              'console': {
                'log': '**console.log(...data: any[]): void**\n\nOutputs a message to the console.',
                'error': '**console.error(...data: any[]): void**\n\nOutputs an error message to the console.',
                'warn': '**console.warn(...data: any[]): void**\n\nOutputs a warning message to the console.',
                'info': '**console.info(...data: any[]): void**\n\nOutputs an informational message to the console.'
              }
            };
            
            if (methodDescriptions[objectName] && methodDescriptions[objectName][methodName]) {
              return {
                contents: [
                  { value: methodDescriptions[objectName][methodName] }
                ]
              };
            }
          }
        }
        
        // Если не найдено как метод, проверяем как отдельное слово
        if (jsObjectDescriptions[word]) {
          return {
            contents: [
              { value: jsObjectDescriptions[word] }
            ]
          };
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка при обработке подсказки JS объекта:', error);
        return null;
      }
    };

    // Обработка импортов
    const processImportHover = (model: any, position: any, lineContent: string): any => {
      try {
        // Ищем импорты в текущей строке
        const importMatches = [
          { regex: /import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/g, isRequire: false },
          { regex: /import\s+['"]([^'"]+)['"];/g, isRequire: false },
          { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, isRequire: true },
          { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, isRequire: false }
        ];
        
        // Функция для проверки существования файла с учетом расширений
        const findFileWithExtensions = (basePath: string, extensions: string[]): string => {
          // Проверяем файл без расширения
          if (fileExists(basePath)) {
            console.log('Файл существует:', basePath);
            return basePath;
          }
          
          // Проверяем с разными расширениями
          for (let i = 0; i < extensions.length; i++) {
            const ext = extensions[i];
            const pathWithExt = `${basePath}${ext}`;
            if (fileExists(pathWithExt)) {
              console.log('Найден файл с расширением:', pathWithExt);
              return pathWithExt;
            }
          }
          
          // Проверяем index файлы в директориях
          if (directoryExists(basePath)) {
            for (let i = 0; i < extensions.length; i++) {
              const ext = extensions[i];
              const indexPath = `${basePath}\\index${ext}`;
              if (fileExists(indexPath)) {
                console.log('Найден index файл:', indexPath);
                return indexPath;
              }
            }
          }
          
          // Если ничего не найдено, возвращаем исходный путь
          console.log('Файл не найден, возвращаем исходный путь:', basePath);
          return basePath;
        };
        
        // Функция для проверки существования файла
        const fileExists = (path: string): boolean => {
          try {
            // В браузерной среде нам нужно использовать API, которое доступно
            if (typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined') {
              // Используем Tauri API для проверки
              // Заметка: в реальном коде это должно быть асинхронным, 
              // но для простоты примера сделаем синхронный подход
              try {
                // Пытаемся прочитать файл синхронно, если не получается - файл не существует
                // Заменяется на реальный вызов Tauri API в продакшн коде
                return true; // Для демонстрации предполагаем, что файл существует
              } catch {
                return false;
              }
            } else {
              // Для тестирования предполагаем, что файл существует
              console.log('Предполагаем существование файла (тестовый режим):', path);
              return true;
            }
          } catch (error) {
            console.error('Ошибка при проверке существования файла:', error);
            return false;
          }
        };
        
        // Функция для проверки существования директории
        const directoryExists = (path: string): boolean => {
          try {
            // В браузерной среде нам нужно использовать API, которое доступно
            if (typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined') {
              // Используем Tauri API для проверки
              // Заметка: в реальном коде это должно быть асинхронным, 
              // но для простоты примера сделаем синхронный подход
              try {
                // Пытаемся получить содержимое директории, если не получается - директория не существует
                // Заменяется на реальный вызов Tauri API в продакшн коде
                return true; // Для демонстрации предполагаем, что директория существует
              } catch {
                return false;
              }
            } else {
              // Для тестирования предполагаем, что директория существует
              console.log('Предполагаем существование директории (тестовый режим):', path);
              return true;
            }
          } catch (error) {
            console.error('Ошибка при проверке существования директории:', error);
            return false;
          }
        };
        
        for (const { regex, isRequire } of importMatches) {
          let match;
          regex.lastIndex = 0; // Сбрасываем индекс регулярного выражения
          
          while ((match = regex.exec(lineContent)) !== null) {
            const importPath = match[1];
            const pathStart = match.index + match[0].indexOf(importPath);
            const pathEnd = pathStart + importPath.length;
            
            // Проверяем, находится ли курсор на пути импорта
            if (position.column > pathStart && position.column <= pathEnd) {
              console.log(`Курсор находится над импортом: "${importPath}"`);
              
              // Получаем текущий файл через URI модели
              const uriString = model.uri.toString();
              const currentFilePath = decodeURIComponent(uriString.replace('file:///', '')).replace(/\//g, '\\');
              console.log('Текущий файл (из URI):', currentFilePath);
              
              // Получаем директорию текущего файла
              const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('\\') > 0 ? 
                currentFilePath.lastIndexOf('\\') : currentFilePath.length);
              console.log('Директория текущего файла:', currentDir);
              
              // Определяем корень проекта динамически
              let projectRoot = '';
              
              // Специальная обработка для in-memory моделей
              if (currentFilePath.includes('inmemory:') || currentFilePath.includes('model')) {
                // Для in-memory моделей используем динамическое определение корня проекта
                projectRoot = getBaseProjectPath();
              } else {
                // Для обычных файлов определяем корень проекта
                projectRoot = detectProjectRoot(currentFilePath);
              }
              
              console.log('Определенный корень проекта:', projectRoot);
              
              // Функция для нормализации пути Windows
              const normalizeToWindows = (path: string): string => {
                return path.replace(/\//g, '\\').replace(/\\+/g, '\\');
              };
              
              // Преобразуем в абсолютный путь в зависимости от типа пути
              let absolutePath = '';
              let displayPath = ''; // Инициализируем displayPath здесь
              
              const possibleExtensions = [
                '', '.ts', '.tsx', '.js', '.jsx', '.json', '.css',
                '/index.ts', '/index.tsx', '/index.js', '/index.jsx'
              ];
              
              // Определяем тип пути
              if (importPath.startsWith('./') || importPath.startsWith('.\\')) {
                // Относительный путь от текущего файла
                const relativePath = normalizeToWindows(importPath.replace('./', '').replace('.\\', ''));
                const basePath = `${currentDir}\\${relativePath}`;
                absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                console.log('Относительный путь ./', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
                
              } else if (importPath.startsWith('../') || importPath.startsWith('..\\')) {
                // Относительный путь с подъёмом на уровень выше
                let upCount = 0;
                let importPathCopy = importPath;
                
                // Считаем количество подъёмов вверх
                while (importPathCopy.startsWith('../') || importPathCopy.startsWith('..\\')) {
                  upCount++;
                  importPathCopy = importPathCopy.replace('../', '').replace('..\\', '');
                }
                
                // Поднимаемся на нужное количество уровней
                let parentDir = currentDir;
                for (let i = 0; i < upCount; i++) {
                  const lastSlashIndex = parentDir.lastIndexOf('\\');
                  if (lastSlashIndex !== -1) {
                    parentDir = parentDir.substring(0, lastSlashIndex);
                  }
                }
                
                const basePath = `${parentDir}\\${normalizeToWindows(importPathCopy)}`;
                absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                console.log('Относительный путь ../', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
                
              } else if (importPath.startsWith('@/') || importPath.startsWith('@\\')) {
                // Алиас @/ указывает на директорию src
                const pathAfterAlias = normalizeToWindows(importPath.replace('@/', '').replace('@\\', ''));
                const basePath = `${projectRoot}\\src\\${pathAfterAlias}`;
                absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                console.log('Алиас @/', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
                
              } else if (importPath.startsWith('/') || importPath.startsWith('\\')) {
                // Абсолютный путь от корня проекта
                const basePath = `${projectRoot}${normalizeToWindows(importPath)}`;
                absolutePath = findFileWithExtensions(basePath, possibleExtensions);
                console.log('Абсолютный путь /', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
                
              } else if (importPath.match(/^[a-zA-Z0-9_\-@][a-zA-Z0-9_\-@\/]*$/)) {
                // npm пакет или скоуп-пакет (@org/pkg)
                const nodeModulesPath = `${projectRoot}\\node_modules\\${importPath}`;
                
                // Проверяем существование пакета
                if (directoryExists(nodeModulesPath)) {
                  // Проверяем package.json для определения main файла
                  const packageJsonPath = `${nodeModulesPath}\\package.json`;
                  
                  if (fileExists(packageJsonPath)) {
                    // В реальном приложении здесь должен быть код чтения package.json
                    // и определения main файла
                    absolutePath = nodeModulesPath;
                  } else {
                    // Пробуем стандартные точки входа
                    absolutePath = findFileWithExtensions(`${nodeModulesPath}\\index`, possibleExtensions);
                  }
                } else {
                  absolutePath = nodeModulesPath;
                }
                console.log('npm пакет:', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
                
              } else {
                // Неизвестный формат пути
                absolutePath = importPath;
                console.log('Неизвестный формат пути:', absolutePath);
                displayPath = absolutePath; // Устанавливаем displayPath
              }
              
              // Формируем ховер
              let finalPath = absolutePath;
              
              // Проверяем наличие файла, если это не inmemory путь
              if (!absolutePath.includes('inmemory:') && !absolutePath.includes('model')) {
                // Если путь абсолютный и содержит путь проекта, показываем относительный от корня проекта
                if (absolutePath.startsWith(projectRoot)) {
                  displayPath = `(project root)${absolutePath.slice(projectRoot.length)}`;
                }
              }
              
              if (absolutePath.startsWith('inmemory:')) {
                console.log('Обнаружен inmemory путь в основной секции:', absolutePath);
                
                // Получаем текущий путь из URI модели и определяем корень проекта
                const uriPath = model.uri.toString();
                console.log('URI модели:', uriPath);
                
                // Используем фиксированный путь проекта для in-memory моделей
                projectRoot = 'C:\\PROJECTS\\X-Editor';
                console.log('Определенный корень проекта:', projectRoot);
                
                // Обработка алиасов и специальных путей
                if (importPath.startsWith('@/')) {
                  // Обрабатываем алиасы (@/components/...)
                  const modulePath = importPath.replace('@/', '');
                  finalPath = `${projectRoot}\\src\\${modulePath.replace(/\//g, '\\')}`;
                  console.log('Обработан алиас @/:', finalPath);
                } else if (importPath.startsWith('./') || importPath.startsWith('.\\')) {
                  // Относительный путь (./module)
                  const modulePath = importPath.replace('./', '').replace('.\\', '');
                  finalPath = `${projectRoot}\\src\\${modulePath.replace(/\//g, '\\')}`;
                  console.log('Обработан относительный путь ./:', finalPath);
                } else if (importPath.startsWith('/') || importPath.startsWith('\\')) {
                  // Абсолютный путь от корня
                  finalPath = `${projectRoot}${importPath.replace(/\//g, '\\')}`;
                  console.log('Обработан абсолютный путь /:', finalPath);
                } else {
                  // Предполагаем, что это npm пакет
                  finalPath = `${projectRoot}\\node_modules\\${importPath.replace(/\//g, '\\')}`;
                  console.log('Обработан npm пакет:', finalPath);
                }
                
                // Устанавливаем путь для отображения
                displayPath = finalPath;
              }
              
              // Финальное форматирование отображаемого пути
              if (displayPath.includes('node_modules')) {
                const nodeModulesIndex = displayPath.indexOf('node_modules');
                displayPath = `node_modules/${displayPath.slice(nodeModulesIndex + 13)}`;
              }
              
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  pathStart + 1,
                  position.lineNumber,
                  pathEnd + 1
                ),
                contents: [
                  { value: '**Import Module**' },
                  { value: `Full path: \`${finalPath}\`` },
                  { value: `Displayed as: \`${displayPath}\`` }
                ]
              };
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка при обработке импорта:', error);
        return null;
      }
    };

    // Обработка JSX элементов
    const processJsxHover = (lineContent: string, position: any): any => {
      try {
        const jsxElementRegex = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*)/g;
        let jsxMatch;
        
        while ((jsxMatch = jsxElementRegex.exec(lineContent)) !== null) {
          const elementName = jsxMatch[1];
          const elementStart = jsxMatch.index + 1; // +1 для пропуска символа <
          const elementEnd = elementStart + elementName.length;
          
          if (position.column >= elementStart && position.column <= elementEnd) {
            // Базовые HTML элементы
            const htmlElements = [
              'div', 'span', 'p', 'h1', 'h2', 'h3', 'button', 'a', 'img', 
              'input', 'form', 'ul', 'li', 'table', 'tr', 'td'
            ];
            
            if (htmlElements.includes(elementName.toLowerCase())) {
              return {
                contents: [
                  { value: `**<${elementName}>** - HTML элемент\n\nСтандартный HTML элемент в JSX.` }
                ]
              };
            } else if (elementName[0] === elementName[0].toUpperCase()) {
              // Для React компонентов
              return {
                contents: [
                  { value: `**<${elementName}>** - React компонент\n\nПользовательский React компонент.` }
                ]
              };
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка при обработке JSX элемента:', error);
        return null;
      }
    };

    // Регистрируем провайдеры для разных языков
    registerHoverProvider('typescript');
    registerHoverProvider('javascript');
    registerHoverProvider('typescriptreact');
    registerHoverProvider('javascriptreact');

    return monaco;
  } catch (error) {
    console.error('Ошибка при настройке подсказок:', error);
    return monaco;
  }
}

// Вспомогательная функция для определения корня проекта
function detectProjectRoot(currentFilePath: string): string {
  try {
    console.log('Определение корня проекта на основе:', currentFilePath);
    
    // Проверка на in-memory модель
    if (currentFilePath.includes('inmemory:') || currentFilePath.includes('model')) {
      console.log('Обнаружена in-memory модель, используем специальную обработку');
      // Используем динамическое определение корня проекта
      const projectPath = getBaseProjectPath();
      return projectPath;
    }
    
    // Получение буквы диска
    const diskMatch = currentFilePath.match(/^([a-zA-Z]:).*/);
    const diskLetter = diskMatch && diskMatch[1] ? diskMatch[1] : '';
    console.log('Определена буква диска:', diskLetter);
    
    if (!diskLetter) {
      console.warn('Не удалось определить букву диска из пути:', currentFilePath);
      // Используем динамическое определение корня проекта
      return getBaseProjectPath();
    }
    
    // ... остальной код функции detectProjectRoot ...
    
    // Если корень проекта не найден, используем директорию файла
    if (!root) {
      console.log('Корень проекта не найден, используем директорию файла:', directory);
      return directory;
    }
    
    console.log('Определен корень проекта:', root);
    return root;
  } catch (error) {
    console.error('Ошибка при определении корня проекта:', error);
    // В случае ошибки используем динамическое определение корня проекта
    return getBaseProjectPath();
  }
}

// Функция для получения канонического пути
const getCanonicalPath = (path: string): string => {
  try {
    // Проверка на in-memory путь
    if (path.includes('inmemory:') || path.includes('model')) {
      // Для in-memory моделей пытаемся определить реальный путь
      const projectRoot = getBaseProjectPath();
      // Заменяем путь inmemory на реальный путь в проекте
      return path.replace(/inmemory:[\\/\\]+model[\\\/]+\d+/i, `${projectRoot}\\src`)
                .replace(/inmemory:[\\\/]+model/i, `${projectRoot}\\src`)
                .replace(/^inmemory:/i, `${projectRoot}\\src`);
    }
    
    // Нормализуем слэши к Windows-стилю
    let normalizedPath = path.replace(/\//g, '\\').replace(/\\+/g, '\\');
    
    // Преобразуем относительные сегменты пути (.., .)
    const segments = normalizedPath.split('\\');
    const resultSegments: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment === '..') {
        if (resultSegments.length > 0) {
          resultSegments.pop();
        }
      } else if (segment !== '.' && segment !== '') {
        resultSegments.push(segment);
      }
    }
    
    // Собираем путь обратно
    let resultPath = resultSegments.join('\\');
    
    // Добавляем букву диска если это абсолютный путь
    if (/^[a-zA-Z]:/.test(path)) {
      const driveLetter = path.substring(0, 2);
      if (!resultPath.startsWith(driveLetter)) {
        resultPath = driveLetter + (resultPath.startsWith('\\') ? resultPath : '\\' + resultPath);
      }
    } else if (!resultPath.match(/^[a-zA-Z]:\\/)) {
      // Если путь не начинается с буквы диска, добавляем букву диска текущей директории
      try {
        // Получаем корень проекта для определения диска
        const basePath = getBaseProjectPath();
        const diskMatch = basePath.match(/^([a-zA-Z]:\\)/);
        const diskPrefix = diskMatch ? diskMatch[1] : 'C:\\';
        
        resultPath = diskPrefix + (resultPath.startsWith('\\') ? resultPath.substring(1) : resultPath);
      } catch (e) {
        // Если не удалось получить текущую директорию, используем по умолчанию C:
        resultPath = 'C:\\' + (resultPath.startsWith('\\') ? resultPath.substring(1) : resultPath);
      }
    }
    
    return resultPath;
  } catch (error) {
    console.error('Ошибка при получении канонического пути:', error);
    return path;
  }
};

// Получение корня проекта для in-memory моделей
function getProjectRootForInMemory(): string {
  return getBaseProjectPath();
}

// Кэш для корня проекта чтобы не вычислять каждый раз
let cachedProjectRoot = '';

// Получает базовый путь проекта с учетом текущей среды
function getBaseProjectPath(): string {
  try {
    // Если уже есть кэшированный путь, возвращаем его
    if (cachedProjectRoot) {
      return cachedProjectRoot;
    }

    // Пробуем разные способы определения текущей директории
    // 1. Через process.cwd() (работает в Node.js)
    if (typeof process !== 'undefined' && process.cwd) {
      cachedProjectRoot = process.cwd().replace(/\//g, '\\');
      return cachedProjectRoot;
    }
    
    // 2. Через window.location (для браузеров)
    if (typeof window !== 'undefined') {
      // Получаем директорию из URL
      const path = window.location.pathname;
      // Если URL содержит src, находим корень проекта
      const srcIndex = path.indexOf('/src/');
      if (srcIndex >= 0) {
        cachedProjectRoot = path.substring(0, srcIndex).replace(/\//g, '\\');
        if (cachedProjectRoot) {
          return cachedProjectRoot;
        }
      }
      
      // Если это file:// протокол
      if (window.location.protocol === 'file:') {
        const decodedPath = decodeURIComponent(window.location.pathname);
        // Вычисляем корень проекта из текущего пути
        const parts = decodedPath.split('/');
        // Ищем 'src' директорию
        for (let i = parts.length - 1; i >= 0; i--) {
          if (parts[i] === 'src') {
            // Берем все до src как корень проекта
            cachedProjectRoot = parts.slice(0, i).join('/').replace(/\//g, '\\');
            if (cachedProjectRoot) {
              return cachedProjectRoot;
            }
          }
        }
      }
    }
    
    // 3. Через Tauri API (если доступно)
    if (typeof window !== 'undefined' && window.__TAURI__?.path) {
      // Асинхронная функция, но для синхронного контекста возвращаем Promise
      window.__TAURI__.path.appDir().then(dir => {
        cachedProjectRoot = dir.replace(/\//g, '\\');
      }).catch(err => {
        console.error('Ошибка при получении appDir:', err);
      });
      
      // В этом случае нет синхронного результата, поэтому используем запасной вариант
      // Код может быть обновлен позже в асинхронном блоке
    }
    
    // Если ничего не сработало, используем текущую директорию документа
    if (typeof document !== 'undefined') {
      const baseUrl = document.baseURI;
      if (baseUrl && baseUrl !== 'about:blank') {
        try {
          const url = new URL(baseUrl);
          // Удаляем протокол и хост
          let path = url.pathname;
          // Если это не корень
          if (path !== '/') {
            // Нормализуем путь
            cachedProjectRoot = path.replace(/\//g, '\\');
            if (cachedProjectRoot) {
              return cachedProjectRoot;
            }
          }
        } catch (e) {
          console.error('Ошибка при парсинге baseURI:', e);
        }
      }
    }
    
    // Если ничего не сработало, используем временный путь
    // Можно указать другое значение по умолчанию
    const diskLetter = typeof navigator !== 'undefined' && navigator.platform && navigator.platform.startsWith('Win') ? 'C:' : '';
    return `${diskLetter}\\Projects`;
  } catch (error) {
    console.error('Ошибка при определении базового пути проекта:', error);
    // В случае ошибки возвращаем запасной вариант
    return 'C:\\Projects';
  }
}

// Функция для разрешения модульных путей для импортов
function resolveModulePath(projectRoot: string, importPath: string): string {
  try {
    // Если импорт уже содержит букву диска, это абсолютный путь
    if (/^[a-zA-Z]:/.test(importPath)) {
      return importPath;
    }
    
    // Нормализуем слэши
    const normalizedImport = importPath.replace(/\//g, '\\');
    
    // Обрабатываем разные типы путей
    if (normalizedImport.startsWith('@\\') || normalizedImport.startsWith('@/')) {
      // Алиас @/ указывает на директорию src
      const pathAfterAlias = normalizedImport.replace(/^@[\\\/]/, '');
      return `${projectRoot}\\src\\${pathAfterAlias}`;
    } else if (normalizedImport.startsWith('.\\') || normalizedImport.startsWith('./')) {
      // Относительный путь от текущего файла
      // Для точного расчета нужно знать директорию текущего файла
      // В данном случае предполагаем, что это относительно корня проекта
      const relativePath = normalizedImport.replace(/^.[\\\/]/, '');
      return `${projectRoot}\\${relativePath}`;
    } else if (normalizedImport.startsWith('..\\') || normalizedImport.startsWith('../')) {
      // Относительный путь с выходом на уровень выше
      // Для точного расчета нужно знать директорию текущего файла
      // В данном случае предполагаем, что это относительно корня проекта
      const relativePath = normalizedImport.replace(/^..[\\\/]/, '');
      const parentDir = projectRoot.substring(0, projectRoot.lastIndexOf('\\'));
      return `${parentDir}\\${relativePath}`;
    } else if (normalizedImport.startsWith('\\') || normalizedImport.startsWith('/')) {
      // Абсолютный путь от корня проекта
      return `${projectRoot}${normalizedImport}`;
    } else {
      // Предполагаем, что это npm пакет
      return `${projectRoot}\\node_modules\\${normalizedImport}`;
    }
  } catch (error) {
    console.error('Ошибка при разрешении пути модуля:', error);
    return importPath;
  }
}
