/**
 * Регистрация поддержки Python в Monaco Editor
 */

import * as monaco from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';

// Определяем интерфейс ScriptError для согласованности с основным интерфейсом
export interface ScriptError {
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Интерфейсы, которые соответствуют структуре в terminal.tsx
interface IssueInfo {
  filePath: string;
  fileName: string;
  issues: Issue[];
}

interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source?: string;
  code?: string;
}

interface IPythonDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source: string;
}

interface IPythonMarker extends monaco.editor.IMarkerData {
  owner: string;
  resource: monaco.Uri;
}

// Объявляем тип редактора, совместимый с обоими типами
type MonacoEditor = monaco.editor.ICodeEditor;

// Система событий для передачи ошибок внешним компонентам
type ErrorCallbackFunction = (errors: ScriptError[]) => void;
const errorListeners: ErrorCallbackFunction[] = [];

// Хранилище диагностики для всех Python файлов
const pythonDiagnostics: Map<string, IssueInfo> = new Map();

// Глобальные константы
const PYTHON_MARKER_OWNER = 'python-validator';

// Дополняем интерфейс Window для доступа к глобальным объектам Monaco
declare global {
  interface Window {
    setupErrorDecorations?: (editor: any) => void;
    setupAllErrorDecorations?: () => void;
    monaco?: any; // Используем any для избежания конфликтов
    pythonCheckErrors?: (code: string, model?: monaco.editor.ITextModel) => Promise<ScriptError[]>;
    pythonAddErrorListener?: (callback: ErrorCallbackFunction) => void;
    pythonShowProblemsInEditor?: (editor: MonacoEditor, errors: ScriptError[]) => void;
    pythonForceValidateEditor?: (editor: MonacoEditor) => void;
    // Функции для интеграции с Terminal.tsx
    getPythonDiagnostics?: () => IssueInfo[];
    updatePythonDiagnostics?: () => Promise<IssueInfo[]>;
  }
}

/**
 * Преобразует строковое значение важности в тип MarkerSeverity
 */
function mapSeverityToMonaco(severity: string): monaco.MarkerSeverity {
  switch (severity.toLowerCase()) {
    case 'error':
      return monaco.MarkerSeverity.Error;
    case 'warning':
      return monaco.MarkerSeverity.Warning;
    case 'info':
      return monaco.MarkerSeverity.Info;
    default:
      return monaco.MarkerSeverity.Hint;
  }
}

/**
 * Преобразует Python диагностику в формат маркера Monaco
 */
function createMarkerData(diagnostic: IPythonDiagnostic): monaco.editor.IMarkerData {
  return {
    severity: mapSeverityToMonaco(diagnostic.severity),
    message: diagnostic.message,
    startLineNumber: diagnostic.line + 1, // Python использует 0-based индексы
    startColumn: diagnostic.column + 1,
    endLineNumber: diagnostic.endLine + 1,
    endColumn: diagnostic.endColumn + 1
  };
}

/**
 * Создает декорации для маркеров ошибок
 */
function createDecorations(markers: monaco.editor.IMarkerData[], model: monaco.editor.ITextModel): monaco.editor.IModelDeltaDecoration[] {
  if (!markers || !Array.isArray(markers) || markers.length === 0) return [];
  
  return markers.map(marker => {
    const isError = marker.severity === monaco.MarkerSeverity.Error;
    
    return {
      range: new monaco.Range(
        marker.startLineNumber,
        marker.startColumn,
        marker.endLineNumber,
        marker.endColumn
      ),
      options: {
        inlineClassName: isError ? 'thin-error-underline' : 'thin-warning-underline',
        hoverMessage: { value: marker.message },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        zIndex: 20
      }
    };
  });
}

/**
 * Находит простые синтаксические ошибки в Python коде
 * Используется как резервный вариант, если проверка через backend не работает
 */
