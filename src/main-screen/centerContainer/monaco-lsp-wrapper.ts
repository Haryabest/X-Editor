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
  private initialized: boolean = false;

  /**
   * Инициализация LSP интеграции
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('MonacoLSPWrapper уже инициализирован');
      return;
    }

    try {
      // Проверяем наличие необходимых компонентов
      if (!this.monaco || !this.editor) {
        console.error('Monaco или editor не определены');
        return;
      }

      // Инициализируем менеджер языковых серверов
      if (languageServerManager) {
        await languageServerManager.initialize();
      }

      // Настраиваем TypeScript и TSX
      this.configureTypeScript();

      // Регистрируем слушатели редактора
      this.registerEditorListeners();

      this.initialized = true;
      console.log('MonacoLSPWrapper успешно инициализирован');
    } catch (error) {
      console.error('Ошибка при инициализации MonacoLSPWrapper:', error);
      throw error;
    }
  }

  private configureTypeScript(): void {
    try {
      // Импортируем и вызываем нашу конфигурацию TypeScript
      import('../../monaco-config/typescript-config').then(({ configureTypeScript }) => {
        console.log('Импортирован модуль typescript-config');
        configureTypeScript(this.monaco);
      }).catch(error => {
        console.error('Ошибка при импорте typescript-config:', error);
      });
      
      // Настраиваем компилятор TypeScript
      this.monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: this.monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: this.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: this.monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: this.monaco.languages.typescript.JsxEmit.React,
        reactNamespace: "React",
        allowJs: true,
        typeRoots: ["node_modules/@types"]
      });

      // Настраиваем диагностику
      this.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false
      });

      // Добавляем определения для React
      this.monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
        declare namespace JSX {
          interface Element {}
          interface IntrinsicElements {
            [elemName: string]: any;
          }
        }
        `,
        'file:///node_modules/@types/react/index.d.ts'
      );
      
      // Настраиваем автодополнение для TSX
      this.monaco.languages.registerCompletionItemProvider('typescriptreact', {
        provideCompletionItems: (model: any, position: any) => {
          console.log('TSX completion provider called в monaco-lsp-wrapper', { position });
          
          const suggestions: any[] = [];
          
          // Создаем диапазон для автодополнения
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column
          };
          
          // Добавляем базовые JSX элементы
          const jsxElements = [
            'div', 'span', 'p', 'h1', 'h2', 'h3', 'button', 'input', 'form'
          ];

          jsxElements.forEach(element => {
            suggestions.push({
              label: element,
              kind: this.monaco.languages.CompletionItemKind.Snippet,
              insertText: `<${element}$0></${element}>`,
              insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: {
                value: `**${element}**\n\nHTML элемент ${element}`
              },
              range
            });
          });
          
          // Добавляем React хуки
          const hooks = [
            {
              label: 'useState',
              insertText: 'const [${1:state}, set${1:State}] = useState(${2:initialValue});',
              documentation: 'Хук для управления состоянием компонента'
            },
            {
              label: 'useEffect',
              insertText: 'useEffect(() => {\n\t${1:effect}\n}, [${2:dependencies}]);',
              documentation: 'Хук для выполнения побочных эффектов'
            }
          ];

          hooks.forEach(hook => {
            suggestions.push({
              label: hook.label,
              kind: this.monaco.languages.CompletionItemKind.Snippet,
              insertText: hook.insertText,
              insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: {
                value: `**${hook.label}**\n\n${hook.documentation}`
              },
              range
            });
          });
          
          return { suggestions };
        }
      });

      // Настраиваем правила токенизации для TSX
      this.monaco.languages.setMonarchTokensProvider('typescriptreact', {
        defaultToken: '',
        tokenPostfix: '.tsx',
        ignoreCase: true,
        brackets: [
          { open: '{', close: '}', token: 'delimiter.curly' },
          { open: '[', close: ']', token: 'delimiter.square' },
          { open: '(', close: ')', token: 'delimiter.parenthesis' },
          { open: '<', close: '>', token: 'delimiter.angle' }
        ],
        keywords: [
          'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'constructor',
          'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export',
          'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
          'import', 'in', 'instanceof', 'interface', 'let', 'module', 'new', 'null', 'of',
          'package', 'private', 'protected', 'public', 'return', 'set', 'static', 'super',
          'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'var', 'void', 'while',
          'with', 'yield'
        ],
        operators: [
          '=', '>', '<', '!', '~', '?', ':',
          '==', '<=', '>=', '!=', '&&', '||', '++', '--',
          '+', '-', '*', '/', '&', '|', '^', '%', '<<',
          '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
          '^=', '%=', '<<=', '>>=', '>>>='
        ],
        symbols: /[=><!~?:&|+\-*\/\^%]+/,
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
        tokenizer: {
          root: [
            // Идентификаторы и ключевые слова
            [/[a-zA-Z_$][\w$]*/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            // Пробелы
            { include: '@whitespace' },
            // JSX
            [/<[^>]*>/, { cases: { '@eos': { token: 'delimiter.angle' }, '@default': 'delimiter.angle' } }],
            // Числа
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/\d+/, 'number'],
            // Разделители и операторы
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }],
            // Строки
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string_double'],
            [/'/, 'string', '@string_single'],
            // Комментарии
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment']
          ],
          whitespace: [
            [/\s+/, 'white']
          ],
          comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
          ],
          string_double: [
            [/[^\\"]+/, 'string'],
            [/"/, 'string', '@pop'],
            [/\\$/, 'string'],
            [/\\/, 'string.escape']
          ],
          string_single: [
            [/[^\\']+/, 'string'],
            [/'/, 'string', '@pop'],
            [/\\$/, 'string'],
            [/\\/, 'string.escape']
          ]
        }
      });

      console.log('TypeScript и TSX настроены успешно');
    } catch (error) {
      console.error('Ошибка при настройке TypeScript:', error);
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
      }
      
      // Регистрируем провайдер подсказок при наведении
      if (this.hoverProvider) {
        this.hoverProvider.registerHoverProvider(languageId);
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
    if (this.completionProvider) {
      this.completionProvider.dispose();
    }
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
}

// Создаем и экспортируем экземпляр сервиса
export const monacoLSPService = new MonacoLSPWrapper(); 