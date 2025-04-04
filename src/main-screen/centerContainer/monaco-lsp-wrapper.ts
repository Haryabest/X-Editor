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
    try {
      // Получаем глобальные Monaco и Editor
      if (!window.monaco) {
        console.error('Monaco не доступен при инициализации LSP.');
        return;
      }
      
      // Сохраняем ссылки на Monaco и Editor
      this.monaco = window.monaco;
      
      // Устанавливаем флаг инициализации
      this.initialized = true;
      this.status.initialized = true;
      
      // Регистрируем обработчики событий редактора
      this.registerEditorListeners();
      
      // Настраиваем TypeScript для начала
      this.configureTypeScript();
      
      // Создаем провайдеры
      this.createProviders();
      
      console.log('LSP соединение успешно инициализировано');
    } catch (error) {
      console.error('Ошибка при инициализации LSP:', error);
    }
  }

  private configureTypeScript(): void {
    try {
      // Проверяем наличие Monaco
      if (!this.monaco || !this.monaco.languages || !this.monaco.languages.typescript) {
        console.error('Monaco или TypeScript не инициализированы');
        return;
      }
      
      console.log('Настраиваем типы для TypeScript/React');
      
      // Регистрируем languageId для typescriptreact, если его нет
      if (!this.monaco.languages.getLanguages().some((lang: any) => lang.id === 'typescriptreact')) {
        this.monaco.languages.register({ id: 'typescriptreact' });
        console.log('Зарегистрирован язык typescriptreact');
      }
      
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
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useContext<T>(context: Context<T>): T;
          function useReducer<R extends Reducer<any, any>, I>(reducer: R, initializerArg: I, initializer?: (arg: I) => ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
          function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          function useMemo<T>(factory: () => T, deps: any[]): T;
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
            (props: ProviderProps<T>): ReactElement | null;
          }
          
          interface Consumer<T> {
            (props: ConsumerProps<T>): ReactElement | null;
          }
          
          interface ProviderProps<T> {
            value: T;
            children?: ReactNode;
          }
          
          interface ConsumerProps<T> {
            children: (value: T) => ReactNode;
          }
          
          type ReactNode = string | number | boolean | null | undefined | ReactElement | Array<ReactNode>;
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
      this.monaco.languages.registerCompletionItemProvider('typescriptreact', {
        triggerCharacters: ['<', '.', ':', '"', "'", '/', '@', '{'],
        provideCompletionItems: (model: any, position: any) => {
          console.log('TSX completion provider called', { position });
          
          const suggestions: any[] = [];
          
          // Создаем диапазон для автодополнения
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column
          };
          
          // Получаем текст перед курсором для определения контекста
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });
          
          // JSX элементы
          const isInJSXContext = /<[a-zA-Z]*$/.test(textUntilPosition) || 
                                /<[a-zA-Z]+\s+[^>]*$/.test(textUntilPosition);
          
          if (isInJSXContext) {
            const jsxElements = [
              'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'button', 'input', 'form', 'label', 'select', 'option',
              'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
              'img', 'a', 'nav', 'header', 'footer', 'main', 'section', 'article'
            ];

            jsxElements.forEach(element => {
              suggestions.push({
                label: element,
                kind: this.monaco.languages.CompletionItemKind.Snippet,
                insertText: element,
                detail: `<${element}></${element}>`,
                documentation: {
                  value: `**${element}**\n\nHTML элемент ${element}`
                },
                range
              });
            });
          }
          
          // React хуки - предлагаем, если текст начинается с 'use'
          const isHookContext = textUntilPosition.endsWith('use');
          
          if (isHookContext) {
            const hooks = [
              {
                label: 'useState',
                insertText: 'useState($0)',
                documentation: 'Хук для управления состоянием компонента'
              },
              {
                label: 'useEffect',
                insertText: 'useEffect(() => {\n\t$0\n}, [])',
                documentation: 'Хук для выполнения побочных эффектов'
              },
              {
                label: 'useContext',
                insertText: 'useContext($0)',
                documentation: 'Хук для доступа к контексту React'
              },
              {
                label: 'useRef',
                insertText: 'useRef($0)',
                documentation: 'Хук для создания мутабельной ссылки'
              }
            ];

            hooks.forEach(hook => {
              suggestions.push({
                label: hook.label,
                kind: this.monaco.languages.CompletionItemKind.Function,
                insertText: hook.insertText,
                insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: {
                  value: `**${hook.label}**\n\n${hook.documentation}`
                },
                range
              });
            });
          }
          
          // React атрибуты - предлагаем, если текст содержит тег и пробел
          const isAttributeContext = /<[a-zA-Z]+\s+[^>]*$/.test(textUntilPosition);
          
          if (isAttributeContext) {
            const attributes = [
              'className', 'style', 'onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus',
              'id', 'type', 'value', 'placeholder', 'href', 'src', 'alt', 'title',
              'disabled', 'required', 'readOnly', 'autoFocus', 'checked'
            ];
            
            attributes.forEach(attr => {
              suggestions.push({
                label: attr,
                kind: this.monaco.languages.CompletionItemKind.Property,
                insertText: attr === 'style' ? 'style={{$0}}' : `${attr}="$0"`,
                insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: {
                  value: `**${attr}**\n\nJSX атрибут ${attr}`
                },
                range
              });
            });
          }
          
          return { suggestions };
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
    console.log(`Подключение к серверу ${serverType}...`);
    
    let success = false;
    
    try {
      switch (serverType) {
        case 'typescript':
          if (this.languageClientMap.has('typescript')) {
            console.log('Соединение с typescript сервером уже установлено.');
            return true;
          }
          
          success = await languageServerManager.startServer('typescript');
          
          if (success) {
            this.languageClientMap.set('typescript', {
              connected: true,
              serverType: 'typescript',
              supportedLanguages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']
            });
            
            this.status.connectedServers.push('typescript');
            console.log('Успешное подключение к серверу typescript');
          }
          break;
          
        case 'python':
          if (this.languageClientMap.has('python')) {
            console.log('Соединение с python сервером уже установлено.');
            return true;
          }
          
          success = await languageServerManager.startServer('python');
          
          if (success) {
            this.languageClientMap.set('python', {
              connected: true,
              serverType: 'python',
              supportedLanguages: ['python']
            });
            
            this.status.connectedServers.push('python');
            console.log('Успешное подключение к серверу python');
          }
          break;
          
        default:
          console.warn(`Неизвестный тип сервера: ${serverType}`);
          break;
      }
      
      return success;
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
    try {
      if (!filePath) {
        console.error('Не указан путь к файлу в handleFileOpen');
        return;
      }
      
      console.log(`Обработка открытия файла: ${filePath}`);
      
      // Определяем тип файла
      const fileExtension = this.getFileExtension(filePath);
      let fileType = this.getLanguageFromExtension(fileExtension);
      
      // Если тип файла не определен, используем plaintext
      if (!fileType) {
        console.warn(`Неизвестный тип файла: ${fileExtension}, используется plaintext`);
        fileType = 'plaintext';
      }
      
      // Проверяем, есть ли серверы для этого типа файла
      const serverType = this.getServerForLanguage(fileType);
      console.log(`Для языка ${fileType} определен сервер: ${serverType || 'нет'}`);
      
      // Добавляем документ в менеджер документов LSP
      lspDocumentManager.addDocument(filePath, fileType, content);
      console.log(`Документ добавлен в LSP: ${filePath} (${fileType})`);
      
      // Специальная обработка для разных типов файлов
      if (fileType === 'typescript' || fileType === 'typescriptreact') {
        // Специальная обработка для TypeScript
        console.log(`Специальная обработка TypeScript файла ${filePath}`);
        this.registerTypeScriptDocument(filePath, content);
      } 
      // Обработка Python файлов
      else if (fileType === 'python' || fileExtension === 'py' || fileExtension === 'pyw' || fileExtension === 'pyi') {
        // Специальная обработка для Python
        console.log(`Специальная обработка Python файла ${filePath}`);
        
        // Регистрируем Python документ
        this.registerPythonDocument(filePath, content);
        
        // Загружаем Python LSP, если еще не загружен
        import('../../monaco-config/register-python').then(async module => {
          try {
            if (typeof (window as any).updatePythonDiagnostics !== 'function') {
              console.log('Python LSP еще не загружен, запускаем регистрацию...');
              if (typeof module.registerPython === 'function') {
                const result = module.registerPython();
                console.log(`Регистрация Python завершена с результатом: ${result}`);
              } else {
                console.warn('Функция registerPython не найдена в импортированном модуле');
              }
            }
            
            // Принудительно запускаем обновление диагностики через глобальную функцию
            // Используем увеличенную задержку и несколько повторных попыток
            const updateDiagnosticsWithRetry = async (retryCount = 0, maxRetries = 3) => {
              if (retryCount >= maxRetries) {
                console.warn(`Достигнуто максимальное количество попыток обновления диагностики для ${filePath}`);
                return;
              }
              
              try {
                if (typeof (window as any).updatePythonDiagnostics === 'function') {
                  console.log(`Запуск обновления диагностики для Python файла: ${filePath} (попытка ${retryCount + 1}/${maxRetries})`);
                  const result = await (window as any).updatePythonDiagnostics(filePath);
                  console.log(`Результат обновления диагностики: ${result}`);
                  
                  // Если обновление не удалось, пробуем еще раз через некоторое время
                  if (result && result.startsWith('error:')) {
                    setTimeout(() => updateDiagnosticsWithRetry(retryCount + 1, maxRetries), 2000);
                  }
                } else {
                  console.warn(`Функция updatePythonDiagnostics недоступна (попытка ${retryCount + 1}/${maxRetries})`);
                  
                  // Пробуем снова через 1,5 секунды
                  setTimeout(() => updateDiagnosticsWithRetry(retryCount + 1, maxRetries), 1500);
                }
              } catch (error) {
                console.error(`Ошибка при обновлении диагностики (попытка ${retryCount + 1}/${maxRetries}):`, error);
                
                // В случае ошибки тоже повторяем
                setTimeout(() => updateDiagnosticsWithRetry(retryCount + 1, maxRetries), 1500);
              }
            };
            
            // Запускаем процесс обновления с задержкой 2 секунды
            setTimeout(() => updateDiagnosticsWithRetry(), 2000);
          } catch (error) {
            console.error('Ошибка при обработке Python LSP:', error);
          }
        }).catch(error => {
          console.error('Ошибка при импорте модуля register-python:', error);
        });
      }
      // Общая обработка для других типов файлов
      else if (serverType) {
        // Подключаемся к предопределенному серверу для этого типа файла
        this.connectToPredefinedServer(serverType)
          .then(success => {
            if (success) {
              console.log(`Успешное подключение к серверу ${serverType} для файла ${filePath}`);
            } else {
              console.warn(`Не удалось подключиться к серверу ${serverType} для файла ${filePath}`);
            }
          })
          .catch(error => {
            console.error(`Ошибка при подключении к серверу ${serverType}:`, error);
          });
      }
      
      // Устанавливаем язык модели, если есть Monaco и модель
      if (window.monaco) {
        try {
          // Находим или создаем модель для этого файла и устанавливаем язык
          let model = null;
          const models = window.monaco.editor.getModels();
          
          // Сначала ищем существующую модель
          for (const m of models) {
            try {
              const modelUri = m.uri.toString();
              if (modelUri.includes(filePath) || 
                  filePath.includes(modelUri.replace('file://', ''))) {
                model = m;
                break;
              }
            } catch (e) {
              console.warn(`Ошибка при проверке модели для ${filePath}:`, e);
            }
          }
          
          // Если модель не найдена, пытаемся создать новую
          if (!model) {
            try {
              const uri = window.monaco.Uri.file(filePath);
              model = window.monaco.editor.createModel(content, fileType, uri);
              console.log(`Создана новая модель для ${filePath} с языком ${fileType}`);
            } catch (e) {
              console.warn(`Ошибка при создании модели для ${filePath}:`, e);
            }
          }
          
          // Устанавливаем язык модели если модель найдена
          if (model) {
            try {
              // Обновляем язык модели
              window.monaco.editor.setModelLanguage(model, fileType);
              console.log(`Установлен язык модели ${fileType} для ${filePath}`);
              
              // Если это Python, дополнительно обновляем модель
              if (fileType === 'python') {
                model.setValue(content);
                console.log(`Обновлено содержимое Python модели для ${filePath}`);
              }
            } catch (e) {
              console.warn(`Ошибка при установке языка модели для ${filePath}:`, e);
            }
          }
        } catch (error) {
          console.error(`Ошибка при установке языка для ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Ошибка при обработке открытия файла ${filePath}:`, error);
    }
  }
  
  // Метод для регистрации Python документа
  private registerPythonDocument(filePath: string, content: string): void {
    try {
      console.log(`Регистрация Python документа: ${filePath}`);
      
      // Убедимся, что документ зарегистрирован с правильным языком
      const documentInfo = lspDocumentManager.getDocument(filePath);
      if (!documentInfo) {
        lspDocumentManager.addDocument(filePath, 'python', content);
      }
      
      // Проверяем, подключен ли Python LSP сервер
      const pythonServerConnected = this.isPythonServerConnected();
      
      if (!pythonServerConnected) {
        // Подключаемся к серверу Python
        this.connectToPredefinedServer('python').then(success => {
          if (success) {
            console.log(`Успешное подключение к серверу Python для файла ${filePath}`);
            
            // Запускаем проверку ошибок Python для конкретного файла
            setTimeout(() => {
              if (window.updatePythonDiagnostics) {
                window.updatePythonDiagnostics(filePath);
              }
            }, 1000);
          } else {
            console.warn(`Не удалось подключиться к серверу Python для файла ${filePath}`);
          }
        }).catch(error => {
          console.error(`Ошибка при подключении к серверу Python: ${error.message || error}`);
        });
      } else {
        console.log('Python LSP сервер уже подключен');
        
        // Запускаем проверку ошибок Python для конкретного файла
        setTimeout(() => {
          if (window.updatePythonDiagnostics) {
            window.updatePythonDiagnostics(filePath);
          }
        }, 500);
      }
      
      // Если Monaco и Editor доступны, регистрируем модель
      if (this.monaco && this.editor) {
        // Проверяем, есть ли модель для этого файла в редакторе
        const models = this.monaco.editor.getModels();
        let pythonModel = null;
        
        for (const model of models) {
          try {
            const modelUri = model.uri.toString();
            if (modelUri.includes(filePath) || 
                filePath.includes(modelUri.replace('file://', ''))) {
              pythonModel = model;
              
              // Убедимся, что язык модели установлен как 'python'
              if (this.monaco.editor.getModelLanguage(model) !== 'python') {
                this.monaco.editor.setModelLanguage(model, 'python');
                console.log(`Язык модели для ${filePath} установлен как python`);
              }
              
              break;
            }
          } catch (e) {
            console.warn(`Ошибка при проверке модели для ${filePath}:`, e);
          }
        }
        
        // Если модель не найдена, пробуем создать ее
        if (!pythonModel && this.monaco.editor.createModel) {
          try {
            console.log(`Попытка создания модели для ${filePath}`);
            const uri = this.monaco.Uri.file(filePath);
            pythonModel = this.monaco.editor.createModel(content, 'python', uri);
            console.log(`Модель для ${filePath} успешно создана`);
          } catch (e) {
            console.warn(`Ошибка при создании модели для ${filePath}:`, e);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при регистрации Python документа:', error);
    }
  }
  
  // Проверка, подключен ли Python LSP сервер
  private isPythonServerConnected(): boolean {
    return this.languageClientMap.has('python') && 
           this.status.connectedServers.includes('python');
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
    try {
      if (!filePath) {
        console.error('Не указан путь к файлу в handleFileChange');
        return;
      }
      
      console.log(`Обработка изменения файла: ${filePath}`);
      
      try {
        // Проверяем, существует ли документ в менеджере документов
        const fileUri = filePath;
        const documentInfo = lspDocumentManager.getDocument(fileUri);
        
        if (!documentInfo) {
          // Если документа нет, добавляем его как при открытии
          console.log(`Документ не найден в LSP, обрабатываем как открытие: ${filePath}`);
          this.handleFileOpen(filePath, content);
          return;
        }
        
        // Определяем тип файла
        const fileExtension = this.getFileExtension(filePath);
        const fileType = this.getLanguageFromExtension(fileExtension) || 'plaintext';
        
        // Обновляем документ через удаление и добавление
        lspDocumentManager.removeDocument(fileUri);
        lspDocumentManager.addDocument(fileUri, fileType, content);
        console.log(`Документ обновлен в LSP: ${fileUri} (${fileType})`);
        
        // Если это Python файл, выполняем дополнительные действия
        const isPythonFile = fileType === 'python' || 
                            filePath.endsWith('.py') || 
                            filePath.endsWith('.pyw') || 
                            filePath.endsWith('.pyi');
        
        if (isPythonFile) {
          console.log(`Обновление Python файла: ${filePath}`);
          
          // Обновляем модель в Monaco, если она существует
          try {
            if (window.monaco) {
              const models = window.monaco.editor.getModels();
              let model = null;
              
              // Ищем модель для этого файла
              for (const m of models) {
                try {
                  const modelUri = m.uri.toString();
                  if (modelUri.includes(filePath) || 
                      filePath.includes(modelUri.replace('file://', ''))) {
                    model = m;
                    break;
                  }
                } catch (e) {
                  console.warn(`Ошибка при проверке модели для ${filePath}:`, e);
                }
              }
              
              // Если модель найдена, обновляем её содержимое
              if (model) {
                // Используем операцию замены всего текста для обновления содержимого
                try {
                  const oldText = model.getValue();
                  if (oldText !== content) {
                    model.setValue(content);
                    console.log(`Обновлено содержимое модели Python для ${filePath}`);
                  } else {
                    console.log(`Содержимое модели не изменилось для ${filePath}`);
                  }
                } catch (e) {
                  console.warn(`Ошибка при обновлении содержимого модели:`, e);
                }
              } else {
                console.log(`Модель для файла ${filePath} не найдена, пропускаем обновление`);
              }
            }
          } catch (modelErr) {
            console.warn(`Ошибка при работе с моделью Monaco:`, modelErr);
          }
          
          // Запускаем обновление диагностики Python для этого файла
          const updatePythonDiagnosticsForFile = async () => {
            try {
              if (typeof (window as any).updatePythonDiagnostics === 'function') {
                console.log(`Запуск обновления диагностики для измененного Python файла: ${filePath}`);
                const result = await (window as any).updatePythonDiagnostics(filePath);
                console.log(`Результат обновления диагностики для измененного файла: ${result}`);
              } else {
                console.warn('Функция updatePythonDiagnostics недоступна для обновления после изменения');
                
                // Если функция не найдена, пробуем загрузить модуль Python
                import('../../monaco-config/register-python').then(module => {
                  if (typeof module.registerPython === 'function') {
                    console.log('Регистрация Python для обработки изменений...');
                    module.registerPython();
                    
                    // Пробуем снова после регистрации
                    setTimeout(() => {
                      if (typeof (window as any).updatePythonDiagnostics === 'function') {
                        (window as any).updatePythonDiagnostics(filePath);
                      }
                    }, 1000);
                  }
                }).catch(error => {
                  console.error('Ошибка при импорте register-python:', error);
                });
              }
            } catch (error) {
              console.error('Ошибка при обновлении диагностики Python:', error);
            }
          };
          
          // Запускаем обновление диагностики с небольшой задержкой
          setTimeout(updatePythonDiagnosticsForFile, 500);
        } else {
          // Обработка для других типов файлов
          
          // Получаем серверы для этого типа файла
          const serverType = this.getServerForLanguage(fileType);
          
          if (serverType) {
            // Если сервер существует, отправляем ему уведомление об изменении
            try {
              // Проверяем, запущен ли сервер
              const isServerRunning = this.isServerConnected(serverType);
              
              if (isServerRunning) {
                console.log(`Отправка уведомления об изменении серверу ${serverType} для ${filePath}`);
                
                // В реальной реализации здесь будет отправка уведомления серверу
              } else {
                console.log(`Сервер ${serverType} не запущен для файла ${filePath}`);
              }
            } catch (e) {
              console.warn(`Ошибка при отправке уведомления серверу ${serverType}:`, e);
            }
          }
        }
      } catch (error) {
        console.error(`Ошибка при обработке изменения файла ${filePath}:`, error);
      }
    } catch (error) {
      console.error(`Необработанная ошибка в handleFileChange: ${error}`);
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

  // Получить расширение файла из пути
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filePath.slice(lastDotIndex + 1).toLowerCase();
  }
  
  // Определить язык по расширению файла
  private getLanguageFromExtension(extension: string): string | null {
    const extensionMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'py': 'python',
      'pyw': 'python',
      'pyi': 'python'
    };
    
    return extensionMap[extension] || null;
  }
  
  /**
   * Получение типа сервера для языка
   */
  private getServerForLanguage(languageId: string): string | null {
    try {
      // Карта соответствия языков и серверов
      const languageToServer: Record<string, string> = {
        'typescript': 'typescript',
        'typescriptreact': 'typescript',
        'javascript': 'typescript',
        'javascriptreact': 'typescript',
        'python': 'python',
        'html': 'html',
        'css': 'css',
        'scss': 'css',
        'less': 'css',
        'json': 'json'
      };
      
      return languageToServer[languageId] || null;
    } catch (error) {
      console.error(`Ошибка при определении сервера для языка ${languageId}:`, error);
      return null;
    }
  }

  // Метод для установки редактора после его создания
  public setEditor(editor: any): void {
    if (!editor) {
      console.warn('Попытка установить несуществующий редактор в LSP клиент');
      return;
    }
    
    try {
      this.editor = editor;
      console.log('Редактор Monaco успешно установлен в LSP клиент');
      
      // Если редактор изменился, обновляем слушатели событий
      this.registerEditorListeners();
      
      // Обновляем модели для всех открытых документов
      if (lspDocumentManager) {
        try {
          const uris = lspDocumentManager.getAllDocumentUris();
          if (uris && uris.length > 0) {
            console.log(`Обновление моделей для ${uris.length} открытых документов...`);
            
            // Устанавливаем языки моделей
            const models = this.monaco.editor.getModels();
            if (models && models.length > 0) {
              models.forEach(model => {
                try {
                  const modelUri = model.uri.toString();
                  const matchingUri = uris.find(uri => 
                    uri === modelUri || 
                    modelUri.includes(uri) || 
                    uri.includes(modelUri.replace('file://', ''))
                  );
                  
                  if (matchingUri) {
                    const doc = lspDocumentManager.getDocument(matchingUri);
                    if (doc && doc.languageId) {
                      this.monaco.editor.setModelLanguage(model, doc.languageId);
                      console.log(`Установлен язык ${doc.languageId} для модели ${modelUri}`);
                    }
                  }
                } catch (e) {
                  console.warn('Ошибка при обновлении модели:', e);
                }
              });
            }
          }
        } catch (error) {
          console.error('Ошибка при обновлении моделей:', error);
        }
      }
    } catch (error) {
      console.error('Ошибка при установке редактора в LSP клиент:', error);
    }
  }

  /**
   * Создание стандартных провайдеров для LSP
   */
  private createProviders(): void {
    try {
      // Проверяем доступность Monaco
      if (!this.monaco) {
        console.warn('Monaco не доступен при создании провайдеров');
        return;
      }
      
      // Создаем провайдеры завершения для поддерживаемых языков
      this.registerCompletionProvider('typescript');
      this.registerCompletionProvider('javascript');
      this.registerCompletionProvider('python');
      this.registerCompletionProvider('html');
      this.registerCompletionProvider('css');
      
      // Создаем провайдеры hover для поддерживаемых языков
      this.registerHoverProvider('typescript');
      this.registerHoverProvider('javascript');
      this.registerHoverProvider('python');
      this.registerHoverProvider('html');
      this.registerHoverProvider('css');
      
      console.log('Все провайдеры успешно зарегистрированы');
    } catch (error) {
      console.error('Ошибка при создании провайдеров:', error);
    }
  }
  
  /**
   * Регистрация провайдера автодополнений для языка
   */
  private registerCompletionProvider(languageId: string): void {
    try {
      if (!this.monaco) return;
      
      // Регистрируем провайдер автодополнений
      const disposable = this.monaco.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: async (model, position) => {
          try {
            // Получаем URI модели
            const uri = model.uri.toString();
            
            // Проверяем, подключен ли нужный сервер
            const serverType = this.getServerForLanguage(languageId);
            if (!serverType || !this.isServerConnected(serverType)) {
              console.log(`Сервер для языка ${languageId} не подключен, используем базовые автодополнения`);
              return this.getBasicCompletionItems(languageId);
            }
            
            // Получаем текущую строку текста
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });
            
            // Формируем запрос автодополнения для LSP сервера
            const response = await languageServerManager.sendRequest(serverType, 'textDocument/completion', {
              textDocument: { uri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1
              },
              context: {
                triggerKind: 1, // Invoke
                triggerCharacter: this.getLastTriggerCharacter(textUntilPosition)
              }
            });
            
            // Если получен ответ от сервера, преобразуем его в формат Monaco
            if (response && response.items) {
              return {
                suggestions: this.convertCompletionItems(response.items, languageId)
              };
            }
            
            // Если от сервера нет ответа, возвращаем базовые подсказки
            return this.getBasicCompletionItems(languageId);
          } catch (error) {
            console.error(`Ошибка при получении автодополнений для ${languageId}:`, error);
            return { suggestions: [] };
          }
        }
      });
      
      // Сохраняем disposable для последующей очистки
      this.disposables.push(disposable);
      console.log(`Провайдер автодополнений для ${languageId} зарегистрирован`);
    } catch (error) {
      console.error(`Ошибка при регистрации провайдера автодополнений для ${languageId}:`, error);
    }
  }
  
  /**
   * Получение базовых автодополнений для языка
   */
  private getBasicCompletionItems(languageId: string): { suggestions: any[] } {
    const suggestions: any[] = [];
    
    // Базовые предложения для разных языков
    if (languageId === 'python') {
      const pythonKeywords = [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
        'def', 'del', 'elif', 'else', 'except', 'exec', 'finally', 'for', 'from',
        'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
        'pass', 'print', 'raise', 'return', 'try', 'while', 'with', 'yield',
        'match', 'case', 'True', 'False', 'None'
      ];
      
      for (const keyword of pythonKeywords) {
        suggestions.push({
          label: keyword,
          kind: this.monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          detail: 'Python keyword'
        });
      }
    } else if (languageId === 'typescript' || languageId === 'javascript') {
      const jsKeywords = [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
        'new', 'null', 'return', 'super', 'switch', 'this', 'throw',
        'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        'let', 'static', 'enum', 'await', 'async'
      ];
      
      for (const keyword of jsKeywords) {
        suggestions.push({
          label: keyword,
          kind: this.monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          detail: 'JavaScript/TypeScript keyword'
        });
      }
    }
    
    return { suggestions };
  }
  
  /**
   * Получение последнего символа-триггера
   */
  private getLastTriggerCharacter(text: string): string | undefined {
    const triggerChars = ['.', ':', '<', '"', '=', '/', '@'];
    for (let i = text.length - 1; i >= 0; i--) {
      if (triggerChars.includes(text[i])) {
        return text[i];
      }
    }
    return undefined;
  }
  
  /**
   * Преобразование элементов автодополнения из формата LSP в формат Monaco
   */
  private convertCompletionItems(items: any[], languageId: string): any[] {
    try {
      if (!this.monaco || !items || !Array.isArray(items)) {
        return [];
      }
      
      return items.map(item => {
        try {
          // Базовые поля
          const result: any = {
            label: item.label,
            kind: this.convertCompletionItemKind(item.kind),
            detail: item.detail || undefined,
            documentation: item.documentation 
              ? (typeof item.documentation === 'string' 
                 ? item.documentation 
                 : item.documentation.value)
              : undefined,
            insertText: item.insertText || item.label,
            sortText: item.sortText,
            filterText: item.filterText
          };
          
          // Вставляемый фрагмент
          if (item.insertTextFormat === 2) { // Snippet
            result.insertTextRules = this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          }
          
          // Дополнительные действия
          if (item.command) {
            result.command = {
              id: item.command.command,
              title: item.command.title,
              arguments: item.command.arguments
            };
          }
          
          return result;
        } catch (e) {
          console.warn('Ошибка при преобразовании элемента автодополнения:', e);
          return {
            label: item.label || 'Неизвестный элемент',
            kind: this.monaco.languages.CompletionItemKind.Text
          };
        }
      });
    } catch (error) {
      console.error('Ошибка при преобразовании элементов автодополнения:', error);
      return [];
    }
  }
  
  /**
   * Преобразование типа элемента автодополнения из формата LSP в формат Monaco
   */
  private convertCompletionItemKind(kind: number): any {
    try {
      // По умолчанию - текст
      if (!kind || !this.monaco) {
        return this.monaco.languages.CompletionItemKind.Text;
      }
      
      // Соответствие типов LSP и Monaco
      const kindMap: Record<number, number> = {
        1: this.monaco.languages.CompletionItemKind.Text,
        2: this.monaco.languages.CompletionItemKind.Method,
        3: this.monaco.languages.CompletionItemKind.Function,
        4: this.monaco.languages.CompletionItemKind.Constructor,
        5: this.monaco.languages.CompletionItemKind.Field,
        6: this.monaco.languages.CompletionItemKind.Variable,
        7: this.monaco.languages.CompletionItemKind.Class,
        8: this.monaco.languages.CompletionItemKind.Interface,
        9: this.monaco.languages.CompletionItemKind.Module,
        10: this.monaco.languages.CompletionItemKind.Property,
        11: this.monaco.languages.CompletionItemKind.Unit,
        12: this.monaco.languages.CompletionItemKind.Value,
        13: this.monaco.languages.CompletionItemKind.Enum,
        14: this.monaco.languages.CompletionItemKind.Keyword,
        15: this.monaco.languages.CompletionItemKind.Snippet,
        16: this.monaco.languages.CompletionItemKind.Color,
        17: this.monaco.languages.CompletionItemKind.File,
        18: this.monaco.languages.CompletionItemKind.Reference,
        19: this.monaco.languages.CompletionItemKind.Folder,
        20: this.monaco.languages.CompletionItemKind.EnumMember,
        21: this.monaco.languages.CompletionItemKind.Constant,
        22: this.monaco.languages.CompletionItemKind.Struct,
        23: this.monaco.languages.CompletionItemKind.Event,
        24: this.monaco.languages.CompletionItemKind.Operator,
        25: this.monaco.languages.CompletionItemKind.TypeParameter
      };
      
      return kindMap[kind] || this.monaco.languages.CompletionItemKind.Text;
    } catch (error) {
      console.error('Ошибка при преобразовании типа элемента автодополнения:', error);
      if (this.monaco) {
        return this.monaco.languages.CompletionItemKind.Text;
      }
      return 1; // Text kind
    }
  }
  
  /**
   * Регистрация провайдера hover для языка
   */
  private registerHoverProvider(languageId: string): void {
    try {
      if (!this.monaco) return;
      
      // Регистрируем провайдер hover
      const disposable = this.monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (model, position) => {
          try {
            // Получаем URI модели
            const uri = model.uri.toString();
            
            // Проверяем, подключен ли нужный сервер
            const serverType = this.getServerForLanguage(languageId);
            if (!serverType || !this.isServerConnected(serverType)) {
              console.log(`Сервер для языка ${languageId} не подключен, используем базовый hover`);
              return this.getBasicHoverContent(model, position, languageId);
            }
            
            // Формируем запрос hover для LSP сервера
            const response = await languageServerManager.sendRequest(serverType, 'textDocument/hover', {
              textDocument: { uri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1
              }
            });
            
            // Если получен ответ от сервера, преобразуем его в формат Monaco
            if (response && response.contents) {
              return this.convertHoverContent(response, position);
            }
            
            // Если от сервера нет ответа, возвращаем базовую подсказку
            return this.getBasicHoverContent(model, position, languageId);
          } catch (error) {
            console.error(`Ошибка при получении hover для ${languageId}:`, error);
            return null;
          }
        }
      });
      
      // Сохраняем disposable для последующей очистки
      this.disposables.push(disposable);
      console.log(`Провайдер hover для ${languageId} зарегистрирован`);
    } catch (error) {
      console.error(`Ошибка при регистрации провайдера hover для ${languageId}:`, error);
    }
  }
  
  /**
   * Получение базового содержимого hover для языка
   */
  private getBasicHoverContent(model: any, position: any, languageId: string): any {
    try {
      // Получаем слово под курсором
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) {
        return null;
      }
      
      // Получаем текст строки
      const lineContent = model.getLineContent(position.lineNumber);
      
      // Формируем базовую информацию в зависимости от языка
      let content = `**${wordInfo.word}**\n\n`;
      
      if (languageId === 'python') {
        content += `Python identifier\n\nLine: ${position.lineNumber}\nColumn: ${position.column}`;
        
        // Определяем контекст
        if (lineContent.includes('def ' + wordInfo.word)) {
          content = `**${wordInfo.word}**\n\nFunction definition`;
        } else if (lineContent.includes('class ' + wordInfo.word)) {
          content = `**${wordInfo.word}**\n\nClass definition`;
        } else if (lineContent.match(new RegExp(`\\b${wordInfo.word}\\s*=`))) {
          content = `**${wordInfo.word}**\n\nVariable assignment`;
        }
      } else if (languageId === 'typescript' || languageId === 'javascript') {
        content += `TypeScript/JavaScript identifier\n\nLine: ${position.lineNumber}\nColumn: ${position.column}`;
        
        // Определяем контекст
        if (lineContent.includes('function ' + wordInfo.word)) {
          content = `**${wordInfo.word}**\n\nFunction definition`;
        } else if (lineContent.includes('class ' + wordInfo.word)) {
          content = `**${wordInfo.word}**\n\nClass definition`;
        } else if (lineContent.match(new RegExp(`\\b(const|let|var)\\s+${wordInfo.word}`))) {
          content = `**${wordInfo.word}**\n\nVariable declaration`;
        }
      }
      
      return {
        contents: [
          { value: content }
        ],
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn
        }
      };
    } catch (error) {
      console.error('Ошибка при получении базового hover содержимого:', error);
      return null;
    }
  }
  
  /**
   * Преобразование содержимого hover из формата LSP в формат Monaco
   */
  private convertHoverContent(response: any, position: any): any {
    try {
      let value = '';
      
      // Обрабатываем различные форматы содержимого
      if (typeof response.contents === 'string') {
        value = response.contents;
      } else if (response.contents.kind === 'markdown' || response.contents.kind === 'plaintext') {
        value = response.contents.value;
      } else if (Array.isArray(response.contents)) {
        // Объединяем массив содержимого
        value = response.contents.map((content: any) => {
          if (typeof content === 'string') {
            return content;
          } else if (content.value) {
            return content.value;
          }
          return '';
        }).join('\n\n');
      } else if (response.contents.value) {
        value = response.contents.value;
      }
      
      // Формируем диапазон, если он указан
      let range = undefined;
      if (response.range) {
        range = {
          startLineNumber: response.range.start.line + 1,
          startColumn: response.range.start.character + 1,
          endLineNumber: response.range.end.line + 1,
          endColumn: response.range.end.character + 1
        };
      }
      
      return {
        contents: [
          { value }
        ],
        range
      };
    } catch (error) {
      console.error('Ошибка при преобразовании hover содержимого:', error);
      return null;
    }
  }
  
  /**
   * Проверка, подключен ли сервер
   */
  private isServerConnected(serverType: string): boolean {
    try {
      return this.languageClientMap.has(serverType) && 
             this.status.connectedServers.includes(serverType);
    } catch (error) {
      console.error(`Ошибка при проверке подключения сервера ${serverType}:`, error);
      return false;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const monacoLSPService = new MonacoLSPWrapper();