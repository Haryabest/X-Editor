/**
 * Python LSP Starter
 * 
 * Модуль для запуска и управления Python LSP сервером
 */

import { languageServerManager } from './monaco-lsp-server-manager';
import { lspDocumentManager } from './lsp-document-manager';
import { MonacoLSPDiagnostics } from './monaco-lsp-diagnostics';

// Глобальные переменные для отслеживания состояния
let pythonLSPInitialized = false;

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
      languageServerManager.registerServer({
        id: 'python',
        name: 'Python Language Server',
        supportedLanguages: ['python']
      });
      console.log('Python LSP сервер зарегистрирован');
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
    console.log('Запуск обновления диагностики для всех Python файлов...');
    
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
    
    console.log(`Обработка ${pythonDocuments.length} Python файлов...`);
    
    // Запрашиваем диагностику для каждого Python документа
    for (const uri of pythonDocuments) {
      try {
        await updatePythonDiagnosticsForFile(uri);
      } catch (error) {
        console.error(`Ошибка при обновлении диагностики для ${uri}:`, error);
      }
    }
    
    console.log(`Диагностика запрошена для ${pythonDocuments.length} Python файлов`);
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
    // Проверка и инициализация LSP, если необходимо
    if (!isPythonLSPConnected()) {
      console.warn(`Python LSP сервер не подключен, инициализация...`);
      const initialized = await initializePythonLSP();
      if (!initialized) {
        console.error('Не удалось инициализировать Python LSP сервер');
        return false;
      }
    }
    
    console.log(`Обновление диагностики для: ${filepath}`);
    
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
    
    // Обновляем содержимое документа в LSP
    try {
      // Обновляем документ в LSP Document Manager через открытые методы
      // Поскольку updateDocument - приватный метод, воспользуемся стандартным путем:
      // сначала удалим документ, затем создадим с новым содержимым
      lspDocumentManager.removeDocument(doc.uri);
      lspDocumentManager.addDocument(doc.uri, 'python', content);
      console.log(`Документ обновлен в LSP Manager: ${doc.uri}`);
    } catch (updateErr) {
      console.warn(`Не удалось обновить документ в LSP Manager: ${updateErr}`);
    }
    
    // Отправляем запросы на сервер
    try {
      // Сначала уведомляем об открытии, если документ новый
      languageServerManager.sendNotification('python', 'textDocument/didOpen', {
        textDocument: {
          uri: doc.uri,
          languageId: 'python',
          version: version,
          text: content
        }
      });
      console.log(`Отправлено уведомление didOpen для: ${doc.uri}`);
      
      // Затем уведомляем об изменении
      languageServerManager.sendNotification('python', 'textDocument/didChange', {
        textDocument: {
          uri: doc.uri,
          version: version + 1
        },
        contentChanges: [{ text: content }]
      });
      console.log(`Отправлено уведомление didChange для: ${doc.uri}`);
      
      // Запрашиваем диагностику
      console.log(`Запрос диагностики для: ${doc.uri}`);
      const diagRequest = await languageServerManager.sendRequest('python', 'textDocument/diagnostic', {
        textDocument: { uri: doc.uri }
      });
      
      console.log(`Получен ответ диагностики:`, diagRequest);
      
      // Если есть ответ с диагностикой, обновляем маркеры в Monaco
      if (diagRequest && diagRequest.diagnostics) {
        const diagnostics = diagRequest.diagnostics;
        
        // Проверяем наличие хранилища диагностики
        if ((window as any).pythonDiagnosticsStore) {
          // Создаем Monaco URI для документа
          let monacoUri;
          try {
            monacoUri = window.monaco.Uri.parse(doc.uri);
          } catch (uriErr) {
            // Если произошла ошибка при разборе URI, пробуем создать файловый URI
            try {
              monacoUri = window.monaco.Uri.file(filepath);
            } catch (fileUriErr) {
              console.error(`Не удалось создать URI для: ${filepath}`, fileUriErr);
              return false;
            }
          }
          
          // Преобразуем диагностику LSP в маркеры Monaco
          try {
            const markers = diagnostics.map((diag: any) => ({
              severity: convertSeverity(diag.severity || 1),
              message: diag.message || 'Неизвестная ошибка',
              startLineNumber: ((diag.range?.start?.line || 0) + 1),
              startColumn: ((diag.range?.start?.character || 0) + 1),
              endLineNumber: ((diag.range?.end?.line || 0) + 1),
              endColumn: ((diag.range?.end?.character || 0) + 1),
              source: diag.source || 'python-lsp',
              code: diag.code
            }));
            
            // Устанавливаем маркеры в хранилище
            (window as any).pythonDiagnosticsStore.setMarkers(monacoUri.toString(), markers);
            console.log(`Обновлено ${markers.length} маркеров для: ${filepath}`);
          } catch (markersErr) {
            console.error(`Ошибка при преобразовании диагностики в маркеры:`, markersErr);
          }
        } else {
          console.warn('Не удалось обновить диагностику: хранилище диагностики Python недоступно');
        }
      } else {
        // Если диагностик нет, очищаем маркеры
        if ((window as any).pythonDiagnosticsStore) {
          try {
            let monacoUri;
            try {
              monacoUri = window.monaco.Uri.parse(doc.uri);
            } catch (e) {
              monacoUri = window.monaco.Uri.file(filepath);
            }
            (window as any).pythonDiagnosticsStore.clearMarkers(monacoUri.toString());
            console.log(`Очищены маркеры для: ${filepath}`);
          } catch (clearErr) {
            console.error(`Ошибка при очистке маркеров:`, clearErr);
          }
        }
      }
      
      // Дополнительно запрашиваем обновление редактора
      try {
        if (window.monaco) {
          const models = window.monaco.editor.getModels();
          for (const model of models) {
            if (model.uri.toString().includes(filepath) || filepath.includes(model.uri.path)) {
              // Уведомляем о необходимости перерисовки
              const viewStates = window.monaco.editor.getViewStates(model);
              if (viewStates) {
                window.monaco.editor.setViewStates(model, viewStates);
              }
              console.log(`Обновлен вид модели для: ${filepath}`);
              break;
            }
          }
        }
      } catch (updateErr) {
        console.warn(`Ошибка при обновлении редактора:`, updateErr);
      }
      
      return true;
    } catch (error) {
      console.error(`Ошибка при запросе диагностики: ${filepath}`, error);
      return false;
    }
  } catch (error) {
    console.error(`Неожиданная ошибка при обновлении Python диагностики: ${filepath}`, error);
    return false;
  }
}

