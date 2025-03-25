import { Monaco } from '@monaco-editor/react';

/**
 * Конфигурирует продвинутые типы для JSX/TSX файлов
 */
export function configureJSXTypes(monaco: Monaco) {
  // Настраиваем специальные параметры для JSX/TSX
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowNonTsExtensions: true,
    allowJs: true,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    esModuleInterop: true
  });
  
  // Настраиваем JavaScript для поддержки JSX
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowNonTsExtensions: true,
    allowJs: true
  });
  
  // Отключаем проверки для ускорения работы и избежания ложных ошибок
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010
    ]
  });
  
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010
    ]
  });

  // Настраиваем анализатор для JSX
  monaco.languages.typescript.typescriptDefaults.setInlayHintsOptions({
    includeInlayParameterNameHints: 'all',
    includeInlayParameterNameHintsWhenArgumentMatchesName: true,
    includeInlayFunctionParameterTypeHints: true,
    includeInlayVariableTypeHints: true,
    includeInlayPropertyDeclarationTypeHints: true,
    includeInlayFunctionLikeReturnTypeHints: true,
    includeInlayEnumMemberValueHints: true
  });

  // Добавляем расширенные определения JSX/TSX
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `
    // Определяем базовые типы для событий
    interface SyntheticEvent {
      bubbles: boolean;
      cancelable: boolean;
      currentTarget: EventTarget;
      defaultPrevented: boolean;
      eventPhase: number;
      isTrusted: boolean;
      nativeEvent: Event;
      preventDefault(): void;
      stopPropagation(): void;
      target: EventTarget;
      timeStamp: number;
      type: string;
    }
    
    // Специфичные типы событий
    interface MouseEvent extends SyntheticEvent {
      button: number;
      buttons: number;
      clientX: number;
      clientY: number;
      pageX: number;
      pageY: number;
    }
    
    interface ChangeEvent extends SyntheticEvent {
      target: EventTarget & { value: string };
    }
    
    interface KeyboardEvent extends SyntheticEvent {
      altKey: boolean;
      charCode: number;
      ctrlKey: boolean;
      key: string;
      keyCode: number;
      metaKey: boolean;
      shiftKey: boolean;
    }
    
    // Стиль как объект
    interface CSSProperties {
      [key: string]: string | number;
    }
    
    // Определение основных атрибутов HTML элементов
    interface HTMLAttributes {
      // Основные HTML атрибуты
      className?: string;
      class?: string;
      id?: string;
      style?: CSSProperties | string;
      title?: string;
      role?: string;
      tabIndex?: number;
      
      // События с правильными типами
      onClick?: (event: MouseEvent) => void;
      onChange?: (event: ChangeEvent) => void;
      onSubmit?: (event: SyntheticEvent) => void;
      onKeyDown?: (event: KeyboardEvent) => void;
      onKeyUp?: (event: KeyboardEvent) => void;
      onMouseEnter?: (event: MouseEvent) => void;
      onMouseLeave?: (event: MouseEvent) => void;
      onMouseDown?: (event: MouseEvent) => void;
      onMouseUp?: (event: MouseEvent) => void;
      onFocus?: (event: SyntheticEvent) => void;
      onBlur?: (event: SyntheticEvent) => void;
      onInput?: (event: ChangeEvent) => void;
      
      // Дополнительные атрибуты для input
      type?: string;
      value?: string | number | readonly string[];
      defaultValue?: string | number | readonly string[];
      placeholder?: string;
      checked?: boolean;
      defaultChecked?: boolean;
      disabled?: boolean;
      readOnly?: boolean;
      name?: string;
      
      // Data-атрибуты и любые другие
      [key: string]: any;
    }
    
    // Определяем JSX пространство имен
    declare namespace JSX {
      interface Element {}
      
      // Определяем базовые HTML элементы
      interface IntrinsicElements {
        div: HTMLAttributes;
        span: HTMLAttributes;
        p: HTMLAttributes;
        a: HTMLAttributes;
        button: HTMLAttributes;
        input: HTMLAttributes;
        textarea: HTMLAttributes;
        select: HTMLAttributes;
        option: HTMLAttributes;
        form: HTMLAttributes;
        img: HTMLAttributes;
        h1: HTMLAttributes;
        h2: HTMLAttributes;
        h3: HTMLAttributes;
        h4: HTMLAttributes;
        h5: HTMLAttributes;
        h6: HTMLAttributes;
        hr: HTMLAttributes;
        br: HTMLAttributes;
        table: HTMLAttributes;
        thead: HTMLAttributes;
        tbody: HTMLAttributes;
        tr: HTMLAttributes;
        td: HTMLAttributes;
        th: HTMLAttributes;
        ul: HTMLAttributes;
        ol: HTMLAttributes;
        li: HTMLAttributes;
        nav: HTMLAttributes;
        main: HTMLAttributes;
        section: HTMLAttributes;
        article: HTMLAttributes;
        header: HTMLAttributes;
        footer: HTMLAttributes;
        label: HTMLAttributes;
        fieldset: HTMLAttributes;
        legend: HTMLAttributes;
        pre: HTMLAttributes;
        code: HTMLAttributes;
        i: HTMLAttributes;
        b: HTMLAttributes;
        strong: HTMLAttributes;
        em: HTMLAttributes;
        small: HTMLAttributes;
        svg: HTMLAttributes;
        path: HTMLAttributes;
        canvas: HTMLAttributes;
        video: HTMLAttributes;
        audio: HTMLAttributes;
        iframe: HTMLAttributes;
      }
    }
    
    // Определяем React пространство имен
    declare namespace React {
      // Определение компонента
      class Component<P = {}, S = {}> {
        constructor(props: P);
        props: P;
        state: S;
        setState(state: S | ((prevState: S) => S), callback?: () => void): void;
        forceUpdate(callback?: () => void): void;
        render(): JSX.Element | null;
      }
      
      // Определение функционального компонента
      interface FC<P = {}> {
        (props: P): JSX.Element | null;
        displayName?: string;
        defaultProps?: Partial<P>;
      }
      
      // HTML Атрибуты React
      interface HTMLAttributes {
        className?: string;
        style?: CSSProperties;
        onClick?: (event: MouseEvent) => void;
        onChange?: (event: ChangeEvent) => void;
        // Другие атрибуты
        [key: string]: any;
      }
      
      // Хуки
      function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
      function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      function useContext<T>(context: any): T;
      function useRef<T>(initialValue: T): { current: T };
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      function useMemo<T>(factory: () => T, deps: any[]): T;
      
      // React.createElement
      function createElement(
        type: string | any,
        props?: any,
        ...children: any[]
      ): JSX.Element;
      
      // Фрагмент
      const Fragment: any;
    }
    `,
    'file:///node_modules/@types/react-jsx-runtime/index.d.ts'
  );
} 