function findBasicPythonErrors(code: string): ScriptError[] {
  const errors: ScriptError[] = [];
  const lines = code.split('\n');
  
  // Набор популярных модулей и их функций для проверки
  const popularModules: Record<string, string[]> = {
    'math': ['sin', 'cos', 'tan', 'sqrt', 'log', 'exp', 'pow', 'pi', 'e', 'floor', 'ceil', 'fabs'],
    'random': ['random', 'randint', 'choice', 'shuffle', 'sample', 'uniform'],
    'os': ['path', 'listdir', 'mkdir', 'remove', 'rename', 'environ'],
    'sys': ['argv', 'exit', 'path', 'stdout', 'stderr', 'stdin'],
    'datetime': ['datetime', 'date', 'time', 'timedelta'],
    'json': ['loads', 'dumps', 'load', 'dump'],
  };
  
  // Отслеживание текущего контекста для проверок, связанных с блоками
  let inFunction = false;
  let inClass = false;
  let inLoop = false;
  let inIf = false;
  let inTry = false;
  let inExcept = false;
  let indentLevel = 0;
  let importedModules: string[] = [];
  
  // Простая проверка открытых/закрытых скобок и кавычек
  let openParens = 0, openBrackets = 0, openBraces = 0;
  let lastOpenParenLine = 0, lastOpenBracketLine = 0, lastOpenBraceLine = 0;
  
  // Отслеживание незакрытых строк
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTripleQuote = false;
  
  // Проверка определений функций
  const functionDefRegex = /^\s*def\s+(\w+)\s*\((.*?)\)\s*:?\s*$/;
  
  // Проверка импортов
  const importRegex = /^\s*import\s+([a-zA-Z0-9_,.]+)\s*$/;
  const fromImportRegex = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_,*]+)\s*$/;
  
  // Проверка try-except блоков
  const tryRegex = /^\s*try\s*:?\s*$/;
  const exceptRegex = /^\s*except(\s+\w+)?(\s+as\s+\w+)?\s*:?\s*$/;
  
  // Проверка обращения к элементам списка и словаря
  const listAccessRegex = /\w+\[.*?\]/g;
  const dictAccessRegex = /\w+\[["'].*?["']\]/g;
  
  // Проверка деления на ноль
  const divisionByZeroRegex = /\/\s*0+(\.\d*[1-9])?\s*/;
  
  // Проверка вызова функций модулей
  const moduleCallRegex = /(\w+)\.(\w+)\(/g;
  
  // Проверка сравнения разных типов
  const mixedComparisonRegex = /(\d+)\s*[<>]=?\s*["'].+["']/;
  
  // Проверка списков на наличие двойных запятых
  const doubleCommaRegex = /\[\s*[\w\d",'\s]+\,\s*\,\s*[\w\d",'\s]+\]/;
  
  // Проверка атрибутов строк и других основных типов
  const stringMethodsRegex = /(['"]).*?\1\.(append|push|pop|shift|unshift)\(/g;
  const listMethodsRegex = /(\w+)\.(keys|values|items|has[a-zA-Z]+|add|update|intersection|difference|clear)\(/g;

  // Проверка операций с None
  const noneOperationsRegex = /(None\s*[\+\-\*\/\%])|([+\-*/\%]\s*None)/;

  // Проверка типов при использовании списков
  const typeMixRegex = /\[\s*[\d]+\s*,\s*['"][^'"]*['"]\s*\]/;
  
  // Добавляем дополнительные регулярные выражения для проверки:
  
  // Проверка вызова функции без скобок
  const functionCallWithoutParens = /\b(print|len|sum|min|max|sorted|list|dict|str|int|float|bool|range|enumerate|zip|map|filter)\s+[a-zA-Z0-9_"'[\]]+(\s|$|#|,|;)/;

  // Проверка противоречивых операций сравнения
  const contradictoryComparison = /\w+\s*[<>=]+\s*\w+\s+and\s+\w+\s*[<>=]+\s*\w+/;

  // Регулярное выражение для обнаружения непарных кавычек
  const unparedQuotes = /(['"])(?:(?!\1).)*$/;
  
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const trimmedLine = line.trim();
    
    // Пропускаем пустые строки и комментарии
    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      return;
    }
    
    // Проверка отступов (должны быть кратны 4 пробелам или табам)
    if (!trimmedLine.startsWith('#')) {
      const leadingSpaces = line.length - line.trimStart().length;
      if (leadingSpaces % 4 !== 0 && !line.startsWith('\t')) {
        errors.push({
          lineNumber,
          message: 'Отступ должен быть кратен 4 пробелам или использовать табуляцию',
          severity: 'warning'
        });
      }
    }
    
    // Проверка двоеточия в конце строк с def, class, if, else и т.д.
    if (/^\s*(def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(trimmedLine) && 
        !trimmedLine.includes(':')) {
      errors.push({
        lineNumber,
        message: 'Отсутствует двоеточие в конце строки',
        severity: 'error'
      });
    }
    
    // Проверка синтаксиса с двоеточием
    if (trimmedLine.endsWith(':')) {
      const nextLine = idx < lines.length - 1 ? lines[idx + 1] : '';
      const nextTrimmed = nextLine.trim();
      
      if (nextTrimmed.length > 0 && !nextLine.startsWith(' ') && !nextLine.startsWith('\t') && 
          !nextTrimmed.startsWith('#') && !nextTrimmed.startsWith('else') && 
          !nextTrimmed.startsWith('elif') && !nextTrimmed.startsWith('except') && 
          !nextTrimmed.startsWith('finally')) {
        errors.push({
          lineNumber: lineNumber + 1,
          message: 'Ожидается отступ после двоеточия',
          severity: 'error'
        });
      }
    }
    
    // Проверка определений функций
    const funcMatch = trimmedLine.match(functionDefRegex);
    if (funcMatch) {
      const hasColon = trimmedLine.trim().endsWith(':');
      if (!hasColon) {
        errors.push({
          lineNumber,
          message: 'Отсутствует двоеточие в объявлении функции',
          severity: 'error'
        });
      }
      
      // Проверка правильности скобок в параметрах
      const params = funcMatch[2];
      const openCount = (params.match(/\(/g) || []).length;
      const closeCount = (params.match(/\)/g) || []).length;
      if (openCount !== closeCount) {
        errors.push({
          lineNumber,
          message: 'Несбалансированные скобки в параметрах функции',
          severity: 'error'
        });
      }
      
      // Вход в блок функции
      inFunction = true;
      indentLevel += 1;
    }
    
    // Проверка блоков try-except
    if (tryRegex.test(trimmedLine)) {
      const hasColon = trimmedLine.trim().endsWith(':');
      if (!hasColon) {
        errors.push({
          lineNumber,
          message: 'Отсутствует двоеточие после try',
          severity: 'error'
        });
      }
      inTry = true;
      indentLevel += 1;
    }
    
    if (exceptRegex.test(trimmedLine)) {
      const hasColon = trimmedLine.trim().endsWith(':');
      if (!hasColon) {
        errors.push({
          lineNumber,
          message: 'Отсутствует двоеточие после except',
          severity: 'error'
        });
      }
      if (!inTry) {
        errors.push({
          lineNumber,
          message: 'Блок except без предшествующего блока try',
          severity: 'error'
        });
      }
      inExcept = true;
    }
    
    // Проверка импортов
    let importMatch = trimmedLine.match(importRegex);
    if (importMatch) {
      const moduleName = importMatch[1].split(',')[0].trim();
      if (!moduleName) {
        errors.push({
          lineNumber,
          message: 'Ошибка в инструкции import',
          severity: 'error'
        });
      } else {
        // Проверяем на наличие распространенных модулей для предупреждений
        if (!(moduleName in popularModules) && 
            !['sys', 'os', 'io', 're', 'time', 'numpy', 'pandas', 'django'].includes(moduleName)) {
          errors.push({
            lineNumber,
            message: `Модуль '${moduleName}' может не существовать или быть недоступен`,
            severity: 'warning'
          });
        } else {
          importedModules.push(moduleName);
        }
      }
    }
    
    importMatch = trimmedLine.match(fromImportRegex);
    if (importMatch) {
      const moduleName = importMatch[1];
      if (!moduleName) {
        errors.push({
          lineNumber,
          message: 'Ошибка в инструкции from-import',
          severity: 'error'
        });
      } else {
        // Проверяем на наличие распространенных модулей для предупреждений
        if (!(moduleName in popularModules) && 
            !['sys', 'os', 'io', 're', 'time', 'numpy', 'pandas', 'django'].includes(moduleName)) {
          errors.push({
            lineNumber,
            message: `Модуль '${moduleName}' может не существовать или быть недоступен`,
            severity: 'warning'
          });
        } else {
          importedModules.push(moduleName);
        }
      }
    }
    
    // Проверка вызовов методов модулей
    let moduleCall;
    while ((moduleCall = moduleCallRegex.exec(trimmedLine)) !== null) {
      const moduleName = moduleCall[1];
      const functionName = moduleCall[2];
      
      // Если это известный модуль, проверяем функцию
      if (moduleName in popularModules) {
        if (!popularModules[moduleName].includes(functionName)) {
          errors.push({
            lineNumber,
            message: `Функция '${functionName}' может отсутствовать в модуле '${moduleName}'`,
            severity: 'warning'
          });
        }
      }
    }
    
    // Проверка деления на ноль
    if (divisionByZeroRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Возможное деление на ноль',
        severity: 'warning'
      });
    }
    
    // Проверка сравнения разных типов
    if (mixedComparisonRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Сравнение разных типов (число и строка)',
        severity: 'warning'
      });
    }
    
    // Проверка списков на наличие двойных запятых
    if (doubleCommaRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Синтаксическая ошибка: двойная запятая в списке',
        severity: 'error'
      });
    }
    
    // Проверка атрибутов строк (методы, которые есть в других языках, но отсутствуют в Python)
    if (stringMethodsRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Использование метода, который отсутствует у строк в Python (push, append, etc.)',
        severity: 'error'
      });
    }

    // Проверка ошибок в методах коллекций
    const listMatches = [...trimmedLine.matchAll(listMethodsRegex)];
    for (const match of listMatches) {
      const obj = match[1];
      const method = match[2];
      
      // Проверка методов словарей на списках/строках
      if (['keys', 'values', 'items', 'has'].some(m => method.startsWith(m))) {
        errors.push({
          lineNumber,
          message: `Метод '${method}' может быть недоступен для объекта '${obj}' (это метод словаря)`,
          severity: 'warning'
        });
      }
      
      // Проверка методов множеств на списках/строках
      if (['add', 'update', 'intersection', 'difference'].includes(method)) {
        errors.push({
          lineNumber,
          message: `Метод '${method}' может быть недоступен для объекта '${obj}' (это метод множества)`,
          severity: 'warning'
        });
      }
    }

    // Проверка операций с None
    if (noneOperationsRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Математические операции с None не допустимы',
        severity: 'error'
      });
    }

    // Проверка смешивания типов в списке
    if (typeMixRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Смешивание числовых и строковых типов в списке может привести к ошибкам при дальнейших операциях',
        severity: 'warning'
      });
    }
    
    // Проверка вызова функции без скобок
    if (functionCallWithoutParens.test(trimmedLine) && !trimmedLine.includes('(')) {
      errors.push({
        lineNumber,
        message: 'Вызов функции без скобок. В Python функции вызываются с (), даже если нет аргументов.',
        severity: 'error'
      });
    }
    
    // Проверка противоречивых операций сравнения
    if (contradictoryComparison.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Возможно противоречивое сравнение. Убедитесь, что ваше логическое выражение имеет смысл.',
        severity: 'warning'
      });
    }

    // Проверка непарных кавычек (если не комментарий)
    if (!trimmedLine.startsWith('#') && unparedQuotes.test(trimmedLine) && 
        !trimmedLine.includes('"""') && !trimmedLine.includes("'''")) {
      errors.push({
        lineNumber,
        message: 'Непарные кавычки в строке',
        severity: 'error'
      });
    }

    // Если строка кончается на двоеточие, запускаем дополнительную проверку
    if (trimmedLine.endsWith(':')) {
      if (idx === lines.length - 1) {
        errors.push({
          lineNumber,
          message: 'Блок определения заканчивается без тела. После двоеточия должен быть блок с отступом.',
          severity: 'error'
        });
      }
    }

    // Добавляем проверку для break/continue вне цикла
    if (/^\s*break\b/.test(trimmedLine) && !inLoop) {
      errors.push({
        lineNumber,
        message: 'Инструкция break вне цикла',
        severity: 'error'
      });
    }

    if (/^\s*continue\b/.test(trimmedLine) && !inLoop) {
      errors.push({
        lineNumber,
        message: 'Инструкция continue вне цикла',
        severity: 'error'
      });
    }

    // Добавляем отслеживание контекста для циклов
    if (/^\s*(for|while)\b.*:/.test(trimmedLine)) {
      inLoop = true;
      indentLevel += 1;
    } else if (indentLevel > 0 && trimmedLine.length > 0) {
      // Если уменьшился отступ, выходим из текущего блока
      const currentIndent = line.length - line.trimStart().length;
      // Этот код будет приблизительным, но позволит отслеживать конец блоков
      if (currentIndent < indentLevel * 4) {
        indentLevel = Math.floor(currentIndent / 4);
        
        if (indentLevel === 0) {
          inFunction = false;
          inLoop = false;
          inClass = false;
          inTry = false;
          inExcept = false;
        }
      }
    }
    
    // Подсчет скобок для проверки несоответствия
    for (let i = 0; i < line.length; i++) {
      switch (line[i]) {
        case '(': openParens++; lastOpenParenLine = lineNumber; break;
        case '[': openBrackets++; lastOpenBracketLine = lineNumber; break;
        case '{': openBraces++; lastOpenBraceLine = lineNumber; break;
        case ')': openParens--; 
          if (openParens < 0) {
            errors.push({
              lineNumber,
              message: 'Лишняя закрывающая скобка ")"',
              severity: 'error'
            });
            openParens = 0;
          }
          break;
        case ']': openBrackets--; 
          if (openBrackets < 0) {
            errors.push({
              lineNumber,
              message: 'Лишняя закрывающая скобка "]"',
              severity: 'error'
            });
            openBrackets = 0;
          }
          break;
        case '}': openBraces--; 
          if (openBraces < 0) {
            errors.push({
              lineNumber,
              message: 'Лишняя закрывающая скобка "}"',
              severity: 'error'
            });
            openBraces = 0;
          }
          break;
      }
    }
  });
  
  // Добавляем ошибки для незакрытых скобок
  if (openParens > 0) {
    errors.push({
      lineNumber: lastOpenParenLine,
      message: `${openParens} незакрытых скобок "("`,
      severity: 'error'
    });
  }
  
  if (openBrackets > 0) {
    errors.push({
      lineNumber: lastOpenBracketLine,
      message: `${openBrackets} незакрытых скобок "["`,
      severity: 'error'
    });
  }
  
  if (openBraces > 0) {
    errors.push({
      lineNumber: lastOpenBraceLine,
      message: `${openBraces} незакрытых скобок "{"`,
      severity: 'error'
    });
  }
  
  return errors;
}

