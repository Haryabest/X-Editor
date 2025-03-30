// @ts-nocheck
/**
 * Универсальная конфигурация Monaco Editor с поддержкой всех языков и улучшенной подсветкой.
 */

// Глобальные настройки для всех языков
const configureGlobalEditorOptions = (monaco: any) => {
  if (!monaco?.editor) return;

  // Базовые настройки редактора, общие для всех языков
  monaco.editor.defineTheme('x-editor-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '#6A9955' },
      { token: 'string', foreground: '#CE9178' },
      { token: 'number', foreground: '#B5CEA8' },
      { token: 'keyword', foreground: '#569CD6' },
      { token: 'type', foreground: '#4EC9B0' },
      { token: 'function', foreground: '#DCDCAA' },
      { token: 'identifier', foreground: '#9CDCFE' },
      { token: 'variable', foreground: '#9CDCFE' },
      { token: 'parameter', foreground: '#9CDCFE' },
      { token: 'property', foreground: '#9CDCFE' },
      { token: 'operator', foreground: '#D4D4D4' },
      { token: 'tag', foreground: '#569CD6' },
      { token: 'regexp', foreground: '#D16969' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorCursor.foreground': '#AEAFAD',
      'editor.lineHighlightBackground': '#2A2D2E',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41'
    }
  });

  // Устанавливаем глобальные настройки для всех языков
  monaco.editor.setTheme('x-editor-dark');
};

