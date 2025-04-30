/**
 * Объявление глобальных типов для TypeScript
 */
// Импортируем типы Monaco для использования в объявлении
import * as monacoType from 'monaco-editor';

// Используем типизацию для модели
type MonacoITextModel = monacoType.editor.ITextModel;

// Объявляем глобальные типы
declare global {
  interface Window {
    pythonDiagnosticsStore: Record<string, any[]>;
    lastKnownMarkers: Record<string, any[]>;
    debug_markers: boolean;
    forceDiagnosticsRefresh: () => void;
    diagnosticsLastUpdated: number; // Время последнего обновления диагностики
    pendingDiagnostics: boolean; // Флаг ожидающего обновления диагностики
    monaco: any; // Используем any, чтобы избежать конфликтов между объявлениями
    lastActiveFilePath?: string; // Путь к последнему активному файлу
    getPythonDiagnostics?: () => any[];
    updatePythonDiagnostics?: () => Promise<any>;
  }
}

/**
 * Преобразует числовой код ошибки в строковый для совместимости с IMarkerData
 * @param marker Исходный маркер
 * @returns Исправленный маркер с кодом в виде строки
 */
export function fixMarkerCode(marker: any): any {
  if (marker === null || typeof marker !== 'object') {
    return marker;
  }
  
  // Преобразуем числовой код в строку, если он существует
  if (marker.code !== undefined && typeof marker.code === 'number') {
    return {
      ...marker,
      code: marker.code.toString()
    };
  }

  return marker;
}

/**
 * Исправляет массив маркеров, преобразуя числовые коды в строки
 * @param markers Массив маркеров
 * @returns Исправленный массив маркеров
 */
export function fixMarkers(markers: any[]): any[] {
  if (!Array.isArray(markers)) {
    console.warn('fixMarkers: входные данные не являются массивом', markers);
    return [];
  }
  
  return markers.map(fixMarkerCode);
}

/**
 * Включает отладочный режим для маркеров
 */
export function enableMarkerDebug() {
  window.debug_markers = true;
  console.log('🔍 Отладка маркеров включена');
}

/**
 * Логирует информацию о маркерах в консоль (если включен режим отладки)
 */
function logMarkerInfo(message: string, ...data: any[]) {
  if (window.debug_markers) {
    console.log(`🔍 [Marker] ${message}`, ...data);
  }
}

/**
 * Принудительно обновляет все диагностики в редакторе
 */
export function forceRefreshAllDiagnostics() {
  logMarkerInfo('Принудительное обновление всех диагностик');
  
  try {
    if (window && window.monaco && window.monaco.editor) {
      // Устанавливаем флаг ожидания обновления диагностики
      window.pendingDiagnostics = true;
      
      const models = window.monaco.editor.getModels();
      const allMarkers: any[] = [];
      
      models.forEach((model: any) => {
        if (model && model.uri) {
          const uri = model.uri.toString();
          const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
          
          if (markers && markers.length > 0) {
            logMarkerInfo(`Модель ${uri} имеет ${markers.length} маркеров`, markers);
            allMarkers.push(...markers);
            
            // Сохраняем маркеры в глобальное хранилище
            if (!window.pythonDiagnosticsStore) {
              window.pythonDiagnosticsStore = {};
            }
            window.pythonDiagnosticsStore[uri] = markers;
            
            // Сохраняем в lastKnownMarkers для быстрого доступа
            if (!window.lastKnownMarkers) {
              window.lastKnownMarkers = {};
            }
            window.lastKnownMarkers[uri] = markers;
            
            // Отправляем событие об обновлении диагностики
            if (typeof document !== 'undefined' && document) {
              document.dispatchEvent(new CustomEvent('diagnostics-updated', { 
                detail: { uri, markers, forceRefresh: true, timestamp: Date.now() } 
              }));
            }
          }
        }
      });
      
      logMarkerInfo(`Всего найдено ${allMarkers.length} маркеров`);
      
      // Обновляем время последнего обновления
      window.diagnosticsLastUpdated = Date.now();
      
      // Сбрасываем флаг ожидания
      window.pendingDiagnostics = false;
      
      // Триггерим события обновления проблем
      if (typeof document !== 'undefined' && document) {
        document.dispatchEvent(new CustomEvent('problems-updated', {
          detail: { totalMarkers: allMarkers.length, timestamp: window.diagnosticsLastUpdated }
        }));
        
        // Отправляем последовательность событий с разными интервалами для надежности
        const intervals = [100, 500, 1000, 2000];
        intervals.forEach(delay => {
          setTimeout(() => {
            if (typeof document !== 'undefined' && document) {
              document.dispatchEvent(new CustomEvent('force-update-problems', {
                detail: { 
                  origin: 'forceRefreshAllDiagnostics', 
                  totalMarkers: allMarkers.length,
                  delay: delay 
                }
              }));
            }
          }, delay);
        });
      }
      
      return allMarkers.length;
    }
  } catch (error) {
    console.error('Ошибка при обновлении диагностик:', error);
    // Сбрасываем флаг ожидания в случае ошибки
    window.pendingDiagnostics = false;
  }
  
  return 0;
}