/**
 * Преобразует ScriptError в формат Issue для отображения в интерфейсе
 */
function convertToIssue(error: ScriptError): Issue {
  return {
    severity: error.severity,
    message: error.message,
    line: error.lineNumber - 1, // Преобразуем обратно в 0-based для соответствия с форматом Issue
    column: 0,
    endLine: error.lineNumber - 1,
    endColumn: 100, // Примерное значение для отображения
    source: 'python-lsp' // Указываем источник для фильтрации
  };
}

/**
 * Проверяет код Python на наличие ошибок и устанавливает маркеры в модель
 */
async function checkPythonErrors(code: string, model?: monaco.editor.ITextModel): Promise<ScriptError[]> {
  try {
    let errors: ScriptError[] = [];
    
    try {
      // Сначала пробуем вызвать backend для проверки кода Python
      const diagnostics = await invoke<IPythonDiagnostic[]>('check_python_code', { 
        code 
      });
      
      // Преобразуем диагностику в ScriptError для согласованности с интерфейсом
      errors = diagnostics.map(diag => ({
        lineNumber: diag.line + 1, // Преобразуем в 1-based индекс для UI
        message: diag.message,
        severity: diag.severity
      }));
      
      // Если с backend получили меньше 1 ошибки, добавляем проверку базовым парсером
      if (errors.length < 1) {
        const basicErrors = findBasicPythonErrors(code);
        // Объединяем ошибки, избегая дубликатов
        for (const basicError of basicErrors) {
          if (!errors.some(e => e.lineNumber === basicError.lineNumber && e.message === basicError.message)) {
            errors.push(basicError);
          }
        }
      }
    } catch (backendError) {
      console.warn('Не удалось вызвать backend для проверки Python:', backendError);
      // Если backend недоступен, используем базовую проверку
      errors = findBasicPythonErrors(code);
      
      // Добавляем предупреждение о том, что используется упрощенный анализатор
      errors.push({
        lineNumber: 1,
        message: 'Внимание: работает упрощенный анализатор ошибок Python. Некоторые ошибки могут быть не обнаружены.',
        severity: 'info'
      });
    }
    
    // Добавляем контекст к сообщениям об ошибках для лучшего понимания пользователем
    errors = errors.map(error => {
      let enhancedMessage = error.message;
      
      // Улучшаем сообщения для синтаксических ошибок
      if (error.message.includes('двоеточие') || error.message.includes('скобка')) {
        enhancedMessage = `🔍 Синтаксическая ошибка: ${error.message}`;
      } 
      // Улучшаем сообщения для ошибок импорта
      else if (error.message.includes('модуль') || error.message.includes('import')) {
        enhancedMessage = `📦 ${error.message}`;
      }
      // Улучшаем сообщения для типовых предупреждений
      else if (error.message.includes('деление на ноль')) {
        enhancedMessage = `⚠️ Возможная ошибка времени выполнения: ${error.message}`;
      }
      else if (error.message.includes('сравнени') || error.message.includes('типов')) {
        enhancedMessage = `🔄 Потенциальная ошибка типов: ${error.message}`;
      }
      
      return {
        ...error,
        message: enhancedMessage
      };
    });
    
    // Если предоставлена модель, устанавливаем маркеры
    if (model) {
      setErrorMarkers(model, errors);
      
      // Сохраняем диагностику в хранилище
      const filePath = model.uri.toString();
      const fileName = filePath.split('/').pop() || 'unknown.py';
      
      // Преобразуем ошибки в формат Issue для терминала
      const issues: Issue[] = errors.map(convertToIssue);
      
      // Добавляем в хранилище диагностики
      pythonDiagnostics.set(filePath, {
        filePath,
        fileName,
        issues
      });
      
      // Отправляем событие обновления маркеров
      document.dispatchEvent(new Event('markers-updated'));
    }
    
    // Уведомляем подписчиков об ошибках
    errorListeners.forEach(listener => listener(errors));
    
    return errors;
  } catch (error) {
    console.error('Ошибка при проверке кода Python:', error);
    return [];
  }
}

