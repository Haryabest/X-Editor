/**
 * Глобальные определения типов
 */

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (command: string, args?: any) => Promise<any>;
      path?: {
        resolveResource: (path: string) => Promise<string>;
        appDir: () => Promise<string>;
        join: (...paths: string[]) => Promise<string>;
        normalize: (path: string) => Promise<string>;
        basename: (path: string) => Promise<string>;
        dirname: (path: string) => Promise<string>;
      };
      fs?: {
        exists: (path: string) => Promise<boolean>;
        existsSync?: (path: string) => boolean;
        readDir: (path: string) => Promise<string[]>;
        readTextFile: (path: string) => Promise<string>;
      };
      event?: {
        listen: (event: string, callback: (data: any) => void) => Promise<number>;
      };
    };
    monaco: any;
    logMonacoDiagnostics?: () => { markers: any[], errorCounts: Record<string, number> };
    monacoDebug?: any;
  }
}

// Это необходимо для того, чтобы TypeScript рассматривал этот файл как модуль
export {}; 