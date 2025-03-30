/**
 * Загрузчик типов TypeScript для Monaco Editor.
 * Регистрирует основные типы и настройки для TypeScript файлов.
 */

// @ts-nocheck

// Базовые типы для React и TypeScript
const REACT_TYPES = `
interface PromiseLike<T> {
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
}

interface Promise<T> {
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

interface ImportMeta {
    url: string;
    env: Record<string, any>;
    hot?: {
        accept: (callback?: (module: any) => void) => void;
        dispose: (callback: (data: any) => void) => void;
    };
}

declare namespace React {
    type FC<P = {}> = FunctionComponent<P>;
    interface FunctionComponent<P = {}> {
        (props: P & { children?: React.ReactNode }): React.ReactElement | null;
    }
    type ReactNode = ReactElement | string | number | Iterable<ReactNode> | ReactPortal | boolean | null | undefined;
    interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
        type: T;
        props: P;
        key: Key | null;
    }
    type JSXElementConstructor<P> = ((props: P) => ReactElement | null) | (new (props: P) => Component<P, any>);
    type Key = string | number;
    interface ReactPortal extends ReactElement {
        key: Key | null;
        children: ReactNode;
    }
    
    class Component<P = {}, S = {}, SS = any> {
        constructor(props: P);
        setState(state: S | ((prevState: S, props: P) => S), callback?: () => void): void;
        forceUpdate(callBack?: () => void): void;
        render(): ReactNode;
        readonly props: Readonly<P>;
        state: Readonly<S>;
        context: any;
    }
    
    function createElement(type: "div", props?: any): ReactElement;
    function createElement(type: "span", props?: any): ReactElement;
    function createElement(type: "button", props?: any): ReactElement;
    function createElement(type: "input", props?: any): ReactElement;
    function createElement(type: "form", props?: any): ReactElement;
    function createElement(type: any, props?: any, ...children: ReactNode[]): ReactElement;
    
    function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
    function useEffect(effect: () => (void | (() => void)), deps?: ReadonlyArray<any>): void;
    function useContext<T>(context: Context<T>): T;
    function useReducer<R extends Reducer<any, any>, I>(
        reducer: R,
        initialArg: I,
        init?: (arg: I) => ReducerState<R>
    ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<any>): T;
    function useMemo<T>(factory: () => T, deps: ReadonlyArray<any> | undefined): T;
    function useRef<T>(initialValue: T): MutableRefObject<T>;
    function useRef<T>(initialValue: T | null): RefObject<T>;
    
    interface MutableRefObject<T> {
        current: T;
    }
    interface RefObject<T> {
        readonly current: T | null;
    }
    interface Reducer<S, A> {
        (prevState: S, action: A): S;
    }
    type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
    type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
    type Dispatch<A> = (value: A) => void;
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
}

declare namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface ElementClass extends React.Component<any> {
        render(): React.ReactNode;
    }
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    interface IntrinsicAttributes extends React.Attributes { }
    
    interface IntrinsicElements {
        div: any;
        span: any;
        button: any;
        input: any;
        form: any;
        a: any;
        p: any;
        h1: any;
        h2: any;
        h3: any;
        h4: any;
        h5: any;
        h6: any;
        ul: any;
        li: any;
        img: any;
        [elemName: string]: any;
    }
}

declare module "react" {
    export = React;
}

declare module "react-dom" {
    function render(element: React.ReactElement, container: Element): void;
    function unmountComponentAtNode(container: Element): boolean;
    const version: string;
    
    namespace render {}
    namespace unmountComponentAtNode {}
}
`;

/**
 * Исправляет обработку TypeScript для VSCode Monaco
 * @param monaco Инстанс Monaco Editor
 */
function fixTSXHandling(monaco: any): void {
  if (!monaco?.languages?.typescript) return;
  
  try {
    // Исправление для TSX файлов
    monaco.languages.typescript.typescriptDefaults.setExtraLibs([
      {
        content: `
          // Дополнительные определения для TSX
          declare namespace JSX {
            interface Element {}
            interface ElementClass {
              render(): any;
            }
            interface ElementAttributesProperty {
              props: any;
            }
            interface ElementChildrenAttribute {
              children: any;
            }
            interface IntrinsicElements {
              div: any;
              span: any;
              button: any;
              input: any;
              textarea: any;
              select: any;
              option: any;
              p: any;
              h1: any;
              h2: any;
              h3: any;
              h4: any;
              h5: any;
              h6: any;
              a: any;
              img: any;
              nav: any;
              header: any;
              footer: any;
              main: any;
              section: any;
              article: any;
              aside: any;
              form: any;
              label: any;
              [elemName: string]: any;
            }
          }
        `,
        filePath: 'file:///node_modules/@types/react/jsx-runtime.d.ts'
      }
    ]);
    
    // Установка параметров компилятора для TSX
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext
    });
    
    console.log('TSX обработка исправлена');
  } catch (error) {
    console.error('Ошибка при исправлении обработки TSX:', error);
  }
}

