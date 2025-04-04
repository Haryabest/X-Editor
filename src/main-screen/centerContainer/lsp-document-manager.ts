/**
 * LSP Document Manager
 * 
 * Менеджер документов для языковых серверов LSP
 * Управляет синхронизацией документов между редактором и языковыми серверами
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocumentItem, VersionedTextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { languageServerManager } from './monaco-lsp-server-manager';

// Свойства документа для LSP
interface LSPDocumentInfo {
  uri: string;              // URI документа
  languageId: string;       // ID языка
  version: number;          // Версия документа
  textDocument: TextDocument; // Вспомогательный объект TextDocument
  isDirty: boolean;         // Флаг изменений документа
}

/**
 * Менеджер документов для LSP
 */
export class LSPDocumentManager {
  private documents: Map<string, LSPDocumentInfo> = new Map();
  private monaco: any;
  private editor: any = null;
  private disposables: any[] = [];
  
  /**
   * Конструктор
   */
  constructor(monaco?: any, editor?: any) {
    if (monaco) {
      this.monaco = monaco;
    }
    
    if (editor) {
      this.editor = editor;
      this.initialize(monaco, editor);
    }
  }
  
  /**
   * Инициализация менеджера документов
   */
  public initialize(
    monaco: any, 
    editor: any
  ): void {
    if (!monaco || !editor) {
      console.warn('Не удалось инициализировать LSP Document Manager: параметры не определены');
      return;
    }
    
    try {
      this.monaco = monaco;
      this.editor = editor;
      
      // Инициализируем менеджер языковых серверов, если он существует
      if (languageServerManager && typeof languageServerManager.initialize === 'function') {
        languageServerManager.initialize();
        console.log('Менеджер языковых серверов инициализирован');
      } else {
        console.warn('Менеджер языковых серверов не определен или не содержит метод initialize');
      }
      
      console.log('LSP Document Manager инициализирован');
      
      // Добавляем обработчики событий для моделей Monaco
      this.setupModelListeners();
    } catch (error) {
      console.error('Ошибка при инициализации LSP Document Manager:', error);
    }
  }
  
  /**
   * Установка обработчиков событий для моделей Monaco
   */
  private setupModelListeners(): void {
    if (!this.monaco || !this.editor) return;
    
    try {
      // Слушаем создание новых моделей
      const onDidCreateModel = this.monaco.editor.onDidCreateModel((model) => {
        if (model) {
          this.addDocument(model);
        }
      });
      
      // Слушаем удаление моделей
      const onWillDisposeModel = this.monaco.editor.onWillDisposeModel((model) => {
        if (model && model.uri) {
          this.removeDocument(model.uri.toString());
        }
      });
      
      // Добавляем существующие модели
      const models = this.monaco.editor.getModels();
      if (models && Array.isArray(models)) {
        models.forEach((model) => {
          if (model) {
            this.addDocument(model);
          }
        });
      }
      
      // Сохраняем disposables для последующей очистки
      this.disposables.push(onDidCreateModel);
      this.disposables.push(onWillDisposeModel);
    } catch (error) {
      console.error('Ошибка при настройке слушателей моделей:', error);
    }
  }
  