/**
 * Безопасно устанавливает маркеры в модель, предварительно исправляя коды ошибок
 * @param monaco Экземпляр Monaco Editor
 * @param model Модель Monaco
 * @param owner Владелец маркеров
 * @param markers Массив маркеров
 */
export function safeSetModelMarkers(monaco: any, model: any, owner: string, markers: any[]): void {
  if (!monaco || !model || !monaco.editor || typeof monaco.editor.setModelMarkers !== 'function') {
    console.error('Monaco editor не инициализирован или не содержит метод setModelMarkers');
    return;
  }
  
  // Включаем отладку маркеров по умолчанию
  if (window.debug_markers === undefined) {
    window.debug_markers = true;
  }
  
  // Регистрируем функцию принудительного обновления диагностик
  if (!window.forceDiagnosticsRefresh) {
    window.forceDiagnosticsRefresh = forceRefreshAllDiagnostics;
  }
  
  // Проверяем и создаем хранилище, если его нет
  if (typeof window !== 'undefined') {
    if (!window.pythonDiagnosticsStore) {
      window.pythonDiagnosticsStore = {};
    }
    if (window.diagnosticsLastUpdated === undefined) {
      window.diagnosticsLastUpdated = 0;
    }
  }
  
  try {
    const fixedMarkers = fixMarkers(markers);
    
    // Обрабатываем возможную ошибку с null маркерами
    const validMarkers = fixedMarkers.filter(marker => marker !== null && typeof marker === 'object');
    
    logMarkerInfo(`Установка ${validMarkers.length} маркеров для модели`, model.uri?.toString());
    
    if (validMarkers.length > 0) {
      logMarkerInfo('Пример маркера:', JSON.stringify(validMarkers[0], null, 2));
    }
    
    // Установка маркеров в модель
    monaco.editor.setModelMarkers(model, owner, validMarkers);
    
    // Получаем URI модели
    if (model && model.uri) {
      const uri = model.uri.toString();
      
      // Сохраняем в глобальном хранилище
      if (typeof window !== 'undefined' && window.pythonDiagnosticsStore) {
        window.pythonDiagnosticsStore[uri] = validMarkers;
        
        // Логируем количество маркеров
        if (validMarkers && validMarkers.length > 0) {
          logMarkerInfo(`Установлено ${validMarkers.length} маркеров для ${uri}`);
          console.log(`Маркеры для ${uri}:`, JSON.stringify(validMarkers.slice(0, 2))); // Всегда логируем первые 2 маркера
        }
      }
      
      // Создаем отдельное глобальное хранилище для быстрого доступа
      window.lastKnownMarkers = window.lastKnownMarkers || {};
      window.lastKnownMarkers[uri] = validMarkers;
      
      // Обновляем время последнего обновления
      window.diagnosticsLastUpdated = Date.now();
      
      // Отправляем события обновления диагностики - важно! Используем несколько разных событий
      // для максимальной надежности, чтобы если одно событие не сработает, сработало другое
      try {
        // 1. Основное событие diagnostics-updated
        const diagEvent = new CustomEvent('diagnostics-updated', { 
          detail: { uri, markers: validMarkers, timestamp: window.diagnosticsLastUpdated } 
        });
        if (typeof document !== 'undefined' && document) {
          document.dispatchEvent(diagEvent);
        }
        
        // 2. Общее событие обновления проблем
        if (typeof document !== 'undefined' && document) {
          document.dispatchEvent(new CustomEvent('problems-updated', {
            detail: { uri, markers: validMarkers, count: validMarkers.length, timestamp: window.diagnosticsLastUpdated }
          }));
        }
        
        // 3. Событие изменения маркеров конкретной модели 
        if (typeof document !== 'undefined' && document) {
          document.dispatchEvent(new CustomEvent('monaco-markers-changed', {
            detail: {
              uri,
              filePath: uri, 
              markers: validMarkers,
              owner,
              hasErrors: validMarkers.some(m => m.severity === 1),
              hasWarnings: validMarkers.some(m => m.severity === 2),
              timestamp: window.diagnosticsLastUpdated
            }
          }));
        }
        
        // 4-6. Отправляем несколько отложенных событий с разными задержками для надежности
        const delays = [100, 500, 1000];
        delays.forEach(delay => {
          setTimeout(() => {
            if (typeof document !== 'undefined' && document) {
              document.dispatchEvent(new CustomEvent('force-update-problems', {
                detail: { origin: 'safeSetModelMarkers', uri, delay }
              }));
            }
          }, delay);
          
          setTimeout(() => {
            if (typeof document !== 'undefined' && document) {
              document.dispatchEvent(new CustomEvent('refresh-problems-panel', {
                detail: { uri, markers: validMarkers.length, delay }
              }));
            }
          }, delay + 50);
        });
        
        logMarkerInfo('События обновления диагностики отправлены');
        
        // Добавляем вероятностную повторную отправку событий
        if (validMarkers.length > 0 && Math.random() < 0.3) {
          setTimeout(() => {
            logMarkerInfo('Повторная отправка событий для надежности');
            if (typeof document !== 'undefined' && document) {
              document.dispatchEvent(new CustomEvent('force-update-problems', {
                detail: { origin: 'safeSetModelMarkers-retry', uri }
              }));
            }
          }, 2000);
        }
      } catch (eventError) {
        console.error('Ошибка при отправке события diagnostics-updated:', eventError);
      }
    } else {
      console.warn('Model URI is undefined or null, cannot save markers');
    }
  } catch (error) {
    console.error('Ошибка при установке маркеров:', error);
  }
}

