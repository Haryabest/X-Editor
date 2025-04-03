/* Monaco Editor Type Definitions */

declare namespace monaco {
  interface MarkerSeverity {
    Hint: 1;
    Info: 2;
    Warning: 4;
    Error: 8;
  }

  interface IMarkerData {
    severity: number;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    source?: string;
    code?: string | { value: string; target: Uri };
  }

  interface Uri {
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;
    toString(skipEncoding?: boolean): string;
  }

  interface IDisposable {
    dispose(): void;
  }

  namespace editor {
    const MarkerSeverity: MarkerSeverity;

    function setModelMarkers(model: any, owner: string, markers: IMarkerData[]): void;
    function getModelMarkers(filter: { owner?: string; resource?: Uri; take?: number }): IMarkerData[];
    function getModels(): any[];
    function onDidCreateModel(listener: (model: any) => void): IDisposable;
    function onWillDisposeModel(listener: (model: any) => void): IDisposable;
  }

  namespace languages {
    interface ILanguageExtensionPoint {
      id: string;
      extensions?: string[];
      filenames?: string[];
      filenamePatterns?: string[];
      firstLine?: string;
      aliases?: string[];
      mimetypes?: string[];
      configuration?: string;
    }

    function register(language: ILanguageExtensionPoint): void;
    function getLanguages(): ILanguageExtensionPoint[];
    function onLanguage(languageId: string, callback: () => void): IDisposable;
    function setLanguageConfiguration(languageId: string, configuration: any): IDisposable;
    function setMonarchTokensProvider(languageId: string, provider: any): IDisposable;
    function registerHoverProvider(languageId: string, provider: any): IDisposable;
    function registerCompletionItemProvider(languageId: string, provider: any): IDisposable;
    function registerCodeLensProvider(languageId: string, provider: any): IDisposable;
    function registerDefinitionProvider(languageId: string, provider: any): IDisposable;
    function registerImplementationProvider(languageId: string, provider: any): IDisposable;
    function registerTypeDefinitionProvider(languageId: string, provider: any): IDisposable;
    function registerDocumentSymbolProvider(languageId: string, provider: any): IDisposable;

    namespace typescript {
      interface CompilerOptions {
        allowJs?: boolean;
        allowSyntheticDefaultImports?: boolean;
        allowUmdGlobalAccess?: boolean;
        allowUnreachableCode?: boolean;
        allowUnusedLabels?: boolean;
        alwaysStrict?: boolean;
        baseUrl?: string;
        charset?: string;
        checkJs?: boolean;
        declaration?: boolean;
        declarationMap?: boolean;
        emitDeclarationOnly?: boolean;
        declarationDir?: string;
        disableSizeLimit?: boolean;
        disableSourceOfProjectReferenceRedirect?: boolean;
        downlevelIteration?: boolean;
        emitBOM?: boolean;
        emitDecoratorMetadata?: boolean;
        experimentalDecorators?: boolean;
        forceConsistentCasingInFileNames?: boolean;
        importHelpers?: boolean;
        inlineSourceMap?: boolean;
        inlineSources?: boolean;
        isolatedModules?: boolean;
        jsx?: JsxEmit;
        keyofStringsOnly?: boolean;
        lib?: string[];
        locale?: string;
        mapRoot?: string;
        maxNodeModuleJsDepth?: number;
        module?: ModuleKind;
        moduleResolution?: ModuleResolutionKind;
        newLine?: NewLineKind;
        noEmit?: boolean;
        noEmitHelpers?: boolean;
        noEmitOnError?: boolean;
        noErrorTruncation?: boolean;
        noFallthroughCasesInSwitch?: boolean;
        noImplicitAny?: boolean;
        noImplicitReturns?: boolean;
        noImplicitThis?: boolean;
        noStrictGenericChecks?: boolean;
        noUnusedLocals?: boolean;
        noUnusedParameters?: boolean;
        noImplicitUseStrict?: boolean;
        noLib?: boolean;
        noResolve?: boolean;
        outDir?: string;
        outFile?: string;
        paths?: Record<string, string[]>;
        preserveConstEnums?: boolean;
        preserveSymlinks?: boolean;
        project?: string;
        reactNamespace?: string;
        jsxFactory?: string;
        jsxFragmentFactory?: string;
        composite?: boolean;
        removeComments?: boolean;
        rootDir?: string;
        rootDirs?: string[];
        skipLibCheck?: boolean;
        skipDefaultLibCheck?: boolean;
        sourceMap?: boolean;
        sourceRoot?: string;
        strict?: boolean;
        strictFunctionTypes?: boolean;
        strictBindCallApply?: boolean;
        strictNullChecks?: boolean;
        strictPropertyInitialization?: boolean;
        stripInternal?: boolean;
        suppressExcessPropertyErrors?: boolean;
        suppressImplicitAnyIndexErrors?: boolean;
        target?: ScriptTarget;
        traceResolution?: boolean;
        resolveJsonModule?: boolean;
        types?: string[];
        typeRoots?: string[];
        esModuleInterop?: boolean;
        useDefineForClassFields?: boolean;
        [option: string]: any;
      }

      interface DiagnosticsOptions {
        noSemanticValidation?: boolean;
        noSyntaxValidation?: boolean;
        noSuggestionDiagnostics?: boolean;
        diagnosticCodesToIgnore?: number[];
      }

      interface LanguageServiceDefaults {
        setCompilerOptions(options: CompilerOptions): void;
        setDiagnosticsOptions(options: DiagnosticsOptions): void;
        setWorkerOptions(options: any): void;
        setMaximumWorkerIdleTime(value: number): void;
        setEagerModelSync(value: boolean): void;
        getEagerModelSync(): boolean;
        addExtraLib(content: string, filePath?: string): IDisposable;
        getExtraLibs(): { [filePath: string]: string };
        getCompilerOptions(): CompilerOptions;
        getDiagnosticsOptions(): DiagnosticsOptions;
        getWorkerOptions(): any;
        getMaximumWorkerIdleTime(): number;
      }

      const typescriptDefaults: LanguageServiceDefaults;
      const javascriptDefaults: LanguageServiceDefaults;

      enum ModuleKind {
        None = 0,
        CommonJS = 1,
        AMD = 2,
        UMD = 3,
        System = 4,
        ES2015 = 5,
        ESNext = 99
      }

      enum JsxEmit {
        None = 0,
        Preserve = 1,
        React = 2,
        ReactNative = 3,
        ReactJSX = 4,
        ReactJSXDev = 5
      }

      enum NewLineKind {
        CarriageReturnLineFeed = 0,
        LineFeed = 1
      }

      enum ModuleResolutionKind {
        Classic = 1,
        NodeJs = 2
      }

      enum ScriptTarget {
        ES3 = 0,
        ES5 = 1,
        ES2015 = 2,
        ES2016 = 3,
        ES2017 = 4,
        ES2018 = 5,
        ES2019 = 6,
        ES2020 = 7,
        ESNext = 99,
        Latest = 99
      }
    }
  }
}

// Чтобы считалось модулем
export {}; 