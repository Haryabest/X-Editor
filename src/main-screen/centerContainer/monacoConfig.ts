import * as monaco from 'monaco-editor';
import path from 'path-browserify';
import { invoke } from '@tauri-apps/api/core';

export const configureMonaco = async (monaco: typeof import('monaco-editor'), selectedFolder: string) => {
  console.log('Configuring Monaco with selected folder:', selectedFolder);

  // Очистка предыдущих моделей и настроек
  monaco.editor.getModels().forEach((model) => {
    console.log('Disposing model:', model.uri.toString());
    model.dispose();
  });

  monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);
  monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);

  // Настройка компилятора TypeScript
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    lib: ['esnext', 'dom', 'es2017'],
    baseUrl: selectedFolder,
    paths: {
      '*': ['node_modules/*', 'src/*', 'src'],
    },
    typeRoots: [`${selectedFolder}/node_modules/@types`, `${selectedFolder}/node_modules`],
    resolveJsonModule: true,
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
  };

  console.log('Setting TypeScript compiler options:', compilerOptions);
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

  // Загрузка конфигурации tsconfig.json, если она существует
  const loadTsConfig = async () => {
    try {
      const tsConfigPath = path.join(selectedFolder, 'tsconfig.json');
      console.log('Loading tsconfig.json from:', tsConfigPath);
      const tsConfigContent = await invoke<string>('read_text_file', { path: tsConfigPath });
      const tsConfig = JSON.parse(tsConfigContent);

      console.log('Loaded tsconfig.json:', tsConfig);
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        ...compilerOptions,
        ...tsConfig.compilerOptions,
        paths: {
          ...compilerOptions.paths,
          ...tsConfig.compilerOptions?.paths,
        },
      });
    } catch (error) {
      console.log('Using default TypeScript configuration');
    }
  };

  await loadTsConfig();
};