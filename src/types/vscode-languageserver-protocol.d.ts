declare module 'vscode-languageserver-protocol' {
  import { TextDocument } from 'vscode-languageserver-textdocument';

  export interface Position {
    line: number;
    character: number;
  }

  export interface Range {
    start: Position;
    end: Position;
  }

  export interface Location {
    uri: string;
    range: Range;
  }

  export interface Diagnostic {
    range: Range;
    severity?: DiagnosticSeverity;
    code?: string | number;
    source?: string;
    message: string;
    tags?: DiagnosticTag[];
    relatedInformation?: DiagnosticRelatedInformation[];
    data?: any;
  }

  export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
  }

  export enum DiagnosticTag {
    Unnecessary = 1,
    Deprecated = 2
  }

  export interface DiagnosticRelatedInformation {
    location: Location;
    message: string;
  }

  export interface Command {
    title: string;
    command: string;
    arguments?: any[];
  }

  export interface TextEdit {
    range: Range;
    newText: string;
  }

  export interface TextDocumentItem {
    uri: string;
    languageId: string;
    version: number;
    text: string;
  }

  export interface VersionedTextDocumentIdentifier {
    uri: string;
    version: number;
  }

  export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string | MarkupContent;
    deprecated?: boolean;
    preselect?: boolean;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: InsertTextFormat;
    insertTextMode?: InsertTextMode;
    textEdit?: TextEdit | InsertReplaceEdit;
    additionalTextEdits?: TextEdit[];
    commitCharacters?: string[];
    command?: Command;
    data?: any;
    tags?: CompletionItemTag[];
  }

  export interface InsertReplaceEdit {
    insert: Range;
    replace: Range;
    newText: string;
  }

  export enum CompletionItemKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
  }

  export enum InsertTextFormat {
    PlainText = 1,
    Snippet = 2
  }

  export enum InsertTextMode {
    AsIs = 1,
    AdjustIndentation = 2
  }

  export enum CompletionItemTag {
    Deprecated = 1
  }

  export interface CompletionList {
    isIncomplete: boolean;
    items: CompletionItem[];
  }

  export interface MarkupContent {
    kind: MarkupKind;
    value: string;
  }

  export type MarkupKind = 'plaintext' | 'markdown';
} 