// Конфигурация TypeScript/JavaScript
const configureTypeScript = (monaco: any) => {
  if (!monaco?.languages?.typescript) return;

  // Настройки компилятора для TypeScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    strict: true,
    alwaysStrict: true,
    skipLibCheck: true,
    isolatedModules: true,
    lib: ['DOM', 'DOM.Iterable', 'ESNext']
  });

  // Настройки компилятора для JavaScript
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowJs: true,
    checkJs: false
  });

  // Настройки диагностики для TypeScript
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  // Настройки диагностики для JavaScript
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  // Добавляем базовые типы для React
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
    declare namespace React {
      function createElement(type: any, props?: any, ...children: any[]): any;
      function useState<T>(initialState: T | (() => T)): [T, (newState: T) => void];
      function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      function useRef<T>(initialValue: T): { current: T };
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      function useMemo<T>(factory: () => T, deps: any[]): T;
      
      class Component<P = {}, S = {}> {
        constructor(props: P);
        props: P;
        state: S;
        setState(state: S | ((prevState: S, props: P) => S), callback?: () => void): void;
        forceUpdate(callback?: () => void): void;
        render(): any;
      }
    }
    
    declare namespace JSX {
      interface Element {}
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }

    declare module "react" {
      export = React;
    }
  `, 'react.d.ts');

  // Включаем автоматическую синхронизацию моделей
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
};

// Настройка языковых токенизаторов
const configureLanguageTokenizers = (monaco: any) => {
  if (!monaco?.languages) return;

  const supportedLanguages = [
    'typescript', 'typescriptreact', 'javascript', 'javascriptreact', 
    'python', 'java', 'csharp', 'cpp', 'php', 'ruby', 'go', 'rust', 
    'swift', 'kotlin', 'html', 'css', 'json', 'yaml', 'markdown'
  ];
  
  // Настраиваем каждый язык
  supportedLanguages.forEach(language => {
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === language)) {
      return; // Пропускаем несуществующие языки
    }
    
    // Установка базовой конфигурации для каждого языка
    monaco.languages.onLanguage(language, () => {
      const config: any = {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: '\'', close: '\'' },
          { open: '`', close: '`' }
        ]
      };
      
      // Специальные настройки для JSX языков
      if (language === 'typescriptreact' || language === 'javascriptreact') {
        config.brackets.push(['<', '>']);
        config.autoClosingPairs.push({ open: '<', close: '>' });
      }
      
      // Специальные настройки для Python
      if (language === 'python') {
        config.comments = {
          lineComment: '#'
        };
      }
      
      monaco.languages.setLanguageConfiguration(language, config);
    });
  });
};

/**
 * Определяет корректный язык редактора на основе расширения файла
 * @param monaco Экземпляр monaco-editor
 * @param model Текущая модель редактора
 * @param filePath Путь к файлу
 */
export function correctLanguageFromExtension(monaco, model, filePath) {
  // Проверка на null/undefined параметры
  if (!monaco || !model || !filePath) {
    console.warn('Недостаточно данных для определения языка', { 
      monaco: !!monaco, 
      model: !!model, 
      filePath 
    });
    return;
  }

  try {
    // Получение расширения файла
    const fileName = filePath.split(/[\/\\]/).pop() || '';
    const extension = fileName.includes('.') 
      ? fileName.substring(fileName.lastIndexOf('.')) 
      : '';
    
    console.log(`Определение языка для файла: ${fileName} (расширение: ${extension})`);
    
    // Если модель уже имеет правильный язык, не меняем его
    const currentLanguage = model.getLanguageId();
    console.log(`Текущий язык: ${currentLanguage}`);
    
    if (!extension) {
      // Для файлов без расширения, проверяем специальные имена
      if (fileName === 'Dockerfile') {
        monaco.editor.setModelLanguage(model, 'dockerfile');
        console.log('Изменяем язык на dockerfile');
      } else if (fileName.toLowerCase() === 'makefile') {
        monaco.editor.setModelLanguage(model, 'makefile');
        console.log('Изменяем язык на makefile');
      } else if (fileName.match(/^(readme|contributing|license)$/i)) {
        monaco.editor.setModelLanguage(model, 'markdown');
        console.log('Изменяем язык на markdown');
      }
      return;
    }
    
    // Определение языка на основе расширения
    let newLanguage = '';
    switch (extension.toLowerCase()) {
      // TypeScript
      case '.ts':
        newLanguage = 'typescript';
        break;
      case '.tsx':
        newLanguage = 'typescriptreact';
        break;
        
      // JavaScript
      case '.js':
        newLanguage = 'javascript';
        break;
      case '.jsx':
        newLanguage = 'javascriptreact';
        break;
      case '.mjs':
      case '.cjs':
        newLanguage = 'javascript';
        break;
        
      // Web технологии
      case '.html':
      case '.htm':
        newLanguage = 'html';
        break;
      case '.css':
        newLanguage = 'css';
        break;
      case '.scss':
        newLanguage = 'scss';
        break;
      case '.less':
        newLanguage = 'less';
        break;
      case '.json':
        newLanguage = 'json';
        break;
      case '.jsonc':
      case '.json5':
        newLanguage = 'jsonc';
        break;
      case '.xml':
        newLanguage = 'xml';
        break;
      case '.svg':
        newLanguage = 'xml';
        break;
        
      // Back-end языки
      case '.py':
        newLanguage = 'python';
        break;
      case '.rb':
        newLanguage = 'ruby';
        break;
      case '.php':
        newLanguage = 'php';
        break;
      case '.java':
        newLanguage = 'java';
        break;
      case '.cs':
        newLanguage = 'csharp';
        break;
      case '.go':
        newLanguage = 'go';
        break;
      case '.rs':
        newLanguage = 'rust';
        break;
      case '.swift':
        newLanguage = 'swift';
        break;
      case '.kt':
      case '.kts':
        newLanguage = 'kotlin';
        break;
        
      // Скриптовые языки
      case '.sh':
      case '.bash':
        newLanguage = 'shell';
        break;
      case '.ps1':
        newLanguage = 'powershell';
        break;
      case '.bat':
      case '.cmd':
        newLanguage = 'bat';
        break;
      
      // Конфигурационные форматы
      case '.yaml':
      case '.yml':
        newLanguage = 'yaml';
        break;
      case '.toml':
        newLanguage = 'toml';
        break;
      case '.ini':
        newLanguage = 'ini';
        break;
      case '.properties':
        newLanguage = 'properties';
        break;
      case '.env':
        newLanguage = 'dotenv';
        break;
      
      // Документация
      case '.md':
      case '.markdown':
        newLanguage = 'markdown';
        break;
      case '.rst':
        newLanguage = 'restructuredtext';
        break;
      case '.tex':
        newLanguage = 'latex';
        break;
        
      // Другие языки программирования
      case '.c':
        newLanguage = 'c';
        break;
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.h':
      case '.hpp':
      case '.hxx':
        newLanguage = 'cpp';
        break;
      case '.sql':
        newLanguage = 'sql';
        break;
      case '.pl':
        newLanguage = 'perl';
        break;
      case '.lua':
        newLanguage = 'lua';
        break;
      case '.r':
        newLanguage = 'r';
        break;
      case '.dart':
        newLanguage = 'dart';
        break;
      case '.clj':
        newLanguage = 'clojure';
        break;
      case '.scala':
        newLanguage = 'scala';
        break;
        
      // По умолчанию - plaintext
      default:
        newLanguage = 'plaintext';
    }
    
    // Изменяем язык модели, если он отличается от текущего
    if (newLanguage && newLanguage !== currentLanguage) {
      monaco.editor.setModelLanguage(model, newLanguage);
      console.log(`Изменяем язык модели с ${currentLanguage} на ${newLanguage}`);
    } else {
      console.log(`Оставляем текущий язык: ${currentLanguage}`);
    }
  } catch (error) {
    console.error('Ошибка при определении языка файла:', error);
  }
}

// Регистрирует файл в Monaco для использования в подсказках и навигации
export const registerFileInMonaco = (monaco: any, filePath: string, content: string): void => {
  if (!monaco || !filePath || !content) return;
  
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  if (!ext) return;
  
  // Регистрируем TypeScript/JavaScript файлы для автодополнения
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext) && monaco.languages.typescript) {
    const uri = monaco.Uri.parse(`file:///${filePath.replace(/\\/g, '/')}`);
    
    const isTS = ext === 'ts' || ext === 'tsx';
    if (isTS) {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        content,
        uri.toString()
      );
    } else {
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        content,
        uri.toString()
      );
    }
  }
};

