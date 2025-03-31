/**
 * Модуль для регистрации и настройки поддержки TSX файлов в Monaco Editor
 */

/**
 * Регистрирует язык TypeScriptReact (TSX) и добавляет улучшенную подсветку синтаксиса
 */
export function registerTSX(): boolean {
  if (!window.monaco) {
    console.warn('Monaco не найден, пропуск регистрации TSX');
    return false;
  }

  try {
    const monaco = window.monaco;
    console.log('Регистрация поддержки TSX в Monaco...');

    // Регистрация языка TSX если он еще не зарегистрирован
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'typescriptreact')) {
      monaco.languages.register({ id: 'typescriptreact', extensions: ['.tsx'] });
      console.log('Язык typescriptreact успешно зарегистрирован');
    } else {
      console.log('Язык typescriptreact уже зарегистрирован');
    }

    // Настройки для компилятора TypeScript с поддержкой JSX
    if (monaco.languages.typescript) {
      const typescriptDefaults = monaco.languages.typescript.typescriptDefaults;
      
      // Установка параметров компилятора
      typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        reactNamespace: 'React',
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        experimentalDecorators: true,
        allowJs: true,
        typeRoots: ['node_modules/@types']
      });

      // Добавляем базовые определения типов для React
      typescriptDefaults.addExtraLib(`
declare namespace React {
  type ReactNode = React.ReactElement | string | number | boolean | null | undefined | React.ReactNodeArray;
  type ReactElement<P = any> = {
    type: React.ComponentType<P>;
    props: P;
    key: React.Key | null;
  };
  type ComponentType<P = {}> = React.ComponentClass<P> | React.FunctionComponent<P>;
  type Key = string | number;
  type ReactNodeArray = Array<React.ReactNode>;

  interface FunctionComponent<P = {}> {
    (props: P): React.ReactElement<P> | null;
    displayName?: string;
  }
  
  interface ComponentClass<P = {}, S = {}> {
    new(props: P): Component<P, S>;
    displayName?: string;
  }

  class Component<P = {}, S = {}> {
    constructor(props: P);
    props: Readonly<P>;
    state: Readonly<S>;
    setState(state: S | ((prevState: S, props: P) => S)): void;
    forceUpdate(): void;
    render(): ReactNode;
  }

  function createElement<P>(
    type: React.ComponentType<P> | string,
    props?: P | null,
    ...children: React.ReactNode[]
  ): React.ReactElement<P>;

  function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useContext<T>(context: React.Context<T>): T;
  function useRef<T>(initialValue: T): { current: T };
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  function useMemo<T>(factory: () => T, deps: any[]): T;

  interface Context<T> {
    Provider: Provider<T>;
    Consumer: Consumer<T>;
  }
  
  interface Provider<T> {
    (props: { value: T; children?: React.ReactNode }): React.ReactElement | null;
  }
  
  interface Consumer<T> {
    (props: { children: (value: T) => React.ReactNode }): React.ReactElement | null;
  }
  
  function createContext<T>(defaultValue: T): Context<T>;
  function Fragment(props: { children?: React.ReactNode }): React.ReactElement | null;
}

declare namespace JSX {
  interface Element extends React.ReactElement<any> {}
  interface ElementClass extends React.Component<any> {
    render(): React.ReactNode;
  }
  interface ElementAttributesProperty { props: {}; }
  interface ElementChildrenAttribute { children: {}; }
  
  interface IntrinsicElements {
    // HTML
    a: any; abbr: any; address: any; area: any; article: any; aside: any; audio: any;
    b: any; base: any; bdi: any; bdo: any; big: any; blockquote: any; body: any; br: any; button: any;
    canvas: any; caption: any; cite: any; code: any; col: any; colgroup: any;
    data: any; datalist: any; dd: any; del: any; details: any; dfn: any; dialog: any; div: any; dl: any; dt: any;
    em: any; embed: any;
    fieldset: any; figcaption: any; figure: any; footer: any; form: any;
    h1: any; h2: any; h3: any; h4: any; h5: any; h6: any; head: any; header: any; hgroup: any; hr: any; html: any;
    i: any; iframe: any; img: any; input: any; ins: any;
    kbd: any; keygen: any;
    label: any; legend: any; li: any; link: any;
    main: any; map: any; mark: any; menu: any; menuitem: any; meta: any; meter: any;
    nav: any; noscript: any;
    object: any; ol: any; optgroup: any; option: any; output: any;
    p: any; param: any; picture: any; pre: any; progress: any;
    q: any;
    rp: any; rt: any; ruby: any;
    s: any; samp: any; script: any; section: any; select: any; small: any; source: any; span: any; strong: any; style: any; sub: any; summary: any; sup: any;
    table: any; tbody: any; td: any; textarea: any; tfoot: any; th: any; thead: any; time: any; title: any; tr: any; track: any;
    u: any; ul: any;
    var: any; video: any;
    wbr: any;
    
    // SVG
    svg: any; circle: any; clipPath: any; defs: any; desc: any; ellipse: any; feBlend: any; feColorMatrix: any;
    feComponentTransfer: any; feComposite: any; feConvolveMatrix: any; feDiffuseLighting: any; feDisplacementMap: any;
    feDistantLight: any; feDropShadow: any; feFlood: any; feFuncA: any; feFuncB: any; feFuncG: any; feFuncR: any;
    feGaussianBlur: any; feImage: any; feMerge: any; feMergeNode: any; feMorphology: any; feOffset: any;
    fePointLight: any; feSpecularLighting: any; feSpotLight: any; feTile: any; feTurbulence: any; filter: any;
    foreignObject: any; g: any; image: any; line: any; linearGradient: any; marker: any; mask: any; path: any;
    pattern: any; polygon: any; polyline: any; radialGradient: any; rect: any; stop: any; symbol: any; text: any;
    textPath: any; tspan: any; use: any; view: any;
    
    // Дополнительные элементы, которые могут быть использованы
    [elemName: string]: any;
  }
}

declare module 'react' {
  export = React;
}

declare module 'react-dom' {
  function render(element: React.ReactElement, container: Element | DocumentFragment | null): void;
  function unmountComponentAtNode(container: Element): boolean;
  namespace findDOMNode {
    function findDOMNode(instance: React.Component<any, any>): Element | null | Text;
  }
  const version: string;
  const createPortal: any;
}

declare module 'react-dom/client' {
  interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  function createRoot(container: Element | DocumentFragment): Root;
  function hydrateRoot(container: Element | DocumentFragment, initialChildren: React.ReactNode): Root;
}
      `, 'typescript:react.d.ts');

      // Добавляем определения для наиболее распространенных модулей React
      typescriptDefaults.addExtraLib(`
declare module "styled-components" {
  import * as React from "react";
  export interface ThemedStyledComponentsModule<T> {
    createGlobalStyle: any;
    css: any;
    keyframes: any;
    ThemeProvider: React.ComponentClass<{theme: T}>;
    default: any;
  }
  
  export interface ThemedStyledComponents<T> {
    (tag: string): any;
    (tag: React.ComponentType<any>): any;
  }
  
  export function createGlobalStyle(strings: TemplateStringsArray, ...interpolations: any[]): React.ComponentType<any>;
  export function css(strings: TemplateStringsArray, ...interpolations: any[]): any;
  export function keyframes(strings: TemplateStringsArray, ...interpolations: any[]): string;
  export function ThemeProvider(props: { theme: any, children?: React.ReactNode }): React.ReactElement;
  
  const styled: ThemedStyledComponents<any> & ThemedStyledComponentsModule<any>;
  export default styled;
}

declare module "@emotion/styled" {
  import { ComponentSelector, Interpolation } from "@emotion/react";
  
  export default function styled(tag: any): any;
  export interface StyledComponent<Props = {}, Theme = any> extends React.FC<Props> {
    withComponent<T>(tag: T): StyledComponent<Props, Theme>;
  }
}

declare module "@emotion/react" {
  import * as React from "react";
  
  export type Theme = any;
  export type Interpolation<P = unknown> = any;
  export type SerializedStyles = any;
  
  export interface ArrayInterpolation<P = unknown> extends Array<Interpolation<P>> {}
  export interface ComponentSelector {
    __emotion_styles: any;
  }
  
  export const ThemeContext: React.Context<Theme>;
  export const CacheProvider: React.Provider<any>;
  export function withTheme<P = any, T = Theme>(component: React.ComponentType<P & { theme: T }>): React.FC<P>;
  export function jsx(type: any, props: any, key?: string): React.ReactElement;
  export const jsx: typeof React.createElement;
  export const css: any;
  export const Global: React.FC<{ styles: Interpolation<Theme> }>;
  export function keyframes(template: TemplateStringsArray, ...args: any[]): string;
}
      `, 'typescript:react-libs.d.ts');
      
      console.log('React типы успешно добавлены в TypeScript');
    }

    // Регистрируем команду поиска файлов по частичному пути
    monaco.editor.onDidCreateEditor((editor: any) => {
      // Импортируем модуль поиска файлов динамически, чтобы не блокировать основную загрузку
      import('./file-search').then((module) => {
        try {
          if (module.registerFileSearchCommand) {
            module.registerFileSearchCommand(editor);
            console.log('Команда поиска файлов успешно зарегистрирована');
          } else {
            console.warn('Функция registerFileSearchCommand не найдена в модуле file-search');
          }
        } catch (error) {
          console.error('Ошибка при регистрации команды поиска файлов:', error);
        }
      }).catch((error) => {
        console.error('Ошибка при импорте модуля поиска файлов:', error);
      });
    });

    console.log('TSX поддержка успешно зарегистрирована');
    return true;
  } catch (error) {
    console.error('Ошибка при регистрации TSX:', error);
    return false;
  }
}

