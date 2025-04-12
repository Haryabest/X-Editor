/**
 * Регистрация поддержки Python в Monaco Editor
 */

import * as monaco from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';
import { 
  updateAllPythonDiagnostics, 
  isPythonLSPConnected, 
  forcePythonDiagnosticsUpdate,
  clearAllPythonDiagnostics
} from '../main-screen/centerContainer/python-lsp-starter';
import { MonacoLSPDiagnostics } from '../main-screen/centerContainer/monaco-lsp-diagnostics';
import { loadPylanceFromCDN, PylanceAPI } from './pylance-loader';

// Интерфейс для pip пакетов
interface PipPackage {
  name: string;
  version: string;
}

// Кэш pip пакетов
let pipPackagesCache: PipPackage[] = [];
let pipPackagesLoaded = false;

/**
 * Загружает список установленных pip пакетов
 */
async function loadPipPackages(): Promise<PipPackage[]> {
  if (pipPackagesLoaded && pipPackagesCache.length > 0) {
    return pipPackagesCache;
  }

  try {
    console.log('Загрузка установленных pip пакетов...');
    const packages = await invoke<PipPackage[]>('get_pip_packages');
    pipPackagesCache = packages;
    pipPackagesLoaded = true;
    console.log(`Загружено ${packages.length} pip пакетов`);
    return packages;
  } catch (error) {
    console.error('Ошибка при загрузке pip пакетов:', error);
    return [];
  }
}

/**
 * Регистрирует поддержку Python в Monaco Editor, используя встроенный анализатор или Pylance
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
    
    // Пытаемся загрузить Pylance для улучшенного опыта
    initializePylance().catch(err => {
      console.warn('Не удалось инициализировать Pylance, используем встроенный анализатор:', err);
      
      // Если Pylance не загрузился, используем встроенное автодополнение
      setupBuiltinPythonSupport(monaco);
    });
    
    // Предзагружаем pip пакеты для автодополнения
    loadPipPackages().catch(err => console.error('Ошибка при предзагрузке pip пакетов:', err));
    
    // Создаем объект для хранения диагностики, если его еще нет
    if (!(window as any).pythonDiagnosticsStore) {
      console.log('Создание хранилища диагностики Python...');
      const store = new MonacoLSPDiagnostics();
      store.initialize(monaco);
      (window as any).pythonDiagnosticsStore = store;
      
      // Глобальная функция для доступа к маркерам Python
      (window as any).getPythonDiagnostics = () => {
        if ((window as any).pythonDiagnosticsStore && 
            typeof (window as any).pythonDiagnosticsStore.getAllMarkersForUI === 'function') {
          return (window as any).pythonDiagnosticsStore.getAllMarkersForUI();
        }
        return [];
      };
    }

    // Добавляем глобальные функции для работы с диагностикой Python
    (window as any).updatePythonDiagnostics = async (filePath: string) => {
      try {
        console.log('Обновление встроенной диагностики Python для файла:', filePath);
        
        // Получаем содержимое файла из Monaco, если есть модель
        let content = '';
        
        if (monaco && monaco.editor) {
          try {
            const models = monaco.editor.getModels();
            const model = models.find((model: any) => {
              const modelPath = model.uri.path;
              return modelPath === filePath || 
                     modelPath.endsWith(filePath) || 
                     model.uri.toString().includes(filePath);
            });
            
            if (model) {
              content = model.getValue();
            }
          } catch (err) {
            console.warn('Ошибка при получении содержимого из модели Monaco:', err);
          }
        }
        
        // Если не удалось получить из Monaco, пробуем через Tauri
        if (!content) {
          try {
            content = await invoke('read_file', { path: filePath }) as string;
          } catch (err) {
            console.error('Ошибка при чтении файла через Tauri:', err);
            return `error: Не удалось прочитать файл ${filePath}`;
          }
        }
        
        if (!content) {
          return `error: Пустое содержимое файла ${filePath}`;
        }
        
        // Импортируем менеджер для доступа к mockPythonDiagnostics
        const { languageServerManager } = await import('../main-screen/centerContainer/monaco-lsp-server-manager');
        
        // Вызываем метод для диагностики
        if (languageServerManager) {
          languageServerManager.sendNotification('python', 'textDocument/didOpen', {
            textDocument: {
              uri: filePath,
              languageId: 'python',
              version: 1,
              text: content
            }
          });
          
          return 'success';
        } else {
          console.error('Менеджер серверов не доступен');
          return 'error: Менеджер серверов не доступен';
        }
      } catch (error) {
        console.error('Ошибка при обновлении диагностики Python:', error);
        return `error: ${error}`;
      }
    };
    
    // Оставляем только проверку встроенным анализатором без LSP сервера
    setTimeout(async () => {
      try {
        // Регистрируем обработчик для очистки диагностики при закрытии
        window.addEventListener('beforeunload', () => {
          console.log('Очистка ресурсов Python диагностики...');
          clearAllPythonDiagnostics();
        });
      } catch (error) {
        console.error('Ошибка при настройке обработчиков Python диагностики:', error);
      }
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('Ошибка при регистрации поддержки Python:', error);
    return false;
  }
}

/**
 * Настройка встроенной поддержки Python без Pylance
 */
