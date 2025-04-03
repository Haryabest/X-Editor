import * as monaco from 'monaco-editor';

/**
 * Регистрирует и настраивает TypeScript и TSX поддержку в Monaco Editor
 */
export function registerTypeScriptSupport(): boolean {
  console.log('Регистрация TypeScript и TSX поддержки в Monaco');
  
  try {
    // Проверяем наличие monaco.languages
    if (!monaco.languages) {
      console.error('monaco.languages не доступен');
      return false;
    }
    
    // Проверяем наличие monaco.languages.typescript
    if (!monaco.languages.typescript) {
      console.error('monaco.languages.typescript не доступен');
      return false;
    }
    
    // Регистрируем языки, чтобы убедиться, что они правильно обрабатываются
    const languages = monaco.languages.getLanguages();
    const hasTypeScript = languages.some(lang => lang.id === 'typescript');
    const hasTypeScriptReact = languages.some(lang => lang.id === 'typescriptreact');
    
    if (!hasTypeScript) {
      monaco.languages.register({ 
        id: 'typescript',
        extensions: ['.ts', '.d.ts'],
        aliases: ['TypeScript', 'ts', 'typescript']
      });
      console.log('Зарегистрирован язык typescript');
    }
    
    if (!hasTypeScriptReact) {
      monaco.languages.register({ 
        id: 'typescriptreact',
        extensions: ['.tsx'],
        aliases: ['TypeScript React', 'tsx', 'typescriptreact']
      });
      console.log('Зарегистрирован язык typescriptreact');
    }
    
    // Добавляем обработчик модели, чтобы переопределить язык при загрузке файла
    monaco.editor.onDidCreateModel((model) => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      
      if (fileName.endsWith('.ts') && !fileName.endsWith('.d.ts')) {
        monaco.editor.setModelLanguage(model, 'typescript');
        console.log(`Установлен язык typescript для ${fileName}`);
      } else if (fileName.endsWith('.tsx')) {
        monaco.editor.setModelLanguage(model, 'typescriptreact');
        console.log(`Установлен язык typescriptreact для ${fileName}`);
      } else if (fileName.endsWith('.d.ts')) {
        monaco.editor.setModelLanguage(model, 'typescript');
        console.log(`Установлен язык typescript для declaration file ${fileName}`);
      }
    });
    
    // Настраиваем компилятор TypeScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowNonTsExtensions: true,
      allowJs: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      strict: true,
      isolatedModules: true,
      noEmit: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      typeRoots: ["node_modules/@types"]
    });
    
    // Настраиваем диагностику TypeScript
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016  // Could not find a declaration file for module 'X'
      ]
    });
    
    // Настраиваем компилятор JavaScript
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowJs: true,
      allowNonTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      isolatedModules: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      noEmit: true,
      skipLibCheck: true,
      strict: false,
      target: monaco.languages.typescript.ScriptTarget.ESNext
    });
    
    // Настраиваем диагностику JavaScript для игнорирования TypeScript-специфичных ошибок
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016  // Could not find a declaration file for module 'X'
      ]
    });
    
    // Добавляем базовые определения типов для React
    const reactTypeDefinitions = `
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
    `;
    
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      reactTypeDefinitions,
      'file:///node_modules/@types/react/index.d.ts'
    );
    
    // Настройка TSX
    monaco.languages.onLanguage('typescriptreact', () => {
      console.log('Настройка типа typescriptreact');
      monaco.languages.setLanguageConfiguration('typescriptreact', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')'],
          ['<', '>']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: '\'', close: '\'' },
          { open: '`', close: '`' },
          { open: '<', close: '>' }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: '\'', close: '\'' },
          { open: '`', close: '`' },
          { open: '<', close: '>' }
        ]
      });
      
      // Настройка токенов для TSX
      monaco.languages.setMonarchTokensProvider('typescriptreact', {
        defaultToken: '',
        tokenPostfix: '.tsx',
        
        keywords: [
          'abstract', 'any', 'as', 'asserts', 'assert', 'async', 'await', 'boolean', 'break', 'case', 'catch', 
          'class', 'const', 'constructor', 'continue', 'debugger', 'declare', 'default', 'delete', 
          'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 
          'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'is', 'keyof', 
          'let', 'module', 'namespace', 'never', 'new', 'null', 'number', 'object', 'of', 'package', 
          'private', 'protected', 'public', 'readonly', 'require', 'return', 'set', 'static', 'string', 
          'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'unique', 
          'unknown', 'var', 'void', 'while', 'with', 'yield'
        ],
        
        typeKeywords: [
          'any', 'boolean', 'number', 'object', 'string', 'undefined', 'never', 'void'
        ],
        
        brackets: [
          { open: '{', close: '}', token: 'delimiter.curly' },
          { open: '[', close: ']', token: 'delimiter.square' },
          { open: '(', close: ')', token: 'delimiter.parenthesis' },
          { open: '<', close: '>', token: 'delimiter.angle' }
        ],
        
        tokenizer: {
          root: [
            [/[<][/][@:a-zA-Z_$][\w.$]*/, { token: '@rematch', next: '@jsxCloseTag' }],
            [/[<][@:a-zA-Z_$][\w.$]*/, { token: '@rematch', next: '@jsxOpenTag' }],
            { include: '@whitespace' },
            { include: '@comment' },
            { include: '@strings' },
            { include: '@numbers' },
            [/[,.]/, 'delimiter'],
            [/[()]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/[{}]/, '@brackets'],
            [/[[\]]/, '@brackets'],
            [/@[a-zA-Z_$][\w$]*/, 'tag'],
            [/[a-zA-Z_$][\w$]*/, {
              cases: {
                '@keywords': 'keyword',
                '@typeKeywords': 'keyword.type',
                '@default': 'identifier'
              }
            }]
          ],
          
          // JSX
          jsxOpenTag: [
            [/[@:a-zA-Z_$][\w.$]*/, {
              cases: {
                '@default': 'tag'
              }
            }],
            [/[ \t\r\n]+/, ''],
            [/\/?>/, { token: 'delimiter', next: '@pop' }],
            [/"([^"]*)"/, 'attribute.value'],
            [/'([^']*)'/, 'attribute.value'],
            [/[\w\$]+/, 'attribute.name'],
            [/=/, 'delimiter']
          ],
          
          jsxCloseTag: [
            [/[\/]?/, 'delimiter'],
            [/[@:a-zA-Z_$][\w.$]*/, { token: 'tag', next: '@pop' }]
          ],
          
          whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*(?!\/)/, 'comment.doc', '@jsdoc'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment']
          ],
          
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ],
          
          jsdoc: [
            [/[^\/*]+/, 'comment.doc'],
            [/\*\//, 'comment.doc', '@pop'],
            [/[\/*]/, 'comment.doc']
          ],
          
          strings: [
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'/, 'string', '@stringBody'],
            [/"/, 'string', '@dblStringBody']
          ],
          
          stringBody: [
            [/[^\\']+/, 'string'],
            [/\\./, 'string.escape'],
            [/'/, 'string', '@pop']
          ],
          
          dblStringBody: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"/, 'string', '@pop']
          ],
          
          numbers: [
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number']
          ]
        }
      });
    });

    // Регистрируем язык TypeScript
    monaco.languages.onLanguage('typescript', () => {
      console.log('Настройка типа typescript');
      
      // Добавляем специальную обработку .d.ts файлов
      const models = monaco.editor.getModels();
      models.forEach(model => {
        const uri = model.uri.toString();
        if (uri.endsWith('.d.ts')) {
          monaco.editor.setModelLanguage(model, 'typescript');
        }
      });
    });
    
    // Успешно зарегистрировали поддержку TypeScript
    console.log('TypeScript и TSX поддержка успешно зарегистрирована');
    return true;
  } catch (error) {
    console.error('Ошибка при регистрации TypeScript и TSX поддержки:', error);
    return false;
  }
} 