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
    registerPythonForModel?: (model: monaco.editor.ITextModel) => void;
    forceUpdateAllDecorations?: () => number;
    setupErrorDecorations?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
    setupAllErrorDecorations?: () => number;
    monaco: any;
    pythonDiagnosticsStore?: any;
    pylance?: any;
    globalMarkersStore?: Map<string, monaco.editor.IMarker[]>;
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
        // Проверяем, что модель существует и имеет URI
        if (!model || !model.uri) {
          console.warn('Невозможно зарегистрировать Python для недействительной модели');
          return;
        }

        // Проверяем, является ли файл Python файлом
        const uri = model.uri.toString();
        const isPythonFile = uri.endsWith('.py') || uri.endsWith('.pyi') || model.getLanguageId() === 'python';
        if (!isPythonFile) {
          return;
        }
        
        console.log(`Регистрация Python-поддержки для модели: ${uri}`);
        
        // Устанавливаем базовую Python-поддержку и диагностику для файла
        setTimeout(() => {
          try {
            // Выполняем базовую проверку синтаксиса Python и устанавливаем маркеры
            const content = model.getValue();
            if (!content) {
              console.log('Пропуск пустого файла');
              return;
            }
            
            // Выполняем расширенную проверку ошибок
            runExtendedErrorChecks(model);
            
            // Пытаемся обновить Python диагностику
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
      } catch (error) {
        console.error('Ошибка при регистрации Python для модели:', error);
      }
    };
    
    // Функция для выполнения расширенной проверки ошибок
    function runExtendedErrorChecks(model: monaco.editor.ITextModel) {
      try {
        if (!model || !model.uri) return;
        
        const uri = model.uri.toString();
        console.log(`🔍 Запуск расширенной проверки ошибок для ${uri}`);
        
        const content = model.getValue();
        if (!content) return;
        
        const lines = content.split('\n');
        let markers: monaco.editor.IMarker[] = [];
        
        // Проверка на деление на ноль
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Пропускаем комментарии
          if (line.startsWith('#')) continue;
          
          // Проверка деления на ноль (прямое деление на 0)
          const divisionByZeroMatch = line.match(/\b(\w+\s*(?:\[\s*\w+\s*\])?\s*)?\/\s*(0|0\.0*)\b/);
          if (divisionByZeroMatch) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: '⚠️ Ошибка: деление на ноль',
              startLineNumber: i + 1,
              startColumn: line.indexOf(divisionByZeroMatch[0]) + 1,
              endLineNumber: i + 1,
              endColumn: line.indexOf(divisionByZeroMatch[0]) + divisionByZeroMatch[0].length + 1,
              source: 'Python Validator'
            });
          }
          
          // Проверка деления на переменную, которая может быть равна нулю
          const variableDivisionMatch = line.match(/(\b\w+\s*)\/\s*(\b\w+\b)/);
          if (variableDivisionMatch) {
            const divisor = variableDivisionMatch[2].trim();
            // Проверяем, есть ли проверка на ноль перед делением
            let hasDivisorCheck = false;
            
            // Ищем в предыдущих 5 строках проверку на ноль
            for (let j = Math.max(0, i - 5); j < i; j++) {
              const prevLine = lines[j].trim();
              if (prevLine.includes(`if ${divisor} != 0`) || 
                  prevLine.includes(`if ${divisor} > 0`) || 
                  prevLine.includes(`if ${divisor} < 0`) ||
                  prevLine.includes(`if not ${divisor} == 0`)) {
                hasDivisorCheck = true;
                break;
              }
            }
            
            if (!hasDivisorCheck) {
              markers.push({
                severity: monaco.MarkerSeverity.Warning,
                message: `⚠️ Предупреждение: деление на переменную "${divisor}" без проверки на ноль`,
                startLineNumber: i + 1,
                startColumn: line.indexOf(variableDivisionMatch[0]) + 1,
                endLineNumber: i + 1,
                endColumn: line.indexOf(variableDivisionMatch[0]) + variableDivisionMatch[0].length + 1,
                source: 'Python Validator'
              });
            }
          }
          
          // Проверка на использование неопределенных переменных
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
                severity: monaco.MarkerSeverity.Error,
                message: `❌ Ошибка: использование неопределенной переменной "${varName}"`,
                startLineNumber: i + 1,
                startColumn: line.indexOf(varName) + 1,
                endLineNumber: i + 1,
                endColumn: line.indexOf(varName) + varName.length + 1,
                source: 'Python Validator'
              });
            }
          }
          
          // Проверка синтаксиса с двоеточием
          if (line.match(/^\s*(if|for|while|def|class|with|try|except|finally)\s+[^:]*$/)) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: '❌ Синтаксическая ошибка: отсутствует двоеточие',
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              source: 'Python Validator'
            });
          }
        }
        
        // Добавляем маркеры к модели
        if (markers.length > 0) {
          // Получаем существующие маркеры
          const existingMarkers = window.monaco.editor.getModelMarkers({ resource: model.uri });
          
          // Объединяем существующие маркеры с новыми
          const uniqueMarkers = [...existingMarkers];
          
          // Добавляем только новые маркеры, избегая дубликатов
          markers.forEach(newMarker => {
            const isDuplicate = uniqueMarkers.some(existing => 
              existing.startLineNumber === newMarker.startLineNumber && 
              existing.message === newMarker.message
            );
            
            if (!isDuplicate) {
              uniqueMarkers.push(newMarker);
            }
          });
          
          // Устанавливаем маркеры
          window.monaco.editor.setModelMarkers(model, 'python-extended', uniqueMarkers);
          console.log(`✅ Добавлено ${markers.length} дополнительных маркеров для ${uri}`);
        }
        
        // Принудительно обновляем декорации для этой модели
        if (window.forceUpdateAllDecorations && typeof window.forceUpdateAllDecorations === 'function') {
          window.forceUpdateAllDecorations();
        }
        
      } catch (error) {
        console.error('Ошибка при выполнении расширенных проверок:', error);
      }
    }
    
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
      
      // Настраиваем опции редактора для компактных строк
      editor.updateOptions({ 
        glyphMargin: true,
        lineHeight: 18, // Компактная высота строки
        lineDecorationsWidth: 12, // Уменьшенная ширина декораций
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        fontLigatures: false, // Отключаем лигатуры для контроля высоты
        fixedOverflowWidgets: true // Фиксируем виджеты переполнения
      });
      
      // Устанавливаем новый таймер с задержкой в 100мс для быстрого обновления
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
          
          // Создаем компактные декорации для сообщений об ошибках
          const decorations = createDecorations(Array.from(uniqueMarkers.values()), model, filename);
          
          // Применяем декорации
          editor._errorDecorations = editor.deltaDecorations([], decorations);
          
          // Обновляем редактор после небольшой задержки для применения стилей
          setTimeout(() => {
            try {
              editor.layout();
              editor.render(true);
            } catch (err) {
              console.warn('Ошибка при принудительном обновлении редактора:', err);
            }
          }, 50);
        } catch (error) {
          console.error('Ошибка при настройке декораций ошибок:', error);
        }
      }, 100); // 100ms задержка для дебаунсинга
      
      // Сохраняем ID таймера
      decorationTimers.set(modelUri, timerId);
    };
    
    /**
     * Создает массив декораций на основе маркеров
     */
    function createDecorations(
      markers: monaco.editor.IMarker[], 
      model: monaco.editor.ITextModel, 
      filename: string
    ): monaco.editor.IModelDeltaDecoration[] {
      return markers.map(marker => {
        const isError = marker.severity === monaco.MarkerSeverity.Error;
        
        // Используем новое компактное форматирование сообщений
        const formattedMessage = formatCompactErrorMessage(marker.message, filename, isError);
        
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
    }
    
    // Обновляем функцию для принудительного обновления всех декораций
    window.forceUpdateAllDecorations = function() {
      try {
        // Получаем все редакторы
        const editors = window.monaco.editor.getEditors();
        console.log(`🔄 Принудительное обновление декораций для ${editors.length} редакторов`);
        
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
              
              try {
                // Проверяем, является ли это Python файлом
                const isPython = uri.endsWith('.py') || uri.endsWith('.pyi') || model.getLanguageId() === 'python';
                if (!isPython) return;
                
                // Устанавливаем опции редактора для оптимального отображения ошибок
                editor.updateOptions({ 
                  glyphMargin: true,
                  lineHeight: 18, // Компактная высота строки
                  lineDecorationsWidth: 12,
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'all',
                  fontLigatures: false,
                  fixedOverflowWidgets: true
                });
                
                // Запрашиваем маркеры для модели
                const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                console.log(`🔍 Найдено ${markers.length} маркеров для ${uri}`);
                
                // Форматируем маркеры для более информативного отображения
                markers.forEach(marker => {
                  // Добавляем дополнительную информацию для лучшего отображения
                  if (!marker.shortMessage && marker.message) {
                    marker.shortMessage = marker.message.length > 50 
                      ? marker.message.substring(0, 47) + '...' 
                      : marker.message;
                  }
                  
                  // Улучшаем формат сообщений для типичных ошибок
                  if (marker.message.includes('division by zero') || 
                      marker.message.includes('деление на ноль')) {
                    marker.message = '⚠️ Ошибка: Деление на ноль';
                    marker.shortMessage = 'Деление на ноль';
                  } else if (marker.message.includes('undefined') || 
                             marker.message.includes('not defined')) {
                    marker.message = '❌ Ошибка: Неопределённая переменная';
                    marker.shortMessage = 'Неопределённая переменная';
                  } else if (marker.message.includes('syntax') || 
                             marker.message.includes('синтаксис')) {
                    marker.message = '⚠️ Синтаксическая ошибка: ' + marker.message;
                  }
                });
                
                // Отмечаем URI как обработанный
                processedUris.add(uri);
                
                // Обновляем декорации через улучшенный обработчик
                if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
                  window.setupErrorDecorations(editor);
                }
              } catch (e) {
                console.error(`Ошибка при обработке модели ${uri}:`, e);
              }
            }
          });
          
          // Уведомляем об обновлении маркеров
          if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('markers-updated'));
          }
          
          // Обновляем панель проблем с более полной информацией
          if (window.pythonDiagnosticsStore) {
            try {
              // Форсируем обновление хранилища диагностики
              const allModels = window.monaco.editor.getModels();
              
              // Обновляем диагностику для каждой модели Python, если ещё не обработана
              allModels.forEach(model => {
                const uri = model.uri.toString();
                if (!processedUris.has(uri) && (uri.endsWith('.py') || uri.endsWith('.pyi'))) {
                  const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                  if (markers && markers.length > 0 && window.pythonDiagnosticsStore) {
                    // Преобразуем маркеры в формат для хранилища диагностики
                    const storeMarkers = markers.map((marker: any) => ({
                      severity: marker.severity === 8 ? 'error' : marker.severity === 4 ? 'warning' : 'info',
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
                      code: marker.code
                    }));
                    
                    // Устанавливаем маркеры в хранилище
                    window.pythonDiagnosticsStore.setMarkers(uri, storeMarkers);
                    processedUris.add(uri);
                  }
                }
              });
              
              // Получаем полный список диагностик для UI
              const diagnostics = window.pythonDiagnosticsStore.getAllMarkersForUI() || [];
              
              // Отправляем событие с обновленными диагностиками
              if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('python-diagnostics-updated', { 
                  detail: { diagnostics } 
                }));
              }
              
              console.log(`📊 Отправлены обновленные диагностики: ${diagnostics.length} файлов`);
            } catch (err) {
              console.error('Ошибка при обновлении панели проблем:', err);
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
     * Форматирует сообщение об ошибке для более компактного отображения
     * Удаляет лишнюю информацию и делает сообщение более читаемым
     */
    function formatCompactErrorMessage(message: string, filename: string, isError: boolean): string {
      if (!message) return '';
      
      // Очищаем сообщение от лишних деталей
      let cleanMessage = message
        .replace(/Python \[\d+(\.\d+)*\]/g, '')
        .replace(/\(pycodestyle\)/g, '')
        .replace(/\(pylint\)/g, '')
        .replace(/\(mypy\)/g, '')
        .replace(/\(pyflakes\)/g, '')
        .replace(/(^\s+|\s+$)/g, ''); // Удаляем пробелы в начале и конце
      
      // Определяем, является ли это синтаксической ошибкой
      const isSyntaxError = 
        message.includes('SyntaxError') || 
        message.includes('синтаксическая ошибка') ||
        message.includes('недопустимый синтаксис') ||
        message.includes('invalid syntax') ||
        message.includes('expected') ||
        message.includes('ожидалось');
      
      // Добавляем эмодзи для визуального различения типов ошибок
      const icon = isError 
        ? (isSyntaxError ? '⚠️ ' : '❌ ')
        : '⚠️ ';
      
      // Если сообщение слишком длинное, обрезаем его
      const maxLength = 80;
      if (cleanMessage.length > maxLength) {
        cleanMessage = cleanMessage.substring(0, maxLength - 3) + '...';
      }
      
      // Добавляем имя файла и тип ошибки
      const prefix = isError ? 'Ошибка' : 'Предупреждение';
      
      // Если имя файла доступно, добавляем его
      if (filename) {
        return `${icon}${prefix} в ${filename}: ${cleanMessage}`;
      }
      
      return `${icon}${prefix}: ${cleanMessage}`;
    }
  } catch (error) {
    console.error('Ошибка при настройке обработчиков Python диагностики:', error);
  }
};