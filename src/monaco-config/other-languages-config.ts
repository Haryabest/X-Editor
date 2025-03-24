import { Monaco } from '@monaco-editor/react';

export function configureOtherLanguages(monaco: Monaco) {
  const languagesToRegister = [
    { id: 'javascript', extensions: ['.js', '.jsx'] },
    { id: 'typescript', extensions: ['.ts', '.tsx'] },
    { id: 'html', extensions: ['.html', '.htm'] },
    { id: 'css', extensions: ['.css'] },
    { id: 'json', extensions: ['.json'] },
    { id: 'markdown', extensions: ['.md'] },
    { id: 'dart', extensions: ['.dart'] },
    { id: 'cpp', extensions: ['.cpp', '.c', '.h', '.hpp'] },
    { id: 'java', extensions: ['.java'] }
  ];

  languagesToRegister.forEach(lang => {
    if (!monaco.languages.getLanguages().some((l: { id: string; }) => l.id === lang.id)) {
      monaco.languages.register({ id: lang.id, extensions: lang.extensions });
    }
  });
} 