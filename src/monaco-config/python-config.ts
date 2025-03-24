import { Monaco } from '@monaco-editor/react';

export function configurePython(monaco: Monaco) {
  // Регистрация языка Python
  monaco.languages.register({ id: 'python' });
  
  // Настройка конфигурации языка
  monaco.languages.setLanguageConfiguration('python', {
    comments: {
      lineComment: '#',
      blockComment: ['"""', '"""']
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
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '"""', close: '"""', notIn: ['string'] },
      { open: "'''", close: "'''", notIn: ['string'] }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    indentationRules: {
      increaseIndentPattern: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async)\b.*:\s*$/,
      decreaseIndentPattern: /^\s*(?:elif|else|except|finally)\b.*$/
    },
    folding: {
      markers: {
        start: new RegExp("^\\s*#\\s*region\\b"),
        end: new RegExp("^\\s*#\\s*endregion\\b")
      }
    }
  });

  // Регистрация провайдера автодополнения
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model: any, position: any, context: any, token: any) => {
      const wordInfo = model.getWordUntilPosition(position);
      const wordRange = new monaco.Range(
        position.lineNumber,
        wordInfo.startColumn,
        position.lineNumber,
        wordInfo.endColumn
      );

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      const lineText = model.getLineContent(position.lineNumber);
      const isImport = /^\s*import\s+/.test(lineText) || /^\s*from\s+\S+\s+import\s+/.test(lineText);
      const isFromImport = /^\s*from\s+(\S+)\s+import\s+/.test(lineText);
      const match = lineText.match(/^\s*from\s+(\S+)\s+import\s+/);
      const moduleBeingImported = match ? match[1] : null;

      // Базовые ключевые слова Python
      const keywords = [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 
        'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 
        'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 
        'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 
        'while', 'with', 'yield'
      ];
      
      // Встроенные функции Python
      const builtins = [
        'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'chr', 
        'classmethod', 'compile', 'complex', 'dict', 'dir', 'divmod', 'enumerate', 
        'eval', 'exec', 'filter', 'float', 'format', 'frozenset', 'getattr', 
        'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int', 
        'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map', 
        'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 
        'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round', 
        'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 
        'super', 'tuple', 'type', 'vars', 'zip'
      ];
      
      // Популярные модули Python
      const modules = [
        'os', 'sys', 'math', 'random', 'datetime', 're', 'json', 'collections',
        'numpy', 'pandas', 'matplotlib', 'sklearn', 'tensorflow', 'torch', 
        'django', 'flask', 'requests', 'sqlite3', 'pathlib', 'itertools', 
        'functools', 'time', 'csv', 'argparse', 'logging'
      ];

      // Создаем предложения с правильным range
      const createCompletionItem = (label: string, kind: any, insertText: string, detail?: string, insertTextRules?: any) => {
        const item: any = {
          label,
          kind,
          insertText,
          range: wordRange
        };
        
        if (detail) {
          item.detail = detail;
        }
        
        if (insertTextRules) {
          item.insertTextRules = insertTextRules;
        }
        
        return item;
      };

      // Базовые предложения
      let suggestions = [
        ...keywords.map(word => createCompletionItem(
          word, 
          monaco.languages.CompletionItemKind.Keyword,
          word
        )),
        ...builtins.map(func => createCompletionItem(
          func, 
          monaco.languages.CompletionItemKind.Function,
          func,
          'Built-in function'
        )),
        ...modules.map(mod => createCompletionItem(
          mod, 
          monaco.languages.CompletionItemKind.Module,
          mod,
          'Module'
        )),
        // Сниппеты
        createCompletionItem(
          'def',
          monaco.languages.CompletionItemKind.Snippet,
          'def ${1:function_name}(${2:parameters}):\n\t${3:pass}',
          'Function definition',
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        ),
        createCompletionItem(
          'class',
          monaco.languages.CompletionItemKind.Snippet,
          'class ${1:ClassName}:\n\tdef __init__(self, ${2:parameters}):\n\t\t${3:pass}',
          'Class definition',
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        ),
        createCompletionItem(
          'if',
          monaco.languages.CompletionItemKind.Snippet,
          'if ${1:condition}:\n\t${2:pass}',
          'If statement',
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        ),
        createCompletionItem(
          'for',
          monaco.languages.CompletionItemKind.Snippet,
          'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
          'For loop',
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        )
      ];

      // Подсказки для популярных модулей Python
      const pythonModules: Record<string, string[]> = {
        'os': ['path', 'environ', 'getcwd', 'chdir', 'listdir', 'mkdir', 'makedirs', 'remove', 'rmdir', 'rename', 'system', 'walk'],
        'sys': ['argv', 'exit', 'path', 'platform', 'stdin', 'stdout', 'stderr', 'version', 'version_info'],
        'math': ['ceil', 'floor', 'fabs', 'factorial', 'fmod', 'gcd', 'isfinite', 'isinf', 'isnan', 'pow', 'sqrt', 'sin', 'cos', 'tan', 'pi', 'e'],
        'random': ['random', 'randint', 'choice', 'choices', 'sample', 'shuffle', 'uniform', 'seed'],
        'datetime': ['date', 'time', 'datetime', 'timedelta', 'timezone'],
        'json': ['loads', 'dumps', 'load', 'dump'],
        'numpy': ['array', 'zeros', 'ones', 'empty', 'arange', 'linspace', 'random', 'mean', 'median', 'std', 'var', 'min', 'max', 'sum', 'prod'],
        'pandas': ['DataFrame', 'Series', 'read_csv', 'read_excel', 'concat', 'merge', 'pivot_table', 'groupby'],
        'matplotlib.pyplot': ['plot', 'scatter', 'bar', 'hist', 'boxplot', 'pie', 'imshow', 'figure', 'subplot', 'title', 'xlabel', 'ylabel', 'legend', 'show', 'savefig']
      };

      // Если мы находимся в импорте модуля
      if (isImport) {
        const moduleNames = Object.keys(pythonModules);
        const moduleSuggestions = moduleNames.map(name => createCompletionItem(
          name,
          monaco.languages.CompletionItemKind.Module,
          name,
          'Python module'
        ));
        
        // Если это импорт из конкретного модуля
        if (isFromImport && moduleBeingImported && moduleBeingImported in pythonModules) {
          const moduleMembers = pythonModules[moduleBeingImported];
          const memberSuggestions = moduleMembers.map((member: string) => createCompletionItem(
            member,
            monaco.languages.CompletionItemKind.Function,
            member,
            `${moduleBeingImported} member`
          ));
          
          suggestions = memberSuggestions;
        } else {
          suggestions = moduleSuggestions;
        }
      }

      return {
        suggestions
      };
    },
    triggerCharacters: ['.', ' ', '(', ',', "'", '"']
  });
} 