  /**
   * Добавление документа
   * @param modelOrUriOrParams Может быть моделью Monaco, строкой URI или объектом с параметрами {uri, languageId, content}
   * @param languageIdOrContent Если первый параметр - URI (строка), то это может быть ID языка или содержимое
   * @param content Если первые два параметра заданы, то это содержимое
   */
  public addDocument(modelOrUriOrParams: any, languageIdOrContent?: string, content?: string): void {
    if (!modelOrUriOrParams) {
      console.warn('Не удалось добавить документ: параметры не определены');
      return;
    }
    
    try {
      let uri: string = '';
      let languageId: string = 'plaintext';
      let documentContent: string = '';
      
      // Определяем тип первого параметра
      if (typeof modelOrUriOrParams === 'string') {
        // Первый параметр - строка URI
        uri = this.normalizeUri(modelOrUriOrParams);
        
        // Проверяем второй параметр
        if (typeof languageIdOrContent === 'string') {
          // Если это выглядит как контент (длинная строка или содержит переносы строк)
          if (languageIdOrContent.length > 50 || languageIdOrContent.includes('\n')) {
            documentContent = languageIdOrContent;
            // Определяем язык по расширению URI
            languageId = this.detectLanguageFromUri(uri);
          } else {
            // Иначе считаем это ID языка
            languageId = languageIdOrContent;
            documentContent = content || '';
          }
        }
      } else if (modelOrUriOrParams && typeof modelOrUriOrParams === 'object') {
        if (modelOrUriOrParams.uri) {
          // Это объект с параметрами {uri, languageId, content}
          if (typeof modelOrUriOrParams.uri === 'string') {
            uri = this.normalizeUri(modelOrUriOrParams.uri);
          } else if (modelOrUriOrParams.uri.toString) {
            uri = this.normalizeUri(modelOrUriOrParams.uri.toString());
          }
          
          languageId = modelOrUriOrParams.languageId || this.detectLanguageFromUri(uri);
          documentContent = modelOrUriOrParams.content || '';
        } else if (modelOrUriOrParams.getValue && modelOrUriOrParams.uri) {
          // Это модель Monaco
          const model = modelOrUriOrParams;
          uri = this.normalizeUri(model.uri.toString());
          
          try {
            // Получаем язык модели
            languageId = model.getLanguageId ? model.getLanguageId() : this.detectLanguageFromUri(uri);
            // Получаем содержимое модели
            documentContent = model.getValue ? model.getValue() : '';
          } catch (e) {
            console.warn('Не удалось получить данные из модели:', e);
            languageId = this.detectLanguageFromUri(uri);
          }
        }
      }
      
      // Проверяем, что URI определен
      if (!uri) {
        console.warn('Не удалось добавить документ: URI не определен');
        return;
      }
      
      // Если документ уже существует, не добавляем его снова
      if (this.documents.has(uri)) {
        return;
      }
      
      // Определяем правильный languageId для React файлов
      if (uri.endsWith('.jsx')) {
        languageId = 'javascriptreact';
      } else if (uri.endsWith('.tsx')) {
        languageId = 'typescriptreact';
      } else if (uri.endsWith('.js')) {
        languageId = 'javascript';
      } else if (uri.endsWith('.ts')) {
        languageId = 'typescript';
      } else if (uri.endsWith('.html') || uri.endsWith('.htm')) {
        languageId = 'html';
      } else if (uri.endsWith('.css')) {
        languageId = 'css';
      } else if (uri.endsWith('.json')) {
        languageId = 'json';
      }
      
      // Создаем TextDocument для LSP
      const textDocument = TextDocument.create(
        uri,
        languageId,
        1,
        documentContent
      );
      
      // Добавляем документ в коллекцию
      this.documents.set(uri, {
        uri,
        languageId,
        version: 1,
        textDocument,
        isDirty: false
      });
      
      console.log(`Добавлен документ: ${uri}, язык: ${languageId}`);
      
      // Если это модель Monaco, добавляем слушатели изменений
      if (modelOrUriOrParams && typeof modelOrUriOrParams === 'object' && 
          modelOrUriOrParams.onDidChangeContent) {
        try {
          const changeDisposable = modelOrUriOrParams.onDidChangeContent((e: any) => {
            this.updateDocument(uri, modelOrUriOrParams);
          });
          
          this.disposables.push(changeDisposable);
        } catch (error) {
          console.error(`Ошибка при добавлении слушателя изменений для ${uri}:`, error);
        }
      }
      
      // Уведомляем языковые серверы об открытии документа
      this.notifyDocumentOpen(uri);
    } catch (error) {
      console.error('Ошибка при добавлении документа:', error);
    }
  }
  
