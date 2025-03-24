import { invoke } from '@tauri-apps/api/core';
import * as monaco from 'monaco-editor';

export interface ProjectDependency {
  name: string;
  version: string;
  isDev: boolean;
  typesPackage?: string;
}

export interface LanguageServer {
  name: string;
  available: boolean;
  version?: string;
}

export interface ProjectInfo {
  dependencies: ProjectDependency[];
  devDependencies: ProjectDependency[];
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  hasNodeModules: boolean;
  hasCargoTarget: boolean;
  hasTypeScript: boolean;
  hasRustAnalyzer: boolean;
  hasPythonVenv: boolean;
  hasGoMod: boolean;
  languageServers: LanguageServer[];
  configFiles: {
    typescript?: string;
    rust?: string;
    python?: string;
    go?: string;
  };
}

async function checkDirectoryExists(path: string): Promise<boolean> {
  try {
    await invoke('check_directory_exists', { path });
    return true;
  } catch {
    return false;
  }
}

async function findTypesPackage(packageName: string, nodeModulesPath: string): Promise<string | undefined> {
  const typesPackageName = `@types/${packageName.replace('@', '').replace('/', '__')}`;
  try {
    await invoke('read_text_file', { path: `${nodeModulesPath}/${typesPackageName}/package.json` });
    return typesPackageName;
  } catch {
    return undefined;
  }
}

async function detectLanguageServer(path: string, name: string): Promise<LanguageServer> {
  const serverPaths: { [key: string]: string[] } = {
    'typescript': ['node_modules/typescript/lib/tsserver.js'],
    'rust-analyzer': ['.rust-analyzer', 'rust-project.json'],
    'pyright': ['node_modules/pyright', '.venv/bin/pyright'],
    'gopls': ['go/bin/gopls']
  };

  const paths = serverPaths[name] || [];
  for (const serverPath of paths) {
    if (await checkDirectoryExists(`${path}/${serverPath}`)) {
      return { name, available: true };
    }
  }

  return { name, available: false };
}

async function loadLanguageConfiguration(path: string, language: string): Promise<void> {
  try {
    switch (language) {
      case 'typescript':
        await configureTypeScript(path);
        break;
      case 'rust':
        await configureRust(path);
        break;
      case 'python':
        await configurePython(path);
        break;
      case 'go':
        await configureGo(path);
        break;
    }
  } catch (error) {
    console.warn(`Failed to configure ${language}:`, error);
  }
}

async function configureTypeScript(path: string): Promise<void> {
  const compilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    typeRoots: [`${path}/node_modules/@types`],
    allowJs: true,
    checkJs: true,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

  // Add built-in type definitions
  const libPaths = ['lib.dom.d.ts', 'lib.es2020.d.ts', 'lib.dom.iterable.d.ts'];
  for (const libPath of libPaths) {
    try {
      const content = await invoke<string>('read_text_file', {
        path: `${path}/node_modules/typescript/lib/${libPath}`
      });
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        content,
        `file:///node_modules/typescript/lib/${libPath}`
      );
    } catch (error) {
      console.warn(`Failed to load TypeScript lib ${libPath}:`, error);
    }
  }
}

async function configureRust(path: string): Promise<void> {
  // Configure Rust language features
  monaco.languages.registerCompletionItemProvider('rust', {
    provideCompletionItems: async (model, position) => {
      try {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        // Get completions from rust-analyzer if available
        const completions = await invoke<any[]>('get_rust_completions', {
          path: model.uri.path,
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        });

        return {
          suggestions: completions.map(item => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: item.insertText,
            range
          }))
        };
      } catch (error) {
        console.warn('Failed to get Rust completions:', error);
        return { suggestions: [] };
      }
    }
  });
}

async function configurePython(path: string): Promise<void> {
  // Configure Python language features
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: async (model, position) => {
      try {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        // Get completions from pyright if available
        const completions = await invoke<any[]>('get_python_completions', {
          path: model.uri.path,
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        });

        return {
          suggestions: completions.map(item => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: item.insertText,
            range
          }))
        };
      } catch (error) {
        console.warn('Failed to get Python completions:', error);
        return { suggestions: [] };
      }
    }
  });
}

async function configureGo(path: string): Promise<void> {
  // Configure Go language features
  monaco.languages.registerCompletionItemProvider('go', {
    provideCompletionItems: async (model, position) => {
      try {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        // Get completions from gopls if available
        const completions = await invoke<any[]>('get_go_completions', {
          path: model.uri.path,
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        });

        return {
          suggestions: completions.map(item => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: item.insertText,
            range
          }))
        };
      } catch (error) {
        console.warn('Failed to get Go completions:', error);
        return { suggestions: [] };
      }
    }
  });
}