/**
 * Принудительное обновление диагностики для Python файла с повторной инициализацией
 * @param filepath Путь к Python файлу
 * @returns Promise с результатом операции
 */
export async function forcePythonDiagnosticsUpdate(filepath: string): Promise<boolean> {
  try {
    console.log(`Принудительное обновление диагностики для: ${filepath}`);
    
    // Проверяем наличие хранилища диагностики
    if (!(window as any).pythonDiagnosticsStore) {
      console.warn('Хранилище диагностики Python не инициализировано');
      // Пробуем загрузить module register-python, если он еще не был загружен
      try {
        const registerPythonModule = await import('../../monaco-config/register-python');
        if (typeof registerPythonModule.registerPython === 'function') {
          const result = registerPythonModule.registerPython();
          console.log(`Регистрация Python для диагностики: ${result ? 'успешно' : 'неудачно'}`);
        }
      } catch (importError) {
        console.error('Не удалось импортировать модуль register-python:', importError);
      }
    }
    
    // Проверяем наличие LSP и инициализируем при необходимости
    const lspConnected = isPythonLSPConnected();
    if (!lspConnected) {
      console.warn('Python LSP не подключен, пробуем инициализировать...');
      const initialized = await initializePythonLSP();
      if (!initialized) {
        console.error('Не удалось инициализировать Python LSP');
        return false;
      }
      console.log('Python LSP сервер успешно инициализирован');
    }
    
    // Проверяем доступность Monaco и модели для этого файла
    if (window.monaco) {
      try {
        // Проверяем, существует ли модель для этого файла
        const fileUri = window.monaco.Uri.file(filepath);
        let model = window.monaco.editor.getModel(fileUri);
        
        // Если модель не существует, пробуем найти модель с похожим путем
        if (!model) {
          const models = window.monaco.editor.getModels();
          for (const m of models) {
            try {
              if (m.uri.toString().includes(filepath) || 
                  filepath.includes(m.uri.path.replace(/^\//,'')) || 
                  filepath.includes(m.uri.toString().replace('file:///',''))) {
                model = m;
                break;
              }
            } catch (e) {
              // Игнорируем ошибки при проверке моделей
            }
          }
        }
        
        // Если нашли модель, проверяем её язык
        if (model && model.getLanguageId() !== 'python') {
          console.log(`Установка языка Python для модели ${filepath}`);
          window.monaco.editor.setModelLanguage(model, 'python');
        }
      } catch (monacoErr) {
        console.warn('Ошибка при проверке моделей Monaco:', monacoErr);
      }
    }
    
    // Обновляем диагностику документа
    return await updatePythonDiagnosticsForFile(filepath);
  } catch (error) {
    console.error('Ошибка при принудительном обновлении диагностики:', error);
    return false;
  }
}

/**
 * Преобразование уровня важности LSP в уровень Monaco
 * @param lspSeverity Уровень важности из LSP (1-4)
 * @returns Уровень важности для Monaco
 */
function convertSeverity(lspSeverity: number): number {
  if (!window.monaco) return 8; // Значение по умолчанию
  
  // 1 = Error, 2 = Warning, 3 = Information, 4 = Hint
  switch (lspSeverity) {
    case 1: return window.monaco.MarkerSeverity.Error;
    case 2: return window.monaco.MarkerSeverity.Warning;
    case 3: return window.monaco.MarkerSeverity.Info;
    case 4: return window.monaco.MarkerSeverity.Hint;
    default: return window.monaco.MarkerSeverity.Info;
  }
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