/**
 * Инициализирует продвинутую конфигурацию редактора Monaco
 * @param monaco Экземпляр monaco-editor
 */
export function initializeMonacoEditor(monaco) {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return;
  }

  try {
    // Настраиваем глобальные опции редактора
    configureGlobalEditorOptions(monaco);
    
    // Настраиваем TypeScript/JavaScript
    configureTypeScript(monaco);
    
    // Настраиваем токенизаторы для всех языков
    configureLanguageTokenizers(monaco);
    
    console.log('Monaco editor advanced configuration initialized');
  } catch (error) {
    console.error('Error initializing Monaco advanced configuration:', error);
  }
}

/**
 * Регистрирует цветовые схемы для различных языков
 * @param monaco Экземпляр monaco-editor
 */
function registerLanguageThemes(monaco) {
  try {
    // Проверяем наличие необходимых методов
    if (!monaco || !monaco.languages || !monaco.languages.registerTokensProviderFactory) {
      return;
    }

    // Расширенная подсветка синтаксиса JSX/TSX
    if (monaco.languages.typescript) {
      enhanceTsxSyntaxHighlighting(monaco);
    }

  } catch (error) {
    console.error('Error registering language themes:', error);
  }
}

/**
 * Улучшает подсветку синтаксиса для JSX/TSX
 * @param monaco Экземпляр monaco-editor
 */