/**
 * Инициализирует типы TypeScript в Monaco Editor
 * @param monaco Экземпляр Monaco Editor
 */
export function initializeTypeScriptTypes(monaco: any): void {
    if (!monaco || !monaco.languages || !monaco.languages.typescript) {
        console.error('Monaco или Monaco.languages.typescript не доступен');
        return;
    }

    try {
        // Сначала исправляем обработку TSX
        fixTSXHandling(monaco);
        
        // Затем настраиваем компилятор TypeScript
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            jsx: monaco.languages.typescript.JsxEmit.React,
            jsxFactory: 'React.createElement',
            jsxFragmentFactory: 'React.Fragment',
            allowJs: true,
            checkJs: true,
            strict: true,
            noImplicitAny: true,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            lib: ['ESNext', 'DOM', 'DOM.Iterable']
        });
        
        // Добавляем определения типов для React
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            REACT_TYPES,
            'file:///node_modules/@types/react/index.d.ts'
        );
        
        // Регистрируем обработчики для языков
        registerLanguageHandlers(monaco);
        
        console.log('TypeScript типы успешно инициализированы');
    } catch (error) {
        console.error('Ошибка при инициализации TypeScript типов:', error);
    }
}

/**
 * Регистрирует обработчики для TypeScript и JavaScript языков
 * @param monaco Экземпляр Monaco Editor
 */
function registerLanguageHandlers(monaco: any): void {
    if (!monaco?.languages) {
        console.error('Monaco.languages не доступен');
        return;
    }

    try {
        // Регистрируем обработчики для TypeScript
        monaco.languages.onLanguage('typescript', () => {
            monaco.languages.setLanguageConfiguration('typescript', {
                wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
                comments: {
                    lineComment: '//',
                    blockComment: ['/*', '*/']
                },
                brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')']
                ],
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: "'", close: "'", notIn: ['string', 'comment'] },
                    { open: '"', close: '"', notIn: ['string', 'comment'] },
                    { open: '`', close: '`', notIn: ['string', 'comment'] }
                ]
            });
        });
        
        // Регистрируем обработчики для TypeScriptReact
        monaco.languages.onLanguage('typescriptreact', () => {
            monaco.languages.setLanguageConfiguration('typescriptreact', {
                wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
                comments: {
                    lineComment: '//',
                    blockComment: ['/*', '*/']
                },
                brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')'],
                    ['<', '>']
                ],
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: "'", close: "'", notIn: ['string', 'comment'] },
                    { open: '"', close: '"', notIn: ['string', 'comment'] },
                    { open: '`', close: '`', notIn: ['string', 'comment'] },
                    { open: '<', close: '>', notIn: ['string', 'comment'] }
                ]
            });
        });
        
        console.log('Обработчики языков успешно зарегистрированы');
    } catch (error) {
        console.error('Ошибка при регистрации обработчиков языков:', error);
    }
}

/**
 * Регистрирует TypeScript файл в Monaco Editor
 * @param monaco Экземпляр Monaco Editor
 * @param filePath Путь к файлу
 * @param content Содержимое файла
 */
export function registerTypeScriptFile(monaco: any, filePath: string, content: string): void {
    if (!monaco || !monaco.languages || !monaco.languages.typescript) {
        console.error('Monaco или Monaco.languages.typescript не доступен');
        return;
    }

    if (!filePath || !content) {
        console.warn('Не указан путь к файлу или содержимое');
        return;
    }

    try {
        // Преобразуем путь файла в URI формат
        const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;
        
        // Регистрируем файл в Monaco
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            content,
            fileUri
        );
        
        // Если файл имеет .d.ts расширение, добавляем его как тип
        if (filePath.endsWith('.d.ts')) {
            // Извлекаем имя модуля из имени файла
            const moduleName = filePath.substring(
                filePath.lastIndexOf('/') + 1, 
                filePath.lastIndexOf('.d.ts')
            );
            
            // Добавляем типы в Monaco
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                `declare module "${moduleName}" {\n${content}\n}`,
                `file:///node_modules/@types/${moduleName}/index.d.ts`
            );
        }
        
        console.log(`Файл ${filePath} успешно зарегистрирован в TypeScript`);
    } catch (error) {
        console.error(`Ошибка при регистрации файла ${filePath}:`, error);
    }
} 