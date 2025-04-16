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
                          
                          // Применяем декорации
                          const oldDecorations: string[] = [];
                          editor.deltaDecorations(oldDecorations, errorDecorations);
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
    window.setupErrorDecorations = (editor: any) => {
      try {
        if (!editor || !editor.getModel || !editor.getModel()) {
          console.warn('Невозможно настроить декорации ошибок: редактор или модель отсутствуют');
          return;
        }
        
        // Получаем модель редактора
        const model = editor.getModel();
        const uri = model.uri.toString();
        
        // Устанавливаем glyphMargin = true для отображения иконок ошибок
        editor.updateOptions({ 
          glyphMargin: true,
          lineNumbers: 'on',
          minimap: { enabled: true }
        });
        
        // Получаем маркеры ошибок для модели
        const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        console.log(`Получено ${markers.length} маркеров для модели ${uri}`);
        
        // Добавляем CSS стили для отображения ошибок если их еще нет
        if (!document.getElementById('error-styles-forced')) {
          const styles = document.createElement('style');
          styles.id = 'error-styles-forced';
          styles.innerHTML = `
            /* Улучшенные стили для отображения ошибок */
            .monaco-editor .squiggly-error {
              background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ff1212'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
              border-bottom: 2px wavy #ff0000 !important;
            }
            .monaco-editor .squiggly-warning {
              background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ffa500'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
              border-bottom: 2px wavy #ffa500 !important;
            }
            .monaco-editor .squiggly-info {
              background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%2375beff'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
              border-bottom: 2px wavy #75beff !important;
            }
            
            /* Стили для заметных ошибок и предупреждений */
            .monaco-editor .error-decoration {
              background-color: rgba(255, 0, 0, 0.2) !important;
              border-left: 4px solid red !important;
            }
            .monaco-editor .warning-decoration {
              background-color: rgba(255, 166, 0, 0.2) !important;
              border-left: 4px solid orange !important;
            }
            
            /* Стили для гильфов (значков на полях) */
            .monaco-editor .error-glyph {
              background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important;
              background-size: cover !important;
              margin-left: 5px !important;
            }
            .monaco-editor .warning-glyph {
              background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
              background-size: cover !important;
              margin-left: 5px !important;
            }
            
            /* Добавляем подсветку строк */
            .current-line-error {
              background-color: rgba(255, 0, 0, 0.1) !important;
            }
            .current-line-warning {
              background-color: rgba(255, 165, 0, 0.1) !important;
            }
          `;
          document.head.appendChild(styles);
        }
        
        // Очищаем старые декорации, если они есть
        if (editor._errorDecorationIds) {
          editor.deltaDecorations(editor._errorDecorationIds, []);
          editor._errorDecorationIds = [];
        }
        
        if (editor._errorLineDecorationIds) {
          editor.deltaDecorations(editor._errorLineDecorationIds, []);
          editor._errorLineDecorationIds = [];
        }
        
        // Если нет маркеров, просто очищаем декорации и выходим
        if (!markers || markers.length === 0) {
          console.log('Нет маркеров для отображения');
          return;
        }
        
        try {
          // Создаем декорации для каждого маркера
          const errorDecorations = markers.map((marker: any) => {
            const isError = marker.severity === window.monaco.MarkerSeverity.Error;
            const isWarning = marker.severity === window.monaco.MarkerSeverity.Warning;
            const isInfo = marker.severity === window.monaco.MarkerSeverity.Info;
            
            // Определяем класс для декорации
            let className, glyphClassName;
            if (isError) {
              className = 'error-decoration';
              glyphClassName = 'error-glyph';
            } else if (isWarning) {
              className = 'warning-decoration';
              glyphClassName = 'warning-glyph';
            } else {
              className = 'info-decoration';
              glyphClassName = 'info-glyph';
            }
            
            return {
              range: new window.monaco.Range(
                marker.startLineNumber,
                marker.startColumn,
                marker.endLineNumber,
                marker.endColumn
              ),
              options: {
                className: className,
                hoverMessage: { value: marker.message },
                inlineClassName: isError ? 'squiggly-error' : isWarning ? 'squiggly-warning' : 'squiggly-info',
                glyphMarginClassName: glyphClassName,
                stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                overviewRuler: {
                  color: isError ? 'red' : isWarning ? 'orange' : 'blue',
                  position: window.monaco.editor.OverviewRulerLane.Right
                }
              }
            };
          });
          
          // Применяем новые декорации
          editor._errorDecorationIds = editor.deltaDecorations([], errorDecorations);
          console.log(`Применено ${errorDecorations.length} декораций к редактору`);
          
          // Добавляем подсветку строк с ошибками/предупреждениями
          const lineDecorations = markers.map((marker: any) => {
            const isError = marker.severity === window.monaco.MarkerSeverity.Error;
            return {
              range: new window.monaco.Range(
                marker.startLineNumber,
                1,
                marker.startLineNumber,
                model.getLineMaxColumn(marker.startLineNumber)
              ),
              options: {
                isWholeLine: true,
                className: isError ? 'current-line-error' : 'current-line-warning',
                stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
              }
            };
          });
          
          // Применяем декорации строк
          editor._errorLineDecorationIds = editor.deltaDecorations([], lineDecorations);
          
          // Принудительно перерисовываем редактор
          setTimeout(() => {
            editor.render(true);
            editor.layout();
          }, 100);
        } catch (err) {
          console.error('Ошибка при создании декораций:', err);
        }
      } catch (error) {
        console.error('Ошибка при настройке декораций:', error);
      }
    };
    
    // Добавляем функцию для обновления всех редакторов
    window.forceUpdateAllDecorations = () => {
      try {
        console.log('Принудительное обновление всех декораций ошибок');
        const editors = window.monaco.editor.getEditors();
        
        if (editors && editors.length > 0) {
          console.log(`Найдено ${editors.length} редакторов для обновления декораций`);
          
          editors.forEach((editor: any) => {
            if (editor && editor.getModel() && typeof window.setupErrorDecorations === 'function') {
              window.setupErrorDecorations(editor);
            }
          });
        } else {
          console.log('Не найдено редакторов для обновления декораций');
        }
      } catch (error) {
        console.error('Ошибка при обновлении всех декораций:', error);
      }
    };
    
    // Обновляем все редакторы при запуске
    setTimeout(() => {
      window.forceUpdateAllDecorations?.();
    }, 1000);
    
    // Подключение к событиям редактора для обновления декораций
    monaco.editor.onDidCreateEditor((editor: monaco.editor.IStandaloneCodeEditor) => {
      // Добавляем обработчик события загрузки файла
      try {
        editor.onDidChangeModel((e: { oldModelUrl: monaco.Uri | null; newModelUrl: monaco.Uri | null }) => {
          // Если есть модель и это Python файл, обновляем декорации
          const model = editor.getModel();
          if (model && model.getLanguageId() === 'python') {
            console.log('🐍 Python файл открыт в редакторе, обновляем декорации');
            
            // Небольшая задержка для загрузки файла
            setTimeout(() => {
              if (window.setupErrorDecorations) {
                window.setupErrorDecorations(editor);
              }
            }, 500);
          }
        });
        
        // Обработка изменений в модели
        const model = editor.getModel();
        if (model && model.getLanguageId() === 'python') {
          // Используем объект для хранения таймаутов для каждой модели
          const modelUpdateTimeouts = new Map<string, number>();
          const modelUri = model.uri.toString();
          
          model.onDidChangeContent(() => {
            // Откладываем обновление декораций
            const existingTimeout = modelUpdateTimeouts.get(modelUri);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            
            const timeoutId = window.setTimeout(() => {
              if (window.setupErrorDecorations) {
                window.setupErrorDecorations(editor);
              }
              modelUpdateTimeouts.delete(modelUri);
            }, 1000);
            
            modelUpdateTimeouts.set(modelUri, timeoutId);
          });
        }
      } catch (err) {
        console.warn('Ошибка при добавлении обработчиков событий редактора:', err);
      }
    });
    
    // Обновляем декорации при загрузке окна
    window.addEventListener('load', () => {
      // Обновляем все декорации с задержкой
      setTimeout(() => {
        if (window.monaco && window.monaco.editor) {
          const editors = window.monaco.editor.getEditors();
          if (editors && editors.length > 0) {
            console.log(`🔄 Обновление декораций для ${editors.length} редакторов при загрузке`);
            editors.forEach((editor: any) => {
              try {
                if (window.setupErrorDecorations) {
                  window.setupErrorDecorations(editor);
                }
              } catch (err) {
                console.warn('Ошибка при обновлении декораций редактора:', err);
              }
            });
          }
        }
      }, 1000);
    });
    
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
    
    // Создаем автоматическое дополнение для модулей
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
        try {
          // Получаем текущую линию и позицию
          const wordUntilPosition = model.getWordUntilPosition(position);
          
          // Базовое определение диапазона для замены
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordUntilPosition.startColumn,
            endColumn: wordUntilPosition.endColumn
          };
          
          // Базовые ключевые слова Python
          const pythonKeywords = [
            'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
            'def', 'del', 'elif', 'else', 'except', 'exec', 'finally', 'for', 'from',
            'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
            'pass', 'print', 'raise', 'return', 'try', 'while', 'with', 'yield',
            'match', 'case', 'True', 'False', 'None'
          ];
          
          const suggestions = [
            ...pythonKeywords.map(keyword => ({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range
            })),
            ...pythonModuleHints.map(hint => ({
              ...hint,
              range
            }))
          ];
          
          return { suggestions };
        } catch (error) {
          console.error('Ошибка в провайдере автодополнений Python:', error);
          return { suggestions: [] };
        }
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
    
    // Создаем хранилище диагностики для Python
    if (!(window as any).pythonDiagnosticsStore) {
      console.log('Создаем хранилище диагностики Python');
      (window as any).pythonDiagnosticsStore = {
        markers: new Map(),
        setMarkers: function(uri: string, diagnostics: any[]) {
          this.markers.set(uri, diagnostics);
          console.log(`Установлено ${diagnostics.length} маркеров для ${uri}`);
          
          // Отправляем событие обновления маркеров
          try {
            const event = new CustomEvent('markers-updated', { detail: { uri, count: diagnostics.length } });
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
              return { suggestions: [] };
            }
            
            return result;
          } else {
            return { suggestions: [] };
          }
        } catch (error) {
          console.error('Ошибка при получении автодополнений от Pylance:', error);
          return { suggestions: [] };
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
          
          // Добавляем визуализацию ошибок в Monaco редакторе
          setTimeout(() => {
            try {
              const editors = window.monaco.editor.getEditors();
              if (editors && editors.length > 0) {
                console.log(`🎨 Визуализация ошибок Pylance для ${editors.length} редакторов`);
                
                // Прямое обновление маркеров для всех файлов Python
                if (diagnostics && Array.isArray(diagnostics)) {
                  const markers = diagnostics.map((diag: any) => ({
                    severity: mapSeverity(diag.severity || 1),
                    startLineNumber: diag.range.start.line + 1,
                    startColumn: diag.range.start.character + 1,
                    endLineNumber: diag.range.end.line + 1,
                    endColumn: diag.range.end.character + 1,
                    message: diag.message,
                    source: 'Pylance'
                  }));
                  
                  // Найдем правильную модель для URI
                  const models = monaco.editor.getModels();
                  for (const model of models) {
                    const modelUri = model.uri.toString();
                    if (modelUri === uri || uri.endsWith(model.uri.path) || modelUri.endsWith(uri)) {
                      console.log(`📌 Установка ${markers.length} маркеров для ${modelUri}`);
                      monaco.editor.setModelMarkers(model, 'python', markers);
                      
                      // Обновляем декорации редактора, если модель открыта
                      editors.forEach((editor: monaco.editor.IStandaloneCodeEditor) => {
                        if (editor.getModel() === model) {
                          if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
                            window.setupErrorDecorations(editor);
                          } else {
                            // Добавим собственную подсветку ошибок
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
                            
                            // Добавляем CSS стили для подсветки, если их нет
                            if (!document.getElementById('python-error-styles')) {
                              const style = document.createElement('style');
                              style.id = 'python-error-styles';
                              style.innerHTML = `
                                .python-error-decoration { background-color: rgba(255, 0, 0, 0.1); border-bottom: 1px wavy red; }
                                .python-warning-decoration { background-color: rgba(255, 165, 0, 0.1); border-bottom: 1px wavy orange; }
                                .python-error-inline { text-decoration: wavy underline red; }
                                .python-warning-inline { text-decoration: wavy underline orange; }
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
                              `;
                              document.head.appendChild(style);
                            }
                            
                            editor.createDecorationsCollection(errorDecorations);
                          }
                        }
                      });
                    }
                  }
                }
              }
            } catch (err) {
              console.error('Ошибка при визуализации ошибок Pylance:', err);
            }
          }, 100); // Уменьшаем задержку для быстрого отображения
        }
      } catch (error) {
        console.error('Ошибка при обработке диагностики Pylance:', error);
      }
    });
    
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
    
    console.log('Pylance успешно настроен');
    
    // Сохраняем глобальную ссылку на Pylance
    (window as any).pylance = pylance;
    
    return true;
  } catch (error) {
    console.error('Ошибка при инициализации Pylance:', error);
    return false;
  }
}