function setupBuiltinPythonSupport(monaco: any) {
  try {
    // Определяем python стандартную библиотеку
    const pythonStdlibKeywords = [
      // Builtin Functions
      'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'breakpoint', 'bytearray', 'bytes', 
      'callable', 'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir', 
      'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format', 'frozenset', 
      'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int', 
      'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map', 'max', 'memoryview', 
      'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print', 'property', 'range', 
      'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted', 'staticmethod', 
      'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip', '__import__',
      
      // Common Modules
      'os', 'sys', 'io', 're', 'math', 'json', 'time', 'datetime', 'random', 'collections',
      'itertools', 'functools', 'pathlib', 'shutil', 'tempfile', 'urllib', 'http', 'socket',
      'argparse', 'logging', 'unittest', 'typing', 'csv', 'pickle', 'sqlite3', 'xml',
      'email', 'hashlib', 'base64'
    ];
    
    // Создаем автоматическое дополнение для модулей (используется в getPythonCompletions)
    const pythonModuleHints = pythonStdlibKeywords.map(keyword => ({
      label: keyword,
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: keyword,
      detail: 'Python Built-in/Standard Library',
      documentation: { value: `Python стандартный модуль или встроенная функция: **${keyword}**` }
    }));
    
    // Регистрируем провайдер автодополнения
    monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', ':', '(', '[', ',', ' ', '"', "'"],
      provideCompletionItems: (model: any, position: any) => {
        return getPythonCompletions(model, position, monaco, pythonModuleHints);
      }
    });
  } catch (error) {
    console.error('Ошибка при настройке встроенной поддержки Python:', error);
  }
}

/**
 * Инициализация Pylance для улучшенного анализа Python
 */
async function initializePylance(): Promise<boolean> {
  try {
    console.log('Инициализация Pylance...');
    
    // Загружаем Pylance из CDN
    const pylance = await loadPylanceFromCDN();
    
    if (!pylance) {
      console.warn('Не удалось загрузить Pylance из CDN');
      return false;
    }
    
    console.log('Pylance успешно загружен, настраиваем для использования с Monaco');
    
    // Настраиваем провайдер для Python
    window.monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', ':', '(', '[', ',', ' ', '"', "'"],
      provideCompletionItems: async (model: any, position: any) => {
        try {
          // Pylance API для автодополнения
          if (pylance.provideCompletionItems) {
            const result = await pylance.provideCompletionItems(model, position);
            
            // Если Pylance не вернул результаты, используем встроенное автодополнение
            if (!result || !result.suggestions || result.suggestions.length === 0) {
              return getPythonCompletions(model, position, window.monaco, []);
            }
            
            return result;
          } else {
            return getPythonCompletions(model, position, window.monaco, []);
          }
        } catch (error) {
          console.error('Ошибка при получении автодополнений от Pylance:', error);
          return getPythonCompletions(model, position, window.monaco, []);
        }
      }
    });
    
    // Настраиваем ховеры
    window.monaco.languages.registerHoverProvider('python', {
      provideHover: async (model: any, position: any) => {
        try {
          return await pylance.provideHover(model, position);
        } catch (error) {
          console.error('Ошибка при получении hover от Pylance:', error);
          return null;
        }
      }
    });
    
    // Настраиваем определения
    window.monaco.languages.registerDefinitionProvider('python', {
      provideDefinition: async (model: any, position: any) => {
        try {
          return await pylance.provideDefinition(model, position);
        } catch (error) {
          console.error('Ошибка при получении определения от Pylance:', error);
          return null;
        }
      }
    });
    
    // Настраиваем диагностику
    pylance.onDiagnostics((uri: string, diagnostics: any[]) => {
      try {
        if ((window as any).pythonDiagnosticsStore) {
          (window as any).pythonDiagnosticsStore.setMarkers(uri, diagnostics);
        }
      } catch (error) {
        console.error('Ошибка при обработке диагностики Pylance:', error);
      }
    });
    
    console.log('Pylance успешно настроен');
    
    // Сохраняем глобальную ссылку на Pylance
    (window as any).pylance = pylance;
    
    return true;
  } catch (error) {
    console.error('Ошибка при инициализации Pylance:', error);
    return false;
  }
}

