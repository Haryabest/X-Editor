import { Monaco } from '@monaco-editor/react';

/**
 * Конфигурирует продвинутые типы для JSX/TSX файлов
 */
export function configureJSXTypes(monaco: Monaco) {
  try {
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
        1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
        1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004
      ]
    });
    
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
        2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
        1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
        1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004
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

    // Добавляем базовые определения для JSX
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      jsxIntrinsicElementsDefinitions,
      'file:///node_modules/@types/react/jsx-runtime.d.ts'
    );
    
    // Добавляем определения CSS свойств
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      cssPropertiesDefinition,
      'file:///node_modules/@types/react/cssProperties.d.ts'
    );

    // Также добавляем и для JavaScript
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      jsxIntrinsicElementsDefinitions,
      'file:///node_modules/@types/react/jsx-runtime.d.ts'
    );
    
    // Добавляем определения CSS свойств и для JavaScript
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      cssPropertiesDefinition,
      'file:///node_modules/@types/react/cssProperties.d.ts'
    );

    // Логируем успешную настройку
    console.log('JSX types configured successfully');
  } catch (e) {
    console.error('Error configuring JSX types', e);
  }
}

/**
 * Базовые определения для JSX элементов
 */
export const jsxIntrinsicElementsDefinitions = `
declare namespace React {
  function createElement(type: any, props?: any, ...children: any[]): any;
  
  interface FC<P = {}> {
    (props: P): any;
    displayName?: string;
  }
  
  const Fragment: any;
  
  interface CSSProperties {
    [key: string]: any;
  }
  
  interface ReactDOM {
    render(element: any, container: any): void;
  }
  
  interface ChangeEvent<T = Element> {
    target: T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
  }
  
  interface FormEvent<T = Element> {
    target: T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
  }
  
  interface MouseEvent<T = Element> {
    target: T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
    clientX: number;
    clientY: number;
  }
  
  interface KeyboardEvent<T = Element> {
    target: T;
    currentTarget: T;
    key: string;
    keyCode: number;
    preventDefault(): void;
    stopPropagation(): void;
  }
  
  interface RefObject<T> {
    readonly current: T | null;
  }
  
  interface Ref<T> {
    current: T | null;
  }
  
  function createRef<T = any>(): Ref<T>;
  function useRef<T = any>(initialValue?: T): Ref<T>;
  function useState<T>(initialState: T | (() => T)): [T, (newValue: T | ((prevState: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  function useMemo<T>(factory: () => T, deps: any[]): T;
  
  interface HTMLAttributes {
    className?: string;
    style?: CSSProperties;
    id?: string;
    key?: string | number;
    ref?: any;
    onClick?: (event: MouseEvent) => void;
    onChange?: (event: ChangeEvent) => void;
    onSubmit?: (event: FormEvent) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyUp?: (event: KeyboardEvent) => void;
    onMouseOver?: (event: MouseEvent) => void;
    onMouseOut?: (event: MouseEvent) => void;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    tabIndex?: number;
    hidden?: boolean;
    title?: string;
    role?: string;
    disabled?: boolean;
    draggable?: boolean;
    dir?: string;
    checked?: boolean;
    value?: string | number | any;
    placeholder?: string;
    type?: string;
    name?: string;
    maxLength?: number;
    minLength?: number;
    max?: number | string;
    min?: number | string;
    width?: number | string;
    height?: number | string;
    required?: boolean;
    [key: string]: any;
  }
  
  interface FunctionComponent<P = {}> {
    (props: P): any;
    displayName?: string;
    defaultProps?: Partial<P>;
  }
  
  interface ComponentClass<P = {}, S = {}> {
    new(props: P): Component<P, S>;
    displayName?: string;
    defaultProps?: Partial<P>;
  }
  
  interface Component<P = {}, S = {}> {
    props: P;
    state: S;
    refs: { [key: string]: any };
    setState(state: Partial<S> | ((prevState: S, props: P) => Partial<S>), callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): any;
  }
  
  namespace JSX {
    interface Element {}
    
    interface IntrinsicElements {
      div: HTMLAttributes;
      span: HTMLAttributes;
      p: HTMLAttributes;
      a: HTMLAttributes & { href?: string, target?: string };
      button: HTMLAttributes & { disabled?: boolean };
      input: HTMLAttributes & { 
        type?: string, 
        value?: string | number | string[], 
        checked?: boolean,
        disabled?: boolean,
        placeholder?: string,
        readOnly?: boolean,
        required?: boolean,
        onChange?: (event: any) => void
      };
      textarea: HTMLAttributes;
      select: HTMLAttributes;
      option: HTMLAttributes & { value?: string | number };
      form: HTMLAttributes & { action?: string, method?: string };
      h1: HTMLAttributes;
      h2: HTMLAttributes;
      h3: HTMLAttributes;
      h4: HTMLAttributes;
      h5: HTMLAttributes;
      h6: HTMLAttributes;
      img: HTMLAttributes & { src: string, alt?: string };
      ul: HTMLAttributes;
      ol: HTMLAttributes;
      li: HTMLAttributes;
      table: HTMLAttributes;
      tr: HTMLAttributes;
      td: HTMLAttributes;
      th: HTMLAttributes;
      thead: HTMLAttributes;
      tbody: HTMLAttributes;
      tfoot: HTMLAttributes;
      br: HTMLAttributes;
      hr: HTMLAttributes;
      header: HTMLAttributes;
      footer: HTMLAttributes;
      nav: HTMLAttributes;
      section: HTMLAttributes;
      article: HTMLAttributes;
      aside: HTMLAttributes;
      main: HTMLAttributes;
      label: HTMLAttributes & { htmlFor?: string };
      script: HTMLAttributes & { src?: string };
      link: HTMLAttributes & { rel?: string, href?: string };
      pre: HTMLAttributes;
      code: HTMLAttributes;
      i: HTMLAttributes;
      b: HTMLAttributes;
      strong: HTMLAttributes;
      em: HTMLAttributes;
      small: HTMLAttributes;
      svg: HTMLAttributes;
      path: HTMLAttributes;
      circle: HTMLAttributes;
      rect: HTMLAttributes;
      [key: string]: HTMLAttributes;
    }
  }
}`;

