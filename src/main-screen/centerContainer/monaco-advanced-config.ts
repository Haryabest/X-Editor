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
  if (!monaco.languages.typescript) {
    console.warn('TypeScript support not available in Monaco');
    return;
  }

  // Регистрируем язык typescriptreact если он еще не зарегистрирован
  if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'typescriptreact')) {
    monaco.languages.register({ id: 'typescriptreact' });
  }

  // Настройка компилятора TypeScript
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

  // Добавляем определения типов React
  const reactTypes = `
    declare namespace React {
      type ReactNode = React.ReactChild | React.ReactFragment | React.ReactPortal | boolean | null | undefined;
      type ReactChild = React.ReactElement | string | number;
      type ReactFragment = {} | React.ReactNodeArray;
      type ReactPortal = { children: React.ReactNode; container: Element; key?: string | null };
      
      interface Component<P = {}, S = {}> {
        props: P;
        state: S;
        setState<K extends keyof S>(state: ((prevState: Readonly<S>) => Pick<S, K> | S | null) | Pick<S, K> | S | null, callback?: () => void): void;
        forceUpdate(callback?: () => void): void;
        render(): React.ReactNode;
        componentDidMount?(): void;
        componentWillUnmount?(): void;
        componentDidUpdate?(prevProps: Readonly<P>, prevState: Readonly<S>, snapshot?: any): void;
        shouldComponentUpdate?(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean;
        componentWillMount?(): void;
        componentWillReceiveProps?(nextProps: Readonly<P>, nextContext: any): void;
        componentWillUpdate?(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): void;
        getSnapshotBeforeUpdate?(prevProps: Readonly<P>, prevState: Readonly<S>): any;
      }

      function useState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
      function useEffect(effect: EffectCallback, deps?: DependencyList): void;
      function useContext<T>(context: Context<T>): T;
      function useRef<T>(initialValue: T): MutableRefObject<T>;
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T;
      function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
      function useReducer<R extends Reducer<any, any>, I>(reducer: R, initializerArg: I | (() => I)): [any, Dispatch<ReducerAction<R>>];
      function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
      function useImperativeHandle<T, R extends T>(ref: Ref<T> | null, init: () => R, deps?: DependencyList): void;
      function useDebugValue<T>(value: T, format?: (value: T) => any): void;
      function useId(): string;
      function useSyncExternalStore<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T;
      function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;
      function useDeferredValue<T>(value: T): T;
      function useTransition(): [boolean, (callback: () => void) => void];
    }
  `;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'file:///node_modules/@types/react/index.d.ts');

  // Добавляем определения для JSX
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
    declare namespace JSX {
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
  `, 'file:///node_modules/@types/react/jsx.d.ts');

  // Добавляем определения для модулей
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
    declare module "*.tsx" {
      const content: any;
      export default content;
    }
    declare module "*.ts" {
      const content: any;
      export default content;
    }
    declare module "*.jsx" {
      const content: any;
      export default content;
    }
    declare module "*.js" {
      const content: any;
      export default content;
    }
  `, 'file:///node_modules/@types/module.d.ts');

  // Настраиваем токенизатор для TSX
  monaco.languages.setMonarchTokensProvider('typescriptreact', {
    tokenizer: {
      root: [
        // JSX opening tags with component name
        [/<([A-Z][\w\.$]*)(\.|\/)?>/, [
          { token: 'delimiter.bracket.tsx' },
          { token: 'tag.tsx.component' },
          { token: 'delimiter.bracket.tsx' }
        ]],
        // JSX opening tags with standard HTML element
        [/<([\w-]+)(\.|\/)?>/, [
          { token: 'delimiter.bracket.tsx' },
          { token: 'tag.tsx.html' },
          { token: 'delimiter.bracket.tsx' }
        ]],
        // JSX closing tags
        [/<\/(\w[\w\.$-]*)(\.|\/)?>/, [
          { token: 'delimiter.bracket.tsx' },
          { token: 'tag.tsx' },
          { token: 'delimiter.bracket.tsx' }
        ]],
        // JSX attribute handling
        [/\s+([a-zA-Z][\w$]*)(?=\s*=)/, 'attribute.name.tsx'],
        [/=/, 'operator.tsx'],
        [/"([^"]*)"/, 'attribute.value.tsx'],
        [/'([^']*)'/, 'attribute.value.tsx'],
        // JSX expression in attributes or children: {expression}
        [/{/, {
          token: 'delimiter.bracket.tsx',
          next: 'jsxExpression',
          nextEmbedded: 'typescript'
        }],
        // Process other tokens using the typescript language definition
        { include: '@typescript' }
      ],
      jsxExpression: [
        [/}/, {
          token: 'delimiter.bracket.tsx',
          next: '@pop',
          nextEmbedded: '@pop'
        }]
      ],
      typescript: [
        // Keywords
        [/\b(await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|throw|true|try|typeof|var|void|while|with|yield)\b/, 'keyword.tsx'],
        // TypeScript specific keywords
        [/\b(abstract|as|any|async|boolean|constructor|declare|is|module|namespace|never|readonly|require|number|object|string|symbol|type|undefined|unique)\b/, 'keyword.tsx'],
        // Identifiers
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
        [/\$\{/, { token: 'delimiter.bracket.tsx', next: 'stringTemplateExpression', nextEmbedded: 'typescript' }],
        [/[^`\\$]+/, 'string.tsx'],
        [/\\./, 'string.escape.tsx'],
        [/`/, 'string.tsx', '@pop']
      ],
      stringTemplateExpression: [
        [/}/, { token: 'delimiter.bracket.tsx', next: '@pop', nextEmbedded: '@pop' }]
      ],
      comment: [
        [/[^/*]+/, 'comment.tsx'],
        [/\/\*/, 'comment.tsx', '@push'],
        [/\*\//, 'comment.tsx', '@pop'],
        [/[/*]/, 'comment.tsx']
      ]
    }
  });

  console.log('TypeScript configuration completed successfully');
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
export function correctLanguageFromExtension(monaco: any, model: any, filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  console.log(`Correcting language for file: ${fileName} (${extension})`);

  let languageId = model.getLanguageId();
  let newLanguageId = languageId;

  switch (extension) {
    case '.tsx':
      newLanguageId = 'typescriptreact';
      break;
    case '.ts':
      newLanguageId = 'typescript';
      break;
    case '.jsx':
      newLanguageId = 'javascriptreact';
      break;
    case '.js':
      newLanguageId = 'javascript';
      break;
    case '.html':
      newLanguageId = 'html';
      break;
    case '.css':
      newLanguageId = 'css';
      break;
    case '.json':
      newLanguageId = 'json';
      break;
    default:
      newLanguageId = 'plaintext';
  }

  if (languageId !== newLanguageId) {
    console.log(`Changing language from ${languageId} to ${newLanguageId}`);
    monaco.editor.setModelLanguage(model, newLanguageId);
  }

  // Дополнительная конфигурация для TypeScript/TSX файлов
  if (extension === '.ts' || extension === '.tsx') {
    const tsService = monaco.languages.typescript.getTypeScriptWorker();
    if (tsService) {
      tsService().then((worker: any) => {
        worker(model.uri).then((client: any) => {
          // Настройка путей для импортов
          client.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.Latest,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            esModuleInterop: true,
            jsx: monaco.languages.typescript.JsxEmit.React,
            reactNamespace: "React",
            allowJs: true,
            typeRoots: ["node_modules/@types"],
            baseUrl: ".",
            paths: {
              "@/*": ["src/*"],
              "@components/*": ["src/components/*"],
              "@pages/*": ["src/pages/*"],
              "@utils/*": ["src/utils/*"],
              "@hooks/*": ["src/hooks/*"],
              "@styles/*": ["src/styles/*"],
              "@assets/*": ["src/assets/*"],
              "@types/*": ["src/types/*"]
            }
          });

          // Добавляем модель как дополнительную библиотеку для лучших подсказок
          client.addExtraLib(model.getValue(), model.uri.toString());
        });
      });
    }
  }

  return newLanguageId;
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
            // JSX opening tags with component name
            [/<([A-Z][\w\.$]*)(\.|\/)?>/, [
              { token: 'delimiter.bracket.tsx' }, // for "<"
              { token: 'tag.tsx.component' },     // for component name
              { token: 'delimiter.bracket.tsx' }  // for ">" or "/>"
            ]],
            // JSX opening tags with standard HTML element
            [/<([\w-]+)(\.|\/)?>/, [
              { token: 'delimiter.bracket.tsx' }, // for "<"
              { token: 'tag.tsx.html' },          // for HTML tag name
              { token: 'delimiter.bracket.tsx' }  // for ">" or "/>"
            ]],
            // JSX closing tags
            [/<\/(\w[\w\.$-]*)(\.|\/)?>/, [
              { token: 'delimiter.bracket.tsx' }, // for "</"
              { token: 'tag.tsx' },               // for tag name
              { token: 'delimiter.bracket.tsx' }  // for ">"
            ]],
            
            // JSX attribute handling
            [/\s+([a-zA-Z][\w$]*)(?=\s*=)/, 'attribute.name.tsx'],
            [/=/, 'operator.tsx'],
            [/"([^"]*)"/, 'attribute.value.tsx'],
            [/'([^']*)'/, 'attribute.value.tsx'],
            
            // JSX expression in attributes or children: {expression}
            [/{/, {
              token: 'delimiter.bracket.tsx',
              next: 'jsxExpression',
              nextEmbedded: 'typescript'
            }],
            
            // Process other tokens using the typescript language definition
            { include: '@typescript' }
          ],
          
          jsxExpression: [
            [/}/, {
              token: 'delimiter.bracket.tsx',
              next: '@pop',
              nextEmbedded: '@pop'
            }]
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
            [/\$\{/, { token: 'delimiter.bracket.tsx', next: 'stringTemplateExpression', nextEmbedded: 'typescript' }],
            [/[^`\\$]+/, 'string.tsx'],
            [/\\./, 'string.escape.tsx'],
            [/`/, 'string.tsx', '@pop']
          ],
          
          stringTemplateExpression: [
            [/}/, { token: 'delimiter.bracket.tsx', next: '@pop', nextEmbedded: '@pop' }]
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