/**
 * Получение базовых автодополнений для Python (используется, если Pylance недоступен)
 */
function getPythonCompletions(model: any, position: any, monaco: any, moduleHints: any[]): any {
  try {
    // Получаем текущую линию и позицию
    const lineContent = model.getLineContent(position.lineNumber);
    const wordUntilPosition = model.getWordUntilPosition(position);
    
    // Базовое определение диапазона для замены
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: wordUntilPosition.startColumn,
      endColumn: wordUntilPosition.endColumn
    };
    
    // Проверяем, является ли это импортом
    const isImport = lineContent.trim().startsWith('import ') || 
                    lineContent.trim().startsWith('from ') ||
                    lineContent.includes(' import ');
    
    // Если это import, предлагаем pip пакеты и стандартные модули
    if (isImport) {
      // Собираем все предложения
      const suggestions = [...moduleHints];
      
      // Вернем только встроенные модули, pip-пакеты не будем загружать синхронно
      return { suggestions };
    }
    
    // Проверяем, является ли это обращением к методу объекта (после точки)
    const isDotAccess = lineContent.substring(0, position.column - 1).endsWith('.');
    
    if (isDotAccess) {
      // Получаем текст до точки
      const beforeDot = lineContent.substring(0, position.column - 1).trim();
      const lastDotIndex = beforeDot.lastIndexOf('.');
      const lastWordStart = Math.max(
        beforeDot.lastIndexOf(' '), 
        beforeDot.lastIndexOf('('),
        beforeDot.lastIndexOf('['),
        beforeDot.lastIndexOf(','),
        beforeDot.lastIndexOf('='),
        lastDotIndex === beforeDot.length - 1 ? lastDotIndex : -1
      ) + 1;
      
      const objectName = beforeDot.substring(lastWordStart).trim();
      
      // Определяем методы на основе имени объекта
      const methodSuggestions = getPythonMethodSuggestions(objectName, monaco);
      if (methodSuggestions.length > 0) {
        return { 
          suggestions: methodSuggestions.map((s: any) => ({
            ...s,
            range
          }))
        };
      }
    }
    
    // Если нет специальных обработчиков, возвращаем базовые ключевые слова Python
    const pythonKeywords = [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
      'def', 'del', 'elif', 'else', 'except', 'exec', 'finally', 'for', 'from',
      'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
      'pass', 'print', 'raise', 'return', 'try', 'while', 'with', 'yield',
      'match', 'case', 'True', 'False', 'None'
    ];
    
    const baseSuggestions = pythonKeywords.map(keyword => ({
      label: keyword,
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: keyword,
      range
    }));
    
    // Добавляем стандартные подсказки и встроенные типы
    const builtinTypes = [
      'int', 'float', 'str', 'bool', 'list', 'tuple', 'dict', 'set', 'bytes',
      'bytearray', 'range', 'complex', 'slice', 'frozenset', 'object'
    ];
    
    const typeSuggestions = builtinTypes.map(type => ({
      label: type,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: type,
      detail: 'Built-in type',
      range
    }));
    
    // Объединяем все базовые подсказки
    return {
      suggestions: [...baseSuggestions, ...typeSuggestions, ...moduleHints]
    };
  } catch (error) {
    console.error('Ошибка в провайдере автодополнений Python:', error);
    return { suggestions: [] };
  }
}

