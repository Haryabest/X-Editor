/**
 * Monaco LSP Wrapper
 * 
 * Упрощенный интерфейс для подключения Monaco Editor к языковым серверам через LSP
 */

// @ts-nocheck - Disable TypeScript checking
import * as monaco from 'monaco-editor';
import { MonacoLSPCompletionProvider } from './monaco-lsp-completion';
import { LSPDocumentManager } from './lsp-document-manager';
import { MonacoLSPDiagnostics } from './monaco-lsp-diagnostics';
import { languageServerManager } from './monaco-lsp-server-manager';
import { MonacoLSPHoverProvider } from './monaco-lsp-hover';

// Создаем экземпляры необходимых сервисов
const lspDocumentManager = new LSPDocumentManager();
const monacoLSPDiagnostics = new MonacoLSPDiagnostics();

/**
 * Интерфейс для языкового сервера
 */
export interface LanguageServer {
  id: string;
  name: string;
  fileExtensions: string[];
}

/**
 * Интерфейс для статуса LSP
 */
export interface LSPStatus {
  initialized: boolean;
  connectedServers: string[];
}

/**
 * Определения предопределенных языковых серверов
 */
export const predefinedLanguageServers = {
  typescript: {
    id: 'typescript-language-server',
    name: 'TypeScript Language Server',
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  python: {
    id: 'python-language-server',
    name: 'Python Language Server',
    fileExtensions: ['.py']
  },
  html: {
    id: 'html-language-server',
    name: 'HTML Language Server',
    fileExtensions: ['.html', '.htm']
  },
  css: {
    id: 'css-language-server',
    name: 'CSS Language Server',
    fileExtensions: ['.css', '.scss', '.less']
  },
  json: {
    id: 'json-language-server',
    name: 'JSON Language Server',
    fileExtensions: ['.json']
  }
};

// Интерфейс для отслеживания состояния сервера
export interface ServerStatus {
  connected: boolean;
  serverName: string | null;
  languageId: string | null;
  capabilities: string[];
}

/**
 * Класс-обертка для интеграции LSP с Monaco Editor
 */
export class MonacoLSPWrapper {
  private monaco: any = null;
  private editor: any = null;
  private status: LSPStatus = {
    initialized: false,
    connectedServers: []
  };
  private disposables: any[] = [];
  private completionProvider: MonacoLSPCompletionProvider | null = null;
  private hoverProvider: MonacoLSPHoverProvider | null = null;
  private languageClientMap: Map<string, any> = new Map();
  private currentLanguageId: string | null = null;

  /**
   * Инициализация LSP интеграции
   */
  public initialize(monaco: any, editor: any): void {
    if (!monaco || !editor) {
      console.warn('Не удалось инициализировать LSP Wrapper: не указаны необходимые параметры');
      return;
    }

    try {
      console.log('Инициализация LSP Wrapper...');
      this.monaco = monaco;
      this.editor = editor;
      
      // Инициализируем менеджер документов
      lspDocumentManager.initialize(monaco, editor);
      
      // Инициализируем менеджер диагностики
      monacoLSPDiagnostics.initialize(monaco);
      
      // Инициализация TypeScript компилятора для корректной работы с TSX/JSX
      this.configureTypeScriptCompiler();
      
      // Инициализируем компонент автодополнения
      this.completionProvider = new MonacoLSPCompletionProvider(monaco);
      
      // Инициализируем компонент подсказок при наведении
      this.hoverProvider = new MonacoLSPHoverProvider(monaco);
      
      // Регистрируем провайдеры для TypeScript/JavaScript/React
      this.registerProvidersForLanguage('typescript');
      this.registerProvidersForLanguage('javascript');
      this.registerProvidersForLanguage('typescriptreact');
      this.registerProvidersForLanguage('javascriptreact');
      this.registerProvidersForLanguage('html');
      this.registerProvidersForLanguage('css');
      this.registerProvidersForLanguage('json');
      
      // Подписываемся на события редактора, чтобы отслеживать изменения модели
      this.registerEditorListeners();
      
      // Инициализируем менеджер языковых серверов
      if (languageServerManager && typeof languageServerManager.initialize === 'function') {
        languageServerManager.initialize();
      }
      
      this.status.initialized = true;
      console.log('LSP Wrapper успешно инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации LSP Wrapper:', error);
    }
  }

  /**
   * Настройка компилятора TypeScript для лучшей поддержки JSX/TSX
   */
  private configureTypeScriptCompiler(): void {
    if (!this.monaco?.languages?.typescript) {
      console.warn('Не удалось настроить TypeScript компилятор: monaco.languages.typescript не доступен');
      return;
    }
    
    try {
      // Настройка для TypeScript
      const tsDefaults = this.monaco.languages.typescript.typescriptDefaults;
      tsDefaults.setCompilerOptions({
        target: this.monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: this.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: this.monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: this.monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true
      });
      
      // Настройка для JavaScript
      const jsDefaults = this.monaco.languages.typescript.javascriptDefaults;
      jsDefaults.setCompilerOptions({
        target: this.monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: this.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: this.monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: this.monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true
      });
      
      // Добавляем базовые определения React
      tsDefaults.addExtraLib(
        `
        declare namespace React {
          interface Component<P = {}, S = {}> { }
          class Component<P, S> {
            constructor(props: P);
            props: P;
            state: S;
            setState(state: S): void;
            render(): JSX.Element | null;
          }
          function createElement<P>(type: any, props?: P, ...children: any[]): JSX.Element;
          function createContext<T>(defaultValue: T): any;
          function useState<T>(initialState: T): [T, (newState: T) => void];
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useRef<T>(initialValue: T): { current: T };
          function useContext<T>(context: any): T;
        }
        
        declare namespace JSX {
          interface Element { }
          interface IntrinsicElements {
            div: any;
            span: any;
            button: any;
            input: any;
            a: any;
            p: any;
            h1: any;
            h2: any;
            h3: any;
            ul: any;
            li: any;
            form: any;
            label: any;
            select: any;
            option: any;
            table: any;
            tr: any;
            td: any;
            th: any;
          }
        }
        `,
        'react.d.ts'
      );
      
      console.log('TypeScript компилятор успешно настроен для поддержки JSX/TSX');
    } catch (error) {
      console.error('Ошибка при настройке TypeScript компилятора:', error);
    }
  }

  /**
   * Регистрация слушателей редактора для синхронизации с LSP
   */
  private registerEditorListeners(): void {
    if (!this.editor || !this.monaco) return;
    
    try {
      // Обработчик изменения модели
      const disposable = this.editor.onDidChangeModel(() => {
        const model = this.editor.getModel();
        if (model) {
          const uri = model.uri.toString();
          const language = model.getLanguageId();
          
          console.log(`Изменена модель в редакторе: ${uri}, язык: ${language}`);
          
          // Обновляем текущий язык
          this.currentLanguageId = language;
          
          // Синхронизируем с LSP
          this.connectToLSPForLanguage(language);
        }
      });
      
      this.disposables.push(disposable);
    } catch (error) {
      console.error('Ошибка при регистрации слушателей редактора:', error);
    }
  }

  /**
   * Подключение к соответствующему LSP серверу для указанного языка
   */
  private connectToLSPForLanguage(languageId: string): void {
    if (!languageId) return;
    
    try {
      // Получаем тип сервера на основе языка
      let serverType = '';
      if (languageId === 'typescript' || languageId === 'typescriptreact') {
        serverType = 'typescript';
      } else if (languageId === 'javascript' || languageId === 'javascriptreact') {
        serverType = 'typescript'; // TypeScript сервер также обрабатывает JavaScript
      } else if (languageId === 'html') {
        serverType = 'html';
      } else if (languageId === 'css') {
        serverType = 'css';
      } else if (languageId === 'json') {
        serverType = 'json';
      } else {
        console.log(`Нет определенного сервера для языка ${languageId}`);
        return;
      }
      
      // Подключаемся к серверу
      this.connectToPredefinedServer(serverType);
    } catch (error) {
      console.error(`Ошибка при подключении к LSP для языка ${languageId}:`, error);
    }
  }

  /**
   * Регистрация провайдеров для языка
   */
  private registerProvidersForLanguage(languageId: string): void {
    if (!this.monaco || !languageId) return;
    
    try {
      // Регистрируем провайдер автодополнений
      if (this.completionProvider) {
        this.completionProvider.registerCompletionProvider(languageId);
        console.log(`Провайдер автодополнений зарегистрирован для языка ${languageId}`);
      }
      
      // Регистрируем провайдер подсказок при наведении
      if (this.hoverProvider) {
        this.hoverProvider.registerHoverProvider(languageId);
        console.log(`Провайдер подсказок зарегистрирован для языка ${languageId}`);
      }
      
      // Подключаемся к языковому серверу для этого языка
      this.connectToLSPForLanguage(languageId);
    } catch (error) {
      console.error(`Ошибка при регистрации провайдеров для языка ${languageId}:`, error);
    }
  }

  /**
   * Установка корневой директории проекта
   */
  public setProjectRoot(rootPath: string): boolean {
    if (!rootPath) {
      console.warn('Не удалось установить корневую директорию: не указан путь');
      return false;
    }
    
    try {
      // Устанавливаем корневую директорию для менеджера серверов
      if (languageServerManager) {
        languageServerManager.setWorkspaceRoot(rootPath);
      }
      
      console.log(`Корневая директория проекта установлена: ${rootPath}`);
      return true;
    } catch (error) {
      console.error('Ошибка при установке корневой директории проекта:', error);
      return false;
    }
  }

  /**
   * Подключение к предопределенному серверу LSP
   */
  public async connectToPredefinedServer(serverType: string): Promise<boolean> {
    if (!serverType) {
      console.warn('Не удалось подключиться к серверу: не указан тип сервера');
      return false;
    }
    
    try {
      // Проверяем, не подключены ли мы уже к серверу
      if (this.status.connectedServers.includes(serverType)) {
        console.log(`Уже подключены к серверу ${serverType}`);
        return true;
      }
      
      console.log(`Подключение к серверу ${serverType}...`);
      
      // Используем менеджер серверов для подключения
      if (languageServerManager) {
        const success = await languageServerManager.startServer(serverType);
        
        if (success) {
          // Добавляем сервер в список подключенных
          this.status.connectedServers.push(serverType);
          console.log(`Успешное подключение к серверу ${serverType}`);
        } else {
          console.warn(`Не удалось подключиться к серверу ${serverType}`);
        }
        
        return success;
      } else {
        console.warn('LanguageServerManager не инициализирован');
        return false;
      }
    } catch (error) {
      console.error(`Ошибка при подключении к серверу ${serverType}:`, error);
      return false;
    }
  }

  /**
   * Получение статуса LSP
   */
  public getStatus(): LSPStatus {
    return this.status;
  }

  /**
   * Обработка открытия файла
   */
  public handleFileOpen(filePath: string, content: string): void {
    if (!filePath) {
      console.warn('Не указан путь к файлу в handleFileOpen');
      return;
    }

    try {
      console.log(`Обработка открытия файла: ${filePath}`);
      
      // Определяем язык на основе расширения файла
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      let languageId = 'plaintext';
      
      if (fileExtension === 'ts') languageId = 'typescript';
      else if (fileExtension === 'tsx') languageId = 'typescriptreact';
      else if (fileExtension === 'js') languageId = 'javascript';
      else if (fileExtension === 'jsx') languageId = 'javascriptreact';
      else if (fileExtension === 'html' || fileExtension === 'htm') languageId = 'html';
      else if (fileExtension === 'css') languageId = 'css';
      else if (fileExtension === 'json') languageId = 'json';
      
      // Обновляем текущий язык
      this.currentLanguageId = languageId;
      
      // Регистрируем документ в менеджере документов
      lspDocumentManager.addDocument(filePath, languageId, content);
      
      // Подключаемся к соответствующему LSP серверу
      this.connectToLSPForLanguage(languageId);
      
      // Если это TypeScript/TSX файл, особая обработка для интеграции TS
      if (fileExtension === 'ts' || fileExtension === 'tsx') {
        this.registerTypeScriptDocument(filePath, content);
      }
    } catch (error) {
      console.error(`Ошибка при обработке открытия файла ${filePath}:`, error);
    }
  }

  /**
   * Регистрация TypeScript документа для правильной интеграции с TS сервером
   */
  private registerTypeScriptDocument(filePath: string, content: string): void {
    if (!this.monaco?.languages?.typescript) return;
    
    try {
      const uri = this.monaco.Uri.parse(`file:///${filePath.replace(/\\/g, '/')}`);
      const isJSX = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
      
      // Выбираем правильный сервис для TS или JS
      const tsService = filePath.endsWith('.ts') || filePath.endsWith('.tsx') 
        ? this.monaco.languages.typescript.typescriptDefaults 
        : this.monaco.languages.typescript.javascriptDefaults;
      
      // Регистрируем модель в TS сервисе
      tsService.addExtraLib(content, uri.toString());
      
      console.log(`TypeScript документ ${filePath} зарегистрирован в TS сервисе`);
    } catch (error) {
      console.error(`Ошибка при регистрации TypeScript документа ${filePath}:`, error);
    }
  }

  /**
   * Обработка изменения файла
   */
  public handleFileChange(filePath: string, content: string): void {
    if (!filePath) {
      console.warn('Не указан путь к файлу в handleFileChange');
      return;
    }

    try {
      console.log(`Обработка изменения файла: ${filePath}`);
      
      // Обновляем документ в менеджере документов
      lspDocumentManager.updateDocument(filePath, content);
      
      // Если это TypeScript файл, особая обработка для интеграции TS
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      if (fileExtension === 'ts' || fileExtension === 'tsx' || fileExtension === 'js' || fileExtension === 'jsx') {
        this.registerTypeScriptDocument(filePath, content);
      }
    } catch (error) {
      console.error(`Ошибка при обработке изменения файла ${filePath}:`, error);
    }
  }

  /**
   * Обработка закрытия файла
   */
  public handleFileClose(filePath: string): void {
    if (!filePath) {
      console.warn('Не указан путь к файлу в handleFileClose');
      return;
    }

    try {
      console.log(`Обработка закрытия файла: ${filePath}`);
      
      // Удаляем документ из менеджера документов
      lspDocumentManager.removeDocument(filePath);
    } catch (error) {
      console.error(`Ошибка при обработке закрытия файла ${filePath}:`, error);
    }
  }

  /**
   * Получение информации для подсказки при наведении
   */
  public async getHoverInfo(model: any, position: any): Promise<any> {
    if (!this.status.initialized || !model || !position) return null;
    
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
        // Проверяем, запущен ли сервер
        let isServerRunning = false;
        try {
          isServerRunning = await languageServerManager.isServerRunning(serverId);
        } catch (e) {
          console.warn(`Не удалось проверить статус сервера ${serverId}:`, e);
        }
        
        // Если сервер не запущен, попробуем запустить его
        if (!isServerRunning) {
          try {
            await languageServerManager.startServer(serverId);
            console.log(`Сервер ${serverId} запущен для получения hover-подсказок`);
          } catch (e) {
            console.warn(`Не удалось запустить сервер ${serverId}:`, e);
          }
        }
        
        // Теперь отправляем запрос
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
      
      // Для TypeScript файлов пытаемся получить информацию о типе через встроенный сервис
      if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(languageId) && this.monaco.languages.typescript) {
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
            
            // Если это идентификатор, выделим его
            if (word) {
              markdownContent += `**${word}**\n\n`;
            }
            
            // Добавляем тип
            if (typeText) {
              markdownContent += `\`\`\`typescript\n${typeText}\n\`\`\`\n\n`;
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
                }
              };
            }
          }
        } catch (e) {
          console.warn('Ошибка при получении информации о типе через TypeScript сервис:', e);
        }
      }
      
      // Если через TypeScript сервис не получилось, используем fallback
      if (this.hoverProvider) {
        const fallbackHover = this.hoverProvider.provideFallbackHover(word, languageId);
        if (fallbackHover) {
          return fallbackHover;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при получении hover информации:', error);
      return null;
    }
  }

  /**
   * Очистка ресурсов при уничтожении
   */
  public dispose(): void {
    try {
      console.log('Освобождение ресурсов LSP Wrapper...');
      
      // Освобождаем все disposables
      this.disposables.forEach(disposable => {
        try {
          disposable.dispose();
        } catch (e) {
          // Игнорируем ошибки при освобождении
        }
      });
      this.disposables = [];
      
      // Освобождаем документ-менеджер
      if (lspDocumentManager) {
        lspDocumentManager.dispose();
      }
      
      // Освобождаем менеджер диагностики
      if (monacoLSPDiagnostics) {
        monacoLSPDiagnostics.dispose();
      }
      
      // Освобождаем менеджер серверов
      if (languageServerManager) {
        languageServerManager.dispose();
      }
      
      this.monaco = null;
      this.editor = null;
      this.completionProvider = null;
      this.hoverProvider = null;
      this.status.initialized = false;
      this.status.connectedServers = [];
      
      console.log('Ресурсы LSP Wrapper успешно освобождены');
    } catch (error) {
      console.error('Ошибка при освобождении ресурсов LSP Wrapper:', error);
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const monacoLSPService = new MonacoLSPWrapper(); 