/**
 * Проверяет наличие маркеров во всех моделях и принудительно запускает обновление,
 * если с момента последнего обновления прошло больше указанного времени
 * @param forceUpdate Принудительное обновление независимо от времени
 */
export function checkAndRefreshDiagnostics(forceUpdate = false): void {
  try {
    // Проверяем, прошло ли достаточно времени с момента последнего обновления
    const now = Date.now();
    const lastUpdate = window.diagnosticsLastUpdated || 0;
    const timeSinceLastUpdate = now - lastUpdate;
    
    // Если обновление уже в процессе, не запускаем новое
    if (window.pendingDiagnostics) {
      logMarkerInfo('Пропускаем обновление - предыдущее обновление еще не завершено');
      return;
    }
    
    // Обновляем, если прошло больше 5 секунд или запрошено принудительное обновление
    if (forceUpdate || timeSinceLastUpdate > 5000) {
      logMarkerInfo(`Принудительное обновление диагностик (прошло ${timeSinceLastUpdate}ms)`);
      forceRefreshAllDiagnostics();
    }
  } catch (error) {
    console.error('Ошибка в checkAndRefreshDiagnostics:', error);
  }
}

/**
 * Инициализирует периодическую проверку ошибок Python во всех открытых файлах
 */
export function initPeriodicDiagnosticChecks(): void {
  console.log('🔄 Инициализация периодических проверок Python-ошибок');
  
  // Выполняем первую проверку сразу
  checkPythonErrorsInAllFiles();
  
  // Настраиваем периодические проверки каждые 5 секунд
  setInterval(() => {
    checkPythonErrorsInAllFiles();
  }, 5000);
  
  // Добавляем обработчик изменения активного файла
  document.addEventListener('active-file-changed', () => {
    setTimeout(() => checkPythonErrorsInAllFiles(), 200);
  });
}

/**
 * Проверяет все открытые Python файлы на наличие ошибок
 */
function checkPythonErrorsInAllFiles(): void {
  if (typeof window === 'undefined' || !window.monaco || !window.monaco.editor) {
    console.warn('Monaco не доступен для проверки ошибок');
    return;
  }
  
  const monaco = window.monaco;
  const models = monaco.editor.getModels() || [];
  
  // Проверяем все модели
  models.forEach((model: monacoType.editor.ITextModel) => {
    const uri = model.uri.toString();
    
    // Проверяем только Python файлы
    if (uri.endsWith('.py')) {
      console.log(`🔍 Проверка Python файла: ${uri}`);
      checkPythonErrorsInFile(model);
    }
  });
  
  // Обновляем панель проблем
  setTimeout(() => {
    if (typeof document !== 'undefined' && document) {
      document.dispatchEvent(new CustomEvent('markers-updated'));
      document.dispatchEvent(new CustomEvent('refresh-problems-panel'));
    }
  }, 100);
}

/**
 * Проверяет Python файл на наличие синтаксических ошибок
 * @param model Модель текста Monaco
 */
