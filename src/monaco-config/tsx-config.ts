import { Monaco } from '@monaco-editor/react';

export function configureTSX(monaco: Monaco) {
  // Отключаем синтаксическую валидацию для TSX файлов
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: true, // Отключаем синтаксическую валидацию
    noSuggestionDiagnostics: false
  });

  // Регистрируем обработчик для TSX файлов с более точными определениями
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
    // Специальные определения для TSX файлов
    declare namespace React {
      function createElement(type: any, props?: any, ...children: any[]): any;
      function Fragment(props: { children?: any }): any;
      function createContext<T>(defaultValue: T): any;
      function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
      function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      function useContext<T>(context: any): T;
      function useRef<T>(initialValue: T): { current: T };
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      function useMemo<T>(factory: () => T, deps: any[]): T;
      function forwardRef<T, P>(render: (props: P, ref: any) => any): any;
      
      // Определения для компонентов
      type FC<P = {}> = (props: P) => any;
      type FunctionComponent<P = {}> = FC<P>;
      class Component<P = {}, S = {}> {
        constructor(props: P);
        props: P;
        state: S;
        setState(state: S | ((prevState: S, props: P) => S), callback?: () => void): void;
        forceUpdate(callback?: () => void): void;
        render(): any;
      }
      
      // Определения для JSX
      type ReactNode = any;
      type ReactElement = any;
      type CSSProperties = any;
      type RefObject<T> = { current: T | null };
      type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
    }
    
    // Глобальные определения для JSX
    declare namespace JSX {
      interface Element {}
      interface ElementClass {
        render(): any;
      }
      interface ElementAttributesProperty {
        props: {};
      }
      interface ElementChildrenAttribute {
        children: {};
      }
      
      interface IntrinsicAttributes {
        key?: string | number;
        children?: any;
      }
      
      interface IntrinsicElements {
        // HTML элементы
        div: any;
        span: any;
        h1: any;
        h2: any;
        h3: any;
        h4: any;
        h5: any;
        h6: any;
        p: any;
        a: any;
        button: any;
        input: any;
        textarea: any;
        select: any;
        option: any;
        form: any;
        img: any;
        ul: any;
        ol: any;
        li: any;
        table: any;
        tr: any;
        td: any;
        th: any;
        thead: any;
        tbody: any;
        label: any;
        nav: any;
        header: any;
        footer: any;
        main: any;
        section: any;
        article: any;
        aside: any;
        canvas: any;
        code: any;
        pre: any;
        hr: any;
        br: any;
        
        // SVG элементы
        svg: any;
        path: any;
        circle: any;
        rect: any;
        line: any;
        g: any;
        polygon: any;
        polyline: any;
        ellipse: any;
        text: any;
        tspan: any;
        
        // Другие элементы
        iframe: any;
        audio: any;
        video: any;
        source: any;
        track: any;
        embed: any;
        object: any;
        param: any;
        picture: any;
        portal: any;
        
        // Специфичные для вашего проекта компоненты
        Minus: any;
        X: any;
        [key: string]: any; // Разрешаем любые пользовательские компоненты
      }
    }
  `, 'tsx-enhanced-support.d.ts');

  // Настраиваем обработку TSX файлов
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowNonTsExtensions: true,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowJs: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  });
} 