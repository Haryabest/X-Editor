/**
 * Monaco LSP Integration
 * 
 * Главный модуль интеграции для Language Server Protocol в Monaco Editor
 * Объединяет все компоненты LSP для обеспечения полной функциональности
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { createPathIntellisense } from './monaco-lsp-path-intellisense';
import { createHoverProvider } from './monaco-lsp-hover';
import { createDefinitionProvider } from './monaco-lsp-jump-to-definition';
import { LanguageServerManager } from './monaco-lsp-server-manager';
import { LSPDocumentManager } from './lsp-document-manager';
import { MonacoLSPDiagnostics } from './monaco-lsp-diagnostics';
import { MonacoLSPCompletionProvider } from './monaco-lsp-completion';

/**
 * Класс для интеграции LSP с Monaco Editor
 */
export class MonacoLSPIntegration {
  private monaco: any;
  private editor: any;
  private workspaceRoot: string | null = null;
  private documentManager: LSPDocumentManager | null = null;
  private diagnosticsManager: MonacoLSPDiagnostics | null = null;
  private completionProvider: MonacoLSPCompletionProvider | null = null;
  private pathIntellisense: any = null;
  private hoverProvider: any = null;
  private definitionProvider: any = null;
  private languageServers: Map<string, boolean> = new Map();
  private isInitialized: boolean = false;
  
  /**
   * Языки, которые поддерживаются в интеграции
   */
  private supportedLanguages: string[] = [
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact',
    'html',
    'css',
    'json'
  ];
  
  /**
   * Конструктор
   */
  constructor(monaco: any) {
    if (!monaco) {
      console.warn('Monaco не определен в LSP Integration');
      return;
    }
    this.monaco = monaco;
    
    // Инициализируем менеджер серверов
    LanguageServerManager.initialize();
    
    console.log('MonacoLSPIntegration создан');
  }
  
  /**
   * Инициализация интеграции LSP
   */
  public initialize(editor: any, workspaceRoot: string): void {
    if (!editor || !this.monaco) {
      console.warn('Редактор или Monaco не определены при инициализации LSP');
      return;
    }
    
    try {
      this.editor = editor;
      this.workspaceRoot = workspaceRoot;
      
      // Инициализируем менеджер документов
      this.documentManager = new LSPDocumentManager(this.monaco, editor);
      
      // Инициализируем менеджер диагностик
      this.diagnosticsManager = new MonacoLSPDiagnostics(this.monaco);
      
      // Инициализируем провайдер автодополнений
      this.completionProvider = new MonacoLSPCompletionProvider(this.monaco);
      
      // Инициализируем провайдер подсказок путей
      this.pathIntellisense = createPathIntellisense(this.monaco);
      
      // Инициализируем провайдер подсказок при наведении
      this.hoverProvider = createHoverProvider(this.monaco);
      
      // Инициализируем провайдер перехода к определению
      this.definitionProvider = createDefinitionProvider(this.monaco);
      this.definitionProvider.setupLinkOpener(editor);
      
      // Регистрируем провайдеры для всех поддерживаемых языков
      this.registerProvidersForLanguages();
      
      this.isInitialized = true;
      console.log('MonacoLSPIntegration инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации LSP:', error);
    }
  }
  
  /**
   * Регистрация провайдеров для всех поддерживаемых языков
   */
  private registerProvidersForLanguages(): void {
    try {
      this.supportedLanguages.forEach(languageId => {
        // Регистрируем провайдер автодополнений
        if (this.completionProvider) {
          this.completionProvider.registerCompletionProvider(languageId);
        }
        
        // Регистрируем провайдер подсказок путей
        if (this.pathIntellisense) {
          this.pathIntellisense.registerPathCompletionProvider(languageId);
        }
        
        // Регистрируем провайдер подсказок при наведении
        if (this.hoverProvider) {
          this.hoverProvider.registerHoverProvider(languageId);
        }
        
        // Регистрируем провайдер перехода к определению
        if (this.definitionProvider) {
          this.definitionProvider.registerDefinitionProvider(languageId);
          this.definitionProvider.registerTypeDefinitionProvider(languageId);
        }
      });
      
      console.log('Все провайдеры зарегистрированы для поддерживаемых языков');
    } catch (error) {
      console.error('Ошибка при регистрации провайдеров:', error);
    }
  }
  
  /**
   * Подключение к соответствующему языковому серверу
   */
  public connectToLanguageServer(languageId: string): void {
    if (!this.isInitialized || !languageId) return;
    
    try {
      // Проверяем, поддерживается ли этот язык
      if (!this.supportedLanguages.includes(languageId)) {
        console.warn(`Язык ${languageId} не поддерживается LSP интеграцией`);
        return;
      }
      
      // Проверяем, не подключены ли мы уже к этому серверу
      if (this.languageServers.has(languageId) && this.languageServers.get(languageId)) {
        console.log(`Уже подключены к серверу для языка ${languageId}`);
        return;
      }
      
      // Регистрируем сервер в зависимости от языка
      let serverId: string;
      
      if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId)) {
        serverId = 'typescript';
      } else if (languageId === 'html') {
        serverId = 'html';
      } else if (languageId === 'css') {
        serverId = 'css';
      } else if (languageId === 'json') {
        serverId = 'json';
      } else {
        console.warn(`Нет сервера для языка ${languageId}`);
        return;
      }
      
