import { Monaco } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types';

// Глобальные определения типов для JavaScript файлов
// Эти определения помогут избежать ошибок 8016 (Type assertion expressions can only be used in TypeScript files)
declare global {
  // Определяем HTML элементы
  interface HTMLElement {
    id?: string;
    className?: string;
    style?: CSSStyleDeclaration;
  }
}

// Регулярное выражение для поиска импортов
const importRegex = /import\s+(?:(?:(?:{[^}]*}|\*\s+as\s+[^,]*|[^\s,]*)\s*,?\s*)(?:,\s*(?:{[^}]*}|\*\s+as\s+[^,]*|[^\s,]*))*\s*from\s+)?['"]([^'"]+)['"]/g;

/**
 * Извлекает имена модулей из импортов в коде
 */
function extractImportedModules(code: string): string[] {
  const modules: string[] = [];
  let match;
  
  while ((match = importRegex.exec(code)) !== null) {
    const moduleName = match[1].trim();
    // Исключаем относительные импорты
    if (!moduleName.startsWith('./') && !moduleName.startsWith('../') && !moduleName.startsWith('/')) {
      // Получаем базовое имя модуля (без пути)
      const baseModule = moduleName.split('/')[0];
      if (!modules.includes(baseModule)) {
        modules.push(baseModule);
      }
    }
  }
  
  return modules;
}

/**
 * Добавляет базовые определения типов для часто используемых модулей
 */
