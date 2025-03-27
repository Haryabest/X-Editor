import { Monaco } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';

// Базовые определения типов для часто используемых пакетов
const commonTypeDefs = `
  // Next.js
  declare module 'next' {
    import { NextPage, NextPageContext } from 'next/types';
    import { AppProps } from 'next/app';
    import { NextConfig } from 'next/config';
    
    export type { NextPage, NextPageContext, AppProps };
    export { default as default } from 'next/types';
    export { default as Head } from 'next/head';
    export { default as Link } from 'next/link';
    export { default as Router } from 'next/router';
    export { default as Image } from 'next/image';
    export { default as Script } from 'next/script';
    export { default as Document } from 'next/document';
    export { default as dynamic } from 'next/dynamic';
  }

  declare module 'next/types' {
    export type NextPage<P = {}, IP = P> = React.ComponentType<P> & {
      getInitialProps?(context: NextPageContext): IP | Promise<IP>;
    };
    
    export interface NextPageContext {
      pathname: string;
      query: Record<string, string | string[]>;
      asPath?: string;
      req?: any;
      res?: any;
      err?: any;
    }
  }

  declare module 'next/config' {
    export interface NextConfig {
      env?: Record<string, any>;
      webpack?: any;
      experimental?: Record<string, any>;
      [key: string]: any;
    }
    export default function getConfig(): { serverRuntimeConfig: any; publicRuntimeConfig: any };
  }

  declare module 'next/router' {
    export interface Router {
      route: string;
      pathname: string;
      query: Record<string, string | string[]>;
      asPath: string;
      push(url: string, as?: string): Promise<boolean>;
      replace(url: string, as?: string): Promise<boolean>;
      reload(): void;
      back(): void;
      prefetch(url: string): Promise<void>;
      beforePopState(cb: (state: any) => boolean): void;
      events: {
        on(event: string, handler: (...args: any[]) => void): void;
        off(event: string, handler: (...args: any[]) => void): void;
      };
    }
    export function useRouter(): Router;
  }

  // Lucide React
  declare module 'lucide-react' {
    import React from 'react';
    export interface IconProps extends React.SVGProps<SVGSVGElement> {
      size?: string | number;
      color?: string;
      strokeWidth?: string | number;
    }
    export const X: React.FC<IconProps>;
    export const Menu: React.FC<IconProps>;
    export const ChevronDown: React.FC<IconProps>;
    export const ChevronRight: React.FC<IconProps>;
    export const File: React.FC<IconProps>;
    export const Folder: React.FC<IconProps>;
    export const FolderOpen: React.FC<IconProps>;
    export const FilePlus: React.FC<IconProps>;
    export const RefreshCcw: React.FC<IconProps>;
    export const Settings: React.FC<IconProps>;
    export const Database: React.FC<IconProps>;
    export const FileText: React.FC<IconProps>;
    export const FileAudio: React.FC<IconProps>;
    export const FileVideo: React.FC<IconProps>;
    export const FileImage: React.FC<IconProps>;
    export const Minus: React.FC<IconProps>;
  }

  // Tailwind Merge
  declare module 'tailwind-merge' {
    export function twMerge(...classes: string[]): string;
  }

  // clsx
  declare module 'clsx' {
    export default function clsx(...inputs: any[]): string;
  }

  // @heroicons/react
  declare module '@heroicons/react/24/outline' {
    export const FolderPlusIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  }

  declare module '@heroicons/react/16/solid' {
    export const GifIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  }

  // react-icons
  declare module 'react-icons/fa' {
    export const FaRegFileWord: React.FC<React.SVGProps<SVGSVGElement>>;
    export const FaRegFilePdf: React.FC<React.SVGProps<SVGSVGElement>>;
    export const FaRegFilePowerpoint: React.FC<React.SVGProps<SVGSVGElement>>;
  }

  // @tauri-apps/api
  declare module '@tauri-apps/api/core' {
    export function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T>;
  }

  // Node.js модули
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

  // TailwindCSS
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
`;

// Определения для Node.js модулей
const nodeModuleDefs = `
  // Модули Node.js как глобальный неймспейс
  declare namespace NodeJS {
    interface Process {
      env: Record<string, string>;
      cwd(): string;
      platform: string;
      argv: string[];
      exit(code?: number): never;
    }
    
    interface Global {
      process: Process;
    }
  }

  // Глобальные определения
  declare const process: NodeJS.Process;
  declare const __dirname: string;
  declare const __filename: string;
  declare const require: (id: string) => any;
  declare const module: { exports: any };
`;

/**
 * Загружает типы из директории node_modules
 */
