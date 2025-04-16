/**
 * Python LSP Starter
 * 
 * Модуль для запуска и управления Python LSP сервером
 */

import { languageServerManager } from './monaco-lsp-server-manager';
import { lspDocumentManager } from './lsp-document-manager';
import { MonacoLSPDiagnostics } from './monaco-lsp-diagnostics';

// Импорт необходимых типов
import * as monaco from 'monaco-editor';

// Определение типов LSP
interface DiagnosticPosition {
  line: number;
  character: number;
}

interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

interface Diagnostic {
  range: DiagnosticRange;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: any[];
  tags?: number[];
}

// Определяем перечисление для уровней важности диагностики
enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}

// Глобальные переменные для отслеживания состояния
let pythonLSPInitialized = false;
let diagnosticHandlersInitialized = false;

// Переменные для дебаунсинга обновления диагностики
const diagnosticsUpdateDebounce = new Map<string, NodeJS.Timeout>();
const diagnosticsUpdateDelay = 1000; // 1 секунда задержки

/**
 * Инициализация Python LSP сервера
 * @returns Успешность инициализации
 */
export async function initializePythonLSP(): Promise<boolean> {
  console.log('Инициализация Python LSP сервера...');
  
  if (pythonLSPInitialized) {
    console.log('Python LSP сервер уже инициализирован');
    return true;
  }
  
  try {
    // Проверяем доступность менеджера языковых серверов
    if (!languageServerManager) {
      console.error('Менеджер языковых серверов не доступен');
      return false;
    }
    
    // Регистрируем Python сервер, если он еще не зарегистрирован
    if (!languageServerManager.getServer('python')) {
      // Добавляем расширенную конфигурацию для Python LSP
      const pythonConfig = {
        id: 'python',
        name: 'Python Language Server',
        supportedLanguages: ['python'],
        // Добавляем расширенные настройки для Python LSP
        serverOptions: {
          // Указываем настройки для сервера
          initializationOptions: {
            // Явно указываем, что требуется проверка синтаксиса
            diagnostics: { enable: true, lint: { enabled: true } },
            completion: { enabled: true },
            hover: { enabled: true },
            // Включаем pylint и pycodestyle для проверки
            plugins: {
              pycodestyle: { enabled: true }, 
              pylint: { enabled: true },
              jedi_completion: { enabled: true },
              jedi_hover: { enabled: true },
              jedi_references: { enabled: true },
              jedi_definition: { enabled: true },
              jedi_symbols: { enabled: true },
              jedi_signature_help: { enabled: true },
              pyflakes: { enabled: true },
              mccabe: { enabled: true },
              preload: { enabled: true }
            }
          }
        }
      };
      
      languageServerManager.registerServer(pythonConfig);
      console.log('Python LSP сервер зарегистрирован с расширенной конфигурацией');
    }
    
    // Запускаем Python сервер
    const success = await languageServerManager.startServer('python');
    
    if (success) {
      console.log('Python LSP сервер успешно запущен');
      pythonLSPInitialized = true;
      
      // Проверяем наличие хранилища диагностики
      if (!(window as any).pythonDiagnosticsStore) {
        console.warn('Хранилище диагностики Python не создано. Убедитесь, что registerPython был вызван.');
      }
      
      return true;
    } else {
      console.warn('Не удалось запустить Python LSP сервер');
      return false;
    }
  } catch (error) {
    console.error('Ошибка при инициализации Python LSP сервера:', error);
    return false;
  }
}

/**
 * Проверка подключения к Python LSP серверу
 * @returns Статус подключения
 */
export function isPythonLSPConnected(): boolean {
  try {
    if (!languageServerManager) return false;
    return languageServerManager.isServerRunning('python');
  } catch (error) {
    console.error('Ошибка при проверке подключения к Python LSP серверу:', error);
    return false;
  }
}

/**
 * Получение статуса Python LSP сервера
 * @returns Объект со статусом сервера
 */
export function getPythonLSPStatus(): { running: boolean, message: string } {
  try {
    if (!languageServerManager) {
      return { running: false, message: 'Менеджер языковых серверов не доступен' };
    }
    
    const isRunning = languageServerManager.isServerRunning('python');
    
    if (isRunning) {
      return { 
        running: true, 
        message: 'Python LSP сервер запущен и работает'
      };
    } else {
      return { running: false, message: 'Python LSP сервер не запущен' };
    }
  } catch (error) {
    console.error('Ошибка при получении статуса Python LSP сервера:', error);
    return { running: false, message: 'Ошибка при получении статуса' };
  }
}

/**
 * Обновление диагностики для всех Python файлов
 * @returns Promise с количеством обновленных файлов
 */
