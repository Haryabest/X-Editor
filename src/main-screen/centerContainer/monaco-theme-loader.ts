/**
 * Загрузчик тем для Monaco Editor с улучшенной поддержкой TypeScript и TSX
 */

// @ts-nocheck

// Определяем собственную тему с поддержкой TypeScript
export const defineMonacoThemes = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco не определен');
    return;
  }

  try {
    // Регистрируем тему для TypeScript с улучшенной подсветкой TSX
    monaco.editor.defineTheme('vs-dark-typescript', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // TypeScript токены с улучшенной видимостью
        { token: 'keyword.ts', foreground: '#569CD6', fontStyle: 'bold' },
        { token: 'keyword.tsx', foreground: '#569CD6', fontStyle: 'bold' },
        { token: 'identifier.ts', foreground: '#9CDCFE' },
        { token: 'identifier.tsx', foreground: '#9CDCFE' },
        { token: 'type.ts', foreground: '#4EC9B0', fontStyle: 'bold' },
        { token: 'type.tsx', foreground: '#4EC9B0', fontStyle: 'bold' },
        { token: 'interface.ts', foreground: '#4EC9B0' },
        { token: 'interface.tsx', foreground: '#4EC9B0' },
        { token: 'class.ts', foreground: '#4EC9B0' },
        { token: 'class.tsx', foreground: '#4EC9B0' },
        { token: 'enum.ts', foreground: '#B8D7A3' },
        { token: 'enum.tsx', foreground: '#B8D7A3' },

        // JSX токены с улучшенной видимостью
        { token: 'delimiter.bracket.tsx', foreground: '#D4D4D4' },
        { token: 'delimiter.bracket.ts', foreground: '#D4D4D4' },
        { token: 'tag.tsx', foreground: '#569CD6' },
        { token: 'tag.ts', foreground: '#569CD6' },
        { token: 'attribute.name.tsx', foreground: '#9CDCFE' },
        { token: 'attribute.name.ts', foreground: '#9CDCFE' },
        { token: 'attribute.value.tsx', foreground: '#CE9178' },
        { token: 'attribute.value.ts', foreground: '#CE9178' },
        
        // JSX-специфичные токены
        { token: 'jsx.tag.name', foreground: '#569CD6' },
        { token: 'jsx.attribute.name', foreground: '#9CDCFE' },
        { token: 'jsx.attribute.value', foreground: '#CE9178' },
        { token: 'jsx.text', foreground: '#D4D4D4' },
        { token: 'jsx.jsx.text', foreground: '#D4D4D4' },
        { token: 'jsx.delimiter', foreground: '#D4D4D4' },
        { token: 'jsx.component', foreground: '#4EC9B0' },

        // Общие токены для всех режимов
        { token: 'comment', foreground: '#6A9955' },
        { token: 'string', foreground: '#CE9178' },
        { token: 'string.tsx', foreground: '#CE9178' },
        { token: 'number', foreground: '#B5CEA8' },
        { token: 'keyword', foreground: '#569CD6', fontStyle: 'bold' },
        { token: 'operator', foreground: '#D4D4D4' },
        { token: 'variable', foreground: '#9CDCFE' },
        { token: 'variable.predefined', foreground: '#4FC1FF' },
        { token: 'function', foreground: '#DCDCAA' },
        { token: 'constant', foreground: '#4FC1FF' },
        { token: 'regexp', foreground: '#D16969' },
        { token: 'type', foreground: '#4EC9B0' },
        { token: 'typeParameter', foreground: '#8CD17D' },
        { token: 'interface', foreground: '#4EC9B0' },
        { token: 'class', foreground: '#4EC9B0' },
        { token: 'enumMember', foreground: '#4FC1FF' },
        { token: 'method', foreground: '#DCDCAA' },
        { token: 'namespace', foreground: '#4EC9B0' },
        { token: 'module', foreground: '#4EC9B0' },
        { token: 'decorator', foreground: '#DCDCAA' },
        
        // React-специфичные токены
        { token: 'tag', foreground: '#569CD6' },
        { token: 'attribute.name', foreground: '#9CDCFE' },
        { token: 'attribute.value', foreground: '#CE9178' },
        { token: 'delimiter.bracket', foreground: '#D4D4D4' },
        { token: 'delimiter.parenthesis', foreground: '#D4D4D4' },
        
        // Дополнительные токены для повышения видимости кода
        { token: 'identifier', foreground: '#9CDCFE' },
        { token: 'parameter', foreground: '#9CDCFE' },
        { token: 'property', foreground: '#9CDCFE' },
        { token: 'numeric', foreground: '#B5CEA8' },
        { token: 'default', foreground: '#D4D4D4' },
        { token: 'delimiter', foreground: '#D4D4D4' },
        { token: 'text', foreground: '#D4D4D4' }
      ],
      colors: {
        'editor.foreground': '#D4D4D4',
        'editor.background': '#1E1E1E',
        'editorCursor.foreground': '#AEAFAD',
        'editor.lineHighlightBackground': '#2D2D30',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.selectionHighlightBackground': '#2D2D30',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editor.findMatchBackground': '#515C6A',
        'editor.findMatchHighlightBackground': '#515C6A',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.foreground': '#D4D4D4',
        'editorSuggestWidget.highlightForeground': '#4FC1FF',
        'editorSuggestWidget.selectedBackground': '#062F4A',
        'list.hoverBackground': '#2A2D2E',
        'list.activeSelectionBackground': '#3A3D41',
        'list.inactiveSelectionBackground': '#3A3D41'
      }
    });

    // Тема для светлого режима
    monaco.editor.defineTheme('vs-light-typescript', {
      base: 'vs',
      inherit: true,
      rules: [
        // TypeScript токены
        { token: 'keyword.ts', foreground: '#0000FF', fontStyle: 'bold' },
        { token: 'keyword.tsx', foreground: '#0000FF', fontStyle: 'bold' },
        { token: 'identifier.ts', foreground: '#001080' },
        { token: 'identifier.tsx', foreground: '#001080' },
        { token: 'type.ts', foreground: '#267F99', fontStyle: 'bold' },
        { token: 'type.tsx', foreground: '#267F99', fontStyle: 'bold' },
        { token: 'interface.ts', foreground: '#267F99' },
        { token: 'interface.tsx', foreground: '#267F99' },
        { token: 'class.ts', foreground: '#267F99' },
        { token: 'class.tsx', foreground: '#267F99' },
        { token: 'enum.ts', foreground: '#267F99' },
        { token: 'enum.tsx', foreground: '#267F99' },

        // JSX токены
        { token: 'delimiter.bracket.tsx', foreground: '#000000' },
        { token: 'delimiter.bracket.ts', foreground: '#000000' },
        { token: 'tag.tsx', foreground: '#800000' },
        { token: 'tag.ts', foreground: '#800000' },
        { token: 'attribute.name.tsx', foreground: '#FF0000' },
        { token: 'attribute.name.ts', foreground: '#FF0000' },
        { token: 'attribute.value.tsx', foreground: '#0451A5' },
        { token: 'attribute.value.ts', foreground: '#0451A5' },
        
        // JSX-специфичные токены
        { token: 'jsx.tag.name', foreground: '#800000' },
        { token: 'jsx.attribute.name', foreground: '#FF0000' },
        { token: 'jsx.attribute.value', foreground: '#0451A5' },
        { token: 'jsx.text', foreground: '#000000' },
        { token: 'jsx.jsx.text', foreground: '#000000' },
        { token: 'jsx.delimiter', foreground: '#000000' },
        { token: 'jsx.component', foreground: '#267F99' },

        // Общие токены для всех режимов
        { token: 'comment', foreground: '#008000' },
        { token: 'string', foreground: '#A31515' },
        { token: 'string.tsx', foreground: '#A31515' },
        { token: 'number', foreground: '#098658' },
        { token: 'keyword', foreground: '#0000FF', fontStyle: 'bold' },
        { token: 'delimiter', foreground: '#000000' },
        { token: 'operator', foreground: '#000000' },

        // Токены специально для TypeScript
        { token: 'type', foreground: '#267F99' },
        { token: 'constructor', foreground: '#267F99' },
        { token: 'function', foreground: '#795E26' },
        { token: 'namespace', foreground: '#267F99' },
        { token: 'variable', foreground: '#001080' },
        { token: 'interface', foreground: '#267F99' },
        { token: 'class', foreground: '#267F99' },
        
        // Дополнительные токены для повышения видимости кода
        { token: 'identifier', foreground: '#001080' },
        { token: 'parameter', foreground: '#001080' },
        { token: 'property', foreground: '#001080' },
        { token: 'numeric', foreground: '#098658' },
        { token: 'default', foreground: '#000000' },
        { token: 'text', foreground: '#000000' }
      ],
      colors: {
        'editor.foreground': '#000000',
        'editor.background': '#FFFFFF',
        'editorCursor.foreground': '#000000',
        'editor.lineHighlightBackground': '#F3F3F3',
        'editorLineNumber.foreground': '#237893',
        'editor.selectionBackground': '#ADD6FF',
        'editor.inactiveSelectionBackground': '#E5EBF1'
      }
    });

    console.log('Темы для Monaco успешно определены');
  } catch (error) {
    console.error('Ошибка при определении тем для Monaco:', error);
  }
};