/**
 * Утилиты для работы с путями
 */
const PathUtils = {
  /**
   * Получает директорию из пути к файлу
   * @param filePath Путь к файлу
   */
  getDirectory(filePath: string): string {
    const lastSlashIndex = filePath.lastIndexOf('/');
    if (lastSlashIndex === -1) return '';
    return filePath.substring(0, lastSlashIndex);
  },

  /**
   * Соединяет части пути
   * @param parts Части пути
   */
  joinPaths(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  },

  /**
   * Разрешает относительный путь к абсолютному относительно базового пути
   * @param basePath Базовый путь (путь к текущему файлу или директории)
   * @param relativePath Относительный путь
   */
  resolvePath(basePath: string, relativePath: string): string {
    // Если путь не относительный, возвращаем как есть
    if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
      return relativePath;
    }

    // Получаем базовую директорию
    const baseDir = this.getDirectory(basePath);
    
    // Разбиваем пути на сегменты
    const baseSegments = baseDir.split('/').filter(Boolean);
    const relativeSegments = relativePath.split('/').filter(Boolean);
    
    const resultSegments = [...baseSegments];
    
    for (const segment of relativeSegments) {
      if (segment === '.') continue;
      if (segment === '..') {
        if (resultSegments.length > 0) {
          resultSegments.pop();
        }
        continue;
      }
      resultSegments.push(segment);
    }
    
    return '/' + resultSegments.join('/');
  },

  /**
   * Определяет тип импорта
   * @param importPath Путь импорта
   */
  getImportType(importPath: string): 'relative' | 'absolute' | 'node_module' {
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return 'relative';
    } else if (importPath.startsWith('/')) {
      return 'absolute';
    } else {
      return 'node_module';
    }
  },

  /**
   * Определяет возможное расширение файла на основе импорта
   * @param importPath Путь импорта
   */
  guessFileExtension(importPath: string): string {
    // Проверяем, есть ли уже расширение
    if (/\.[a-zA-Z0-9]+$/.test(importPath)) {
      return '';
    }
    
    // Предполагаемые расширения в порядке приоритета
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    
    // Для путей, которые могут быть компонентами React, предпочитаем TSX/JSX
    if (/[A-Z][a-zA-Z0-9]*$/.test(importPath)) {
      return '.tsx';
    }
    
    return extensions[0]; // По умолчанию возвращаем первое расширение
  }
};

