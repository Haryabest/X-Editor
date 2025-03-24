import { Monaco } from '@monaco-editor/react';
import { extendedTypes } from './extended-types';
import { configureJSX } from './jsx-config';

export function configureTypeScript(monaco: Monaco) {
  // Настройка базовых возможностей Monaco Editor для JavaScript
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  // Улучшенные настройки для JavaScript
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    typeRoots: ["node_modules/@types"],
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "React.createElement",
    jsxFragmentFactory: "React.Fragment",
    allowJs: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    baseUrl: ".",
    paths: {
      "*": ["*", "src/*", "node_modules/*"],
      "src/*": ["./src/*", "src/*"],
      "./*": ["./*", "*"],
      "vite/client": ["vite/client"],
      "vite": ["vite"]
    },
    resolveJsonModule: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
    noImplicitThis: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    strictNullChecks: false,
    suppressImplicitAnyIndexErrors: true,
    downlevelIteration: true
  });

  // Улучшенные настройки для TypeScript
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false
  });

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    typeRoots: ["node_modules/@types"],
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "React.createElement",
    jsxFragmentFactory: "React.Fragment",
    allowJs: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    baseUrl: ".",
    paths: {
      "*": ["*", "src/*", "node_modules/*"],
      "src/*": ["./src/*", "src/*"],
      "./*": ["./*", "*"],
      "vite/client": ["vite/client"],
      "vite": ["vite"]
    },
    resolveJsonModule: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
    noImplicitThis: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    strictNullChecks: false,
    suppressImplicitAnyIndexErrors: true,
    downlevelIteration: true
  });

  // Настройка JSX
  configureJSX(monaco);

  // Добавление типовых деклараций
  addTypeDefinitions(monaco);
}