      // Подключаемся к серверу
      LanguageServerManager.registerServer(serverId, {
        name: serverId,
        documentSelector: [languageId],
        capabilities: {
          textDocumentSync: 2, // Incremental
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: ['.', '"', "'", '/', '@', '<']
          },
          hoverProvider: true,
          definitionProvider: true,
          typeDefinitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          codeActionProvider: true,
          documentFormattingProvider: true
        }
      });
      
      // Запоминаем, что подключились к серверу
      this.languageServers.set(languageId, true);
      
      console.log(`Подключены к языковому серверу для ${languageId}`);
    } catch (error) {
      console.error(`Ошибка при подключении к серверу для языка ${languageId}:`, error);
    }
  }
  
  /**
   * Обработка открытия файла
   */
  public handleFileOpen(uri: string, languageId: string, content: string): void {
    if (!this.isInitialized) return;
    
    try {
      // Подключаемся к соответствующему языковому серверу
      this.connectToLanguageServer(languageId);
      
      // Уведомляем менеджер документов
      if (this.documentManager) {
        this.documentManager.addDocument(uri, languageId, content);
      }
      
      console.log(`Файл открыт: ${uri}, язык: ${languageId}`);
    } catch (error) {
      console.error(`Ошибка при обработке открытия файла ${uri}:`, error);
    }
  }
  
  /**
   * Обработка изменения файла
   */
  public handleFileChange(uri: string, content: string): void {
    if (!this.isInitialized) return;
    
    try {
      // Уведомляем менеджер документов
      if (this.documentManager) {
        this.documentManager.updateDocument(uri, content);
      }
    } catch (error) {
      console.error(`Ошибка при обработке изменения файла ${uri}:`, error);
    }
  }
  
  /**
   * Обработка закрытия файла
   */
  public handleFileClose(uri: string): void {
    if (!this.isInitialized) return;
    
    try {
      // Уведомляем менеджер документов
      if (this.documentManager) {
        this.documentManager.removeDocument(uri);
      }
      
      console.log(`Файл закрыт: ${uri}`);
    } catch (error) {
      console.error(`Ошибка при обработке закрытия файла ${uri}:`, error);
    }
  }
  
  /**
   * Установка корневой директории рабочего пространства
   */
  public setWorkspaceRoot(workspaceRoot: string): void {
    this.workspaceRoot = workspaceRoot;
    
    // Уведомляем менеджер серверов
    LanguageServerManager.setWorkspaceRoot(workspaceRoot);
    
    console.log(`Установлен корень рабочего пространства: ${workspaceRoot}`);
  }
  
  /**
   * Получение подсказок при наведении
   */
  public async getHoverInfo(model: any, position: any): Promise<any> {
    if (!this.isInitialized || !this.hoverProvider) return null;
    
    try {
      return await this.hoverProvider.provideHover(model, position, { isCancellationRequested: false });
    } catch (error) {
      console.error('Ошибка при получении подсказки:', error);
      return null;
    }
  }
  
  /**
   * Очистка ресурсов
   */
  public dispose(): void {
    try {
      // Очищаем ресурсы менеджера документов
      if (this.documentManager) {
        this.documentManager.dispose();
        this.documentManager = null;
      }
      
      // Очищаем ресурсы менеджера диагностик
      if (this.diagnosticsManager) {
        this.diagnosticsManager.dispose();
        this.diagnosticsManager = null;
      }
      
      // Очищаем ресурсы провайдера автодополнений
      if (this.completionProvider) {
        this.completionProvider.dispose();
        this.completionProvider = null;
      }
      
      // Очищаем ресурсы провайдера подсказок путей
      if (this.pathIntellisense) {
        this.pathIntellisense.dispose();
        this.pathIntellisense = null;
      }
      
      // Очищаем ресурсы провайдера подсказок при наведении
      if (this.hoverProvider) {
        this.hoverProvider.dispose();
        this.hoverProvider = null;
      }
      
      // Очищаем ресурсы провайдера перехода к определению
      if (this.definitionProvider) {
        this.definitionProvider.dispose();
        this.definitionProvider = null;
      }
      
      // Очищаем ресурсы менеджера серверов
      LanguageServerManager.dispose();
      
      this.editor = null;
      this.monaco = null;
      this.isInitialized = false;
      
      console.log('MonacoLSPIntegration освобождён');
    } catch (error) {
      console.error('Ошибка при освобождении LSP:', error);
    }
  }
}

// Создаем и экспортируем экземпляр
let monacoLSPInstance: MonacoLSPIntegration | null = null;

export const initializeMonacoLSP = (monaco: any) => {
  if (!monacoLSPInstance) {
    monacoLSPInstance = new MonacoLSPIntegration(monaco);
  }
  return monacoLSPInstance;
};

export const getMonacoLSPInstance = () => monacoLSPInstance; 