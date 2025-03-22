import * as monaco from 'monaco-editor';
import { FileItem } from '../../types';

export interface DependencyMetadata {
  language: string;
  dependencies?: string[];
  dependencyFiles?: { [key: string]: string };
}

export interface CompletionProvider {
  language: string;
  provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    currentFiles: FileItem[],
    dependencyMetadata: DependencyMetadata,
    selectedFolder: string | null
  ): monaco.languages.CompletionItem[];
}

export class WebCompletionProvider implements CompletionProvider {
  language = 'javascript'; // Поддерживает также TypeScript

  provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    currentFiles: FileItem[],
    dependencyMetadata: DependencyMetadata,
    selectedFolder: string | null
  ): monaco.languages.CompletionItem[] {
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    const isImportContext = textUntilPosition.match(/(import.*from\s+['"]|require\s*\(['"])/);
    if (!isImportContext) return [];

    const importMatch = textUntilPosition.match(/['"]([^'"]*)$/);
    const currentPath = importMatch ? importMatch[1] : '';

    // Предложения файлов из директории
    const fileSuggestions = currentFiles
      .filter(file => !file.is_directory)
      .filter(file => {
        const ext = file.path.slice(file.path.lastIndexOf('.')).toLowerCase();
        return ['.js', '.ts', '.jsx', '.tsx'].includes(ext); // Фильтр для веб-файлов
      })
      .map(file => {
        const relativePath = file.path.replace(selectedFolder || '', '').replace(/^\//, '');
        return {
          label: relativePath,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: relativePath,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column - currentPath.length,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
        };
      });

    // Предложения зависимостей из package.json
    const packageSuggestions = (dependencyMetadata.dependencies || []).map(dep => ({
      label: dep,
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: dep,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column - currentPath.length,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    }));

    return [...fileSuggestions, ...packageSuggestions];
  }
}

// Пример провайдера для Python (заглушка, можно доработать позже)
export class PythonCompletionProvider implements CompletionProvider {
  language = 'python';

  provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    currentFiles: FileItem[],
    dependencyMetadata: DependencyMetadata,
    selectedFolder: string | null
  ): monaco.languages.CompletionItem[] {
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    const isImportContext = textUntilPosition.match(/(import\s+|from\s+.*\s+import\s+)/);
    if (!isImportContext) return [];

    const importMatch = textUntilPosition.match(/(\w+)$/);
    const currentPath = importMatch ? importMatch[1] : '';

    const fileSuggestions = currentFiles
      .filter(file => !file.is_directory)
      .filter(file => file.path.endsWith('.py'))
      .map(file => {
        const relativePath = file.path.replace(selectedFolder || '', '').replace(/^\//, '').replace('.py', '');
        return {
          label: relativePath,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: relativePath,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column - currentPath.length,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
        };
      });

    const packageSuggestions = (dependencyMetadata.dependencies || []).map(dep => ({
      label: dep,
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: dep,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column - currentPath.length,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    }));

    return [...fileSuggestions, ...packageSuggestions];
  }
}