async function loadNodeModulesTypes(monaco: Monaco, basePath: string | null): Promise<void> {
  if (!basePath) return;
  
  try {
    // Проверяем наличие директории @types
    const typesPath = `${basePath}/node_modules/@types`;
    
    try {
      // Получаем список директорий в @types
      const typesDirs = await invoke<string[]>('list_directory', { path: typesPath });
      
      // Загружаем типы для каждого найденного пакета
      for (const typeDir of typesDirs) {
        if (typeDir === '.' || typeDir === '..') continue;
        
        try {
          // Проверяем наличие index.d.ts
          const indexDtsPath = `${typesPath}/${typeDir}/index.d.ts`;
          const content = await invoke<string>('read_text_file', { path: indexDtsPath });
          
          if (content) {
            // Добавляем типы в Monaco
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              content,
              `file:///node_modules/@types/${typeDir}/index.d.ts`
            );
            console.log(`Loaded types for @types/${typeDir}`);
          }
        } catch (error) {
          // Игнорируем ошибки для отдельных пакетов
          console.warn(`Could not load types for ${typeDir}:`, error);
        }
      }
    } catch (error) {
      console.warn('Could not access @types directory:', error);
    }
    
    // Также можно просканировать node_modules для модулей с собственными типами
    // Но это может быть тяжелой операцией, поэтому лучше делать это по запросу
  } catch (error) {
    console.error('Error loading types from node_modules:', error);
  }
}

/**
 * Проверяет наличие модуля в node_modules проекта
 * @param basePath Базовый путь проекта
 * @param moduleName Имя модуля для проверки
 */
async function checkModuleExists(basePath: string, moduleName: string): Promise<boolean> {
  try {
    // Проверяем наличие директории модуля
    const modulePath = `${basePath}/node_modules/${moduleName}`;
    const exists = await invoke<boolean>('check_path_exists', { path: modulePath });
    return exists;
  } catch (error) {
    console.warn(`Error checking for module ${moduleName}:`, error);
    return false;
  }
}

/**
 * Автоматически определяет и добавляет типы для распространённых зависимостей
 * @param monaco Monaco экземпляр
 * @param basePath Путь к корневой директории проекта
 */
async function detectAndAddCommonPackages(monaco: Monaco, basePath: string | null): Promise<void> {
  if (!basePath) return;
  
  // Список популярных пакетов для автоматического добавления типов
  const commonPackages = [
    { name: 'prisma/client', declaration: `
      declare module '@prisma/client' {
        export const PrismaClient: any;
        export type PrismaClient = any;
        export type Prisma = any;
      }
    `},
    { name: 'next', declaration: `
      declare module 'next' {
        export default function(options?: any): any;
        export type NextPage<P = {}, IP = P> = React.FC<P>;
        export type GetServerSideProps<P = {}> = (context: any) => Promise<{ props: P }>;
        export type GetStaticProps<P = {}> = (context: any) => Promise<{ props: P }>;
        export type GetStaticPaths = () => Promise<{ paths: any[], fallback: boolean | 'blocking' }>;
      }
      declare module 'next/app' {
        export type AppProps = any;
        export default function App(props: AppProps): JSX.Element;
      }
    `},
    { name: 'react', declaration: `
      declare module 'react' {
        export = React;
        export as namespace React;
        
        declare namespace React {
          export type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactFragment | React.ReactPortal;
          export interface ReactElement<P = any> {
            type: string | React.ComponentType<P>;
            props: P;
            key: string | number | null;
          }
          export type ComponentType<P = {}> = React.ComponentClass<P> | React.FunctionComponent<P>;
          export interface FunctionComponent<P = {}> {
            (props: P): ReactElement | null;
          }
          export const useState: <T>(initialState: T | (() => T)) => [T, (newState: T | ((prev: T) => T)) => void];
          export const useEffect: (effect: () => void | (() => void), deps?: readonly any[]) => void;
          export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: readonly any[]) => T;
          export const useMemo: <T>(factory: () => T, deps: readonly any[]) => T;
          export const useRef: <T>(initialValue: T) => { current: T };
        }
      }
    `},
    { name: 'mongoose', declaration: `
      declare module 'mongoose' {
        export function connect(uri: string, options?: any): Promise<any>;
        export function model<T>(name: string, schema: Schema): Model<T>;
        export class Schema {
          constructor(definition: any, options?: any);
        }
        export interface Model<T> {
          find(conditions: any): Promise<T[]>;
          findOne(conditions: any): Promise<T | null>;
          findById(id: any): Promise<T | null>;
          create(doc: any): Promise<T>;
          updateOne(conditions: any, doc: any): Promise<any>;
          deleteOne(conditions: any): Promise<any>;
        }
      }
    `},
    { name: 'express', declaration: `
      declare module 'express' {
        export default function(): any;
        export interface Request {
          params: any;
          query: any;
          body: any;
        }
        export interface Response {
          status(code: number): this;
          json(data: any): this;
          send(data: any): this;
        }
      }
    `}
  ];
  
  for (const pkg of commonPackages) {
    try {
      const exists = await checkModuleExists(basePath, pkg.name);
      
      if (exists) {
        // Если пакет найден, добавляем его типы
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          pkg.declaration,
          `file:///node_modules/${pkg.name}/index.d.ts`
        );
        console.log(`Added types for detected package: ${pkg.name}`);
      }
    } catch (error) {
      console.warn(`Error detecting package ${pkg.name}:`, error);
    }
  }
}