function addCommonModuleTypes(monaco: Monaco, moduleName: string) {
  // Базовые определения для распространенных модулей
  const moduleDefinitions: Record<string, string> = {
    'react': `
      declare module 'react' {
        namespace React {
          type ReactNode = any;
          interface Component<P = {}, S = {}> {
            props: P;
            state: S;
            setState(state: S | ((prevState: S) => S), callback?: () => void): void;
            forceUpdate(callback?: () => void): void;
            render(): ReactNode;
          }
          function createElement(type: any, props?: any, ...children: any[]): any;
          function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          function useContext<T>(context: any): T;
          function useRef<T>(initialValue: T): { current: T };
          function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          function useMemo<T>(factory: () => T, deps: any[]): T;
          
          // HTML элементы для JSX
          interface HTMLAttributes {
            className?: string;
            style?: any;
            onClick?: (event: any) => void;
            onChange?: (event: any) => void;
            onSubmit?: (event: any) => void;
            onKeyDown?: (event: any) => void;
            id?: string;
            title?: string;
          }
        }
        
        namespace JSX {
          interface Element {}
          interface IntrinsicElements {
            div: React.HTMLAttributes;
            span: React.HTMLAttributes;
            p: React.HTMLAttributes;
            a: React.HTMLAttributes;
            button: React.HTMLAttributes;
            input: React.HTMLAttributes;
            img: React.HTMLAttributes;
            h1: React.HTMLAttributes;
            h2: React.HTMLAttributes;
            h3: React.HTMLAttributes;
            form: React.HTMLAttributes;
          }
        }
        
        export = React;
        export as namespace React;
      }
    `,
    'react-dom': `
      declare module 'react-dom' {
        import * as React from 'react';
        function render(element: React.ReactNode, container: Element): void;
        function unmountComponentAtNode(container: Element): boolean;
        function createPortal(children: React.ReactNode, container: Element): React.ReactNode;
        export = { render, unmountComponentAtNode, createPortal };
      }
    `,
    'next': `
      declare module 'next' {
        export interface NextConfig {
          env?: Record<string, any>;
          webpack?: any;
          experimental?: Record<string, any>;
          [key: string]: any;
        }
        export * from 'next/document';
        export * from 'next/app';
        export * from 'next/link';
        export * from 'next/image';
        export * from 'next/router';
      }
      declare module 'next/app' {
        import * as React from 'react';
        export interface AppProps {
          Component: React.ComponentType<any>;
          pageProps: any;
        }
        export default class App<P = {}> extends React.Component<P> {}
      }
      declare module 'next/document' {
        import * as React from 'react';
        export default class Document extends React.Component {}
      }
      declare module 'next/link' {
        import * as React from 'react';
        export interface LinkProps {
          href: string | { pathname: string; query?: any };
          as?: string;
          replace?: boolean;
          scroll?: boolean;
          shallow?: boolean;
          passHref?: boolean;
          prefetch?: boolean;
        }
        export default class Link extends React.Component<LinkProps> {}
      }
      declare module 'next/router' {
        export function useRouter(): {
          route: string;
          pathname: string;
          query: Record<string, string>;
          asPath: string;
          push(url: string, as?: string): Promise<boolean>;
          replace(url: string, as?: string): Promise<boolean>;
          reload(): void;
          back(): void;
          prefetch(url: string): Promise<void>;
          events: {
            on(event: string, handler: Function): void;
            off(event: string, handler: Function): void;
          };
        };
      }
      declare module 'next/image' {
        import * as React from 'react';
        export interface ImageProps {
          src: string | { src: string; height?: number; width?: number };
          alt: string;
          width?: number;
          height?: number;
          layout?: 'fixed' | 'intrinsic' | 'responsive' | 'fill';
          priority?: boolean;
          loading?: 'lazy' | 'eager';
          quality?: number;
        }
        export default function Image(props: ImageProps): JSX.Element;
      }
    `,
    'lucide-react': `
      declare module 'lucide-react' {
        import * as React from 'react';
        export interface IconProps extends React.SVGProps<SVGSVGElement> {
          size?: string | number;
          color?: string;
          strokeWidth?: string | number;
        }
        export const X: React.FC<IconProps>;
        export const Menu: React.FC<IconProps>;
        export const ChevronDown: React.FC<IconProps>;
        export const ChevronUp: React.FC<IconProps>;
        export const ChevronLeft: React.FC<IconProps>;
        export const ChevronRight: React.FC<IconProps>;
        export const File: React.FC<IconProps>;
        export const Folder: React.FC<IconProps>;
        export const Search: React.FC<IconProps>;
        export const Settings: React.FC<IconProps>;
        export const Edit: React.FC<IconProps>;
        export const Trash: React.FC<IconProps>;
        export const Plus: React.FC<IconProps>;
        export const Minus: React.FC<IconProps>;
        export const Download: React.FC<IconProps>;
        export const Upload: React.FC<IconProps>;
        // Обобщенный экспорт для других иконок
        export const icons: Record<string, React.FC<IconProps>>;
      }
    `,
    '@tauri-apps/api': `
      declare module '@tauri-apps/api/core' {
        export function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T>;
      }
      declare module '@tauri-apps/plugin-dialog' {
        export function open(options?: { directory?: boolean, multiple?: boolean, filters?: any[] }): Promise<string | string[] | null>;
        export function save(options?: { defaultPath?: string, filters?: any[] }): Promise<string | null>;
      }
      declare module '@tauri-apps/api/fs' {
        export function readTextFile(path: string): Promise<string>;
        export function writeTextFile(path: string, contents: string): Promise<void>;
        export function readBinaryFile(path: string): Promise<Uint8Array>;
      }
    `,
    'tailwind-merge': `
      declare module 'tailwind-merge' {
        export function twMerge(...classes: string[]): string;
        export function twJoin(...classes: (string | undefined | null | false)[]): string;
      }
    `,
    'clsx': `
      declare module 'clsx' {
        export default function clsx(...inputs: (string | number | boolean | undefined | null | { [key: string]: any })[]): string;
      }
    `,
    // Node.js модули
    'path': `
      declare module 'path' {
        export function join(...paths: string[]): string;
        export function resolve(...paths: string[]): string;
        export function dirname(path: string): string;
        export function basename(path: string, ext?: string): string;
        export function extname(path: string): string;
        export function parse(path: string): { root: string; dir: string; base: string; ext: string; name: string; };
        export function format(pathObject: { root?: string; dir?: string; base?: string; ext?: string; name?: string; }): string;
        export function isAbsolute(path: string): boolean;
        export function relative(from: string, to: string): string;
        export function normalize(path: string): string;
        export const sep: string;
        export const delimiter: string;
      }
    `,
    'fs': `
      declare module 'fs' {
        export function readFileSync(path: string, options?: { encoding?: string; flag?: string; } | string): string | Buffer;
        export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string; } | string): void;
        export function existsSync(path: string): boolean;
        export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number; } | number): void;
        export function readdirSync(path: string, options?: { encoding?: string; withFileTypes?: boolean; } | string): string[] | any[];
        export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean; };
        export function unlinkSync(path: string): void;
        export function rmdirSync(path: string, options?: { recursive?: boolean; }): void;
      }
    `,
    // TailwindCSS
    'tailwindcss': `
      declare module 'tailwindcss' {
        interface TailwindConfig {
          content?: string[];
          theme?: {
            extend?: Record<string, any>;
            [key: string]: any;
          };
          plugins?: any[];
          [key: string]: any;
        }
        
        function tailwindcss(config?: TailwindConfig): any;
        export = tailwindcss;
      }
      
      declare module 'tailwindcss/plugin' {
        function plugin(pluginFunction: (api: any) => void): any;
        export = plugin;
      }
    `
  };

  // Добавляем определение типов для модуля, если оно есть в нашем списке
  if (moduleDefinitions[moduleName]) {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      moduleDefinitions[moduleName],
      `file:///node_modules/${moduleName}/index.d.ts`
    );
    return true;
  }
  
  return false;
}

