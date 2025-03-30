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
   */
  public addDocument(model: any): void {
    if (!model || !model.uri) {
      console.warn('Не удалось добавить документ: модель или URI не определены');
      return;
    }
    
    try {
      const uri = model.uri.toString();
      
      // Если документ уже существует, не добавляем его снова
      if (this.documents.has(uri)) {
        return;
      }
      
      // Получаем язык модели
      let languageId = model.getLanguageId();
      
      // Определяем правильный languageId для React файлов
      if (uri.endsWith('.jsx') || uri.endsWith('.tsx')) {
        if (uri.endsWith('.jsx')) {
          languageId = 'javascriptreact';
        } else if (uri.endsWith('.tsx')) {
          languageId = 'typescriptreact';
        }
      }
      
      // Создаем TextDocument для LSP
      const textDocument = TextDocument.create(
        uri,
        languageId,
        1,
        model.getValue() || ''
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
      
      // Добавляем обработчики для изменений в модели
      try {
        const changeDisposable = model.onDidChangeContent((e) => {
          this.updateDocument(uri, model);
        });
        
        this.disposables.push(changeDisposable);
      } catch (error) {
        console.error(`Ошибка при добавлении слушателя изменений для ${uri}:`, error);
      }
      
      // Уведомляем языковые серверы об открытии документа
      this.notifyDocumentOpen(uri);
    } catch (error) {
      console.error('Ошибка при добавлении документа:', error);
    }
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
    if (!uri || !model) {
      console.warn('Не удалось обновить документ: параметры не определены');
      return;
    }
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo) return;
      
      // Увеличиваем версию документа
      documentInfo.version++;
      
      // Обновляем TextDocument
      try {
        const content = model.getValue() || '';
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
   * Получение всех URI документов
   */
  public getAllDocumentUris(): string[] {
    try {
      return Array.from(this.documents.keys());
    } catch (error) {
      console.error('Ошибка при получении URI всех документов:', error);
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
    if (!uri) return null;
    
    try {
      const documentInfo = this.documents.get(uri);
      if (!documentInfo || !documentInfo.textDocument) return null;
      
      return documentInfo.textDocument.getText();
    } catch (error) {
      console.error(`Ошибка при получении содержимого документа ${uri}:`, error);
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