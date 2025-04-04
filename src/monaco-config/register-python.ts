/**
 * Регистрация поддержки Python в Monaco Editor
 */

/**
 * Регистрирует поддержку Python в Monaco Editor
 */
export function registerPython(): boolean {
  try {
    if (!window.monaco) {
      console.warn('Monaco не найден');
      return false;
    }
    
    console.log('Регистрация поддержки Python...');
    const monaco = window.monaco;
    
    // Регистрируем язык Python если не зарегистрирован
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'python')) {
      monaco.languages.register({
        id: 'python',
        extensions: ['.py', '.pyw', '.pyi'],
        aliases: ['Python', 'py'],
        mimetypes: ['text/x-python', 'application/x-python']
      });
      
      console.log('Язык Python зарегистрирован');
    }
    
    // Устанавливаем конфигурацию языка с комментариями, скобками и т.д.
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
        { open: "'", close: "'" },
        { open: '`', close: '`' }
      ],
      onEnterRules: [
        {
          beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|except|finally|with|async)\b.*:\s*$/,
          action: { indentAction: monaco.languages.IndentAction.Indent }
        }
      ],
      folding: {
        offSide: true,
        markers: {
          start: new RegExp('^\\s*#region\\b'),
          end: new RegExp('^\\s*#endregion\\b')
        }
      }
    });
    
    // Определяем основные токены для подсветки синтаксиса
    monaco.languages.setMonarchTokensProvider('python', {
      defaultToken: '',
      tokenPostfix: '.python',
      
      keywords: [
        'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
        'except', 'exec', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
        'lambda', 'not', 'or', 'pass', 'print', 'raise', 'return', 'try', 'while', 'with',
        'yield', 'async', 'await', 'nonlocal', 'False', 'None', 'True', 'match', 'case',
        'self', 'cls', 'type', 'typing', 'Optional', 'Union', 'Any', 'List', 'Dict', 'Tuple',
        'Set', 'Callable', 'Generator', 'Coroutine', 'AsyncIterable', 'TypeVar'
      ],
      
      typingKeywords: [
        'Optional', 'Union', 'Any', 'List', 'Dict', 'Tuple', 'Set', 'Callable', 'Generator',
        'Coroutine', 'AsyncIterable', 'TypeVar', 'cast', 'Final', 'ClassVar', 'Protocol'
      ],
      
      decorators: [
        'classmethod', 'staticmethod', 'property', 'abstractmethod', 'dataclass', 'lru_cache'
      ],
      
      specialNames: [
        '__init__', '__str__', '__repr__', '__len__', '__getitem__', '__setitem__', '__delitem__',
        '__contains__', '__call__', '__enter__', '__exit__', '__add__', '__sub__', '__mul__',
        '__truediv__', '__floordiv__', '__mod__', '__pow__', '__and__', '__or__', '__xor__', '__eq__',
        '__ne__', '__lt__', '__le__', '__gt__', '__ge__', '__iter__', '__next__', '__await__',
        '__aiter__', '__anext__', '__bool__'
      ],
      
      builtins: [
        'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'chr', 'classmethod',
        'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'filter',
        'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
        'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
        'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
        'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
        'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip', '__import__',
        'Exception', 'TypeError', 'ValueError', 'KeyError', 'IndexError', 'NameError', 'SyntaxError',
        'IndentationError', 'RuntimeError', 'FileNotFoundError', 'ImportError', 'AttributeError'
      ],
      
      brackets: [
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' }
      ],
      
      tokenizer: {
        root: [
          { include: '@whitespace' },
          { include: '@numbers' },
          { include: '@strings' },
          
          // f-строки
          [/f(['"'])/, { token: 'string.fstring.delimiter', next: '@fstring.$1' }],
          [/fr(['"'])/, { token: 'string.fstring.delimiter', next: '@frawstring.$1' }],
          [/rf(['"'])/, { token: 'string.fstring.delimiter', next: '@frawstring.$1' }],
          
          // r-строки
          [/r(['"'])/, { token: 'string.raw.delimiter', next: '@rawstring.$1' }],
          
          // b-строки
          [/b(['"'])/, { token: 'string.bytes.delimiter', next: '@bstring.$1' }],
          
          // Декораторы
          [/(@)(\s*)([a-zA-Z_][\w.]*)/, ['decorator', 'white', {
            cases: {
              '@decorators': 'decorator.special',
              '@default': 'decorator'
            }
          }]],
          
          [/[,:;]/, 'delimiter'],
          [/[{}\[\]()]/, '@brackets'],
          
          // Операторы
          [/\+=|-=|\*=|\/=|\/\/=|%=|@=|\&=|\|=|\^=|>>=|<<=|\*\*=/, 'operator'],
          [/\+|-|\*|\/|\/\/|%|<<|>>|\&|\||\^|~|\*\*/, 'operator'],
          [/==|!=|<|>|<=|>=|<>|=|:=/, 'operator'],
          
          // Идентификаторы
          [/@?[a-zA-Z_]\w*/, {
            cases: {
              '@specialNames': 'variable.predefined',
              '@keywords': 'keyword',
              '@typingKeywords': 'keyword.type',
              '@builtins': 'type.identifier',
              '@default': 'identifier'
            }
          }]
        ],
        
        // Обработка f-строк
        fstring: [
          [/\{\{/, 'string.fstring.delimiter'],
          [/\}\}/, 'string.fstring.delimiter'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstringParentheses' }],
          [/\$\$/, 'string.fstring'],
          [/\$/, 'string.fstring'],
          [/[^'"\{\}\$]+/, 'string.fstring'],
          [/'/, {
            cases: {
              '$#==$S2': { token: 'string.fstring.delimiter', next: '@pop' },
              '@default': 'string.fstring'
            }
          }],
          [/"/, {
            cases: {
              '$#==$S2': { token: 'string.fstring.delimiter', next: '@pop' },
              '@default': 'string.fstring'
            }
          }]
        ],
        
        fstringParentheses: [
          [/\}/, { token: 'string.fstring.delimiter', next: '@pop' }],
          [/[^{}]+/, 'string.fstring.expression']
        ],
        
        frawstring: [
          [/\{\{/, 'string.fstring.delimiter'],
          [/\}\}/, 'string.fstring.delimiter'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstringParentheses' }],
          [/[^'"\{\}]+/, 'string.fstring.raw'],
          [/'/, {
            cases: {
              '$#==$S2': { token: 'string.fstring.delimiter', next: '@pop' },
              '@default': 'string.fstring.raw'
            }
          }],
          [/"/, {
            cases: {
              '$#==$S2': { token: 'string.fstring.delimiter', next: '@pop' },
              '@default': 'string.fstring.raw'
            }
          }]
        ],
        
        // Обработка r-строк (raw)
        rawstring: [
          [/[^'"\\\n]+/, 'string.raw'],
          [/\\./,  'string.raw.escape'],
          [/'/, {
            cases: {
              '$#==$S2': { token: 'string.raw.delimiter', next: '@pop' },
              '@default': 'string.raw'
            }
          }],
          [/"/, {
            cases: {
              '$#==$S2': { token: 'string.raw.delimiter', next: '@pop' },
              '@default': 'string.raw'
            }
          }]
        ],
        
        // Обработка b-строк (bytes)
        bstring: [
          [/[^'"\\\n]+/, 'string.bytes'],
          [/\\./,  'string.bytes.escape'],
          [/'/, {
            cases: {
              '$#==$S2': { token: 'string.bytes.delimiter', next: '@pop' },
              '@default': 'string.bytes'
            }
          }],
          [/"/, {
            cases: {
              '$#==$S2': { token: 'string.bytes.delimiter', next: '@pop' },
              '@default': 'string.bytes'
            }
          }]
        ],
        
        // Обработка строк
        strings: [
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/'/, 'string', '@stringBody'],
          [/"/, 'string', '@dblStringBody'],
          [/'''/, 'string', '@multiStringBody'],
          [/"""/, 'string', '@multiDblStringBody']
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
        
        multiStringBody: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'''/, 'string', '@pop']
        ],
        
        multiDblStringBody: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"""/, 'string', '@pop']
        ],
        
        // Обработка комментариев
        whitespace: [
          [/\s+/, 'white'],
          [/(^#.*$)/, 'comment'],
          [/'''/, 'comment', '@docstring'],
          [/"""/, 'comment', '@dblDocstring']
        ],
        
        docstring: [
          [/[^\\']+/, 'comment'],
          [/\\./, 'comment'],
          [/'''/, 'comment', '@pop']
        ],
        
        dblDocstring: [
          [/[^\\"]+/, 'comment'],
          [/\\./, 'comment'],
          [/"""/, 'comment', '@pop']
        ],
        
        // Обработка чисел
        numbers: [
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/0[oO][0-7]+/, 'number.octal'],
          [/0[bB][0-1]+/, 'number.binary'],
          [/\d+/, 'number']
        ]
      }
    });
    
    // Добавляем простой провайдер автодополнения
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model: any, position: any) => {
        const wordAtPosition = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordAtPosition.startColumn,
          endColumn: wordAtPosition.endColumn
        };
        
        const suggestions = [
          // Ключевые слова
          ...['and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
              'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
              'lambda', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with',
              'yield', 'async', 'await', 'nonlocal', 'False', 'None', 'True'].map(keyword => ({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range: range
          })),
          
          // Встроенные функции
          ...['abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'chr', 'classmethod',
              'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'filter',
              'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
              'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
              'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
              'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
              'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip', '__import__'].map(func => ({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func,
            detail: `Встроенная функция Python - ${func}()`,
            documentation: { value: `Встроенная функция Python: ${func}()` },
            range: range
          })),
          
          // Популярные модули
          ...['os', 'sys', 'datetime', 'math', 'random', 'json', 're', 'time', 'collections',
              'numpy', 'pandas', 'requests', 'flask', 'django', 'sqlalchemy', 'pytest', 'matplotlib'].map(module => ({
            label: module,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: module,
            detail: `Модуль Python - ${module}`,
            documentation: { value: `Популярный модуль Python: ${module}` },
            range: range
          })),
          
          // Сниппеты
          {
            label: 'def',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'def ${1:function_name}(${2:parameters}):',
              '\t"""',
              '\t${3:Описание функции}',
              '\t"""',
              '\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Объявление функции' },
            range: range
          },
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'class ${1:ClassName}:',
              '\t"""',
              '\t${2:Описание класса}',
              '\t"""',
              '\t',
              '\tdef __init__(self${3:, parameters}):',
              '\t\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Объявление класса' },
            range: range
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'if ${1:condition}:',
              '\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Условный оператор if' },
            range: range
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'for ${1:item} in ${2:iterable}:',
              '\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Цикл for' },
            range: range
          },
          {
            label: 'while',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'while ${1:condition}:',
              '\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Цикл while' },
            range: range
          },
          {
            label: 'try',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'try:',
              '\t${1:pass}',
              'except ${2:Exception} as ${3:e}:',
              '\t${0:pass}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: 'Блок try-except' },
            range: range
          }
        ];
        
        return { suggestions };
      }
    });
    
    // Устанавливаем провайдер для сигнатуры функций
    monaco.languages.registerSignatureHelpProvider('python', {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: (model: any, position: any) => {
        
        // Возвращаем информацию о некоторых распространенных функциях
        return {
          value: {
            signatures: [
              {
                label: 'print(value, ..., sep=" ", end="\\n", file=sys.stdout, flush=False)',
                documentation: 'Выводит значения на экран или в файл.\n\n**Параметры:**\n- values: Значения для вывода\n- sep: Разделитель между значениями (по умолчанию пробел)\n- end: Строка в конце вывода (по умолчанию перевод строки)\n- file: Файловый объект для вывода (по умолчанию stdout)\n- flush: Сбрасывать буфер после вывода\n\n```python\nprint("Hello", "World")  # Hello World\nprint("Hello", "World", sep="-")  # Hello-World\n```',
                parameters: [
                  { label: 'value', documentation: 'Значение для вывода' },
                  { label: 'sep=" "', documentation: 'Разделитель между значениями' },
                  { label: 'end="\\n"', documentation: 'Строка в конце вывода' },
                  { label: 'file=sys.stdout', documentation: 'Файл для вывода' },
                  { label: 'flush=False', documentation: 'Сбрасывать буфер после вывода' }
                ]
              }
            ],
            activeSignature: 0,
            activeParameter: 0
          },
          dispose: () => {}
        };
      }
    });
    
    // Устанавливаем провайдер для подсказок при наведении
    monaco.languages.registerHoverProvider('python', {
      provideHover: (model: any, position: any) => {
        // Получаем текущее слово под курсором
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const wordContent = word.word;
        const lineContent = model.getLineContent(position.lineNumber);
        const fullText = model.getValue();
        
        // Проверяем, находится ли курсор в строке import 
        const importMatch = lineContent.match(/\bimport\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
        const fromImportMatch = lineContent.match(/\bfrom\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+/);
        
        if (importMatch && wordContent === importMatch[1]) {
          // Это модуль в импорте
          if (moduleDocs[wordContent]) {
            return {
              contents: [{ value: moduleDocs[wordContent] }]
            };
          }
        }
        
        if (fromImportMatch && wordContent === fromImportMatch[1]) {
          // Это модуль в from ... import
          if (moduleDocs[wordContent]) {
            return {
              contents: [{ value: moduleDocs[wordContent] }]
            };
          }
        }
        
        // Проверяем, является ли текущее слово методом объекта (obj.method)
        const methodMatch = lineContent.substring(0, position.column - 1).match(/([a-zA-Z_][a-zA-Z0-9_]*)\.(<?=${wordContent})/);
        if (methodMatch) {
          const objectName = methodMatch[1];
          
          // Определяем методы для известных типов
          const methodDocs: Record<string, Record<string, string>> = {
            'str': {
              'upper': '**str.upper()** → str\n\nВозвращает копию строки, в которой все символы переведены в верхний регистр.',
              'lower': '**str.lower()** → str\n\nВозвращает копию строки, в которой все символы переведены в нижний регистр.',
              'strip': '**str.strip([chars])** → str\n\nВозвращает копию строки, в которой удалены начальные и конечные символы chars (пробелы по умолчанию).',
              'split': '**str.split([sep[, maxsplit]])** → list\n\nРазбивает строку на список по разделителю sep.',
              'join': '**str.join(iterable)** → str\n\nСоединяет строки из iterable, используя строку как разделитель.',
              'replace': '**str.replace(old, new[, count])** → str\n\nВозвращает копию строки, в которой все вхождения old заменены на new.',
              'format': '**str.format(*args, **kwargs)** → str\n\nФорматирует строку, подставляя значения в фигурные скобки.',
              'find': '**str.find(sub[, start[, end]])** → int\n\nВозвращает наименьший индекс, по которому начинается подстрока sub. Возвращает -1, если подстрока не найдена.',
              'count': '**str.count(sub[, start[, end]])** → int\n\nВозвращает количество непересекающихся вхождений подстроки sub.'
            },
            'list': {
              'append': '**list.append(x)** → None\n\nДобавляет элемент x в конец списка.',
              'extend': '**list.extend(iterable)** → None\n\nРасширяет список, добавляя элементы из iterable.',
              'insert': '**list.insert(i, x)** → None\n\nВставляет элемент x в список по индексу i.',
              'remove': '**list.remove(x)** → None\n\nУдаляет первое вхождение элемента x из списка. Вызывает ValueError, если элемент не найден.',
              'pop': '**list.pop([i])** → any\n\nУдаляет и возвращает элемент с индексом i (по умолчанию последний элемент).',
              'clear': '**list.clear()** → None\n\nУдаляет все элементы из списка.',
              'index': '**list.index(x[, start[, end]])** → int\n\nВозвращает индекс первого вхождения элемента x. Вызывает ValueError, если элемент не найден.',
              'count': '**list.count(x)** → int\n\nВозвращает количество вхождений элемента x в списке.',
              'sort': '**list.sort(*, key=None, reverse=False)** → None\n\nСортирует список на месте.',
              'reverse': '**list.reverse()** → None\n\nРазворачивает список на месте.'
            },
            'dict': {
              'get': '**dict.get(key[, default])** → any\n\nВозвращает значение по ключу key. Если ключ отсутствует, возвращает default (None по умолчанию).',
              'items': '**dict.items()** → view\n\nВозвращает представление пар (ключ, значение) словаря.',
              'keys': '**dict.keys()** → view\n\nВозвращает представление ключей словаря.',
              'values': '**dict.values()** → view\n\nВозвращает представление значений словаря.',
              'update': '**dict.update([other])** → None\n\nОбновляет словарь, добавляя пары ключ-значение из other.',
              'pop': '**dict.pop(key[, default])** → any\n\nУдаляет ключ и возвращает соответствующее значение. Если ключ отсутствует и задан default, возвращает default, иначе вызывает KeyError.',
              'popitem': '**dict.popitem()** → tuple\n\nУдаляет и возвращает пару (ключ, значение). Порядок LIFO.',
              'clear': '**dict.clear()** → None\n\nУдаляет все элементы из словаря.',
              'setdefault': '**dict.setdefault(key[, default])** → any\n\nВозвращает значение по ключу key. Если ключ отсутствует, вставляет ключ со значением default (None по умолчанию) и возвращает default.'
            },
            'set': {
              'add': '**set.add(elem)** → None\n\nДобавляет элемент elem в множество.',
              'update': '**set.update(*others)** → None\n\nОбновляет множество, добавляя элементы из iterable.',
              'remove': '**set.remove(elem)** → None\n\nУдаляет элемент elem из множества. Вызывает KeyError, если элемент не найден.',
              'discard': '**set.discard(elem)** → None\n\nУдаляет элемент elem из множества, если он присутствует.',
              'pop': '**set.pop()** → any\n\nУдаляет и возвращает произвольный элемент из множества. Вызывает KeyError, если множество пусто.',
              'clear': '**set.clear()** → None\n\nУдаляет все элементы из множества.',
              'union': '**set.union(*others)** → set\n\nВозвращает новое множество, содержащее элементы из данного множества и всех others.',
              'intersection': '**set.intersection(*others)** → set\n\nВозвращает новое множество, содержащее элементы, общие для данного множества и всех others.',
              'difference': '**set.difference(*others)** → set\n\nВозвращает новое множество, содержащее элементы из данного множества, которых нет ни в одном из others.',
              'symmetric_difference': '**set.symmetric_difference(other)** → set\n\nВозвращает новое множество, содержащее элементы, присутствующие только в одном из множеств (данном или other).'
            }
          };
          
          // Попытка определить тип объекта по контексту
          const objectType = determineObjectType(objectName, fullText, position.lineNumber);
          
          if (objectType && methodDocs[objectType] && methodDocs[objectType][wordContent]) {
            return {
              contents: [{ value: methodDocs[objectType][wordContent] }]
            };
          }
        }
        
        // Проверяем известные имена функций и методов
        if (builtinFunctionDocs[wordContent]) {
          return {
            contents: [{ value: builtinFunctionDocs[wordContent] }]
          };
        }
        
        // Проверяем контекст кода для более точного определения
        const context = analyzeContext(fullText);
        
        // Находим информацию о текущем слове
        const variable = context.variables.find(v => v.name === wordContent);
        const func = context.functions.find(f => f.name === wordContent);
        const cls = context.classes.find(c => c.name === wordContent);
        
        // Если это известная переменная, функция или класс, показываем информацию о ней
        if (variable) {
          return {
            contents: [
              { value: `**Переменная: ${variable.name}**\n\n**Тип:** ${variable.type}\n\n**Значение:** \`${variable.value}\`` }
            ]
          };
        } else if (func) {
          let docComment = extractDocComment(fullText, func.line);
          let docString = '';
          if (docComment) {
            docString = `\n\n${docComment}`;
          }
          
          return {
            contents: [
              { value: `**Функция: ${func.name}**\n\n**Параметры:** ${func.params || 'нет'}\n\n**Возвращаемый тип:** ${func.returnType}${docString}` }
            ]
          };
        } else if (cls) {
          let docComment = extractDocComment(fullText, cls.line);
          let docString = '';
          if (docComment) {
            docString = `\n\n${docComment}`;
          }
          
          return {
            contents: [
              { value: `**Класс: ${cls.name}**\n\n**Методы:**\n${cls.methods.map(m => `- \`${m}\``).join('\n')}${docString}` }
            ]
          };
        }
        
        // Словарь с детальными подсказками для ключевых слов
        const keywordDocs: Record<string, string> = {
          'def': '**def** - Объявление функции\n\n```python\ndef function_name(parameters):\n    """Документация функции"""\n    # тело функции\n```\n\nИспользуется для определения функций в Python.',
          'class': '**class** - Объявление класса\n\n```python\nclass ClassName:\n    """Документация класса"""\n    \n    def __init__(self, parameters):\n        # инициализация объекта\n```\n\nИспользуется для определения классов в Python.',
          'if': '**if** - Условный оператор\n\n```python\nif condition:\n    # код, выполняемый если условие истинно\nelif other_condition:\n    # код для другого условия\nelse:\n    # код по умолчанию\n```',
          'for': '**for** - Цикл итерации\n\n```python\nfor item in iterable:\n    # код для выполнения\n```\n\nИтерация по последовательности (список, кортеж, словарь, строка и др.).',
          'while': '**while** - Цикл с условием\n\n```python\nwhile condition:\n    # код, выполняемый пока условие истинно\n```',
          'try': '**try** - Обработка исключений\n\n```python\ntry:\n    # код, который может вызвать исключение\nexcept ExceptionType as e:\n    # обработка исключения\nelse:\n    # выполняется если исключения не было\nfinally:\n    # выполняется всегда\n```',
          'import': '**import** - Импорт модулей\n\n```python\nimport module              # импорт модуля целиком\nfrom module import name    # импорт конкретного имени\nfrom module import *       # импорт всех имен (не рекомендуется)\nimport module as alias     # импорт с псевдонимом\n```',
          'with': '**with** - Менеджер контекста\n\n```python\nwith expression as variable:\n    # код с гарантированным освобождением ресурсов\n```\n\nИспользуется для работы с файлами, соединениями и другими ресурсами.',
          'lambda': '**lambda** - Анонимная функция\n\n```python\nlambda parameters: expression\n```\n\nКомпактный способ создания одноразовой функции.',
          'return': '**return** - Возврат значения из функции\n\n```python\ndef function():\n    return value\n```',
          'yield': '**yield** - Создание генератора\n\n```python\ndef generator():\n    yield value\n```\n\nИспользуется для создания функций-генераторов, которые возвращают значения по одному.',
          'async': '**async** - Асинхронная функция\n\n```python\nasync def async_function():\n    # асинхронный код\n    await other_async_function()\n```',
          'await': '**await** - Ожидание завершения асинхронной операции\n\n```python\nasync def async_function():\n    result = await other_async_function()\n```\n\nИспользуется только внутри асинхронных функций.',
          'True': '**True** - Булево значение "истина"\n\nВстроенная константа, представляющая истинное значение.',
          'False': '**False** - Булево значение "ложь"\n\nВстроенная константа, представляющая ложное значение.',
          'None': '**None** - Пустое значение\n\nСпециальное значение, представляющее отсутствие значения или "ничего".',
          'match': '**match** - Сопоставление с образцом (Python 3.10+)\n\n```python\nmatch value:\n    case pattern1:\n        # код если соответствует pattern1\n    case pattern2:\n        # код если соответствует pattern2\n    case _:\n        # код по умолчанию\n```',
          'case': '**case** - Образец в инструкции match\n\nИспользуется внутри инструкции match для проверки соответствия значения образцу.',
          'self': '**self** - Ссылка на экземпляр класса\n\nПервый параметр в методах класса, ссылающийся на текущий экземпляр.',
          'cls': '**cls** - Ссылка на класс\n\nПервый параметр в методах класса, объявленных с декоратором @classmethod.'
        };
        
        // Проверяем, есть ли подсказка для текущего слова
        if (keywordDocs[wordContent]) {
          return {
            contents: [
              { value: keywordDocs[wordContent] }
            ]
          };
        } else if (moduleDocs[wordContent]) {
          return {
            contents: [
              { value: moduleDocs[wordContent] }
            ]
          };
        }
        
        // Для неизвестных слов показываем общую подсказку
        return {
          contents: [
            { value: `**${wordContent}**` },
            { value: 'Нет дополнительной информации для этого элемента.' }
          ]
        };
      }
    });
    
    // Добавляем диагностический провайдер для отображения ошибок
    const pythonDiagnostics = monaco.languages.createDiagnosticsCollection('python');
    
    // Функция для анализа кода и отображения ошибок
    const providePythonDiagnostics = (model: any) => {
      const uri = model.uri;
      
      // Проверяем, что это Python файл
      if (monaco.editor.getModelLanguage(model) === 'python' || 
          uri.path.endsWith('.py') || 
          uri.path.endsWith('.pyw') || 
          uri.path.endsWith('.pyi')) {
        
        const code = model.getValue();
        const errors = analyzePythonErrors(code);
        
        // Преобразуем обнаруженные ошибки в маркеры Monaco
        const markers = errors.map(error => ({
          severity: error.severity === 'error' ? monaco.MarkerSeverity.Error :
                   error.severity === 'warning' ? monaco.MarkerSeverity.Warning : 
                   monaco.MarkerSeverity.Info,
          message: error.message,
          startLineNumber: error.line + 1,
          startColumn: error.column + 1,
          endLineNumber: error.line + 1,
          endColumn: error.column + 30, // Примерная длина выделения
          source: 'python-analyzer'
        }));
        
        // Устанавливаем маркеры для модели
        monaco.editor.setModelMarkers(model, 'python-linter', markers);
      }
    };
    
    // Функция для анализа ошибок Python
    function analyzePythonErrors(code: string) {
      const errors: {message: string, line: number, severity: string, column: number}[] = [];
      const lines = code.split('\n');
      const indentStack: number[] = [0]; // Стек для отслеживания отступов
      const unclosedBrackets: {char: string, line: number, column: number}[] = [];
      let inFunction = false;
      let hasFunctionReturn = false;
      let inLoop = false;
      let inConditional = false;
      let importedModules: string[] = [];
      let declaredVariables: Set<string> = new Set();
      let usedVariables: Set<string> = new Set();
      let functionNames: Set<string> = new Set();
      let currentIndent = 0; // Добавляем переменную для текущего отступа
      
      // Список встроенных имен Python для проверки неопределенных переменных
      const builtins = [
        'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'chr', 'classmethod',
        'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'filter',
        'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
        'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
        'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
        'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
        'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip', '__import__',
        'Exception', 'TypeError', 'ValueError', 'KeyError', 'IndexError', 'NameError', 'SyntaxError',
        'IndentationError', 'RuntimeError', 'FileNotFoundError', 'ImportError', 'AttributeError'
      ];
      
      // Проверка на несоответствие отступов
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimRight();
        if (line.trim() === '') continue; // Пропускаем пустые строки
        
        const indentMatch = line.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0].length : 0;
        const lastIndent = indentStack[indentStack.length - 1];
        
        // Сохраняем текущий отступ для использования в проверках
        currentIndent = indent;
        
        // Отслеживаем импорты
        if (line.includes('import ')) {
          if (line.match(/^\s*import\s+([a-zA-Z_][a-zA-Z0-9_.]*)(\s*,\s*([a-zA-Z_][a-zA-Z0-9_.]*))*(\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?/)) {
            const modulesMatch = line.match(/import\s+([^#]+)/);
            if (modulesMatch) {
              const modules = modulesMatch[1].split(',').map(m => m.trim().split(' as ')[0]);
              importedModules.push(...modules);
            }
          } else if (line.match(/^\s*from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+/)) {
            const moduleMatch = line.match(/from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/);
            if (moduleMatch) {
              importedModules.push(moduleMatch[1]);
            }
          } else {
            errors.push({
              message: `Неверный синтаксис импорта`,
              line: i,
              column: line.indexOf('import'),
              severity: 'error'
            });
          }
        }
        
        // Отслеживаем объявление функций
        if (line.match(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/)) {
          const funcNameMatch = line.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (funcNameMatch) {
            const funcName = funcNameMatch[1];
            functionNames.add(funcName);
            inFunction = true;
            hasFunctionReturn = false;
          }
        }
        
        // Отслеживаем return в функциях
        if (inFunction && line.trim().startsWith('return ')) {
          hasFunctionReturn = true;
        }
        
        // Отслеживаем конец функций (по изменению отступов)
        if (inFunction && indent <= currentIndent && i > 0) {
          if (!hasFunctionReturn && !lines[i-1].trim().startsWith('return')) {
            // Не требуем return для функций, которые могут быть процедурами
            // или могут иметь неявный return None
          }
          inFunction = false;
          hasFunctionReturn = false;
        }
        
        // Отслеживаем циклы
        if (line.match(/^\s*(for|while)\s+/) && line.trim().endsWith(':')) {
          inLoop = true;
        }
        
        // Проверка наличия break/continue вне цикла
        if ((line.trim() === 'break' || line.trim() === 'continue') && !inLoop) {
          errors.push({
            message: `'${line.trim()}' вне цикла`,
            line: i,
            column: indent,
            severity: 'error'
          });
        }
        
        // Отслеживаем конец цикла (по изменению отступов)
        if (inLoop && indent <= currentIndent && i > 0) {
          inLoop = false;
        }
        
        // Отслеживаем условные операторы
        if (line.match(/^\s*(if|elif|else)\s*/) && line.trim().endsWith(':')) {
          inConditional = true;
        }
        
        // Отслеживаем конец условного оператора (по изменению отступов)
        if (inConditional && indent <= currentIndent && i > 0) {
          inConditional = false;
        }
        
        // Блок кода начинается (увеличение отступа)
        if (line.trim().endsWith(':')) {
          let currentIndent = indent;
          indentStack.push(indent + 4); // Ожидаем увеличение отступа на 4 пробела
        } 
        // Проверка на соответствие текущего отступа ожидаемому
        else if (indent > lastIndent) {
          if (indent !== indentStack[indentStack.length - 1]) {
            errors.push({
              message: `Неожиданный отступ. Ожидалось ${indentStack[indentStack.length - 1]} пробелов, получено ${indent}.`,
              line: i,
              column: 0,
              severity: 'error'
            });
          }
        } 
        // Уменьшение отступа
        else if (indent < lastIndent) {
          while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
            indentStack.pop();
          }
          if (indent !== indentStack[indentStack.length - 1]) {
            errors.push({
              message: `Несогласованный отступ.`,
              line: i,
              column: 0,
              severity: 'error'
            });
          }
        }
        
        // Отслеживаем объявления переменных
        const assignmentMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*/);
        if (assignmentMatch) {
          declaredVariables.add(assignmentMatch[1]);
        }
        
        // Отслеживаем использование переменных
        const variableUseRegex = /[^a-zA-Z0-9_]([a-zA-Z_][a-zA-Z0-9_]*)[^a-zA-Z0-9_]/g;
        let match;
        while ((match = variableUseRegex.exec(line)) !== null) {
          const varName = match[1];
          if (!['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 'as', 'return', 
               'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'in', 'True', 'False', 'None',
               'try', 'except', 'finally', 'raise', 'with', 'assert', 'lambda', 'yield', 'del', 'global',
               'nonlocal', 'self', 'cls'].includes(varName)) {
            usedVariables.add(varName);
          }
        }
        
        // Проверка на синтаксические ошибки
        if (line.includes('import') && line.includes(' as ')) {
          const importMatch = line.match(/import\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (!importMatch) {
            errors.push({
              message: `Неверный оператор импорта.`,
              line: i,
              column: line.indexOf('import'),
              severity: 'error'
            });
          }
        }
        
        // Проверка на неверное использование скобок
        const chars = line.split('');
        for (let j = 0; j < chars.length; j++) {
          const char = chars[j];
          
          if (char === '(' || char === '[' || char === '{') {
            unclosedBrackets.push({ char, line: i, column: j });
          } else if (char === ')' || char === ']' || char === '}') {
            const correspondingOpen = char === ')' ? '(' : (char === ']' ? '[' : '{');
            
            if (unclosedBrackets.length === 0 || unclosedBrackets[unclosedBrackets.length - 1].char !== correspondingOpen) {
              errors.push({
                message: `Непарная закрывающая скобка '${char}'.`,
                line: i,
                column: j,
                severity: 'error'
              });
            } else {
              unclosedBrackets.pop();
            }
          }
        }
        
        // В конце строки проверяем, что все открытые внутри строки скобки закрыты,
        // если строка не заканчивается на обратный слеш (перенос строки)
        if (!line.trim().endsWith('\\') && unclosedBrackets.length > 0) {
          // Проверяем только скобки, открытые в текущей строке
          const lineOpenBrackets = unclosedBrackets.filter(b => b.line === i);
          if (lineOpenBrackets.length > 0) {
            errors.push({
              message: `Незакрытые скобки в строке.`,
              line: i,
              column: lineOpenBrackets[0].column,
              severity: 'error'
            });
          }
        }
        
        // Проверка на неправильное использование операторов сравнения
        if (line.includes('==') && (line.includes('>==') || line.includes('<=='))) {
          errors.push({
            message: `Недопустимый оператор сравнения. Используйте >= или <= вместо этого.`,
            line: i,
            column: line.indexOf('=='),
            severity: 'error'
          });
        }
        
        // Проверка на использование табуляции вместо пробелов
        if (line.includes('\t')) {
          errors.push({
            message: `Смешивание табуляции и пробелов. Используйте 4 пробела для отступа.`,
            line: i,
            column: line.indexOf('\t'),
            severity: 'warning'
          });
        }
        
        // Проверка на глобальное исключение (except:)
        if (/^\s*except\s*:/.test(line)) {
          errors.push({
            message: `Голый 'except:' следует избегать. Укажите тип исключения.`,
            line: i,
            column: line.indexOf('except'),
            severity: 'warning'
          });
        }
        
        // Проверка использования 'is' с литералами
        if (/\sis\s+['"]/.test(line) || /\sis\s+\d+/.test(line)) {
          errors.push({
            message: `Используйте == для сравнения значений вместо 'is' с литералами.`,
            line: i,
            column: line.indexOf('is'),
            severity: 'warning'
          });
        }
        
        // Проверка на слишком длинные строки
        if (line.length > 120) {
          errors.push({
            message: `Строка слишком длинная (${line.length} > 120 символов).`,
            line: i,
            column: 120,
            severity: 'info'
          });
        }
        
        // Проверка на множественные пробелы
        if (/\w\s{2,}\w/.test(line)) {
          const match = line.match(/\w(\s{2,})\w/);
          if (match) {
            errors.push({
              message: `Обнаружены множественные пробелы.`,
              line: i,
              column: line.indexOf(match[1]),
              severity: 'info'
            });
          }
        }
        
        // Проверка синтаксиса f-строк
        if (line.includes('f"') || line.includes("f'")) {
          const fstringMatch = line.match(/f(['"])(.*?)\1/);
          if (fstringMatch) {
            const fstringContent = fstringMatch[2];
            let openBraces = 0;
            
            for (let j = 0; j < fstringContent.length; j++) {
              if (fstringContent[j] === '{') {
                openBraces++;
                
                // Проверка корректного синтаксиса выражения в f-строке
                if (openBraces === 1) {
                  let exprStart = j + 1;
                  let exprEnd = exprStart;
                  
                  while (exprEnd < fstringContent.length && fstringContent[exprEnd] !== '}') {
                    exprEnd++;
                  }
                  
                  if (exprEnd < fstringContent.length) {
                    const expr = fstringContent.substring(exprStart, exprEnd).trim();
                    
                    // Выражение не должно содержать недопустимые конструкции
                    if (expr.includes(';') || expr.includes('if') || expr.includes(':')) {
                      errors.push({
                        message: `Недопустимое выражение в f-строке: '${expr}'`,
                        line: i,
                        column: line.indexOf(fstringContent) + j,
                        severity: 'error'
                      });
                    }
                  }
                }
              }
              
              if (fstringContent[j] === '}') {
                openBraces--;
                
                if (openBraces < 0) {
                  errors.push({
                    message: `Недопустимая f-строка: непарная '}'.`,
                    line: i,
                    column: line.indexOf(fstringContent) + j,
                    severity: 'error'
                  });
                  break;
                }
              }
            }
            
            if (openBraces > 0) {
              errors.push({
                message: `Недопустимая f-строка: незакрытая '{'.`,
                line: i,
                column: line.indexOf(fstringContent),
                severity: 'error'
              });
            }
          }
        }
        
        // Проверка наличия pass в пустых блоках
        if (line.trim().endsWith(':')) {
          // Проверяем, есть ли что-то в следующей строке
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trimRight();
            
            if (nextLine.trim() === '') {
              if (i + 2 < lines.length) {
                const nextNextLine = lines[i + 2].trimRight();
                const nextNextIndentMatch = nextNextLine.match(/^\s*/);
                const nextNextIndent = nextNextIndentMatch && nextNextIndentMatch[0] ? nextNextIndentMatch[0].length : 0;
                
                if (nextNextIndent <= indent) {
                  errors.push({
                    message: `Пустой блок. Добавьте 'pass'.`,
                    line: i,
                    column: line.length,
                    severity: 'warning'
                  });
                }
              } else {
                // Это последняя строка файла
                errors.push({
                  message: `Пустой блок в конце файла. Добавьте 'pass'.`,
                  line: i,
                  column: line.length,
                  severity: 'warning'
                });
              }
            }
          } else {
            // Это последняя строка файла
            errors.push({
              message: `Пустой блок в конце файла. Добавьте 'pass'.`,
              line: i,
              column: line.length,
              severity: 'warning'
            });
          }
        }
        
        // Проверка на опечатки в распространенных ключевых словах
        const typoPatterns = [
          { pattern: /\bimort\b/, suggestion: 'import' },
          { pattern: /\bfrom\s+(\w+)\s+imort\b/, suggestion: 'import' },
          { pattern: /\bprnit\b/, suggestion: 'print' },
          { pattern: /\bfro\b\s+/, suggestion: 'for' },
          { pattern: /\bdefine\b/, suggestion: 'def' },
          { pattern: /\bretrun\b/, suggestion: 'return' },
          { pattern: /\bwhiel\b/, suggestion: 'while' },
          { pattern: /\bclass\s+\w+\s*\(\s*\)\s*\w+/, message: 'Возможно пропущено двоеточие после объявления класса' }
        ];
        
        for (const pattern of typoPatterns) {
          if (pattern.pattern.test(line)) {
            const match = line.match(pattern.pattern);
            if (match) {
              errors.push({
                message: pattern.suggestion ? 
                  `Возможная опечатка: '${match[0]}'. Возможно, вы имели в виду '${pattern.suggestion}'?` : 
                  pattern.message || 'Возможная опечатка',
                line: i,
                column: line.indexOf(match[0]),
                severity: 'warning'
              });
            }
          }
        }
      }
      
      // Проверяем неиспользуемые переменные
      declaredVariables.forEach(variable => {
        if (!usedVariables.has(variable) && !functionNames.has(variable)) {
          // Находим строку, где переменная объявлена
          for (let i = 0; i < lines.length; i++) {
            const assignmentMatch = lines[i].match(new RegExp(`^\\s*${variable}\\s*=\\s*`));
            if (assignmentMatch) {
              errors.push({
                message: `Неиспользуемая переменная '${variable}'`,
                line: i,
                column: lines[i].indexOf(variable),
                severity: 'info'
              });
              break;
            }
          }
        }
      });
      
      // Проверка на неопределенные переменные
      usedVariables.forEach(variable => {
        if (!declaredVariables.has(variable) && 
            !functionNames.has(variable) && 
            !builtins.includes(variable) && 
            !importedModules.includes(variable.split('.')[0])) {
          
          // Исключаем некоторые распространенные переменные, которые могут быть определены неявно
          if (!['self', 'cls', 'args', 'kwargs'].includes(variable)) {
            // Находим строку, где переменная используется
            for (let i = 0; i < lines.length; i++) {
              const variableRegex = new RegExp(`[^a-zA-Z0-9_]${variable}[^a-zA-Z0-9_]`);
              if (variableRegex.test(lines[i])) {
                errors.push({
                  message: `Возможная неопределенная переменная '${variable}'`,
                  line: i,
                  column: lines[i].indexOf(variable),
                  severity: 'warning'
                });
                break;
              }
            }
          }
        }
      });
      
      return errors;
    }
    
    // Функция для определения типа объекта по контексту
    function determineObjectType(objectName: string, code: string, currentLine: number): string | null {
      const lines = code.split('\n');
      
      // Ищем объявление переменной в предыдущих строках
      for (let i = currentLine - 1; i >= 0; i--) {
        const line = lines[i];
        
        // Проверка на прямое присваивание
        const assignMatch = line.match(new RegExp(`${objectName}\\s*=\\s*([^#]+)`));
        if (assignMatch) {
          const value = assignMatch[1].trim();
          
          // Определяем тип по значению
          if (value.startsWith('"') || value.startsWith("'")) return 'str';
          if (value.startsWith('[') || value.includes('list(')) return 'list';
          if (value.startsWith('{') && value.includes(':') || value.includes('dict(')) return 'dict';
          if (value.startsWith('{') || value.includes('set(')) return 'set';
        }
        
        // Проверка на цикл for
        const forMatch = line.match(new RegExp(`for\\s+${objectName}\\s+in\\s+([^#:]+)`));
        if (forMatch) {
          const iterable = forMatch[1].trim();
          if (iterable.endsWith('.items()')) return 'dict'; // Итерация по словарю
          if (iterable.startsWith('"') || iterable.startsWith("'")) return 'str'; // Итерация по строке
          if (iterable.startsWith('[')) return 'list'; // Итерация по списку
        }
        
        // Проверка на результат вызова функции
        const funcMatch = line.match(new RegExp(`${objectName}\\s*=\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(`));
        if (funcMatch) {
          const funcName = funcMatch[1];
          if (['str', 'list', 'dict', 'set'].includes(funcName)) return funcName;
          
          // Некоторые распространенные функции, возвращающие определенные типы
          if (['split', 'splitlines'].includes(funcName)) return 'list';
          if (['strip', 'lower', 'upper', 'replace'].includes(funcName)) return 'str';
          if (['keys', 'values', 'items'].includes(funcName)) return 'dict';
        }
      }
      
      return null;
    }
    
    // Функция для извлечения докстрингов
    function extractDocComment(code: string, line: number): string | null {
      const lines = code.split('\n');
      
      // Проверяем, есть ли docstring после объявления функции/класса
      if (line + 1 < lines.length) {
        // Ищем начало docstring
        const docStringMatch = lines[line + 1].match(/^\s*(['"])(['"])\1|^\s*(['"])(.*)(['"])\3/);
        if (docStringMatch) {
          // Это однострочный docstring
          if (docStringMatch[4]) {
            return docStringMatch[4];
          }
          
          // Это многострочный docstring
          const quotes = docStringMatch[2] ? docStringMatch[1].repeat(3) : docStringMatch[3];
          let docString = '';
          let i = line + 2;
          
          // Ищем конец docstring
          while (i < lines.length) {
            if (lines[i].trim().endsWith(quotes) && !lines[i].trim().endsWith('\\' + quotes)) {
              docString += lines[i].trim().replace(quotes, '');
              break;
            }
            docString += lines[i] + '\n';
            i++;
          }
          
          return docString.trim();
        }
      }
      
      return null;
    }
    
    // Анализируем контекст (определяем переменные, функции и классы в файле)
    function analyzeContext(fullText: string) {
      const variables: {name: string, type: string, value: string, line: number}[] = [];
      const functions: {name: string, params: string, returnType: string, line: number}[] = [];
      const classes: {name: string, methods: string[], line: number}[] = [];
      
      const lines = fullText.split('\n');
      
      // Поиск переменных
      const variableRegex = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;
      // Поиск функций
      const functionRegex = /^(\s*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_\[\],\s]*))?:/;
      // Поиск классов
      const classRegex = /^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]*)\))?:/;
      // Поиск методов в классах
      const methodRegex = /^(\s+)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(self(?:,\s*([^)]*))?\)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_\[\],\s]*))?:/;
      
      let inClass = false;
      let currentClass = '';
      let currentClassMethods: string[] = [];
      let currentIndent = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Проверяем, не закончился ли класс (по изменению отступов)
        if (inClass && line.trim() !== '') {
          const indentMatch = line.match(/^\s*/);
          const lineIndent = indentMatch && indentMatch[0] ? indentMatch[0].length : 0;
          
          if (lineIndent <= currentIndent) {
            classes.push({
              name: currentClass,
              methods: currentClassMethods,
              line: i - currentClassMethods.length - 1
            });
            inClass = false;
            currentClass = '';
            currentClassMethods = [];
          }
        }
        
        // Поиск классов
        const classMatch = line.match(classRegex);
        if (classMatch) {
          if (inClass) {
            // Сохраняем предыдущий класс перед началом нового
            classes.push({
              name: currentClass,
              methods: currentClassMethods,
              line: i - currentClassMethods.length - 1
            });
          }
          inClass = true;
          currentClass = classMatch[2];
          currentClassMethods = [];
          currentIndent = classMatch[1].length;
          continue;
        }
        
        // Поиск методов в текущем классе
        if (inClass) {
          const methodMatch = line.match(methodRegex);
          if (methodMatch && methodMatch[1].length > currentIndent) {
            currentClassMethods.push(methodMatch[2]);
            continue;
          }
        }
        
        // Поиск функций
        const functionMatch = line.match(functionRegex);
        if (functionMatch && !inClass) {
          functions.push({
            name: functionMatch[2],
            params: functionMatch[3],
            returnType: functionMatch[4] || 'Any',
            line: i
          });
          continue;
        }
        
        // Поиск переменных
        const variableMatch = line.match(variableRegex);
        if (variableMatch && !inClass) {
          const varName = variableMatch[2];
          const varValue = variableMatch[3].trim();
          
          // Определяем тип переменной по значению
          let varType = 'Any';
          if (varValue.startsWith('"') || varValue.startsWith("'")) {
            varType = 'str';
          } else if (/^\d+$/.test(varValue)) {
            varType = 'int';
          } else if (/^\d+\.\d+$/.test(varValue)) {
            varType = 'float';
          } else if (varValue === 'True' || varValue === 'False') {
            varType = 'bool';
          } else if (varValue.startsWith('[')) {
            varType = 'list';
          } else if (varValue.startsWith('{') && varValue.includes(':')) {
            varType = 'dict';
          } else if (varValue.startsWith('{')) {
            varType = 'set';
          } else if (varValue.startsWith('(')) {
            varType = 'tuple';
          }
          
          variables.push({
            name: varName,
            type: varType,
            value: varValue,
            line: i
          });
        }
      }
      
      // Если мы все еще находимся в классе в конце файла, добавляем его
      if (inClass) {
        classes.push({
          name: currentClass,
          methods: currentClassMethods,
          line: lines.length - currentClassMethods.length - 1
        });
      }
      
      return { variables, functions, classes };
    }
    
    // Регистрируем событие для проверки ошибок при изменении кода
    monaco.editor.onDidCreateModel((model: any) => {
      // Используем не только суффиксы, но и установленный язык модели
      if (model.uri.path.endsWith('.py') || 
          model.uri.path.endsWith('.pyw') || 
          model.uri.path.endsWith('.pyi') ||
          monaco.editor.getModelLanguage(model) === 'python') {
        
        // Проверяем ошибки при создании модели
        providePythonDiagnostics(model);
        
        // Проверяем ошибки при изменении контента модели
        model.onDidChangeContent(() => {
          // Добавляем небольшую задержку для улучшения производительности
          setTimeout(() => providePythonDiagnostics(model), 300);
        });
      }
    });
    
    // Проверяем ошибки в существующих моделях
    monaco.editor.getModels().forEach((model: any) => {
      if (model.uri.path.endsWith('.py') || 
          model.uri.path.endsWith('.pyw') || 
          model.uri.path.endsWith('.pyi') ||
          monaco.editor.getModelLanguage(model) === 'python') {
        providePythonDiagnostics(model);
      }
    });
    
    // Обработчик для новых моделей
    monaco.editor.onDidCreateModel((model: any) => {
      const uri = model.uri.toString();
      if (uri.endsWith('.py') || uri.endsWith('.pyw') || uri.endsWith('.pyi')) {
        monaco.editor.setModelLanguage(model, 'python');
        console.log(`Установлен язык python для: ${uri}`);
      }
    });
    
    // Устанавливаем язык для существующих моделей
    monaco.editor.getModels().forEach((model: any) => {
      const uri = model.uri.toString();
      if (uri.endsWith('.py') || uri.endsWith('.pyw') || uri.endsWith('.pyi')) {
        monaco.editor.setModelLanguage(model, 'python');
        console.log(`Установлен язык python для существующей модели: ${uri}`);
      }
    });
    
    // Предотвращаем перехват Ctrl+R для перезагрузки
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        // Позволяем стандартное поведение перезагрузки
        return true;
      }
    }, { capture: true });
    
    // Добавляем класс для динамического анализа Python модулей
    class PythonModuleAnalyzer {
      private cachedModules: Record<string, any> = {};
      private moduleDocumentation: Record<string, string> = {};
      private moduleSymbols: Record<string, string[]> = {};
      private symbolDetails: Record<string, Record<string, string>> = {};
      private variableTypes: Record<string, string> = {};
      private variableValues: Record<string, string> = {};
      
      // Сканирует файловую систему для поиска Python файлов
      async scanWorkspace(rootPath: string): Promise<void> {
        try {
          // В браузерной среде используем fetch для получения списка файлов
          // В реальном проекте здесь может быть API запрос к бэкенду или другой способ
          // получения файлов из рабочей директории
          console.log('Сканирование Python модулей...');
          
          // Имитация сканирования в клиентской среде
          this.scanMockBuiltinModules();
        } catch (error) {
          console.error('Ошибка при сканировании модулей Python:', error);
        }
      }
      
      // Имитация сканирования встроенных модулей Python
      private scanMockBuiltinModules() {
        // Добавляем базовые типы и их свойства/методы
        this.addModule('str', [
          'capitalize', 'casefold', 'center', 'count', 'encode', 'endswith', 'expandtabs',
          'find', 'format', 'format_map', 'index', 'isalnum', 'isalpha', 'isascii', 'isdecimal',
          'isdigit', 'isidentifier', 'islower', 'isnumeric', 'isprintable', 'isspace', 'istitle',
          'isupper', 'join', 'ljust', 'lower', 'lstrip', 'maketrans', 'partition', 'replace',
          'rfind', 'rindex', 'rjust', 'rpartition', 'rsplit', 'rstrip', 'split', 'splitlines',
          'startswith', 'strip', 'swapcase', 'title', 'translate', 'upper', 'zfill'
        ]);
        
        this.addModule('list', [
          'append', 'clear', 'copy', 'count', 'extend', 'index', 'insert', 'pop', 'remove',
          'reverse', 'sort'
        ]);
        
        this.addModule('dict', [
          'clear', 'copy', 'fromkeys', 'get', 'items', 'keys', 'pop', 'popitem', 'setdefault',
          'update', 'values'
        ]);
        
        this.addModule('set', [
          'add', 'clear', 'copy', 'difference', 'difference_update', 'discard', 'intersection',
          'intersection_update', 'isdisjoint', 'issubset', 'issuperset', 'pop', 'remove',
          'symmetric_difference', 'symmetric_difference_update', 'union', 'update'
        ]);
        
        // Популярные модули стандартной библиотеки
        this.addModule('os', [
          'chdir', 'getcwd', 'listdir', 'mkdir', 'makedirs', 'remove', 'removedirs', 'rename',
          'renames', 'replace', 'rmdir', 'scandir', 'stat', 'walk', 'path'
        ]);
        
        this.addModule('os.path', [
          'abspath', 'basename', 'dirname', 'exists', 'expanduser', 'expandvars', 'getsize',
          'isabs', 'isdir', 'isfile', 'islink', 'join', 'normcase', 'normpath', 'realpath',
          'relpath', 'split', 'splitdrive', 'splitext'
        ]);
        
        this.addModule('sys', [
          'argv', 'builtin_module_names', 'byteorder', 'executable', 'exit', 'getsizeof',
          'implementation', 'modules', 'path', 'platform', 'stdin', 'stdout', 'stderr', 'version',
          'version_info'
        ]);
        
        this.addModule('datetime', [
          'date', 'datetime', 'time', 'timedelta', 'timezone', 'tzinfo', 'MINYEAR', 'MAXYEAR'
        ]);
        
        this.addModule('math', [
          'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'ceil', 'comb', 'copysign',
          'cos', 'cosh', 'degrees', 'dist', 'e', 'exp', 'factorial', 'floor', 'fmod', 'frexp',
          'fsum', 'gamma', 'gcd', 'hypot', 'inf', 'isclose', 'isfinite', 'isinf', 'isnan',
          'isqrt', 'lcm', 'ldexp', 'lgamma', 'log', 'log10', 'log1p', 'log2', 'modf', 'nan',
          'nextafter', 'perm', 'pi', 'pow', 'prod', 'radians', 'remainder', 'sin', 'sinh',
          'sqrt', 'tan', 'tanh', 'tau', 'trunc'
        ]);
        
        this.addModule('json', [
          'dump', 'dumps', 'load', 'loads', 'JSONDecoder', 'JSONEncoder'
        ]);
        
        this.addModule('re', [
          'compile', 'findall', 'finditer', 'match', 'search', 'split', 'sub', 'subn', 'escape',
          'purge', 'A', 'ASCII', 'DEBUG', 'I', 'IGNORECASE', 'L', 'LOCALE', 'M', 'MULTILINE',
          'S', 'DOTALL', 'X', 'VERBOSE'
        ]);
        
        // Добавляем подробные описания для некоторых методов
        this.addSymbolDetail('str', 'upper', 'str.upper() -> str\n\nВозвращает копию строки с символами, преобразованными в верхний регистр.');
        this.addSymbolDetail('str', 'lower', 'str.lower() -> str\n\nВозвращает копию строки с символами, преобразованными в нижний регистр.');
        this.addSymbolDetail('str', 'split', 'str.split(sep=None, maxsplit=-1) -> list\n\nРазбивает строку на список подстрок по разделителю sep.');
        
        this.addSymbolDetail('list', 'append', 'list.append(item) -> None\n\nДобавляет элемент в конец списка.');
        this.addSymbolDetail('list', 'sort', 'list.sort(*, key=None, reverse=False) -> None\n\nСортирует список на месте.');
        
        this.addSymbolDetail('os', 'listdir', 'os.listdir(path=".") -> list\n\nВозвращает список имен файлов и директорий в указанном пути.');
        this.addSymbolDetail('os.path', 'join', 'os.path.join(*paths) -> str\n\nУмно соединяет пути с учетом особенностей операционной системы.');
        
        // Добавляем документацию для модулей
        this.addModuleDocumentation('os', 'Модуль для взаимодействия с операционной системой');
        this.addModuleDocumentation('sys', 'Модуль для доступа к переменным и функциям, специфичным для интерпретатора Python');
        this.addModuleDocumentation('datetime', 'Модуль для работы с датами и временем');
        this.addModuleDocumentation('json', 'Модуль для работы с JSON-данными');
        this.addModuleDocumentation('re', 'Модуль для работы с регулярными выражениями');
        
        console.log('Загружены данные для стандартных модулей Python');
      }
      
      // Динамически определяет модули из строки импорта
      processImportStatement(importStatement: string): string[] {
        const modules: string[] = [];
        
        if (importStatement.startsWith('import ')) {
          const importPart = importStatement.substring(7).trim();
          const importItems = importPart.split(',');
          
          importItems.forEach(item => {
            const moduleName = item.trim().split(' as ')[0];
            modules.push(moduleName);
          });
        } else if (importStatement.startsWith('from ')) {
          const fromParts = importStatement.match(/from\s+([^\s]+)\s+import/);
          if (fromParts && fromParts.length > 1) {
            modules.push(fromParts[1]);
          }
        }
        
        return modules;
      }
      
      // Добавляет информацию о модуле
      addModule(name: string, symbols: string[]) {
        this.moduleSymbols[name] = symbols;
      }
      
      // Добавляет документацию для модуля
      addModuleDocumentation(name: string, documentation: string) {
        this.moduleDocumentation[name] = documentation;
      }
      
      // Добавляет подробную информацию о символе модуля
      addSymbolDetail(moduleName: string, symbolName: string, details: string) {
        if (!this.symbolDetails[moduleName]) {
          this.symbolDetails[moduleName] = {};
        }
        this.symbolDetails[moduleName][symbolName] = details;
      }
      
      // Возвращает символы модуля для автодополнения
      getModuleSymbols(moduleName: string): string[] {
        return this.moduleSymbols[moduleName] || [];
      }
      
      // Возвращает документацию для модуля
      getModuleDocumentation(moduleName: string): string {
        return this.moduleDocumentation[moduleName] || 
               `Модуль Python: ${moduleName}\n\nДокументация не найдена.`;
      }
      
      // Возвращает подробную информацию о символе модуля
      getSymbolDetail(moduleName: string, symbolName: string): string | null {
        if (this.symbolDetails[moduleName] && this.symbolDetails[moduleName][symbolName]) {
          return this.symbolDetails[moduleName][symbolName];
        }
        return null;
      }
      
      // Анализирует код для выявления локального контекста
      analyzeCodeContext(code: string): { imports: string[], variables: Record<string, string>, variableValues: Record<string, string> } {
        const imports: string[] = [];
        const variables: Record<string, string> = {};
        const variableValues: Record<string, string> = {};
        const lines = code.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Находим импорты
          if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('from ')) {
            imports.push(trimmedLine);
            
            // Обрабатываем импорты для добавления символов
            const modules = this.processImportStatement(trimmedLine);
            for (const module of modules) {
              if (!this.moduleSymbols[module]) {
                // Если модуль еще не известен, добавляем заглушку
                this.moduleSymbols[module] = ['(Модуль обнаружен, но содержимое неизвестно)'];
              }
            }
          }
          
          // Находим объявления переменных
          const variableMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
          if (variableMatch) {
            const varName = variableMatch[1];
            const varValue = variableMatch[2].trim().replace(/;$/, ''); // Удаляем точку с запятой в конце
            
            // Сохраняем значение переменной
            variableValues[varName] = varValue;
            
            // Определяем тип переменной по значению
            let varType = 'unknown';
            
            if (varValue.startsWith('"') || varValue.startsWith("'")) {
              varType = 'str';
            } else if (/^r(['"]).*\1$/.test(varValue)) {
              varType = 'str'; // raw строка
            } else if (/^f(['"]).*\1$/.test(varValue)) {
              varType = 'str'; // f-строка
            } else if (/^b(['"]).*\1$/.test(varValue)) {
              varType = 'bytes'; // байтовая строка
            } else if (varValue.startsWith('[')) {
              varType = 'list';
            } else if (varValue.startsWith('{') && varValue.includes(':')) {
              varType = 'dict';
            } else if (varValue.startsWith('{')) {
              varType = 'set';
            } else if (varValue.startsWith('(')) {
              varType = 'tuple';
            } else if (/^\d+$/.test(varValue)) {
              varType = 'int';
            } else if (/^\d+\.\d+$/.test(varValue)) {
              varType = 'float';
            } else if (varValue === 'True' || varValue === 'False') {
              varType = 'bool';
            } else if (varValue === 'None') {
              varType = 'None';
            } else if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.*\)$/.test(varValue)) {
              // Вызов функции - пытаемся определить тип по имени функции
              const funcName = varValue.substring(0, varValue.indexOf('('));
              if (['str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool'].includes(funcName)) {
                varType = funcName;
              } else if (funcName === 'open') {
                varType = 'file';
              } else {
                varType = 'unknown (function call)';
              }
            }
            
            variables[varName] = varType;
            
            // Сохраняем тип и значение
            this.variableTypes[varName] = varType;
            this.variableValues[varName] = varValue;
          }
        }
        
        return { imports, variables, variableValues };
      }
      
      // Возвращает все известные модули
      getAllModules(): string[] {
        return Object.keys(this.moduleSymbols);
      }
      
      // Возвращает тип переменной
      getVariableType(varName: string): string {
        return this.variableTypes[varName] || 'unknown';
      }
      
      // Возвращает значение переменной
      getVariableValue(varName: string): string {
        return this.variableValues[varName] || '';
      }
      
      // Проверяет, является ли строка строковым литералом
      isStringLiteral(text: string): boolean {
        return (
          (text.startsWith('"') && text.endsWith('"')) || 
          (text.startsWith("'") && text.endsWith("'")) ||
          /^[rfb](['"]).*\1$/.test(text)
        );
      }
    }
    
    // Создаем экземпляр анализатора модулей
    const pythonModuleAnalyzer = new PythonModuleAnalyzer();
    
    // Запускаем сканирование модулей
    pythonModuleAnalyzer.scanWorkspace('.');
    
    // Улучшаем провайдер автодополнения с учетом динамически обнаруженных модулей
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model: any, position: any) => {
        const wordAtPosition = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordAtPosition.startColumn,
          endColumn: wordAtPosition.endColumn
        };
        
        const lineContent = model.getLineContent(position.lineNumber).substring(0, position.column);
        const fullText = model.getValue();
        const suggestions: any[] = [];
        
        // Анализируем контекст кода для определения импортов и переменных
        const codeContext = pythonModuleAnalyzer.analyzeCodeContext(fullText);
        
        // Проверяем, находимся ли мы внутри импорта
        if (lineContent.match(/import\s+[a-zA-Z0-9_.]*$/)) {
          // Предлагаем модули для импорта
          const modules = pythonModuleAnalyzer.getAllModules();
          
          modules.forEach(module => {
            suggestions.push({
              label: module,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: module,
              detail: pythonModuleAnalyzer.getModuleDocumentation(module),
              range: range
            });
          });
        }
        // Проверяем, находимся ли мы после оператора точки (доступ к методам/свойствам)
        else if (lineContent.match(/([a-zA-Z0-9_]+)\.\w*$/)) {
          const dotMatch = lineContent.match(/([a-zA-Z0-9_]+)\.\w*$/);
          if (dotMatch) {
            const objectName = dotMatch[1];
            
            // Если это известный модуль
            if (pythonModuleAnalyzer.getModuleSymbols(objectName).length > 0) {
              const symbols = pythonModuleAnalyzer.getModuleSymbols(objectName);
              
              symbols.forEach(symbol => {
                const detail = pythonModuleAnalyzer.getSymbolDetail(objectName, symbol);
                
                suggestions.push({
                  label: symbol,
                  kind: monaco.languages.CompletionItemKind.Method,
                  insertText: symbol,
                  detail: detail || `${objectName}.${symbol}`,
                  range: range
                });
              });
            }
            // Если это переменная известного типа
            else if (codeContext.variables[objectName]) {
              const varType = codeContext.variables[objectName];
              
              if (pythonModuleAnalyzer.getModuleSymbols(varType).length > 0) {
                const symbols = pythonModuleAnalyzer.getModuleSymbols(varType);
                
                symbols.forEach(symbol => {
                  const detail = pythonModuleAnalyzer.getSymbolDetail(varType, symbol);
                  
                  suggestions.push({
                    label: symbol,
                    kind: monaco.languages.CompletionItemKind.Method,
                    insertText: symbol,
                    detail: detail || `${varType}.${symbol}`,
                    range: range
                  });
                });
              }
            }
          }
        }
        else {
          // Общие подсказки - ключевые слова, встроенные функции и т.д.
          
          // Ключевые слова
          ['and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
           'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
           'lambda', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with',
           'yield', 'async', 'await', 'nonlocal', 'False', 'None', 'True', 'match', 'case'].forEach(keyword => {
            suggestions.push({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range: range
            });
          });
          
          // Встроенные функции
          ['abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'chr', 'classmethod',
           'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 'enumerate', 'eval', 'filter',
           'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
           'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
           'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
           'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
           'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip', '__import__'].forEach(func => {
            suggestions.push({
              label: func,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: func,
              detail: builtinFunctionDocs[func] ? builtinFunctionDocs[func].split("\n")[0] : `Встроенная функция Python - ${func}()`,
              documentation: { value: builtinFunctionDocs[func] || `Встроенная функция Python: ${func}()` },
              range: range
            });
          });
          
          // Добавляем импортированные модули
          codeContext.imports.forEach(importStmt => {
            const modules = pythonModuleAnalyzer.processImportStatement(importStmt);
            
            modules.forEach(module => {
              // Проверяем, не добавлен ли уже модуль в подсказки
              if (!suggestions.some(s => s.label === module)) {
                suggestions.push({
                  label: module,
                  kind: monaco.languages.CompletionItemKind.Module,
                  insertText: module,
                  detail: pythonModuleAnalyzer.getModuleDocumentation(module),
                  range: range
                });
              }
            });
          });
          
          // Добавляем локальные переменные
          Object.keys(codeContext.variables).forEach(varName => {
            suggestions.push({
              label: varName,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: varName,
              detail: `Переменная типа: ${codeContext.variables[varName]}`,
              range: range
            });
          });
          
          // Сниппеты
          [
            {
              label: 'def',
              insertText: [
                'def ${1:function_name}(${2:parameters}):',
                '\t"""',
                '\t${3:Описание функции}',
                '\t"""',
                '\t${0:pass}'
              ].join('\n'),
              documentation: 'Объявление функции'
            },
            {
              label: 'class',
              insertText: [
                'class ${1:ClassName}:',
                '\t"""',
                '\t${2:Описание класса}',
                '\t"""',
                '\t',
                '\tdef __init__(self${3:, parameters}):',
                '\t\t${0:pass}'
              ].join('\n'),
              documentation: 'Объявление класса'
            },
            {
              label: 'if',
              insertText: [
                'if ${1:condition}:',
                '\t${0:pass}'
              ].join('\n'),
              documentation: 'Условный оператор if'
            },
            {
              label: 'for',
              insertText: [
                'for ${1:item} in ${2:iterable}:',
                '\t${0:pass}'
              ].join('\n'),
              documentation: 'Цикл for'
            },
            {
              label: 'while',
              insertText: [
                'while ${1:condition}:',
                '\t${0:pass}'
              ].join('\n'),
              documentation: 'Цикл while'
            },
            {
              label: 'try',
              insertText: [
                'try:',
                '\t${1:pass}',
                'except ${2:Exception} as ${3:e}:',
                '\t${0:pass}'
              ].join('\n'),
              documentation: 'Блок try-except'
            }
          ].forEach(snippet => {
            suggestions.push({
              label: snippet.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: snippet.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: { value: snippet.documentation },
              range: range
            });
          });
        }
        
        return { suggestions };
      }
    });
    
    // Улучшаем провайдер подсказок при наведении с учетом динамически обнаруженных модулей
    monaco.languages.registerHoverProvider('python', {
      provideHover: (model: any, position: any) => {
        // Получаем текущее слово под курсором
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        
        const wordContent = word.word;
        const lineContent = model.getLineContent(position.lineNumber);
        const fullText = model.getValue();
        
        // Анализируем контекст кода
        const codeContext = pythonModuleAnalyzer.analyzeCodeContext(fullText);
        
        // Проверяем, находится ли курсор на строковом литерале
        const lineUntilPosition = lineContent.substring(0, position.column);
        const lineAfterPosition = lineContent.substring(position.column);
        
        // Регулярные выражения для определения строковых литералов
        const stringLiteralRegex = /(["'])(.*?)\1/g;
        const rawStringRegex = /r(["'])(.*?)\1/g;
        const fStringRegex = /f(["'])(.*?)\1/g;
        const bytesStringRegex = /b(["'])(.*?)\1/g;
        
        let match;
        // Проверяем обычные строки
        while ((match = stringLiteralRegex.exec(lineContent)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          if (position.column > startPos && position.column <= endPos) {
            return {
              contents: [
                { value: '**Строковый литерал**\n\nТип: `str`\n\nЗначение: `' + match[0] + '`' }
              ]
            };
          }
        }
        
        // Проверяем raw строки
        while ((match = rawStringRegex.exec(lineContent)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          if (position.column > startPos && position.column <= endPos) {
            return {
              contents: [
                { value: '**Строковый литерал (raw)**\n\nТип: `str`\n\nЗначение: `' + match[0] + '`' }
              ]
            };
          }
        }
        
        // Проверяем f-строки
        while ((match = fStringRegex.exec(lineContent)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          if (position.column > startPos && position.column <= endPos) {
            return {
              contents: [
                { value: '**Форматированная строка (f-string)**\n\nТип: `str`\n\nЗначение: `' + match[0] + '`' }
              ]
            };
          }
        }
        
        // Проверяем байтовые строки
        while ((match = bytesStringRegex.exec(lineContent)) !== null) {
          const startPos = match.index;
          const endPos = startPos + match[0].length;
          if (position.column > startPos && position.column <= endPos) {
            return {
              contents: [
                { value: '**Байтовая строка**\n\nТип: `bytes`\n\nЗначение: `' + match[0] + '`' }
              ]
            };
          }
        }
        
        // Проверяем, находится ли курсор в строке import 
        const importMatch = lineContent.match(/\bimport\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
        const fromImportMatch = lineContent.match(/\bfrom\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+/);
        
        if (importMatch && wordContent === importMatch[1]) {
          // Это модуль в импорте
          const moduleDocs = pythonModuleAnalyzer.getModuleDocumentation(wordContent);
          return {
            contents: [{ value: moduleDocs }]
          };
        }
        
        if (fromImportMatch && wordContent === fromImportMatch[1]) {
          // Это модуль в from ... import
          const moduleDocs = pythonModuleAnalyzer.getModuleDocumentation(wordContent);
          return {
            contents: [{ value: moduleDocs }]
          };
        }
        
        // Проверяем, является ли текущее слово методом объекта (obj.method)
        const dotContent = lineContent.substring(0, position.column - 1);
        const methodMatch = dotContent.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z_]*$/);
        
        if (methodMatch) {
          const objectName = methodMatch[1];
          
          // Если это известный модуль
          if (pythonModuleAnalyzer.getModuleSymbols(objectName).length > 0) {
            const symbolDetail = pythonModuleAnalyzer.getSymbolDetail(objectName, wordContent);
            if (symbolDetail) {
              return {
                contents: [{ value: symbolDetail }]
              };
            }
          }
          
          // Если это переменная известного типа
          if (codeContext.variables[objectName]) {
            const varType = codeContext.variables[objectName];
            
            if (pythonModuleAnalyzer.getModuleSymbols(varType).length > 0) {
              const symbolDetail = pythonModuleAnalyzer.getSymbolDetail(varType, wordContent);
              if (symbolDetail) {
                return {
                  contents: [{ value: symbolDetail }]
                };
              }
            }
          }
        }
        
        // Проверяем известные имена функций и методов
        if (builtinFunctionDocs[wordContent]) {
          return {
            contents: [{ value: builtinFunctionDocs[wordContent] }]
          };
        }
        
        // Проверяем, является ли слово модулем (только если это не строка)
        if (!pythonModuleAnalyzer.isStringLiteral(wordContent) && pythonModuleAnalyzer.getModuleDocumentation(wordContent)) {
          return {
            contents: [{ value: pythonModuleAnalyzer.getModuleDocumentation(wordContent) }]
          };
        }
        
        // Проверяем, является ли слово переменной
        if (codeContext.variables[wordContent]) {
          const varType = codeContext.variables[wordContent];
          const varValue = codeContext.variableValues[wordContent] || '';
          
          let valueDisplay = '';
          if (varValue.length > 50) {
            valueDisplay = varValue.substring(0, 47) + '...';
          } else {
            valueDisplay = varValue;
          }
          
          return {
            contents: [
              { value: `**Переменная: ${wordContent}**\n\n**Тип:** \`${varType}\`\n\n**Значение:** \`${valueDisplay}\`` }
            ]
          };
        }
        
        // Словарь с детальными подсказками для ключевых слов
        const keywordDocs: Record<string, string> = {
          'def': '**def** - Объявление функции\n\n```python\ndef function_name(parameters):\n    """Документация функции"""\n    # тело функции\n```\n\nИспользуется для определения функций в Python.',
          'class': '**class** - Объявление класса\n\n```python\nclass ClassName:\n    """Документация класса"""\n    \n    def __init__(self, parameters):\n        # инициализация объекта\n```\n\nИспользуется для определения классов в Python.',
          'if': '**if** - Условный оператор\n\n```python\nif condition:\n    # код, выполняемый если условие истинно\nelif other_condition:\n    # код для другого условия\nelse:\n    # код по умолчанию\n```',
          'for': '**for** - Цикл итерации\n\n```python\nfor item in iterable:\n    # код для выполнения\n```\n\nИтерация по последовательности (список, кортеж, словарь, строка и др.).',
          'while': '**while** - Цикл с условием\n\n```python\nwhile condition:\n    # код, выполняемый пока условие истинно\n```',
          'try': '**try** - Обработка исключений\n\n```python\ntry:\n    # код, который может вызвать исключение\nexcept ExceptionType as e:\n    # обработка исключения\nelse:\n    # выполняется если исключения не было\nfinally:\n    # выполняется всегда\n```',
          'import': '**import** - Импорт модулей\n\n```python\nimport module              # импорт модуля целиком\nfrom module import name    # импорт конкретного имени\nfrom module import *       # импорт всех имен (не рекомендуется)\nimport module as alias     # импорт с псевдонимом\n```',
          'with': '**with** - Менеджер контекста\n\n```python\nwith expression as variable:\n    # код с гарантированным освобождением ресурсов\n```\n\nИспользуется для работы с файлами, соединениями и другими ресурсами.',
          'lambda': '**lambda** - Анонимная функция\n\n```python\nlambda parameters: expression\n```\n\nКомпактный способ создания одноразовой функции.',
          'return': '**return** - Возврат значения из функции\n\n```python\ndef function():\n    return value\n```',
          'yield': '**yield** - Создание генератора\n\n```python\ndef generator():\n    yield value\n```\n\nИспользуется для создания функций-генераторов, которые возвращают значения по одному.',
          'async': '**async** - Асинхронная функция\n\n```python\nasync def async_function():\n    # асинхронный код\n    await other_async_function()\n```',
          'await': '**await** - Ожидание завершения асинхронной операции\n\n```python\nasync def async_function():\n    result = await other_async_function()\n```\n\nИспользуется только внутри асинхронных функций.',
          'True': '**True** - Булево значение "истина"\n\nВстроенная константа, представляющая истинное значение.',
          'False': '**False** - Булево значение "ложь"\n\nВстроенная константа, представляющая ложное значение.',
          'None': '**None** - Пустое значение\n\nСпециальное значение, представляющее отсутствие значения или "ничего".',
          'match': '**match** - Сопоставление с образцом (Python 3.10+)\n\n```python\nmatch value:\n    case pattern1:\n        # код если соответствует pattern1\n    case pattern2:\n        # код если соответствует pattern2\n    case _:\n        # код по умолчанию\n```',
          'case': '**case** - Образец в инструкции match\n\nИспользуется внутри инструкции match для проверки соответствия значения образцу.',
          'self': '**self** - Ссылка на экземпляр класса\n\nПервый параметр в методах класса, ссылающийся на текущий экземпляр.',
          'cls': '**cls** - Ссылка на класс\n\nПервый параметр в методах класса, объявленных с декоратором @classmethod.'
        };
        
        // Проверяем, есть ли подсказка для текущего слова как ключевого слова
        if (keywordDocs[wordContent]) {
          return {
            contents: [
              { value: keywordDocs[wordContent] }
            ]
          };
        }
        
        // Для неизвестных слов показываем общую подсказку
        return {
          contents: [
            { value: `**${wordContent}**` },
            { value: 'Нет дополнительной информации для этого элемента.' }
          ]
        };
      }
    });
    
    console.log('Поддержка Python успешно настроена');
    return true;
  } catch (error) {
    console.error('Ошибка при настройке Python:', error);
    return false;
  }
}

const builtinFunctionDocs: Record<string, string> = {
  'print': '**print**(*values, sep=" ", end="\\n", file=sys.stdout, flush=False)\n\nВыводит значения на экран или в файл.\n\n**Параметры:**\n- values: Значения для вывода\n- sep: Разделитель между значениями (по умолчанию пробел)\n- end: Строка в конце вывода (по умолчанию перевод строки)\n- file: Файловый объект для вывода (по умолчанию stdout)\n- flush: Сбрасывать буфер после вывода\n\n```python\nprint("Hello", "World")  # Hello World\nprint("Hello", "World", sep="-")  # Hello-World\n```',
  'len': '**len**(obj)\n\nВозвращает длину (количество элементов) объекта.\n\n**Параметры:**\n- obj: Последовательность (строка, список, кортеж) или коллекция (словарь, множество)\n\n**Возвращает:**\n- Целое число, представляющее количество элементов\n\n```python\nlen("hello")  # 5\nlen([1, 2, 3])  # 3\n```',
  'range': '**range**(stop) | range(start, stop[, step])\n\nСоздает последовательность чисел.\n\n**Параметры:**\n- start: Начальное значение (по умолчанию 0)\n- stop: Конечное значение (не включается)\n- step: Шаг (по умолчанию 1)\n\n**Возвращает:**\n- Объект-итератор, который генерирует последовательность чисел\n\n```python\nlist(range(5))  # [0, 1, 2, 3, 4]\nlist(range(1, 6))  # [1, 2, 3, 4, 5]\nlist(range(0, 10, 2))  # [0, 2, 4, 6, 8]\n```',
  'int': '**int**(x=0) | int(x, base=10)\n\nПреобразует значение в целое число.\n\n**Параметры:**\n- x: Значение для преобразования (число или строка)\n- base: Основание системы счисления для строк (от 2 до 36)\n\n**Возвращает:**\n- Целое число\n\n```python\nint("123")  # 123\nint("1010", 2)  # 10 (бинарное в десятичное)\n```',
  'str': '**str**(object="") | str(object=b"", encoding="utf-8", errors="strict")\n\nПреобразует объект в строку.\n\n**Параметры:**\n- object: Объект для преобразования\n- encoding: Кодировка для байтов\n- errors: Стратегия обработки ошибок\n\n**Возвращает:**\n- Строковое представление объекта\n\n```python\nstr(123)  # "123"\nstr(b"\\xd0\\xbf\\xd1\\x80", encoding="utf-8")  # "пр"\n```',
  'list': '**list**([iterable])\n\nСоздает список или преобразует итерируемый объект в список.\n\n**Параметры:**\n- iterable: Итерируемый объект (опционально)\n\n**Возвращает:**\n- Новый список\n\n```python\nlist("abc")  # ["a", "b", "c"]\nlist(range(3))  # [0, 1, 2]\n```',
  'dict': '**dict**() | dict(mapping) | dict(iterable) | dict(**kwargs)\n\nСоздает словарь.\n\n**Параметры:**\n- mapping: Отображение для преобразования в словарь\n- iterable: Итерируемый объект пар ключ-значение\n- **kwargs: Именованные аргументы для создания словаря\n\n**Возвращает:**\n- Новый словарь\n\n```python\ndict(a=1, b=2)  # {"a": 1, "b": 2}\ndict([("a", 1), ("b", 2)])  # {"a": 1, "b": 2}\n```',
  'open': '**open**(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None)\n\nОткрывает файл и возвращает файловый объект.\n\n**Параметры:**\n- file: Путь к файлу\n- mode: Режим открытия ("r" - чтение, "w" - запись, "a" - добавление, и т.д.)\n- encoding: Кодировка для текстовых файлов\n\n**Возвращает:**\n- Файловый объект\n\n```python\nwith open("file.txt", "r", encoding="utf-8") as f:\n    content = f.read()\n```',
  'input': '**input**([prompt])\n\nЧитает строку с клавиатуры.\n\n**Параметры:**\n- prompt: Текст приглашения (опционально)\n\n**Возвращает:**\n- Введенную строку\n\n```python\nname = input("Введите имя: ")\n```',
  'sum': '**sum**(iterable, start=0)\n\nВычисляет сумму элементов последовательности.\n\n**Параметры:**\n- iterable: Итерируемый объект с числами\n- start: Начальное значение (по умолчанию 0)\n\n**Возвращает:**\n- Сумма чисел\n\n```python\nsum([1, 2, 3])  # 6\nsum([1, 2, 3], 10)  # 16\n```',
  'sorted': '**sorted**(iterable, key=None, reverse=False)\n\nВозвращает новый отсортированный список из итерируемого объекта.\n\n**Параметры:**\n- iterable: Итерируемый объект для сортировки\n- key: Функция для извлечения ключа сравнения\n- reverse: Сортировка в обратном порядке (по умолчанию False)\n\n**Возвращает:**\n- Отсортированный список\n\n```python\nsorted([3, 1, 2])  # [1, 2, 3]\nsorted(["c", "a", "b"])  # ["a", "b", "c"]\nsorted([3, 1, 2], reverse=True)  # [3, 2, 1]\n```',
  'type': '**type**(object)\n\nВозвращает тип объекта.\n\n**Параметры:**\n- object: Объект, тип которого нужно определить\n\n**Возвращает:**\n- Тип объекта\n\n```python\ntype(123)  # <class \'int\'>\ntype("hello")  # <class \'str\'>\n```',
  'dir': '**dir**([object])\n\nБез аргументов возвращает имена в текущей области видимости. С аргументом возвращает список атрибутов объекта.\n\n**Параметры:**\n- object: Объект для получения списка атрибутов (опционально)\n\n**Возвращает:**\n- Список строк с именами атрибутов\n\n```python\ndir()  # Имена в текущей области видимости\ndir(str)  # Атрибуты и методы строкового типа\n```',
  'help': '**help**([object])\n\nВызывает встроенную систему помощи.\n\n**Параметры:**\n- object: Объект, для которого нужна справка (опционально)\n\n```python\nhelp(print)  # Документация по функции print\nhelp(str)  # Документация по строковому типу\n```',
  
  // Добавим больше документации по функциям
  'abs': '**abs**(x)\n\nВозвращает абсолютное значение числа.\n\n**Параметры:**\n- x: Число\n\n**Возвращает:**\n- Абсолютное значение числа\n\n```python\nabs(-5)  # 5\nabs(3.14)  # 3.14\n```',
  'all': '**all**(iterable)\n\nВозвращает True, если все элементы итерируемого объекта истинны.\n\n**Параметры:**\n- iterable: Итерируемый объект\n\n**Возвращает:**\n- True если все элементы истинны, иначе False\n\n```python\nall([True, True, True])  # True\nall([True, False, True])  # False\nall([])  # True (пустой итерируемый объект)\n```',
  'any': '**any**(iterable)\n\nВозвращает True, если хотя бы один элемент итерируемого объекта истинен.\n\n**Параметры:**\n- iterable: Итерируемый объект\n\n**Возвращает:**\n- True если хотя бы один элемент истинен, иначе False\n\n```python\nany([False, False, True])  # True\nany([False, False, False])  # False\nany([])  # False (пустой итерируемый объект)\n```',
  'enumerate': '**enumerate**(iterable, start=0)\n\nВозвращает объект, который генерирует пары (индекс, значение).\n\n**Параметры:**\n- iterable: Итерируемый объект\n- start: Начальный индекс (по умолчанию 0)\n\n**Возвращает:**\n- Объект enumerate\n\n```python\nlist(enumerate(["a", "b", "c"]))  # [(0, "a"), (1, "b"), (2, "c")]\nlist(enumerate(["a", "b", "c"], 1))  # [(1, "a"), (2, "b"), (3, "c")]\n```',
  'filter': '**filter**(function, iterable)\n\nВозвращает итератор, содержащий элементы iterable, для которых function возвращает True.\n\n**Параметры:**\n- function: Функция, принимающая один аргумент\n- iterable: Итерируемый объект\n\n**Возвращает:**\n- Итератор с отфильтрованными элементами\n\n```python\ndef is_even(n):\n    return n % 2 == 0\n\nlist(filter(is_even, [1, 2, 3, 4, 5]))  # [2, 4]\nlist(filter(None, [0, 1, False, True, "", "hello"]))  # [1, True, "hello"]\n```',
  'float': '**float**([x])\n\nПреобразует строку или число в число с плавающей точкой.\n\n**Параметры:**\n- x: Строка или число (по умолчанию 0.0)\n\n**Возвращает:**\n- Число с плавающей точкой\n\n```python\nfloat(3)  # 3.0\nfloat("3.14")  # 3.14\nfloat("Infinity")  # inf\n```',
  'format': '**format**(value[, format_spec])\n\nПреобразует значение в отформатированное строковое представление.\n\n**Параметры:**\n- value: Значение для форматирования\n- format_spec: Спецификация формата\n\n**Возвращает:**\n- Отформатированную строку\n\n```python\nformat(123.456, ".2f")  # "123.46"\nformat(42, "b")  # "101010" (двоичное)\nformat("hello", "^10")  # "  hello   " (центрирование)\n```',
  'map': '**map**(function, iterable, ...)\n\nПрименяет функцию к каждому элементу итерируемого объекта.\n\n**Параметры:**\n- function: Функция, принимающая столько аргументов, сколько итерируемых объектов передано\n- iterable: Один или несколько итерируемых объектов\n\n**Возвращает:**\n- Итератор с результатами применения функции\n\n```python\ndef square(x):\n    return x ** 2\n\nlist(map(square, [1, 2, 3, 4]))  # [1, 4, 9, 16]\nlist(map(lambda x, y: x + y, [1, 2, 3], [4, 5, 6]))  # [5, 7, 9]\n```',
  'max': '**max**(iterable, *[, key, default]) | max(arg1, arg2, *args[, key])\n\nВозвращает наибольший элемент итерируемого объекта или наибольший из аргументов.\n\n**Параметры:**\n- iterable: Итерируемый объект\n- key: Функция для извлечения ключа сравнения\n- default: Значение по умолчанию, если итератор пуст\n\n**Возвращает:**\n- Наибольший элемент\n\n```python\nmax([1, 2, 3, 4])  # 4\nmax("abc", "xyz")  # "xyz"\nmax(["abc", "de", "fghi"], key=len)  # "fghi"\n```',
  'min': '**min**(iterable, *[, key, default]) | min(arg1, arg2, *args[, key])\n\nВозвращает наименьший элемент итерируемого объекта или наименьший из аргументов.\n\n**Параметры:**\n- iterable: Итерируемый объект\n- key: Функция для извлечения ключа сравнения\n- default: Значение по умолчанию, если итератор пуст\n\n**Возвращает:**\n- Наименьший элемент\n\n```python\nmin([1, 2, 3, 4])  # 1\nmin("abc", "xyz")  # "abc"\nmin(["abc", "de", "fghi"], key=len)  # "de"\n```',
  'round': '**round**(number[, ndigits])\n\nОкругляет число до указанного количества знаков после запятой.\n\n**Параметры:**\n- number: Число для округления\n- ndigits: Количество знаков после запятой (по умолчанию 0)\n\n**Возвращает:**\n- Округленное число\n\n```python\nround(3.14159)  # 3\nround(3.14159, 2)  # 3.14\nround(3.5)  # 4\nround(4.5)  # 4 (округляет к ближайшему четному числу)\n```',
  'set': '**set**([iterable])\n\nСоздает множество или преобразует итерируемый объект в множество.\n\n**Параметры:**\n- iterable: Итерируемый объект (опционально)\n\n**Возвращает:**\n- Новое множество\n\n```python\nset([1, 2, 3, 1, 2])  # {1, 2, 3}\nset("hello")  # {"h", "e", "l", "o"}\n```',
  'zip': '**zip**(*iterables)\n\nСоздает итератор, агрегирующий элементы из итерируемых объектов.\n\n**Параметры:**\n- iterables: Один или несколько итерируемых объектов\n\n**Возвращает:**\n- Итератор с кортежами, содержащими элементы из исходных итераторов\n\n```python\nlist(zip([1, 2, 3], ["a", "b", "c"]))  # [(1, "a"), (2, "b"), (3, "c")]\nlist(zip([1, 2], [3, 4], [5, 6]))  # [(1, 3, 5), (2, 4, 6)]\n```',
  'isinstance': '**isinstance**(object, classinfo)\n\nПроверяет, является ли объект экземпляром указанного класса или типа.\n\n**Параметры:**\n- object: Объект для проверки\n- classinfo: Класс, тип или кортеж классов и типов\n\n**Возвращает:**\n- True если объект является экземпляром указанного класса, иначе False\n\n```python\nisinstance(1, int)  # True\nisinstance("hello", (int, str))  # True\nisinstance([1, 2, 3], list)  # True\n```',
  'issubclass': '**issubclass**(class, classinfo)\n\nПроверяет, является ли класс подклассом указанного класса.\n\n**Параметры:**\n- class: Класс для проверки\n- classinfo: Класс или кортеж классов\n\n**Возвращает:**\n- True если класс является подклассом указанного класса, иначе False\n\n```python\nclass A: pass\nclass B(A): pass\n\nissubclass(B, A)  # True\nissubclass(A, B)  # False\nissubclass(bool, int)  # True\n```',
  'iter': '**iter**(object[, sentinel])\n\nВозвращает итератор для объекта.\n\n**Параметры:**\n- object: Итерируемый объект или вызываемый объект\n- sentinel: Значение, при получении которого итерация прекращается\n\n**Возвращает:**\n- Итератор\n\n```python\nit = iter([1, 2, 3])\nnext(it)  # 1\nnext(it)  # 2\nnext(it)  # 3\n```',
  'next': '**next**(iterator[, default])\n\nВозвращает следующий элемент из итератора.\n\n**Параметры:**\n- iterator: Итератор\n- default: Значение, возвращаемое при исчерпании итератора\n\n**Возвращает:**\n- Следующий элемент итератора или default\n\n```python\nit = iter([1, 2, 3])\nnext(it)  # 1\nnext(it)  # 2\nnext(it, "end")  # 3\nnext(it, "end")  # "end"\n```',
  'Exception': '**Exception**\n\nБазовый класс для всех встроенных исключений, не являющихся предупреждениями.\n\n```python\ntry:\n    # код, который может вызвать исключение\n    raise Exception("Произошла ошибка")\nexcept Exception as e:\n    print(e)  # "Произошла ошибка"\n```',
  'TypeError': '**TypeError**\n\nВозникает, когда операция или функция применяется к объекту недопустимого типа.\n\n```python\n"hello" + 123  # TypeError: can only concatenate str (not "int") to str\n```',
} 

// Словарь с документацией по популярным модулям
const moduleDocs: Record<string, string> = {
  'os': '**os** - Модуль для работы с операционной системой\n\nПредоставляет функции для взаимодействия с операционной системой, включая работу с файловой системой, переменными окружения и процессами.\n\n```python\nimport os\n\nos.getcwd()  # Текущая рабочая директория\nos.listdir(".")  # Список файлов в директории\nos.path.join("dir", "file")  # Объединение путей\nos.environ.get("PATH")  # Доступ к переменным окружения\n```',
  'sys': '**sys** - Системный модуль\n\nПредоставляет доступ к переменным и функциям, взаимодействующим с интерпретатором Python.\n\n```python\nimport sys\n\nsys.argv  # Аргументы командной строки\nsys.exit(0)  # Завершение программы\nsys.path  # Пути для поиска модулей\nsys.version  # Версия Python\n```',
  'datetime': '**datetime** - Работа с датами и временем\n\nМодуль для работы с датами, временем и интервалами.\n\n```python\nfrom datetime import datetime, timedelta\n\nnow = datetime.now()  # Текущая дата и время\ndelta = timedelta(days=1)  # Интервал в 1 день\ntomorrow = now + delta  # Дата завтрашнего дня\n```',
  'math': '**math** - Математические функции\n\nПредоставляет доступ к математическим функциям из стандартной библиотеки C.\n\n```python\nimport math\n\nmath.sqrt(16)  # Квадратный корень (4.0)\nmath.pi  # Число π (3.141592...)\nmath.sin(math.radians(30))  # Синус 30 градусов\n```',
  'random': '**random** - Генерация случайных чисел\n\nМодуль для генерации псевдослучайных чисел.\n\n```python\nimport random\n\nrandom.random()  # Случайное число от 0 до 1\nrandom.randint(1, 10)  # Случайное целое от 1 до 10\nrandom.choice([\'apple\', \'banana\'])  # Случайный выбор из списка\n```',
  'json': '**json** - Работа с JSON-данными\n\nМодуль для кодирования и декодирования JSON.\n\n```python\nimport json\n\ndata = {\'name\': \'John\', \'age\': 30}\njson_str = json.dumps(data)  # Преобразование в JSON-строку\nparsed = json.loads(json_str)  # Разбор JSON-строки\n```',
  're': '**re** - Регулярные выражения\n\nМодуль для работы с регулярными выражениями.\n\n```python\nimport re\n\npattern = r\'\\d+\'  # Шаблон для поиска чисел\nre.search(pattern, \'abc123def\').group()  # Находит \'123\'\nre.findall(pattern, \'a1b2c3\')  # [\'1\', \'2\', \'3\']\n```',
  'collections': '**collections** - Специализированные типы коллекций\n\nПредоставляет альтернативы встроенным типам данных.\n\n```python\nfrom collections import Counter, defaultdict, namedtuple\n\nCounter(\'abracadabra\')  # Подсчет элементов\nd = defaultdict(list)  # Словарь со значениями по умолчанию\nPoint = namedtuple(\'Point\', [\'x\', \'y\'])  # Именованный кортеж\n```',
  'numpy': '**numpy** - Научные вычисления\n\nБиблиотека для работы с многомерными массивами и матрицами.\n\n```python\nimport numpy as np\n\narr = np.array([1, 2, 3])  # Создание массива\narr * 2  # Векторизированные операции\nnp.mean(arr)  # Среднее значение\n```',
  'pandas': '**pandas** - Анализ данных\n\nБиблиотека для анализа и обработки данных.\n\n```python\nimport pandas as pd\n\ndf = pd.DataFrame({\'A\': [1, 2], \'B\': [3, 4]})  # Создание таблицы данных\ndf.describe()  # Статистика данных\ndf[\'A\'].mean()  # Среднее по столбцу\n```',
  'requests': '**requests** - HTTP-запросы\n\nПростая библиотека для отправки HTTP-запросов.\n\n```python\nimport requests\n\nresponse = requests.get("https://api.example.com/data")\ndata = response.json()  # Получение данных в формате JSON\n```',
  'flask': '**flask** - Веб-фреймворк\n\nЛегковесный веб-фреймворк для Python.\n\n```python\nfrom flask import Flask, request\n\napp = Flask(__name__)\n\n@app.route("/")\ndef hello():\n    return "Hello, World!"\n```',
  'django': '**django** - Веб-фреймворк\n\nПолнофункциональный веб-фреймворк для Python.\n\n```python\n# В models.py\nfrom django.db import models\n\nclass Article(models.Model):\n    title = models.CharField(max_length=100)\n    content = models.TextField()\n```',
  'sqlite3': '**sqlite3** - База данных SQLite\n\nВстроенный модуль для работы с базами данных SQLite.\n\n```python\nimport sqlite3\n\nconn = sqlite3.connect("example.db")\ncursor = conn.cursor()\ncursor.execute("SELECT * FROM users")\n```',
  'pytest': '**pytest** - Тестирование\n\nФреймворк для написания и запуска тестов.\n\n```python\n# test_example.py\ndef test_function():\n    assert 1 + 1 == 2\n```',
  
  // Дополнительные модули
  'time': '**time** - Работа со временем\n\nМодуль для работы с временем и задержками.\n\n```python\nimport time\n\ntime.time()  # Текущее время в секундах с начала эпохи\ntime.sleep(1)  # Задержка выполнения на 1 секунду\ntime.strftime("%Y-%m-%d %H:%M:%S")  # Форматирование текущего времени\n```',
  'os.path': '**os.path** - Операции с путями файлов\n\nМодуль для манипуляций с путями файлов.\n\n```python\nimport os.path\n\nos.path.join("dir", "file.txt")  # Объединение путей\nos.path.exists("file.txt")  # Проверка существования файла\nos.path.basename("/path/to/file.txt")  # Получение имени файла\nos.path.dirname("/path/to/file.txt")  # Получение пути к директории\n```',
  'pathlib': '**pathlib** - Объектно-ориентированная работа с путями\n\nМодуль для работы с путями файловой системы как с объектами.\n\n```python\nfrom pathlib import Path\n\np = Path("file.txt")\np.exists()  # Проверка существования файла\np.parent  # Родительская директория\np.suffix  # Расширение файла\n```',
  'shutil': '**shutil** - Операции с файлами и директориями\n\nМодуль для копирования и перемещения файлов и директорий.\n\n```python\nimport shutil\n\nshutil.copy("source.txt", "dest.txt")  # Копирование файла\nshutil.rmtree("dir")  # Удаление директории с содержимым\nshutil.move("source.txt", "dest.txt")  # Перемещение файла\n```',
  'glob': '**glob** - Поиск файлов по шаблону\n\nМодуль для поиска файлов по шаблону пути.\n\n```python\nimport glob\n\nglob.glob("*.txt")  # Все файлы с расширением .txt\nglob.glob("**/*.py", recursive=True)  # Все .py файлы рекурсивно\n```',
  'argparse': '**argparse** - Разбор аргументов командной строки\n\nМодуль для создания удобных интерфейсов командной строки.\n\n```python\nimport argparse\n\nparser = argparse.ArgumentParser()\nparser.add_argument("--file", help="Путь к файлу")\nargs = parser.parse_args()\n```',
  'logging': '**logging** - Ведение журнала\n\nМодуль для гибкого ведения журнала в приложениях.\n\n```python\nimport logging\n\nlogging.basicConfig(level=logging.INFO)\nlogging.info("Информационное сообщение")\nlogging.error("Ошибка: %s", "что-то пошло не так")\n```',
  'csv': '**csv** - Работа с CSV-файлами\n\nМодуль для чтения и записи CSV-файлов.\n\n```python\nimport csv\n\nwith open("data.csv", "r") as f:\n    reader = csv.reader(f)\n    for row in reader:\n        print(row)\n```',
  'xml': '**xml** - Работа с XML\n\nМодуль для обработки XML-документов.\n\n```python\nimport xml.etree.ElementTree as ET\n\ntree = ET.parse("data.xml")\nroot = tree.getroot()\nfor child in root:\n    print(child.tag, child.attrib)\n```',
  'html': '**html** - Работа с HTML\n\nМодуль для обработки HTML-кода.\n\n```python\nimport html\n\nescaped = html.escape("<script>alert(\'XSS\')</script>")\nprint(escaped)  # &lt;script&gt;alert(\'XSS\')&lt;/script&gt;\n```',
  'urllib': '**urllib** - URL обработка\n\nМодуль для работы с URL и HTTP-запросами.\n\n```python\nfrom urllib.request import urlopen\n\nwith urlopen("https://python.org") as response:\n    html = response.read()\n```',
  'socket': '**socket** - Сетевое программирование\n\nМодуль для сетевого взаимодействия на уровне сокетов.\n\n```python\nimport socket\n\ns = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\ns.connect(("example.com", 80))\ns.send(b"GET / HTTP/1.0\\r\\n\\r\\n")\n```',
  'threading': '**threading** - Многопоточность\n\nМодуль для работы с потоками.\n\n```python\nimport threading\n\ndef worker():\n    print("Работа в потоке")\n\nt = threading.Thread(target=worker)\nt.start()\n```',
  'multiprocessing': '**multiprocessing** - Многопроцессность\n\nМодуль для параллельного выполнения кода с использованием процессов.\n\n```python\nfrom multiprocessing import Process\n\ndef worker():\n    print("Работа в отдельном процессе")\n\np = Process(target=worker)\np.start()\n```',
  'subprocess': '**subprocess** - Запуск подпроцессов\n\nМодуль для запуска новых процессов и взаимодействия с ними.\n\n```python\nimport subprocess\n\nresult = subprocess.run(["ls", "-l"], capture_output=True, text=True)\nprint(result.stdout)\n```',
  'asyncio': '**asyncio** - Асинхронное программирование\n\nМодуль для написания асинхронного кода с использованием синтаксиса async/await.\n\n```python\nimport asyncio\n\nasync def main():\n    await asyncio.sleep(1)\n    print("Готово!")\n\nasyncio.run(main())\n```',
  'typing': '**typing** - Аннотации типов\n\nМодуль для поддержки аннотаций типов.\n\n```python\nfrom typing import List, Dict, Optional\n\ndef greet(name: str) -> str:\n    return f"Hello, {name}"\n\nnames: List[str] = ["Alice", "Bob"]\n```',
  'io': '**io** - Потоки ввода-вывода\n\nМодуль для работы с различными типами потоков ввода-вывода.\n\n```python\nimport io\n\nf = io.StringIO("some text")\nprint(f.read())  # "some text"\n```',
  'tempfile': '**tempfile** - Временные файлы и директории\n\nМодуль для создания временных файлов и директорий.\n\n```python\nimport tempfile\n\nwith tempfile.TemporaryFile() as f:\n    f.write(b"Some data")\n    f.seek(0)\n    print(f.read())  # b"Some data"\n```',
  'itertools': '**itertools** - Функции для эффективной работы с итераторами\n\nМодуль с функциями для создания итераторов для эффективных циклов.\n\n```python\nimport itertools\n\nfor i in itertools.count(10, 2):  # 10, 12, 14, ...\n    if i > 20: break\n    print(i)\n\nlist(itertools.permutations([1, 2, 3]))  # Все перестановки\n```',
  'functools': '**functools** - Функции высшего порядка\n\nМодуль с инструментами для работы с функциями и вызываемыми объектами.\n\n```python\nfrom functools import lru_cache, partial\n\n@lru_cache(maxsize=None)\ndef fibonacci(n):\n    if n < 2: return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nadd5 = partial(lambda x, y: x + y, 5)  # Частичное применение функции\n```',
  'pickle': '**pickle** - Сериализация объектов Python\n\nМодуль для сериализации и десериализации объектов Python.\n\n```python\nimport pickle\n\ndata = {"key": "value"}\n# Сериализация\nwith open("data.pickle", "wb") as f:\n    pickle.dump(data, f)\n# Десериализация\nwith open("data.pickle", "rb") as f:\n    loaded_data = pickle.load(f)\n```',
  'hashlib': '**hashlib** - Хеш-функции\n\nМодуль для вычисления криптографических хеш-функций.\n\n```python\nimport hashlib\n\nm = hashlib.md5()\nm.update(b"Hello, world!")\nprint(m.hexdigest())  # Хеш MD5\n```',
  'base64': '**base64** - Кодирование Base64\n\nМодуль для кодирования и декодирования в Base64.\n\n```python\nimport base64\n\nencoded = base64.b64encode(b"Hello").decode("utf-8")  # "SGVsbG8="\ndecoded = base64.b64decode("SGVsbG8=")  # b"Hello"\n```',
  'zipfile': '**zipfile** - Работа с ZIP-архивами\n\nМодуль для создания и чтения ZIP-архивов.\n\n```python\nimport zipfile\n\nwith zipfile.ZipFile("archive.zip", "w") as zf:\n    zf.write("file.txt")\n\nwith zipfile.ZipFile("archive.zip", "r") as zf:\n    zf.extractall("output_dir")\n```',
  'email': '**email** - Работа с электронной почтой\n\nМодуль для создания и парсинга сообщений электронной почты.\n\n```python\nfrom email.message import EmailMessage\n\nmsg = EmailMessage()\nmsg["Subject"] = "Hello"\nmsg["From"] = "user@example.com"\nmsg["To"] = "recipient@example.com"\nmsg.set_content("This is a test email")\n```',
  'unittest': '**unittest** - Модульное тестирование\n\nМодуль для написания и запуска тестов.\n\n```python\nimport unittest\n\nclass TestExample(unittest.TestCase):\n    def test_addition(self):\n        self.assertEqual(1 + 1, 2)\n\nif __name__ == "__main__":\n    unittest.main()\n```',
  'pdb': '**pdb** - Отладчик Python\n\nИнтерактивный отладчик для Python программ.\n\n```python\nimport pdb\n\ndef buggy_function():\n    x = 1\n    y = 0\n    pdb.set_trace()  # Точка останова, запускает отладчик\n    return x / y\n```'
};