// Добавляем типы для File System Access API
declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<any>;
    showOpenFilePicker?: (options?: any) => Promise<any>;
  }
}

/**
 * Получает объект с информацией о текущем рабочем пространстве и проекте
 * @param currentFilePath Путь к текущему файлу
 */
function getCurrentWorkspaceInfo(currentFilePath: string): {
  workspaceRoot: string;
  projectDir: string;
  relativePath: string;
} {
  console.log('Анализ пути файла:', currentFilePath);

  // Пример пути файла в Monaco: /C:/PROJECTS/X-Editor/src/components/Button.tsx
  // или: /src/components/Button.tsx
  
  let workspaceRoot = '';
  let projectDir = '';
  let relativePath = '';
  
  // Проверяем, содержит ли путь диск Windows (например, C:)
  const isAbsoluteWindowsPath = /^\/[A-Z]:/i.test(currentFilePath);
  
  if (isAbsoluteWindowsPath) {
    // Для Windows путей типа /C:/PROJECTS/X-Editor/src/...
    const parts = currentFilePath.split('/').filter(Boolean);
    const diskPart = parts[0]; // C:
    
    // Определяем корень проекта
    // Предполагаем, что проект находится в структуре типа C:/PROJECTS/X-Editor/
    if (parts.length >= 3) {
      workspaceRoot = `/${diskPart}/${parts[1]}/${parts[2]}`;
      projectDir = `/${diskPart}/${parts[1]}/${parts[2]}/${parts[3] || ''}`;
      
      // Относительный путь - все после projectDir
      const projectDirParts = projectDir.split('/').filter(Boolean).length;
      relativePath = '/' + parts.slice(projectDirParts).join('/');
    } else {
      // Если структура пути не соответствует ожидаемой
      workspaceRoot = `/${diskPart}/${parts[1] || ''}`;
      projectDir = workspaceRoot;
      relativePath = currentFilePath.substring(workspaceRoot.length);
    }
  } else {
    // Для относительных путей или абсолютных без диска
    // Предполагаем, что проект начинается с /src
    const srcIndex = currentFilePath.indexOf('/src');
    
    if (srcIndex !== -1) {
      workspaceRoot = currentFilePath.substring(0, srcIndex);
      projectDir = currentFilePath.substring(0, srcIndex + 4); // включает "/src"
      relativePath = currentFilePath.substring(projectDir.length);
    } else {
      // Если нет /src в пути, берем первую часть пути
      const parts = currentFilePath.split('/').filter(Boolean);
      if (parts.length > 0) {
        workspaceRoot = '/' + parts[0];
        projectDir = workspaceRoot;
        relativePath = currentFilePath.substring(workspaceRoot.length);
      } else {
        // Если нет частей пути
        workspaceRoot = '/';
        projectDir = '/';
        relativePath = currentFilePath;
      }
    }
  }
  
  console.log('Результат анализа пути:',{
    workspaceRoot,
    projectDir,
    relativePath,
    originalPath: currentFilePath
  });
  
  return {
    workspaceRoot,
    projectDir,
    relativePath
  };
}