function enhanceTsxSyntaxHighlighting(monaco) {
  try {
    // Добавляем дополнительные токены для JSX синтаксиса
    const jsxTokens = [
      [/(<)(\w+)/, ['delimiter', { token: 'tag', next: '@tagName' }]],
      [/(<)(\/)(\w+)/, ['delimiter', 'delimiter', { token: 'tag', next: '@tagClosing' }]],
      [/(>)/, { token: 'delimiter', next: '@default' }],
      [/\{/, { token: 'delimiter.bracket', next: '@jsxExpression' }]
    ];

    // Добавление правил для подсветки JSX атрибутов
    const jsxAttributes = [
      [/(\w+)(=)/, ['attribute.name', 'delimiter']],
      [/"([^"]*)"/, 'attribute.value'],
      [/'([^']*)'/, 'attribute.value'],
      [/\{/, { token: 'delimiter.bracket', next: '@jsxAttributeExpression' }]
    ];

    // Пытаемся расширить существующие правила для TypeScript и TSX
    try {
      if (monaco.languages.setMonarchTokensProvider) {
        // Правила подсветки синтаксиса TypeScript React (TSX)
        const tsxLanguageRules = {
          tokenizer: {
            root: [
              // JSX элементы
              [/<(\w+)/, { token: 'tag', next: '@tag.$1' }],
              [/<\/(\w+)/, { token: ['delimiter', 'tag'], next: '@tag.$1' }],
              // Стандартный TypeScript синтаксис
              [/[a-z_$][\w$]*/, { cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }}],
              [/[A-Z][\w$]*/, 'type.identifier'],
              // Числа
              [/\d+/, 'number'],
              // Строки
              [/"([^"\\]|\\.)*$/, 'string.invalid'],
              [/'([^'\\]|\\.)*$/, 'string.invalid'],
              [/"/, 'string', '@string."'],
              [/'/, 'string', '@string.\''],
              // Комментарии
              [/\/\/.*$/, 'comment'],
              [/\/\*/, 'comment', '@comment'],
              // Delimiters и операторы
              [/[{}()\[\]]/, '@brackets'],
              [/[<>](?!@symbols)/, '@brackets'],
              [/[;,.]/, 'delimiter'],
              [/@symbols/, { cases: {
                '@operators': 'operator',
                '@default': ''
              }}]
            ],
            // JSX тэги
            tag: [
              [/[ \t\r\n]+/, ''],
              [/(\w+)/, 'attribute.name'],
              [/=/, 'delimiter'],
              [/"([^"]*)"/, 'attribute.value'],
              [/'([^']*)'/, 'attribute.value'],
              [/\{/, { token: '@brackets', next: '@jsxExpression' }],
              [/\/?>/, { token: 'delimiter', next: '@pop' }]
            ],
            // JSX выражения внутри фигурных скобок
            jsxExpression: [
              [/\}/, { token: '@brackets', next: '@pop' }],
              { include: 'root' }
            ],
            // Строки
            'string': [
              [/[^\\"']+/, 'string'],
              [/@escapes/, 'string.escape'],
              [/\\./, 'string.escape.invalid'],
              [/["']/, { cases: {
                '$#==$S2': { token: 'string', next: '@pop' },
                '@default': 'string'
              }}]
            ],
            // Блочные комментарии
            comment: [
              [/[^/*]+/, 'comment'],
              [/\*\//, 'comment', '@pop'],
              [/[/*]/, 'comment']
            ]
          },
          // Ключевые слова TypeScript
          keywords: [
            'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break',
            'case', 'catch', 'class', 'const', 'constructor', 'continue',
            'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum',
            'export', 'extends', 'false', 'finally', 'for', 'from', 'function',
            'get', 'if', 'implements', 'import', 'in', 'instanceof', 'interface',
            'is', 'keyof', 'let', 'module', 'namespace', 'never', 'new', 'null',
            'number', 'object', 'package', 'private', 'protected', 'public',
            'readonly', 'require', 'return', 'set', 'static', 'string', 'super',
            'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof',
            'undefined', 'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield'
          ],
          operators: [
            '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**', '*', '/',
            '%', '++', '--', '<<', '>>>', '>>', '&', '|', '^', '!', '~', '&&', '||',
            '??', '?', ':', '=', '+=', '-=', '*=', '**=', '/=', '%=', '<<=', '>>=',
            '>>>=', '&=', '|=', '^=', '@'
          ],
          symbols: /[=><!~?:&|+\-*\/\^%]+/,
          escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/
        };

        monaco.languages.setMonarchTokensProvider('typescriptreact', tsxLanguageRules);
      }
    } catch (tokenError) {
      console.error('Error setting TSX language rules:', tokenError);
    }
  } catch (error) {
    console.error('Error enhancing TSX syntax highlighting:', error);
  }
} 