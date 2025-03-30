declare module 'vscode-uri' {
  export interface UriComponents {
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;
  }

  export class URI implements UriComponents {
    static parse(value: string, strict?: boolean): URI;
    static file(path: string): URI;
    static from(components: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): URI;
    static joinPath(uri: URI, ...pathSegments: string[]): URI;

    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): URI;
    toString(skipEncoding?: boolean): string;
    toJSON(): UriComponents;
  }

  export default URI;
} 