/**
 * Получает все текущие диагностики Python
 */
function getAllPythonDiagnostics(): IssueInfo[] {
  const diagValues = Array.from(pythonDiagnostics.values());
  
  // Дополнительно проверим все актуальные маркеры из Monaco
  if (window.monaco && window.monaco.editor) {
    try {
      const models = window.monaco.editor.getModels();
      for (const model of models) {
        if (!model || model.isDisposed() || model.getLanguageId() !== 'python') continue;
        
        const uri = model.uri.toString();
        const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        
        if (markers && markers.length > 0) {
          // Проверяем, есть ли уже этот файл в диагностике
          const existingIndex = diagValues.findIndex(d => d.filePath === uri);
          const fileName = uri.split('/').pop() || uri.split('\\').pop() || 'unknown.py';
          
          if (existingIndex === -1) {
            // Если файла нет, добавляем его с маркерами
            diagValues.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: monaco.editor.IMarkerData) => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
                message: marker.message,
                line: marker.startLineNumber - 1,
                column: marker.startColumn - 1,
                endLine: marker.endLineNumber - 1,
                endColumn: marker.endColumn - 1,
                source: 'monaco-python',
                code: marker.code?.toString()
              }))
            });
          }
        }
      }
    } catch (e) {
      console.error('Ошибка при получении маркеров:', e);
    }
  }
  
  console.log(`[Python] getAllPythonDiagnostics: найдено ${diagValues.length} файлов с проблемами`);
  return diagValues;
}