/**
 * Менеджер структуры проекта для анализа и кэширования путей
 */
const ProjectStructure = {
  // Кэш найденных файлов и директорий
  fileCache: new Map<string, boolean>(),
  
  // Кэш информации о рабочем пространстве
  workspaceInfo: null as null | {
    workspaceRoot: string;
    projectDir: string;
    relativePath: string;
  },
  
  /**
   * Получает информацию о текущем рабочем пространстве
   * @param currentFilePath Путь к текущему файлу
   */
  getWorkspaceInfo(currentFilePath: string): {
    workspaceRoot: string;
    projectDir: string;
    relativePath: string;
  } {
    if (this.workspaceInfo) {
      return this.workspaceInfo;
    }
    
    this.workspaceInfo = getCurrentWorkspaceInfo(currentFilePath);
    return this.workspaceInfo;
  },
  
  /**
   * Получает базовый путь проекта на основе текущего файла
   * @param currentFilePath Путь к текущему файлу
   */
  getProjectRoot(currentFilePath: string): string {
    const { projectDir } = this.getWorkspaceInfo(currentFilePath);
    return projectDir;
  },
  
  /**
   * Проверяет, доступно ли API файловой системы в браузере
   */
  isFileSystemAPIAvailable(): boolean {
    return !!(window.showDirectoryPicker && window.showOpenFilePicker);
  },
  
  /**
   * Пытается определить, существует ли файл или директория по относительному пути
   * @param basePath Путь к текущему файлу
   * @param importPath Относительный путь импорта
   */
  async doesFileExist(basePath: string, importPath: string): Promise<boolean> {
    try {
      const fullPath = PathUtils.resolvePath(basePath, importPath);
      
      // Проверяем кэш
      if (this.fileCache.has(fullPath)) {
        return this.fileCache.get(fullPath) || false;
      }
      
      // В браузере нет прямого доступа к проверке существования файла
      // Этот метод можно расширить в реальном приложении, используя:
      // 1. Запросы к серверу с проверкой существования файла
      // 2. Предварительное сканирование и кэширование структуры проекта
      // 3. Интеграцию с сервером разработки через WebSockets
      
      // Для демонстрации просто предположим, что файл существует
      // Это можно заменить реальной проверкой в контексте вашего приложения
      
      // В случае, если это файл без расширения
      if (!/\.[a-zA-Z0-9]+$/.test(fullPath)) {
        // Пробуем с различными расширениями
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.scss'];
        for (const ext of extensions) {
          const exists = await this.checkFileExistence(fullPath + ext);
          if (exists) {
            this.fileCache.set(fullPath, true);
            return true;
          }
        }
        
        // Проверяем index.* файлы в директории
        const directoryPath = fullPath + '/';
        for (const ext of extensions) {
          const exists = await this.checkFileExistence(directoryPath + 'index' + ext);
          if (exists) {
            this.fileCache.set(fullPath, true);
            return true;
          }
        }
      } else {
        // Если указано расширение, проверяем напрямую
        const exists = await this.checkFileExistence(fullPath);
        this.fileCache.set(fullPath, exists);
        return exists;
      }
      
      // Если ничего не найдено
      this.fileCache.set(fullPath, false);
      return false;
    } catch (error) {
      console.error('Ошибка при проверке существования файла:', error);
      return false;
    }
  },
  
  /**
   * Проверяет существование файла (заглушка)
   * @param path Путь к файлу
   */
  async checkFileExistence(path: string): Promise<boolean> {
    // В реальном приложении здесь был бы запрос к серверу или использование 
    // File System API для проверки существования файла
    
    // Для демонстрации просто возвращаем true с 70% вероятностью
    // чтобы симулировать проверку
    return Math.random() > 0.3;
  },
  
  /**
   * Получает список импортов из текущего проекта (заглушка)
   */
  async getProjectImports(): Promise<string[]> {
    // В реальном приложении здесь был бы запрос к серверу или анализ проекта
    // для получения списка доступных импортов
    
    // Для демонстрации возвращаем фиктивный список популярных импортов
    return [
      './components/Button',
      './components/Input',
      './components/Form',
      './utils/helpers',
      './services/api',
      './hooks/useData',
      './types/models',
      './assets/images'
    ];
  },
  
  /**
   * Определяет наиболее вероятные места импорта на основе имени модуля
   * @param moduleName Имя модуля
   */
  getProbableLocations(moduleName: string): string[] {
    // Анализируем имя модуля для предположения его расположения
    const locations: string[] = [];
    
    if (/^[A-Z][a-zA-Z0-9]*$/.test(moduleName)) {
      // Компоненты обычно находятся в директории components
      locations.push(`./components/${moduleName}`, `./components/${moduleName}/${moduleName}`);
    } else if (moduleName.includes('use')) {
      // Хуки обычно находятся в директории hooks
      locations.push(`./hooks/${moduleName}`);
    } else if (moduleName.includes('api') || moduleName.includes('service')) {
      // API и сервисы
      locations.push(`./services/${moduleName}`, `./api/${moduleName}`);
    } else if (moduleName.includes('util') || moduleName.includes('helper')) {
      // Утилиты и хелперы
      locations.push(`./utils/${moduleName}`);
    } else if (moduleName.includes('model') || moduleName.includes('type') || moduleName.includes('interface')) {
      // Типы и модели
      locations.push(`./types/${moduleName}`, `./models/${moduleName}`);
    } else if (moduleName.includes('context') || moduleName.includes('provider')) {
      // Контексты и провайдеры
      locations.push(`./contexts/${moduleName}`, `./providers/${moduleName}`);
    } else if (moduleName.includes('store') || moduleName.includes('reducer')) {
      // Redux-связанные файлы
      locations.push(`./store/${moduleName}`, `./reducers/${moduleName}`);
    }
    
    return locations;
  }
};

