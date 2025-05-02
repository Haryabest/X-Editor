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
    monaco: any; // Используем any для избежания конфликтов
    pythonCheckErrors?: (code: string, model?: monaco.editor.ITextModel) => Promise<ScriptError[]>;
    pythonAddErrorListener?: (callback: ErrorCallbackFunction) => void;
    pythonShowProblemsInEditor?: (editor: MonacoEditor, errors: ScriptError[]) => void;
    pythonForceValidateEditor?: (editor: MonacoEditor) => void;
    // Функции для интеграции с Terminal.tsx
    getPythonDiagnostics?: () => any[];
    updatePythonDiagnostics?: () => Promise<any>;
    clearPythonFileDiagnostics?: (filePath: string) => void;
    clearAllPythonDiagnostics?: () => void;
    pythonDiagnostics?: Map<string, IssueInfo>;
    pythonDiagnosticsStore: Record<string, any[]>;
    lastKnownMarkers: Record<string, any[]>;
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
 * Удаляет дубликаты ошибок, оставляя только уникальные сообщения для каждой строки
 */
function removeDuplicateErrors(errors: ScriptError[]): ScriptError[] {
  // Если ошибок нет или всего одна, нет смысла обрабатывать
  if (!errors || errors.length <= 1) return errors;
  
  // Используем Map для хранения уникальных ошибок по строкам
  const uniqueErrors = new Map<number, Map<string, ScriptError>>();
  
  // Проходим по всем ошибкам
  for (const error of errors) {
    const lineNumber = error.lineNumber;
    const message = error.message;
    
    // Если для этой строки еще нет Map, создаем его
    if (!uniqueErrors.has(lineNumber)) {
      uniqueErrors.set(lineNumber, new Map<string, ScriptError>());
    }
    
    // Берем Map для текущей строки
    const lineErrors = uniqueErrors.get(lineNumber)!;
    
    // Если такого сообщения еще нет, добавляем его
    if (!lineErrors.has(message)) {
      lineErrors.set(message, error);
    }
  }
  
  // Преобразуем Map обратно в массив
  const result: ScriptError[] = [];
  uniqueErrors.forEach(lineErrors => {
    lineErrors.forEach(error => {
      result.push(error);
    });
  });
  
  console.log(`[Python] Дедупликация: было ${errors.length} ошибок, стало ${result.length}`);
  return result;
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
  
  // Регулярное выражение для обнаружения непарных кавычек - удалена по требованию пользователя
  
  // Дополнительные проверки для распространенных ошибок Python
  
  // Неправильное использование присваивания в условных выражениях
  const assignmentInCondition = /if\s*\(\s*\w+\s*=\s*[^=]/;
  
  // Проверка на попытку изменить кортеж
  const tupleModificationRegex = /\(\s*[\w\d,\s'"]*\)\s*\[\s*\d+\s*\]\s*=/;
  
  // Проверка использования зарезервированных слов как переменных
  const reservedWordsAsVars = /^\s*(class|def|if|else|elif|for|while|import|from|as|try|except|finally|with|return|yield|raise|assert|break|continue|pass|global|nonlocal|lambda|del)\s*=/;
  
  // Проверка неправильного использования lambda
  const invalidLambdaRegex = /lambda\s+\w+\s+[^:]/;
  
  // Проверка неправильного вызова методов объектов None
  const noneMethodCall = /None\.(append|extend|pop|remove|clear|update|keys|values|items|read|write|close)/;
  
  // Проверка обращения к элементам None
  const noneIndexAccess = /None\s*\[\s*\d+\s*\]/;
  
  // Проверка неправильных декораторов
  const invalidDecoratorRegex = /^\s*@[\w\.]+$/;
  
  // Проверка несоответствия аргументов функции
  const tooManyArgsRegex = /\b(len|print|sorted|int|float|str)\s*\([^()]*,[^()]*\)/;
  
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
      // Пропускаем эту проверку, так как она выдает "Отсутствует двоеточие в конце строки"
      // errors.push({
      //   lineNumber,
      //   message: 'Отсутствует двоеточие в конце строки',
      //   severity: 'error'
      // });
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
    
    // Проверка функциональных вызовов для определения правильности аргументов
    const funcCallMatch = trimmedLine.match(/(\w+)\s*\((.*)\)/);
    if (funcCallMatch && funcCallMatch[1]) {
      const funcName = funcCallMatch[1];
      const args = funcCallMatch[2].trim();
      const argsCount = args.length === 0 ? 0 : args.split(',').filter(arg => arg.trim().length > 0).length;
      
      // Проверка для встроенных функций с известным количеством аргументов
      if (funcName === 'len' && argsCount !== 1) {
        errors.push({
          lineNumber,
          message: `Функция len() принимает ровно 1 аргумент, указано ${argsCount}`,
          severity: 'error'
        });
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
    
    // Проверка присваивания в условных выражениях
    if (assignmentInCondition.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Вероятное использование присваивания вместо сравнения в условии',
        severity: 'error'
      });
    }
    
    // Проверка на попытку изменить кортеж
    if (tupleModificationRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Попытка изменения элемента кортежа. Кортежи в Python неизменяемы',
        severity: 'error'
      });
    }
    
    // Проверка использования зарезервированных слов как переменных
    if (reservedWordsAsVars.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Использование зарезервированного слова в качестве переменной',
        severity: 'error'
      });
    }
    
    // Проверка неправильного использования lambda
    if (invalidLambdaRegex.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Неправильный синтаксис lambda-выражения',
        severity: 'error'
      });
    }
    
    // Проверка неправильного вызова методов объектов None
    if (noneMethodCall.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Попытка вызова метода у объекта None',
        severity: 'error'
      });
    }
    
    // Проверка обращения к элементам None
    if (noneIndexAccess.test(trimmedLine)) {
      errors.push({
        lineNumber,
        message: 'Попытка индексации объекта None',
        severity: 'error'
      });
    }
    
    // Проверка неправильных декораторов
    if (invalidDecoratorRegex.test(trimmedLine) && idx + 1 < lines.length) {
      const nextLine = lines[idx + 1].trim();
      if (!nextLine.startsWith('def') && !nextLine.startsWith('class')) {
        errors.push({
          lineNumber,
          message: 'Декоратор должен быть применен к функции или классу',
          severity: 'error'
        });
      }
    }
    
    // Проверка слишком большого количества аргументов для встроенных функций
    if (tooManyArgsRegex.test(trimmedLine)) {
      const functionName = trimmedLine.match(/\b(len|print|sorted|int|float|str)\b/)?.[1];
      errors.push({
        lineNumber,
        message: `Функция '${functionName}' вызвана с неправильным количеством аргументов`,
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
        enhancedMessage = `�� ${error.message}`;
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
  // Сначала получаем сохраненные диагностики
  const diagValues = Array.from(pythonDiagnostics.values());
  console.log(`[Python] getAllPythonDiagnostics: найдено ${diagValues.length} файлов с проблемами в хранилище`);
  
  // Хранилище для файлов, которые уже получены из pythonDiagnostics
  const processedFiles = new Set<string>();
  diagValues.forEach(diag => {
    if (diag.filePath) {
      processedFiles.add(diag.filePath.replace(/\\/g, '/'));
    }
  });
  
  // Дополнительно проверим все актуальные маркеры из Monaco
  if (window.monaco && window.monaco.editor) {
    try {
      // Получаем все модели
      const models = window.monaco.editor.getModels();
      console.log(`[Python] getAllPythonDiagnostics: проверка ${models.length} моделей редактора`);
      
      for (const model of models) {
        if (!model || model.isDisposed()) continue;
        
        // Получаем маркеры для этой модели
        const uri = model.uri.toString();
        const normalizedUri = uri.replace(/\\/g, '/');
        
        // Пропускаем уже обработанные файлы
        if (processedFiles.has(normalizedUri)) {
          console.log(`[Python] Пропускаем уже обработанный файл: ${uri}`);
          continue;
        }
        
        // Получаем все маркеры для данной модели
        const allMarkers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        console.log(`[Python] Найдено ${allMarkers.length} маркеров для модели ${uri}`);
        
        if (allMarkers && allMarkers.length > 0) {
          // Получаем имя файла из URI
          const fileName = normalizedUri.split('/').pop() || 'unknown';
          
          // Создаем информацию о проблемах для этого файла
          const fileIssues: Issue[] = allMarkers.map((marker: monaco.editor.IMarkerData) => ({
            severity: marker.severity === 1 ? 'error' : 
                     marker.severity === 2 ? 'warning' : 'info',
            message: marker.message,
            line: marker.startLineNumber,
            column: marker.startColumn,
            endLine: marker.endLineNumber,
            endColumn: marker.endColumn,
            source: marker.source || 'monaco-editor',
            code: marker.code?.toString()
          }));
          
          // Если есть проблемы для этого файла, добавляем их
          if (fileIssues.length > 0) {
            diagValues.push({
              filePath: uri,
              fileName,
              issues: fileIssues
            });
            console.log(`[Python] Добавлены ${fileIssues.length} проблем для файла ${fileName}`);
          }
        }
      }
    } catch (e) {
      console.error('[Python] Ошибка при получении маркеров:', e);
    }
  }
  
  console.log(`[Python] getAllPythonDiagnostics: всего найдено ${diagValues.length} файлов с проблемами`);
  return diagValues;
}

/**
 * Обновляет диагностику для всех Python моделей
 */
async function updateAllPythonDiagnostics(): Promise<IssueInfo[]> {
  console.log('[Python] Запуск обновления всех диагностик Python');
  
  // Очищаем предыдущие диагностики
  pythonDiagnostics.clear();
  
  // Проверяем, есть ли открытые Python модели
  const models = monaco.editor.getModels();
  const pythonModels = models.filter(model => model.getLanguageId() === 'python');
  
  console.log(`[Python] Найдено ${pythonModels.length} Python моделей для проверки`);
  
  // Если нет открытых Python файлов, сразу возвращаем пустой массив
  if (pythonModels.length === 0) {
    console.log('[Python] Нет открытых Python файлов, очищаем все диагностики');
    // Отправляем событие обновления маркеров для очистки интерфейса
    document.dispatchEvent(new Event('markers-updated'));
    return [];
  }
  
  // Проверяем каждую модель Python
  for (const model of pythonModels) {
    try {
      const code = model.getValue();
      const filePath = model.uri.toString();
      console.log(`[Python] Проверка модели ${filePath}`);
      
      await checkPythonErrors(code, model);
    } catch (error) {
      console.error(`[Python] Ошибка при проверке модели: ${error}`);
    }
  }
  
  // Отправляем событие обновления маркеров
  document.dispatchEvent(new Event('markers-updated'));
  
  // Возвращаем обновленный список диагностик
  const result = getAllPythonDiagnostics();
  console.log(`[Python] Обновление диагностик завершено, найдено ${result.length} файлов с проблемами`);
  return result;
}

/**
 * Устанавливает маркеры ошибок в модель Monaco
 */
function setErrorMarkers(model: monaco.editor.ITextModel, errors: ScriptError[]): void {
  if (!model) return;
  
  // Сначала очищаем существующие маркеры
  monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, []);
  
  // Удаляем дубликаты ошибок перед преобразованием
  const uniqueErrors = removeDuplicateErrors(errors);
  
  // Преобразуем ScriptError в Monaco маркеры
  const markers: monaco.editor.IMarkerData[] = uniqueErrors.map(error => ({
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
    
    // Сохраняем диагностику в хранилище
    const filePath = model.uri.toString();
    const fileName = filePath.split('/').pop() || 'unknown.py';
    
    // Преобразуем ошибки в формат Issue для терминала
    const issues: Issue[] = uniqueErrors.map(convertToIssue);
    
    // Добавляем в хранилище диагностики
    pythonDiagnostics.set(filePath, {
      filePath,
      fileName,
      issues
    });
    
    // Сохраняем в lastKnownMarkers для быстрого доступа
    if (!window.lastKnownMarkers) {
      window.lastKnownMarkers = {};
    }
    window.lastKnownMarkers[filePath] = markers;
    
    // Сохраняем в pythonDiagnosticsStore для доступа из других компонентов
    if (!window.pythonDiagnosticsStore) {
      window.pythonDiagnosticsStore = {};
    }
    window.pythonDiagnosticsStore[filePath] = markers;
    
    console.log(`[Python] Установлено ${markers.length} маркеров для ${filePath} (${issues.length})`, issues);
    
    // Отправляем событие обновления маркеров с данными
    const markersEvent = new CustomEvent('markers-updated', {
      detail: { filePath, markers: issues }
    });
    document.dispatchEvent(markersEvent);
    
    // Отправляем событие monaco-markers-changed для терминала
    const monacoMarkersEvent = new CustomEvent('monaco-markers-changed', {
      detail: { 
        filePath, 
        markers, 
        owner: PYTHON_MARKER_OWNER,
        hasErrors: markers.some(m => m.severity === monaco.MarkerSeverity.Error)
      }
    });
    document.dispatchEvent(monacoMarkersEvent);
    
    // Отправляем дополнительные события для обновления панели проблем
    document.dispatchEvent(new CustomEvent('force-update-problems'));
    document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
    
    // При каждом обновлении маркеров обновляем также хранилище 'inmemory://model/1'
    // что позволит панели проблем видеть маркеры для этого специального файла
    if (window.lastKnownMarkers && markers.length > 0) {
      const inmemoryPath = 'inmemory://model/1';
      window.lastKnownMarkers[inmemoryPath] = [...markers];
      
      if (window.pythonDiagnosticsStore) {
        window.pythonDiagnosticsStore[inmemoryPath] = [...markers];
      }
      
      // Также добавляем запись в pythonDiagnostics
      pythonDiagnostics.set(inmemoryPath, {
        filePath: inmemoryPath,
        fileName: 'Python Errors',
        issues: [...issues]
      });
      
      console.log(`[Python] Добавлены маркеры в inmemory модель для отображения в панели проблем:`, 
        window.lastKnownMarkers[inmemoryPath]);
    }
  }
}

/**
 * Отображает ошибки в редакторе с использованием стандартных возможностей Monaco
 */
function showProblemsInEditor(editor: MonacoEditor, errors: ScriptError[]): void {
  if (!editor || !editor.getModel()) return;
  
  const model = editor.getModel();
  if (!model) return;
  
  // Очищаем существующие декорации и маркеры
  editor.deltaDecorations([], []);
  monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, []);
  
  // Если ошибок нет, просто выходим
  if (!errors || errors.length === 0) return;
  
  // Удаляем дубликаты ошибок перед отображением
  const uniqueErrors = removeDuplicateErrors(errors);
  
  // Преобразуем ScriptError в Monaco маркеры (без сообщений при наведении - они будут добавлены как декорации)
  const markers: monaco.editor.IMarkerData[] = uniqueErrors.map(error => ({
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
    
    // Сохраняем диагностику в хранилище
    const filePath = model.uri.toString();
    const fileName = filePath.split('/').pop() || 'unknown.py';
    
    // Преобразуем ошибки в формат Issue для терминала
    const issues: Issue[] = uniqueErrors.map(convertToIssue);
    
    // Добавляем в хранилище диагностики
    pythonDiagnostics.set(filePath, {
      filePath,
      fileName,
      issues
    });
    
    // Обновляем другие глобальные хранилища
    if (!window.lastKnownMarkers) window.lastKnownMarkers = {};
    window.lastKnownMarkers[filePath] = markers;
    
    if (!window.pythonDiagnosticsStore) window.pythonDiagnosticsStore = {};
    window.pythonDiagnosticsStore[filePath] = markers;
    
    // Отправляем события для обновления интерфейса
    document.dispatchEvent(new CustomEvent('markers-updated'));
    document.dispatchEvent(new CustomEvent('force-update-problems'));
    document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
  }
  
  // Добавляем декорации для выделения ошибок в редакторе
  const decorations: monaco.editor.IModelDeltaDecoration[] = uniqueErrors.map(error => {
    const isError = error.severity === 'error';
    const lineNumber = error.lineNumber;
    
    return {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: isError ? 'line-with-error' : 'line-with-warning',
        glyphMarginClassName: isError ? 'glyph-margin-error' : 'glyph-margin-warning',
        // Используем "неразделяемый" хеш для уникальности сообщения с префиксом, который не будет дублироваться
        hoverMessage: { value: `[VP-EDITOR-${isError ? 'ERROR' : 'WARNING'}-${Date.now() % 1000}] ${error.message}` },
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
    
    /* Стилизуем подсказки при наведении */
    .monaco-editor .monaco-hover-content {
      max-width: 500px !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
    }
    
    /* Скрываем префикс в подсказках */
    .monaco-editor .monaco-hover-content span[title^="[VP-EDITOR-"] {
      display: none !important;
    }
    
    /* Удаляем дубликаты сообщений */
    .monaco-editor .monaco-hover-content > div:not(:first-child) {
      display: none !important;
    }
    
    /* Наши стили подчеркивания - делаем их очень видимыми */
    .monaco-editor .thin-error-underline {
      border-bottom: 2px wavy #FF4C4C !important;
      padding-bottom: 1px !important;
      background-color: rgba(255, 76, 76, 0.1) !important;
      z-index: 100 !important;
      position: relative !important;
      pointer-events: auto !important;
    }
    
    .monaco-editor .thin-warning-underline {
      border-bottom: 2px wavy #FFCC00 !important;
      padding-bottom: 1px !important;
      background-color: rgba(255, 204, 0, 0.1) !important;
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
    
    /* Ограничиваем количество сообщений в подсказке */
    .monaco-editor .hover-row {
      max-height: 500px !important;
      overflow-y: auto !important;
    }
    
    /* Монако по умолчанию показывает все подсказки, скрываем дубликаты */
    .monaco-editor .hover-row > div > div > div:not(:first-child) {
      display: none !important;
    }
  `;
  
  // Если стиль уже есть, удаляем его и добавляем новый
  const existingStyle = document.getElementById('monaco-python-fixes');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  // Добавляем стиль с высоким приоритетом
  document.head.insertBefore(style, document.head.firstChild);
  
  // Применяем перехватчик для всех подсказок, чтобы очищать дубликаты
  window.setTimeout(() => {
    // Добавляем обработчик для подсказок Monaco
    document.addEventListener('DOMNodeInserted', (event) => {
      const target = event.target as HTMLElement;
      if (target.classList && target.classList.contains('monaco-hover')) {
        // Найден элемент подсказки
        cleanupDuplicateMessages(target);
      }
    }, false);
  }, 500);
}

/**
 * Очищает дублирующиеся сообщения в подсказке Monaco
 */
function cleanupDuplicateMessages(hoverElement: HTMLElement): void {
  try {
    // Получаем все сообщения в подсказке
    const messages = hoverElement.querySelectorAll('.hover-contents .hover-row .codicon-info ~ span');
    if (!messages || messages.length <= 1) return;
    
    // Набор для хранения уникальных сообщений
    const uniqueMessages = new Set<string>();
    
    // Проходим по всем сообщениям и скрываем дубликаты
    messages.forEach((message) => {
      const text = message.textContent || '';
      
      // Очищаем от возможного префикса идентификатора
      const cleanText = text.replace(/^\[VP-EDITOR-(ERROR|WARNING)-\d+\]\s*/, '');
      
      if (uniqueMessages.has(cleanText)) {
        // Это дубликат, скрываем элемент
        const parent = message.closest('.hover-row');
        if (parent && parent instanceof HTMLElement) {
          // Теперь TypeScript точно знает, что это HTMLElement
          parent.style.display = 'none';
        }
      } else {
        // Это новое сообщение, добавляем в набор
        uniqueMessages.add(cleanText);
      }
    });
    
    console.log(`[Python] Очищены дублирующиеся сообщения: найдено ${messages.length}, уникальных ${uniqueMessages.size}`);
  } catch (e) {
    console.error('[Python] Ошибка при очистке дубликатов:', e);
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
 * Очищает все диагностики для указанного файла
 */
function clearFileDiagnostics(filePath: string): void {
  console.log(`[Python] Очистка диагностики для файла: ${filePath}`);
  
  // Удаляем из хранилища диагностик
  if (pythonDiagnostics.has(filePath)) {
    pythonDiagnostics.delete(filePath);
    console.log(`[Python] Диагностика для файла ${filePath} удалена`);
  }
  
  // Очищаем маркеры в модели, если она существует
  try {
    const models = monaco.editor.getModels();
    for (const model of models) {
      const modelUri = model.uri.toString();
      if (modelUri === filePath || modelUri.replace(/\\/g, '/') === filePath.replace(/\\/g, '/')) {
        monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, []);
        console.log(`[Python] Маркеры для модели ${modelUri} очищены`);
        break;
      }
    }
  } catch (error) {
    console.error(`[Python] Ошибка при очистке маркеров: ${error}`);
  }
  
  // Отправляем событие обновления маркеров
  document.dispatchEvent(new CustomEvent('markers-updated', {
    detail: { filePath, cleared: true }
  }));
}

/**
 * Очищает все диагностики
 */
function clearAllDiagnostics(): void {
  console.log('[Python] Очистка всех диагностик Python');
  
  // Очищаем хранилище диагностик
  pythonDiagnostics.clear();
  
  // Очищаем маркеры для всех моделей Python
  try {
    const models = monaco.editor.getModels();
    for (const model of models) {
      if (model.getLanguageId() === 'python') {
        monaco.editor.setModelMarkers(model, PYTHON_MARKER_OWNER, []);
      }
    }
  } catch (error) {
    console.error(`[Python] Ошибка при очистке всех маркеров: ${error}`);
  }
  
  // Отправляем событие обновления маркеров
  document.dispatchEvent(new Event('markers-updated'));
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
    window.clearPythonFileDiagnostics = clearFileDiagnostics;
    window.clearAllPythonDiagnostics = clearAllDiagnostics;
    window.pythonDiagnostics = pythonDiagnostics;
    
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
        
        /* Стилизуем подсказки при наведении */
        .monaco-editor .monaco-hover-content {
          max-width: 500px !important;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        
        /* Скрываем префикс в подсказках */
        .monaco-editor .monaco-hover-content span[title^="[VP-EDITOR-"] {
          display: none !important;
        }
        
        /* Удаляем дубликаты сообщений */
        .monaco-editor .monaco-hover-content > div:not(:first-child) {
          display: none !important;
        }
        
        /* Наши стили подчеркивания - делаем их очень видимыми */
        .monaco-editor .thin-error-underline {
          border-bottom: 2px wavy #FF4C4C !important;
          padding-bottom: 1px !important;
          background-color: rgba(255, 76, 76, 0.1) !important;
          z-index: 100 !important;
          position: relative !important;
          pointer-events: auto !important;
        }
        
        .monaco-editor .thin-warning-underline {
          border-bottom: 2px wavy #FFCC00 !important;
          padding-bottom: 1px !important;
          background-color: rgba(255, 204, 0, 0.1) !important;
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

    // Добавим обработку событий изменения файла и директории
    const handleActiveFileChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{filePath: string}>;
      const filePath = customEvent.detail.filePath;
      
      // Обновляем диагностику при смене активного файла
      if (filePath && filePath.endsWith('.py')) {
        console.log(`[Python] Обновление диагностики для нового активного файла: ${filePath}`);
        
        // Ищем модель для этого файла
        const models = monaco.editor.getModels();
        const pythonModel = models.find(model => 
          model.uri.toString() === filePath || 
          model.uri.toString().replace(/\\/g, '/') === filePath.replace(/\\/g, '/')
        );
        
        if (pythonModel) {
          const code = pythonModel.getValue();
          checkPythonErrors(code, pythonModel).catch(err => {
            console.error(`[Python] Ошибка при проверке активного файла: ${err}`);
          });
        }
      }
    };
    
    const handleDirectoryChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{path: string}>;
      const directoryPath = customEvent.detail.path;
      
      console.log(`[Python] Директория изменена: ${directoryPath}, очищаем все диагностики`);
      clearAllDiagnostics();
    };
    
    document.addEventListener('active-file-changed', handleActiveFileChanged);
    document.addEventListener('directory-changed', handleDirectoryChanged);

    // Инициализируем хранилища для диагностик, если они не существуют
    if (!window.pythonDiagnostics) {
      window.pythonDiagnostics = pythonDiagnostics;
    }
    
    if (!window.pythonDiagnosticsStore) {
      window.pythonDiagnosticsStore = {};
    }
    
    if (!window.lastKnownMarkers) {
      window.lastKnownMarkers = {};
    }
    
    // Отправляем события инициализации, чтобы другие компоненты могли реагировать
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('python-initialized'));
      document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
    }, 500);
    
    console.log('[Python] Поддержка Python успешно инициализирована');
    
    // Запускаем начальную проверку для всех открытых Python файлов
    setTimeout(() => {
      updateAllPythonDiagnostics().then(diagnostics => {
        console.log(`[Python] Начальная проверка завершена: найдено ${diagnostics.length} файлов с проблемами`);
        
        // Принудительно обновляем панель проблем после инициализации
        document.dispatchEvent(new CustomEvent('markers-updated'));
      });
    }, 1000);

    return true;
  } catch (error) {
    console.error(`[Python] Ошибка инициализации Python: ${error}`);
    return false;
  }
}

/**
 * Применяет тонкие подчеркивания вместо красных линий
 */
function applyThinUnderlineDecorations(editor: MonacoEditor): void {
  if (!editor || !editor.getModel) return;
  
  const model = editor.getModel();
  if (!model) return;
  
  // Получаем маркеры для данной модели
  const markers = monaco.editor.getModelMarkers({ resource: model.uri });
  
  // Удаляем дубликаты маркеров перед созданием декораций, используя похожий подход
  const uniqueMarkers: monaco.editor.IMarkerData[] = [];
  const seenMessages = new Map<number, Set<string>>();
  
  for (const marker of markers) {
    const lineNumber = marker.startLineNumber;
    const message = marker.message;
    
    if (!seenMessages.has(lineNumber)) {
      seenMessages.set(lineNumber, new Set<string>());
    }
    
    const lineMessages = seenMessages.get(lineNumber)!;
    if (!lineMessages.has(message)) {
      lineMessages.add(message);
      uniqueMarkers.push(marker);
    }
  }
  
  // Создаем новые декорации только с подчеркиванием
  const decorations = uniqueMarkers.map(marker => ({
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