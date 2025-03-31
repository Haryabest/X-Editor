import * as monaco from 'monaco-editor';

export function configureTypeScript(monaco: any) {
  // Настраиваем TypeScript
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

  // Настраиваем поддержку JSX
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  // Добавляем определения для React
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `
    declare namespace JSX {
      interface Element {}
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
    `,
    'file:///node_modules/@types/react/index.d.ts'
  );

  // Настраиваем правила токенизации для TSX
  monaco.languages.setMonarchTokensProvider('typescriptreact', {
    defaultToken: '',
    tokenPostfix: '.tsx',
    ignoreCase: true,
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
      { open: '<', close: '>', token: 'delimiter.angle' }
    ],
    keywords: [
      'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'constructor',
      'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export',
      'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
      'import', 'in', 'instanceof', 'interface', 'let', 'module', 'new', 'null', 'of',
      'package', 'private', 'protected', 'public', 'return', 'set', 'static', 'super',
      'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'var', 'void', 'while',
      'with', 'yield'
    ],
    operators: [
      '=', '>', '<', '!', '~', '?', ':',
      '==', '<=', '>=', '!=', '&&', '||', '++', '--',
      '+', '-', '*', '/', '&', '|', '^', '%', '<<',
      '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
      '^=', '%=', '<<=', '>>=', '>>>='
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    tokenizer: {
      root: [
        // Идентификаторы и ключевые слова
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        // Пробелы
        { include: '@whitespace' },
        // JSX
        [/<[^>]*>/, { cases: { '@eos': { token: 'delimiter.angle' }, '@default': 'delimiter.angle' } }],
        // Числа
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        // Разделители и операторы
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],
        // Строки
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        // Комментарии
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment']
      ],
      whitespace: [
        [/\s+/, 'white']
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/"/, 'string', '@pop'],
        [/\\$/, 'string'],
        [/\\/, 'string.escape']
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/'/, 'string', '@pop'],
        [/\\$/, 'string'],
        [/\\/, 'string.escape']
      ]
    }
  });

  // Настраиваем автодополнение для TSX
  monaco.languages.registerCompletionItemProvider('typescriptreact', {
    provideCompletionItems: (model: any, position: any) => {
      const suggestions = [];
      
      // Добавляем базовые JSX элементы
      const jsxElements = [
        'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'button', 'input', 'form', 'label', 'select', 'option',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'img', 'a', 'nav', 'header', 'footer', 'main', 'section', 'article'
      ];

      jsxElements.forEach(element => {
        suggestions.push({
          label: element,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `<${element}$0></${element}>`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        });
      });

      // Добавляем React компоненты
      suggestions.push({
        label: 'React.Component',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'class ${1:ComponentName} extends React.Component<${2:Props}, ${3:State}> {\n\tconstructor(props: ${2:Props}) {\n\t\tsuper(props);\n\t}\n\n\trender() {\n\t\treturn (\n\t\t\t$0\n\t\t);\n\t}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      });

      return { suggestions };
    }
  });
} 