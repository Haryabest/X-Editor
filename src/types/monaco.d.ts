declare module 'monaco-editor' {
  export = monaco;
}

declare namespace monaco {
  export const editor: typeof editor;
  export const languages: typeof languages;
  export const MarkerSeverity: {
    Hint: 1;
    Info: 2;
    Warning: 4;
    Error: 8;
  };
  export type IDisposable = {
    dispose(): void;
  };
  export type IMarkdownString = {
    value: string;
    isTrusted?: boolean;
    supportThemeIcons?: boolean;
    uris?: { [href: string]: { target: string } };
  };
  export type Uri = {
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;
    fsPath: string;
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;
    toString(skipEncoding?: boolean): string;
    toJSON(): any;
  };
  export type IRange = {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  export type Position = {
    lineNumber: number;
    column: number;
  };
  export type CancellationToken = {
    isCancellationRequested: boolean;
    onCancellationRequested: (listener: (e: any) => any) => IDisposable;
  };

  export namespace editor {
    export type IStandaloneCodeEditor = {
      getModel(): ITextModel | null;
      getPosition(): Position | null;
      getValue(): string;
      setValue(value: string): void;
      getSelection(): any;
      onDidChangeModelContent(listener: (e: any) => any): IDisposable;
      onDidChangeModel(listener: (e: any) => any): IDisposable;
      onDidChangeCursorPosition(listener: (e: any) => any): IDisposable;
      layout(dimension?: { width: number; height: number }): void;
      focus(): void;
      dispose(): void;
    };
    export type ITextModel = {
      uri: Uri;
      getLanguageId(): string;
      getValue(): string;
      getVersionId(): number;
      setValue(value: string): void;
      getLineContent(lineNumber: number): string;
      getLineCount(): number;
      onDidChangeContent(listener: (e: any) => any): IDisposable;
      dispose(): void;
      findMatches(searchString: string, searchOnlyEditableRange: boolean, isRegex: boolean, matchCase: boolean, wordSeparators: string | null, captureMatches: boolean, limitResultCount?: number): any[];
    };
    export type IMarkerData = {
      severity: number;
      message: string;
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
      source?: string;
      code?: string;
    };
    export function getModels(): ITextModel[];
    export function onDidCreateModel(listener: (model: ITextModel) => void): IDisposable;
    export function onWillDisposeModel(listener: (model: ITextModel) => void): IDisposable;
    export function setModelMarkers(model: ITextModel, owner: string, markers: IMarkerData[]): void;
    export function getModelMarkers(filter: { owner?: string; resource?: Uri; take?: number }): IMarkerData[];
    export function createModel(value: string, language?: string, uri?: Uri): ITextModel;
  }

  export namespace languages {
    export type CompletionItemProvider = {
      triggerCharacters?: string[];
      provideCompletionItems(model: editor.ITextModel, position: Position, context: CompletionContext, token: CancellationToken): Promise<CompletionList> | CompletionList;
      resolveCompletionItem?(item: CompletionItem, token: CancellationToken): Promise<CompletionItem> | CompletionItem;
    };
    export type CompletionList = {
      suggestions: CompletionItem[];
      incomplete?: boolean;
    };
    export type CompletionItem = {
      label: string;
      kind: CompletionItemKind;
      detail?: string;
      documentation?: string | IMarkdownString;
      filterText?: string;
      insertText: string;
      range?: IRange;
      insertTextRules?: CompletionItemInsertTextRule;
      additionalTextEdits?: { range: IRange; text: string }[];
      command?: { id: string; title: string; arguments?: any[] };
      sortText?: string;
      preselect?: boolean;
      tags?: CompletionItemTag[];
    };
    export const enum CompletionItemKind {
      Text = 0,
      Method = 1,
      Function = 2,
      Constructor = 3,
      Field = 4,
      Variable = 5,
      Class = 6,
      Interface = 7,
      Module = 8,
      Property = 9,
      Unit = 10,
      Value = 11,
      Enum = 12,
      Keyword = 13,
      Snippet = 14,
      Color = 15,
      File = 16,
      Reference = 17,
      Folder = 18,
      EnumMember = 19,
      Constant = 20,
      Struct = 21,
      Event = 22,
      Operator = 23,
      TypeParameter = 24
    }
    export const enum CompletionItemInsertTextRule {
      None = 0,
      KeepWhitespace = 1,
      InsertAsSnippet = 4
    }
    export const enum CompletionItemTag {
      Deprecated = 1
    }
    export const enum CompletionTriggerKind {
      Invoke = 0,
      TriggerCharacter = 1,
      TriggerForIncompleteCompletions = 2
    }
    export type CompletionContext = {
      triggerKind: CompletionTriggerKind;
      triggerCharacter?: string;
    };
    export function registerCompletionItemProvider(languageId: string, provider: CompletionItemProvider): IDisposable;
    export function registerHoverProvider(languageId: string, provider: any): IDisposable;
    export function registerDefinitionProvider(languageId: string, provider: any): IDisposable;
    export function registerDocumentFormattingEditProvider(languageId: string, provider: any): IDisposable;
  }
} 