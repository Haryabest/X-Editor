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
import { LanguageServerManager, languageServerManager } from './monaco-lsp-server-manager';
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
    
    // Убеждаемся, что менеджер серверов инициализирован
    try {
      if (languageServerManager) {
        // Инициализируем менеджер серверов если это еще не сделано
        if (typeof languageServerManager.initialize === 'function') {
          languageServerManager.initialize();
        }
      } else {
        console.warn('languageServerManager не определен');
      }
    } catch (error) {
      console.error('Ошибка при доступе к languageServerManager:', error);
    }
    
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
      
      // Передаем корневую директорию в менеджер серверов
      if (workspaceRoot && languageServerManager) {
        languageServerManager.setWorkspaceRoot(workspaceRoot);
      }
      
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
      
      // Проверяем наличие языкового сервера
      if (languageServerManager && !languageServerManager.isConnected(serverId)) {
        // Запускаем сервер если он еще не запущен
        languageServerManager.startServer(serverId).catch(error => {
          console.error(`Ошибка при запуске сервера ${serverId}:`, error);
        });
      }
      
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
  public handleFileOpen(uriOrModel: any, languageIdOrContent?: string, content?: string): void {
    if (!this.isInitialized) return;
    
    try {
      let uri: string = '';
      let languageId: string = '';
      let fileContent: string = '';
      
      // Определяем тип первого параметра (uri строка или модель)
      if (typeof uriOrModel === 'string') {
        // Первый параметр - строка URI
        uri = uriOrModel;
        
        // Проверяем второй параметр - это может быть languageId или content
        if (typeof languageIdOrContent === 'string') {
          // Если похоже на контент (длинный или содержит переносы строк)
          if (languageIdOrContent.length > 30 || languageIdOrContent.includes('\n')) {
            fileContent = languageIdOrContent;
          } else {
            // Иначе считаем, что это languageId
            languageId = languageIdOrContent;
            fileContent = content || '';
          }
        }
      } else if (uriOrModel && uriOrModel.uri) {
        // Первый параметр - модель Monaco
        const model = uriOrModel;
        uri = model.uri.toString();
        
        try {
          // Пытаемся получить languageId из модели
          languageId = model.getLanguageId ? model.getLanguageId() : '';
          // Пытаемся получить содержимое из модели
          fileContent = model.getValue ? model.getValue() : '';
        } catch (e) {
          console.warn('Не удалось получить данные из модели:', e);
        }
      } else {
        console.warn('handleFileOpen: неверные параметры', uriOrModel);
        return;
      }
      
      // Проверка URI
      if (!uri) {
        console.warn('handleFileOpen: URI не определен');
        return;
      }
      
      // Нормализуем URI для LSP
      const normalizedUri = this.normalizeUri(uri);
      
      // Определяем подходящий languageId, если он не был передан
      const detectedLanguageId = languageId || this.detectLanguageId(normalizedUri);
      
      // Если контент не предоставлен, пытаемся получить из текущей модели редактора
      if (!fileContent && this.monaco && this.editor) {
        try {
          const model = this.editor.getModel();
          if (model) {
            fileContent = model.getValue() || '';
          }
        } catch (e) {
          console.warn('Не удалось получить содержимое из модели редактора:', e);
        }
      }
      
      // Подключаемся к соответствующему языковому серверу
      this.connectToLanguageServer(detectedLanguageId);
      
      // Уведомляем менеджер документов
      if (this.documentManager) {
        this.documentManager.addDocument(normalizedUri, detectedLanguageId, fileContent);
      }
      
      console.log(`Файл открыт: ${normalizedUri}, язык: ${detectedLanguageId}`);
    } catch (error) {
      console.error(`Ошибка при обработке открытия файла:`, error);
    }
  }
  
  /**
   * Нормализация URI для LSP
   */
  private normalizeUri(uri: string): string {
    if (!uri) return '';
    
    try {
      // Если это уже URI формат (file://, inmemory://, etc.)
      if (uri.match(/^[a-z]+:\/\//i)) {
        return uri;
      }
      
      // Для Windows путей - преобразуем в file:/// формат
      if (uri.match(/^[a-z]:\\/i) || uri.match(/^[a-z]:\//i)) { // Windows path like C:\path\to\file or C:/path/to/file
        return `file:///${uri.replace(/\\/g, '/')}`;
      }
      
      // Для абсолютных Unix-style путей
      if (uri.startsWith('/')) {
        return `file://${uri}`;
      }
      
      // Для относительных путей
      // Создаем URI на основе текущего рабочего пространства, если оно есть
      if (this.workspaceRoot) {
        // Если рабочая директория - Windows путь, обрабатываем соответственно
        if (this.workspaceRoot.match(/^[a-z]:\\/i) || this.workspaceRoot.match(/^[a-z]:\//i)) {
          const normalizedRoot = this.workspaceRoot.replace(/\\/g, '/');
          return `file:///${normalizedRoot}/${uri}`;
        } else if (this.workspaceRoot.startsWith('/')) {
          return `file://${this.workspaceRoot}/${uri}`;
        }
      }
      
      // Если нет рабочей директории или это просто название файла,
      // используем inmemory:// схему
      return `inmemory:///${uri}`;
    } catch (error) {
      console.error('Ошибка при нормализации URI:', error);
      return `inmemory:///${uri}`; // Используем inmemory:// в случае ошибки
    }
  }
  
  /**
   * Определение languageId на основе расширения файла
   */
  private detectLanguageId(uri: string): string {
    if (!uri) return 'plaintext';
    
    try {
      // Получаем расширение из URI
      const match = uri.match(/\.([^.]+)$/);
      const ext = match ? match[1].toLowerCase() : '';
      
      // Определяем languageId на основе расширения
      switch (ext) {
        case 'js': return 'javascript';
        case 'jsx': return 'javascriptreact';
        case 'ts': return 'typescript';
        case 'tsx': return 'typescriptreact';
        case 'html': 
        case 'htm': return 'html';
        case 'css': return 'css';
        case 'scss': return 'scss';
        case 'less': return 'less';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'py': return 'python';
        case 'php': return 'php';
        case 'rb': return 'ruby';
        case 'java': return 'java';
        case 'c': return 'c';
        case 'cpp':
        case 'cc':
        case 'h':
        case 'hpp': return 'cpp';
        case 'go': return 'go';
        case 'rs': return 'rust';
        case 'swift': return 'swift';
        case 'cs': return 'csharp';
        case 'xml': return 'xml';
        case 'yaml':
        case 'yml': return 'yaml';
        case 'sql': return 'sql';
        case 'sh': return 'shell';
        default: return 'plaintext';
      }
    } catch (error) {
      console.error('Ошибка при определении languageId:', error);
      return 'plaintext';
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
    if (languageServerManager) {
      languageServerManager.setWorkspaceRoot(workspaceRoot);
    }
    
    console.log(`Установлен корень рабочего пространства: ${workspaceRoot}`);
  }
  
  /**
   * Получение информации по наведению курсора (hover)
   */
  public async getHoverInfo(model: any, position: any): Promise<any> {
    if (!this.isInitialized || !model || !position) return null;
    
    try {
      const uri = model.uri.toString();
      const languageId = model.getLanguageId();
      
      // Получаем текст строки и слово под курсором
      const lineText = model.getLineContent(position.lineNumber) || '';
      let wordInfo = null;
      try {
        wordInfo = model.getWordAtPosition(position);
      } catch (e) {
        console.warn('Ошибка при получении слова из модели:', e);
      }
      
      const word = wordInfo ? wordInfo.word : '';
      
      // Формируем запрос в формате LSP
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1
      };
      
      // Определяем ID языкового сервера
      let serverId = '';
      if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId)) {
        serverId = 'typescript';
      } else if (languageId === 'html') {
        serverId = 'html';
      } else if (languageId === 'css') {
        serverId = 'css';
      } else if (languageId === 'json') {
        serverId = 'json';
      }
      
      if (!serverId) return null;
      
      // Отправляем запрос на сервер
      if (languageServerManager) {
        const hoverResponse = await languageServerManager.sendRequest(serverId, 'textDocument/hover', {
          textDocument: { uri },
          position: lspPosition,
          context: {
            word,
            lineText,
            languageId
          }
        });
        
        // Если получили ответ, возвращаем его
        if (hoverResponse) {
          return hoverResponse;
        }
      }
      
      // Для TypeScript файлов пытаемся получить информацию о типе
      if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId) && this.monaco.languages.typescript) {
        // Пытаемся получить информацию о типе через TypeScript Worker
        try {
          const workerPromise = this.monaco.languages.typescript.getTypeScriptWorker();
          const worker = await workerPromise;
          const languageService = await worker(model.uri);
          
          // Получаем quickInfo для текущей позиции
          const typeInfo = await languageService.getQuickInfoAtPosition(model.uri.toString(), position.lineNumber, position.column);
          
          if (typeInfo) {
            // Формируем информацию о типе в формате hover
            const displayParts = typeInfo.displayParts || [];
            const documentation = typeInfo.documentation || [];
            
            // Собираем информацию о типе
            let typeText = displayParts.map((part: any) => part.text).join('');
            const docText = documentation.map((part: any) => part.text).join('');
            
            // Формируем разметку markdown
            let markdownContent = '';
            
            // Добавляем тип
            if (typeText) {
              // Форматируем тип
              typeText = typeText.replace(/(.*):(.*)/, '**$1**:$2');
              markdownContent += `${typeText}\n\n`;
            }
            
            // Добавляем документацию
            if (docText) {
              markdownContent += docText;
            }
            
            // Если есть контент, возвращаем его
            if (markdownContent) {
              return {
                contents: {
                  kind: 'markdown',
                  value: markdownContent
                },
                range: {
                  start: {
                    line: position.lineNumber - 1,
                    character: (wordInfo ? wordInfo.startColumn : position.column) - 1
                  },
                  end: {
                    line: position.lineNumber - 1,
                    character: (wordInfo ? wordInfo.endColumn : position.column + 1) - 1
                  }
                },
                word: word,
                languageId: languageId
              };
            }
          }
        } catch (e) {
          console.warn('Ошибка при получении информации о типе:', e);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при получении hover информации:', error);
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