/**
 * Анализирует импорты в файле и возвращает информацию об импортированных компонентах
 * @param fileText Текст файла
 */
function analyzeImports(fileText: string): Array<{
  name: string;
  path: string;
  isComponent: boolean;
  isHook: boolean;
  description?: string;
  props?: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
    snippet?: string;
  }>;
}> {
  const result: Array<{
    name: string;
    path: string;
    isComponent: boolean;
    isHook: boolean;
    description?: string;
    props?: Array<{
      name: string;
      type?: string;
      description?: string;
      required?: boolean;
      snippet?: string;
    }>;
  }> = [];
  
  // Регулярное выражение для поиска импортов
  const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(fileText)) !== null) {
    const namedImports = match[1];
    const namespaceImport = match[2];
    const defaultImport = match[3];
    const path = match[4];
    
    // Обрабатываем именованные импорты
    if (namedImports) {
      const importNames = namedImports.split(',').map(name => name.trim());
      
      for (const importItem of importNames) {
        // Обрабатываем переименования (например: { Button as CustomButton })
        const asMatch = importItem.match(/([a-zA-Z0-9_$]+)\s+as\s+([a-zA-Z0-9_$]+)/);
        
        const originalName = asMatch ? asMatch[1] : importItem;
        const importName = asMatch ? asMatch[2] : importItem;
        
        const isComponent = /^[A-Z]/.test(importName); // Компоненты начинаются с большой буквы
        const isHook = importName.startsWith('use') && /[A-Z]/.test(importName.slice(3)); // Хуки начинаются с "use" и содержат camelCase
        
        // Получаем описание и пропсы для этого импорта
        const componentInfo = getComponentInfo(importName, path);
        
        result.push({
          name: importName,
          path,
          isComponent,
          isHook,
          description: componentInfo.description,
          props: isComponent ? componentInfo.props : undefined
        });
      }
    }
    
    // Обрабатываем дефолтный импорт
    if (defaultImport) {
      const isComponent = /^[A-Z]/.test(defaultImport);
      const isHook = defaultImport.startsWith('use') && /[A-Z]/.test(defaultImport.slice(3));
      
      const componentInfo = getComponentInfo(defaultImport, path);
      
      result.push({
        name: defaultImport,
        path,
        isComponent,
        isHook,
        description: componentInfo.description,
        props: isComponent ? componentInfo.props : undefined
      });
    }
    
    // Обрабатываем импорт всего модуля (*) - не добавляем в результаты
  }
  
  return result;
}

/**
 * Получает информацию о компоненте на основе его имени и пути
 * @param name Имя компонента
 * @param path Путь импорта
 */
