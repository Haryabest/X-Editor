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
    
    // Если документ не найден, попробуем найти его по совпадающему URI
    if (!doc) {
      const allUris = lspDocumentManager.getAllDocumentUris();
      const matchingUri = allUris.find(uri => 
        uri.includes(filepath) || filepath.includes(uri.replace('file://', ''))
      );
      
      if (matchingUri) {
        doc = lspDocumentManager.getDocument(matchingUri);
        console.log(`Найден документ по URI: ${matchingUri}`);
      }
    }
    
    // Если документ всё еще не найден, выходим
    if (!doc) {
      console.warn(`Документ для ${filepath} не найден, диагностика невозможна`);
      return false;
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
      
      // Если не удалось получить контент из документа, попробуем получить из модели
      if (!content && window.monaco) {
        try {
          const fileUri = window.monaco.Uri.file(filepath);
          const model = window.monaco.editor.getModel(fileUri);
          
          if (model) {
            content = model.getValue();
            console.log(`Получено содержимое из модели Monaco (${content.length} байт)`);
          }
        } catch (monacoErr) {
          console.warn(`Не удалось получить содержимое из модели Monaco`, monacoErr);
        }
      }
    } catch (contentErr) {
      console.error(`Ошибка при получении содержимого документа:`, contentErr);
    }
    
    if (!content) {
      console.warn(`Пустое содержимое документа: ${filepath}`);
      return false;
    }
    
    // Отправляем запросы на сервер
    try {
      // Отправляем минимально необходимые уведомления
      languageServerManager.sendNotification('python', 'textDocument/didChange', {
        textDocument: {
          uri: doc.uri,
          version: version + 1
        },
        contentChanges: [{ text: content }]
      });
      
      // Запрашиваем диагностику с таймаутом
      const diagRequest = await Promise.race([
        languageServerManager.sendRequest('python', 'textDocument/diagnostic', {
          textDocument: { uri: doc.uri }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);
      
      console.log(`Получен ответ диагностики`);
      
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
            // При ошибке пробуем создать файловый URI
            monacoUri = window.monaco.Uri.file(filepath);
          }
          
          // Преобразуем диагностику LSP в маркеры Monaco
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
          
          return true;
        } else {
          console.warn('Не удалось обновить диагностику: хранилище диагностики Python недоступно');
        }
      } else {
        // Если диагностик нет, очищаем маркеры
        if ((window as any).pythonDiagnosticsStore) {
          try {
            let monacoUri = window.monaco.Uri.file(filepath);
            (window as any).pythonDiagnosticsStore.clearMarkers(monacoUri.toString());
            console.log(`Очищены маркеры для: ${filepath}`);
          } catch (clearErr) {
            console.error(`Ошибка при очистке маркеров:`, clearErr);
          }
        }
        
        return true;
      }
    } catch (error: any) {
      if (error.message === 'Timeout') {
        console.warn(`Таймаут при запросе диагностики для: ${filepath}`);
      } else {
        console.error(`Ошибка при запросе диагностики: ${filepath}`, error);
      }
      return false;
    }
    
    return false;
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
    
    // Быстрая проверка на существование файла и тип файла
    if (!filepath.endsWith('.py') && !filepath.endsWith('.pyw') && !filepath.endsWith('.pyi')) {
      console.warn(`Файл ${filepath} не является Python файлом, пропускаем диагностику`);
      return false;
    }
    
    // Проверяем доступность LSP и инициализируем при необходимости
    if (!isPythonLSPConnected()) {
      console.log('Python LSP не подключен, инициализация...');
      
      // Пытаемся инициализировать сервер с ограничением по времени
      const initPromise = initializePythonLSP();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 2000);
      });
      
      const initialized = await Promise.race([initPromise, timeoutPromise]);
      
      if (!initialized) {
        console.error('Не удалось инициализировать Python LSP (таймаут)');
        return false;
      }
    }
    
    // Проверяем наличие модели для файла в Monaco
    if (window.monaco) {
      try {
        const fileUri = window.monaco.Uri.file(filepath);
        let model = window.monaco.editor.getModel(fileUri);
        
        // Если модель существует, устанавливаем для нее язык Python
        if (model && model.getLanguageId() !== 'python') {
          window.monaco.editor.setModelLanguage(model, 'python');
          console.log(`Установлен язык Python для модели ${filepath}`);
        }
      } catch (e) {
        // Игнорируем ошибки при работе с моделью
      }
    }
    
    // Запускаем обновление диагностики с таймаутом
    try {
      const updatePromise = updatePythonDiagnosticsForFile(filepath);
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.warn(`Таймаут обновления диагностики для ${filepath}`);
          resolve(false);
        }, 3000);
      });
      
      return await Promise.race([updatePromise, timeoutPromise]);
    } catch (error) {
      console.error('Ошибка при обновлении диагностики:', error);
      return false;
    }
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