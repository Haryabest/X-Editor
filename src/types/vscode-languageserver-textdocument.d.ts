declare module 'vscode-languageserver-textdocument' {
  export class TextDocument {
    public static create(
      uri: string,
      languageId: string,
      version: number,
      content: string
    ): TextDocument;
    
    public static update(
      document: TextDocument,
      changes: { text: string }[],
      version: number
    ): TextDocument;

    private constructor();
    
    readonly uri: string;
    readonly languageId: string;
    readonly version: number;
    readonly lineCount: number;
    
    getText(range?: { start: { line: number; character: number }; end: { line: number; character: number } }): string;
    positionAt(offset: number): { line: number; character: number };
    offsetAt(position: { line: number; character: number }): number;
    getLineOffsets(): number[];
  }
} 