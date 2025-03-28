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

                const projectRoot = currentProjectRoot || getBaseProjectPath();
                let fullPath = '';
                let displayPath = '';
                let wasFound = false;
                let allCheckedPaths: { path: string, exists: boolean }[] = [];
                
                // Extensions to try when looking for files
                const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.less'];
                
                // List of known NPM packages that should be treated as node_modules packages
                const knownNpmPackages = [
                  'react', 'react-dom', 'react-router', 'react-router-dom',
                  'axios', 'lodash', 'moment', 'redux', 'react-redux',
                  'express', 'vue', 'angular', 'svelte', 'jquery',
                  'typescript', 'babel', 'webpack', 'eslint', 'jest',
                  'next', 'vite', 'tailwindcss', 'styled-components'
                ];
                
                // Check if this is a known npm package
                const isKnownNpmPackage = knownNpmPackages.some(pkg => {
                  // Check exact match or scoped package (e.g., @types/react)
                  if (importPath === pkg || importPath.startsWith(`${pkg}/`)) {
                    return true;
                  }
                  // Check for scoped packages
                  if (importPath.startsWith('@')) {
                    const scopedParts = importPath.split('/');
                    if (scopedParts.length >= 2) {
                      return importPath === `@${scopedParts[0]}/${pkg}` || 
                             importPath.startsWith(`@${scopedParts[0]}/${pkg}/`);
                    }
                  }
                  return false;
                });
                
                try {
                  // Special handling for known npm packages
                  if (isKnownNpmPackage && !importPath.startsWith('.')) {
                    const nmPath = `${projectRoot}/node_modules/${importPath}`;
                    fullPath = nmPath;
                    
                    // For known packages, we'll show it as found and in node_modules
                    wasFound = true;
                    allCheckedPaths.push({ path: nmPath, exists: true });
                  }
                  // Handle in-memory models
                  else if (uriString.includes('inmemory:') || uriString.includes('model')) {
                    // For in-memory models, construct path based on project root and importPath
                    const cleanImportPath = importPath.startsWith('./') ? importPath.substring(2) : importPath;
                    
                    // Try multiple potential locations for the import, prioritizing node_modules for non-relative paths
                    const potentialLocations = !importPath.startsWith('.') 
                      ? [
                          `${projectRoot}/node_modules/${cleanImportPath}`,
                          `${projectRoot}/src/${cleanImportPath}`,
                          `${projectRoot}/${cleanImportPath}`
                        ]
                      : [
                          `${projectRoot}/src/${cleanImportPath}`,
                          `${projectRoot}/${cleanImportPath}`,
                          `${projectRoot}/node_modules/${cleanImportPath}`
                        ];
                    
                    for (const location of potentialLocations) {
                      // Try with extensions if needed
                      const needsExtension = !extensions.some(ext => cleanImportPath.endsWith(ext));
                      
                      if (needsExtension) {
                        for (const ext of extensions) {
                          const testPath = `${location}${ext}`;
                          const windowsPath = testPath.replace(/\//g, '\\');
                          const exists = fileExists(windowsPath);
                          allCheckedPaths.push({ path: testPath, exists });
                          
                          if (exists) {
                            fullPath = testPath;
                            wasFound = true;
                            break;
                          }
                        }
                      } else {
                        const windowsPath = location.replace(/\//g, '\\');
                        const exists = fileExists(windowsPath);
                        allCheckedPaths.push({ path: location, exists });
                        
                        if (exists) {
                          fullPath = location;
                          wasFound = true;
                        }
                      }
                      
                      if (wasFound) break;
                    }
                    
                    // If not found, use best guess
                    if (!wasFound) {
                      fullPath = !importPath.startsWith('.') 
                        ? `${projectRoot}/node_modules/${cleanImportPath}`
                        : `${projectRoot}/src/${cleanImportPath}`;
                    }
                  } else {
                    // Special handling for built-in npm packages when not in-memory
                    if (isKnownNpmPackage && !importPath.startsWith('.')) {
                      const nmPath = `${projectRoot}/node_modules/${importPath}`;
                      fullPath = nmPath;
                      wasFound = true;
                      allCheckedPaths.push({ path: nmPath, exists: true });
                    }
                    // Get the directory of the current file for relative paths
                    else if (importPath.startsWith('./') || importPath.startsWith('../')) {
                      const modelPath = uriString.replace('file:///', '');
                      const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
                      
                      // Handle relative paths
                      let basePath = '';
                      
                      if (importPath.startsWith('./')) {
                        basePath = `${modelDir}/${importPath.substring(2)}`;
                      } else {
                        // Count how many levels to go up
                        let upCount = 0;
                        let tempPath = importPath;
                        
                        while (tempPath.startsWith('../')) {
                          upCount++;
                          tempPath = tempPath.substring(3);
                        }
                        
                        // Go up that many directories
                        let tempDir = modelDir;
                        for (let i = 0; i < upCount; i++) {
                          tempDir = tempDir.substring(0, tempDir.lastIndexOf('/'));
                        }
                        
                        basePath = `${tempDir}/${tempPath}`;
                      }
                      
                      // Try with extensions if needed
                      const needsExtension = !extensions.some(ext => importPath.endsWith(ext));
                      
                      if (needsExtension) {
                        for (const ext of extensions) {
                          const testPath = `${basePath}${ext}`;
                          const windowsPath = testPath.replace(/\//g, '\\');
                          const exists = fileExists(windowsPath);
                          allCheckedPaths.push({ path: testPath, exists });
                          
                          if (exists) {
                            fullPath = testPath;
                            wasFound = true;
                            break;
                          }
                        }
                      } else {
                        const windowsPath = basePath.replace(/\//g, '\\');
                        const exists = fileExists(windowsPath);
                        allCheckedPaths.push({ path: basePath, exists });
                        
                        fullPath = basePath;
                        wasFound = exists;
                      }
                    } else if (importPath.startsWith('@')) {
                      // Handle aliased imports using common conventions
                      // Try to resolve from project root and node_modules
                      const aliasHandlers = [
                        // @/path -> src/path
                        { prefix: '@/', replacement: `${projectRoot}/src/` },
                        // @components/path -> src/components/path
                        { prefix: '@components/', replacement: `${projectRoot}/src/components/` },
                        // @utils/path -> src/utils/path
                        { prefix: '@utils/', replacement: `${projectRoot}/src/utils/` },
                        // @assets/path -> src/assets/path
                        { prefix: '@assets/', replacement: `${projectRoot}/src/assets/` }
                      ];
                      
                      let foundAlias = false;
                      
                      // Try to resolve alias
                      for (const handler of aliasHandlers) {
                        if (importPath.startsWith(handler.prefix)) {
                          const aliasPath = importPath.replace(handler.prefix, handler.replacement);
                          
                          // Try with extensions if needed
                          const needsExtension = !extensions.some(ext => importPath.endsWith(ext));
                          
                          if (needsExtension) {
                            for (const ext of extensions) {
                              const testPath = `${aliasPath}${ext}`;
                              const windowsPath = testPath.replace(/\//g, '\\');
                              const exists = fileExists(windowsPath);
                              allCheckedPaths.push({ path: testPath, exists });
                              
                              if (exists) {
                                fullPath = testPath;
                                wasFound = true;
                                foundAlias = true;
                                break;
                              }
                            }
                          } else {
                            const windowsPath = aliasPath.replace(/\//g, '\\');
                            const exists = fileExists(windowsPath);
                            allCheckedPaths.push({ path: aliasPath, exists });
                            
                            fullPath = aliasPath;
                            wasFound = exists;
                            foundAlias = exists;
                          }
                          
                          if (foundAlias) break;
                        }
                      }
                      
                      // If alias not resolved, try node_modules
                      if (!foundAlias) {
                        const nmPath = `${projectRoot}/node_modules/${importPath}`;
                        const windowsPath = nmPath.replace(/\//g, '\\');
                        const exists = fileExists(windowsPath);
                        allCheckedPaths.push({ path: nmPath, exists });
                        
                        fullPath = nmPath;
                        wasFound = exists;
                      }
                    } else {
                      // Non-relative, non-alias imports should typically be in node_modules
                      const nmPath = `${projectRoot}/node_modules/${importPath}`;
                      const windowsPath = nmPath.replace(/\//g, '\\');
                      const exists = fileExists(windowsPath);
                      allCheckedPaths.push({ path: nmPath, exists });
                      
                      if (exists) {
                        fullPath = nmPath;
                        wasFound = true;
                      } else {
                        // Try common locations as fallback
                        const potentialLocations = [
                          `${projectRoot}/src/${importPath}`,
                          `${projectRoot}/${importPath}`
                        ];
                        
                        for (const location of potentialLocations) {
                          // Try with extensions if needed
                          const needsExtension = !extensions.some(ext => importPath.endsWith(ext));
                          
                          if (needsExtension) {
                            for (const ext of extensions) {
                              const testPath = `${location}${ext}`;
                              const windowsPath = testPath.replace(/\//g, '\\');
                              const exists = fileExists(windowsPath);
                              allCheckedPaths.push({ path: testPath, exists });
                              
                              if (exists) {
                                fullPath = testPath;
                                wasFound = true;
                                break;
                              }
                            }
                          } else {
                            const windowsPath = location.replace(/\//g, '\\');
                            const exists = fileExists(windowsPath);
                            allCheckedPaths.push({ path: location, exists });
                            
                            if (exists) {
                              fullPath = location;
                              wasFound = true;
                            }
                          }
                          
                          if (wasFound) break;
                        }
                        
                        // If not found, use node_modules as best guess
                        if (!wasFound) {
                          fullPath = nmPath;
                        }
                      }
                    }
                  }
                } catch (pathError) {
                  console.error('Error resolving path:', pathError);
                  fullPath = `${projectRoot}/${importPath}`;
                }
                
                // Ensure path uses forward slashes for display
                fullPath = fullPath.replace(/\\/g, '/');
                
                // Format display path based on existence
                if (wasFound) {
                  displayPath = `✅ module "${fullPath}"`;
                } else {
                  displayPath = `❌ module "${fullPath}" (Not Found)`;
                }
                
                // Create hover with detailed path information
                const hoverContents = [
                  { value: wasFound ? '**Import Module (Found)** ✅' : '**Import Module (Not Found)** ❌' },
                  { value: `Original Path: \`${importPath}\`` },
                  { value: `Full Path: \`${fullPath}\`` },
                  { value: `Project Root: \`${projectRoot}\`` }
                ];
                
                // Add checked paths if not too many
                if (allCheckedPaths.length > 0 && allCheckedPaths.length <= 5) {
                  hoverContents.push({ value: '**Checked Paths:**' });
                  for (const {path, exists} of allCheckedPaths) {
                    hoverContents.push({ value: `- ${exists ? '✅' : '❌'} \`${path}\`` });
                  }
                } else if (allCheckedPaths.length > 5) {
                  hoverContents.push({ value: `**Checked ${allCheckedPaths.length} paths**` });
                }
                
                return {
                  range: new monaco.Range(
                    position.lineNumber,
                    pathStart + 1,
                    position.lineNumber,
                    pathEnd + 1
                  ),
                  contents: hoverContents
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