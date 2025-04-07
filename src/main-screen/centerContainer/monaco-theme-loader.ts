/**
 * Загрузчик тем для Monaco Editor с улучшенной поддержкой TypeScript и TSX
 */

// Функция для настройки темы Monaco
export function setupMonacoTheme(monaco: any) {
  if (!monaco) return;
  
  // Вместо вызова неопределенных функций, реализуем их встроенно
  
  // Определяем темы
  // Определение темы для TypeScript
    monaco.editor.defineTheme('vs-dark-typescript', {
      base: 'vs-dark',
      inherit: true,
      rules: [
      { token: 'keyword', foreground: '569cd6' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'identifier', foreground: '9cdcfe' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'comment', foreground: '6a9955' }
      ],
      colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41'
    }
  });
  
  // Настраиваем токенизатор для TypeScript/TSX
  if (monaco.languages && monaco.languages.setMonarchTokensProvider) {
    // Здесь можно настроить токенизатор, если необходимо
  }
  
  // Устанавливаем тему по умолчанию
  monaco.editor.setTheme('vs-dark-typescript');
  
  // Добавляем поддержку JSX для TypeScript
  if (monaco.languages.typescript) {
    try {
      // Настраиваем параметры компилятора TypeScript для поддержки JSX
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      });
      
      // Также настраиваем параметры для JavaScript
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"],
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      });
      
      // Отключаем некоторые ошибки диагностики, которые обычно мешают при работе с TSX
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [
          2307, // Cannot find module 'x'
          2554, // Expected x arguments, but got y
          2322, // Type 'x' is not assignable to type 'y'
          7016, // Could not find declaration file
          2769, // No overload matches this call
          2339, // Property does not exist on type
          2345, // Argument type not assignable
          2695, // Left side of comma op is unused
          2551, // Property does not exist on type (different from 2339)
          2741, // Property missing in type but required in context
          2365, // Operator cannot be applied to types
          2694, // Named import from module with no default export
          2503, // Cannot find namespace
          2304, // Cannot find name
          2305, // Module not found
          2306, // File not found
          1005, // ';' expected
          1128, // Declaration not allowed
          1109, // Expression expected
          1131, // Property or signature expected
          1003, // Identifier expected
          1005  // ';' expected (duplicated, but common)
        ]
      });
      
      // Регистрируем дополнительные типы для React/JSX
      const reactTypes = `
        declare namespace React {
          function createElement(type: any, props?: any, ...children: any[]): any;
          function Fragment(props: any): any;
          function createContext<T>(defaultValue: T): any;
          function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useContext<T>(context: any): T;
          function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void];
          function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          function useMemo<T>(factory: () => T, deps: any[]): T;
          function useRef<T>(initialValue: T): { current: T };
          function forwardRef<T, P>(render: (props: P, ref: React.Ref<T>) => any): any;
          interface FC<P = {}> {
            (props: P): any;
            displayName?: string;
          }
          interface Component<P = {}, S = {}> {
            render(): any;
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S)): void;
          }
          class Component<P, S> {
            constructor(props: P);
            render(): any;
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S)): void;
          }
          interface ReactElement {}
          type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNodeArray;
          interface ReactNodeArray extends Array<ReactNode> {}
        }
      
        declare namespace JSX {
          interface Element extends React.ReactElement {}
          interface ElementClass extends React.Component<any> {
            render(): any;
          }
          interface ElementAttributesProperty { props: {}; }
          interface ElementChildrenAttribute { children: {}; }
          
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
            h4: any;
            h5: any;
            h6: any;
            ul: any;
            li: any;
            ol: any;
            img: any;
            form: any;
            label: any;
            select: any;
            option: any;
            table: any;
            tr: any;
            td: any;
            th: any;
            thead: any;
            tbody: any;
            tfoot: any;
            nav: any;
            header: any;
            footer: any;
            main: any;
            section: any;
            article: any;
            aside: any;
            textarea: any;
            pre: any;
            code: any;
            svg: any;
            path: any;
            [elemName: string]: any;
          }
        }
      `;
      
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
      
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        reactTypes,
        'file:///node_modules/@types/react/index.d.ts'
      );
      
      console.log('Поддержка JSX для TypeScript успешно настроена');
    } catch (error) {
      console.error('Ошибка при настройке JSX поддержки:', error);
    }
  }
} 