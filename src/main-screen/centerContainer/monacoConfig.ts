declare global {
  interface Window {
    __TAURI__?: {
      invoke?: (command: string, args?: any) => Promise<any>;
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

// Global variables for tracking current project
let currentProjectRoot: string | null = null;
let currentOpenedFiles: any[] = [];
let cachedProjectRoot = '';

// Export functions for setting current project and files from FileManager
export const setCurrentProject = (projectPath: string | null) => {
  if (projectPath !== currentProjectRoot) {
    console.log(`Setting project root: ${projectPath}`);
    currentProjectRoot = projectPath;
    // Reset cache when project changes
    cachedProjectRoot = '';
  }
};

export const setOpenedFilesList = (files: any[]) => {
  currentOpenedFiles = files;
};

// Helper function to check if file exists
function fileExists(path: string): boolean {
  try {
    // Check for in-memory path
    if (path.includes('inmemory:') || path.includes('model')) {
      return true;
    }

    // In browser environment we need to use available API
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // In real code this would be an async check via Tauri API
      // For simplicity we make it synchronous
      return true;
    } else {
      // For testing we assume file exists
      console.log('Assuming file exists (test mode):', path);
      return true;
    }
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}

// Function to check if directory exists
function directoryExists(path: string): boolean {
  try {
    // Check for in-memory path
    if (path.includes('inmemory:') || path.includes('model')) {
      return true;
    }

    // In browser environment we need to use available API
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // In real code this would be an async check via Tauri API
      // For simplicity we make it synchronous
      return true;
    } else {
      // For testing we assume directory exists
      console.log('Assuming directory exists (test mode):', path);
      return true;
    }
  } catch (error) {
    console.error('Error checking directory existence:', error);
    return false;
  }
}

// Function to check file with different extensions
function findFileWithExtensions(basePath: string, extensions: string[]): string {
  // Check for inmemory paths
  if (basePath.includes('inmemory:') || basePath.includes('model')) {
    return basePath;
  }

  for (const ext of extensions) {
    const testPath = `${basePath}${ext}`;
    if (fileExists(testPath)) {
      return testPath;
    }
  }
  return basePath; // Return original path if file not found
}

// Get base project path based on current environment
function getBaseProjectPath(): string {
  try {
    // If project root is explicitly set from FileManager, use it
    if (currentProjectRoot) {
      return currentProjectRoot;
    }

    // If we already have a cached path, return it
    if (cachedProjectRoot) {
      return cachedProjectRoot;
    }

    // Try different ways to determine current directory
    // 1. Via process.cwd() (works in Node.js)
    if (typeof process !== 'undefined' && process.cwd) {
      cachedProjectRoot = process.cwd().replace(/\//g, '\\');
      return cachedProjectRoot;
    }

    // 2. Via window.location (for browsers)
    if (typeof window !== 'undefined') {
      // Get directory from URL
      const path = window.location.pathname;
      // If URL contains src, find project root
      const srcIndex = path.indexOf('/src/');
      if (srcIndex >= 0) {
        cachedProjectRoot = path.substring(0, srcIndex).replace(/\//g, '\\');
        if (cachedProjectRoot) {
          return cachedProjectRoot;
        }
      }
    }

    // If nothing worked, use temporary path
    const diskLetter = typeof navigator !== 'undefined' &&
      navigator.platform &&
      navigator.platform.startsWith('Win') ? 'C:' : '';
    return `${diskLetter}\\Projects`;
  } catch (error) {
    console.error('Error determining base project path:', error);
    // In case of error return fallback
    return 'C:\\Projects';
  }
}

// Helper function to determine project root
function detectProjectRoot(currentFilePath: string): string {
  try {
    // If project root is explicitly set from FileManager, use it
    if (currentProjectRoot) {
      return currentProjectRoot;
    }

    // Check for in-memory model
    if (currentFilePath.includes('inmemory:') || currentFilePath.includes('model')) {
      // Use dynamic project root determination
      return getBaseProjectPath();
    }

    // Get disk letter
    const diskMatch = currentFilePath.match(/^([a-zA-Z]:).*/);
    const diskLetter = diskMatch && diskMatch[1] ? diskMatch[1] : '';

    if (!diskLetter) {
      // Use dynamic project root determination
      return getBaseProjectPath();
    }

    // If project root couldn't be determined by other means
    return getBaseProjectPath();
  } catch (error) {
    console.error('Error determining project root:', error);
    // In case of error use dynamic project root determination
    return getBaseProjectPath();
  }
}

// Main Monaco configuration function
export const configureMonaco = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return monaco;
  }

  try {
    // TypeScript/JavaScript configuration
    if (monaco.languages.typescript) {
      // Configure TypeScript/JavaScript compiler
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2016,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ["node_modules/@types"]
      });

      // Add standard types for React and DOM
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
        declare module "react" {
          export = React;
        }
        
        declare namespace React {
          export interface Component<P = {}, S = {}> {
            render(): JSX.Element | null;
          }
          export class Component<P, S> {}
          export function createElement(type: any, props?: any, ...children: any[]): any;
          export function useState<T>(initialState: T): [T, (newState: T) => void];
          export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          export function useMemo<T>(factory: () => T, deps: any[]): T;
        }
        
        declare namespace JSX {
          interface Element {}
          interface IntrinsicElements {
            [elemName: string]: any;
          }
        }
        `,
        'react.d.ts'
      );
    }

    // Configure hover providers
    try {
      // Define hover processing functions

      // JS object hover processing
      const processJsObjectHover = (word: string, lineContent: string, position: any): any => {
        try {
          // Dictionary of descriptions for standard JS objects and methods
          const jsObjectDescriptions: Record<string, string> = {
            'Date': '**Date: DateConstructor**\n\nEnables basic storage and retrieval of dates and times.',
            'Array': '**Array<T>**\n\nProvides methods for working with arrays of values.',
            'String': '**String**\n\nRepresents sequence of characters and provides methods for manipulating them.',
            'Object': '**Object**\n\nProvides functionality common to all JavaScript objects.',
            'Math': '**Math**\n\nAn intrinsic object that provides basic mathematics functionality and constants.',
            'parseInt': '**parseInt(string: string, radix?: number): number**\n\nConverts a string to an integer.',
            'JSON': '**JSON**\n\nAn intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.',
            'Promise': '**Promise<T>**\n\nRepresents the eventual completion (or failure) of an asynchronous operation and its resulting value.',
            'console': '**console**\n\nProvides access to the browser\'s debugging console.',
            'log': '**console.log(...data: any[]): void**\n\nOutputs a message to the console.'
          };

          // Check for standard JS objects
          if (jsObjectDescriptions[word]) {
            return {
              contents: [
                { value: jsObjectDescriptions[word] }
              ]
            };
          }

          return null;
        } catch (error) {
          console.error('Error processing JS object hover:', error);
          return null;
        }
      };

      // JSX element hover processing
      const processJsxHover = (lineContent: string, position: any): any => {
        try {
          const jsxElementRegex = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9]*)/g;
          let jsxMatch;

          while ((jsxMatch = jsxElementRegex.exec(lineContent)) !== null) {
            const elementName = jsxMatch[1];
            const elementStart = jsxMatch.index + 1; // +1 to skip < character
            const elementEnd = elementStart + elementName.length;

            if (position.column >= elementStart && position.column <= elementEnd) {
              // Basic HTML elements
              const htmlElements = [
                'div', 'span', 'p', 'h1', 'h2', 'h3', 'button', 'a', 'img',
                'input', 'form', 'ul', 'li', 'table', 'tr', 'td'
              ];

              if (htmlElements.includes(elementName.toLowerCase())) {
                return {
                  contents: [
                    { value: `**<${elementName}>** - HTML element\n\nStandard HTML element in JSX.` }
                  ]
                };
              } else if (elementName[0] === elementName[0].toUpperCase()) {
                // For React components
                return {
                  contents: [
                    { value: `**<${elementName}>** - React component\n\nCustom React component.` }
                  ]
                };
              }
            }
          }

          return null;
        } catch (error) {
          console.error('Error processing JSX element:', error);
          return null;
        }
      };

      // Import hover processing
      const processImportHover = (model: any, position: any, lineContent: string): any => {
        try {
          // Look for imports in current line
          const importMatches = [
            { regex: /import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/g, isRequire: false },
            { regex: /import\s+['"]([^'"]+)['"];/g, isRequire: false },
            { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, isRequire: true },
            { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, isRequire: false }
          ];

          for (const { regex } of importMatches) {
            let match;
            regex.lastIndex = 0; // Reset regex index

            while ((match = regex.exec(lineContent)) !== null) {
              const importPath = match[1];
              const pathStart = match.index + match[0].indexOf(importPath);
              const pathEnd = pathStart + importPath.length;

              // Check if cursor is on import path
              if (position.column > pathStart && position.column <= pathEnd) {
                // Get current file via model URI
                const uriString = model.uri ? model.uri.toString() : '';
                if (!uriString) return null;

                // Try to get absolute path for import
                const projectRoot = currentProjectRoot || getBaseProjectPath();

                // Create simple hover with path information
                return {
                  range: new monaco.Range(
                    position.lineNumber,
                    pathStart + 1,
                    position.lineNumber,
                    pathEnd + 1
                  ),
                  contents: [
                    { value: '**Import Module**' },
                    { value: `Path: \`${importPath}\`` },
                    { value: `Project Root: \`${projectRoot}\`` }
                  ]
                };
              }
            }
          }

          return null;
        } catch (error) {
          console.error('Error processing import:', error);
          return null;
        }
      };

      // Register providers for different languages
      const languages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];

      for (const language of languages) {
        monaco.languages.registerHoverProvider(language, {
          provideHover: function (model: any, position: any) {
            try {
              const lineContent = model.getLineContent(position.lineNumber);

              // Try to determine content type and process accordingly
              if (lineContent.includes('import') || lineContent.includes('require')) {
                return processImportHover(model, position, lineContent);
              } else if (lineContent.includes('<') && lineContent.includes('>')) {
                return processJsxHover(lineContent, position);
              } else {
                const word = model.getWordAtPosition(position);
                if (word) {
                  return processJsObjectHover(word.word, lineContent, position);
                }
              }
            } catch (error) {
              console.error('Error processing hover:', error);
            }
            return null;
          }
        });
      }

      console.log('Hover providers successfully configured');
    } catch (hoverError) {
      console.error('Error configuring hover providers:', hoverError);
    }

    return monaco;
  } catch (error) {
    console.error('Critical error configuring Monaco:', error);

    // Return original Monaco instance without configuration to avoid white screen
    return monaco;
  }
}; 