export async function updateAllPythonDiagnostics(): Promise<boolean> {
  try {
    console.log('🐍 Запуск обновления диагностики для всех Python файлов...');
    
    if (!isPythonLSPConnected()) {
      console.warn('Python LSP сервер не подключен, инициализация...');
      const initialized = await initializePythonLSP();
      if (!initialized) {
        console.error('Не удалось инициализировать Python LSP сервер');
        return false;
      }
    }
    
    // Получаем все документы
    const allDocuments = lspDocumentManager.getAllDocumentUris();
    if (!allDocuments || allDocuments.length === 0) {
      console.log('Нет открытых документов для диагностики');
      return true;
    }
    
    // Выбираем Python документы
    const pythonDocuments = allDocuments.filter(uri => 
      uri.endsWith('.py') || uri.endsWith('.pyw') || uri.endsWith('.pyi') ||
      lspDocumentManager.getDocument(uri)?.languageId === 'python'
    );
    
    if (pythonDocuments.length === 0) {
      console.log('Нет открытых Python документов для диагностики');
      return true;
    }
    
    console.log(`🐍 Обработка ${pythonDocuments.length} Python файлов...`);
    
    // Запрашиваем диагностику для каждого Python документа
    for (const uri of pythonDocuments) {
      try {
        await updatePythonDiagnosticsForFile(uri);
      } catch (error) {
        console.error(`Ошибка при обновлении диагностики для ${uri}:`, error);
      }
    }
    
    console.log(`🐍 Диагностика запрошена для ${pythonDocuments.length} Python файлов`);
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении всех Python диагностик:', error);
    return false;
  }
}

/**
 * Обновление диагностики для конкретного Python файла
 * @param filepath Путь к файлу или URI
 * @returns Promise с результатом операции
 */
export async function updatePythonDiagnosticsForFile(fileURI: string): Promise<void> {
  try {
    const isPythonFile = fileURI.endsWith('.py') || fileURI.endsWith('.pyi');
    if (!isPythonFile) {
      return;
    }

    if (!window.pyLspConn) {
      console.warn('LSP not connected, cannot update diagnostics');
      return;
    }

    console.log(`🐍 Updating diagnostics for ${fileURI}`);

    // Получаем содержимое файла
    const fileContent = await getFileContent(fileURI);
    if (!fileContent) {
      console.warn(`Could not get content for ${fileURI}`);
      return;
    }

    // Нормализуем путь
    const normalizedUri = normalizeFileURI(fileURI);
    
    // Добавляем документ в LSP
    addDocumentToLsp(normalizedUri, fileContent);
    
    // Запрашиваем диагностику файла через LSP
    await validatePythonFile(normalizedUri, fileContent);
    
    // Обновляем диагностику в редакторе
    if (window.pythonDiagnosticsStore && window.monaco) {
      // Получаем все маркеры для текущего файла
      const markers = window.pythonDiagnosticsStore.getMarkersForUri(normalizedUri);
      
      // Преобразуем маркеры в формат для Monaco Editor
      const monacoMarkers = markers.map((marker: any) => ({
        severity: marker.severity,
        message: marker.message,
        startLineNumber: marker.range.start.line + 1,
        startColumn: marker.range.start.character + 1,
        endLineNumber: marker.range.end.line + 1,
        endColumn: marker.range.end.character + 1,
        source: marker.source || 'Python'
      }));
      
      // Устанавливаем маркеры в редакторе
      window.monaco.editor.setModelMarkers(
        getModelForUri(normalizedUri) || null,
        'python',
        monacoMarkers
      );
      
      // Отправляем событие с обновленными диагностиками для панели проблем
      const diagnosticEvent = new CustomEvent('pythonDiagnosticsUpdated', {
        detail: getPythonDiagnostics()
      });
      window.dispatchEvent(diagnosticEvent);
    }
  } catch (error) {
    console.error(`Error updating Python diagnostics for ${fileURI}:`, error);
  }
}

/**
 * Принудительное обновление диагностики для Python файла
 * @param filepath Путь к файлу или URI
 * @returns Promise с результатом операции
 */
