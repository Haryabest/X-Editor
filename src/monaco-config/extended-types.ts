export const extendedTypes = `
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
    
    interface IntrinsicElements {
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
      svg: any;
      path: any;
      circle: any;
      rect: any;
      line: any;
      g: any;
      iframe: any;
    }
  }

  // Определения для React и React DOM
  declare namespace React {
    type ReactNode = any;
    type ReactElement = any;
    type FC<P = {}> = (props: P) => ReactElement | null;
    type FunctionComponent<P = {}> = (props: P) => ReactElement | null;
    type CSSProperties = any;
    type RefObject<T> = { current: T | null };
    type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
    type ComponentType<P = any> = any;
    type SVGProps<T> = any;
    type Context<T> = any;
    type Component<P = {}, S = {}> = any;
    type ReactPortal = any;
    
    // События React
    interface SyntheticEvent<T = Element, E = Event> {
      nativeEvent: E;
      currentTarget: T;
      target: EventTarget;
      bubbles: boolean;
      cancelable: boolean;
      defaultPrevented: boolean;
      eventPhase: number;
      isTrusted: boolean;
      preventDefault(): void;
      isDefaultPrevented(): boolean;
      stopPropagation(): void;
      isPropagationStopped(): boolean;
      persist(): void;
      timeStamp: number;
      type: string;
    }
    
    interface MouseEvent<T = Element> extends SyntheticEvent<T> {
      altKey: boolean;
      button: number;
      buttons: number;
      clientX: number;
      clientY: number;
      ctrlKey: boolean;
      metaKey: boolean;
      movementX: number;
      movementY: number;
      pageX: number;
      pageY: number;
      relatedTarget: EventTarget | null;
      screenX: number;
      screenY: number;
      shiftKey: boolean;
    }
    
    interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
      altKey: boolean;
      charCode: number;
      ctrlKey: boolean;
      code: string;
      key: string;
      keyCode: number;
      locale: string;
      location: number;
      metaKey: boolean;
      repeat: boolean;
      shiftKey: boolean;
      which: number;
    }
    
    interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
      target: EventTarget & T;
    }
    
    interface FormEvent<T = Element> extends SyntheticEvent<T> {}
    
    interface FocusEvent<T = Element> extends SyntheticEvent<T> {
      relatedTarget: EventTarget | null;
    }
    
    // Атрибуты HTML элементов
    interface HTMLAttributes<T> {
      className?: string;
      style?: CSSProperties;
      id?: string;
      onClick?: (event: MouseEvent<T>) => void;
      onMouseDown?: (event: MouseEvent<T>) => void;
      onMouseUp?: (event: MouseEvent<T>) => void;
      onMouseMove?: (event: MouseEvent<T>) => void;
      onKeyDown?: (event: KeyboardEvent<T>) => void;
      onKeyUp?: (event: KeyboardEvent<T>) => void;
      onKeyPress?: (event: KeyboardEvent<T>) => void;
      onChange?: (event: ChangeEvent<T>) => void;
      onSubmit?: (event: FormEvent<T>) => void;
      onFocus?: (event: FocusEvent<T>) => void;
      onBlur?: (event: FocusEvent<T>) => void;
      [key: string]: any;
    }
  }
  
  declare module 'react' {
    export = React;
  }
  
  declare module 'react-dom' {
    export function render(element: React.ReactElement, container: Element | DocumentFragment, callback?: () => void): void;
    export function hydrate(element: React.ReactElement, container: Element | DocumentFragment, callback?: () => void): void;
    export function createPortal(children: React.ReactNode, container: Element): React.ReactPortal;
    export function unmountComponentAtNode(container: Element): boolean;
    export function findDOMNode(component: React.Component<any, any> | Element | null | undefined): Element | null | Text;
    export function createRoot(container: Element | DocumentFragment): {
      render(element: React.ReactElement): void;
      unmount(): void;
    };
    export const version: string;
  }
  
  declare module 'react-dom/client' {
    export function createRoot(container: Element | DocumentFragment): {
      render(element: React.ReactElement): void;
      unmount(): void;
    };
    export function hydrateRoot(container: Element | DocumentFragment, initialChildren: React.ReactElement): {
      render(element: React.ReactElement): void;
      unmount(): void;
    };
  }
  
  // Определение для vite и vite/client
  declare module 'vite' {
    export interface UserConfig {
      plugins?: any[];
      root?: string;
      base?: string;
      mode?: string;
      define?: Record<string, any>;
      publicDir?: string;
      cacheDir?: string;
      resolve?: {
        alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
        dedupe?: string[];
        conditions?: string[];
        mainFields?: string[];
        extensions?: string[];
      };
      css?: Record<string, any>;
      json?: {
        namedExports?: boolean;
        stringify?: boolean;
      };
      esbuild?: Record<string, any> | false;
      assetsInclude?: string | RegExp | (string | RegExp)[];
      clearScreen?: boolean;
      server?: {
        host?: string;
        port?: number;
        strictPort?: boolean;
        https?: boolean | Record<string, any>;
        open?: boolean | string;
        proxy?: Record<string, string | Record<string, any>>;
        cors?: boolean | Record<string, any>;
        headers?: Record<string, string>;
      };
      build?: {
        target?: string | string[];
        outDir?: string;
        assetsDir?: string;
        assetsInlineLimit?: number;
        cssCodeSplit?: boolean;
        sourcemap?: boolean | 'inline' | 'hidden';
        rollupOptions?: Record<string, any>;
        lib?: {
          entry: string;
          name?: string;
          formats?: ('es' | 'cjs' | 'umd' | 'iife')[];
        };
        manifest?: boolean;
        ssrManifest?: boolean;
        emptyOutDir?: boolean;
        brotliSize?: boolean;
        chunkSizeWarningLimit?: number;
        watch?: Record<string, any> | null;
      };
      preview?: {
        host?: string;
        port?: number;
        strictPort?: boolean;
        https?: boolean | Record<string, any>;
        open?: boolean | string;
        proxy?: Record<string, string | Record<string, any>>;
        cors?: boolean | Record<string, any>;
      };
      optimizeDeps?: {
        entries?: string | string[];
        exclude?: string[];
        include?: string[];
        keepNames?: boolean;
      };
      ssr?: {
        external?: string[];
        noExternal?: string | RegExp | (string | RegExp)[];
        target?: 'node' | 'webworker';
      };
    }
    
    export function defineConfig(config: UserConfig): UserConfig;
    export function createServer(config?: UserConfig): Promise<any>;
    export function build(config?: UserConfig): Promise<any>;
    export function preview(config?: UserConfig): Promise<any>;
  }
  
  declare module 'vite/client' {
    interface ImportMetaEnv {
      [key: string]: string | boolean | undefined;
      BASE_URL: string;
      MODE: string;
      DEV: boolean;
      PROD: boolean;
      SSR: boolean;
    }
    
    interface ImportMeta {
      url: string;
      env: ImportMetaEnv;
      hot: {
        accept: (callback?: (modules: any[]) => void) => void;
        accept: (dependencies: string[], callback: (modules: any[]) => void) => void;
        dispose: (callback: (data: any) => void) => void;
        prune: (callback: (data: any) => void) => void;
        invalidate: () => void;
        decline: () => void;
        on: (event: string, callback: (...args: any[]) => void) => void;
        send: (event: string, data?: any) => void;
        data: any;
      };
      glob: (pattern: string) => Record<string, () => Promise<any>>;
      globEager: (pattern: string) => Record<string, any>;
    }
  }
  
  // Определения для Tauri
  declare module '@tauri-apps/api' {
    export * from '@tauri-apps/api/core';
    export * from '@tauri-apps/api/dialog';
    export * from '@tauri-apps/api/fs';
    export * from '@tauri-apps/api/path';
    export * from '@tauri-apps/api/window';
    export * from '@tauri-apps/api/shell';
    export * from '@tauri-apps/api/notification';
    export * from '@tauri-apps/api/clipboard';
  }
  
  declare module '@tauri-apps/api/core' {
    export function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T>;
    export function convertFileSrc(filePath: string, protocol?: string): string;
    export function transformCallback<T extends (...args: any[]) => any>(callback: T): number;
    export function promisified<T>(arg: any): Promise<T>;
    export function tauri<T>(command: string, args?: Record<string, any>): Promise<T>;
  }
  
  declare module '@tauri-apps/api/dialog' {
    export interface OpenDialogOptions {
      directory?: boolean;
      multiple?: boolean;
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
      recursive?: boolean;
      title?: string;
    }
    
    export interface SaveDialogOptions {
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
      title?: string;
    }
    
    export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;
    export function save(options?: SaveDialogOptions): Promise<string | null>;
    export function message(message: string, options?: { title?: string; type?: 'info' | 'warning' | 'error' }): Promise<void>;
    export function ask(message: string, options?: { title?: string; type?: 'info' | 'warning' | 'error' }): Promise<boolean>;
    export function confirm(message: string, options?: { title?: string; type?: 'info' | 'warning' | 'error' }): Promise<boolean>;
  }
  
  declare module '@tauri-apps/api/fs' {
    export function readTextFile(path: string, options?: { encoding?: string }): Promise<string>;
    export function readBinaryFile(path: string): Promise<Uint8Array>;
    export function writeTextFile(path: string, contents: string, options?: { encoding?: string }): Promise<void>;
    export function writeBinaryFile(path: string, contents: Uint8Array): Promise<void>;
    export function readDir(path: string, options?: { recursive?: boolean }): Promise<{ path: string; name?: string; children?: any[] }[]>;
    export function createDir(path: string, options?: { recursive?: boolean }): Promise<void>;
    export function removeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
    export function copyFile(source: string, destination: string): Promise<void>;
    export function removeFile(path: string): Promise<void>;
    export function renameFile(oldPath: string, newPath: string): Promise<void>;
  }
  
  declare module '@tauri-apps/api/path' {
    export function appDir(): Promise<string>;
    export function audioDir(): Promise<string>;
    export function cacheDir(): Promise<string>;
    export function configDir(): Promise<string>;
    export function dataDir(): Promise<string>;
    export function desktopDir(): Promise<string>;
    export function documentDir(): Promise<string>;
    export function downloadDir(): Promise<string>;
    export function executableDir(): Promise<string>;
    export function fontDir(): Promise<string>;
    export function homeDir(): Promise<string>;
    export function localDataDir(): Promise<string>;
    export function pictureDir(): Promise<string>;
    export function publicDir(): Promise<string>;
    export function resourceDir(): Promise<string>;
    export function runtimeDir(): Promise<string>;
    export function templateDir(): Promise<string>;
    export function videoDir(): Promise<string>;
    export function basename(path: string): Promise<string>;
    export function dirname(path: string): Promise<string>;
    export function extname(path: string): Promise<string>;
    export function isAbsolute(path: string): Promise<boolean>;
    export function join(...paths: string[]): Promise<string>;
    export function normalize(path: string): Promise<string>;
    export function resolve(...paths: string[]): Promise<string>;
  }
  
  declare module '@tauri-apps/api/window' {
    export interface WindowOptions {
      url?: string;
      title?: string;
      width?: number;
      height?: number;
      minWidth?: number;
      minHeight?: number;
      maxWidth?: number;
      maxHeight?: number;
      resizable?: boolean;
      fullscreen?: boolean;
      transparent?: boolean;
      maximized?: boolean;
      visible?: boolean;
      decorations?: boolean;
      alwaysOnTop?: boolean;
      skipTaskbar?: boolean;
      center?: boolean;
      x?: number;
      y?: number;
      fileDropEnabled?: boolean;
    }
    
    export interface WebviewWindow {
      label: string;
      listen<T>(event: string, handler: (event: T) => void): Promise<() => void>;
      once<T>(event: string, handler: (event: T) => void): Promise<() => void>;
      emit(event: string, payload?: any): Promise<void>;
      setTitle(title: string): Promise<void>;
      title(): Promise<string>;
      maximize(): Promise<void>;
      unmaximize(): Promise<void>;
      isMaximized(): Promise<boolean>;
      minimize(): Promise<void>;
      unminimize(): Promise<void>;
      isMinimized(): Promise<boolean>;
      setFullscreen(fullscreen: boolean): Promise<void>;
      isFullscreen(): Promise<boolean>;
      setFocus(): Promise<void>;
      isFocused(): Promise<boolean>;
      show(): Promise<void>;
      hide(): Promise<void>;
      isVisible(): Promise<boolean>;
      setDecorations(decorations: boolean): Promise<void>;
      isDecorated(): Promise<boolean>;
      setAlwaysOnTop(alwaysOnTop: boolean): Promise<void>;
      isAlwaysOnTop(): Promise<boolean>;
      setSize(size: { width: number; height: number }): Promise<void>;
      setMinSize(size: { width: number; height: number }): Promise<void>;
      setMaxSize(size: { width: number; height: number }): Promise<void>;
      setPosition(position: { x: number; y: number }): Promise<void>;
      center(): Promise<void>;
      requestUserAttention(): Promise<void>;
      setSkipTaskbar(skip: boolean): Promise<void>;
      startDragging(): Promise<void>;
      close(): Promise<void>;
    }
    
    export function getAll(): WebviewWindow[];
    export function getCurrent(): WebviewWindow;
    export function getByLabel(label: string): WebviewWindow | null;
    export function createWebviewWindow(label: string, options?: WindowOptions): WebviewWindow;
  }
  
  declare module '@tauri-apps/api/shell' {
    export function open(path: string, openWith?: string): Promise<void>;
    export function execute(program: string, args?: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
  }
  
  declare module '@tauri-apps/api/notification' {
    export interface NotificationOptions {
      title?: string;
      body?: string;
      icon?: string;
    }
    
    export function isPermissionGranted(): Promise<boolean>;
    export function requestPermission(): Promise<boolean>;
    export function sendNotification(options: NotificationOptions | string): void;
  }
  
  declare module '@tauri-apps/api/clipboard' {
    export function writeText(text: string): Promise<void>;
    export function readText(): Promise<string>;
  }
  
  // Определения для типов проекта
  declare module 'src/types' {
    export interface FileItem {
      name: string;
      path: string;
      isDirectory: boolean;
      icon?: string;
      children?: FileItem[];
      isOpen?: boolean;
      isSelected?: boolean;
    }
  }
  
  declare module 'src/main-screen/top-toolbar/types/types' {
    export interface FileItem {
      name: string;
      path: string;
      isDirectory: boolean;
      icon: string;
      children?: FileItem[];
      isOpen?: boolean;
      isSelected?: boolean;
    }
    
    export interface TopToolbarProps {
      currentFiles: FileItem[];
      setCurrentFiles: (files: FileItem[]) => void;
      selectedFile: string | null;
      setSelectedFile: (file: string | null) => void;
      openedFiles: FileItem[];
      setOpenedFiles: (files: FileItem[]) => void;
    }
  }
  
  declare module 'src/main-screen/topbar-editor/TopbarEditor' {
    import { FileItem } from 'src/types';
    
    export interface TopbarEditorProps {
      openedFiles: FileItem[];
      setOpenedFiles: (files: FileItem[]) => void;
      selectedFile: string | null;
      setSelectedFile: (file: string | null) => void;
    }
    
    export const TopbarEditor: React.FC<TopbarEditorProps>;
    export default TopbarEditor;
  }
  
  // Определение для App.tsx
  declare module 'src/App' {
    import { FileItem } from 'src/types';
    
    export interface AppProps {}
    
    const App: React.FC<AppProps>;
    export default App;
  }
  
  // Определения для локальных импортов
  declare module './*' {
    import { FileItem } from 'src/types';
    export { FileItem };
    
    export function setupVirtualFileSystem(
      monaco: any, 
      openedFiles: FileItem[], 
      selectedFolder: string | null,
      supportedTextExtensions: string[],
      getLanguageFromExtension: (filePath: string) => string
    ): void;
  }
  
  // Определения для популярных библиотек
  declare module 'react-router-dom' {
    export interface RouteProps {
      path?: string;
      exact?: boolean;
      sensitive?: boolean;
      strict?: boolean;
      component?: React.ComponentType<any>;
      render?: (props: any) => React.ReactNode;
      children?: React.ReactNode | ((props: any) => React.ReactNode);
    }
    
    export const BrowserRouter: React.FC<{ basename?: string; getUserConfirmation?: (message: string, callback: (ok: boolean) => void) => void; forceRefresh?: boolean; keyLength?: number; children?: React.ReactNode }>;
    export const HashRouter: React.FC<{ basename?: string; getUserConfirmation?: (message: string, callback: (ok: boolean) => void) => void; hashType?: 'slash' | 'noslash' | 'hashbang'; children?: React.ReactNode }>;
    export const Route: React.FC<RouteProps>;
    export const Switch: React.FC<{ children?: React.ReactNode }>;
    export const Link: React.FC<{ to: string | { pathname: string; search?: string; hash?: string; state?: any }; replace?: boolean; innerRef?: React.Ref<HTMLAnchorElement>; children?: React.ReactNode }>;
    export const NavLink: React.FC<{ to: string | { pathname: string; search?: string; hash?: string; state?: any }; activeClassName?: string; activeStyle?: React.CSSProperties; exact?: boolean; strict?: boolean; isActive?: (match: any, location: any) => boolean; location?: any; children?: React.ReactNode }>;
    export const Redirect: React.FC<{ to: string | { pathname: string; search?: string; hash?: string; state?: any }; push?: boolean; from?: string; exact?: boolean; strict?: boolean }>;
    export function useHistory(): { length: number; action: 'PUSH' | 'REPLACE' | 'POP'; location: { pathname: string; search: string; hash: string; state: any }; push: (path: string | { pathname: string; search?: string; hash?: string; state?: any }) => void; replace: (path: string | { pathname: string; search?: string; hash?: string; state?: any }) => void; go: (n: number) => void; goBack: () => void; goForward: () => void; block: (prompt: string | ((location: any, action: 'PUSH' | 'REPLACE' | 'POP') => string)) => () => void; listen: (listener: (location: any, action: 'PUSH' | 'REPLACE' | 'POP') => void) => () => void };
    export function useLocation(): { pathname: string; search: string; hash: string; state: any };
    export function useParams<P extends { [K in keyof P]?: string } = {}>(): P;
    export function useRouteMatch<P extends { [K in keyof P]?: string } = {}>(): { params: P; path: string; url: string; isExact: boolean } | null;
  }
`; 