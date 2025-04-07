/**
 * Универсальная конфигурация Monaco Editor с поддержкой всех языков и улучшенной подсветкой.
 */

// Вспомогательные функции для обработки путей без использования модуля path
const pathUtils = {
  extname: (filePath: string) => {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
  },
  basename: (filePath: string) => {
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath;
  },
  dirname: (filePath: string) => {
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlashIndex !== -1 ? filePath.slice(0, lastSlashIndex) : '';
  },
  join: (...parts: string[]) => {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  }
};

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

  // Специальная тема для TSX файлов
  monaco.editor.defineTheme('x-editor-dark-tsx', {
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
      { token: 'regexp', foreground: '#D16969' },
      // Специальные правила для TSX
      { token: 'tag.tsx', foreground: '#569CD6' },
      { token: 'tag.tsx.component', foreground: '#4EC9B0' },
      { token: 'tag.tsx.html', foreground: '#569CD6' },
      { token: 'attribute.name.tsx', foreground: '#9CDCFE' },
      { token: 'attribute.value.tsx', foreground: '#CE9178' },
      { token: 'delimiter.bracket.tsx', foreground: '#D4D4D4' },
      { token: 'keyword.tsx', foreground: '#569CD6' },
      { token: 'identifier.tsx', foreground: '#9CDCFE' },
      { token: 'string.tsx', foreground: '#CE9178' },
      { token: 'number.tsx', foreground: '#B5CEA8' },
      { token: 'comment.tsx', foreground: '#6A9955' },
      { token: 'operator.tsx', foreground: '#D4D4D4' },
      { token: 'delimiter.tsx', foreground: '#D4D4D4' }
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
  if (!monaco.languages) {
    console.warn('Monaco languages API не доступен');
    return;
  }

  try {
    // Регистрируем язык typescriptreact если он еще не зарегистрирован
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'typescriptreact')) {
      monaco.languages.register({ id: 'typescriptreact' });
      console.log('Язык typescriptreact зарегистрирован');
    }

    // Создаем базовый токенизатор для TSX (минимальная версия для избежания ошибок)
    monaco.languages.setMonarchTokensProvider('typescriptreact', {
      defaultToken: 'invalid',
      tokenPostfix: '.tsx',

      keywords: [
        'abstract', 'as', 'asserts', 'any', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'constructor',
        'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
        'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'is', 'keyof', 'let',
        'module', 'namespace', 'never', 'new', 'null', 'number', 'object', 'out', 'package', 'private', 'protected', 'public',
        'readonly', 'require', 'global', 'return', 'set', 'static', 'string', 'super', 'switch', 'symbol', 'this', 'throw',
        'true', 'try', 'type', 'typeof', 'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield'
      ],

      operators: [
        '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**', '*', '/', '%', '++', '--', '<<', '>>>', '>>', '&', '|', '^',
        '!', '~', '&&', '||', '??', '?', ':', '=', '+=', '-=', '*=', '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^=',
        '@'
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

      tokenizer: {
        root: [
          // JSX
          [/<(\w+)/, { token: 'tag', next: '@tag' }],
          [/<\/(\w+)/, { token: 'tag', next: '@tag' }],
          
          // identifiers and keywords
          [/[a-z_$][\w$]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          [/[A-Z][\w\$]*/, 'type.identifier'],
          
          // whitespace
          { include: '@whitespace' },
          
          // delimiters and operators
          [/[{}()\[\]]/, '@brackets'],
          [/[<>]/, '@brackets'],
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
          
          // numbers
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/\d+/, 'number'],
          
          // delimiter: after number because of .\d floats
          [/[;,.]/, 'delimiter'],
          
          // strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string_double'],
          [/'/, 'string', '@string_single'],
          [/`/, 'string', '@string_backtick'],
        ],
        
        tag: [
          [/[ \t\r\n]+/, ''],
          [/(\w+)/, 'attribute.name'],
          [/=/, 'delimiter'],
          [/"/, { token: 'attribute.value', next: '@tag_string_double' }],
          [/'/, { token: 'attribute.value', next: '@tag_string_single' }],
          [/>/, { token: 'tag', next: '@pop' }],
          [/\/\s*>/, { token: 'tag', next: '@pop' }],
        ],
        
        tag_string_double: [
          [/[^"]+/, 'attribute.value'],
          [/"/, { token: 'attribute.value', next: '@pop' }]
        ],
        
        tag_string_single: [
          [/[^']+/, 'attribute.value'],
          [/'/, { token: 'attribute.value', next: '@pop' }]
        ],
        
        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],
        
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],
        
        string_double: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop']
        ],
        
        string_single: [
          [/[^\\']+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop']
        ],
        
        string_backtick: [
          [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
          [/[^\\`\$]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/`/, 'string', '@pop']
        ],
        
        bracketCounting: [
          [/\{/, 'delimiter.bracket', '@bracketCounting'],
          [/\}/, 'delimiter.bracket', '@pop'],
          { include: 'root' }
        ]
      }
    });

    // Если есть TypeScript API, настраиваем его
    if (monaco.languages.typescript) {
      // Глобальные настройки TypeScript
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"]
      });
      
      // Добавляем базовые определения типов для React
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
        declare namespace React {
          type ReactNode = any;
          interface Component<P = {}, S = {}> {
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S)): void;
            render(): ReactNode;
          }
          function createElement(type: any, props?: any, ...children: any[]): any;
          function useState<T>(initialState: T): [T, (newState: T) => void];
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useRef<T>(initialValue: T): { current: T };
          function useMemo<T>(factory: () => T, deps: any[]): T;
        }
        
        declare namespace JSX {
          interface Element {}
          interface IntrinsicElements {
            [elemName: string]: any;
          }
        }
        `,
        'typescript:jsx-defs.d.ts'
      );
      
      // Настройка диагностики
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false
      });
    } else {
      console.warn('TypeScript API не доступен в Monaco, пропускаем настройку TypeScript');
    }

    // Простой провайдер автодополнения для TSX
    monaco.languages.registerCompletionItemProvider('typescriptreact', {
      triggerCharacters: ['<', '.', ':', '"', "'", '/', '@', '{'],
      provideCompletionItems: function(model: any, position: any) {
        const suggestions: Array<{
          label: string;
          kind: any;
          documentation: string;
          insertText: string;
          range: any;
        }> = [];
        const wordToReplace = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordToReplace.startColumn,
          endColumn: wordToReplace.endColumn
        };
        
        // Простые HTML теги
        const tags = ['div', 'span', 'button', 'input', 'form', 'a', 'p', 'h1', 'h2', 'h3'];
        tags.forEach(tag => {
          suggestions.push({
            label: tag,
            kind: monaco.languages.CompletionItemKind.Keyword,
            documentation: `HTML элемент ${tag}`,
            insertText: tag,
            range: range
          });
        });
        
        // Атрибуты JSX
        const attrs = ['className', 'id', 'style', 'onClick', 'onChange'];
        attrs.forEach(attr => {
          suggestions.push({
            label: attr,
            kind: monaco.languages.CompletionItemKind.Property,
            documentation: `JSX атрибут ${attr}`,
            insertText: attr + '=""',
            range: range
          });
        });
        
        return { suggestions };
      }
    });
    
    console.log('TypeScript configuration completed successfully');
  } catch (error) {
    console.error('Error configuring TypeScript:', error);
  }
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
 * Получает расширение файла из пути
 * @param filePath Путь к файлу
 * @returns Расширение файла
 */
export function getExtension(filePath: string): string {
  if (!filePath) return '';
  const lastDotIndex = filePath.lastIndexOf('.');
  return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
}

/**
 * Получает имя файла из пути
 * @param filePath Путь к файлу
 * @returns Имя файла
 */
export function getBasename(filePath: string): string {
  if (!filePath) return '';
  const lastSlashIndex = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  );
  return lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath;
}