/**
 * Обновляет диагностику для всех Python моделей
 */
async function updateAllPythonDiagnostics(): Promise<IssueInfo[]> {
  // Очищаем предыдущие диагностики
  pythonDiagnostics.clear();
  
  // Проверяем все модели Python
  const models = monaco.editor.getModels();
  for (const model of models) {
    if (model.getLanguageId() === 'python') {
      const code = model.getValue();
      await checkPythonErrors(code, model);
    }
  }
  
  // Отправляем событие обновления маркеров
  document.dispatchEvent(new Event('markers-updated'));
  
  return getAllPythonDiagnostics();
}

/**
 * Устанавливает маркеры ошибок в модель Monaco
 */
function setErrorMarkers(model: monaco.editor.ITextModel, errors: ScriptError[]): void {
  if (!model) return;
  
  // Сначала очищаем существующие маркеры
  monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, []);
  
  // Преобразуем ScriptError в Monaco маркеры
  const markers: monaco.editor.IMarkerData[] = errors.map(error => ({
    severity: mapSeverityToMonaco(error.severity),
    message: error.message,
    startLineNumber: error.lineNumber,
    startColumn: 1,
    endLineNumber: error.lineNumber,
    endColumn: model.getLineMaxColumn(error.lineNumber) || 1
  }));
  
  // Устанавливаем маркеры для модели
  if (markers.length > 0) {
    monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, markers);
    
    // Сохраняем диагностику в хранилище сразу после установки маркеров
    const filePath = model.uri.toString();
    const fileName = filePath.split('/').pop() || 'unknown.py';
    
    // Преобразуем ошибки в формат Issue для терминала
    const issues: Issue[] = errors.map(convertToIssue);
    
    // Добавляем в хранилище диагностики
    pythonDiagnostics.set(filePath, {
      filePath,
      fileName,
      issues
    });
    
    // Отправляем событие обновления маркеров с данными
    const markersEvent = new CustomEvent('markers-updated', {
      detail: { filePath, markers: issues }
    });
    document.dispatchEvent(markersEvent);
    
    console.log(`[Python] Установлено ${markers.length} маркеров для ${fileName}`, issues);
  }
}