/**
 * Определение CSS свойств для работы в JSX style атрибутах
 */
export const cssPropertiesDefinition = `
  interface CSSProperties {
    alignContent?: string;
    alignItems?: string;
    alignSelf?: string;
    animation?: string;
    animationDelay?: string;
    animationDirection?: string;
    animationDuration?: string;
    animationFillMode?: string;
    animationIterationCount?: string;
    animationName?: string;
    animationPlayState?: string;
    animationTimingFunction?: string;
    appearance?: string;
    backfaceVisibility?: string;
    background?: string;
    backgroundAttachment?: string;
    backgroundBlendMode?: string;
    backgroundClip?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundOrigin?: string;
    backgroundPosition?: string;
    backgroundRepeat?: string;
    backgroundSize?: string;
    borderBottom?: string;
    borderBottomColor?: string;
    borderBottomLeftRadius?: string | number;
    borderBottomRightRadius?: string | number;
    borderBottomStyle?: string;
    borderBottomWidth?: string | number;
    borderCollapse?: string;
    borderColor?: string;
    borderImage?: string;
    borderImageOutset?: string;
    borderImageRepeat?: string;
    borderImageSlice?: string;
    borderImageSource?: string;
    borderImageWidth?: string | number;
    borderLeft?: string;
    borderLeftColor?: string;
    borderLeftStyle?: string;
    borderLeftWidth?: string | number;
    borderRadius?: string | number;
    borderRight?: string;
    borderRightColor?: string;
    borderRightStyle?: string;
    borderRightWidth?: string | number;
    borderSpacing?: string;
    borderStyle?: string;
    borderTop?: string;
    borderTopColor?: string;
    borderTopLeftRadius?: string | number;
    borderTopRightRadius?: string | number;
    borderTopStyle?: string;
    borderTopWidth?: string | number;
    borderWidth?: string | number;
    bottom?: string | number;
    boxShadow?: string;
    boxSizing?: string;
    captionSide?: string;
    caretColor?: string;
    clear?: string;
    clip?: string;
    color?: string;
    columnCount?: number;
    columnFill?: string;
    columnGap?: string | number;
    columnRule?: string;
    columnRuleColor?: string;
    columnRuleStyle?: string;
    columnRuleWidth?: string | number;
    columnSpan?: string;
    columnWidth?: string | number;
    columns?: string;
    content?: string;
    counterIncrement?: string;
    counterReset?: string;
    cursor?: string;
    direction?: string;
    display?: string;
    emptyCells?: string;
    filter?: string;
    flex?: string | number;
    flexBasis?: string | number;
    flexDirection?: string;
    flexFlow?: string;
    flexGrow?: number;
    flexShrink?: number;
    flexWrap?: string;
    float?: string;
    font?: string;
    fontFamily?: string;
    fontSize?: string | number;
    fontSizeAdjust?: string | number;
    fontStretch?: string;
    fontStyle?: string;
    fontVariant?: string;
    fontWeight?: string | number;
    gap?: string | number;
    grid?: string;
    gridArea?: string;
    gridAutoColumns?: string;
    gridAutoFlow?: string;
    gridAutoRows?: string;
    gridColumn?: string;
    gridColumnEnd?: string;
    gridColumnGap?: string | number;
    gridColumnStart?: string;
    gridGap?: string | number;
    gridRow?: string;
    gridRowEnd?: string;
    gridRowGap?: string | number;
    gridRowStart?: string;
    gridTemplate?: string;
    gridTemplateAreas?: string;
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
    height?: string | number;
    hyphens?: string;
    imageRendering?: string;
    inset?: string | number;
    isolation?: string;
    justifyContent?: string;
    justifyItems?: string;
    justifySelf?: string;
    left?: string | number;
    letterSpacing?: string | number;
    lineHeight?: string | number;
    listStyle?: string;
    listStyleImage?: string;
    listStylePosition?: string;
    listStyleType?: string;
    margin?: string | number;
    marginBottom?: string | number;
    marginLeft?: string | number;
    marginRight?: string | number;
    marginTop?: string | number;
    maxHeight?: string | number;
    maxWidth?: string | number;
    minHeight?: string | number;
    minWidth?: string | number;
    mixBlendMode?: string;
    objectFit?: string;
    objectPosition?: string;
    opacity?: string | number;
    order?: string | number;
    outline?: string;
    outlineColor?: string;
    outlineOffset?: string | number;
    outlineStyle?: string;
    outlineWidth?: string | number;
    overflow?: string;
    overflowAnchor?: string;
    overflowWrap?: string;
    overflowX?: string;
    overflowY?: string;
    padding?: string | number;
    paddingBottom?: string | number;
    paddingLeft?: string | number;
    paddingRight?: string | number;
    paddingTop?: string | number;
    pageBreakAfter?: string;
    pageBreakBefore?: string;
    pageBreakInside?: string;
    perspective?: string | number;
    perspectiveOrigin?: string;
    placeContent?: string;
    placeItems?: string;
    placeSelf?: string;
    pointerEvents?: string;
    position?: string;
    quotes?: string;
    resize?: string;
    right?: string | number;
    rowGap?: string | number;
    scrollBehavior?: string;
    tabSize?: string | number;
    tableLayout?: string;
    textAlign?: string;
    textAlignLast?: string;
    textDecoration?: string;
    textDecorationColor?: string;
    textDecorationLine?: string;
    textDecorationStyle?: string;
    textIndent?: string | number;
    textJustify?: string;
    textOverflow?: string;
    textShadow?: string;
    textTransform?: string;
    top?: string | number;
    transform?: string;
    transformOrigin?: string;
    transformStyle?: string;
    transition?: string;
    transitionDelay?: string;
    transitionDuration?: string;
    transitionProperty?: string;
    transitionTimingFunction?: string;
    unicodeBidi?: string;
    userSelect?: string;
    verticalAlign?: string | number;
    visibility?: string;
    whiteSpace?: string;
    width?: string | number;
    wordBreak?: string;
    wordSpacing?: string | number;
    wordWrap?: string;
    writingMode?: string;
    zIndex?: string | number;
    // SVG specific properties
    fill?: string;
    fillOpacity?: string | number;
    fillRule?: string;
    stroke?: string;
    strokeDasharray?: string;
    strokeDashoffset?: string | number;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    strokeMiterlimit?: string | number;
    strokeOpacity?: string | number;
    strokeWidth?: string | number;
    // CSS Variables
    [key: string]: string | number | undefined;
  }

  // Для использования в React.CSSProperties
  namespace React {
    interface CSSProperties extends CSSProperties {}
  }
`; 