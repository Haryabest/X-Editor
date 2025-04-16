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
export async function updatePythonDiagnosticsForFile(filepath: string): Promise<boolean> {
  try {
    console.log('🐍 Python diagnostics requested for file:', filepath);
    console.log('Debug: Current Python LSP status:', getPythonLSPStatus());
    
    // Проверка и инициализация LSP, если необходимо
    if (!isPythonLSPConnected()) {
      console.warn(`Python LSP сервер не подключен, инициализация...`);
      const initialized = await initializePythonLSP();
      console.log('Debug: Python LSP initialization result:', initialized);
      if (!initialized) {
        console.error('Не удалось инициализировать Python LSP сервер');
        return false;
      }
    }
    
    console.log(`🐍 Обновление диагностики для: ${filepath}`);
    
    // Проверка, является ли файл Python-файлом
    const isPythonFile = filepath.endsWith('.py') || filepath.endsWith('.pyw') || 
                         filepath.endsWith('.pyi') || 
                         lspDocumentManager.getDocument(filepath)?.languageId === 'python';
    
    if (!isPythonFile) {
      console.warn(`Файл ${filepath} не является Python файлом`);
      return false;
    }
    
    // Получаем документ из менеджера LSP
    let doc = lspDocumentManager.getDocument(filepath);
    console.log('Debug: Found document in LSP manager:', !!doc);
    
    // Если документ не найден, пытаемся найти его по другому URI или создать
    if (!doc) {
      // Попытка найти документ по другому URI
      const allUris = lspDocumentManager.getAllDocumentUris();
      const matchingUri = allUris.find(uri => 
        uri.includes(filepath) || filepath.includes(uri.replace('file://', ''))
      );
      
      if (matchingUri) {
        doc = lspDocumentManager.getDocument(matchingUri);
        console.log(`Найден документ по URI: ${matchingUri}`);
      }
      
      // Если документ всё равно не найден, пытаемся создать его
      if (!doc) {
        try {
          console.log(`Документ не найден, создаем новый: ${filepath}`);
          
          // Получаем содержимое файла через API
          let content = '';
          try {
            const response = await fetch(`/api/file?path=${encodeURIComponent(filepath)}`);
            if (response.ok) {
              content = await response.text();
              console.log(`Получено содержимое файла (${content.length} байт)`);
            } else {
              console.error(`Ошибка при получении содержимого файла: ${response.statusText}`);
              return false;
            }
          } catch (err) {
            console.error(`Ошибка при запросе файла через API:`, err);
            
            // Пробуем получить модель напрямую через Monaco
            try {
              if (window.monaco) {
                const fileUri = window.monaco.Uri.file(filepath);
                const model = window.monaco.editor.getModel(fileUri);
                
                if (model) {
                  content = model.getValue();
                  console.log(`Получено содержимое из модели Monaco (${content.length} байт)`);
                } else {
                  console.warn(`Модель Monaco для ${filepath} не найдена`);
                }
              }
            } catch (monacoErr) {
              console.error(`Ошибка при доступе к модели Monaco:`, monacoErr);
            }
            
            if (!content) {
              return false;
            }
          }
          
          // Нормализуем путь файла для создания URI
          let fileUri = filepath;
          if (!fileUri.startsWith('file://')) {
            fileUri = `file://${fileUri.replace(/\\/g, '/')}`;
          }
          
          // Добавляем документ в менеджер
          lspDocumentManager.addDocument(fileUri, 'python', content);
          console.log(`Документ добавлен в LSP: ${fileUri}`);
          
          // Получаем созданный документ
          doc = lspDocumentManager.getDocument(fileUri);
          
          // Если документ не найден даже после создания, пытаемся получить его по оригинальному пути
          if (!doc) {
            doc = lspDocumentManager.getDocument(filepath);
          }
          
          if (!doc) {
            console.error(`Не удалось добавить документ: ${filepath}`);
            return false;
          }
        } catch (err) {
          console.error(`Ошибка при создании документа: ${filepath}`, err);
          return false;
        }
      }
    }
    
    // Проверяем наличие хранилища диагностики
    if (!(window as any).pythonDiagnosticsStore) {
      console.warn('Хранилище диагностики Python недоступно');
    }
    
    // Получаем содержимое документа для отправки на сервер
    let content = '';
    let version = doc.version || 1;
    
    try {
      // Пытаемся получить текст из документа
      if (doc.textDocument && typeof doc.textDocument.getText === 'function') {
        content = doc.textDocument.getText();
      } else if ((doc as any).content) {
        content = (doc as any).content;
      }
      
      // Если не удалось получить контент из документа, пробуем другие способы
      if (!content) {
        // Проверяем, есть ли модель Monaco для этого файла
        if (window.monaco) {
          try {
            const fileUri = window.monaco.Uri.file(filepath);
            const model = window.monaco.editor.getModel(fileUri);
            
            if (model) {
              content = model.getValue();
              console.log(`Получено содержимое из модели Monaco (${content.length} байт)`);
            }
          } catch (monacoErr) {
            console.warn(`Ошибка при доступе к модели Monaco:`, monacoErr);
          }
        }
        
        // Если всё еще нет содержимого, запрашиваем файл через API
        if (!content) {
          try {
            const response = await fetch(`/api/file?path=${encodeURIComponent(filepath)}`);
            if (response.ok) {
              content = await response.text();
              console.log(`Получено содержимое файла через API (${content.length} байт)`);
            } else {
              console.error(`Ошибка при получении содержимого через API: ${response.statusText}`);
            }
          } catch (apiErr) {
            console.error(`Ошибка при запросе файла через API:`, apiErr);
          }
        }
      }
    } catch (contentErr) {
      console.error(`Ошибка при получении содержимого документа:`, contentErr);
    }
    
    if (!content) {
      console.warn(`Пустое содержимое документа: ${filepath}`);
      return false;
    }
    
    // Обновляем содержимое документа в LSP и запрашиваем диагностику
    try {
      console.log(`🐍 Получение диагностики для файла ${doc.uri}...`);
      
      // Сначала уведомляем об открытии документа
      languageServerManager.sendNotification('python', 'textDocument/didOpen', {
        textDocument: {
          uri: doc.uri,
          languageId: 'python',
          version: version,
          text: content
        }
      });
      console.log(`🐍 Отправлено уведомление didOpen для: ${doc.uri}`);
      
      // Затем уведомляем об изменении
      languageServerManager.sendNotification('python', 'textDocument/didChange', {
        textDocument: {
          uri: doc.uri,
          version: version + 1
        },
        contentChanges: [{ text: content }]
      });
      console.log(`🐍 Отправлено уведомление didChange для: ${doc.uri}`);
      
      // Ждем немного, чтобы сервер обработал изменения и опубликовал диагностику
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Проверяем, есть ли диагностика в редакторе
      let diagnosticsFound = false;
      
      if (window.monaco) {
        try {
          const monacoUri = window.monaco.Uri.file(filepath);
          const markers = window.monaco.editor.getModelMarkers({ resource: monacoUri });
          
          if (markers && markers.length > 0) {
            console.log(`🐍 Найдено ${markers.length} маркеров для файла ${filepath}`);
            diagnosticsFound = true;
            
            // Уведомляем о обновлении маркеров
            document.dispatchEvent(new CustomEvent('markers-updated'));
          } else {
            console.log(`🐍 Маркеры не найдены для файла ${filepath}`);
          }
        } catch (err) {
          console.error(`Ошибка при получении маркеров: ${err}`);
        }
      }
      
      // Если диагностика не найдена, очищаем существующие маркеры
      if (!diagnosticsFound && (window as any).pythonDiagnosticsStore) {
        try {
          let monacoUri;
          try {
            monacoUri = window.monaco.Uri.parse(doc.uri);
          } catch (e) {
            monacoUri = window.monaco.Uri.file(filepath);
          }
          
          (window as any).pythonDiagnosticsStore.clearMarkers(monacoUri.toString());
          console.log(`🐍 Очищены маркеры для: ${filepath}`);
          
          // Уведомляем об обновлении маркеров
          document.dispatchEvent(new CustomEvent('markers-updated'));
        } catch (clearErr) {
          console.error(`Ошибка при очистке маркеров:`, clearErr);
        }
      }
      
      // Применяем декорации ошибок к активному редактору
      if (window.monaco && window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
        // Находим все редакторы и обновляем декорации
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          console.log(`🎨 Обновление декораций для ${editors.length} редакторов после диагностики`);
          editors.forEach((editor: any) => {
            try {
              if (window.setupErrorDecorations) {
                window.setupErrorDecorations(editor);
              }
            } catch (err) {
              console.warn('Ошибка при обновлении декораций:', err);
            }
          });
        } else {
          console.log('Нет активных редакторов для обновления декораций');
        }
      }
      
      return true;
    } catch (error) {
      console.error(`🐍 Ошибка при обновлении диагностики: ${filepath}`, error);
      return false;
    }
  } catch (error) {
    console.error(`🐍 Неожиданная ошибка при обновлении Python диагностики: ${filepath}`, error);
    return false;
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
      
      // Применяем декорации ошибок к активному редактору
      if (window.monaco && window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
        // Находим все редакторы и обновляем декорации
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          console.log(`🎨 Обновление декораций для ${editors.length} редакторов после диагностики`);
          editors.forEach((editor: any) => {
            try {
              if (window.setupErrorDecorations) {
                window.setupErrorDecorations(editor);
              }
            } catch (err) {
              console.warn('Ошибка при обновлении декораций:', err);
            }
          });
        } else {
          console.log('Нет активных редакторов для обновления декораций');
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
    const markers = pyDiags.map((diag) => {
      const startPos = diag.range.start;
      const endPos = diag.range.end;
      
      // Делаем сообщения более компактными
      let message = diag.message;
      
      // Обрезаем длинные сообщения
      if (message.length > 100) {
        message = message.substring(0, 97) + '...';
      }
      
      // Удаляем избыточную информацию
      message = message
        .replace(/Python \[\d+(\.\d+)*\]/g, '')
        .replace(/\(pycodestyle\)/g, '')
        .replace(/\(pylint\)/g, '')
        .replace(/\(mypy\)/g, '')
        .replace(/\(pyflakes\)/g, '')
        .replace(/(^\s+|\s+$)/g, ''); // Удаляем пробелы в начале и конце

      return {
        severity: mapSeverity(diag.severity),
        startLineNumber: startPos.line + 1,
        startColumn: startPos.character + 1,
        endLineNumber: endPos.line + 1,
        endColumn: endPos.character + 1,
        message: message,
        code: diag.code,
        source: 'Python', // Унифицируем источник
      };
    });

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
              if (!document.getElementById('python-error-styles')) {
                const style = document.createElement('style');
                style.id = 'python-error-styles';
                style.innerHTML = `
                  .python-error-decoration { 
                    background-color: rgba(255, 0, 0, 0.1) !important; 
                    border-bottom: 1px wavy red !important; 
                  }
                  .python-warning-decoration { 
                    background-color: rgba(255, 165, 0, 0.1) !important; 
                    border-bottom: 1px wavy orange !important; 
                  }
                  .python-error-inline { 
                    text-decoration: wavy underline red !important; 
                  }
                  .python-warning-inline { 
                    text-decoration: wavy underline orange !important; 
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
              
              // Принудительно обновляем отображение
              setTimeout(() => {
                editor.layout();
                editor.render(true);
              }, 100);
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
        severity: marker.severity,
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
      }));
      
      // Устанавливаем маркеры в хранилище
      window.pythonDiagnosticsStore.setMarkers(model.uri.toString(), storeMarkers);
      
      // Отправляем событие обновления UI
      try {
        document.dispatchEvent(new CustomEvent('markers-updated', { 
          detail: { uri: model.uri.toString(), markers } 
        }));
        
        const problemsEvent = new CustomEvent('python-diagnostics-updated', { 
          detail: { diagnostics: window.pythonDiagnosticsStore.getAllMarkersForUI() || [] } 
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