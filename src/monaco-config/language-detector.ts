import { isTypeScriptFile, isJavaScriptFile, isJSXFile } from '../utils/fileExtensions';

export function getLanguageFromExtension(filename: string): string {
  if (isTypeScriptFile(filename)) {
    return isJSXFile(filename) ? 'typescriptreact' : 'typescript';
  } else if (isJavaScriptFile(filename)) {
    return isJSXFile(filename) ? 'javascriptreact' : 'javascript';
  }
  return 'plaintext';
}

export function getLanguageFromContent(content: string, filename: string): string {
  // Сначала проверяем расширение файла
  const extensionBasedLanguage = getLanguageFromExtension(filename);
  if (extensionBasedLanguage !== 'plaintext') {
    return extensionBasedLanguage;
  }

  // Если расширение не помогло, анализируем содержимое
  const lines = content.split('\n');
  
  // Проверяем наличие TypeScript-специфичных конструкций
  const hasTypeScriptFeatures = lines.some(line => {
    return (
      line.includes('interface ') ||
      line.includes('type ') ||
      line.includes(': ') ||
      line.includes('readonly ') ||
      line.includes('!') ||
      line.includes('import type')
    );
  });

  if (hasTypeScriptFeatures) {
    return isJSXFile(filename) ? 'typescriptreact' : 'typescript';
  }

  // Проверяем наличие JSX
  const hasJSX = lines.some(line => {
    return (
      line.includes('<') && line.includes('>') &&
      !line.includes('=>') && // Исключаем стрелочные функции
      !line.includes('<=') && // Исключаем операторы сравнения
      !line.includes('>=')
    );
  });

  if (hasJSX) {
    return 'typescriptreact';
  }

  return 'plaintext';
} 