/**
 * Возвращает предложения методов для типа объекта
 * @param objectName Имя объекта
 */
function getPythonMethodSuggestions(objectName: string, monaco: any): any[] {
  const suggestions: any[] = [];
  
  // Методы для разных типов объектов
  const typeMethodMap: Record<string, { name: string, detail: string, doc?: string }[]> = {
    // Строковые методы
    'str': [
      { name: 'capitalize()', detail: 'Возвращает копию строки с первым символом в верхнем регистре' },
      { name: 'casefold()', detail: 'Возвращает копию строки, подходящую для сравнения без учета регистра' },
      { name: 'center(width, fillchar=" ")', detail: 'Возвращает центрированную строку' },
      { name: 'count(sub, start=0, end=None)', detail: 'Возвращает количество непересекающихся вхождений подстроки' },
      { name: 'encode(encoding="utf-8", errors="strict")', detail: 'Кодирует строку, возвращая объект bytes' },
      { name: 'endswith(suffix, start=0, end=None)', detail: 'Проверяет, заканчивается ли строка указанным суффиксом' },
      { name: 'expandtabs(tabsize=8)', detail: 'Возвращает копию строки, где все табуляции заменены пробелами' },
      { name: 'find(sub, start=0, end=None)', detail: 'Возвращает индекс первого вхождения подстроки' },
      { name: 'format(*args, **kwargs)', detail: 'Форматирует строку' },
      { name: 'format_map(mapping)', detail: 'Форматирует строку с использованием указанного отображения' },
      { name: 'index(sub, start=0, end=None)', detail: 'Как find(), но вызывает ValueError при отсутствии подстроки' },
      { name: 'isalnum()', detail: 'Проверяет, содержит ли строка только алфавитно-цифровые символы' },
      { name: 'isalpha()', detail: 'Проверяет, содержит ли строка только алфавитные символы' },
      { name: 'isascii()', detail: 'Проверяет, содержит ли строка только ASCII символы' },
      { name: 'isdecimal()', detail: 'Проверяет, содержит ли строка только десятичные символы' },
      { name: 'isdigit()', detail: 'Проверяет, содержит ли строка только цифры' },
      { name: 'isidentifier()', detail: 'Проверяет, является ли строка допустимым идентификатором' },
      { name: 'islower()', detail: 'Проверяет, содержит ли строка только символы в нижнем регистре' },
      { name: 'isnumeric()', detail: 'Проверяет, содержит ли строка только числовые символы' },
      { name: 'isprintable()', detail: 'Проверяет, состоит ли строка только из печатаемых символов' },
      { name: 'isspace()', detail: 'Проверяет, содержит ли строка только пробельные символы' },
      { name: 'istitle()', detail: 'Проверяет, начинается ли каждое слово с заглавной буквы' },
      { name: 'isupper()', detail: 'Проверяет, содержит ли строка только символы в верхнем регистре' },
      { name: 'join(iterable)', detail: 'Возвращает строку, объединяющую элементы итерируемого объекта' },
      { name: 'ljust(width, fillchar=" ")', detail: 'Выравнивает строку по левому краю' },
      { name: 'lower()', detail: 'Возвращает копию строки со всеми символами в нижнем регистре' },
      { name: 'lstrip(chars=None)', detail: 'Возвращает копию строки с удаленными начальными символами' },
      { name: 'partition(sep)', detail: 'Разбивает строку по первому вхождению сепаратора' },
      { name: 'replace(old, new, count=-1)', detail: 'Возвращает копию строки с замененными подстроками' },
      { name: 'rfind(sub, start=0, end=None)', detail: 'Возвращает индекс последнего вхождения подстроки' },
      { name: 'rindex(sub, start=0, end=None)', detail: 'Как rfind(), но вызывает ValueError при отсутствии подстроки' },
      { name: 'rjust(width, fillchar=" ")', detail: 'Выравнивает строку по правому краю' },
      { name: 'rpartition(sep)', detail: 'Разбивает строку по последнему вхождению сепаратора' },
      { name: 'rsplit(sep=None, maxsplit=-1)', detail: 'Разбивает строку справа налево' },
      { name: 'rstrip(chars=None)', detail: 'Возвращает копию строки с удаленными конечными символами' },
      { name: 'split(sep=None, maxsplit=-1)', detail: 'Разбивает строку на список подстрок' },
      { name: 'splitlines(keepends=False)', detail: 'Разбивает строку на список строк по границам строк' },
      { name: 'startswith(prefix, start=0, end=None)', detail: 'Проверяет, начинается ли строка с указанного префикса' },
      { name: 'strip(chars=None)', detail: 'Возвращает копию строки с удаленными начальными и конечными символами' },
      { name: 'swapcase()', detail: 'Меняет регистр символов' },
      { name: 'title()', detail: 'Возвращает copy of the string where each word is titlecased' },
      { name: 'translate(table)', detail: 'Возвращает копию строки с замененными символами' },
      { name: 'upper()', detail: 'Возвращает копию строки со всеми символами в верхнем регистре' },
      { name: 'zfill(width)', detail: 'Возвращает копию строки с заполнением слева нулями до указанной ширины' },
    ],
    // Методы списков
    'list': [
      { name: 'append(x)', detail: 'Добавляет элемент в конец списка' },
      { name: 'clear()', detail: 'Удаляет все элементы из списка' },
      { name: 'copy()', detail: 'Возвращает копию списка' },
      { name: 'count(x)', detail: 'Возвращает количество вхождений значения x' },
      { name: 'extend(iterable)', detail: 'Добавляет элементы iterable в конец списка' },
      { name: 'index(x, start=0, end=None)', detail: 'Возвращает индекс первого вхождения x' },
      { name: 'insert(i, x)', detail: 'Вставляет элемент x в позицию i' },
      { name: 'pop(i=-1)', detail: 'Удаляет и возвращает элемент в позиции i' },
      { name: 'remove(x)', detail: 'Удаляет первое вхождение значения x' },
      { name: 'reverse()', detail: 'Обращает порядок элементов в списке' },
      { name: 'sort(key=None, reverse=False)', detail: 'Сортирует список на месте' },
    ],
    // Методы словарей
    'dict': [
      { name: 'clear()', detail: 'Удаляет все элементы из словаря' },
      { name: 'copy()', detail: 'Возвращает копию словаря' },
      { name: 'get(key, default=None)', detail: 'Возвращает значение для ключа или default' },
      { name: 'items()', detail: 'Возвращает представление пар (ключ, значение)' },
      { name: 'keys()', detail: 'Возвращает представление ключей словаря' },
      { name: 'pop(key, default=None)', detail: 'Удаляет ключ и возвращает значение или default' },
      { name: 'popitem()', detail: 'Удаляет и возвращает пару (ключ, значение)' },
      { name: 'setdefault(key, default=None)', detail: 'Возвращает значение ключа, устанавливая default, если ключ отсутствует' },
      { name: 'update(other)', detail: 'Обновляет словарь парами (ключ, значение) из other' },
      { name: 'values()', detail: 'Возвращает представление значений словаря' },
    ],
  };
  
  // Определяем тип объекта по имени или методам
  let objectType = '';
  
  if (objectName === 'str' || objectName.startsWith('"') || objectName.startsWith("'")) {
    objectType = 'str';
  } else if (objectName === 'list' || objectName.startsWith('[')) {
    objectType = 'list';
  } else if (objectName === 'dict' || objectName.startsWith('{')) {
    objectType = 'dict';
  }
  
  // Если тип определен, добавляем соответствующие методы
  if (objectType && typeMethodMap[objectType]) {
    typeMethodMap[objectType].forEach(method => {
      suggestions.push({
        label: method.name.split('(')[0],
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: method.name.split('(')[0],
        detail: method.detail,
        documentation: { value: method.doc || method.detail }
      });
    });
  }
  
  // Общие магические методы для всех объектов
  const commonMethods = [
    { name: '__str__()', detail: 'Возвращает строковое представление объекта' },
    { name: '__repr__()', detail: 'Возвращает представление объекта для воспроизведения' },
    { name: '__len__()', detail: 'Возвращает длину объекта' },
  ];
  
  // Если особый тип не определен, добавляем общие методы для всех объектов
  if (!objectType) {
    commonMethods.forEach(method => {
      suggestions.push({
        label: method.name.split('(')[0],
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: method.name.split('(')[0],
        detail: method.detail
      });
    });
  }
  
  return suggestions;
}