export async function forcePythonDiagnosticsUpdate(filepath: string) {
  console.log(`🐍 Ручной запрос диагностики для: ${filepath}`);
  
  const result = await updatePythonDiagnosticsForFile(filepath);
  
  // Проверяем, были ли найдены ошибки
  if (result && typeof window !== 'undefined' && (window as any).pythonDiagnosticsStore) {
    // Получаем маркеры для данного файла
    const diagnosticsStore = (window as any).pythonDiagnosticsStore;
    
    try {
      // Пытаемся найти модель URI для файла
      let fileUri: string;
      
      if (filepath.startsWith('file://')) {
        fileUri = filepath;
      } else {
        fileUri = `file://${filepath.replace(/\\/g, '/')}`;
      }
      
      // Преобразуем в URI
      let monacoUri: string;
      try {
        if (window.monaco) {
          monacoUri = window.monaco.Uri.file(filepath.replace(/\\/g, '/')).toString();
        } else {
          monacoUri = fileUri;
        }
      } catch (e) {
        monacoUri = fileUri;
      }
      
      // Проверяем обе версии URI
      let markers = diagnosticsStore.getMarkers(fileUri);
      if (!markers || markers.length === 0) {
        markers = diagnosticsStore.getMarkers(monacoUri);
      }
      
      // Если нашли маркеры, показываем уведомление
      if (markers && markers.length > 0) {
        console.log(`🐍 Найдено ${markers.length} проблем в файле ${filepath}`);
        
        const errorCount = markers.filter((m: any) => 
          m.severity === (window.monaco?.MarkerSeverity.Error || 8)
        ).length;
        
        const warningCount = markers.filter((m: any) => 
          m.severity === (window.monaco?.MarkerSeverity.Warning || 4)
        ).length;
        
        // Показываем уведомление
        const message = `Python: ${errorCount} ошибок, ${warningCount} предупреждений`;
        
        // Отправляем событие для отображения уведомления
        if (errorCount > 0 || warningCount > 0) {
          document.dispatchEvent(new CustomEvent('show-notification', {
            detail: {
              message,
              type: errorCount > 0 ? 'error' : 'warning',
              duration: 5000
            }
          }));
        }
      } else {
        console.log(`🐍 Проблем в файле ${filepath} не найдено`);
        
        // Показываем успешное уведомление
        document.dispatchEvent(new CustomEvent('show-notification', {
          detail: {
            message: 'Python: Ошибок не найдено',
            type: 'success',
            duration: 3000
          }
        }));
      }
      
      // Применяем декорации ошибок ко всем редакторам и обновляем панель проблем
      if (window.monaco) {
        if (window.setupAllErrorDecorations && typeof window.setupAllErrorDecorations === 'function') {
          // Обновляем все декорации для всех редакторов
          window.setupAllErrorDecorations();
        } else if (window.forceUpdateAllDecorations && typeof window.forceUpdateAllDecorations === 'function') {
          // Резервный вариант, если setupAllErrorDecorations не доступна
          window.forceUpdateAllDecorations();
        }
      }
    } catch (e) {
      console.error('Ошибка при проверке результатов диагностики:', e);
    }
  }
  
  return result;
}

/**
 * Очистка диагностики для всех Python файлов
 */
export function clearAllPythonDiagnostics(): void {
  if ((window as any).pythonDiagnosticsStore) {
    (window as any).pythonDiagnosticsStore.clearAllMarkers();
    console.log('Очищены все диагностики Python');
  }
}

/**
 * Проверка, доступна ли диагностика Python
 */
export function isPythonDiagnosticsAvailable(): boolean {
  return !!(window as any).pythonDiagnosticsStore;
}

/**
 * Преобразование уровня важности LSP в уровень Monaco
 * @param severity Уровень важности диагностики
 * @returns Уровень важности для Monaco
 */
const mapSeverity = (severity: DiagnosticSeverity | undefined): number => {
  if (!severity) return 1; // По умолчанию Info

  switch (severity) {
    case DiagnosticSeverity.Error:
      return 8; // monaco.MarkerSeverity.Error
    case DiagnosticSeverity.Warning:
      return 4; // monaco.MarkerSeverity.Warning
    case DiagnosticSeverity.Information:
      return 2; // monaco.MarkerSeverity.Info
    case DiagnosticSeverity.Hint:
      return 1; // monaco.MarkerSeverity.Hint
    default:
      return 2; // Info по умолчанию
  }
};

/**
 * Обновление диагностики Python для модели
 * @param model Модель текста Monaco
 * @param pyDiags Массив диагностик Python
 */