/**
 * Получает директорию из пути к файлу
 * @param filePath Путь к файлу
 * @returns Путь к директории
 */
export function getDirectory(filePath: string): string {
  if (!filePath) return '';
  const lastSlashIndex = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  );
  return lastSlashIndex !== -1 ? filePath.slice(0, lastSlashIndex) : '';
}

/**
 * Объединяет пути
 * @param paths Массив путей для объединения
 * @returns Объединенный путь
 */
export function joinPaths(...paths: string[]): string {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}

/**
 * Корректирует язык для файла на основе его расширения
 */
export function correctLanguageFromExtension(filePath: string, editor: any): void {
  try {
    if (!filePath || !editor) return;
    
    // Получаем расширение файла без преобразования в нижний регистр
    const getExtension = (filename: string): string => {
      const lastDotIndex = filename.lastIndexOf('.');
      return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
    };
    
    const ext = getExtension(filePath).toLowerCase();
    const model = editor.getModel();
    
    if (!model) {
      console.warn(`Модель не найдена для ${filePath}`);
      return;
    }
    
    // Логируем текущий язык и путь
    console.log(`Обработка файла ${filePath} с расширением ${ext}, текущий язык: ${model.getLanguageId()}`);
    
    let newLanguage = model.getLanguageId();
    
    // Определяем язык на основе расширения
    if (ext === '.ts') {
      newLanguage = 'typescript';
    } else if (ext === '.tsx') {
      newLanguage = 'typescriptreact';
    } else if (ext === '.js') {
      newLanguage = 'javascript';
    } else if (ext === '.jsx') {
      newLanguage = 'javascriptreact';
    } else if (ext === '.json') {
      newLanguage = 'json';
    } else if (ext === '.css') {
      newLanguage = 'css';
    } else if (ext === '.scss') {
      newLanguage = 'scss';
    } else if (ext === '.html') {
      newLanguage = 'html';
    } else if (ext === '.md' || ext === '.markdown') {
      newLanguage = 'markdown';
    } else if (ext === '.xml') {
      newLanguage = 'xml';
    } else if (ext === '.sql') {
      newLanguage = 'sql';
    } else if (ext === '.py') {
      newLanguage = 'python';
    }
    
    // Если язык не совпадает с текущим, меняем его
    if (newLanguage !== model.getLanguageId()) {
      console.log(`Меняем язык с ${model.getLanguageId()} на ${newLanguage} для файла ${filePath}`);
      monaco.editor.setModelLanguage(model, newLanguage);
    }
    
    // Для TypeScript/React файлов настраиваем дополнительные параметры
    if (ext === '.ts' || ext === '.tsx') {
      try {
        const compilerOptions = {
          target: monaco.languages.typescript.ScriptTarget.Latest,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          jsx: monaco.languages.typescript.JsxEmit.React,
          allowNonTsExtensions: true,
          allowJs: true,
          checkJs: false,
          isolatedModules: true,
          strict: true,
          noImplicitAny: false,
          strictNullChecks: true,
          strictFunctionTypes: true,
          strictPropertyInitialization: true,
          strictBindCallApply: true,
          noImplicitThis: true,
          noImplicitReturns: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        };
        
        // Применяем опции к TypeScript
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: false,
          diagnosticCodesToIgnore: [
            // Игнорируем некоторые ошибки, связанные с отсутствующими модулями
            2307, // Cannot find module
            2792  // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
          ]
        });
        
        console.log(`Настроены параметры TypeScript компилятора для ${filePath}`);
      } catch (e) {
        console.error('Ошибка при настройке TypeScript:', e);
      }
    }
    
    // Для JavaScript/React файлов
    if (ext === '.js' || ext === '.jsx') {
      try {
        // Для JavaScript файлов отключаем проверки TypeScript
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: [
            // Игнорируем ошибки TypeScript в JavaScript файлах
            8006, // 'interface' declarations can only be used in TypeScript files
            8008, // Type aliases can only be used in TypeScript files
            8009, // The 'readonly' modifier can only be used in TypeScript files
            8010, // Type annotations can only be used in TypeScript files
            8013  // Non-null assertions can only be used in TypeScript files
          ]
        });
        
        console.log(`Настроены параметры JavaScript для ${filePath}`);
      } catch (e) {
        console.error('Ошибка при настройке JavaScript:', e);
      }
    }
    
    console.log(`Язык для ${filePath} установлен: ${model.getLanguageId()}`);
  } catch (e) {
    console.error('Ошибка в correctLanguageFromExtension:', e);
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
export function initializeMonacoEditor(monaco: any) {
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
function registerLanguageThemes(monaco: any) {
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
function enhanceTsxSyntaxHighlighting(monaco: any) {
  try {
    // Проверка наличия необходимых API
    if (!monaco?.languages || !monaco.languages.setMonarchTokensProvider) {
      console.warn('Monaco API для настройки токенизаторов недоступен');
      return;
    }

    // Обновляем токенизатор для typescriptreact (TSX)
    try {
      // Правила токенизации для TSX файлов с улучшенной поддержкой JSX
      const tsxLanguageRules = {
        tokenizer: {
          root: [
            // JSX opening tags with component name (исправлен паттерн)
            [/<([A-Z][\w\.$]*)/, ['delimiter.bracket.tsx', 'tag.tsx.component']],
            
            // JSX opening tags with standard HTML element (исправлен паттерн)
            [/<([\w-]+)/, ['delimiter.bracket.tsx', 'tag.tsx.html']],
            
            // JSX closing tags (исправлен паттерн)
            [/<\/(\w[\w\.$-]*)>/, ['delimiter.bracket.tsx', 'tag.tsx', 'delimiter.bracket.tsx']],
            
            // JSX self-closing tag
            [/\/>/, 'delimiter.bracket.tsx'],
            
            // Generic JSX tag ending
            [/>/, 'delimiter.bracket.tsx'],
            
            // JSX attribute handling
            [/\s+([a-zA-Z][\w$]*)(?=\s*=)/, 'attribute.name.tsx'],
            [/=/, 'operator.tsx'],
            [/"([^"]*)"/, 'attribute.value.tsx'],
            [/'([^']*)'/, 'attribute.value.tsx'],
            
            // JSX expression in attributes or children: {expression}
            [/{/, {
              token: 'delimiter.bracket.tsx',
              next: 'jsxExpression'
            }],
            
            // Process other tokens using the typescript language definition
            { include: '@typescript' }
          ],
          
          jsxExpression: [
            [/}/, {
              token: 'delimiter.bracket.tsx',
              next: '@pop'
            }],
            { include: '@typescript' }
          ],
          
          // Include TypeScript highlighting rules
          typescript: [
            // Keywords
            [/\b(await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|throw|true|try|typeof|var|void|while|with|yield)\b/, 'keyword.tsx'],
            
            // TypeScript specific keywords
            [/\b(abstract|as|any|async|boolean|constructor|declare|is|module|namespace|never|readonly|require|number|object|string|symbol|type|undefined|unique)\b/, 'keyword.tsx'],
            
            // Identifiers - variables, parameters
            [/[a-z_$][\w$]*/, 'identifier.tsx'],
            
            // Classes, interfaces, types (capitalized)
            [/[A-Z][\w\$]*/, 'type.tsx'],
            
            // String literals
            [/"([^"\\]|\\.)*$/, 'string.invalid.tsx'],
            [/'([^'\\]|\\.)*$/, 'string.invalid.tsx'],
            [/"/, 'string.tsx', '@stringDouble'],
            [/'/, 'string.tsx', '@stringSingle'],
            [/`/, 'string.tsx', '@stringBacktick'],
            
            // Comments
            [/\/\/.*$/, 'comment.tsx'],
            [/\/\*/, 'comment.tsx', '@comment'],
            
            // Numbers
            [/\d+\.\d+([eE][\-+]?\d+)?/, 'number.float.tsx'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex.tsx'],
            [/\d+/, 'number.tsx'],
            
            // Delimiter and operators
            [/[{}()\[\]]/, 'delimiter.bracket.tsx'],
            [/[<>]/, 'delimiter.bracket.tsx'],
            [/[;,.]/, 'delimiter.tsx'],
            [/[=+\-*/%&|^~!]/, 'operator.tsx']
          ],
          
          stringDouble: [
            [/[^\\"]+/, 'string.tsx'],
            [/\\./, 'string.escape.tsx'],
            [/"/, 'string.tsx', '@pop']
          ],
          
          stringSingle: [
            [/[^\\']+/, 'string.tsx'],
            [/\\./, 'string.escape.tsx'],
            [/'/, 'string.tsx', '@pop']
          ],
          
          stringBacktick: [
            [/\$\{/, { token: 'delimiter.bracket.tsx', next: 'stringTemplateExpression' }],
            [/[^`\\$]+/, 'string.tsx'],
            [/\\./, 'string.escape.tsx'],
            [/`/, 'string.tsx', '@pop']
          ],
          
          stringTemplateExpression: [
            [/}/, { token: 'delimiter.bracket.tsx', next: '@pop' }],
            { include: '@typescript' }
          ],
          
          comment: [
            [/[^/*]+/, 'comment.tsx'],
            [/\/\*/, 'comment.tsx', '@push'],
            [/\*\//, 'comment.tsx', '@pop'],
            [/[/*]/, 'comment.tsx']
          ]
        },
        
        // Define symbols, operators, etc.
        brackets: [
          { open: '{', close: '}', token: 'delimiter.bracket.tsx' },
          { open: '[', close: ']', token: 'delimiter.bracket.tsx' },
          { open: '(', close: ')', token: 'delimiter.bracket.tsx' },
          { open: '<', close: '>', token: 'delimiter.bracket.tsx' }
        ],
        
        keywords: [
          'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 
          'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 
          'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import', 
          'in', 'instanceof', 'interface', 'let', 'new', 'null', 'of', 'package', 
          'private', 'protected', 'public', 'return', 'set', 'static', 'super', 
          'switch', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
          // TypeScript specific
          'abstract', 'as', 'any', 'async', 'boolean', 'constructor', 'declare', 'is', 
          'module', 'namespace', 'never', 'readonly', 'require', 'number', 'object', 
          'string', 'symbol', 'type', 'undefined', 'unique'
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

      // Регистрируем провайдер токенов для TSX
      monaco.languages.setMonarchTokensProvider('typescriptreact', tsxLanguageRules);
      
      // Устанавливаем конфигурацию компилятора для TypeScript с поддержкой JSX
      if (monaco.languages.typescript?.typescriptDefaults) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
          jsxFactory: 'React.createElement',
          jsxFragmentFactory: 'React.Fragment',
          target: monaco.languages.typescript.ScriptTarget.Latest,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          experimentalDecorators: true,
          allowJs: true,
          typeRoots: ["node_modules/@types"]
        });
      }
      
      console.log('Улучшенный токенизатор для TSX успешно настроен');
    } catch (tokenError) {
      console.error('Error setting TSX language rules:', tokenError);
    }
  } catch (error) {
    console.error('Error enhancing TSX syntax highlighting:', error);
  }
} 