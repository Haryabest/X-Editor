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

// Добавляем глобальные типы для window
declare global {
  interface Window {
    updatePythonDiagnostics?: (filePath?: string) => Promise<string>;
    registerPythonForModel?: (model: any) => void;
    forceUpdateAllDecorations?: () => void;
    setupErrorDecorations?: (editor: any) => void;
    monaco: any;
    pythonDiagnosticsStore?: any;
    pylance?: any;
    setupAllErrorDecorations: () => void;
    globalMarkersStore: Map<string, monaco.editor.IMarker[]>;
  }
}

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

// Хранилище для отслеживания последних примененных маркеров для каждого редактора
let lastMarkersCache = new Map();
// Таймеры для дебаунсинга декораций
let decorationTimers = new Map();
// Глобальное хранилище всех маркеров для всех URI
let globalMarkers = new Map();

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
    
    // Создаем хранилище диагностики Python
    if (!window.pythonDiagnosticsStore) {
      console.log('Создание хранилища диагностики Python...');
      (window as any).pythonDiagnosticsStore = {
        markers: new Map(),
        setMarkers: function(uri: string, diagnostics: any[]) {
          this.markers.set(uri, diagnostics);
          console.log(`Установлено ${diagnostics.length} маркеров для ${uri}`);
          
          // Находим модель и применяем маркеры напрямую
          try {
            const models = window.monaco.editor.getModels();
            const model = models.find((m: any) => {
              const modelPath = m.uri.path;
              return modelPath === uri || 
                     modelPath.endsWith(uri) || 
                     m.uri.toString().includes(uri);
            });
            
            if (model) {
              // Преобразуем диагностику в формат Monaco маркеров
              const markers = diagnostics.map((diag: any) => ({
                severity: mapSeverity(diag.severity || 1),
                startLineNumber: diag.range.start.line + 1,
                startColumn: diag.range.start.character + 1,
                endLineNumber: diag.range.end.line + 1,
                endColumn: diag.range.end.character + 1,
                message: diag.message,
                source: 'Pylance'
              }));
              
              window.monaco.editor.setModelMarkers(model, 'python', markers);
              console.log(`✅ Установлены ${markers.length} маркеров для модели ${model.uri.toString()}`);
            }
          } catch (err) {
            console.error('Ошибка при прямом применении маркеров:', err);
          }
          
          // Отправляем событие обновления маркеров
          try {
            const event = new CustomEvent('markers-updated', { 
              detail: { uri, count: diagnostics.length, diagnostics } 
            });
            document.dispatchEvent(event);
          } catch (err) {
            console.warn('Ошибка при отправке события обновления маркеров:', err);
          }
        },
        getMarkers: function(uri: string) {
          return this.markers.get(uri) || [];
        },
        getAllMarkersForUI: function() {
          const result: any[] = [];
          const processedUris = new Set<string>(); // Отслеживаем обработанные URI
          
          this.markers.forEach((diagnostics: any[], uri: string) => {
            if (diagnostics && diagnostics.length > 0) {
              // Нормализуем URI, чтобы избежать дублирования
              let normalizedUri = uri;
              try {
                // Удаляем URL-кодирование из пути
                if (uri.includes('%')) {
                  normalizedUri = decodeURIComponent(uri);
                }
                
                // Очищаем путь от схемы file://
                if (normalizedUri.startsWith('file://')) {
                  normalizedUri = normalizedUri.replace('file://', '');
                }
                
                // Заменяем обратные слеши на прямые для единообразия
                normalizedUri = normalizedUri.replace(/\\/g, '/');
              } catch (e) {
                console.warn('Ошибка при нормализации URI:', e);
              }
              
              // Пропускаем дубликаты URI
              if (processedUris.has(normalizedUri)) {
                return;
              }
              processedUris.add(normalizedUri);
              
              // Получаем имя файла из URI
              let fileName = normalizedUri.split('/').pop() || '';
              
              // Создаем запись для файла
              result.push({
                filePath: normalizedUri,
                fileName: fileName,
                issues: diagnostics.map((diag: any) => {
                  // Определяем тип проблемы
                  let severity = diag.severity === 1 ? 'error' : 
                                 diag.severity === 2 ? 'warning' : 'info';
                  
                  // Преобразуем позицию из формата LSP в формат UI
                  let line = (diag.range?.start?.line !== undefined) ? diag.range.start.line + 1 : 1;
                  let column = (diag.range?.start?.character !== undefined) ? diag.range.start.character + 1 : 1;
                  let endLine = (diag.range?.end?.line !== undefined) ? diag.range.end.line + 1 : line;
                  let endColumn = (diag.range?.end?.character !== undefined) ? diag.range.end.character + 1 : column;
                  
                  return {
                    severity: severity,
                    message: diag.message || 'Ошибка в Python коде',
                    line: line,
                    column: column,
                    endLine: endLine,
                    endColumn: endColumn,
                    source: diag.source || 'python-validator',
                    code: diag.code
                  };
                })
              });
            }
          });
          return result;
        }
      };
      
      // Глобальная функция для доступа к маркерам Python
      (window as any).getPythonDiagnostics = () => {
        if (window.pythonDiagnosticsStore && 
            typeof window.pythonDiagnosticsStore.getAllMarkersForUI === 'function') {
          return window.pythonDiagnosticsStore.getAllMarkersForUI();
        }
        return [];
      };
    }
    
    // Добавляем функцию для маппинга уровней серьезности ошибок
    function mapSeverity(severity: number): number {
      // Соответствие LSP и Monaco уровней серьезности
      // LSP: 1 = Error, 2 = Warning, 3 = Information, 4 = Hint
      // Monaco: 8 = Error, 4 = Warning, 2 = Info, 1 = Hint
      switch(severity) {
        case 1: return monaco.MarkerSeverity.Error;
        case 2: return monaco.MarkerSeverity.Warning;
        case 3: return monaco.MarkerSeverity.Info;
        case 4: return monaco.MarkerSeverity.Hint;
        default: return monaco.MarkerSeverity.Warning;
      }
    }
    
    // Добавляем функцию регистрации Python для модели
    window.registerPythonForModel = (model: monaco.editor.ITextModel) => {
      try {
        // Улучшенная проверка модели
        if (!model || !model.uri) {
          console.warn('Невалидная модель для регистрации Python: модель отсутствует или не имеет URI');
          return;
        }

        const uri = model.uri.toString();
        const path = model.uri.path || uri;
        
        // Более надежная проверка на Python файл с расширенной поддержкой всех типов Python файлов
        const isPythonFile = path.endsWith('.py') || path.endsWith('.pyw') || path.endsWith('.pyi') || 
                            uri.endsWith('.py') || uri.endsWith('.pyw') || uri.endsWith('.pyi');
        
        if (!isPythonFile) {
          // Если это не Python файл, пропускаем дальнейшую обработку
          return;
        }

        // Устанавливаем язык модели
        monaco.editor.setModelLanguage(model, 'python');
        
        console.log(`🐍 Регистрация Python для модели: ${uri}`);
        
        // АКТИВНАЯ ПРОВЕРКА: Создаем диагностику для выявления синтаксических ошибок
        setTimeout(() => {
          try {
            // Получаем содержимое и делаем базовую проверку на синтаксические ошибки
            const content = model.getValue();
            
            // Простой парсер для поиска очевидных ошибок синтаксиса
            const lines = content.split('\n');
            const markers: any[] = [];
            
            // Поиск несоответствующих скобок и других синтаксических ошибок
            let openBraces = 0, openBrackets = 0, openParens = 0;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              
              // Игнорируем комментарии
              if (line.trim().startsWith('#')) continue;
              
              // Подсчитываем скобки
              for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '{') openBraces++;
                else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets--;
                else if (char === '(') openParens++;
                else if (char === ')') openParens--;
                
                // Если закрыли больше, чем открыли
                if (openBraces < 0 || openBrackets < 0 || openParens < 0) {
                  markers.push({
                    severity: monaco.MarkerSeverity.Error,
                    startLineNumber: i + 1,
                    startColumn: j + 1,
                    endLineNumber: i + 1,
                    endColumn: j + 2,
                    message: 'Неожиданная закрывающая скобка',
                    source: 'Python Validator'
                  });
                  
                  // Сбрасываем счетчик для продолжения проверки
                  if (openBraces < 0) openBraces = 0;
                  if (openBrackets < 0) openBrackets = 0;
                  if (openParens < 0) openParens = 0;
                }
              }
              
              // УДАЛЯЕМ проверку на кириллицу, так как она может быть полезна в комментариях и строках
              // и мешает корректной диагностике
              
              // Проверка строк вне допустимых контекстов - делаем более мягкой
              if (line.trim() && 
                  !line.includes('=') && 
                  !line.includes('(') && 
                  !line.includes('[') && 
                  !line.includes(':') && 
                  !line.includes('import') &&
                  !line.includes('from') &&
                  !line.includes('.') &&
                  !line.trim().startsWith('#') &&
                  !line.trim().startsWith('@') &&
                  !line.includes('"') &&
                  !line.includes("'") &&
                  !/^\s*(\d+|True|False|None)$/.test(line.trim())) {
                
                markers.push({
                  severity: monaco.MarkerSeverity.Error, // Меняем обратно на Error для явных синтаксических ошибок
                  startLineNumber: i + 1,
                  startColumn: 1,
                  endLineNumber: i + 1,
                  endColumn: line.length + 1,
                  message: 'Синтаксическая ошибка: неожиданное выражение',
                  source: 'Python Validator'
                });
              }
              
              // Добавляем проверку на случайные последовательности символов и явно невалидный код
              const randomSymbolsPattern = /[а-яА-Я\d]{5,}/; // Пять или больше кириллических букв или цифр подряд
              if (line.trim() && !line.trim().startsWith('#') && randomSymbolsPattern.test(line)) {
                // Это может быть случайная последовательность символов, не являющаяся валидным Python-кодом
                markers.push({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: i + 1,
                  startColumn: 1,
                  endLineNumber: i + 1,
                  endColumn: line.length + 1,
                  message: 'Невалидный код: обнаружена случайная последовательность символов',
                  source: 'Python Validator'
                });
              }
            }
            
            // Если остались открытые скобки в конце файла
            if (openBraces > 0) {
              markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: lines.length,
                startColumn: lines[lines.length - 1].length + 1,
                endLineNumber: lines.length,
                endColumn: lines[lines.length - 1].length + 2,
                message: `Не хватает ${openBraces} закрывающих фигурных скобок`,
                source: 'Python Validator'
              });
            }
            
            if (openBrackets > 0) {
              markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: lines.length,
                startColumn: lines[lines.length - 1].length + 1,
                endLineNumber: lines.length,
                endColumn: lines[lines.length - 1].length + 2,
                message: `Не хватает ${openBrackets} закрывающих квадратных скобок`,
                source: 'Python Validator'
              });
            }
            
            if (openParens > 0) {
              markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: lines.length,
                startColumn: lines[lines.length - 1].length + 1,
                endLineNumber: lines.length,
                endColumn: lines[lines.length - 1].length + 2,
                message: `Не хватает ${openParens} закрывающих круглых скобок`,
                source: 'Python Validator'
              });
            }
            
            // Применяем маркеры к модели
            console.log(`🐍 Найдено ${markers.length} потенциальных проблем в Python файле`);
            monaco.editor.setModelMarkers(model, 'python-validator', markers);
            
            // Находим все редакторы, использующие эту модель и применяем декорации напрямую
            const pythonEditors = monaco.editor.getEditors().filter((editor: any) => 
              editor.getModel() && editor.getModel().uri.toString() === model.uri.toString()
            );

            // Создаем декорации напрямую
            if (pythonEditors.length > 0) {
              console.log(`Применяю декорации к ${pythonEditors.length} редакторам`);
              
              // Добавляем CSS стили для подсветки
              if (!document.getElementById('python-error-styles')) {
                const style = document.createElement('style');
                style.id = 'python-error-styles';
                style.innerHTML = `
                  .python-error-decoration { 
                    background-color: rgba(255, 0, 0, 0.2) !important; 
                    border-bottom: 2px wavy red !important; 
                  }
                  .python-warning-decoration { 
                    background-color: rgba(255, 165, 0, 0.2) !important; 
                    border-bottom: 2px wavy orange !important; 
                  }
                  .python-error-inline { 
                    text-decoration: wavy underline red !important; 
                  }
                  .python-warning-inline { 
                    text-decoration: wavy underline orange !important; 
                  }
                  .error-glyph { 
                    width: 16px !important; 
                    height: 16px !important; 
                    display: inline-block !important;
                    margin-left: 5px !important;
                    background-color: transparent !important;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important; 
                    background-size: 16px 16px !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                  }
                  .warning-glyph { 
                    width: 16px !important; 
                    height: 16px !important;
                    display: inline-block !important;
                    margin-left: 5px !important;
                    background-color: transparent !important;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
                    background-size: 16px 16px !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                  }
                `;
                document.head.appendChild(style);
              }
              
              pythonEditors.forEach((editor: monaco.editor.IStandaloneCodeEditor) => {
                try {
                  // Включаем отображение глифов в редакторе
                  editor.updateOptions({ 
                    glyphMargin: true,
                    lineNumbers: 'on',
                    minimap: { enabled: true }
                  });
                  
                  // Создаем декорации для ошибок
                  const errorDecorations = markers.map((marker: monaco.editor.IMarkerData) => ({
                    range: new monaco.Range(
                      marker.startLineNumber,
                      marker.startColumn,
                      marker.endLineNumber,
                      marker.endColumn
                    ),
                    options: {
                      className: marker.severity === monaco.MarkerSeverity.Error ? 'python-error-decoration' : 'python-warning-decoration',
                      hoverMessage: { value: marker.message },
                      inlineClassName: marker.severity === monaco.MarkerSeverity.Error ? 'python-error-inline' : 'python-warning-inline',
                      glyphMarginClassName: marker.severity === monaco.MarkerSeverity.Error ? 'error-glyph' : 'warning-glyph',
                      overviewRuler: {
                        color: marker.severity === monaco.MarkerSeverity.Error ? 'red' : 'orange',
                        position: monaco.editor.OverviewRulerLane.Right
                      }
                    }
                  }));
                  
                  // Удаляем старые декорации и применяем новые
                  const oldDecorations = editor.getDecorationsInRange(model.getFullModelRange()) || [];
                  const oldDecorationIds = oldDecorations
                    .filter(d => d.options.className?.includes('python-') || 
                                d.options.glyphMarginClassName?.includes('-glyph'))
                    .map(d => d.id);
                    
                  console.log(`Удалено ${oldDecorationIds.length} старых декораций`);
                  editor.deltaDecorations(oldDecorationIds, errorDecorations);
                  
                  // Принудительно обновляем отображение редактора
                  setTimeout(() => {
                    editor.layout();
                    editor.render(true);
                  }, 100);
                } catch (err) {
                  console.error('Ошибка при создании декораций:', err);
                }
              });
            }
            
            // Обновляем отображение проблем
            if (window.pythonDiagnosticsStore) {
              window.pythonDiagnosticsStore.setMarkers(uri, markers.map(marker => ({
                severity: marker.severity === monaco.MarkerSeverity.Error ? 1 : 
                          marker.severity === monaco.MarkerSeverity.Warning ? 2 : 3,
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
                source: marker.source
              })));
            }
            
            // Обновляем панель проблем
            try {
              const event = new CustomEvent('markers-updated', { 
                detail: { uri, markers } 
              });
              document.dispatchEvent(event);
              
              const problemsEvent = new CustomEvent('python-diagnostics-updated', { 
                detail: { diagnostics: window.pythonDiagnosticsStore?.getAllMarkersForUI() || [] } 
              });
              document.dispatchEvent(problemsEvent);
            } catch (err) {
              console.error('Ошибка при обновлении UI:', err);
            }

            // Обновляем Python диагностику с таймаутом и обработкой ошибок
            setTimeout(() => {
              try {
                if (window.updatePythonDiagnostics && typeof window.updatePythonDiagnostics === 'function') {
                  window.updatePythonDiagnostics(uri)
                    .catch(error => {
                      console.error(`Ошибка при обновлении Python диагностики для ${uri}:`, error);
                    });
                }
              } catch (error) {
                console.error('Ошибка при вызове updatePythonDiagnostics:', error);
              }
            }, 500);  // Добавляем таймаут в 500 мс для предотвращения избыточных вызовов
          } catch (error) {
            console.error('Ошибка при базовой проверке синтаксиса Python:', error);
          }
        }, 100);
        
        // Добавляем отслеживание изменений для постоянной проверки
        model.onDidChangeContent(() => {
          // Откладываем проверку для более эффективной работы
          setTimeout(() => {
            try {
              // Получаем содержимое и делаем базовую проверку на синтаксические ошибки
              const content = model.getValue();
              
              // Простой парсер для поиска очевидных ошибок синтаксиса
              const lines = content.split('\n');
              const markers: any[] = [];
              
              // Поиск несоответствующих скобок и других синтаксических ошибок
              let openBraces = 0, openBrackets = 0, openParens = 0;
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Игнорируем комментарии
                if (line.trim().startsWith('#')) continue;
                
                // Подсчитываем скобки
                for (let j = 0; j < line.length; j++) {
                  const char = line[j];
                  if (char === '{') openBraces++;
                  else if (char === '}') openBraces--;
                  else if (char === '[') openBrackets++;
                  else if (char === ']') openBrackets--;
                  else if (char === '(') openParens++;
                  else if (char === ')') openParens--;
                  
                  // Если закрыли больше, чем открыли
                  if (openBraces < 0 || openBrackets < 0 || openParens < 0) {
                    markers.push({
                      severity: monaco.MarkerSeverity.Error,
                      startLineNumber: i + 1,
                      startColumn: j + 1,
                      endLineNumber: i + 1,
                      endColumn: j + 2,
                      message: 'Неожиданная закрывающая скобка',
                      source: 'Python Validator'
                    });
                    
                    // Сбрасываем счетчик для продолжения проверки
                    if (openBraces < 0) openBraces = 0;
                    if (openBrackets < 0) openBrackets = 0;
                    if (openParens < 0) openParens = 0;
                  }
                }
                
                // Проверка строк вне допустимых контекстов
                if (line.trim() && 
                    !line.includes('=') && 
                    !line.includes('(') && 
                    !line.includes('[') && 
                    !line.includes(':') && 
                    !line.includes('import') &&
                    !line.includes('from') &&
                    !line.includes('.') &&
                    !line.trim().startsWith('#') &&
                    !line.trim().startsWith('@') &&
                    !line.includes('"') &&
                    !line.includes("'") &&
                    !/^\s*(\d+|True|False|None)$/.test(line.trim())) {
                  
                  markers.push({
                    severity: monaco.MarkerSeverity.Warning, // меняем на Warning вместо Error
                    startLineNumber: i + 1,
                    startColumn: 1,
                    endLineNumber: i + 1,
                    endColumn: line.length + 1,
                    message: 'Возможно синтаксическая ошибка в этой строке',
                    source: 'Python Validator'
                  });
                }
              }
              
              // Если остались открытые скобки в конце файла
              if (openBraces > 0) {
                markers.push({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: lines.length,
                  startColumn: lines[lines.length - 1].length + 1,
                  endLineNumber: lines.length,
                  endColumn: lines[lines.length - 1].length + 2,
                  message: `Не хватает ${openBraces} закрывающих фигурных скобок`,
                  source: 'Python Validator'
                });
              }
              
              if (openBrackets > 0) {
                markers.push({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: lines.length,
                  startColumn: lines[lines.length - 1].length + 1,
                  endLineNumber: lines.length,
                  endColumn: lines[lines.length - 1].length + 2,
                  message: `Не хватает ${openBrackets} закрывающих квадратных скобок`,
                  source: 'Python Validator'
                });
              }
              
              if (openParens > 0) {
                markers.push({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: lines.length,
                  startColumn: lines[lines.length - 1].length + 1,
                  endLineNumber: lines.length,
                  endColumn: lines[lines.length - 1].length + 2,
                  message: `Не хватает ${openParens} закрывающих круглых скобок`,
                  source: 'Python Validator'
                });
              }
              
              // Применяем маркеры к модели
              monaco.editor.setModelMarkers(model, 'python-validator', markers);
              
              // Находим все редакторы, использующие эту модель и применяем декорации напрямую
              const pythonEditors = monaco.editor.getEditors().filter((editor: any) => 
                editor.getModel() && editor.getModel().uri.toString() === model.uri.toString()
              );

              // Создаем декорации напрямую
              if (pythonEditors.length > 0) {
                console.log(`Применяю декорации к ${pythonEditors.length} редакторам`);
                
                // Добавляем CSS стили для подсветки
                if (!document.getElementById('python-error-styles')) {
                  const style = document.createElement('style');
                  style.id = 'python-error-styles';
                  style.innerHTML = `
                    .python-error-decoration { 
                      background-color: rgba(255, 0, 0, 0.2) !important; 
                      border-bottom: 2px wavy red !important; 
                    }
                    .python-warning-decoration { 
                      background-color: rgba(255, 165, 0, 0.2) !important; 
                      border-bottom: 2px wavy orange !important; 
                    }
                    .python-error-inline { 
                      text-decoration: wavy underline red !important; 
                    }
                    .python-warning-inline { 
                      text-decoration: wavy underline orange !important; 
                    }
                    .error-glyph { 
                      width: 16px !important; 
                      height: 16px !important; 
                      display: inline-block !important;
                      margin-left: 5px !important;
                      background-color: transparent !important;
                      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important; 
                      background-size: 16px 16px !important;
                      background-repeat: no-repeat !important;
                      background-position: center !important;
                    }
                    .warning-glyph { 
                      width: 16px !important; 
                      height: 16px !important;
                      display: inline-block !important;
                      margin-left: 5px !important;
                      background-color: transparent !important;
                      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
                      background-size: 16px 16px !important;
                      background-repeat: no-repeat !important;
                      background-position: center !important;
                    }
                  `;
                  document.head.appendChild(style);
                }
                
                pythonEditors.forEach((editor: monaco.editor.IStandaloneCodeEditor) => {
                  try {
                    // Включаем отображение глифов в редакторе
                    editor.updateOptions({ 
                      glyphMargin: true,
                      lineNumbers: 'on',
                      minimap: { enabled: true }
                    });
                    
                    // Создаем декорации для ошибок
                    const errorDecorations = markers.map((marker: monaco.editor.IMarkerData) => ({
                      range: new monaco.Range(
                        marker.startLineNumber,
                        marker.startColumn,
                        marker.endLineNumber,
                        marker.endColumn
                      ),
                      options: {
                        className: marker.severity === monaco.MarkerSeverity.Error ? 'python-error-decoration' : 'python-warning-decoration',
                        hoverMessage: { value: marker.message },
                        inlineClassName: marker.severity === monaco.MarkerSeverity.Error ? 'python-error-inline' : 'python-warning-inline',
                        glyphMarginClassName: marker.severity === monaco.MarkerSeverity.Error ? 'error-glyph' : 'warning-glyph',
                        overviewRuler: {
                          color: marker.severity === monaco.MarkerSeverity.Error ? 'red' : 'orange',
                          position: monaco.editor.OverviewRulerLane.Right
                        }
                      }
                    }));
                    
                    // Удаляем старые декорации и применяем новые
                    const oldDecorations = editor.getDecorationsInRange(model.getFullModelRange()) || [];
                    const oldDecorationIds = oldDecorations
                      .filter(d => d.options.className?.includes('python-') || 
                                  d.options.glyphMarginClassName?.includes('-glyph'))
                      .map(d => d.id);
                      
                    console.log(`Удалено ${oldDecorationIds.length} старых декораций`);
                    editor.deltaDecorations(oldDecorationIds, errorDecorations);
                    
                    // Принудительно обновляем отображение редактора
                    setTimeout(() => {
                      editor.layout();
                      editor.render(true);
                    }, 100);
                  } catch (err) {
                    console.error('Ошибка при создании декораций:', err);
                  }
                });
              }
              
              // Принудительно обновляем все декорации во всех редакторах для гарантии отображения ошибок
              setTimeout(() => {
                if (window.forceUpdateAllDecorations) {
                  console.log('Принудительно обновляем все декорации редакторов');
                  window.forceUpdateAllDecorations();
                }
              }, 200);

              // Обновляем отображение проблем
              if (window.pythonDiagnosticsStore) {
                window.pythonDiagnosticsStore.setMarkers(uri, markers.map(marker => ({
                  severity: marker.severity === monaco.MarkerSeverity.Error ? 1 : 
                            marker.severity === monaco.MarkerSeverity.Warning ? 2 : 3,
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
                  source: marker.source
                })));
              }
              
              // Обновляем панель проблем
              try {
                const event = new CustomEvent('markers-updated', { 
                  detail: { uri, markers } 
                });
                document.dispatchEvent(event);
                
                const problemsEvent = new CustomEvent('python-diagnostics-updated', { 
                  detail: { diagnostics: window.pythonDiagnosticsStore?.getAllMarkersForUI() || [] } 
                });
                document.dispatchEvent(problemsEvent);
              } catch (err) {
                console.error('Ошибка при обновлении UI:', err);
              }
            } catch (error) {
              console.error('Ошибка при обновлении диагностики Python:', error);
            }
          }, 300); // Небольшая задержка для лучшей производительности
        });
      } catch (error) {
        console.error('Ошибка при регистрации Python для модели:', error);
      }
    };
    
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
    
    // Убедимся, что Python определяется правильно через расширение файла
    monaco.editor.onDidCreateModel((model: any) => {
      try {
        if (window.registerPythonForModel && typeof window.registerPythonForModel === 'function') {
          window.registerPythonForModel(model);
          
          // Добавляем обработчик изменений для автоматической диагностики
          if (model && model.getLanguageId() === 'python') {
            // Устанавливаем слушатель изменений с небольшой задержкой для анализа
            let updateTimeout: any = null;
            model.onDidChangeContent(() => {
              if (updateTimeout) {
                clearTimeout(updateTimeout);
              }
              
              updateTimeout = setTimeout(() => {
                if (window.updatePythonDiagnostics && typeof window.updatePythonDiagnostics === 'function') {
                  window.updatePythonDiagnostics(model.uri.toString())
                    .catch(err => console.error('Ошибка при автоматическом обновлении Python диагностики:', err));
                }
              }, 500);
            });
            
            // Запускаем немедленный анализ при создании модели
            setTimeout(() => {
              if (window.updatePythonDiagnostics && typeof window.updatePythonDiagnostics === 'function') {
                window.updatePythonDiagnostics(model.uri.toString())
                  .catch(err => console.error('Ошибка при инициализации Python диагностики:', err));
              }
              
              // Включаем отображение поля глифов во всех редакторах с этой моделью
              try {
                const editors = monaco.editor.getEditors();
                editors.forEach((editor: any) => {
                  if (editor.getModel() === model) {
                    editor.updateOptions({ glyphMargin: true });
                    console.log('Включено поле глифов для редактора Python');
                  }
                });
              } catch (err) {
                console.warn('Не удалось включить поле глифов:', err);
              }
            }, 100);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке новой модели Python:', error);
      }
    });
    
    // Проверяем существующие модели на наличие Python файлов
    setTimeout(() => {
      try {
        const models = monaco.editor.getModels();
        console.log(`Проверка ${models.length} существующих моделей на Python файлы...`);
        
        models.forEach((model: monaco.editor.ITextModel) => {
          if (window.registerPythonForModel && typeof window.registerPythonForModel === 'function') {
            window.registerPythonForModel(model);
          }
        });
      } catch (error) {
        console.error('Ошибка при проверке существующих моделей:', error);
      }
    }, 1000);
    
    // Пытаемся загрузить Pylance для улучшенного опыта
    initializePylance().catch(err => {
      console.warn('Не удалось инициализировать Pylance, используем встроенный анализатор:', err);
      
      // Если Pylance не загрузился, используем встроенное автодополнение
      setupBuiltinPythonSupport(monaco);
    });
    
    // Предзагружаем pip пакеты для автодополнения
    loadPipPackages().catch(err => console.error('Ошибка при предзагрузке pip пакетов:', err));

    // Добавляем глобальные функции для работы с диагностикой Python
    (window as any).updatePythonDiagnostics = async (filePath: string) => {
      try {
        console.log('Обновление встроенной диагностики Python для файла:', filePath);
        
        // Получаем содержимое файла из Monaco, если есть модель
        let content = '';
        let model = null;
        
        if (monaco && monaco.editor) {
          try {
            const models = monaco.editor.getModels();
            model = models.find((m: any) => {
              const modelPath = m.uri.path;
              return modelPath === filePath || 
                     modelPath.endsWith(filePath) || 
                     m.uri.toString().includes(filePath);
            });
            
            if (model) {
              content = model.getValue();
              console.log(`Получено содержимое для ${filePath} из Monaco модели`);
            }
          } catch (err) {
            console.warn('Ошибка при получении содержимого из модели Monaco:', err);
          }
        }
        
        // Если не удалось получить из Monaco, пробуем через Tauri
        if (!content) {
          try {
            content = await invoke('read_file', { path: filePath }) as string;
            console.log(`Получено содержимое для ${filePath} через Tauri API`);
          } catch (err) {
            console.error('Ошибка при чтении файла через Tauri:', err);
            return `error: Не удалось прочитать файл ${filePath}`;
          }
        }
        
        if (!content) {
          return `error: Пустое содержимое файла ${filePath}`;
        }
        
        // Проверяем, есть ли у нас доступ к Pylance API
        if (window.pylance && typeof window.pylance.provideDiagnostics === 'function') {
          try {
            console.log('Использование Pylance API для диагностики');
            const pylance = window.pylance;
            const diagnostics = await pylance.provideDiagnostics(filePath, content);
            
            if (diagnostics && Array.isArray(diagnostics)) {
              console.log(`Получено ${diagnostics.length} диагностических сообщений от Pylance`);
              
              // Убедимся что хранилище диагностики для Python существует
              if (!window.pythonDiagnosticsStore) {
                console.log('⚡ Создаем хранилище диагностики Python во время обработки ошибок');
                (window as any).pythonDiagnosticsStore = {
                  markers: new Map(),
                  setMarkers: function(uri: string, diagnostics: any[]) {
                    this.markers.set(uri, diagnostics);
                    console.log(`Установлено ${diagnostics.length} маркеров для ${uri}`);
                    
                    // Отправляем событие обновления маркеров
                    try {
                      const event = new CustomEvent('markers-updated', { 
                        detail: { uri, count: diagnostics.length, diagnostics } 
                      });
                      document.dispatchEvent(event);
                    } catch (err) {
                      console.warn('Ошибка при отправке события обновления маркеров:', err);
                    }
                  },
                  getMarkers: function(uri: string) {
                    return this.markers.get(uri) || [];
                  }
                };
              }
              
              // Обновляем хранилище маркеров
              window.pythonDiagnosticsStore.setMarkers(filePath, diagnostics);
              
              // Если у нас есть модель, устанавливаем маркеры напрямую
              if (model) {
                const markers = diagnostics.map((diag: any) => ({
                  severity: mapSeverity(diag.severity || 1),
                  startLineNumber: diag.range.start.line + 1,
                  startColumn: diag.range.start.character + 1,
                  endLineNumber: diag.range.end.line + 1,
                  endColumn: diag.range.end.character + 1,
                  message: diag.message,
                  source: 'Pylance'
                }));
                
                monaco.editor.setModelMarkers(model, 'python', markers);
                console.log(`Установлено ${markers.length} маркеров напрямую для модели`);
              }
            }
            
            // Обновляем визуальное отображение в любом случае
            setTimeout(() => {
              if (window.monaco && window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
                const editors = window.monaco.editor.getEditors();
                if (editors && editors.length > 0) {
                  console.log(`🎨 Обновление декораций для ${editors.length} редакторов после Python диагностики`);
                  editors.forEach((editor: any) => {
                    try {
                      if (window.setupErrorDecorations) {
                        window.setupErrorDecorations(editor);
                      }
                    } catch (err) {
                      console.warn('Ошибка при обновлении декораций:', err);
                    }
                  });
                }
              }
              
              // Отправляем событие для обновления панели проблем
              try {
                const problemsEvent = new CustomEvent('python-diagnostics-updated', { 
                  detail: { diagnostics: window.pythonDiagnosticsStore?.getAllMarkersForUI() || [] } 
                });
                document.dispatchEvent(problemsEvent);
              } catch (err) {
                console.warn('Ошибка при отправке события обновления панели проблем:', err);
              }
            }, 100);
            
            return 'success';
          } catch (pylanceError) {
            console.error('Ошибка при использовании Pylance API:', pylanceError);
            // Продолжаем с LSP-сервером как запасным вариантом
          }
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
          
          // Принудительно запрашиваем диагностику
          languageServerManager.sendNotification('python', 'textDocument/didChange', {
            textDocument: {
              uri: filePath,
              version: 2
            },
            contentChanges: [{ text: content }]
          });
          
          // Обновляем визуальное отображение ошибок в редакторе
          setTimeout(() => {
            if (window.monaco && window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
              const editors = window.monaco.editor.getEditors();
              if (editors && editors.length > 0) {
                console.log(`🎨 Обновление декораций для ${editors.length} редакторов после Python диагностики`);
                editors.forEach((editor: any) => {
                  try {
                    if (window.setupErrorDecorations) {
                      window.setupErrorDecorations(editor);
                    }
                  } catch (err) {
                    console.warn('Ошибка при обновлении декораций:', err);
                  }
                });
              }
            }
          }, 100); // Уменьшаем задержку для быстрого обновления
          
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
        
        // Создаем функцию для принудительного обновления всех Python моделей
        (window as any).updateAllPythonModels = () => {
          try {
            const models = monaco.editor.getModels();
            let pythonModelsCount = 0;
            
            models.forEach((model: monaco.editor.ITextModel) => {
              if (model.getLanguageId() === 'python') {
                pythonModelsCount++;
                
                if (window.registerPythonForModel && typeof window.registerPythonForModel === 'function') {
                  window.registerPythonForModel(model);
                  
                  // Включаем glyphMargin во всех редакторах с Python
                  const editors = monaco.editor.getEditors().filter((editor: any) => 
                    editor.getModel() && editor.getModel().uri.toString() === model.uri.toString()
                  );
                  
                  editors.forEach((editor: any) => {
                    // Устанавливаем опции для правильного отображения глифов
                    editor.updateOptions({ 
                      glyphMargin: true,
                      lineNumbers: 'on',
                      folding: true,
                      minimap: { enabled: true }
                    });
                    
                    // Принудительно обновляем редактор
                    setTimeout(() => {
                      try {
                        // Получаем текущие маркеры для модели
                        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                        
                        // Только если есть маркеры, создаем декорации
                        if (markers && markers.length > 0) {
                          console.log(`Применяем ${markers.length} декораций напрямую`);
                        
                          // Создаем декорации для ошибок (используя уникальные маркеры)
                          const decorations = Array.from(new Set(markers.map(m => JSON.stringify(m)))).map(key => {
                            const marker = JSON.parse(key);
                            const isError = marker.severity === monaco.MarkerSeverity.Error;
                            
                            return [
                              // Декорация для всей строки (фон)
                              {
                                range: new monaco.Range(
                                  marker.startLineNumber, 
                                  1,
                                  marker.startLineNumber,
                                  model.getLineMaxColumn(marker.startLineNumber)
                                ),
                                options: {
                                  isWholeLine: true,
                                  className: isError ? 'error-line' : 'warning-line',
                                  glyphMarginClassName: isError ? 'error-glyph' : 'warning-glyph',
                                  overviewRuler: {
                                    color: isError ? '#F14C4C' : '#CCA700',
                                    position: monaco.editor.OverviewRulerLane.Right
                                  },
                                  minimap: {
                                    color: isError ? '#F14C4C' : '#CCA700',
                                    position: monaco.editor.MinimapPosition.Inline
                                  },
                                  hoverMessage: { value: marker.message }
                                }
                              },
                              // Декорация для конкретного места ошибки (подчеркивание)
                              {
                                range: new monaco.Range(
                                  marker.startLineNumber,
                                  marker.startColumn,
                                  marker.endLineNumber,
                                  marker.endColumn
                                ),
                                options: {
                                  className: isError ? 'error-text' : 'warning-text',
                                  hoverMessage: { value: marker.message },
                                  stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                                }
                              }
                            ];
                          }).flat();
                          
                          // Применяем декорации
                          const oldDecorations: string[] = [];
                          editor.deltaDecorations(oldDecorations, decorations);
                        }
                        
                        editor.layout();
                        editor.render(true);
                        console.log('✅ Редактор Python полностью обновлен с включенными глифами');
                      } catch (e) {
                        console.warn('Не удалось обновить редактор:', e);
                      }
                    }, 100);
                  });
                }
              }
            });
            
            console.log(`Обновлено ${pythonModelsCount} Python моделей`);
            return pythonModelsCount;
          } catch (err) {
            console.error('Ошибка при обновлении Python моделей:', err);
            return 0;
          }
        };
        
        // Запускаем обновление моделей сразу после полной загрузки
        setTimeout(() => {
          if ((window as any).updateAllPythonModels) {
            (window as any).updateAllPythonModels();
            
            // Запускаем еще раз через 3 секунды для более надежного результата
            setTimeout(() => {
              if ((window as any).updateAllPythonModels) {
                (window as any).updateAllPythonModels();
              }
            }, 3000);
          }
        }, 1000);
      } catch (error) {
        console.error('Ошибка при настройке обработчиков Python диагностики:', error);
      }
    }, 1000);
    
    // Добавляем функцию для принудительного обновления отображения декораций в текущем редакторе
    window.setupErrorDecorations = function(editor) {
      if (!editor || !editor.getModel) return;
      
      const model = editor.getModel();
      if (!model) return;
      
      // Получаем идентификатор модели для дебаунсинга
      const modelUri = model.uri.toString();
      
      // Извлекаем имя файла из URI для отображения в сообщениях об ошибках
      const uriParts = modelUri.split('/');
      const filename = uriParts[uriParts.length - 1] || '';
      
      // Отменяем предыдущий таймер, если он есть
      if (decorationTimers.has(modelUri)) {
        clearTimeout(decorationTimers.get(modelUri));
      }
      
      // Настраиваем опции редактора для унифицированной высоты строк
      editor.updateOptions({ 
        glyphMargin: true,
        lineHeight: 18, // Фиксированная высота строки (как у предупреждений)
        lineDecorationsWidth: 8, // Уменьшаем ширину декораций
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        fontLigatures: false, // Отключаем лигатуры для точного контроля высоты
        fixedOverflowWidgets: true // Фиксируем виджеты переполнения
      });
      
      // Устанавливаем новый таймер с задержкой в 150мс для быстрого обновления
      const timerId = setTimeout(() => {
        try {
          // Получаем маркеры для текущей модели
          const markers = monaco.editor.getModelMarkers({ resource: model.uri });
          
          // Создаем хеш для текущих маркеров для сравнения
          const markersHash = JSON.stringify(markers.map(m => ({
            line: m.startLineNumber, 
            col: m.startColumn,
            msg: m.message,
            sev: m.severity
          })));
          
          // Проверяем, изменились ли маркеры с прошлого вызова
          if (lastMarkersCache.get(modelUri) === markersHash) {
            // Если маркеры не изменились, просто выходим
            return;
          }
          
          // Сохраняем новый хеш маркеров
          lastMarkersCache.set(modelUri, markersHash);
          
          // Добавляем CSS стили для подсветки ошибок
          if (!document.getElementById('monaco-error-styles')) {
            const style = document.createElement('style');
            style.id = 'monaco-error-styles';
            style.innerHTML = `
              .monaco-editor .error-line { 
                background-color: rgba(255, 0, 0, 0.03) !important;
                height: 18px !important;
                min-height: 18px !important;
                max-height: 18px !important;
                line-height: 18px !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .monaco-editor .warning-line { 
                background-color: rgba(255, 165, 0, 0.03) !important;
                height: 18px !important;
                min-height: 18px !important;
                max-height: 18px !important;
                line-height: 18px !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .monaco-editor .error-text { 
                border-bottom: 1px wavy red !important;
                margin: 0 !important;
                height: 18px !important;
                max-height: 18px !important;
                min-height: 18px !important;
                line-height: 18px !important;
                box-sizing: border-box !important;
              }
              .monaco-editor .warning-text { 
                border-bottom: 1px wavy orange !important;
                margin: 0 !important;
                height: 18px !important;
                max-height: 18px !important;
                min-height: 18px !important;
                line-height: 18px !important;
                box-sizing: border-box !important;
              }
              .monaco-editor .error-glyph {
                background: #F14C4C !important;
                margin-left: 2px !important;
                width: 3px !important;
                height: 12px !important;
                border-radius: 1px !important;
              }
              .monaco-editor .warning-glyph {
                background: #CCA700 !important;
                margin-left: 2px !important;
                width: 3px !important;
                height: 12px !important;
                border-radius: 1px !important;
              }
              /* Стили для всплывающих сообщений об ошибках */
              .monaco-hover-content {
                font-size: 11px !important;
                line-height: 1.2 !important;
                max-width: 600px !important;
                padding: 3px 6px !important;
              }
              /* Унифицируем высоту строк в редакторе */
              .monaco-editor .view-lines {
                line-height: 18px !important;
              }
              .monaco-editor .view-line {
                height: 18px !important;
                min-height: 18px !important;
                max-height: 18px !important;
                line-height: 18px !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              /* Исправляем отображение линий с ошибками */
              .monaco-editor .view-overlays .current-line,
              .monaco-editor .margin-view-overlays .current-line-margin {
                height: 18px !important;
                min-height: 18px !important;
                max-height: 18px !important;
              }
            `;
            document.head.appendChild(style);
          }
          
          // Очищаем предыдущие декорации
          if (editor._errorDecorations) {
            editor.deltaDecorations(editor._errorDecorations, []);
          }
          
          // Если нет маркеров, просто выходим
          if (!markers || markers.length === 0) {
            editor._errorDecorations = [];
            return;
          }
          
          // Создаем уникальный набор маркеров, удаляя дубликаты
          const uniqueMarkers = new Map();
          markers.forEach(marker => {
            const key = `${marker.startLineNumber}:${marker.message}`;
            if (!uniqueMarkers.has(key)) {
              uniqueMarkers.set(key, marker);
            }
          });
          
          // Создаем декорации для подсветки ошибок (используя уникальные маркеры)
          const decorations = Array.from(uniqueMarkers.values()).map(marker => {
            const isError = marker.severity === monaco.MarkerSeverity.Error;
            
            // Форматируем сообщение для единообразного отображения
            const formattedMessage = formatErrorMessage(marker.message, filename, isError);
            
            return [
              // Декорация для всей строки (фон)
              {
                range: new monaco.Range(
                  marker.startLineNumber, 
                  1,
                  marker.startLineNumber,
                  model.getLineMaxColumn(marker.startLineNumber)
                ),
                options: {
                  isWholeLine: true,
                  className: isError ? 'error-line' : 'warning-line',
                  glyphMarginClassName: isError ? 'error-glyph' : 'warning-glyph',
                  overviewRuler: {
                    color: isError ? '#F14C4C' : '#CCA700',
                    position: monaco.editor.OverviewRulerLane.Right
                  },
                  minimap: {
                    color: isError ? '#F14C4C' : '#CCA700',
                    position: monaco.editor.MinimapPosition.Inline
                  },
                  hoverMessage: { value: formattedMessage }
                }
              },
              // Декорация для конкретного места ошибки (подчеркивание)
              {
                range: new monaco.Range(
                  marker.startLineNumber,
                  marker.startColumn,
                  marker.endLineNumber,
                  marker.endColumn
                ),
                options: {
                  className: isError ? 'error-text' : 'warning-text',
                  hoverMessage: { value: formattedMessage },
                  stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                }
              }
            ];
          }).flat();
          
          // Применяем декорации
          editor._errorDecorations = editor.deltaDecorations([], decorations);
          
        } catch (error) {
          console.error('Ошибка при настройке декораций ошибок:', error);
        }
      }, 150); // 150ms задержка для дебаунсинга
      
      // Сохраняем ID таймера
      decorationTimers.set(modelUri, timerId);
    };

    // Обновленная функция для принудительного обновления всех декораций
    window.forceUpdateAllDecorations = function() {
      try {
        // Получаем все редакторы
        const editors = window.monaco.editor.getEditors();
        console.log(`Принудительное обновление декораций для ${editors.length} редакторов`);
        
        if (editors && editors.length > 0) {
          // Создаем Set для отслеживания обработанных URI, чтобы не обрабатывать одну модель несколько раз
          const processedUris = new Set();
          
          // Обновляем декорации для каждого редактора
          editors.forEach((editor) => {
            if (editor && editor.getModel && editor.getModel()) {
              const model = editor.getModel();
              const uri = model.uri.toString();
              
              // Если мы уже обработали эту модель, пропускаем
              if (processedUris.has(uri)) return;
              
              // Запрашиваем маркеры для модели
              const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
              console.log(`Найдено ${markers.length} маркеров для ${uri}`);
              
              // Отмечаем URI как обработанный
              processedUris.add(uri);
              
              // Унифицируем опции редактора для всех редакторов
              editor.updateOptions({ 
                glyphMargin: true,
                lineHeight: 18, // Фиксированная одинаковая высота строки
                lineDecorationsWidth: 8,
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
                fontLigatures: false,
                fixedOverflowWidgets: true
              });
              
              // Применяем декорации через унифицированный обработчик
              if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
                window.setupErrorDecorations(editor);
              }
            }
          });
          
          // Уведомляем об обновлении маркеров
          if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('markers-updated'));
          }
          
          // Обновляем панель проблем
          if (window.pythonDiagnosticsStore) {
            const diagnostics = window.pythonDiagnosticsStore.getAllMarkersForUI() || [];
            if (typeof document !== 'undefined') {
              document.dispatchEvent(new CustomEvent('python-diagnostics-updated', { 
                detail: { diagnostics } 
              }));
            }
          }
          
          return editors.length;
        } else {
          console.log('Нет активных редакторов для обновления декораций');
          return 0;
        }
      } catch (error) {
        console.error('Ошибка при обновлении всех декораций:', error);
        return 0;
      }
    };

    // Расширенные интерфейсы для редактора и модели
    interface EditorWithDecorations extends monaco.editor.IStandaloneCodeEditor {
      _errorDecorationIds?: string[];
      _errorLineDecorationIds?: string[];
      _errorUpdateInterval?: NodeJS.Timeout;
      _decorationsInterval?: NodeJS.Timeout;
      _modelChangeDisposable?: monaco.IDisposable;
    }

    interface ModelWithHandler extends monaco.editor.ITextModel {
      _markerSaveHandlerAdded?: boolean;
    }

    // Подписка на изменения маркеров Monaco
    window.monaco.editor.onDidChangeMarkers((uris: monaco.Uri[]) => {
      // Когда меняются маркеры, сохраняем их в глобальное хранилище
      uris.forEach((uri: monaco.Uri) => {
        const markers = window.monaco.editor.getModelMarkers({ resource: uri });
        if (markers && markers.length > 0) {
          globalMarkersStore.set(uri.toString(), markers);
        }
      });
      
      // Обновляем все декорации
      setTimeout(() => {
        if (window.forceUpdateAllDecorations) {
          window.forceUpdateAllDecorations();
        }
      }, 300);
    });

    // Глобальное хранилище маркеров для всех файлов
    const globalMarkersStore = new Map<string, monaco.editor.IMarker[]>();

    // Добавляем хранилище маркеров в глобальный объект window
    window.globalMarkersStore = globalMarkersStore;

    // Добавляем стили для улучшения отображения ховеров с ошибками
    if (!document.getElementById('improved-hover-styles')) {
      const hoverStyleElement = document.createElement('style');
      hoverStyleElement.id = 'improved-hover-styles';
      hoverStyleElement.innerHTML = `
        /* Компактные стили для всплывающих подсказок */
        .monaco-hover {
          font-size: 11px !important;
          line-height: 1.1 !important;
          padding: 2px 4px !important;
          max-width: 600px !important;
          background-color: #1e1e1e !important;
          border: 1px solid #454545 !important;
          border-radius: 3px !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        }
        
        .monaco-hover .hover-row {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .monaco-hover .hover-contents {
          padding: 3px !important;
          margin: 0 !important;
        }
        
        .monaco-hover-content {
          white-space: normal !important;
        }
        
        .monaco-hover code {
          font-size: 10px !important;
          padding: 1px 2px !important;
          background-color: #252525 !important;
          border-radius: 2px !important;
        }
        
        /* Улучшенный стиль для полосы прокрутки */
        .monaco-scrollable-element .scrollbar.vertical {
          width: 6px !important;
        }
        
        .monaco-scrollable-element .scrollbar.horizontal {
          height: 6px !important;
        }
        
        .monaco-scrollable-element .slider {
          background-color: rgba(121, 121, 121, 0.4) !important;
        }
      `;
      document.head.appendChild(hoverStyleElement);
      console.log('✅ Добавлены улучшенные стили для всплывающих подсказок');
    }

    /**
     * Применение унифицированных стилей для ошибок и предупреждений
     */
    function applyUnifiedErrorStyles() {
      // Применяем стили только один раз
      if (document.getElementById('unified-error-styles')) return;
      
      try {
        const style = document.createElement('style');
        style.id = 'unified-error-styles';
        style.innerHTML = `
          /* Базовые стили для всех строк в редакторе */
          .monaco-editor .view-lines {
            line-height: 18px !important;
          }
          .monaco-editor .view-line {
            height: 18px !important;
            min-height: 18px !important;
            max-height: 18px !important;
            line-height: 18px !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Унифицированные стили для ошибок и предупреждений */
          .monaco-editor .error-line,
          .monaco-editor .warning-line {
            height: 18px !important;
            min-height: 18px !important;
            max-height: 18px !important;
            line-height: 18px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .monaco-editor .error-line {
            background-color: rgba(255, 0, 0, 0.03) !important;
          }
          
          .monaco-editor .warning-line {
            background-color: rgba(255, 165, 0, 0.03) !important;
          }
          
          .monaco-editor .error-text,
          .monaco-editor .warning-text {
            height: 18px !important;
            min-height: 18px !important;
            max-height: 18px !important;
            line-height: 18px !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          
          .monaco-editor .error-text {
            border-bottom: 1px wavy #F14C4C !important;
          }
          
          .monaco-editor .warning-text {
            border-bottom: 1px wavy #CCA700 !important;
          }
          
          /* Унифицированные глифы для ошибок и предупреждений */
          .monaco-editor .error-glyph,
          .monaco-editor .warning-glyph {
            margin-left: 2px !important;
            width: 3px !important;
            height: 12px !important;
            border-radius: 1px !important;
          }
          
          .monaco-editor .error-glyph {
            background: #F14C4C !important;
          }
          
          .monaco-editor .warning-glyph {
            background: #CCA700 !important;
          }
          
          /* Стили для компактных всплывающих подсказок */
          .monaco-hover-content {
            font-size: 11px !important;
            line-height: 1.2 !important;
            max-width: 600px !important;
            padding: 3px 6px !important;
          }
        `;
        document.head.appendChild(style);
        console.log('✅ Применены унифицированные стили для ошибок и предупреждений');
        
        // Сразу обновляем все декорации, если доступна функция
        if (window.forceUpdateAllDecorations && typeof window.forceUpdateAllDecorations === 'function') {
          setTimeout(() => {
            window.forceUpdateAllDecorations();
          }, 500);
        }
      } catch (error) {
        console.error('Ошибка при применении унифицированных стилей:', error);
      }
    }

    // Применяем стили при загрузке
    if (typeof document !== 'undefined') {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyUnifiedErrorStyles();
      } else {
        document.addEventListener('DOMContentLoaded', applyUnifiedErrorStyles);
      }
    }

    // Также применяем стили при инициализации Python поддержки
    setTimeout(applyUnifiedErrorStyles, 2000);

    /**
     * Форматирование сообщения об ошибке для компактного и единообразного отображения
     * @param message Оригинальное сообщение об ошибке
     * @param filename Имя файла для отображения
     * @param isError Флаг, является ли ошибкой (true) или предупреждением (false)
     * @returns Отформатированное сообщение
     */
    function formatErrorMessage(message, filename, isError) {
      // Очищаем сообщение от лишних деталей
      let cleanMessage = message
        .replace(/Python \[\d+(\.\d+)*\]/g, '')
        .replace(/\(pycodestyle\)/g, '')
        .replace(/\(pylint\)/g, '')
        .replace(/\(mypy\)/g, '')
        .replace(/\(pyflakes\)/g, '')
        .replace(/(^\s+|\s+$)/g, ''); // Удаляем пробелы в начале и конце
      
      // Добавляем имя файла и тип ошибки
      const prefix = isError ? '[Ошибка]' : '[Предупреждение]';
      
      // Если имя файла доступно, добавляем его
      if (filename) {
        return `${prefix} ${filename}: ${cleanMessage}`;
      }
      
      return `${prefix} ${cleanMessage}`;
    }
  } catch (error) {
    console.error('Ошибка при настройке обработчиков Python диагностики:', error);
  }
};