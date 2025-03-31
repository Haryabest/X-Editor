import * as monaco from 'monaco-editor';

export function configureTypeScript(monaco: any) {
  console.log('Configuring TypeScript and TSX support', { monaco });
  
  // Проверяем наличие monaco.languages.typescript
  if (!monaco.languages.typescript) {
    console.error('TypeScript support not available in Monaco!');
    return;
  }
  
  // Проверяем регистрацию языка typescriptreact
  const languages = monaco.languages.getLanguages();
  const hasTypeScriptReact = languages.some((lang: any) => lang.id === 'typescriptreact');
  
  console.log('Monaco languages:', languages.map((lang: any) => lang.id));
  console.log('TypeScriptReact language registered:', hasTypeScriptReact);
  
  // Регистрируем язык typescriptreact если он еще не зарегистрирован
  if (!hasTypeScriptReact) {
    console.log('Registering typescriptreact language');
    monaco.languages.register({ id: 'typescriptreact' });
  }

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
      console.log('TSX completion provider called', { position, model: model.uri.toString() });
      
      const suggestions: monaco.languages.CompletionItem[] = [];
      
      // Создаем диапазон для автодополнения
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column
      };
      
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
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: `**${element}**\n\nHTML элемент ${element}`
          },
          range
        });
      });

      // Добавляем React компоненты
      suggestions.push({
        label: 'React.Component',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'class ${1:ComponentName} extends React.Component<${2:Props}, ${3:State}> {\n\tconstructor(props: ${2:Props}) {\n\t\tsuper(props);\n\t}\n\n\trender() {\n\t\treturn (\n\t\t\t$0\n\t\t);\n\t}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: {
          value: '**React.Component**\n\nБазовый класс для создания React компонента'
        },
        range
      });

      // Добавляем React хуки
      const hooks = [
        {
          label: 'useState',
          insertText: 'const [${1:state}, set${1:State}] = useState<${2:Type}>(${3:initialValue});',
          documentation: 'Хук для управления состоянием компонента'
        },
        {
          label: 'useEffect',
          insertText: 'useEffect(() => {\n\t${1:effect}\n\treturn () => {\n\t\t${2:cleanup}\n\t};\n}, [${3:dependencies}]);',
          documentation: 'Хук для выполнения побочных эффектов'
        },
        {
          label: 'useContext',
          insertText: 'const ${1:value} = useContext(${2:MyContext});',
          documentation: 'Хук для доступа к контексту React'
        },
        {
          label: 'useRef',
          insertText: 'const ${1:ref} = useRef<${2:Type}>(${3:initialValue});',
          documentation: 'Хук для создания мутабельной ссылки'
        },
        {
          label: 'useMemo',
          insertText: 'const ${1:memoizedValue} = useMemo(() => ${2:computeValue}, [${3:dependencies}]);',
          documentation: 'Хук для мемоизации вычисляемых значений'
        },
        {
          label: 'useCallback',
          insertText: 'const ${1:memoizedCallback} = useCallback(() => {\n\t${2:callback}\n}, [${3:dependencies}]);',
          documentation: 'Хук для мемоизации функций'
        }
      ];

      hooks.forEach(hook => {
        suggestions.push({
          label: hook.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: hook.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: `**${hook.label}**\n\n${hook.documentation}`
          },
          range
        });
      });

      // Добавляем TypeScript типы
      const types = [
        {
          label: 'interface',
          insertText: 'interface ${1:Name} {\n\t${0}\n}',
          documentation: 'Определение интерфейса TypeScript'
        },
        {
          label: 'type',
          insertText: 'type ${1:Name} = ${0};',
          documentation: 'Определение типа TypeScript'
        },
        {
          label: 'enum',
          insertText: 'enum ${1:Name} {\n\t${0}\n}',
          documentation: 'Определение перечисления TypeScript'
        }
      ];

      types.forEach(type => {
        suggestions.push({
          label: type.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: type.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: `**${type.label}**\n\n${type.documentation}`
          },
          range
        });
      });

      return { suggestions };
    }
  });

  // Настраиваем автодополнение для CSS
  monaco.languages.registerCompletionItemProvider('css', {
    provideCompletionItems: (model: any, position: any) => {
      const suggestions: monaco.languages.CompletionItem[] = [];
      
      // Создаем диапазон для автодополнения
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column
      };
      
      // Добавляем CSS свойства
      const cssProperties = [
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'width', 'height', 'margin', 'padding', 'border',
        'background', 'color', 'font', 'text-align', 'flex',
        'grid', 'transform', 'transition', 'animation'
      ];

      cssProperties.forEach(property => {
        suggestions.push({
          label: property,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: `${property}: ${0};`,
          documentation: {
            value: `**${property}**\n\nCSS свойство ${property}`
          },
          range
        });
      });

      return { suggestions };
    }
  });

  // Настраиваем автодополнение для HTML
  monaco.languages.registerCompletionItemProvider('html', {
    provideCompletionItems: (model: any, position: any) => {
      const suggestions: monaco.languages.CompletionItem[] = [];
      
      // Создаем диапазон для автодополнения
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column
      };
      
      // Добавляем HTML элементы
      const htmlElements = [
        'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'button', 'input', 'form', 'label', 'select', 'option',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'img', 'a', 'nav', 'header', 'footer', 'main', 'section', 'article'
      ];

      htmlElements.forEach(element => {
        suggestions.push({
          label: element,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `<${element}$0></${element}>`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: `**${element}**\n\nHTML элемент ${element}`
          },
          range
        });
      });

      // Добавляем HTML атрибуты
      const htmlAttributes = [
        'class', 'id', 'style', 'src', 'href', 'alt', 'title',
        'type', 'value', 'placeholder', 'disabled', 'required',
        'checked', 'selected', 'multiple', 'readonly'
      ];

      htmlAttributes.forEach(attribute => {
        suggestions.push({
          label: attribute,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: `${attribute}="${0}"`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: `**${attribute}**\n\nHTML атрибут ${attribute}`
          },
          range
        });
      });

      return { suggestions };
    }
  });
} 