function getComponentInfo(name: string, path: string): {
  description: string;
  props: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
    snippet?: string;
  }>;
} {
  // В реальном приложении здесь можно было бы использовать:
  // 1. Анализ TypeScript типов через TypeScript API
  // 2. Предварительно созданный каталог компонентов с метаданными
  // 3. Запросы к серверу для получения информации о компоненте
  
  // Для демонстрации используем заранее определенный набор популярных компонентов
  const knownComponents: Record<string, {
    description: string;
    props: Array<{
      name: string;
      type?: string;
      description?: string;
      required?: boolean;
      snippet?: string;
    }>;
  }> = {
    'Button': {
      description: 'Кнопка с возможностью кастомизации стилей и обработки событий',
      props: [
        { name: 'onClick', type: '() => void', description: 'Обработчик клика по кнопке', snippet: 'onClick={() => $0}' },
        { name: 'disabled', type: 'boolean', description: 'Отключает кнопку', snippet: 'disabled={$0}' },
        { name: 'variant', type: '"primary" | "secondary" | "outlined"', description: 'Вариант отображения кнопки', snippet: 'variant="$0"' },
        { name: 'size', type: '"small" | "medium" | "large"', description: 'Размер кнопки', snippet: 'size="$0"' },
        { name: 'className', type: 'string', description: 'Дополнительные CSS классы', snippet: 'className="$0"' }
      ]
    },
    'Input': {
      description: 'Поле ввода с поддержкой различных типов и валидации',
      props: [
        { name: 'value', type: 'string', description: 'Значение поля ввода', required: true, snippet: 'value={$0}' },
        { name: 'onChange', type: '(e: React.ChangeEvent<HTMLInputElement>) => void', description: 'Обработчик изменения значения', required: true, snippet: 'onChange={(e) => $0}' },
        { name: 'type', type: '"text" | "password" | "email" | "number"', description: 'Тип поля ввода', snippet: 'type="$0"' },
        { name: 'placeholder', type: 'string', description: 'Подсказка в пустом поле', snippet: 'placeholder="$0"' },
        { name: 'disabled', type: 'boolean', description: 'Отключает поле ввода', snippet: 'disabled={$0}' }
      ]
    },
    'Form': {
      description: 'Форма для сбора и отправки данных',
      props: [
        { name: 'onSubmit', type: '(e: React.FormEvent) => void', description: 'Обработчик отправки формы', required: true, snippet: 'onSubmit={(e) => {\n\te.preventDefault();\n\t$0\n}}' },
        { name: 'className', type: 'string', description: 'Дополнительные CSS классы', snippet: 'className="$0"' }
      ]
    },
    'Card': {
      description: 'Карточка для отображения контента с тенью и закругленными углами',
      props: [
        { name: 'title', type: 'string', description: 'Заголовок карточки', snippet: 'title="$0"' },
        { name: 'className', type: 'string', description: 'Дополнительные CSS классы', snippet: 'className="$0"' },
        { name: 'elevation', type: 'number', description: 'Уровень тени (1-5)', snippet: 'elevation={$0}' }
      ]
    },
    'Modal': {
      description: 'Модальное окно, которое отображается поверх основного контента',
      props: [
        { name: 'isOpen', type: 'boolean', description: 'Показывать ли модальное окно', required: true, snippet: 'isOpen={$0}' },
        { name: 'onClose', type: '() => void', description: 'Обработчик закрытия модального окна', required: true, snippet: 'onClose={() => $0}' },
        { name: 'title', type: 'string', description: 'Заголовок модального окна', snippet: 'title="$0"' }
      ]
    },
    'Dropdown': {
      description: 'Выпадающий список для выбора опций',
      props: [
        { name: 'options', type: 'Array<{ value: string, label: string }>', description: 'Массив опций для выбора', required: true, snippet: 'options={$0}' },
        { name: 'value', type: 'string', description: 'Текущее выбранное значение', required: true, snippet: 'value={$0}' },
        { name: 'onChange', type: '(value: string) => void', description: 'Обработчик изменения выбранной опции', required: true, snippet: 'onChange={(value) => $0}' },
        { name: 'placeholder', type: 'string', description: 'Подсказка при отсутствии выбранной опции', snippet: 'placeholder="$0"' }
      ]
    },
    
    // Добавляем пользовательские компоненты из примера
    'Background3D': {
      description: 'Трехмерный анимированный фон',
      props: [
        { name: 'color', type: 'string', description: 'Основной цвет фона', snippet: 'color="$0"' }
      ]
    },
    'AuthForm': {
      description: 'Форма аутентификации пользователя',
      props: [
        { name: 'onSubmit', type: '(data: AuthFormData) => void', description: 'Обработчик отправки формы', required: true, snippet: 'onSubmit={(data) => $0}' },
        { name: 'isLogin', type: 'boolean', description: 'Режим входа (true) или регистрации (false)', snippet: 'isLogin={$0}' }
      ]
    },
    'Notification': {
      description: 'Компонент для отображения уведомлений',
      props: [
        { name: 'message', type: 'string', description: 'Текст уведомления', required: true, snippet: 'message="$0"' },
        { name: 'type', type: '"success" | "error" | "warning" | "info"', description: 'Тип уведомления', snippet: 'type="$0"' },
        { name: 'duration', type: 'number', description: 'Продолжительность показа в миллисекундах', snippet: 'duration={$0}' }
      ]
    },
    'NotesPages': {
      description: 'Компонент для отображения страниц с заметками',
      props: [
        { name: 'userId', type: 'string', description: 'ID пользователя', snippet: 'userId="$0"' }
      ]
    },
    'TitleBar': {
      description: 'Панель заголовка окна',
      props: [
        { name: 'title', type: 'string', description: 'Текст заголовка', snippet: 'title="$0"' },
        { name: 'showControls', type: 'boolean', description: 'Показывать ли кнопки управления окном', snippet: 'showControls={$0}' }
      ]
    },
    'NoteEditor': {
      description: 'Редактор заметок с поддержкой форматирования',
      props: [
        { name: 'note', type: 'Note', description: 'Объект заметки для редактирования', required: true, snippet: 'note={$0}' },
        { name: 'onChange', type: '(note: Note) => void', description: 'Обработчик изменения заметки', required: true, snippet: 'onChange={(note) => $0}' },
        { name: 'readOnly', type: 'boolean', description: 'Режим только для чтения', snippet: 'readOnly={$0}' }
      ]
    }
  };
  
  // Ищем компонент в наших предопределенных данных
  if (knownComponents[name]) {
    return knownComponents[name];
  }
  
  // Если мы не нашли компонент, пытаемся определить его тип на основе имени и пути
  let description = 'Пользовательский компонент';
  const props: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
    snippet?: string;
  }> = [];
  
  // Анализируем имя для предположения типа компонента
  if (name.includes('Button')) {
    description = 'Компонент кнопки';
    props.push(
      { name: 'onClick', type: '() => void', description: 'Обработчик клика', snippet: 'onClick={() => $0}' },
      { name: 'disabled', type: 'boolean', description: 'Отключает кнопку', snippet: 'disabled={$0}' }
    );
  } else if (name.includes('Input') || name.includes('Field')) {
    description = 'Компонент поля ввода';
    props.push(
      { name: 'value', type: 'string', description: 'Значение поля', snippet: 'value={$0}' },
      { name: 'onChange', type: '(e) => void', description: 'Обработчик изменения', snippet: 'onChange={(e) => $0}' }
    );
  } else if (name.includes('Form')) {
    description = 'Компонент формы';
    props.push(
      { name: 'onSubmit', type: '(data) => void', description: 'Обработчик отправки', snippet: 'onSubmit={(data) => $0}' }
    );
  } else if (name.includes('Card')) {
    description = 'Карточка для отображения контента';
    props.push(
      { name: 'title', type: 'string', description: 'Заголовок карточки', snippet: 'title="$0"' }
    );
  } else if (name.includes('List')) {
    description = 'Компонент списка';
    props.push(
      { name: 'items', type: 'any[]', description: 'Элементы списка', snippet: 'items={$0}' },
      { name: 'renderItem', type: '(item) => ReactNode', description: 'Функция рендеринга элемента', snippet: 'renderItem={(item) => $0}' }
    );
  }
  
  // Общие пропсы, которые могут быть у многих компонентов
  props.push(
    { name: 'className', type: 'string', description: 'CSS классы', snippet: 'className="$0"' },
    { name: 'style', type: 'React.CSSProperties', description: 'Инлайн стили', snippet: 'style={$0}' }
  );
  
  return { description, props };
}