  /**
   * Определение языка по URI
   */
  private detectLanguageFromUri(uri: string): string {
    const lowerUri = uri.toLowerCase();
    
    // Проверяем расширения файлов
    if (lowerUri.endsWith('.js')) return 'javascript';
    if (lowerUri.endsWith('.jsx')) return 'javascriptreact';
    if (lowerUri.endsWith('.ts')) return 'typescript';
    if (lowerUri.endsWith('.tsx')) return 'typescriptreact';
    if (lowerUri.endsWith('.html') || lowerUri.endsWith('.htm')) return 'html';
    if (lowerUri.endsWith('.css')) return 'css';
    if (lowerUri.endsWith('.scss')) return 'scss';
    if (lowerUri.endsWith('.less')) return 'less';
    if (lowerUri.endsWith('.json')) return 'json';
    if (lowerUri.endsWith('.md')) return 'markdown';
    if (lowerUri.endsWith('.xml')) return 'xml';
    if (lowerUri.endsWith('.yaml') || lowerUri.endsWith('.yml')) return 'yaml';
    if (lowerUri.endsWith('.py') || lowerUri.endsWith('.pyw') || lowerUri.endsWith('.pyi')) return 'python';
    
    // Проверка коротких имен файлов
    const fileName = uri.substring(uri.lastIndexOf('/') + 1).toLowerCase();
    if (fileName === 'dockerfile') return 'dockerfile';
    if (fileName === '.gitignore') return 'plaintext';
    if (fileName === 'package.json' || fileName === 'tsconfig.json') return 'json';
    
    // По умолчанию - plaintext
    return 'plaintext';
  }
  
  /**
   * Удаление документа
   */
  public removeDocument(uri: string): void {
    if (!uri) {
      console.warn('Не удалось удалить документ: URI не определен');
      return;
    }
    
    try {
      // Уведомляем языковые серверы о закрытии документа
      this.notifyDocumentClose(uri);
      
      // Удаляем документ из коллекции
      this.documents.delete(uri);
      
      console.log(`Удален документ: ${uri}`);
    } catch (error) {
      console.error(`Ошибка при удалении документа ${uri}:`, error);
    }
  }
  
  /**
   * Обновление документа
   */
  private updateDocument(uri: string, model: any): void {
    if (!uri) {
      console.warn('Не удалось обновить документ: URI не определен');
      return;
    }
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo) return;
      
      // Увеличиваем версию документа
      documentInfo.version++;
      
      // Обновляем TextDocument
      try {
        // Пытаемся получить текст из модели разными способами
        let content = '';
        if (typeof model === 'string') {
          content = model;
        } else if (model && typeof model.getValue === 'function') {
          content = model.getValue();
        } else if (model && typeof model.content === 'string') {
          content = model.content;
        } else if (model && typeof model.text === 'string') {
          content = model.text;
        } else {
          console.warn(`Не удалось получить содержимое из модели для ${uri}, используем пустую строку`);
        }
        
        documentInfo.textDocument = TextDocument.update(
          documentInfo.textDocument,
          [{ text: content }],
          documentInfo.version
        );
      } catch (error) {
        console.error(`Ошибка при обновлении TextDocument для ${uri}:`, error);
        return; // Не продолжаем, если обновление не удалось
      }
      
      // Отмечаем документ как измененный
      documentInfo.isDirty = true;
      
