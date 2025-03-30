/**
 * Загрузчик тем для Monaco Editor с поддержкой TypeScript и TSX
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
        // TypeScript токены
        { token: 'keyword.ts', foreground: '#569CD6' },
        { token: 'keyword.tsx', foreground: '#569CD6' },
        { token: 'identifier.ts', foreground: '#9CDCFE' },
        { token: 'identifier.tsx', foreground: '#9CDCFE' },
        { token: 'type.ts', foreground: '#4EC9B0' },
        { token: 'type.tsx', foreground: '#4EC9B0' },
        { token: 'interface.ts', foreground: '#4EC9B0' },
        { token: 'interface.tsx', foreground: '#4EC9B0' },
        { token: 'class.ts', foreground: '#4EC9B0' },
        { token: 'class.tsx', foreground: '#4EC9B0' },
        { token: 'enum.ts', foreground: '#B8D7A3' },
        { token: 'enum.tsx', foreground: '#B8D7A3' },

        // JSX токены
        { token: 'delimiter.bracket.tsx', foreground: '#808080' },
        { token: 'delimiter.bracket.ts', foreground: '#808080' },
        { token: 'tag.tsx', foreground: '#569CD6' },
        { token: 'tag.ts', foreground: '#569CD6' },
        { token: 'attribute.name.tsx', foreground: '#9CDCFE' },
        { token: 'attribute.name.ts', foreground: '#9CDCFE' },
        { token: 'attribute.value.tsx', foreground: '#CE9178' },
        { token: 'attribute.value.ts', foreground: '#CE9178' },

        // Общие токены для всех режимов
        { token: 'comment', foreground: '#6A9955' },
        { token: 'string', foreground: '#CE9178' },
        { token: 'number', foreground: '#B5CEA8' },
        { token: 'keyword', foreground: '#569CD6' },
        { token: 'operator', foreground: '#D4D4D4' },
        { token: 'variable', foreground: '#9CDCFE' },
        { token: 'variable.predefined', foreground: '#4FC1FF' },
        { token: 'function', foreground: '#DCDCAA' },
        { token: 'constant', foreground: '#4FC1FF' },
        { token: 'delimiter', foreground: '#D4D4D4' },
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
        { token: 'jsx.text', foreground: '#D4D4D4' },
        { token: 'jsx.tag.name', foreground: '#569CD6' },
        { token: 'jsx.attribute.name', foreground: '#9CDCFE' },
        { token: 'jsx.attribute.value', foreground: '#CE9178' }
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
        { token: 'keyword.ts', foreground: '#0000FF' },
        { token: 'keyword.tsx', foreground: '#0000FF' },
        { token: 'identifier.ts', foreground: '#001080' },
        { token: 'identifier.tsx', foreground: '#001080' },
        { token: 'type.ts', foreground: '#267F99' },
        { token: 'type.tsx', foreground: '#267F99' },
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

        // Общие токены для всех режимов
        { token: 'comment', foreground: '#008000' },
        { token: 'string', foreground: '#A31515' },
        { token: 'number', foreground: '#098658' },
        { token: 'keyword', foreground: '#0000FF' },
        { token: 'delimiter', foreground: '#000000' },
        { token: 'operator', foreground: '#000000' },

        // Токены специально для TypeScript
        { token: 'type', foreground: '#267F99' },
        { token: 'constructor', foreground: '#267F99' },
        { token: 'function', foreground: '#795E26' },
        { token: 'namespace', foreground: '#267F99' },
        { token: 'variable', foreground: '#001080' },
        { token: 'interface', foreground: '#267F99' },
        { token: 'class', foreground: '#267F99' }
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

// Функция для настройки токенизатора TypeScript
export const configureTypeScriptTokenizer = (monaco: any) => {
  if (!monaco?.languages) {
    console.error('Monaco.languages не определен');
    return;
  }

  try {
    const languages = ['typescript', 'typescriptreact'];
    
    // Регистрация токенизаторов для TypeScript и TSX
    languages.forEach(lang => {
      // Проверяем, существует ли уже токенизатор
      const existingTokenizers = monaco.languages.getTokensProviderRegistry().filter(
        (p: any) => p._languages && p._languages.indexOf(lang) !== -1
      );
      
      // Если токенизатор уже существует, не регистрируем новый
      if (existingTokenizers.length > 0) {
        console.log(`Токенизатор для ${lang} уже существует`);
        return;
      }
      
      // Регистрируем простой токенизатор для улучшения подсветки синтаксиса
      monaco.languages.setMonarchTokensProvider(lang, {
        defaultToken: 'invalid',
        tokenPostfix: '.' + lang.replace('typescript', 'ts').replace('react', 'x'),
        
        keywords: [
          'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class',
          'const', 'constructor', 'continue', 'debugger', 'declare', 'default',
          'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
          'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in', 
          'infer', 'instanceof', 'interface', 'is', 'keyof', 'let', 'module', 
          'namespace', 'never', 'new', 'null', 'number', 'object', 'package', 
          'private', 'protected', 'public', 'readonly', 'require', 'return', 
          'set', 'static', 'string', 'super', 'switch', 'symbol', 'this', 
          'throw', 'true', 'try', 'type', 'typeof', 'unique', 'unknown', 'var', 
          'void', 'while', 'with', 'yield'
        ],
        
        typeKeywords: [
          'any', 'boolean', 'number', 'object', 'string', 'undefined', 'never',
          'void', 'symbol', 'bigint', 'unknown'
        ],
        
        operators: [
          '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '*', 
          '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^', 
          '!', '~', '&&', '||', '?', ':', '=', '+=', '-=', '*=', 
          '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '@'
        ],
        
        symbols: /[=><!~?:&|+\-*\/\^%]+/,
        
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        
        digits: /\d+(_+\d+)*/,
        octaldigits: /[0-7]+(_+[0-7]+)*/,
        binarydigits: /[0-1]+(_+[0-1]+)*/,
        hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
        
        // Основные токенизаторы
        tokenizer: {
          root: [
            [/[{}]/, 'delimiter.bracket'],
            { include: 'common' }
          ],
          
          common: [
            // Идентификаторы и ключевые слова
            [/[a-z_$][\w$]*/, {
              cases: {
                '@typeKeywords': 'type',
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            [/[A-Z][\w\$]*/, 'type.identifier'],
            
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
            [/[<>](?!@symbols)/, 'delimiter.angle'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }]
          ],
          
          comment: [
            [/[^/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ["\\*/", 'comment', '@pop'],
            [/[/*]/, 'comment']
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
          ]
        }
      });
    });
    
    console.log('Токенизаторы для TypeScript успешно сконфигурированы');
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
}; 