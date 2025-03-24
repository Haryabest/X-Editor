// This is a declaration file to help TypeScript recognize Monaco Editor types
declare module "monaco-editor" {
  export = monaco
}

declare namespace monaco {
  export namespace editor {
    export interface IStandaloneCodeEditor {
      // Add methods and properties as needed
      getModel(): ITextModel | null
      getValue(): string
      setValue(value: string): void
      layout(): void
      focus(): void
      // Add other methods as needed
    }

    export interface ITextModel {
      uri: Uri
      getValue(): string
      getValueLength(): number
      getLineCount(): number
      // Add other methods as needed
    }

    export interface IStandaloneEditorConstructionOptions {
      automaticLayout?: boolean
      fontSize?: number
      fontFamily?: string
      minimap?: { enabled?: boolean }
      scrollBeyondLastLine?: boolean
      wordWrap?: string
      lineNumbers?: string
      renderWhitespace?: string
      quickSuggestions?: boolean | { other?: boolean; comments?: boolean; strings?: boolean }
      suggest?: {
        preview?: boolean
        showStatusBar?: boolean
        showIcons?: boolean
        localityBonus?: boolean
        snippetsPreventQuickSuggestions?: boolean
      }
      hover?: {
        enabled?: boolean
        delay?: number
        sticky?: boolean
      }
      inlayHints?: {
        enabled?: boolean | string
      }
      parameterHints?: { enabled?: boolean }
      formatOnPaste?: boolean
      formatOnType?: boolean
      autoClosingBrackets?: string
      autoClosingQuotes?: string
      autoIndent?: string
      suggestSelection?: string
      tabCompletion?: string
      wordBasedSuggestions?: string | boolean
      // Add other options as needed
    }

    export function getModels(): ITextModel[]
    export function setModelMarkers(model: ITextModel, owner: string, markers: IMarkerData[]): void
    // Add other functions as needed
  }

  export interface IMarkerData {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
    message: string
    severity: number
    source?: string
  }

  export interface Uri {
    path: string
    toString(): string
  }

  export const MarkerSeverity: {
    Hint: number
    Info: number
    Warning: number
    Error: number
  }

  export namespace languages {
    export namespace typescript {
      export const typescriptDefaults: {
        setCompilerOptions(options: any): void
        setDiagnosticsOptions(options: any): void
        setExtraLibs(libs: any[]): void
        addExtraLib(content: string, filePath: string): void
        setEagerModelSync(value: boolean): void
      }
      export const javascriptDefaults: {
        setCompilerOptions(options: any): void
        setDiagnosticsOptions(options: any): void
        setExtraLibs(libs: any[]): void
        addExtraLib(content: string, filePath: string): void
        setEagerModelSync(value: boolean): void
      }
      export const ScriptTarget: {
        ES3: number
        ES5: number
        ES2015: number
        ES2016: number
        ES2017: number
        ES2018: number
        ES2019: number
        ES2020: number
        ESNext: number
        Latest: number
      }
      export const ModuleKind: {
        None: number
        CommonJS: number
        AMD: number
        UMD: number
        System: number
        ES2015: number
        ESNext: number
      }
      export const ModuleResolutionKind: {
        Classic: number
        NodeJs: number
      }
    }
  }
}