      // Уведомляем языковые серверы об изменении документа
      this.notifyDocumentChange(uri);
    } catch (error) {
      console.error(`Ошибка при обновлении документа ${uri}:`, error);
    }
  }
  
  /**
   * Получение документа по URI
   */
  public getDocument(uri: string): LSPDocumentInfo | undefined {
    if (!uri) return undefined;
    
    return this.documents.get(uri);
  }
  
  /**
   * Получение списка URI всех зарегистрированных документов
   */
  public getAllDocumentUris(): string[] {
    try {
      return Array.from(this.documents.keys());
    } catch (error) {
      console.error('Ошибка при получении списка URI документов:', error);
      return [];
    }
  }
  
  /**
   * Преобразование URI Monaco в формат, понятный LSP
   */
  public normalizeUri(uri: string): string {
    if (!uri) return '';
    
    try {
      // Если это file URI, корректируем его
      if (uri.startsWith('file://')) {
        // В Windows заменяем '/' на '\\'
        if (navigator.platform.startsWith('Win')) {
          uri = uri.replace('file:///', 'file:///');
        }
      }
      return uri;
    } catch (error) {
      console.error(`Ошибка при нормализации URI ${uri}:`, error);
      return uri;
    }
  }
  
  /**
   * Получение содержимого документа по URI
   */
  public getDocumentContent(uri: string): string | null {
    try {
      const document = this.documents.get(uri);
      if (!document) {
        console.warn(`Документ с URI ${uri} не найден`);
        return null;
      }
      
      // Проверяем моделью Monaco
      const model = this.getModelForUri(uri);
      if (model) {
        try {
          if (typeof model.getValue === 'function') {
            return model.getValue();
          }
        } catch (e) {
          console.warn(`Не удалось получить содержимое из модели для ${uri}:`, e);
        }
      }
      
      // Если не удалось получить содержимое из модели, возвращаем сохраненный контент
      // или пустую строку, если контент не был сохранен
      return document.content || '';
    } catch (error) {
      console.error(`Ошибка при получении содержимого документа ${uri}:`, error);
      return null;
    }
  }
  
  /**
   * Получение модели Monaco по URI документа
   */
  private getModelForUri(uri: string): any | null {
    try {
      if (!window.monaco) return null;
      
      const models = window.monaco.editor.getModels();
      for (const model of models) {
        try {
          const modelUri = model.uri.toString();
          if (modelUri === uri || 
              modelUri.includes(uri) || 
              uri.includes(modelUri.replace('file://', ''))) {
            return model;
          }
        } catch (e) {
          // Пропускаем ошибки при проверке модели
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Ошибка при получении модели для URI ${uri}:`, error);
      return null;
    }
  }
  
  /**
   * Получение версии документа по URI
   */
  public getDocumentVersion(uri: string): number {
    if (!uri) return 0;
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo) return 0;
      
      return documentInfo.version;
    } catch (error) {
      console.error(`Ошибка при получении версии документа ${uri}:`, error);
      return 0;
    }
  }
  
  /**
   * Создание TextDocumentItem для LSP
   */
  public createTextDocumentItem(uri: string): TextDocumentItem | null {
    if (!uri) return null;
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo || !documentInfo.textDocument) return null;
      
      return {
        uri: this.normalizeUri(uri),
        languageId: documentInfo.languageId,
        version: documentInfo.version,
        text: documentInfo.textDocument.getText()
      };
    } catch (error) {
      console.error(`Ошибка при создании TextDocumentItem для ${uri}:`, error);
      return null;
    }
  }
  
  /**
   * Создание VersionedTextDocumentIdentifier для LSP
   */
  public createVersionedTextDocumentIdentifier(uri: string): VersionedTextDocumentIdentifier | null {
    if (!uri) return null;
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo) return null;
      
      return {
        uri: this.normalizeUri(uri),
        version: documentInfo.version
      };
    } catch (error) {
      console.error(`Ошибка при создании VersionedTextDocumentIdentifier для ${uri}:`, error);
      return null;
    }
  }
  
  /**
   * Уведомление о открытии документа
   */
  private notifyDocumentOpen(uri: string): void {
    if (!uri) return;
    
    try {
      const documentItem = this.createTextDocumentItem(uri);
      if (!documentItem) return;
      
      // Находим соответствующие языковые серверы для этого типа документа
      const servers = this.getLanguageServersForDocument(uri);
      
      // Проверяем, инициализирован ли languageServerManager и доступен ли метод sendNotification
      if (!languageServerManager || typeof languageServerManager.sendNotification !== 'function') {
        console.warn(`Невозможно отправить уведомление об открытии документа: languageServerManager не инициализирован или не содержит метод sendNotification`);
        return;
      }
      
      // Уведомляем каждый сервер
      servers.forEach(serverId => {
        try {
          languageServerManager.sendNotification(serverId, 'textDocument/didOpen', {
            textDocument: documentItem
          });
          console.log(`Отправлено уведомление об открытии ${uri} серверу ${serverId}`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления об открытии ${uri} серверу ${serverId}:`, error);
        }
      });
    } catch (error) {
      console.error(`Ошибка при уведомлении об открытии документа ${uri}:`, error);
    }
  }
  
  /**
   * Уведомление о изменении документа
   */
  private notifyDocumentChange(uri: string): void {
    if (!uri) return;
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo || !documentInfo.isDirty) return;
      
      const versionedId = this.createVersionedTextDocumentIdentifier(uri);
      if (!versionedId) return;
      
      const content = this.getDocumentContent(uri);
      if (content === null) return;
      
      // Находим соответствующие языковые серверы для этого типа документа
      const servers = this.getLanguageServersForDocument(uri);
      
      // Проверяем, инициализирован ли languageServerManager и доступен ли метод sendNotification
      if (!languageServerManager || typeof languageServerManager.sendNotification !== 'function') {
        console.warn(`Невозможно отправить уведомление об изменении документа: languageServerManager не инициализирован или не содержит метод sendNotification`);
        return;
      }
      
      // Уведомляем каждый сервер
      servers.forEach(serverId => {
        try {
          languageServerManager.sendNotification(serverId, 'textDocument/didChange', {
            textDocument: versionedId,
            contentChanges: [{ text: content }]
          });
          console.log(`Отправлено уведомление об изменении ${uri} серверу ${serverId}`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления об изменении ${uri} серверу ${serverId}:`, error);
        }
      });
      
      // Сбрасываем флаг изменений
      documentInfo.isDirty = false;
    } catch (error) {
      console.error(`Ошибка при уведомлении об изменении документа ${uri}:`, error);
    }
  }
  
  /**
   * Уведомление о закрытии документа
   */
  private notifyDocumentClose(uri: string): void {
    if (!uri) return;
    
    try {
      const documentItem = this.createTextDocumentItem(uri);
      if (!documentItem) return;
      
      // Находим соответствующие языковые серверы для этого типа документа
      const servers = this.getLanguageServersForDocument(uri);
      
      // Проверяем, инициализирован ли languageServerManager и доступен ли метод sendNotification
      if (!languageServerManager || typeof languageServerManager.sendNotification !== 'function') {
        console.warn(`Невозможно отправить уведомление о закрытии документа: languageServerManager не инициализирован или не содержит метод sendNotification`);
        return;
      }
      
      // Уведомляем каждый сервер
      servers.forEach(serverId => {
        try {
          languageServerManager.sendNotification(serverId, 'textDocument/didClose', {
            textDocument: {
              uri: documentItem.uri
            }
          });
          console.log(`Отправлено уведомление о закрытии ${uri} серверу ${serverId}`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления о закрытии ${uri} серверу ${serverId}:`, error);
        }
      });
    } catch (error) {
      console.error(`Ошибка при уведомлении о закрытии документа ${uri}:`, error);
    }
  }
  
  /**
   * Получение ID языковых серверов для документа
   */
  private getLanguageServersForDocument(uri: string): string[] {
    if (!uri) return [];
    
    try {
      // Получаем информацию о документе
      const documentInfo = this.documents.get(uri);
      if (!documentInfo) return [];
      
      // Проверяем, есть ли у нас серверы для этого языка
      const languageId = documentInfo.languageId;
      
      // Поддержка для React (.jsx, .tsx)
      if (uri.endsWith('.jsx') || uri.endsWith('.tsx')) {
        return ['typescript'];
      } else if (uri.endsWith('.js') || uri.endsWith('.ts')) {
        return ['typescript'];
      } else if (uri.endsWith('.html')) {
        return ['html'];
      } else if (uri.endsWith('.css')) {
        return ['css'];
      } else if (uri.endsWith('.json')) {
        return ['json'];
      } else if (uri.endsWith('.py') || uri.endsWith('.pyw') || uri.endsWith('.pyi')) {
        return ['python'];
      } else if (languageId === 'python') {
        return ['python'];
      }
      
      // По умолчанию возвращаем пустой массив
      return [];
    } catch (error) {
      console.error(`Ошибка при получении серверов для документа ${uri}:`, error);
      return [];
    }
  }
  
  /**
   * Очистка ресурсов
   */
  public dispose(): void {
    try {
      // Очищаем все disposables
      this.disposables.forEach(disposable => {
        try {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose();
          }
        } catch (error) {
          console.error('Ошибка при освобождении ресурса:', error);
        }
      });
      
      // Очищаем коллекцию и сбрасываем ссылки
      this.disposables = [];
      this.documents.clear();
      this.monaco = null;
      this.editor = null;
      
      console.log('LSP Document Manager освобожден');
    } catch (error) {
      console.error('Ошибка при освобождении ресурсов:', error);
    }
  }
}

// Экспортируем singleton экземпляр менеджера документов
export const lspDocumentManager = new LSPDocumentManager();