export async function configureTypes(monaco: Monaco, basePath: string | null = null) {
  // Базовая конфигурация компилятора
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowJs: true,
    typeRoots: ["node_modules/@types"],
    baseUrl: ".",
    paths: {
      "*": ["*", "src/*", "node_modules/*"],
      "@/*": ["./src/*"],
      "~/*": ["./*"]
    },
    jsxFactory: "React.createElement",
    jsxFragmentFactory: "React.Fragment",
    skipLibCheck: true
  });

  // Отключаем строгие проверки и игнорируем ошибку 2669
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006, 
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010
    ] // Игнорируем ошибки, которые мешают работе
  });

  // Добавляем глобальный модуль для корректной работы с глобальными типами
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `declare module 'global-env' {
      global {
        interface Window {
          monaco: any;
        }
      }
      export {};
    }`,
    'file:///node_modules/@types/global-env/index.d.ts'
  );

  // Добавляем Node.js определения
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    nodeModuleDefs,
    'file:///node_modules/@types/node/index.d.ts'
  );

  // Добавляем встроенные определения типов
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    commonTypeDefs,
    'file:///node_modules/@types/common/index.d.ts'
  );

  // Добавляем базовые объявления типов
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    commonTypeDefs,
    'file:///common-typedefs.d.ts'
  );

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    nodeModuleDefs,
    'file:///node-modules.d.ts'
  );

  // Автоматическое определение и добавление типов для распространённых пакетов
  await detectAndAddCommonPackages(monaco, basePath);

  // Добавляем расширенные типы React
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `declare namespace JSX {
      interface Element {}
      interface IntrinsicElements {
        // HTML элементы с детальными атрибутами
        div: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        span: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        p: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        a: { className?: string; onClick?: (e: any) => void; href?: string; style?: any; [key: string]: any };
        button: { className?: string; onClick?: (e: any) => void; type?: string; disabled?: boolean; style?: any; [key: string]: any };
        input: { className?: string; onChange?: (e: any) => void; value?: any; type?: string; placeholder?: string; style?: any; [key: string]: any };
        textarea: { className?: string; onChange?: (e: any) => void; value?: any; placeholder?: string; style?: any; [key: string]: any };
        select: { className?: string; onChange?: (e: any) => void; value?: any; style?: any; [key: string]: any };
        option: { className?: string; value?: any; style?: any; [key: string]: any };
        form: { className?: string; onSubmit?: (e: any) => void; style?: any; [key: string]: any };
        img: { className?: string; src?: string; alt?: string; style?: any; [key: string]: any };
        h1: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        h2: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        h3: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        h4: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        h5: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        h6: { className?: string; onClick?: (e: any) => void; style?: any; [key: string]: any };
        hr: { className?: string; style?: any; [key: string]: any };
        br: { className?: string; style?: any; [key: string]: any };
        table: { className?: string; style?: any; [key: string]: any };
        thead: { className?: string; style?: any; [key: string]: any };
        tbody: { className?: string; style?: any; [key: string]: any };
        tr: { className?: string; style?: any; [key: string]: any };
        td: { className?: string; style?: any; [key: string]: any };
        th: { className?: string; style?: any; [key: string]: any };
        ul: { className?: string; style?: any; [key: string]: any };
        ol: { className?: string; style?: any; [key: string]: any };
        li: { className?: string; style?: any; [key: string]: any };
        nav: { className?: string; style?: any; [key: string]: any };
        main: { className?: string; style?: any; [key: string]: any };
        section: { className?: string; style?: any; [key: string]: any };
        article: { className?: string; style?: any; [key: string]: any };
        header: { className?: string; style?: any; [key: string]: any };
        footer: { className?: string; style?: any; [key: string]: any };
        // Добавьте другие HTML элементы по необходимости
      }
    }

    declare namespace React {
      interface Component<P = {}, S = {}> {
        render(): JSX.Element | null;
      }
      
      interface FC<P = {}> {
        (props: P): JSX.Element | null;
      }
      
      interface HTMLAttributes<T> {
        className?: string;
        style?: any;
        onClick?: (event: any) => void;
        // Добавьте другие атрибуты по необходимости
      }
      
      function createElement(type: any, props?: any, ...children: any[]): JSX.Element;
      function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
      function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      
      export = React;
      export as namespace React;
    }
    `,
    'file:///node_modules/@types/react/index.d.ts'
  );
  
  // Загружаем типы из node_modules, если доступен путь
  if (basePath) {
    await loadNodeModulesTypes(monaco, basePath);
  }
}