function addTypeDefinitions(monaco: Monaco) {
  // Добавляем расширенные типы
  monaco.languages.typescript.javascriptDefaults.addExtraLib(extendedTypes, 'extended-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(extendedTypes, 'extended-types.d.ts');

  // Базовые типы для React с полной поддержкой событий
  const reactBasicTypes = `
    // Глобальное определение React
    declare namespace React {
      type ReactNode = any;
      type ReactElement = any;
      type FC<P = {}> = FunctionComponent<P>;
      type FunctionComponent<P = {}> = (props: P) => ReactElement | null;
      type CSSProperties = any;
      type RefObject<T> = { current: T | null };
      type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
      type ComponentType<P = any> = any;
      type SVGProps<T> = any;
      type Context<T> = any;
      
      // События React
      interface BaseSyntheticEvent<E = object, C = any, T = any> {
        nativeEvent: E;
        currentTarget: C;
        target: T;
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
      
      interface SyntheticEvent<T = Element, E = Event> extends BaseSyntheticEvent<E, T> {}
      
      interface ClipboardEvent<T = Element> extends SyntheticEvent<T, NativeClipboardEvent> {
        clipboardData: DataTransfer;
      }
      
      interface CompositionEvent<T = Element> extends SyntheticEvent<T, NativeCompositionEvent> {
        data: string;
      }
      
      interface DragEvent<T = Element> extends MouseEvent<T, NativeDragEvent> {
        dataTransfer: DataTransfer;
      }
      
      interface PointerEvent<T = Element> extends MouseEvent<T, NativePointerEvent> {
        pointerId: number;
        pressure: number;
        tangentialPressure: number;
        tiltX: number;
        tiltY: number;
        twist: number;
        width: number;
        height: number;
        pointerType: 'mouse' | 'pen' | 'touch';
        isPrimary: boolean;
      }
      
      interface FocusEvent<T = Element> extends SyntheticEvent<T, NativeFocusEvent> {
        relatedTarget: EventTarget | null;
      }
      
      interface FormEvent<T = Element> extends SyntheticEvent<T> {}
      
      interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
        target: T & { value: any; checked?: boolean };
      }
      
      interface KeyboardEvent<T = Element> extends SyntheticEvent<T, NativeKeyboardEvent> {
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
        getModifierState(key: string): boolean;
      }
      
      interface MouseEvent<T = Element, E = NativeMouseEvent> extends SyntheticEvent<T, E> {
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
        getModifierState(key: string): boolean;
      }
      
      interface TouchEvent<T = Element> extends SyntheticEvent<T, NativeTouchEvent> {
        altKey: boolean;
        changedTouches: TouchList;
        ctrlKey: boolean;
        metaKey: boolean;
        shiftKey: boolean;
        targetTouches: TouchList;
        touches: TouchList;
        getModifierState(key: string): boolean;
      }
      
      interface UIEvent<T = Element> extends SyntheticEvent<T, NativeUIEvent> {
        detail: number;
        view: AbstractView;
      }
      
      interface WheelEvent<T = Element> extends MouseEvent<T, NativeWheelEvent> {
        deltaMode: number;
        deltaX: number;
        deltaY: number;
        deltaZ: number;
      }
      
      interface AnimationEvent<T = Element> extends SyntheticEvent<T, NativeAnimationEvent> {
        animationName: string;
        elapsedTime: number;
        pseudoElement: string;
      }
      
      interface TransitionEvent<T = Element> extends SyntheticEvent<T, NativeTransitionEvent> {
        elapsedTime: number;
        propertyName: string;
        pseudoElement: string;
      }
    }

    // Глобальное определение JSX
    declare namespace JSX {
      interface Element extends React.ReactElement {}
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
    
    // Типы для нативных событий
    interface NativeClipboardEvent extends Event {}
    interface NativeCompositionEvent extends Event {}
    interface NativeDragEvent extends MouseEvent {}
    interface NativePointerEvent extends MouseEvent {}
    interface NativeFocusEvent extends Event {}
    interface NativeKeyboardEvent extends Event {}
    interface NativeMouseEvent extends Event {}
    interface NativeTouchEvent extends Event {}
    interface NativeUIEvent extends Event {}
    interface NativeWheelEvent extends MouseEvent {}
    interface NativeAnimationEvent extends Event {}
    interface NativeTransitionEvent extends Event {}
    
    interface TouchList {
      length: number;
      item(index: number): Touch;
      [index: number]: Touch;
    }
    
    interface Touch {
      identifier: number;
      target: EventTarget;
      screenX: number;
      screenY: number;
      clientX: number;
      clientY: number;
      pageX: number;
      pageY: number;
    }
    
    interface AbstractView {
      styleMedia: StyleMedia;
      document: Document;
    }
    
    interface StyleMedia {
      type: string;
      matchMedium(mediaquery: string): boolean;
    }
  `;

  // Расширенные типы для React и других библиотек
  const reactTypes = `
    // Определение модуля React
    declare module 'react' {
      export = React;
      export as namespace React;
      
      // Хуки с правильной типизацией
      export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
      export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      export function useContext<T>(context: React.Context<T>): T;
      export function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void];
      export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      export function useMemo<T>(factory: () => T, deps: any[]): T;
      export function useRef<T>(initialValue: T): { current: T };
      export function useRef<T>(initialValue: null): { current: T | null };
      export function useRef<T = undefined>(): { current: T | undefined };
      export function useLayoutEffect(effect: () => void | (() => void), deps?: any[]): void;
      export function useImperativeHandle<T, R extends T>(ref: React.Ref<T>, init: () => R, deps?: any[]): void;
      export function useDebugValue<T>(value: T, format?: (value: T) => any): void;
      
      // Другие экспорты React
      export const Fragment: React.FC;
      export const StrictMode: React.FC;
      export const Suspense: React.FC<{ fallback: React.ReactNode }>;
      export const createElement: any;
      export const cloneElement: any;
      export const createContext: any;
      export const Component: any;
      export const PureComponent: any;
      export const memo: any;
      export const forwardRef: any;
      export const lazy: any;
      export const isValidElement: any;
      export const Children: any;
    }
    
    // Определение модуля react-dom
    declare module 'react-dom' {
      export function render(element: React.ReactNode, container: Element | DocumentFragment, callback?: () => void): void;
      export function hydrate(element: React.ReactNode, container: Element | DocumentFragment, callback?: () => void): void;
      export function createPortal(children: React.ReactNode, container: Element): React.ReactNode;
      export function unmountComponentAtNode(container: Element): boolean;
      export function findDOMNode(component: React.ReactNode): Element | null | Text;
      export const version: string;
      export function unstable_batchedUpdates<A, B>(callback: (a: A, b: B) => any, a: A, b: B): any;
      export function unstable_renderSubtreeIntoContainer(parentComponent: React.ReactNode, element: React.ReactNode, container: Element, callback?: () => void): any;
    }
    
    // Определение модуля react-dom/client
    declare module 'react-dom/client' {
      export function createRoot(container: Element | DocumentFragment): {
        render(element: React.ReactNode): void;
        unmount(): void;
      };
      export function hydrateRoot(container: Element | DocumentFragment, initialChildren: React.ReactNode): {
        render(element: React.ReactNode): void;
        unmount(): void;
      };
    }
    
    // Определение модуля react-dom/server
    declare module 'react-dom/server' {
      export function renderToString(element: React.ReactNode): string;
      export function renderToStaticMarkup(element: React.ReactNode): string;
      export function renderToNodeStream(element: React.ReactNode): any;
      export function renderToStaticNodeStream(element: React.ReactNode): any;
    }
    
    // Определение для Vite
    declare module 'vite/client' {
      interface ImportMeta {
        url: string;
        env: Record<string, string>;
        hot: {
          accept: (callback?: (modules: any[]) => void) => void;
          dispose: (callback: (data: any) => void) => void;
          data: any;
          invalidate: () => void;
          on: (event: string, callback: (...args: any[]) => void) => void;
        };
        glob: (pattern: string) => Record<string, () => Promise<any>>;
      }
    }
    
    // Определение для файлов проекта
    declare module 'src/*' {
      const content: any;
      export default content;
      export * from 'src/*';
    }
    
    // Определение для App.tsx
    declare module 'src/App' {
      import React from 'react';
      const App: React.FC;
      export default App;
      export * from 'src/App';
    }
    
    // Определение для относительных импортов
    declare module './*' {
      export * from '*';
      const defaultExport: any;
      export default defaultExport;
    }
    
    // Определение для типов проекта
    declare module 'src/types' {
      export interface FileItem {
        path: string;
        name: string;
        isDirectory: boolean;
        children?: FileItem[];
      }
    }
    
    // Определение для monaco-config
    declare module 'src/monaco-config' {
      import { Monaco } from '@monaco-editor/react';
      import { FileItem } from 'src/types';
      
      export function configureMonaco(
        monaco: Monaco, 
        openedFiles: FileItem[], 
        selectedFolder: string | null,
        supportedTextExtensions: string[],
        getLanguageFromExtension: (filePath: string) => string
      ): void;
    }
    
    declare module 'src/monaco-config/typescript-config' {
      import { Monaco } from '@monaco-editor/react';
      export function configureTypeScript(monaco: Monaco): void;
    }
    
    declare module 'src/monaco-config/python-config' {
      import { Monaco } from '@monaco-editor/react';
      export function configurePython(monaco: Monaco): void;
    }
    
    declare module 'src/monaco-config/other-languages-config' {
      import { Monaco } from '@monaco-editor/react';
      export function configureOtherLanguages(monaco: Monaco): void;
    }
    
    declare module 'src/monaco-config/virtual-fs-config' {
      import { Monaco } from '@monaco-editor/react';
      import { FileItem } from 'src/types';
      
      export function setupVirtualFileSystem(
        monaco: Monaco, 
        openedFiles: FileItem[], 
        selectedFolder: string | null,
        supportedTextExtensions: string[],
        getLanguageFromExtension: (filePath: string) => string
      ): void;
    }
  `;

  // Добавление типов для Node.js
  const nodeTypes = `
    declare module 'fs' {
      export function readFileSync(path: string, options?: { encoding?: string; flag?: string; } | string): string | Buffer;
      export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string; } | string): void;
      export function existsSync(path: string): boolean;
      export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number; } | number): void;
      export function readdirSync(path: string, options?: { encoding?: string; withFileTypes?: boolean; } | string): string[] | fs.Dirent[];
      export function statSync(path: string): fs.Stats;
      export function unlinkSync(path: string): void;
      export function rmdirSync(path: string, options?: { recursive?: boolean; }): void;
      export function copyFileSync(src: string, dest: string, flags?: number): void;
      export function renameSync(oldPath: string, newPath: string): void;
    }
    
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
  `;

  // Добавляем дополнительные типы для популярных библиотек
  const additionalTypes = `
    // Типы для Monaco Editor
    declare module 'monaco-editor' {
      export const editor: any;
      export const languages: any;
      export const Uri: any;
      export const KeyCode: any;
      export const KeyMod: any;
      export const MarkerSeverity: any;
      export const MarkerTag: any;
      export const Position: any;
      export const Range: any;
      export const Selection: any;
      export const SelectionDirection: any;
      export const CancellationToken: any;
    }
    
    declare module '@monaco-editor/react' {
      import React from 'react';
      import * as monacoEditor from 'monaco-editor';
      
      export interface EditorProps {
        value?: string;
        language?: string;
        theme?: string;
        path?: string;
        defaultValue?: string;
        defaultLanguage?: string;
        defaultPath?: string;
        height?: string | number;
        width?: string | number;
        className?: string;
        options?: any;
        overrideServices?: any;
        saveViewState?: boolean;
        onMount?: (editor: any, monaco: any) => void;
        onChange?: (value: string | undefined, event: any) => void;
        beforeMount?: (monaco: any) => void;
        onValidate?: (markers: any[]) => void;
        loading?: React.ReactNode;
        wrapperProps?: any;
      }
      
      export const Editor: React.FC<EditorProps>;
      export default Editor;
      
      export interface DiffEditorProps {
        original?: string;
        modified?: string;
        language?: string;
        originalLanguage?: string;
        modifiedLanguage?: string;
        theme?: string;
        height?: string | number;
        width?: string | number;
        className?: string;
        options?: any;
        originalPath?: string;
        modifiedPath?: string;
        onMount?: (editor: any, monaco: any) => void;
        beforeMount?: (monaco: any) => void;
        loading?: React.ReactNode;
        wrapperProps?: any;
      }
      
      export const DiffEditor: React.FC<DiffEditorProps>;
      
      export type Monaco = typeof monacoEditor;
      
      export function useMonaco(): Monaco | null;
      export const loader: any;
    }
    
    // Типы для Tauri API
    declare module '@tauri-apps/api/core' {
      export function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T>;
    }
    
    declare module '@tauri-apps/plugin-dialog' {
      export function open(options?: { directory?: boolean; multiple?: boolean; filters?: { name: string; extensions: string[] }[] }): Promise<string | string[] | null>;
      export function save(options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
    }
  `;

  // Добавляем определения для типов проекта
  const projectTypes = `
    // Определение для src/types.ts
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
    
    // Определение для src/main-screen/top-toolbar/types/types.ts
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
    
    // Определение для src/main-screen/topbar-editor/TopbarEditor.tsx
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
    
    // Определение для локальных импортов
    declare module './*' {
      import { FileItem } from 'src/types';
      export { FileItem };
      
      // Другие экспорты
      export function setupVirtualFileSystem(
        monaco: any, 
        openedFiles: FileItem[], 
        selectedFolder: string | null,
        supportedTextExtensions: string[],
        getLanguageFromExtension: (filePath: string) => string
      ): void;
    }
  `;

  // Добавляем определение для vite/client
  const viteClientTypes = `
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
  `;

  // Добавляем определения типов проекта
  monaco.languages.typescript.javascriptDefaults.addExtraLib(projectTypes, 'project-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(projectTypes, 'project-types.d.ts');

  monaco.languages.typescript.javascriptDefaults.addExtraLib(reactBasicTypes, 'react-basic-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(reactBasicTypes, 'react-basic-types.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(reactTypes, 'react-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'react-types.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(nodeTypes, 'node-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(nodeTypes, 'node-types.d.ts');
  monaco.languages.typescript.javascriptDefaults.addExtraLib(additionalTypes, 'additional-types.d.ts');
  monaco.languages.typescript.typescriptDefaults.addExtraLib(additionalTypes, 'additional-types.d.ts');
} 