import { initializeMonacoEditor } from './monaco-advanced-config';

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
    if (typeof window !== 'undefined' && window.__TAURI__?.fs?.exists) {
      try {
        // Use Tauri's synchronous file existence check
        // @ts-ignore - This is available in Tauri
        const exists = window.__TAURI__.fs.existsSync(path);
        console.log(`File existence check for ${path}: ${exists}`);
        return exists;
      } catch (e) {
        console.log(`Error checking file with Tauri: ${e}`);
        // Fall back to assuming it exists
        return true;
      }
    } else {
      // For testing we log and assume file exists
      console.log('File existence check (test mode):', path);
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
    if (typeof window !== 'undefined' && window.__TAURI__?.fs?.exists) {
      try {
        // Use Tauri's synchronous directory existence check
        // @ts-ignore - This is available in Tauri
        const exists = window.__TAURI__.fs.existsSync(path);
        console.log(`Directory existence check for ${path}: ${exists}`);
        return exists;
      } catch (e) {
        console.log(`Error checking directory with Tauri: ${e}`);
        // Fall back to assuming it exists
        return true;
      }
    } else {
      // For testing we log and assume directory exists
      console.log('Directory existence check (test mode):', path);
      return true;
    }
  } catch (error) {
    console.error('Error checking directory existence:', error);
    return false;
  }
}

// Function to check file with different extensions
function findFileWithExtensions(basePath: string, extensions: string[]): { path: string, exists: boolean } {
  // Check for inmemory paths
  if (basePath.includes('inmemory:') || basePath.includes('model')) {
    return { path: basePath, exists: true };
  }

  for (const ext of extensions) {
    const testPath = `${basePath}${ext}`;
    if (fileExists(testPath)) {
      return { path: testPath, exists: true };
    }
  }
  return { path: basePath, exists: false }; // Return original path if file not found
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

// Хелпер для безопасного получения модели
function getSafeModel(editor: any): any {
  if (!editor) return null;
  
  try {
    const model = editor.getModel();
    return model;
  } catch (error) {
    console.error('Ошибка при получении модели редактора:', error);
    return null;
  }
}

// Хелпер для безопасного получения позиции
function getSafePosition(editor: any): any {
  if (!editor) return { lineNumber: 1, column: 1 };
  
  try {
    const position = editor.getPosition();
    return position || { lineNumber: 1, column: 1 };
  } catch (error) {
    console.error('Ошибка при получении позиции редактора:', error);
    return { lineNumber: 1, column: 1 };
  }
}

// Main Monaco configuration function
export const configureMonaco = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return monaco;
  }

  try {
    // Initialize with advanced language configuration
    try {
      initializeMonacoEditor(monaco);
    } catch (error) {
      console.error('Ошибка при инициализации продвинутых настроек Monaco:', error);
    }
    
    // Fix for TypeScript file recognition issues
    // This ensures files are treated as TypeScript/TypeScriptReact
    try {
      if (monaco.languages.typescript && monaco.languages.typescript.typescriptDefaults) {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
      }
    } catch (error) {
      console.error('Ошибка при настройке диагностики TypeScript:', error);
    }

    // Configure file extensions to be treated as TypeScript
    const tsExt = ['.ts', '.tsx'];
    
    // Безопасно регистрируем обработчики языков
    try {
      // Associate .ts and .tsx files with correct language
      if (monaco.languages && monaco.languages.onLanguage) {
        monaco.languages.onLanguage('typescript', () => {
          try {
            monaco.languages.setLanguageConfiguration('typescript', {
              wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
              comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
              },
              brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')']
              ],
              autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: '\'', close: '\'' },
                { open: '`', close: '`' }
              ]
            });
          } catch (error) {
            console.error('Ошибка при настройке TypeScript:', error);
          }
        });
        
        monaco.languages.onLanguage('typescriptreact', () => {
          try {
            monaco.languages.setLanguageConfiguration('typescriptreact', {
              wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
              comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
              },
              brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
                ['<', '>']
              ],
              autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: '\'', close: '\'' },
                { open: '`', close: '`' },
                { open: '<', close: '>' }
              ]
            });
          } catch (error) {
            console.error('Ошибка при настройке TypeScriptReact:', error);
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при настройке поддержки языков:', error);
    }

    // TypeScript/JavaScript configuration
    try {
      if (monaco.languages && monaco.languages.typescript) {
        // Configure TypeScript/JavaScript compiler options
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.React,
          reactNamespace: 'React',
          allowJs: true,
          typeRoots: ["node_modules/@types"],
          // Additional TypeScript compiler options
          strict: true,
          alwaysStrict: true,
          allowSyntheticDefaultImports: true,
          forceConsistentCasingInFileNames: true,
          jsxFactory: 'React.createElement',
          jsxFragmentFactory: 'React.Fragment',
          isolatedModules: true,
          skipLibCheck: true,
          lib: ['DOM', 'DOM.Iterable', 'ESNext']
        });
      }
    } catch (error) {
      console.error('Ошибка при настройке компилятора TypeScript:', error);
    }

    // Ensure correct file extensions are mapped to their languages
    try {
      if (monaco.languages.typescript) {
        monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
        monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
      }
    } catch (error) {
      console.error('Ошибка при настройке синхронизации моделей TypeScript:', error);
    }

    // Configure hover providers
    try {
      if (monaco.languages && monaco.languages.registerHoverProvider) {
        // Register providers for different languages
        const languages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];

        for (const language of languages) {
          monaco.languages.registerHoverProvider(language, {
            provideHover: function (model: any, position: any) {
              if (!model || !position) return null;
              
              try {
                const lineContent = model.getLineContent(position.lineNumber);
                if (!lineContent) return null;

                // JS object hover processing
                const word = model.getWordAtPosition(position);
                if (word) {
                  // Простые описания для распространенных JS объектов
                  const jsObjectDescriptions: Record<string, string> = {
                    'console': '**console**\n\nПредоставляет доступ к консоли отладки.',
                    'document': '**document**\n\nПредставляет веб-страницу.',
                    'window': '**window**\n\nГлобальный объект в браузере.',
                    'React': '**React**\n\nБиблиотека для создания пользовательских интерфейсов.',
                    'useState': '**useState(initialState)**\n\nХук React для добавления состояния.'
                  };
                  
                  if (jsObjectDescriptions[word.word]) {
                    return {
                      contents: [
                        { value: jsObjectDescriptions[word.word] }
                      ]
                    };
                  }
                }
              } catch (error) {
                console.error('Ошибка при обработке hover:', error);
              }
              return null;
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка при настройке hover providers:', error);
    }

    return monaco;
  } catch (error) {
    console.error('Critical error configuring Monaco:', error);

    // Return original Monaco instance without configuration to avoid white screen
    return monaco;
  }
}; 