/**
 * Отображает ошибки в редакторе с использованием стандартных возможностей Monaco
 */
function showProblemsInEditor(editor: MonacoEditor, errors: ScriptError[]): void {
  if (!editor || !editor.getModel()) return;
  
  const model = editor.getModel();
  if (!model) return;
  
  // Очищаем существующие декорации
  editor.deltaDecorations([], []);
  
  // Устанавливаем маркеры ошибок в модель
  setErrorMarkers(model, errors);
  
  // Добавляем стандартные декорации Monaco для линий с ошибками
  const decorations: monaco.editor.IModelDeltaDecoration[] = errors.map(error => {
    const isError = error.severity === 'error';
    const lineNumber = error.lineNumber;
    
    return {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: isError ? 'line-with-error' : 'line-with-warning',
        glyphMarginClassName: isError ? 'glyph-margin-error' : 'glyph-margin-warning',
        hoverMessage: { value: error.message },
        overviewRuler: {
          color: isError ? '#FF4C4C' : '#FFCC00',
          position: monaco.editor.OverviewRulerLane.Right
        },
        minimap: {
          color: isError ? '#FF4C4C' : '#FFCC00',
          position: monaco.editor.MinimapPosition.Inline
        }
      }
    };
  });
  
  // Применяем декорации к редактору
  if (decorations.length > 0) {
    editor.deltaDecorations([], decorations);
  }
}

/**
 * Принудительно запускает проверку ошибок для редактора
 */
function forceValidateEditor(editor: MonacoEditor): void {
  if (!editor || !editor.getModel()) return;
  
  const model = editor.getModel()!; // Используем non-null assertion operator
  const code = model.getValue();
  
  // Запускаем проверку и показываем результаты
  checkPythonErrors(code, model).then(errors => {
    showProblemsInEditor(editor, errors);
  });
}

/**
 * Регистрирует поддержку языка Python в Monaco Editor
 */