// Регистрируем функцию для отображения ошибок в Monaco Editor
function setupErrorDecorationsImpl(editor: any) {
  try {
    if (!editor || !editor.getModel || !editor.getModel()) {
      console.error('🚫 Невозможно настроить декорации: редактор или модель отсутствуют');
      return;
    }
    
    const model = editor.getModel();
    const uri = model.uri.toString();
    
    // Всегда включаем отображение глифов и линий
    editor.updateOptions({ 
      glyphMargin: true,
      lineNumbers: 'on',
      minimap: { enabled: true }
    });
    
    // Принудительно добавляем стили
    if (!document.getElementById('python-force-error-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'python-force-error-styles';
      styleElement.innerHTML = `
        /* Принудительные стили для отображения ошибок в редакторе */
        .monaco-editor .python-error-decoration {
          background-color: rgba(255, 0, 0, 0.15) !important;
          border-bottom: 2px wavy #ff0000 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        
        .monaco-editor .python-warning-decoration {
          background-color: rgba(255, 165, 0, 0.15) !important;
          border-bottom: 2px wavy #ffa500 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        
        .monaco-editor .error-glyph {
          width: 12px !important;
          height: 12px !important;
          margin-left: 3px !important;
          background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important;
          background-size: 12px 12px !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-color: transparent !important;
        }
        
        .monaco-editor .warning-glyph {
          width: 12px !important;
          height: 12px !important;
          margin-left: 3px !important;
          background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
          background-size: 12px 12px !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-color: transparent !important;
        }

        /* Подсветка строк с ошибками в редакторе */
        .monaco-editor .view-overlays .current-line-error {
          background-color: rgba(255, 0, 0, 0.05) !important;
          border-left: 2px solid #ff0000 !important;
        }
        
        .monaco-editor .view-overlays .current-line-warning {
          background-color: rgba(255, 165, 0, 0.05) !important;
          border-left: 2px solid #ffa500 !important;
        }
      `;
      document.head.appendChild(styleElement);
      console.log('✅ Добавлены принудительные стили для декораций ошибок');
    }
    
    // Прямой способ установки маркеров для модели
    try {
      // Попытка получить маркеры напрямую через API Monaco
      let markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
      
      console.log(`🔍 Найдено ${markers ? markers.length : 0} маркеров для ${uri}`);
      
      // Очищаем все существующие декорации
      if (editor._errorDecorationIds && Array.isArray(editor._errorDecorationIds)) {
        console.log(`🧹 Удаление ${editor._errorDecorationIds.length} старых декораций по ID`);
        editor.deltaDecorations(editor._errorDecorationIds, []);
        editor._errorDecorationIds = [];
      }
      
      // Если есть маркеры, создаем декорации
      if (markers && markers.length > 0) {
        // Создаем декорации из маркеров
        const decorations = markers.map((marker: any) => {
          // Проверяем, что у маркера есть все необходимые свойства
          if (!marker.startLineNumber || !marker.startColumn || !marker.endLineNumber || !marker.endColumn) {
            console.warn('⚠️ Некорректный маркер:', marker);
            return null;
          }
          
          // Определяем, ошибка это или предупреждение
          const isError = marker.severity === 8 || marker.severity === 1;
          
          // Создаем декорацию
          return {
            range: {
              startLineNumber: marker.startLineNumber,
              startColumn: marker.startColumn,
              endLineNumber: marker.endLineNumber,
              endColumn: marker.endColumn
            },
            options: {
              className: isError ? 'python-error-decoration' : 'python-warning-decoration',
              isWholeLine: false,
              glyphMarginClassName: isError ? 'error-glyph' : 'warning-glyph',
              hoverMessage: { value: marker.message },
              inlineClassName: isError ? 'python-error-decoration' : 'python-warning-decoration',
              stickiness: 1 // Сохраняем декорации при редактировании
            }
          };
        }).filter(Boolean); // Удаляем null значения
        
        if (decorations.length > 0) {
          console.log(`🎨 Добавление ${decorations.length} декораций для ${uri}`);
          
          // Применяем декорации к редактору
          const decorationIds = editor.deltaDecorations([], decorations);
          
          // Сохраняем ID декораций для последующего удаления
          editor._errorDecorationIds = decorationIds;
          
          // Дополнительно создаем подсветку строк с ошибками
          const lineDecorations = markers.map((marker: any) => {
            const isError = marker.severity === 8 || marker.severity === 1;
            return {
              range: {
                startLineNumber: marker.startLineNumber,
                startColumn: 1,
                endLineNumber: marker.startLineNumber,
                endColumn: model.getLineMaxColumn(marker.startLineNumber)
              },
              options: {
                isWholeLine: true,
                className: isError ? 'current-line-error' : 'current-line-warning',
                stickiness: 1
              }
            };
          });
          
          if (lineDecorations.length > 0) {
            const lineDecorationIds = editor.deltaDecorations([], lineDecorations);
            editor._errorLineDecorationIds = lineDecorationIds;
          }
        }
      }
      
      // Принудительно обновляем редактор
      setTimeout(() => {
        try {
          editor.layout();
          editor.render(true);
          console.log('🔄 Редактор принудительно обновлен');
        } catch (err) {
          console.error('❌ Ошибка при обновлении редактора:', err);
        }
      }, 100);
      
    } catch (err) {
      console.error('❌ Ошибка при работе с маркерами:', err);
    }
  } catch (err) {
    console.error('❌ Глобальная ошибка в setupErrorDecorations:', err);
  }
}

// Регистрируем функцию в глобальном объекте window
if (typeof window !== 'undefined') {
  (window as any).setupErrorDecorations = setupErrorDecorationsImpl;
}

// @ts-nocheck
window.setupErrorDecorations = function(editor) {
  if (!editor || !editor.getModel) return;
  
  const model = editor.getModel();
  if (!model) return;
  
  try {
    // Получаем маркеры для текущей модели
    const uri = model.uri;
    const markers = monaco.editor.getModelMarkers({ resource: uri });
    
    console.log(`Применяем ${markers.length} маркеров для ${uri.toString()}`);
    
    // Добавляем CSS стили для подсветки ошибок
    if (!document.getElementById('monaco-error-styles')) {
      const style = document.createElement('style');
      style.id = 'monaco-error-styles';
      style.innerHTML = `
        .monaco-editor .error-line { background-color: rgba(255, 0, 0, 0.2); }
        .monaco-editor .warning-line { background-color: rgba(255, 165, 0, 0.2); }
        .monaco-editor .error-text { border-bottom: 2px wavy red; }
        .monaco-editor .warning-text { border-bottom: 2px wavy orange; }
      `;
      document.head.appendChild(style);
    }
    
    // Очищаем предыдущие декорации
    if (editor._errorDecorations) {
      editor.deltaDecorations(editor._errorDecorations, []);
    }
    
    // Если нет маркеров, выходим
    if (!markers || markers.length === 0) {
      editor._errorDecorations = [];
      return;
    }
    
    // Создаем декорации для подсветки ошибок
    const decorations = markers.map(marker => {
      const isError = marker.severity === monaco.MarkerSeverity.Error;
      
      return [
        // Декорация для всей строки
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
            glyphMarginClassName: isError ? 'codicon-error' : 'codicon-warning',
            overviewRuler: {
              color: isError ? 'red' : 'orange',
              position: monaco.editor.OverviewRulerLane.Right
            },
            minimap: {
              color: isError ? 'red' : 'orange',
              position: monaco.editor.MinimapPosition.Inline
            },
            hoverMessage: { value: marker.message }
          }
        },
        // Декорация для конкретного места ошибки
        {
          range: new monaco.Range(
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn
          ),
          options: {
            className: isError ? 'error-text' : 'warning-text',
            hoverMessage: { value: marker.message }
          }
        }
      ];
    }).flat();
    
    // Применяем декорации
    editor._errorDecorations = editor.deltaDecorations([], decorations);
    
    // Принудительно обновляем редактор
    setTimeout(() => {
      editor.render();
      editor.layout();
    }, 100);
    
  } catch (error) {
    console.error('Ошибка при настройке декораций ошибок:', error);
  }
};

// Функция для принудительного обновления всех декораций во всех редакторах
window.forceUpdateAllDecorations = function() {
  try {
    const editors = monaco.editor.getEditors();
    console.log(`Принудительное обновление декораций для ${editors.length} редакторов`);
    
    editors.forEach(editor => {
      if (editor && editor.getModel() && typeof window.setupErrorDecorations === 'function') {
        window.setupErrorDecorations(editor);
      }
    });
  } catch (error) {
    console.error('Ошибка при обновлении всех декораций:', error);
  }
};