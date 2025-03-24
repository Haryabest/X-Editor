import { Monaco } from '@monaco-editor/react';
import { configureTypeScript } from './typescript-config';
import { configurePython } from './python-config';
import { configureOtherLanguages } from './other-languages-config';
import { setupVirtualFileSystem } from './virtual-fs-config';
import { configureJSX } from './jsx-config';
import { configureTSX } from './tsx-config';
import { configureTSXLanguage } from './tsx-language-config';
import { FileItem } from '../types';

export function configureMonaco(
  monaco: Monaco, 
  openedFiles: FileItem[], 
  selectedFolder: string | null,
  supportedTextExtensions: string[],
  getLanguageFromExtension: (filePath: string) => string
) {
  // Настройка TypeScript/JavaScript
  configureTypeScript(monaco);
  
  // Настройка JSX/TSX
  configureJSX(monaco);
  configureTSX(monaco);
  configureTSXLanguage(monaco);
  
  // Настройка Python
  configurePython(monaco);
  
  // Настройка других языков
  configureOtherLanguages(monaco);
  
  // Настройка виртуальной файловой системы
  setupVirtualFileSystem(monaco, openedFiles, selectedFolder, supportedTextExtensions, getLanguageFromExtension);
}

export { configureTypeScript };
export { configurePython };
export { configureOtherLanguages };
export { setupVirtualFileSystem };
export { configureJSX };
export { configureTSX };
export { configureTSXLanguage }; 