// Функция для настройки токенизатора
export const configureTypeScriptTokenizer = (monaco: any) => {
  if (!monaco) return;
  
  try {
    const languages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
    
    languages.forEach(lang => {
      // Определения токенов
      const tokenProvider = {
        defaultToken: 'invalid',
        tokenPostfix: '.ts',

        keywords: [
          'abstract', 'as', 'break', 'case', 'catch', 'class', 'continue', 
          'const', 'constructor', 'debugger', 'declare', 'default', 'delete', 
          'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 
          'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'infer', 
          'instanceof', 'interface', 'is', 'keyof', 'let', 'module', 'namespace', 
          'never', 'new', 'null', 'number', 'Object', 'package', 'private', 'protected', 
          'public', 'readonly', 'require', 'global', 'return', 'set', 'static', 
          'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 
          'type', 'typeof', 'unique', 'var', 'void', 'while', 'with', 'yield',
          'async', 'await', 'of'
        ],

        // Операторы
        operators: [
          '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**',
          '*', '/', '%', '++', '--', '<<', '</', '>>', '>>>', '&',
          '|', '^', '!', '~', '&&', '||', '?', ':', '=', '+=', '-=',
          '*=', '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=',
          '^=', '@',
        ],

        // Символы
        symbols: /[=><!~?:&|+\-*\/\^%\\]+/,

        // Управляющие последовательности
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

        // Добавляем регулярные выражения для JSX тегов
        jsx: /(?:^|[^.])(<\s*>|\{\s*\}|<\s*\/\s*>|<\s*[_$a-zA-Z][\w$]*(?:\s*\/>|\s+[^>]*>))/,
        identifier: /@?[a-zA-Z_$][\w$]*/,

        // Шаблоны для чисел
        digits: /\d+(_+\d+)*/,
        octaldigits: /[0-7]+(_+[0-7]+)*/,
        binarydigits: /[0-1]+(_+[0-1]+)*/,
        hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,

        // Правила токенизации
        tokenizer: {
          root: [
            // JSX разметка
            [/<(\w+)/, { token: lang.includes('react') ? 'jsx.tag.open' : 'tag.open', next: '@tag', bracket: '@open' }],
            [/<\/(\w+)/, { token: lang.includes('react') ? 'jsx.tag.close' : 'tag.close', next: '@tagClose', bracket: '@close' }],
            [/</, 'delimiter.bracket'],
            [/>/, 'delimiter.bracket'],
            
            { include: 'common' }
          ],
          
          common: [
            // Ключевые слова
            [/[a-z_$][\w$]*/, { 
              cases: { 
                '@keywords': { token: 'keyword.$0' },
                '@default': 'identifier' 
              } 
            }],
            
            // Имена классов и типов (начинаются с большой буквы)
            [/[A-Z][\w$]*/, { 
              cases: { 
                '@keywords': { token: 'keyword.$0' },
                '@default': 'type.identifier' 
              } 
            }],
            
            // Строки
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string_double'],
            [/'/, 'string', '@string_single'],
            [/`/, 'string', '@string_backtick'],
            
            // Числа
            [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
            [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
            [/0[xX](@hexdigits)/, 'number.hex'],
            [/0[oO]?(@octaldigits)/, 'number.octal'],
            [/0[bB](@binarydigits)/, 'number.binary'],
            [/(@digits)/, 'number'],
            
            // Комментарии
            [/\/\/.*$/, 'comment'],
            [/\/\*/, 'comment', '@comment'],
            
            // Пробелы
            [/\s+/, 'white'],
            
            // Разделители и операторы
            [/[()[\]]/, 'delimiter.parenthesis'],
            [/[<>]/, 'delimiter.bracket'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': 'delimiter'
              }
            }]
          ],
          
          tag: [
            [/[ \t\r\n]+/, 'white'],
            [/\/?>/, { token: lang.includes('react') ? 'jsx.tag.delimiter' : 'tag.delimiter', next: '@pop', bracket: '@close' }],
            [/[\w.-]+/, { token: lang.includes('react') ? 'jsx.tag.name' : 'tag.name' }],
            [/=/, { token: lang.includes('react') ? 'jsx.tag.equals' : 'tag.equals' }],
            [/"([^"]*)"/, { token: lang.includes('react') ? 'jsx.attribute.value' : 'attribute.value' }],
            [/'([^']*)'/, { token: lang.includes('react') ? 'jsx.attribute.value' : 'attribute.value' }],
            [/{/, { token: lang.includes('react') ? 'jsx.expression.bracket' : 'expression.bracket', next: '@jsxExpression', bracket: '@open' }]
          ],
          
          tagClose: [
            [/[ \t\r\n]+/, 'white'],
            [/\/?>/, { token: lang.includes('react') ? 'jsx.tag.delimiter' : 'tag.delimiter', next: '@pop', bracket: '@close' }],
          ],
          
          jsxExpression: [
            [/}/, { token: lang.includes('react') ? 'jsx.expression.bracket' : 'expression.bracket', next: '@pop', bracket: '@close' }],
            { include: 'common' }
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
            [/[^\\`$]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/`/, 'string', '@pop']
          ],
          
          bracketCounting: [
            [/\{/, 'delimiter.bracket', '@bracketCounting'],
            [/\}/, 'delimiter.bracket', '@pop'],
            { include: 'common' }
          ],
          
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ]
        }
      };
      
      // Регистрируем токенизатор
      monaco.languages.setMonarchTokensProvider(lang, tokenProvider);
      
      // Отдельно регистрируем правила раскраски для TSX/JSX
      if (lang.includes('react')) {
        monaco.editor.defineTheme('vs-dark-' + lang, {
          base: 'vs-dark',
          inherit: true,
          colors: {},
          rules: [
            { token: 'jsx.tag.open', foreground: 'C586C0' },
            { token: 'jsx.tag.close', foreground: 'C586C0' },
            { token: 'jsx.tag.name', foreground: '9CDCFE' },
            { token: 'jsx.tag.delimiter', foreground: '808080' },
            { token: 'jsx.tag.equals', foreground: 'D4D4D4' },
            { token: 'jsx.attribute.name', foreground: '9CDCFE' },
            { token: 'jsx.attribute.value', foreground: 'CE9178' },
            { token: 'jsx.expression.bracket', foreground: 'C586C0' },
            { token: 'delimiter.bracket', foreground: 'D4D4D4' },
            { token: 'identifier', foreground: 'D4D4D4' },
            { token: 'type.identifier', foreground: '4EC9B0' },
            { token: 'keyword', foreground: 'C586C0' },
            { token: 'comment', foreground: '6A9955' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'operator', foreground: 'D4D4D4' }
          ]
        });
      }
      
      console.log(`Усовершенствованный токенизатор для ${lang} успешно зарегистрирован`);
    });
  } catch (error) {
    console.error('Ошибка при настройке токенизатора TypeScript:', error);
  }
};

// Функция для установки всех настроек темы
export const setupMonacoTheme = (monaco: any) => {
  if (!monaco) return;
  
  // Определяем темы
  defineMonacoThemes(monaco);
  
  // Настраиваем токенизатор
  configureTypeScriptTokenizer(monaco);
  
  // Устанавливаем тему по умолчанию
  monaco.editor.setTheme('vs-dark-typescript');
  
  // Добавляем поддержку JSX для TypeScript
  if (monaco.languages.typescript) {
    try {
      // Настраиваем параметры компилятора TypeScript для поддержки JSX
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      });
      
      // Также настраиваем параметры для JavaScript
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      });
      
      // Отключаем некоторые ошибки диагностики, которые обычно мешают при работе с TSX
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [
          2307, // Cannot find module 'x'
          2554, // Expected x arguments, but got y
          2322, // Type 'x' is not assignable to type 'y'
          7016, // Could not find declaration file
          2769, // No overload matches this call
          2339, // Property does not exist on type
          2345, // Argument type not assignable
          2695, // Left side of comma op is unused
          2551, // Property does not exist on type (different from 2339)
          2741, // Property missing in type but required in context
          2365, // Operator cannot be applied to types
          2694, // Named import from module with no default export
          2503, // Cannot find namespace
          2304, // Cannot find name
          2305, // Module not found
          2306, // File not found
          1005, // ';' expected
          1128, // Declaration not allowed
          1109, // Expression expected
          1131, // Property or signature expected
          1003, // Identifier expected
          1005  // ';' expected (duplicated, but common)
        ]
      });
      
      // Регистрируем дополнительные типы для React/JSX
      const reactTypes = `
        declare namespace React {
          function createElement(type: any, props?: any, ...children: any[]): any;
          function Fragment(props: any): any;
          function createContext<T>(defaultValue: T): any;
          function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useContext<T>(context: any): T;
          function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void];
          function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          function useMemo<T>(factory: () => T, deps: any[]): T;
          function useRef<T>(initialValue: T): { current: T };
          function forwardRef<T, P>(render: (props: P, ref: React.Ref<T>) => any): any;
          interface FC<P = {}> {
            (props: P): any;
            displayName?: string;
          }
          interface Component<P = {}, S = {}> {
            render(): any;
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S)): void;
          }
          class Component<P, S> {
            constructor(props: P);
            render(): any;
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S)): void;
          }
          interface ReactElement {}
          type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNodeArray;
          interface ReactNodeArray extends Array<ReactNode> {}
        }
      
        declare namespace JSX {
          interface Element extends React.ReactElement {}
          interface ElementClass extends React.Component<any> {
            render(): any;
          }
          interface ElementAttributesProperty { props: {}; }
          interface ElementChildrenAttribute { children: {}; }
          
          interface IntrinsicElements {
            div: any;
            span: any;
            button: any;
            input: any;
            a: any;
            p: any;
            h1: any;
            h2: any;
            h3: any;
            h4: any;
            h5: any;
            h6: any;
            ul: any;
            li: any;
            ol: any;
            img: any;
            form: any;
            label: any;
            select: any;
            option: any;
            table: any;
            tr: any;
            td: any;
            th: any;
            thead: any;
            tbody: any;
            tfoot: any;
            nav: any;
            header: any;
            footer: any;
            main: any;
            section: any;
            article: any;
            aside: any;
            textarea: any;
            pre: any;
            code: any;
            svg: any;
            path: any;
            [elemName: string]: any;
          }
        }
      `;
      
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
      
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
      
      console.log('Поддержка JSX для TypeScript успешно настроена');
    } catch (error) {
      console.error('Ошибка при настройке JSX поддержки:', error);
    }
  }
}; 