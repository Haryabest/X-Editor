// This is a declaration file to help TypeScript recognize Monaco Editor types
// Place this file in your project root or src directory

declare module "monaco-editor" {
  export = monaco
}

declare namespace monaco {
  export const editor: any
  export const languages: {
    typescript: {
      typescriptDefaults: {
        setCompilerOptions: (options: any) => void
        setDiagnosticsOptions: (options: any) => void
        setExtraLibs: (libs: any[]) => void
        addExtraLib: (content: string, filePath: string) => void
        setEagerModelSync: (value: boolean) => void
      }
      javascriptDefaults: {
        setCompilerOptions: (options: any) => void
        setDiagnosticsOptions: (options: any) => void
        setExtraLibs: (libs: any[]) => void
        addExtraLib: (content: string, filePath: string) => void
        setEagerModelSync: (value: boolean) => void
      }
      ScriptTarget: {
        ES3: 0
        ES5: 1
        ES2015: 2
        ES2016: 3
        ES2017: 4
        ES2018: 5
        ES2019: 6
        ES2020: 7
        ESNext: 99
        Latest: 99
      }
      ModuleKind: {
        None: 0
        CommonJS: 1
        AMD: 2
        UMD: 3
        System: 4
        ES2015: 5
        ESNext: 99
      }
      ModuleResolutionKind: {
        Classic: 1
        NodeJs: 2
      }
      JsxEmit: {
        None: 0,
        Preserve: 1,
        React: 2,
        ReactNative: 3,
        ReactJSX: 4,
        ReactJSXDev: 5
      }
    }
  }
  export const MarkerSeverity: {
    Hint: 1
    Info: 2
    Warning: 4
    Error: 8
  }
  
  // URI class для работы с URI в Monaco
  export class Uri {
    static parse(uri: string): Uri
    static file(path: string): Uri
    toString(): string
    fsPath: string
    scheme: string
    authority: string
    path: string
    query: string
    fragment: string
    with(change: { scheme?: string, authority?: string, path?: string, query?: string, fragment?: string }): Uri
  }
  
  // Для поддержки Emitter
  export class Emitter<T> {
    event: Event<T>
    fire(event: T): void
    dispose(): void
  }
}

