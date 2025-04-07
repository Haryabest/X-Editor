/**
 * Регистрация поддержки Python в Monaco Editor
 */

import * as monaco from 'monaco-editor';
import { 
  initializePythonLSP, 
  updateAllPythonDiagnostics, 
  isPythonLSPConnected, 
  forcePythonDiagnosticsUpdate,
  clearAllPythonDiagnostics,
  isPythonDiagnosticsAvailable
} from '../main-screen/centerContainer/python-lsp-starter';

/**
 * Регистрирует поддержку Python в Monaco Editor через LSP
 * @returns Успешность регистрации
 */
export function registerPython(): boolean {
  try {
    console.log('Регистрация поддержки Python...');
    
    // Проверяем наличие Monaco
    if (!window.monaco) {
      console.error('Monaco не определен. Невозможно зарегистрировать поддержку Python.');
      return false;
    }
    
    const monaco = window.monaco;
    
    // Регистрируем язык Python, если еще не зарегистрирован
    const languages = monaco.languages.getLanguages();
    const pythonRegistered = languages.some((lang: { id: string }) => lang.id === 'python');
    
    if (!pythonRegistered) {
      // Регистрируем язык Python
      monaco.languages.register({
        id: 'python',
        extensions: ['.py', '.pyw', '.pyi'],
        aliases: ['Python', 'python'],
        mimetypes: ['text/x-python', 'text/python'],
      });
      console.log('Python язык зарегистрирован в Monaco');
    }
    
    // Задаем конфигурацию языка
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
        { open: '\'', close: '\'', notIn: ['string', 'comment'] },
        { open: '"""', close: '"""', notIn: ['string'] },
        { open: '\'\'\'', close: '\'\'\'', notIn: ['string'] },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
      onEnterRules: [
        {
          beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async|match|case).*?:\s*$/,
          action: { indentAction: monaco.languages.IndentAction.Indent }
        }
      ],
      folding: {
        offSide: true,
        markers: {
          start: /^\s*#\s*region\b/,
          end: /^\s*#\s*endregion\b/
        }
      }
    });
    
    // Создаем глобальный объект для отслеживания диагностики Python
    try {
      // Создаем хранилище для диагностических маркеров
      if (!(window as any).pythonDiagnosticsStore) {
        (window as any).pythonDiagnosticsStore = {
          markers: new Map(),
          setMarkers: function(uri: string, markers: any[]) {
            this.markers.set(uri, markers);
            try {
              if (window.monaco) {
                const monacoUri = window.monaco.Uri.parse(uri);
                // Используем стандартный метод setModelMarkers вместо createDiagnosticsCollection
                window.monaco.editor.setModelMarkers(
                  window.monaco.editor.getModel(monacoUri) || { uri: monacoUri },
                  'python',
                  markers
                );
              }
            } catch (e) {
              console.error('Ошибка при установке маркеров Python:', e);
            }
          },
          clearMarkers: function(uri: string) {
            if (uri) {
              this.markers.delete(uri);
              try {
                if (window.monaco) {
                  const monacoUri = window.monaco.Uri.parse(uri);
                  window.monaco.editor.setModelMarkers(
                    window.monaco.editor.getModel(monacoUri) || { uri: monacoUri },
                    'python',
                    []
                  );
                }
              } catch (e) {
                console.error('Ошибка при очистке маркеров Python:', e);
              }
            }
          },
          clearAllMarkers: function() {
            this.markers.clear();
            try {
              if (window.monaco) {
                const models = window.monaco.editor.getModels();
                for (const model of models) {
                  if (model.getLanguageId() === 'python') {
                    window.monaco.editor.setModelMarkers(model, 'python', []);
                  }
                }
              }
            } catch (e) {
              console.error('Ошибка при очистке всех маркеров Python:', e);
            }
          }
        };
        console.log('Создано хранилище диагностики для Python');
      }
    } catch (error) {
      console.error('Ошибка при создании хранилища диагностики Python:', error);
    }
    
    // Определяем токены подсветки синтаксиса
    monaco.languages.setMonarchTokensProvider('python', {
      defaultToken: '',
      tokenPostfix: '.python',
      
      keywords: [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
        'def', 'del', 'elif', 'else', 'except', 'exec', 'finally', 'for', 'from',
        'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
        'pass', 'print', 'raise', 'return', 'try', 'while', 'with', 'yield',
        'match', 'case', 'type'
      ],
      
      builtins: [
        'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'callable',
        'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir',
        'divmod', 'enumerate', 'eval', 'filter', 'float', 'format', 'frozenset',
        'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input',
        'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
        'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow',
        'print', 'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr',
        'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple', 'type',
        'vars', 'zip', '__import__'
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
          
          [/[,:;]/, 'delimiter'],
          [/[{}\[\]()]/, '@brackets'],
          
          [/@[a-zA-Z_]\w*/, 'tag'],
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@builtins': 'type.identifier',
              '@default': 'identifier'
            }
          }]
        ],
        
        whitespace: [
          [/\s+/, 'white'],
          [/(^#.*$)/, 'comment'],
          [/'''/, 'string', '@endDocString'],
          [/"""/, 'string', '@endDblDocString']
        ],
        
        numbers: [
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/\d+/, 'number']
        ],
        
        strings: [
          [/'/, 'string', '@singleString'],
          [/"/, 'string', '@doubleString'],
        ],
        
        singleString: [
          [/[^']+/, 'string'],
          [/''/, 'string.escape'],
          [/'/, 'string', '@pop']
        ],
        
        doubleString: [
          [/[^"]+/, 'string'],
          [/""/, 'string.escape'],
          [/"/, 'string', '@pop']
        ],
        
        endDocString: [
          [/[^']+/, 'string'],
          [/\\'/, 'string'],
          [/'''/, 'string', '@pop'],
          [/'/, 'string']
        ],
        
        endDblDocString: [
          [/[^"]+/, 'string'],
          [/\\"/, 'string'],
          [/"""/, 'string', '@pop'],
          [/"/, 'string']
        ],
      }
    });
    
    // Регистрируем глобальную функцию для управления диагностикой Python
    (window as any).updatePythonDiagnostics = async (filepath?: string): Promise<string> => {
      console.log(`Запрос на обновление диагностики Python ${filepath ? `для файла ${filepath}` : 'для всех файлов'}`);
      
      try {
        // Если LSP еще не подключен, инициализируем его с принудительными повторными попытками
        if (!isPythonLSPConnected()) {
          console.log('Python LSP не подключен, инициализация...');
          
          // Попытка инициализации с повторами
          let tryCount = 0;
          let initialized = false;
          
          while (tryCount < 3 && !initialized) {
            tryCount++;
            console.log(`Попытка инициализации Python LSP: ${tryCount}/3`);
            
            initialized = await initializePythonLSP();
            
            if (!initialized && tryCount < 3) {
              console.log(`Ожидание перед следующей попыткой...`);
              // Ждем перед следующей попыткой
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!initialized) {
            console.error('Не удалось инициализировать Python LSP после нескольких попыток');
            return 'error: Не удалось инициализировать LSP';
          }
          
          console.log('Python LSP успешно инициализирован');
        }
        
        // Проверяем доступность диагностики
        if (!isPythonDiagnosticsAvailable()) {
          console.warn('Диагностика Python недоступна');
        }
        
        // Обновляем диагностику
        if (filepath) {
          // Для конкретного файла
          console.log(`Обновление диагностики для файла: ${filepath}`);
          const success = await forcePythonDiagnosticsUpdate(filepath);
          
          if (success) {
            console.log(`Диагностика успешно обновлена для: ${filepath}`);
            return `success: ${filepath}`;
          } else {
            console.warn(`Не удалось обновить диагностику для: ${filepath}`);
            return `error: ${filepath}`;
          }
        } else {
          // Для всех файлов
          console.log('Обновление диагностики для всех Python файлов');
          const success = await updateAllPythonDiagnostics();
          
          if (success) {
            console.log('Диагностика успешно обновлена для всех файлов');
            return 'success: all files';
          } else {
            console.warn('Не удалось обновить диагностику для всех файлов');
            return 'error: all files';
          }
        }
      } catch (error: any) {
        console.error('Ошибка при обновлении диагностики Python:', error);
        return `error: ${error.message || 'Неизвестная ошибка'}`;
      }
    };
    
    // Инициализируем Python LSP при запуске
    setTimeout(async () => {
      try {
        console.log('Автоматическая инициализация Python LSP...');
        
        // Инициализируем Python LSP
        const lspInitialized = await initializePythonLSP();
        
        if (lspInitialized) {
          console.log('Python LSP успешно инициализирован автоматически');
          
          // Регистрируем обработчик для очистки диагностики при закрытии
          window.addEventListener('beforeunload', () => {
            console.log('Очистка ресурсов Python LSP...');
            clearAllPythonDiagnostics();
          });
          
          // Обновляем диагностику для всех открытых Python файлов
          setTimeout(async () => {
            await updateAllPythonDiagnostics();
          }, 2000);
        } else {
          console.warn('Не удалось автоматически инициализировать Python LSP');
          
          // Повторяем попытку инициализации еще раз через 3 секунды
          setTimeout(async () => {
            console.log('Повторная попытка инициализации Python LSP...');
            const retryResult = await initializePythonLSP();
            
            if (retryResult) {
              console.log('Python LSP успешно инициализирован при повторной попытке');
              
              setTimeout(async () => {
                await updateAllPythonDiagnostics();
              }, 1000);
            } else {
              console.error('Python LSP не удалось инициализировать даже при повторной попытке');
            }
          }, 3000);
        }
      } catch (error) {
        console.error('Ошибка при автоматической инициализации Python LSP:', error);
      }
    }, 1000);
    
    // Регистрируем провайдер автодополнений для Python
    monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', ':', '(', '[', ',', ' '],
      provideCompletionItems: async (model: monaco.editor.ITextModel, position: monaco.Position) => {
        try {
          // Проверяем, подключен ли LSP
          if (!isPythonLSPConnected()) {
            console.warn('Python LSP не подключен, базовое автодополнение');
            return getBasicCompletionItems();
          }
          
          // Получаем данные из редактора
          const uri = model.uri.toString();
          const lineContent = model.getLineContent(position.lineNumber);
          
          // Логируем запрос автодополнения
          console.log(`Python completion request: line ${position.lineNumber}, col ${position.column}, содержимое строки: "${lineContent.slice(0, position.column)}"`);
          
          // Запрашиваем автодополнение у LSP
          try {
            // Импортируем менеджер LSP серверов
            const { languageServerManager } = await import('../main-screen/centerContainer/monaco-lsp-server-manager');
            
            // Определяем триггер запроса
            const triggerChar = determineTriggerCharacter(lineContent, position.column);
            
            // Формируем запрос LSP
            const completionParams = {
              textDocument: { uri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1
              },
              context: {
                triggerKind: triggerChar ? 2 : 1, // 1 = Invoke, 2 = TriggerCharacter
                triggerCharacter: triggerChar
              }
            };
            
            // Отправляем запрос к LSP
            console.log('Отправка запроса автодополнения к Python LSP:', completionParams);
            const completionResponse = await languageServerManager.sendRequest('python', 'textDocument/completion', completionParams);
            
            // Обрабатываем ответ
            if (completionResponse && completionResponse.items && completionResponse.items.length > 0) {
              console.log(`Получено ${completionResponse.items.length} предложений автодополнения от Python LSP`);
              
              // Преобразуем ответ LSP в формат Monaco
              const suggestions = completionResponse.items.map((item: any) => {
                try {
                  // Базовое преобразование
                  const suggestion: monaco.languages.CompletionItem = {
                    label: item.label,
                    kind: convertCompletionItemKind(item.kind || 1),
                    detail: item.detail,
                    documentation: item.documentation
                      ? (typeof item.documentation === 'string'
                         ? item.documentation
                         : item.documentation.value)
                      : undefined,
                    insertText: item.insertText || item.label,
                    sortText: item.sortText,
                    filterText: item.filterText,
                    range: {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: position.column - (item.textEdit?.range?.startColumn || 0),
                      endColumn: position.column
                    }
                  };
                  
                  // Если это сниппет
                  if (item.insertTextFormat === 2) {
                    suggestion.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
                  }
                  
                  return suggestion;
                } catch (itemError) {
                  console.warn('Ошибка при преобразовании элемента автодополнения:', itemError);
                  return {
                    label: item.label || 'unknown',
                    kind: monaco.languages.CompletionItemKind.Text
                  };
                }
              });
              
              return { suggestions };
            } else {
              console.log('От Python LSP не получено предложений автодополнения, используем базовые');
            }
          } catch (lspError) {
            console.warn('Ошибка при получении автодополнения от LSP:', lspError);
          }
          
          // Если не получили автодополнение от LSP, используем базовое
          return getBasicCompletionItems();
        } catch (error) {
          console.error('Ошибка в провайдере автодополнений Python:', error);
          return { suggestions: [] };
        }
      }
    });
    
    // Регистрируем провайдер hover для Python
    monaco.languages.registerHoverProvider('python', {
      provideHover: async (model: monaco.editor.ITextModel, position: monaco.Position) => {
        try {
          // Проверяем, подключен ли LSP
          if (!isPythonLSPConnected()) {
            return getBasicHoverContent(model, position);
          }
          
          // Получаем данные из редактора
          const uri = model.uri.toString();
          const wordInfo = model.getWordAtPosition(position);
          
          if (!wordInfo) {
            return null;
          }
          
          // Импортируем менеджер LSP серверов
          const { languageServerManager } = await import('../main-screen/centerContainer/monaco-lsp-server-manager');
          
          // Запрашиваем hover у LSP
          try {
            const hoverResponse = await languageServerManager.sendRequest('python', 'textDocument/hover', {
              textDocument: { uri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1
              }
            });
            
            if (hoverResponse && hoverResponse.contents) {
              // Преобразуем ответ LSP в формат Monaco
              let content = '';
              
              // Обрабатываем различные форматы содержимого из LSP
              if (typeof hoverResponse.contents === 'string') {
                content = hoverResponse.contents;
              } else if (hoverResponse.contents.kind === 'markdown' || hoverResponse.contents.kind === 'plaintext') {
                content = hoverResponse.contents.value;
              } else if (Array.isArray(hoverResponse.contents)) {
                // Объединяем массив содержимого
                content = hoverResponse.contents.map((item: any) => {
                  if (typeof item === 'string') {
                    return item;
                  } else if (item.value) {
                    return item.value;
                  }
                  return '';
                }).join('\n\n');
              } else if (hoverResponse.contents.value) {
                content = hoverResponse.contents.value;
              }
              
              // Формируем результат hover
              return {
                contents: [{ value: content }],
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: wordInfo.startColumn,
                  endLineNumber: position.lineNumber,
                  endColumn: wordInfo.endColumn
                }
              };
            }
          } catch (lspError) {
            console.warn('Ошибка при получении hover от LSP:', lspError);
          }
          
          // Если не получили hover от LSP, используем базовый
          return getBasicHoverContent(model, position);
        } catch (error) {
          console.error('Ошибка в провайдере hover для Python:', error);
          return null;
        }
      }
    });
    
    console.log('Регистрация Python в Monaco успешно завершена');
    return true;
  } catch (error) {
    console.error('Ошибка при регистрации Python:', error);
    return false;
  }
}

/**
 * Получение базовых элементов автодополнения для Python
 */
function getBasicCompletionItems(): { suggestions: monaco.languages.CompletionItem[] } {
  try {
    if (!window.monaco) {
      console.warn('Monaco не определен при создании базовых элементов автодополнения');
      return { suggestions: [] };
    }
    
    const monaco = window.monaco;
    const suggestions: monaco.languages.CompletionItem[] = [];
    
    // Базовые ключевые слова Python
    const pythonKeywords = [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
      'def', 'del', 'elif', 'else', 'except', 'exec', 'finally', 'for', 'from',
      'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
      'pass', 'print', 'raise', 'return', 'try', 'while', 'with', 'yield',
      'match', 'case', 'True', 'False', 'None'
    ];
    
    // Базовые встроенные функции Python
    const builtinFunctions = [
      'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'callable',
      'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir',
      'divmod', 'enumerate', 'eval', 'filter', 'float', 'format', 'frozenset',
      'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input',
      'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map',
      'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow',
      'print', 'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr',
      'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple', 'type',
      'vars', 'zip'
    ];
    
    // Добавляем ключевые слова
    for (const keyword of pythonKeywords) {
      suggestions.push({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        detail: 'Ключевое слово Python'
      } as monaco.languages.CompletionItem);
    }
    
    // Добавляем встроенные функции
    for (const func of builtinFunctions) {
      suggestions.push({
        label: func,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: func + '($0)',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Встроенная функция Python'
      } as monaco.languages.CompletionItem);
    }
    
    return { suggestions };
  } catch (error) {
    console.error('Ошибка при создании базовых элементов автодополнения:', error);
    return { suggestions: [] };
  }
}

/**
 * Определение символа-триггера для запроса автодополнения
 */
function determineTriggerCharacter(lineContent: string, column: number): string | undefined {
  try {
    if (column <= 1 || !lineContent || column > lineContent.length) {
      return undefined;
    }
    
    const triggerChars = ['.', ':', '(', '[', ',', ' '];
    const prevChar = lineContent.charAt(column - 2);
    
    if (triggerChars.includes(prevChar)) {
      return prevChar;
    }
    
    return undefined;
  } catch (error) {
    console.error('Ошибка при определении символа-триггера:', error);
    return undefined;
  }
}

/**
 * Преобразование типа элемента автодополнения из LSP в Monaco
 */
function convertCompletionItemKind(lspKind: number): monaco.languages.CompletionItemKind {
  try {
    if (!window.monaco) {
      return 0; // Значение по умолчанию
    }
    
    const monaco = window.monaco;
    
    // Соответствие типов LSP и Monaco
    // См. https://microsoft.github.io/language-server-protocol/specifications/specification-current/#completionItemKind
    switch (lspKind) {
      case 1: return monaco.languages.CompletionItemKind.Text;
      case 2: return monaco.languages.CompletionItemKind.Method;
      case 3: return monaco.languages.CompletionItemKind.Function;
      case 4: return monaco.languages.CompletionItemKind.Constructor;
      case 5: return monaco.languages.CompletionItemKind.Field;
      case 6: return monaco.languages.CompletionItemKind.Variable;
      case 7: return monaco.languages.CompletionItemKind.Class;
      case 8: return monaco.languages.CompletionItemKind.Interface;
      case 9: return monaco.languages.CompletionItemKind.Module;
      case 10: return monaco.languages.CompletionItemKind.Property;
      case 11: return monaco.languages.CompletionItemKind.Unit;
      case 12: return monaco.languages.CompletionItemKind.Value;
      case 13: return monaco.languages.CompletionItemKind.Enum;
      case 14: return monaco.languages.CompletionItemKind.Keyword;
      case 15: return monaco.languages.CompletionItemKind.Snippet;
      case 16: return monaco.languages.CompletionItemKind.Color;
      case 17: return monaco.languages.CompletionItemKind.File;
      case 18: return monaco.languages.CompletionItemKind.Reference;
      case 19: return monaco.languages.CompletionItemKind.Folder;
      case 20: return monaco.languages.CompletionItemKind.EnumMember;
      case 21: return monaco.languages.CompletionItemKind.Constant;
      case 22: return monaco.languages.CompletionItemKind.Struct;
      case 23: return monaco.languages.CompletionItemKind.Event;
      case 24: return monaco.languages.CompletionItemKind.Operator;
      case 25: return monaco.languages.CompletionItemKind.TypeParameter;
      default: return monaco.languages.CompletionItemKind.Text;
    }
  } catch (error) {
    console.error('Ошибка при преобразовании типа элемента автодополнения:', error);
    return window.monaco.languages.CompletionItemKind.Text;
  }
}

/**
 * Получение базового содержимого для hover
 */
function getBasicHoverContent(model: monaco.editor.ITextModel, position: monaco.Position): monaco.languages.Hover | null {
  try {
    if (!window.monaco) {
      console.warn('Monaco не определен при создании базового hover содержимого');
      return null;
    }
    
    const wordInfo = model.getWordAtPosition(position);
    if (!wordInfo) {
      return null;
    }
    
    const word = wordInfo.word;
    
    // Получаем контекст строки
    const lineContent = model.getLineContent(position.lineNumber);
    
    // Определяем тип элемента по контексту
    let elementType = 'unknown';
    if (lineContent.includes('def ' + word)) {
      elementType = 'function';
    } else if (lineContent.includes('class ' + word)) {
      elementType = 'class';
    } else if (/\b(True|False|None)\b/.test(word)) {
      elementType = 'constant';
    } else if (lineContent.match(new RegExp(`\\b${word}\\s*=`))) {
      elementType = 'variable';
    }
    
    // Формируем содержимое hover
    let content = `**${word}**\n\n`;
    switch (elementType) {
      case 'function':
        content += `Функция\n\n\`\`\`python\ndef ${word}():\n    pass\n\`\`\``;
        break;
      case 'class':
        content += `Класс\n\n\`\`\`python\nclass ${word}:\n    pass\n\`\`\``;
        break;
      case 'constant':
        if (word === 'True' || word === 'False') {
          content += `Константа (логическое значение)`;
        } else if (word === 'None') {
          content += `Константа (отсутствие значения)`;
        } else {
          content += `Константа`;
        }
        break;
      case 'variable':
        content += `Переменная`;
        break;
      default:
        content += `Идентификатор Python\n\nСтрока: ${position.lineNumber}\nПозиция: ${position.column}`;
    }
    
    return {
      contents: [{ value: content }],
      range: {
        startLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: wordInfo.endColumn
      }
    };
  } catch (error) {
    console.error('Ошибка при создании базового hover содержимого:', error);
    return null;
  }
}