export function registerPython(): boolean {
  try {
    // Регистрируем язык Python, если он еще не зарегистрирован
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'python')) {
      monaco.languages.register({ id: 'python' });
    }

    // Устанавливаем базовую конфигурацию для языка Python
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
        { open: "'", close: "'", notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      indentationRules: {
        increaseIndentPattern: new RegExp(
          '^\\s*(?:' +
          'class|def|elif|else|except|finally|for|if|try|with|while|' +
          'match|case|async)\\b.*:\\s*$'
        ),
        decreaseIndentPattern: new RegExp(
          '^\\s*(?:' +
          'elif|else|except|finally)\\b.*:\\s*$'
        )
      },
      onEnterRules: [
        {
          beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async|match|case).*?:\s*$/,
          action: { indentAction: monaco.languages.IndentAction.Indent }
        }
      ],
      folding: {
        markers: {
          start: new RegExp('^\\s*#\\s*region\\b'),
          end: new RegExp('^\\s*#\\s*endregion\\b')
        }
      }
    });
    
    // Применяем фиксы и стили для Python
    applyPythonEditorFixes();

    // Настраиваем автоматическую проверку моделей Python на ошибки
    monaco.editor.onDidCreateModel((model) => {
      if (model.getLanguageId() === 'python') {
        // Запускаем первоначальную проверку
        setTimeout(async () => {
          const code = model.getValue();
          await checkPythonErrors(code, model);
          
          // Обновляем панель проблем принудительно
          document.dispatchEvent(new CustomEvent('force-update-problems'));
        }, 100);
        
        // Добавляем обработчик изменений для проверки ошибок
        model.onDidChangeContent(debounce(async () => {
          if (model.isDisposed()) return;
          
          const code = model.getValue();
          await checkPythonErrors(code, model);
          
          // Обновляем панель проблем принудительно после каждого изменения
          document.dispatchEvent(new CustomEvent('force-update-problems'));
        }, 500));
      }
    });

    // Предоставляем глобальные функции для проверки ошибок и подписки на них
    window.pythonCheckErrors = checkPythonErrors;
    window.pythonAddErrorListener = (callback) => {
      errorListeners.push(callback);
    };
    window.pythonShowProblemsInEditor = showProblemsInEditor;
    window.pythonForceValidateEditor = forceValidateEditor;
    
    // Добавляем функции для интеграции с Terminal.tsx
    window.getPythonDiagnostics = getAllPythonDiagnostics;
    window.updatePythonDiagnostics = updateAllPythonDiagnostics;

    /**
     * Функция для применения тонких подчеркиваний вместо красных линий
     */
    function applyThinUnderlineDecorations(editor: MonacoEditor): void {
      if (!editor || !editor.getModel) return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Получаем маркеры для данной модели
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      
      // Создаем новые декорации только с подчеркиванием
      const decorations = markers.map(marker => ({
        range: new monaco.Range(
          marker.startLineNumber,
          marker.startColumn,
          marker.endLineNumber,
          marker.endColumn
        ),
        options: {
          inlineClassName: marker.severity === monaco.MarkerSeverity.Error ? 'thin-error-underline' : 'thin-warning-underline',
          hoverMessage: { value: marker.message },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          zIndex: 20
        }
      }));
      
      // Обновляем декорации в редакторе
      if (decorations.length > 0) {
        editor.deltaDecorations([], decorations);
      }
    }

    /**
     * Применяет стили для корректного отображения Python кода и ошибок
     */
    function applyPythonEditorFixes(): void {
      const style = document.createElement('style');
      style.id = 'monaco-python-fixes';
      style.textContent = `
        /* Скрываем стандартные стили ошибок */
        .monaco-editor .squiggly-error,
        .monaco-editor .squiggly-warning,
        .monaco-editor .squiggly-info,
        .monaco-editor .squiggly-hint {
          background: transparent !important;
          border: none !important;
        }
        
        /* Убираем красные линии - оставляем только подчеркивания */
        .monaco-editor .view-overlays > div,
        .monaco-editor .view-overlays .view-line {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        /* Отмена лигатур и прочих украшений, которые могут смещать текст */
        .monaco-editor .monaco-editor-background,
        .monaco-editor .margin-view-overlays,
        .monaco-editor .view-line,
        .monaco-editor .view-lines {
          font-variant-ligatures: none !important;
          font-feature-settings: normal !important;
          transform: none !important;
          will-change: auto !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
        }
        
        /* Фиксированный размер строк */
        .monaco-editor .view-line {
          white-space: pre !important;
          overflow: visible !important;
        }
        
        /* Наши стили подчеркивания - делаем их очень видимыми */
        .monaco-editor .thin-error-underline {
          border-bottom: 2px wavy #FF4C4C !important;
          padding-bottom: 1px !important;
          background: transparent !important;
          z-index: 100 !important;
          position: relative !important;
          pointer-events: auto !important;
        }
        
        .monaco-editor .thin-warning-underline {
          border-bottom: 2px wavy #FFCC00 !important;
          padding-bottom: 1px !important;
          background: transparent !important;
          z-index: 100 !important;
          position: relative !important;
          pointer-events: auto !important;
        }
        
        /* Стили для подсветки строк с ошибками */
        .monaco-editor .line-with-error {
          border-left: 3px solid #FF4C4C !important;
          padding-left: 3px !important;
          background-color: rgba(255, 76, 76, 0.05) !important;
        }
        
        .monaco-editor .line-with-warning {
          border-left: 3px solid #FFCC00 !important;
          padding-left: 3px !important;
          background-color: rgba(255, 204, 0, 0.05) !important;
        }
        
        /* Стили для глифов на полях */
        .monaco-editor .glyph-margin-error {
          background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23FF4C4C"/><path d="M8 4v5" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="12" r="1" fill="white"/></svg>') center center no-repeat;
          background-size: 70%;
          margin-left: 3px;
        }
        
        .monaco-editor .glyph-margin-warning {
          background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 1L16 15H0L8 1z" fill="%23FFCC00"/><path d="M8 5v5" stroke="black" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="12.5" r="1" fill="black"/></svg>') center center no-repeat;
          background-size: 70%;
          margin-left: 3px;
        }
      `;
      
      // Если стиль уже есть, удаляем его и добавляем новый
      const existingStyle = document.getElementById('monaco-python-fixes');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      // Добавляем стиль с высоким приоритетом
      document.head.insertBefore(style, document.head.firstChild);
    }

    /**
     * Настраивает отображение ошибок в редакторе
     */
    function setupErrorDecorations(editor: MonacoEditor): void {
      if (!editor || !editor.getModel) return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Применяем тонкие подчеркивания для ошибок
      applyThinUnderlineDecorations(editor);
      
      // Принудительно запускаем проверку кода в редакторе
      if (model.getLanguageId() === 'python') {
        const code = model.getValue();
        // Вызываем только если есть содержимое
        if (code.trim().length > 0) {
          forceValidateEditor(editor);
        }
      }
    }

    // Функция debounce для предотвращения частых вызовов
    function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
      let timeout: number | null = null;
      
      return function(...args: Parameters<T>): void {
        const later = () => {
          timeout = null;
          func(...args);
        };
        
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        
        timeout = window.setTimeout(later, wait) as unknown as number;
      };
    }

    // Настраиваем обработчик для обновления декораций во всех редакторах
    window.setupAllErrorDecorations = function(): void {
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        editors.forEach((editor: MonacoEditor) => {
          if (editor) {
            setupErrorDecorations(editor);
          }
        });
      }
    };

    // Добавляем глобальную функцию для установки декораций в конкретном редакторе
    window.setupErrorDecorations = setupErrorDecorations;

    // Устанавливаем обработчики событий для редактора
    monaco.editor.onDidCreateEditor((editor) => {
      setTimeout(() => {
        setupErrorDecorations(editor);
        
        // Активируем отображение полей с глифами для ошибок
        editor.updateOptions({
          glyphMargin: true,
          lineNumbersMinChars: 3,
          renderWhitespace: 'none',
          fontLigatures: false,
          renderValidationDecorations: 'on'
        });
        
        // Добавляем обработчики для лучшей поддержки Python
        if (editor.getModel()?.getLanguageId() === 'python') {
          // Обрабатываем события скролла
          const domNode = editor.getDomNode();
          if (domNode) {
            domNode.addEventListener('scroll', () => {
              requestAnimationFrame(() => {
                editor.render(false);
                
                // Обновляем декорации при скролле
                setupErrorDecorations(editor);
              });
            }, { passive: true });
          }
          
          // Используем debounce для рендеринга при изменении содержимого
          const debouncedRender = debounce(() => {
            editor.render(false);
            forceValidateEditor(editor);
          }, 250);
          
          editor.onDidChangeModelContent(() => {
            debouncedRender();
          });
          
          // Регистрируем обработчик изменения размера окна
          const handleResize = debounce(() => {
            editor.layout();
            setupErrorDecorations(editor);
          }, 100);
          
          window.addEventListener('resize', () => {
            handleResize();
          });
          
          // Запускаем принудительную валидацию после загрузки
          setTimeout(() => {
            forceValidateEditor(editor);
          }, 1000);
        }
      }, 100);
    });

    // Применяем стили к существующим редакторам при загрузке
    if (window.monaco && window.monaco.editor) {
      setTimeout(() => {
        if (window.setupAllErrorDecorations) {
          window.setupAllErrorDecorations();
        }
        
        // Принудительно проверяем все Python редакторы и обновляем диагностику
        updateAllPythonDiagnostics().then(() => {
          console.log('Python diagnostics updated for terminal integration');
        });
      }, 500);
    }

    // Экспортируем функцию регистрации
    return true;
  } catch (error) {
    console.error('Ошибка при регистрации поддержки Python:', error);
    return false;
  }
}