/**
 * Поиск файлов по частичному пути (аналог Everything)
 */
const FileSearchSystem = {
  // Кэш найденных файлов
  fileCache: new Map<string, string[]>(),
  
  // Эмуляция файловой системы для демонстрации (в реальности заменить на API)
  mockFileSystem: [
    '/C:/PROJECTS/X-Editor/src/components/Button/Button.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Button/Button.css',
    '/C:/PROJECTS/X-Editor/src/components/Input/Input.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Form/Form.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Notification/Notification.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Notification/Notification.css',
    '/C:/PROJECTS/X-Editor/src/components/Notification/NotificationContext.tsx',
    '/C:/PROJECTS/X-Editor/src/components/TitleBar/TitleBar.tsx',
    '/C:/PROJECTS/X-Editor/src/components/NotesPages/NotesPages.tsx',
    '/C:/PROJECTS/X-Editor/src/components/NotesPages/GroupNotes/components/NoteEditor.tsx',
    '/C:/PROJECTS/X-Editor/src/components/AuthForm/AuthForm.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Background3D/Background3D.tsx',
    '/C:/PROJECTS/X-Editor/src/utils/path-utils.ts',
    '/C:/PROJECTS/X-Editor/src/utils/file-utils.ts',
    '/C:/PROJECTS/X-Editor/src/services/api.ts',
    '/C:/PROJECTS/X-Editor/src/hooks/useData.ts',
    '/C:/PROJECTS/X-Editor/src/main-screen/centerContainer/monaco-advanced-config.ts',
    '/C:/PROJECTS/X-Editor/src/monaco-config/register-tsx.ts'
  ],
  
  /**
   * Поиск файлов по частичному пути
   * @param partialPath Частичный путь (например, "components\Notification")
   * @returns Массив полных путей к файлам, соответствующим шаблону
   */
  async searchFiles(partialPath: string): Promise<string[]> {
    console.log('Поиск файлов по частичному пути:', partialPath);
    
    // Нормализуем поисковый запрос
    const normalizedPath = partialPath.replace(/\\/g, '/').toLowerCase();
    
    // Проверяем кэш
    if (this.fileCache.has(normalizedPath)) {
      return this.fileCache.get(normalizedPath) || [];
    }
    
    // В реальном приложении здесь был бы запрос к API или использование
    // File System API для поиска файлов
    
    // Для демонстрации используем моковую файловую систему
    const results = this.mockFileSystem.filter(filePath => {
      return filePath.toLowerCase().includes(normalizedPath);
    });
    
    // Кэшируем результаты
    this.fileCache.set(normalizedPath, results);
    
    return results;
  },
  
  /**
   * Поиск файла по частичному пути и вывод полной информации о нем
   * @param partialPath Частичный путь к файлу
   * @returns Подробная информация о найденных файлах
   */
  async getFileInfo(partialPath: string): Promise<{
    fullPath: string;
    relativePath: string;
    directory: string;
    fileName: string;
    extension: string;
    exists: boolean;
  }[]> {
    const matchingFiles = await this.searchFiles(partialPath);
    
    const results = matchingFiles.map(fullPath => {
      // Разбираем путь
      const lastSlashIndex = fullPath.lastIndexOf('/');
      const directory = lastSlashIndex !== -1 ? fullPath.substring(0, lastSlashIndex) : '';
      const fileNameWithExt = lastSlashIndex !== -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;
      
      // Выделяем расширение
      const dotIndex = fileNameWithExt.lastIndexOf('.');
      const fileName = dotIndex !== -1 ? fileNameWithExt.substring(0, dotIndex) : fileNameWithExt;
      const extension = dotIndex !== -1 ? fileNameWithExt.substring(dotIndex) : '';
      
      // Вычисляем относительный путь относительно src
      const srcIndex = fullPath.indexOf('/src/');
      const relativePath = srcIndex !== -1 ? fullPath.substring(srcIndex + 4) : fullPath;
      
      return {
        fullPath,
        relativePath,
        directory,
        fileName,
        extension,
        exists: true // В реальном приложении нужно проверять существование файла
      };
    });
    
    return results;
  },
  
  /**
   * Форматирует результаты поиска для вывода в Monaco
   * @param results Результаты поиска
   * @returns Строка с форматированными результатами
   */
  formatSearchResults(results: {
    fullPath: string;
    relativePath: string;
    directory: string;
    fileName: string;
    extension: string;
    exists: boolean;
  }[]): string {
    if (results.length === 0) {
      return 'Файлы не найдены';
    }
    
    let output = `Найдено файлов: ${results.length}\n\n`;
    
    results.forEach((file, index) => {
      output += `${index + 1}. **${file.fileName}${file.extension}**\n`;
      output += `   Полный путь: \`${file.fullPath}\`\n`;
      output += `   Относительный путь: \`${file.relativePath}\`\n`;
      output += `   Директория: \`${file.directory}\`\n`;
      output += '\n';
    });
    
    return output;
  }
};

