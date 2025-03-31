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
import { initializeLanguageServer, connectToLanguageServer } from './monaco-lsp-server';
import { MonacoLSPWrapper } from './monaco-lsp-wrapper';

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
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('MonacoLSPIntegration уже инициализирован');
      return;
    }

    try {
      // Инициализируем менеджер языковых серверов
      if (languageServerManager) {
        languageServerManager.initialize();
      }

      // Инициализируем TypeScript сервер
      await this.initializeTypeScriptServer();

      // Настраиваем Monaco для работы с LSP
      this.setupMonacoLSP();

      this.isInitialized = true;
      console.log('MonacoLSPIntegration успешно инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации MonacoLSPIntegration:', error);
      throw error;
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

  private async initializeTypeScriptServer() {
    try {
      // Инициализируем TypeScript Language Server
      const server = await this.languageServerManager.getServer('typescript');
      if (server) {
        // Настраиваем сервер для работы с TSX
        await this.languageServerManager.sendRequest('typescript', 'initialize', {
          processId: null,
          rootUri: this.workspaceRoot,
          capabilities: {
            textDocument: {
              completion: {
                completionItem: {
                  snippetSupport: true,
                  commitCharactersSupport: true,
                  deprecatedSupport: true,
                  preselectSupport: true,
                  tagSupport: {
                    valueSet: [1]
                  },
                  insertReplaceSupport: true,
                  resolveSupport: {
                    properties: ['documentation', 'detail', 'additionalTextEdits']
                  },
                  insertTextModeSupport: {
                    valueSet: [1, 2]
                  }
                }
              },
              hover: {
                dynamicRegistration: true,
                contentFormat: ['markdown', 'plaintext'],
                hoverCapabilities: {
                  dynamicRegistration: true,
                  contentFormat: ['markdown', 'plaintext']
                }
              },
              signatureHelp: {
                signatureInformation: {
                  documentationFormat: ['markdown', 'plaintext'],
                  parameterInformation: {
                    labelOffsetSupport: true
                  }
                }
              },
              definition: {
                linkSupport: true
              },
              references: {
                dynamicRegistration: true
              },
              documentHighlight: {
                dynamicRegistration: true
              },
              documentSymbol: {
                symbolKind: {
                  valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
                },
                hierarchicalDocumentSymbolSupport: true
              },
              formatting: {
                dynamicRegistration: true
              },
              rangeFormatting: {
                dynamicRegistration: true
              },
              onTypeFormatting: {
                dynamicRegistration: true
              },
              declaration: {
                linkSupport: true
              },
              implementation: {
                linkSupport: true
              },
              typeDefinition: {
                linkSupport: true
              },
              codeAction: {
                dynamicRegistration: true,
                codeActionLiteralSupport: {
                  codeActionKind: {
                    valueSet: ['quickfix', 'refactor', 'refactor.extract', 'refactor.inline', 'refactor.rewrite', 'source', 'source.organizeImports']
                  }
                },
                resolveSupport: {
                  properties: ['edit', 'command']
                }
              },
              codeLens: {
                dynamicRegistration: true
              },
              documentLink: {
                dynamicRegistration: true,
                tooltipSupport: true
              },
              colorProvider: {
                dynamicRegistration: true
              },
              rename: {
                dynamicRegistration: true,
                prepareSupport: true
              },
              publishDiagnostics: {
                relatedInformation: true,
                tagSupport: {
                  valueSet: [1, 2]
                },
                versionSupport: true,
                codeDescriptionSupport: true,
                dataSupport: true
              }
            }
          },
          initializationOptions: {
            hostInfo: 'monaco-editor',
            preferences: {
              includeInlayParameterNameHints: 'all',
              includeInlayParameterNameHintsWhenArgumentMatchesName: true,
              includeInlayFunctionParameterTypeHints: true,
              includeInlayVariableTypeHints: true,
              includeInlayPropertyDeclarationTypeHints: true,
              includeInlayFunctionLikeReturnTypeHints: true,
              importModuleSpecifierPreference: 'shortest',
              quotePreference: 'single',
              jsxEmit: 'react',
              jsxFactory: 'React.createElement',
              jsxFragmentFactory: 'React.Fragment'
            },
            tsserver: {
              useSyntaxServer: 'auto',
              maxTsServerMemory: 8192,
              watchOptions: {
                watchFile: 'useFsEvents',
                watchDirectory: 'useFsEvents',
                fallbackPolling: 'dynamicPriority'
              }
            }
          }
        });

        // Отправляем уведомление о готовности
        await this.languageServerManager.sendNotification('typescript', 'initialized', {});
      }
    } catch (error) {
      console.error('Ошибка при инициализации TypeScript сервера:', error);
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

// Глобальные переменные модуля
let instance: MonacoLSPWrapper | null = null;
let rootPath: string | null = null;

/**
 * Инициализирует типы TypeScript для улучшенной работы с TSX файлами
 * 
 * @param monaco Экземпляр Monaco Editor
 */
function configureTypeScriptTypes(monaco: any) {
  // Проверка наличия необходимых API
  if (!monaco || !monaco.languages || !monaco.languages.typescript) {
    console.warn('TypeScript language support not available');
    return;
  }

  try {
    // Регистрируем languageId для typescriptreact, если его нет
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'typescriptreact')) {
      monaco.languages.register({ id: 'typescriptreact' });
      console.log('Registered typescriptreact language');
    }

    // Настройка компилятора TypeScript для поддержки TSX
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      typeRoots: ["node_modules/@types"]
    });

    // Добавляем базовые определения типов для React
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare namespace React {
        type Key = string | number;
        
        interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
          type: T;
          props: P;
          key: Key | null;
        }
        
        type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
        
        interface FunctionComponent<P = {}> {
          (props: P, context?: any): ReactElement<any, any> | null;
          displayName?: string;
        }
        
        interface ComponentClass<P = {}, S = {}> {
          new(props: P, context?: any): Component<P, S>;
          displayName?: string;
        }
        
        type JSXElementConstructor<P> = ((props: P) => ReactElement | null) | (new (props: P) => Component<P, any>);
        
        interface Component<P = {}, S = {}> {
          props: P;
          state: S;
          setState<K extends keyof S>(state: ((prevState: Readonly<S>) => Pick<S, K> | S | null) | Pick<S, K> | S | null, callback?: () => void): void;
          forceUpdate(callback?: () => void): void;
          render(): ReactElement<any, any> | null;
        }
        
        function useState<T>(initialState: T | (() => T)): [T, (newState: T) => void];
        function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
        function useContext<T>(context: Context<T>): T;
        function useReducer<R extends Reducer<any, any>>(reducer: R, initialState: ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
        function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
        function useMemo<T>(factory: () => T, deps: readonly any[]): T;
        function useRef<T>(initialValue: T): MutableRefObject<T>;
        function useRef<T>(initialValue: T | null): RefObject<T>;
        
        type Reducer<S, A> = (prevState: S, action: A) => S;
        type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
        type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
        
        interface MutableRefObject<T> {
          current: T;
        }
        
        interface RefObject<T> {
          readonly current: T | null;
        }
        
        interface Context<T> {
          Provider: Provider<T>;
          Consumer: Consumer<T>;
          displayName?: string;
        }
        
        interface Provider<T> {
          (props: { value: T; children?: ReactNode }): ReactElement | null;
        }
        
        interface Consumer<T> {
          (props: { children: (value: T) => ReactNode }): ReactElement | null;
        }
        
        type ReactNode = ReactElement | string | number | Iterable<ReactNode> | ReactPortal | boolean | null | undefined;
        interface ReactPortal extends ReactElement {
          key: Key | null;
          children: ReactNode;
        }
      }
      
      declare namespace JSX {
        interface Element extends React.ReactElement<any, any> { }
        interface ElementClass extends React.Component<any> { }
        interface ElementAttributesProperty { props: {}; }
        interface ElementChildrenAttribute { children: {}; }
        
        interface IntrinsicElements {
          // HTML
          a: any;
          abbr: any;
          address: any;
          area: any;
          article: any;
          aside: any;
          audio: any;
          b: any;
          base: any;
          bdi: any;
          bdo: any;
          big: any;
          blockquote: any;
          body: any;
          br: any;
          button: any;
          canvas: any;
          caption: any;
          cite: any;
          code: any;
          col: any;
          colgroup: any;
          data: any;
          datalist: any;
          dd: any;
          del: any;
          details: any;
          dfn: any;
          dialog: any;
          div: any;
          dl: any;
          dt: any;
          em: any;
          embed: any;
          fieldset: any;
          figcaption: any;
          figure: any;
          footer: any;
          form: any;
          h1: any;
          h2: any;
          h3: any;
          h4: any;
          h5: any;
          h6: any;
          head: any;
          header: any;
          hgroup: any;
          hr: any;
          html: any;
          i: any;
          iframe: any;
          img: any;
          input: any;
          ins: any;
          kbd: any;
          keygen: any;
          label: any;
          legend: any;
          li: any;
          link: any;
          main: any;
          map: any;
          mark: any;
          menu: any;
          menuitem: any;
          meta: any;
          meter: any;
          nav: any;
          noscript: any;
          object: any;
          ol: any;
          optgroup: any;
          option: any;
          output: any;
          p: any;
          param: any;
          picture: any;
          pre: any;
          progress: any;
          q: any;
          rp: any;
          rt: any;
          ruby: any;
          s: any;
          samp: any;
          script: any;
          section: any;
          select: any;
          small: any;
          source: any;
          span: any;
          strong: any;
          style: any;
          sub: any;
          summary: any;
          sup: any;
          table: any;
          tbody: any;
          td: any;
          textarea: any;
          tfoot: any;
          th: any;
          thead: any;
          time: any;
          title: any;
          tr: any;
          track: any;
          u: any;
          ul: any;
          var: any;
          video: any;
          wbr: any;
          // SVG
          svg: any;
          circle: any;
          clipPath: any;
          defs: any;
          ellipse: any;
          foreignObject: any;
          g: any;
          image: any;
          line: any;
          linearGradient: any;
          mask: any;
          path: any;
          pattern: any;
          polygon: any;
          polyline: any;
          radialGradient: any;
          rect: any;
          stop: any;
          text: any;
          tspan: any;
        }
      }
      `,
      'file:///node_modules/@types/react/index.d.ts'
    );

    // Настраиваем автодополнение для TSX
    monaco.languages.registerCompletionItemProvider('typescriptreact', {
      triggerCharacters: ['<', '.', ':', '"', "'", '/', '@', '{'],
      provideCompletionItems: (model, position) => {
        const text = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const suggestions = [];
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column
        };

        // JSX элементы (после <)
        if (/<[a-zA-Z]*$/.test(text)) {
          const jsxElements = [
            { label: 'div', documentation: 'Блочный контейнер' },
            { label: 'span', documentation: 'Встроенный контейнер' },
            { label: 'button', documentation: 'Кнопка' },
            { label: 'input', documentation: 'Поле ввода' },
            { label: 'form', documentation: 'HTML форма' },
            { label: 'img', documentation: 'Изображение' },
            { label: 'a', documentation: 'Ссылка' },
            { label: 'p', documentation: 'Параграф' },
            { label: 'h1', documentation: 'Заголовок 1 уровня' },
            { label: 'h2', documentation: 'Заголовок 2 уровня' },
            { label: 'h3', documentation: 'Заголовок 3 уровня' },
            { label: 'ul', documentation: 'Маркированный список' },
            { label: 'li', documentation: 'Элемент списка' },
            { label: 'table', documentation: 'Таблица' },
            { label: 'tr', documentation: 'Строка таблицы' },
            { label: 'td', documentation: 'Ячейка таблицы' }
          ];

          jsxElements.forEach(({ label, documentation }) => {
            suggestions.push({
              label,
              kind: monaco.languages.CompletionItemKind.Property,
              documentation: { value: `**${label}** - ${documentation}` },
              insertText: label,
              range
            });
          });
        }

        // React хуки (после use)
        if (/\buse[A-Z]*$/.test(text)) {
          const reactHooks = [
            { label: 'useState', insertText: 'useState($0)', documentation: 'Хук для управления состоянием компонента' },
            { label: 'useEffect', insertText: 'useEffect(() => {\n\t$0\n}, [])', documentation: 'Хук для выполнения побочных эффектов' },
            { label: 'useContext', insertText: 'useContext($0)', documentation: 'Хук для доступа к контексту React' },
            { label: 'useRef', insertText: 'useRef($0)', documentation: 'Хук для создания мутабельной ссылки' },
            { label: 'useCallback', insertText: 'useCallback(($0) => {\n\t\n}, [])', documentation: 'Хук для мемоизации функций' },
            { label: 'useMemo', insertText: 'useMemo(() => {\n\treturn $0\n}, [])', documentation: 'Хук для мемоизации значений' }
          ];

          reactHooks.forEach(({ label, insertText, documentation }) => {
            suggestions.push({
              label,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: { value: `**${label}** - ${documentation}` },
              range
            });
          });
        }

        // Атрибуты JSX (внутри тега)
        if (/<[a-zA-Z]+\s[^>]*$/.test(text)) {
          const jsxAttributes = [
            { label: 'className', insertText: 'className="$0"', documentation: 'Устанавливает CSS класс для элемента' },
            { label: 'style', insertText: 'style={{ $0 }}', documentation: 'Устанавливает встроенные стили для элемента' },
            { label: 'onClick', insertText: 'onClick={() => $0}', documentation: 'Обработчик события клика' },
            { label: 'onChange', insertText: 'onChange={(e) => $0}', documentation: 'Обработчик события изменения' },
            { label: 'onSubmit', insertText: 'onSubmit={(e) => $0}', documentation: 'Обработчик события отправки формы' },
            { label: 'type', insertText: 'type="$0"', documentation: 'Тип элемента формы' },
            { label: 'value', insertText: 'value={$0}', documentation: 'Значение элемента формы' },
            { label: 'id', insertText: 'id="$0"', documentation: 'Идентификатор элемента' },
            { label: 'disabled', insertText: 'disabled={$0}', documentation: 'Отключает элемент' },
            { label: 'placeholder', insertText: 'placeholder="$0"', documentation: 'Подсказка для поля ввода' }
          ];

          jsxAttributes.forEach(({ label, insertText, documentation }) => {
            suggestions.push({
              label,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: { value: `**${label}** - ${documentation}` },
              range
            });
          });
        }

        return { suggestions };
      }
    });

    console.log('Configured TypeScript types and completion for TSX');
  } catch (error) {
    console.error('Error configuring TypeScript types for TSX:', error);
  }
}

/**
 * Инициализирует TypeScript Language Server с расширенными возможностями для TSX файлов
 * 
 * @param monaco Экземпляр Monaco Editor 
 * @param editor Экземпляр редактора Monaco
 */
export function initializeTypeScriptServer(monaco: any, editor: any): void {
  if (!monaco || !editor) {
    console.error('Monaco или Editor не определены');
    return;
  }

  try {
    console.log('Инициализация TypeScript Server для Monaco...');
    
    // Регистрируем язык, если он еще не зарегистрирован
    if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'typescriptreact')) {
      monaco.languages.register({ id: 'typescriptreact', extensions: ['.tsx'] });
      console.log('Язык typescriptreact зарегистрирован');
    }
    
    // Простые определения для токенизатора TSX (без сложных правил)
    monaco.languages.setMonarchTokensProvider('typescriptreact', {
      defaultToken: '',
      tokenPostfix: '.tsx',
      
      // Общие токены
      brackets: [
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
        { open: '<', close: '>', token: 'delimiter.angle' }
      ],
      
      keywords: [
        'var', 'let', 'const', 'function', 'class', 'extends', 'implements', 'return',
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'try', 'catch', 
        'finally', 'throw', 'typeof', 'instanceof', 'new', 'void', 'this', 'super',
        'interface', 'type', 'enum', 'import', 'export', 'from', 'as', 'async', 'await'
      ],
      
      // Простой токенизатор
      tokenizer: {
        root: [
          // Идентификаторы и ключевые слова
          [/[a-zA-Z_$][\w$]*/, { 
            cases: { 
              '@keywords': 'keyword',
              '@default': 'identifier' 
            } 
          }],
          
          // Числа
          [/\d+\.\d+/, 'number.float'],
          [/\d+/, 'number'],
          
          // Строки
          [/"([^"\\]|\\.)*$/, 'string.invalid'], // Незавершенная строка
          [/'([^'\\]|\\.)*$/, 'string.invalid'], // Незавершенная строка
          [/"/, 'string', '@string_double'],
          [/'/, 'string', '@string_single'],
          
          // Пробелы
          [/[ \t\r\n]+/, ''],
          
          // Комментарии
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          
          // Скобки
          [/[{}()\[\]]/, '@brackets'],
          [/[<>]/, '@brackets'],
          
          // Операторы
          [/[+\-*/=<>!&|^~?:%]/, 'operator']
        ],
        
        // Правило для строк в двойных кавычках
        string_double: [
          [/[^"\\]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop']
        ],
        
        // Правило для строк в одинарных кавычках
        string_single: [
          [/[^'\\]+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, 'string', '@pop']
        ],
        
        // Правило для комментариев
        comment: [
          [/[^/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment']
        ]
      }
    });
    
    // Простой провайдер автодополнения для JSX
    monaco.languages.registerCompletionItemProvider('typescriptreact', {
      triggerCharacters: ['<', '.', ':', '"', "'", '/'],
      provideCompletionItems: function(model, position) {
        // Простой массив предложений
        const suggestions = [];
        
        // Получаем текст перед курсором
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        // Создаем диапазон для замены
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column
        };
        
        // Базовые HTML элементы для JSX
        if (/<[a-z]*$/.test(textUntilPosition)) {
          const elements = ['div', 'span', 'p', 'button', 'input', 'form'];
          elements.forEach(element => {
            suggestions.push({
              label: element,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: element,
              range
            });
          });
        }
        
        // Базовые атрибуты для JSX
        if (/<[a-z]+\s[^>]*$/.test(textUntilPosition)) {
          const attrs = ['className', 'id', 'style', 'onClick', 'onChange'];
          attrs.forEach(attr => {
            suggestions.push({
              label: attr,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: attr + '=""',
              range
            });
          });
        }
        
        // Хуки React (если введено 'use')
        if (/\buse$/.test(textUntilPosition)) {
          const hooks = ['useState', 'useEffect', 'useRef', 'useContext'];
          hooks.forEach(hook => {
            suggestions.push({
              label: hook,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: hook,
              range
            });
          });
        }
        
        return { suggestions };
      }
    });
    
    // Подсказки при наведении
    monaco.languages.registerHoverProvider('typescriptreact', {
      provideHover: function(model, position) {
        const word = model.getWordAtPosition(position);
        
        // Нет слова под курсором
        if (!word) return null;
        
        const token = word.word;
        
        // React хуки
        if (token.startsWith('use')) {
          if (token === 'useState') {
            return {
              contents: [{ value: '**useState** - хук для управления состоянием компонента' }]
            };
          }
          if (token === 'useEffect') {
            return {
              contents: [{ value: '**useEffect** - хук для выполнения побочных эффектов' }]
            };
          }
        }
        
        // HTML элементы
        const elements = {
          'div': 'Блочный HTML-элемент',
          'span': 'Строчный HTML-элемент',
          'button': 'Кнопка',
          'input': 'Поле ввода'
        };
        
        if (elements[token]) {
          return {
            contents: [{ value: `**${token}** - ${elements[token]}` }]
          };
        }
        
        return null;
      }
    });
    
    // Если в Monaco доступен TypeScript, настраиваем его
    if (monaco.languages.typescript) {
      // Настройки компилятора для поддержки JSX
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        module: monaco.languages.typescript.ModuleKind.ESNext
      });
      
      // Минимальные определения типов для React
      const reactTypes = `
      declare namespace React {
        type ReactNode = any;
        function createElement(type: any, props?: any, ...children: any[]): any;
        function Fragment(props: { children?: ReactNode }): ReactNode;
        
        function useState<T>(initialState: T): [T, (newState: T) => void];
        function useEffect(callback: () => (void | (() => void)), deps?: any[]): void;
        function useContext<T>(context: Context<T>): T;
        function useRef<T>(initialValue: T): { current: T };
        
        class Component<P = {}, S = {}> {
          props: P;
          state: S;
          constructor(props: P);
          setState(state: S): void;
          render(): ReactNode;
        }
        
        class PureComponent<P = {}, S = {}> extends Component<P, S> {}
        
        interface Context<T> {
          Provider: Provider<T>;
          Consumer: Consumer<T>;
        }
        
        interface Provider<T> {
          new (props: { value: T, children: ReactNode }): any;
        }
        
        interface Consumer<T> {
          new (props: { children: (value: T) => ReactNode }): any;
        }
        
        function createContext<T>(defaultValue: T): Context<T>;
      }
      
      declare namespace JSX {
        interface Element {}
        interface ElementClass {}
        interface ElementAttributesProperty {}
        interface ElementChildrenAttribute {}
        interface IntrinsicElements {
          div: any;
          span: any;
          p: any;
          button: any;
          input: any;
          form: any;
          a: any;
          h1: any;
          h2: any;
          h3: any;
          ul: any;
          li: any;
          table: any;
          tr: any;
          td: any;
          [elemName: string]: any;
        }
      }`;
      
      // Добавляем определения React
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactTypes,
        'typescript:react.d.ts'
      );
    }
    
    console.log('TypeScript Server для Monaco успешно инициализирован');
  } catch (error) {
    console.error('Ошибка при инициализации TypeScript Server:', error);
  }
} 