export async function analyzeProject(path: string): Promise<ProjectInfo> {
  try {
    // Check for various language-specific directories and files
    const [
      hasNodeModules,
      hasCargoTarget,
      hasPythonVenv,
      hasGoPath
    ] = await Promise.all([
      checkDirectoryExists(`${path}/node_modules`),
      checkDirectoryExists(`${path}/target`),
      checkDirectoryExists(`${path}/.venv`),
      checkDirectoryExists(`${path}/go`)
    ]);

    // Read configuration files
    const [
      packageJson,
      cargoToml,
      tsConfig,
      pyprojectToml,
      goMod
    ] = await Promise.all([
      invoke<string>('read_text_file', { path: `${path}/package.json` }).catch(() => null),
      invoke<string>('read_text_file', { path: `${path}/Cargo.toml` }).catch(() => null),
      invoke<string>('read_text_file', { path: `${path}/tsconfig.json` }).catch(() => null),
      invoke<string>('read_text_file', { path: `${path}/pyproject.toml` }).catch(() => null),
      invoke<string>('read_text_file', { path: `${path}/go.mod` }).catch(() => null)
    ]);

    const dependencies: ProjectDependency[] = [];
    const devDependencies: ProjectDependency[] = [];

    // Analyze Node.js dependencies
    if (packageJson) {
      const pkg = JSON.parse(packageJson);
      
      for (const [name, version] of Object.entries<string>(pkg.dependencies || {})) {
        const typesPackage = hasNodeModules ? 
          await findTypesPackage(name, `${path}/node_modules`) : 
          undefined;
        
        dependencies.push({ 
          name, 
          version, 
          isDev: false,
          typesPackage 
        });
      }

      for (const [name, version] of Object.entries<string>(pkg.devDependencies || {})) {
        devDependencies.push({ 
          name, 
          version, 
          isDev: true 
        });
      }
    }

    // Detect language servers
    const languageServers = await Promise.all([
      detectLanguageServer(path, 'typescript'),
      detectLanguageServer(path, 'rust-analyzer'),
      detectLanguageServer(path, 'pyright'),
      detectLanguageServer(path, 'gopls')
    ]);

    // Check for rust-analyzer
    const hasRustAnalyzer = cargoToml ? await checkDirectoryExists(`${path}/.rust-analyzer`) : false;

    const projectInfo: ProjectInfo = {
      dependencies,
      devDependencies,
      hasPackageJson: !!packageJson,
      hasCargoToml: !!cargoToml,
      hasNodeModules,
      hasCargoTarget,
      hasTypeScript: !!tsConfig,
      hasRustAnalyzer,
      hasPythonVenv: !!hasPythonVenv,
      hasGoMod: !!goMod,
      languageServers,
      configFiles: {
        typescript: tsConfig || undefined,
        rust: cargoToml || undefined,
        python: pyprojectToml || undefined,
        go: goMod || undefined
      }
    };

    return projectInfo;
  } catch (error) {
    console.error('Error analyzing project:', error);
    return {
      dependencies: [],
      devDependencies: [],
      hasPackageJson: false,
      hasCargoToml: false,
      hasNodeModules: false,
      hasCargoTarget: false,
      hasTypeScript: false,
      hasRustAnalyzer: false,
      hasPythonVenv: false,
      hasGoMod: false,
      languageServers: [],
      configFiles: {}
    };
  }
}

export async function installDependencies(path: string): Promise<void> {
  try {
    const projectInfo = await analyzeProject(path);
    
    // Install dependencies for detected languages
    const installTasks: Promise<void>[] = [];

    if (projectInfo.hasPackageJson && !projectInfo.hasNodeModules) {
      installTasks.push(
        invoke('send_input', { input: `cd "${path}" && npm install\r\n` })
      );
    }

    if (projectInfo.hasCargoToml && !projectInfo.hasCargoTarget) {
      installTasks.push(
        invoke('send_input', { input: `cd "${path}" && cargo build\r\n` })
      );
    }

    if (projectInfo.configFiles.python && !projectInfo.hasPythonVenv) {
      installTasks.push(
        invoke('send_input', { input: `cd "${path}" && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt\r\n` })
      );
    }

    if (projectInfo.hasGoMod) {
      installTasks.push(
        invoke('send_input', { input: `cd "${path}" && go mod download\r\n` })
      );
    }

    // Wait for all installation tasks to complete
    await Promise.all(installTasks);

    // Configure language support for Monaco
    const languages = ['typescript', 'rust', 'python', 'go'];
    for (const lang of languages) {
      if (projectInfo.configFiles[lang as keyof typeof projectInfo.configFiles]) {
        await loadLanguageConfiguration(path, lang);
      }
    }

  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
}