/**
 * Регистрирует команду поиска файлов в Monaco Editor
 * @param monacoInstance Экземпляр monaco
 * @param editor Экземпляр редактора Monaco
 */
function registerFileSearchCommand(monacoInstance: typeof monaco, editor: any) {
  if (!editor || !editor.addAction) {
    console.warn('Не удалось зарегистрировать команду поиска файлов: редактор не определен');
    return;
  }
  
  editor.addAction({
    id: 'search-files',
    label: 'Поиск файлов по частичному пути',
    keybindings: [
      // Ctrl+Shift+F или Cmd+Shift+F
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF
    ],
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run: function(editor: any) {
      // Получаем выделенный текст или текст под курсором
      const selection = editor.getSelection();
      const model = editor.getModel();
      let searchText = '';
      
      if (selection && !selection.isEmpty()) {
        searchText = model.getValueInRange(selection);
      } else {
        // Если нет выделения, пытаемся получить слово под курсором
        const position = editor.getPosition();
        const word = model.getWordAtPosition(position);
        
        if (word) {
          searchText = word.word;
        }
      }
      
      // Показываем диалог поиска
      searchFiles(editor, searchText);
    }
  });
  
  console.log('Команда поиска файлов зарегистрирована. Используйте Ctrl+Shift+F для поиска.');
}

/**
 * Выполняет поиск файлов и показывает результаты
 * @param editor Экземпляр редактора Monaco
 * @param initialQuery Начальный поисковый запрос
 */
async function searchFiles(editor: any, initialQuery: string = '') {
  // В реальном приложении здесь можно показать UI для ввода поискового запроса
  // Для демонстрации используем простой prompt
  const query = prompt('Введите частичный путь для поиска (например, components\\Notification):', initialQuery);
  
  if (!query) return;
  
  try {
    // Поиск файлов
    const results = await FileSearchSystem.getFileInfo(query);
    const formattedResults = FileSearchSystem.formatSearchResults(results);
    
    // В реальном приложении можно отобразить результаты в выпадающем меню или панели
    // Для демонстрации просто показываем alert
    alert(formattedResults);
    
    // Вывод в консоль для отладки
    console.log('Результаты поиска:', results);
  } catch (error) {
    console.error('Ошибка при поиске файлов:', error);
    alert(`Ошибка поиска: ${error}`);
  }
}