const updatePythonDiagnostics = (
  model: any, // Используем any для модели Monaco
  pyDiags: Diagnostic[]
) => {
  if (!model || !window.monaco?.editor?.setModelMarkers) {
    console.error('Не удалось обновить диагностику: Monaco или модель недоступны');
    return;
  }

  try {
    // Убеждаемся, что мы получаем все диагностики, а не только часть из них
    console.log(`[Python] Получено ${pyDiags.length} диагностик для обработки`);
    
    // Усиливаем обнаружение синтаксических ошибок
    let syntaxErrorDetected = false;
    let markers = pyDiags.map((diag) => {
      const startPos = diag.range.start;
      const endPos = diag.range.end;
      
      // Делаем сообщения более компактными
      let message = diag.message;
      
      // Обрезаем длинные сообщения
      if (message.length > 100) {
        message = message.substring(0, 97) + '...';
      }
      
      // Определяем, является ли это синтаксической ошибкой
      const isSyntaxError = 
        message.includes('SyntaxError') || 
        message.includes('синтаксическая ошибка') ||
        message.includes('недопустимый синтаксис') ||
        message.includes('invalid syntax') ||
        message.includes('expected') ||
        message.includes('ожидалось');
      
      if (isSyntaxError) {
        syntaxErrorDetected = true;
        // Приоритизируем и улучшаем синтаксические ошибки
        message = `Синтаксическая ошибка: ${message}`;
      }
      
      // Удаляем избыточную информацию
      message = message
        .replace(/Python \[\d+(\.\d+)*\]/g, '')
        .replace(/\(pycodestyle\)/g, '')
        .replace(/\(pylint\)/g, '')
        .replace(/\(mypy\)/g, '')
        .replace(/\(pyflakes\)/g, '')
        .replace(/(^\s+|\s+$)/g, ''); // Удаляем пробелы в начале и конце

      // Добавляем короткую версию сообщения для компактного отображения
      const shortMessage = message.length > 50 ? message.substring(0, 47) + '...' : message;

      // Принудительно устанавливаем более высокую важность для синтаксических ошибок
      let severity = mapSeverity(diag.severity);
      if (isSyntaxError) {
        severity = 8; // MarkerSeverity.Error
      }

      return {
        severity: severity,
        startLineNumber: startPos.line + 1,
        startColumn: startPos.character + 1,
        endLineNumber: endPos.line + 1,
        endColumn: endPos.character + 1,
        message: message,
        shortMessage: shortMessage, // Сохраняем короткое сообщение
        code: diag.code,
        source: diag.source || 'Python', // Сохраняем оригинальный источник
        isSyntaxError: isSyntaxError // Добавляем флаг синтаксической ошибки
      };
    });
    
    // Если анализатор не выявил ошибок, но файл содержит синтаксические ошибки,
    // выполняем дополнительную проверку содержимого файла
    if (!syntaxErrorDetected && model && model.getValue) {
      const content = model.getValue();
      try {
        // Проверяем наличие очевидных синтаксических ошибок, которые мог пропустить LSP
        // Проверка на незакрытые скобки, кавычки и т.д.
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Проверяем незакрытые строки
          const unclosedString = line.match(/(['"])(?:(?!\1)[^\\]|\\[\s\S])*$/);
          // Проверяем незакрытые скобки
          const openBrackets = (line.match(/\(/g) || []).length;
          const closeBrackets = (line.match(/\)/g) || []).length;
          const openSquare = (line.match(/\[/g) || []).length;
          const closeSquare = (line.match(/\]/g) || []).length;
          const openCurly = (line.match(/\{/g) || []).length;
          const closeCurly = (line.match(/\}/g) || []).length;
          
          if (unclosedString || 
              openBrackets > closeBrackets || 
              openSquare > closeSquare || 
              openCurly > closeCurly) {
            // Добавляем синтаксическую ошибку, если нашли
            markers.push({
              severity: 8, // MarkerSeverity.Error
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              message: 'Возможно наличие незакрытых скобок или кавычек',
              shortMessage: 'Незакрытые скобки/кавычки',
              code: 'syntax',
              source: 'Python Validator',
              isSyntaxError: true
            });
          }
          
          // Проверяем отсутствие двоеточия после control flow statements
          if (line.match(/^\s*(if|for|while|def|class|with|try|except|finally)\s+[^:]*$/)) {
            markers.push({
              severity: 8, // MarkerSeverity.Error
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              message: 'Синтаксическая ошибка: отсутствует двоеточие',
              shortMessage: 'Отсутствует двоеточие',
              code: 'syntax',
              source: 'Python Validator',
              isSyntaxError: true
            });
          }
          
          // Проверяем использование неопределенных переменных
          const variableMatch = line.match(/\b(print|return|assert)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/);
          if (variableMatch && variableMatch[2]) {
            const varName = variableMatch[2];
            // Проверяем, определена ли переменная где-то в файле
            if (!content.includes(`${varName} =`) && 
                !content.includes(`def ${varName}`) &&
                !content.includes(`class ${varName}`) &&
                !content.includes(`import ${varName}`) &&
                !content.includes(`from`) &&
                !['os', 'sys', 'math', 'random', 'datetime', 'time', 'json', 're', 'functools', 'collections'].includes(varName)) {
              markers.push({
                severity: 8, // MarkerSeverity.Error
                startLineNumber: i + 1,
                startColumn: line.indexOf(varName),
                endLineNumber: i + 1,
                endColumn: line.indexOf(varName) + varName.length,
                message: `Ошибка: использование неопределенной переменной "${varName}"`,
                shortMessage: `Неопределенная переменная: ${varName}`,
                code: 'undefined-variable',
                source: 'Python Validator',
                isSyntaxError: false
              });
            }
          }
          
          // Проверка деления на ноль
          const divisionByZeroMatch = line.match(/\b(\w+)\s*\/\s*(0|0\.0*)\b/);
          if (divisionByZeroMatch) {
            markers.push({
              severity: 8, // MarkerSeverity.Error
              startLineNumber: i + 1,
              startColumn: line.indexOf(divisionByZeroMatch[0]),
              endLineNumber: i + 1,
              endColumn: line.indexOf(divisionByZeroMatch[0]) + divisionByZeroMatch[0].length,
              message: 'Ошибка: деление на ноль',
              shortMessage: 'Деление на ноль',
              code: 'division-by-zero',
              source: 'Python Validator',
              isSyntaxError: false
            });
          }
          
          // Проверка на пустые списки в условиях
          const emptyListCheck = line.match(/\bif\s+\[\s*\]\s*:/);
          if (emptyListCheck) {
            markers.push({
              severity: 4, // MarkerSeverity.Warning
              startLineNumber: i + 1,
              startColumn: line.indexOf('[]'),
              endLineNumber: i + 1,
              endColumn: line.indexOf('[]') + 2,
              message: 'Предупреждение: Пустой список всегда оценивается как False',
              shortMessage: 'Условие с пустым списком',
              code: 'empty-list-condition',
              source: 'Python Validator',
              isSyntaxError: false
            });
          }
          
          // Проверка сравнения с None с использованием == вместо is
          const noneEqualityCheck = line.match(/\b(\w+)\s*==\s*None\b|\bNone\s*==\s*(\w+)\b/);
          if (noneEqualityCheck) {
            markers.push({
              severity: 4, // MarkerSeverity.Warning
              startLineNumber: i + 1,
              startColumn: line.indexOf(noneEqualityCheck[0]),
              endLineNumber: i + 1,
              endColumn: line.indexOf(noneEqualityCheck[0]) + noneEqualityCheck[0].length,
              message: 'Рекомендуется использовать "is None" вместо "== None"',
              shortMessage: 'Используйте "is None"',
              code: 'none-equality',
              source: 'Python Validator',
              isSyntaxError: false
            });
          }
          
          // Проверка вызова функций с неправильным числом аргументов 
          // Проверяем вызовы функций, определенных в том же файле
          const funcCallMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)/);
          if (funcCallMatch) {
            const funcName = funcCallMatch[1];
            const argCount = funcCallMatch[2].split(',').filter(arg => arg.trim()).length;
            
            // Поиск определения функции
            const funcDefRegex = new RegExp(`def\\s+${funcName}\\s*\\(([^)]+)\\)`, 'g');
            const funcDefMatch = [...content.matchAll(funcDefRegex)];
            
            if (funcDefMatch.length > 0) {
              // Находим последнее определение функции
              const funcDef = funcDefMatch[funcDefMatch.length - 1];
              const params = funcDef[1].split(',').filter(param => param.trim());
              
              // Считаем количество обязательных параметров (без значений по умолчанию)
              const requiredParams = params.filter(param => !param.includes('=')).length;
              
              // Проверяем, соответствует ли количество аргументов количеству параметров
              if (argCount < requiredParams) {
                markers.push({
                  severity: 8, // MarkerSeverity.Error
                  startLineNumber: i + 1,
                  startColumn: line.indexOf(funcCallMatch[0]),
                  endLineNumber: i + 1,
                  endColumn: line.indexOf(funcCallMatch[0]) + funcCallMatch[0].length,
                  message: `Ошибка: недостаточно аргументов для функции "${funcName}". Ожидается минимум ${requiredParams}, получено ${argCount}`,
                  shortMessage: `Недостаточно аргументов для ${funcName}`,
                  code: 'arguments-count',
                  source: 'Python Validator',
                  isSyntaxError: false
                });
              }
            }
          }
        }
      } catch (parseErr) {
        console.warn('[Python] Ошибка при дополнительной проверке синтаксиса:', parseErr);
      }
    }

    // Устанавливаем маркеры в модель Monaco
    console.log(`[Python] Установка ${markers.length} маркеров для модели ${model.uri.toString()}`);
    window.monaco.editor.setModelMarkers(model, 'python', markers);

    // Обновляем все декорации в редакторах, использующих эту модель
    if (window.monaco.editor && window.monaco.editor.getEditors) {
      const editors = window.monaco.editor.getEditors().filter((editor: any) => 
        editor.getModel() && editor.getModel().uri.toString() === model.uri.toString()
      );

      if (editors.length > 0) {
        console.log(`[Python] Обновление декораций для ${editors.length} редакторов`);
        
        editors.forEach((editor: any) => {
          try {
            // Если есть глобальная функция setup, используем её
            if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
              window.setupErrorDecorations(editor);
            } else {
              // Применяем декорации напрямую
              // Убедимся, что у редактора включены нужные опции
              editor.updateOptions({ 
                glyphMargin: true, 
                lineNumbers: 'on',
                minimap: { enabled: true } 
              });
              
              // Устанавливаем стили, если их еще нет
              if (!document.getElementById('python-error-compact-styles')) {
                const style = document.createElement('style');
                style.id = 'python-error-compact-styles';
                style.innerHTML = `
                  .python-error-decoration { 
                    background-color: transparent !important; 
                    border-bottom: 1px wavy red !important;
                    border-left: 2px solid red !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    max-height: 18px !important;
                  }
                  .python-warning-decoration { 
                    background-color: transparent !important; 
                    border-bottom: 1px wavy orange !important;
                    border-left: 2px solid orange !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    max-height: 18px !important;
                  }
                  .python-error-inline { 
                    background-color: transparent !important;
                    border-bottom: 1px wavy red !important;
                    font-size: inherit !important;
                    line-height: inherit !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .python-warning-inline { 
                    background-color: transparent !important;
                    border-bottom: 1px wavy orange !important;
                    font-size: inherit !important;
                    line-height: inherit !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .error-glyph { 
                    width: 12px !important; 
                    height: 12px !important; 
                    display: inline-block !important;
                    margin-left: 3px !important;
                    background-color: transparent !important;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important; 
                    background-size: 12px 12px !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                  }
                  .warning-glyph { 
                    width: 12px !important; 
                    height: 12px !important;
                    display: inline-block !important;
                    margin-left: 3px !important;
                    background-color: transparent !important;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
                    background-size: 12px 12px !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                  }
                  /* Увеличиваем компактность всех линий в редакторе */
                  .monaco-editor .view-lines {
                    line-height: 1.3 !important;
                  }
                  .monaco-editor .view-line {
                    padding: 0 !important;
                    margin: 0 !important;
                    min-height: 0 !important;
                  }
                  /* Компактная версия всплывающих подсказок */
                  .monaco-hover-content {
                    font-size: 12px !important;
                    line-height: 1.2 !important;
                    padding: 4px 6px !important;
                  }
                  .monaco-editor-hover {
                    max-width: 500px !important;
                  }
                `;
                document.head.appendChild(style);
              }
              
              // Создаем декорации на основе маркеров
              const errorDecorations = markers.map((marker: any) => {
                // Создаем диапазон безопасным способом
                let range;
                try {
                  range = {
                    startLineNumber: marker.startLineNumber,
                    startColumn: marker.startColumn, 
                    endLineNumber: marker.endLineNumber,
                    endColumn: marker.endColumn
                  };
                } catch (err) {
                  console.warn('[Python] Ошибка при создании диапазона маркера:', err);
                  return null;
                }

                return {
                  range: range,
                  options: {
                    className: marker.severity === 8 ? 'python-error-decoration' : 'python-warning-decoration',
                    hoverMessage: { value: marker.message },
                    inlineClassName: marker.severity === 8 ? 'python-error-inline' : 'python-warning-inline',
                    glyphMarginClassName: marker.severity === 8 ? 'error-glyph' : 'warning-glyph',
                    isWholeLine: false,
                    overviewRuler: {
                      color: marker.severity === 8 ? 'red' : 'orange',
                      position: window.monaco.editor.OverviewRulerLane.Right
                    }
                  }
                };
              }).filter(Boolean); // Убираем null значения
              
              // Удаляем старые декорации и применяем новые
              const oldDecorations = editor.getDecorationsInRange(model.getFullModelRange()) || [];
              const oldDecorationIds = oldDecorations
                .filter((d: any) => d.options.className?.includes('python-') || 
                                d.options.glyphMarginClassName?.includes('-glyph'))
                .map((d: any) => d.id);
              
              console.log(`[Python] Удалено ${oldDecorationIds.length} старых декораций`);
              editor.deltaDecorations(oldDecorationIds, errorDecorations);
            }
          } catch (err) {
            console.error('[Python] Ошибка при обновлении декораций:', err);
          }
        });
      }
    }
    
    // Обновляем панель проблем, если доступно хранилище диагностики
    if (window.pythonDiagnosticsStore) {
      // Преобразуем маркеры для хранилища
      const storeMarkers = markers.map((marker: any) => ({
        severity: marker.severity === 8 ? 'error' : marker.severity === 4 ? 'warning' : 'info', // Конвертируем в строковое представление
        range: {
          start: { 
            line: marker.startLineNumber - 1, 
            character: marker.startColumn - 1 
          },
          end: {
            line: marker.endLineNumber - 1,
            character: marker.endColumn - 1
          }
        },
        message: marker.message,
        rawMessage: marker.shortMessage || marker.message,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        source: marker.source || 'Python Validator',
        code: marker.code || (marker.isSyntaxError ? 'syntax-error' : undefined)
      }));
      
      // Устанавливаем маркеры в хранилище
      const fileUri = model.uri.toString();
      window.pythonDiagnosticsStore.setMarkers(fileUri, storeMarkers);
      
      // Создаем проблемы для панели проблем
      const filePathFromUri = fileUri.replace('file://', '');
      const fileName = filePathFromUri.split('/').pop() || filePathFromUri.split('\\').pop() || 'unknown';
      
      // Организуем маркеры по файлам для отображения в панели проблем
      const fileProblems = {
        filePath: filePathFromUri,
        fileName: fileName,
        issues: storeMarkers.map((marker: any) => ({
          severity: marker.severity,
          message: marker.message,
          rawMessage: marker.rawMessage || marker.message,
          line: marker.line || marker.range.start.line + 1,
          column: marker.column || marker.range.start.character + 1,
          endLine: marker.endLine || marker.range.end.line + 1,
          endColumn: marker.endColumn || marker.range.end.character + 1,
          source: marker.source,
          code: marker.code
        }))
      };
      
      // Отправляем событие обновления UI
      try {
        // Отправляем событие обновления маркеров
        document.dispatchEvent(new CustomEvent('markers-updated', { 
          detail: { uri: fileUri, markers } 
        }));
        
        // Получаем все проблемы для отображения
        const allProblems = window.pythonDiagnosticsStore.getAllMarkersForUI() || [];
        
        // Обновляем текущий файл в списке проблем или добавляем новый
        const updatedProblems = allProblems.filter(p => p.filePath !== filePathFromUri);
        if (fileProblems.issues.length > 0) {
          updatedProblems.push(fileProblems);
        }
        
        // Отправляем событие обновления панели проблем с обновленными данными
        const problemsEvent = new CustomEvent('python-diagnostics-updated', { 
          detail: { diagnostics: updatedProblems } 
        });
        document.dispatchEvent(problemsEvent);
      } catch (err) {
        console.error('[Python] Ошибка при обновлении UI:', err);
      }
    }
  } catch (error) {
    console.error('[Python] Ошибка в updatePythonDiagnostics:', error);
  }
};