function checkPythonErrorsInFile(model: monacoType.editor.ITextModel): void {
  const monaco = (window as any).monaco;
  if (!monaco || !monaco.editor) {
    console.warn('Monaco не доступен для проверки ошибок');
    return;
  }
  
  // Только для Python файлов
  const uri = model.uri.toString();
  if (!uri.endsWith('.py')) return;
  
  const content = model.getValue();
  const lines = content.split('\n');
  const fileName = uri.split('/').pop() || '';
  
  console.log(`🐍 Проверка Python файла: ${fileName} (${lines.length} строк)`);
  
  // Очищаем существующие маркеры для этого файла
  monaco.editor.setModelMarkers(model, 'python', []);
  
  // Собираем ошибки
  const errors: monacoType.editor.IMarkerData[] = [];
  
  // Проверяем строки на различные типичные ошибки
  lines.forEach((line: string, lineIndex: number) => {
    // 1. Проверяем лишние запятые в списках/кортежах
    if (line.trim().match(/,\s*\]/) || line.trim().match(/,\s*\)/)) {
      errors.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Лишняя запятая перед закрывающей скобкой',
        startLineNumber: lineIndex + 1,
        startColumn: line.indexOf(',') + 1,
        endLineNumber: lineIndex + 1,
        endColumn: line.indexOf(',') + 2
      });
    }
    
    // 2. Проверяем сравнение строк с числами
    if (line.includes('==') || line.includes('!=')) {
      // Упрощенная проверка на возможное сравнение строки с числом
      if (line.match(/'.*'.*==.*\d/) || line.match(/\d.*==.*'.*'/) ||
          line.match(/".*".*==.*\d/) || line.match(/\d.*==.*".*"/)) {
        errors.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Сравнение строки с числом приведет к ошибке',
          startLineNumber: lineIndex + 1,
          startColumn: 1,
          endLineNumber: lineIndex + 1,
          endColumn: line.length + 1
        });
      }
    }
    
    // 3. Проверяем деление на ноль
    if (line.match(/\/\s*0\b/) || line.match(/\/\s*0\.0\b/)) {
      errors.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Деление на ноль',
        startLineNumber: lineIndex + 1,
        startColumn: line.indexOf('/') + 1,
        endLineNumber: lineIndex + 1,
        endColumn: line.indexOf('/') + 2
      });
    }
    
    // 4. Проверяем отсутствующее двоеточие в условиях, циклах и функциях
    if (line.match(/\b(if|elif|else|for|while|def|class)\b.*[^\:]\s*$/)) {
      errors.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Отсутствует двоеточие в конце строки',
        startLineNumber: lineIndex + 1,
        startColumn: line.length,
        endLineNumber: lineIndex + 1,
        endColumn: line.length + 1
      });
    }
    
    // 5. Проверяем незакрытые скобки
    const openBrackets = (line.match(/\(/g) || []).length;
    const closeBrackets = (line.match(/\)/g) || []).length;
    if (openBrackets > closeBrackets && !lines.slice(lineIndex + 1).some(l => l.includes(')'))) {
      errors.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Незакрытая скобка',
        startLineNumber: lineIndex + 1,
        startColumn: 1,
        endLineNumber: lineIndex + 1,
        endColumn: line.length + 1
      });
    }
    
    // 6. Ошибки отступов
    if (lineIndex > 0 && line.trim() && lines[lineIndex - 1].trim().endsWith(':')) {
      const currentIndent = line.match(/^\s*/)[0].length;
      const prevIndent = lines[lineIndex - 1].match(/^\s*/)[0].length;
      
      if (currentIndent <= prevIndent) {
        errors.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Ожидается отступ после строки с двоеточием',
          startLineNumber: lineIndex + 1,
          startColumn: 1,
          endLineNumber: lineIndex + 1,
          endColumn: currentIndent + 1
        });
      }
    }
    
    // 7. Ошибки в f-строках
    if (line.includes('f"') || line.includes("f'")) {
      if ((line.includes('{') && !line.includes('}')) || 
          (line.match(/{/g) || []).length !== (line.match(/}/g) || []).length) {
        errors.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Незакрытая фигурная скобка в f-строке',
          startLineNumber: lineIndex + 1,
          startColumn: line.indexOf('{') + 1,
          endLineNumber: lineIndex + 1,
          endColumn: line.indexOf('{') + 2
        });
      }
    }
  });
  
  // Регистрируем ошибки в Monaco
  if (errors.length > 0 && monaco && monaco.editor) {
    console.log(`🐛 Найдено ${errors.length} ошибок в Python файле ${fileName}`);
    monaco.editor.setModelMarkers(model, 'python', errors);
    
    // Сохраняем маркеры в глобальном хранилище для доступа из других компонентов
    if (typeof window !== 'undefined') {
      if (!window.lastKnownMarkers) {
        window.lastKnownMarkers = {};
      }
      window.lastKnownMarkers[uri] = errors;
      
      // Уведомляем о новых маркерах
      if (typeof document !== 'undefined' && document) {
        document.dispatchEvent(new CustomEvent('markers-updated'));
      }
    }
  } else {
    console.log(`✅ Ошибок не найдено в файле ${fileName}`);
  }
} 