/**
 * Проверяет наличие модуля в node_modules и возвращает путь к его типам
 */
async function findModuleTypes(moduleName: string, basePath: string | null): Promise<string | null> {
  if (!basePath) return null;
  
  try {
    // Проверяем наличие модуля в node_modules
    const modulePath = `${basePath}/node_modules/${moduleName}`;
    let typesContent = null;
    
    // Варианты путей для поиска типов
    const typePaths = [
      // Встроенные типы в самом модуле
      `${modulePath}/index.d.ts`,
      `${modulePath}/dist/index.d.ts`,
      `${modulePath}/lib/index.d.ts`,
      `${modulePath}/types/index.d.ts`,
      
      // Типы в @types
      `${basePath}/node_modules/@types/${moduleName}/index.d.ts`,
      `${basePath}/node_modules/@types/${moduleName.replace('@', '').replace('/', '__')}/index.d.ts`,
    ];
    
    // Ищем файл типов по всем возможным путям
    for (const typePath of typePaths) {
      try {
        typesContent = await invoke('read_text_file', { path: typePath });
        if (typesContent) {
          console.log(`Found types for ${moduleName} at ${typePath}`);
          return typesContent as string;
        }
      } catch (e) {
        // Игнорируем ошибки - просто переходим к следующему пути
      }
    }
  } catch (error) {
    console.warn(`Error looking for types for ${moduleName}:`, error);
  }
  
  return null;
}

/**
 * Добавляет определения типов из node_modules
 */
async function addNodeModuleTypes(monaco: Monaco, moduleName: string, basePath: string | null): Promise<boolean> {
  // Сначала проверяем, есть ли у нас встроенные определения
  const added = addCommonModuleTypes(monaco, moduleName);
  if (added) return true;
  
  // Если нет встроенных определений, пробуем найти в node_modules
  if (basePath) {
    const typesContent = await findModuleTypes(moduleName, basePath);
    if (typesContent) {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        typesContent,
        `file:///node_modules/${moduleName}/index.d.ts`
      );
      return true;
    }
  }
  
  return false;
}

/**
 * Автоматически определяет и добавляет типы для импортированных модулей
 */
export async function setupAutoTypes(monaco: Monaco, openedFiles: FileItem[]) {
  try {
    // Набор уже обработанных модулей
    const processedModules = new Set<string>();
    
    // Находим базовый путь проекта (для доступа к node_modules)
    const basePath = openedFiles.length > 0 && openedFiles[0].path 
      ? openedFiles[0].path.split('src')[0] || null
      : null;
    
    console.log("Base project path:", basePath);
    
    // Предварительно добавляем часто используемые модули для ускорения работы
    const commonModules = ['react', 'react-dom', 'next', 'lucide-react', 'tailwind-merge', 'clsx', 'path', 'fs', 'tailwindcss'];
    for (const moduleName of commonModules) {
      await addNodeModuleTypes(monaco, moduleName, basePath);
      processedModules.add(moduleName);
    }
    
    // Отключаем ошибки, которые часто возникают при работе с модулями
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      ...monaco.languages.typescript.typescriptDefaults.getDiagnosticsOptions(),
      diagnosticCodesToIgnore: [2669, 1046, 2307]
    });
    
    // Создаем массив промисов для параллельной обработки файлов
    const filePromises = [];
    
    // Обрабатываем каждый открытый файл
    for (const file of openedFiles) {
      if ((file as any).isDirectory) continue;
      
      // Читаем только TypeScript/JavaScript файлы
      if (!/\.(ts|tsx|js|jsx)$/i.test(file.path)) continue;
      
      // Запускаем обработку каждого файла в отдельном промисе
      filePromises.push((async () => {
        try {
          // Используем Promise.race для добавления таймаута к чтению файла
          const contentPromise = invoke('read_text_file', { path: file.path });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('File read timeout')), 2000)
          );
          
          const content = await Promise.race([contentPromise, timeoutPromise]) as string;
          
          // Извлекаем импортированные модули
          const modules = extractImportedModules(content);
          
          // Добавляем типы для каждого модуля
          for (const moduleName of modules) {
            if (!processedModules.has(moduleName)) {
              const added = await addNodeModuleTypes(monaco, moduleName, basePath);
              if (added) {
                processedModules.add(moduleName);
              }
            }
          }
        } catch (error) {
          // Просто логируем ошибку и продолжаем работу
          console.warn(`Skipping file analysis for ${file.path}:`, error);
        }
      })());
    }
    
    // Ждем завершения обработки всех файлов, но не блокируем продолжение работы при ошибках
    await Promise.allSettled(filePromises);
    
  } catch (error) {
    console.error('Error setting up auto types:', error);
  }
} 