/**
 * Обновление всех отображений ошибок для открытых Python файлов
 */
export function refreshPythonDiagnosticsDisplay() {
  console.log('🔄 Обновление отображения ошибок Python в редакторах...');
  
  try {
    // Проверяем наличие Monaco и функции обновления декораций
    if (!window.monaco || !window.setupErrorDecorations) {
      console.warn('Monaco или функция setupErrorDecorations недоступны');
      return;
    }
    
    // Получаем все открытые редакторы
    const editors = window.monaco.editor.getEditors();
    if (!editors || editors.length === 0) {
      console.log('Нет активных редакторов для обновления');
      return;
    }
    
    console.log(`🎨 Обновление декораций для ${editors.length} открытых редакторов`);
    
    // Обновляем декорации для каждого редактора
    editors.forEach((editor: any) => {
      if (editor && editor.getModel()) {
        try {
          const model = editor.getModel();
          const languageId = model.getLanguageId();
          
          // Проверяем, является ли это Python файлом
          if (languageId === 'python') {
            console.log(`🐍 Обновление декораций для Python файла: ${model.uri.toString()}`);
            if (window.setupErrorDecorations) {
              window.setupErrorDecorations(editor);
            }
          }
        } catch (err) {
          console.warn('Ошибка при обновлении декораций редактора:', err);
        }
      }
    });
    
    // Если есть хранилище диагностики, обновляем панель проблем
    if (window.pythonDiagnosticsStore) {
      try {
        const diagnostics = window.pythonDiagnosticsStore.getAllMarkersForUI() || [];
        document.dispatchEvent(new CustomEvent('python-diagnostics-updated', { 
          detail: { diagnostics } 
        }));
        console.log(`📊 Обновлена панель проблем с ${diagnostics.length} файлами диагностики`);
      } catch (err) {
        console.error('Ошибка при обновлении панели проблем:', err);
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении отображения ошибок Python:', error);
  }
}

/**
 * Обновляет диагностику для указанного файла или всех открытых Python файлов
 */
window.updatePythonDiagnostics = async (filePath?: string): Promise<string> => {
  try {
    if (!pylspConnection) {
      console.error('[LSP] Соединение с Python LSP не установлено');
      return 'Соединение с Python LSP не установлено';
    }

    // Если указан конкретный файл
    if (filePath) {
      const uri = filePath;
      
      // Отменяем предыдущий запланированный вызов для этого файла
      if (diagnosticsUpdateDebounce.has(uri)) {
        clearTimeout(diagnosticsUpdateDebounce.get(uri));
      }
      
      // Создаем новый отложенный вызов
      return new Promise((resolve) => {
        const timerId = setTimeout(async () => {
          try {
            // После задержки выполняем фактическое обновление
            const normalizedPath = normalizePythonPath(uri);
            const result = await forcePythonDiagnosticsUpdate(normalizedPath);
            resolve(result);
          } catch (error) {
            console.error(`[LSP] Ошибка при отложенном обновлении диагностики для ${uri}:`, error);
            resolve(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
          } finally {
            // Удаляем ID таймера из Map
            diagnosticsUpdateDebounce.delete(uri);
          }
        }, diagnosticsUpdateDelay);
        
        // Сохраняем ID таймера
        diagnosticsUpdateDebounce.set(uri, timerId);
      });
    }
    
    // Если путь не указан, обрабатываем все Python-файлы
    // Для этого случая используем отдельный дебаунсинг
    const allFilesKey = '_all_files_';
    if (diagnosticsUpdateDebounce.has(allFilesKey)) {
      clearTimeout(diagnosticsUpdateDebounce.get(allFilesKey));
    }
    
    return new Promise((resolve) => {
      const timerId = setTimeout(async () => {
        try {
          // После задержки обновляем все файлы
          const result = await updateAllPythonDiagnostics();
          resolve(result);
        } catch (error) {
          console.error('[LSP] Ошибка при обновлении всех диагностик:', error);
          resolve(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        } finally {
          // Удаляем ID таймера
          diagnosticsUpdateDebounce.delete(allFilesKey);
        }
      }, diagnosticsUpdateDelay);
      
      // Сохраняем ID таймера
      diagnosticsUpdateDebounce.set(allFilesKey, timerId);
    });
  } catch (error) {
    console.error('[LSP] Ошибка при обновлении диагностики:', error);
    return `Ошибка: ${error.message || 'Неизвестная ошибка'}`;
  }
};

/**
 * Обновить диагностику для всех Python-файлов и обновить отображение ошибок
 */
export async function refreshAllPythonDiagnostics(): Promise<void> {
  try {
    console.log('🐍 Запуск обновления диагностики для всех Python файлов...');
    
    // Получаем все модели из Monaco
    if (!window.monaco || !window.monaco.editor) {
      console.error('Monaco не инициализирован');
      return;
    }
    
    // Получаем все открытые модели
    const allModels = window.monaco.editor.getModels();
    
    // Фильтруем только Python файлы
    const pythonModels = allModels.filter(model => {
      const uri = model.uri.toString();
      return uri.endsWith('.py');
    });
    
    console.log(`🐍 Найдено ${pythonModels.length} Python файлов для обновления`);
    
    // Форсируем обновление диагностики для каждого файла
    for (const model of pythonModels) {
      try {
        const uri = model.uri.toString();
        const filePath = uri.replace('file://', '');
        
        console.log(`🐍 Обновление диагностики для ${filePath}`);
        await updatePythonDiagnosticsForFile(filePath);
        
        // Небольшая пауза между обработками файлов
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error('Ошибка при обновлении диагностики для модели:', err);
      }
    }
    
    // Обновляем отображение во всех редакторах
    if (window.forceUpdateAllDecorations && typeof window.forceUpdateAllDecorations === 'function') {
      window.forceUpdateAllDecorations();
    }
    
    // Отправляем событие об обновлении диагностики
    document.dispatchEvent(new CustomEvent('python-diagnostics-updated'));
    
    console.log('🐍 Обновление диагностики для всех Python файлов завершено');
  } catch (error) {
    console.error('Ошибка при обновлении диагностики всех Python файлов:', error);
  }
}

// Делаем функцию доступной глобально
(window as any).refreshAllPythonDiagnostics = refreshAllPythonDiagnostics;

// Расширяем глобальный интерфейс Window
declare global {
  interface Window {
    setupAllErrorDecorations?: () => void;
    forceUpdateAllDecorations?: () => void;
    globalMarkersStore?: Map<string, any[]>;
  }
}

/**
 * Получить все текущие Python диагностики для отображения в панели проблем
 * @returns Массив проблем по файлам
 */
export function getPythonDiagnostics(): any[] {
  try {
    // Проверяем наличие хранилища диагностики
    if (!window.pythonDiagnosticsStore) {
      console.warn('Хранилище диагностики Python недоступно');
      return [];
    }
    
    // Получаем все маркеры из хранилища
    const allMarkers = window.pythonDiagnosticsStore.getAllMarkers();
    if (!allMarkers || typeof allMarkers !== 'object') {
      return [];
    }
    
    // Преобразуем маркеры в формат для панели проблем
    const result: any[] = [];
    
    // Обрабатываем все URI в хранилище
    for (const [uri, markers] of Object.entries(allMarkers)) {
      if (!Array.isArray(markers) || markers.length === 0) {
        continue;
      }
      
      // Получаем путь файла из URI
      let filePath = uri.replace('file://', '');
      // Нормализуем пути для Windows
      filePath = filePath.replace(/^\/([a-zA-Z]:)/, '$1');
      
      // Получаем имя файла из пути
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';
      
      // Создаем объект с проблемами для файла
      const fileProblems = {
        filePath,
        fileName,
        issues: markers.map((marker: any) => ({
          severity: marker.severity === 8 || marker.severity === 'error' ? 'error' : 
                   marker.severity === 4 || marker.severity === 'warning' ? 'warning' : 'info',
          message: marker.message || '',
          rawMessage: marker.rawMessage || marker.shortMessage || marker.message || '',
          line: marker.line || (marker.range?.start?.line ?? 0) + 1,
          column: marker.column || (marker.range?.start?.character ?? 0) + 1,
          endLine: marker.endLine || (marker.range?.end?.line ?? 0) + 1,
          endColumn: marker.endColumn || (marker.range?.end?.character ?? 0) + 1,
          source: marker.source || 'Python',
          code: marker.code
        }))
      };
      
      // Добавляем в результат, если есть проблемы
      if (fileProblems.issues.length > 0) {
        result.push(fileProblems);
      }
    }
    
    console.log(`🐍 Получено ${result.length} файлов с проблемами`);
    return result;
  } catch (error) {
    console.error('Ошибка при получении Python диагностик:', error);
    return [];
  }
}

// Делаем функцию доступной глобально
(window as any).getPythonDiagnostics = getPythonDiagnostics;