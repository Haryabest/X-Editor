import { Monaco } from '@monaco-editor/react';
import { configureTypes } from './types-manager';
import { setupAutoTypes } from './auto-types';
import { configureJSXTypes } from './jsx-types';
import { FileItem } from '../types';

export async function configureMonaco(
  monaco: Monaco, 
  openedFiles: FileItem[], 
  selectedFolder: string | null,
  supportedTextExtensions: string[],
  getLanguageFromExtension: (filePath: string) => string
) {
  try {
    // Базовая конфигурация типов - это главное, что мы делаем здесь
    configureTypes(monaco);
    
    // Добавляем продвинутые типы для JSX/TSX
    configureJSXTypes(monaco);
    
    // Настройка автоматического определения типов на основе импортов
    await setupAutoTypes(monaco, openedFiles);

    // Настройка виртуальной файловой системы
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    
    // Настройка специальных опций для TypeScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowJs: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true
    });
    
    // Отключаем лишнюю валидацию для повышения производительности
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        2669, // Augmentations for the global scope can only be directly nested
        1046, // Top-level declarations in .d.ts files must start with 'declare' or 'export'
        2307, // Cannot find module
        7031, // Initializers are not allowed in ambient contexts
        1161, // Unterminated regular expression literal
        2304, // Cannot find name (HTML elements)
        7026, // JSX element implicitly has type 'any'
        2322, // Type assignment error
        7006, // Parameter implicitly has an 'any' type
        2740,  // Type 'string | undefined' is missing the following properties
        2339,  // Property does not exist on type
        2531,  // Object is possibly 'null'
        2786,  // 'x' cannot be used as a JSX component
        2605   // JSX element type 'x' is not a constructor function
      ]
    });
    
    // Мы НЕ создаем модели здесь, так как они будут созданы при монтировании редактора
    // Это предотвращает конфликты и ошибки "getFullModelRange of null"
    
    // Настройка отображения полного пути модуля при наведении
    monaco.languages.registerHoverProvider('typescript', {
      provideHover: (model, position) => {
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;
        
        const lineContent = model.getLineContent(position.lineNumber);
        const importMatch = lineContent.match(/import[\s\S]*?['"]([^'"]+)['"]/);
        
        if (importMatch) {
          const modulePath = importMatch[1];
          
          let fullPath = '';
          if (modulePath.startsWith('.')) {
            if (selectedFolder) {
              fullPath = `${selectedFolder}/${modulePath.replace(/^\.\//, '')}`;
            } else {
              fullPath = modulePath;
            }
          } else {
            fullPath = `node_modules/${modulePath}`;
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `**Полный путь:** \`${fullPath}\`` }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Настройка такая же для JavaScript
    monaco.languages.registerHoverProvider('javascript', {
      provideHover: (model, position) => {
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;
        
        const lineContent = model.getLineContent(position.lineNumber);
        const importMatch = lineContent.match(/import[\s\S]*?['"]([^'"]+)['"]/);
        
        if (importMatch) {
          const modulePath = importMatch[1];
          
          let fullPath = '';
          if (modulePath.startsWith('.')) {
            if (selectedFolder) {
              fullPath = `${selectedFolder}/${modulePath.replace(/^\.\//, '')}`;
            } else {
              fullPath = modulePath;
            }
          } else {
            fullPath = `node_modules/${modulePath}`;
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `**Полный путь:** \`${fullPath}\`` }
            ]
          };
        }
        
        return null;
      }
    });
  } catch (error) {
    console.error('Error configuring Monaco:', error);
  }
} 
