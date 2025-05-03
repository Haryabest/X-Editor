/**
 * Утилиты для работы с расширениями файлов и обработки TypeScript/JavaScript совместимости
 */

/**
 * Проверяет, является ли файл TypeScript файлом
 * @param filename Имя файла или путь к файлу
 */
export function isTypeScriptFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ext === '.ts' || ext === '.tsx' || ext === '.d.ts';
}

/**
 * Проверяет, является ли файл JavaScript файлом
 * @param filename Имя файла или путь к файлу
 */
export function isJavaScriptFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs';
}

/**
 * Проверяет, поддерживает ли файл JSX синтаксис (React)
 * @param filename Имя файла или путь к файлу
 */
export function isJSXFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ext === '.jsx' || ext === '.tsx';
}

/**
 * Получает расширение файла из имени или пути
 * @param filename Имя файла или путь к файлу
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
}

/**
 * Проверяет, относится ли файл к скриптовым файлам (JS/TS)
 * @param filename Имя файла или путь к файлу
 */
export function isScriptFile(filename: string): boolean {
  return isTypeScriptFile(filename) || isJavaScriptFile(filename);
}

/**
 * Получает соответствующий модуль Monaco для файла
 * @param filename Имя файла или путь к файлу
 * @param monaco Объект Monaco Editor
 */
export function getMonacoLanguageModule(filename: string, monaco: any): any {
  if (isTypeScriptFile(filename)) {
    return monaco.languages.typescript.typescriptDefaults;
  } else if (isJavaScriptFile(filename)) {
    return monaco.languages.typescript.javascriptDefaults;
  }
  return null;
}

/**
 * Применяет настройки компилятора для файла
 * @param filename Имя файла или путь к файлу
 * @param monaco Объект Monaco Editor
 */
export function applyLanguageConfiguration(filename: string, monaco: any): void {
  const languageModule = getMonacoLanguageModule(filename, monaco);
  if (languageModule) {
    // Устанавливаем правильные настройки компилятора
    languageModule.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      strict: isTypeScriptFile(filename),
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      typeRoots: ["node_modules/@types"]
    });

    // Устанавливаем настройки диагностики
    languageModule.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: isTypeScriptFile(filename) ? [
        // Игнорируем только ошибки, связанные с отсутствующими модулями в TypeScript файлах
        2307, // Cannot find module 'X'
        2304, // Cannot find name 'X'
        2552, // Cannot find name 'require'
        2580, // Cannot find name 'module'
        7016  // Could not find a declaration file for module 'X'
      ] : [
        // Игнорируем ошибки TypeScript в JavaScript файлах
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        2307, // Cannot find module 'X'
        2304, // Cannot find name 'X'
        2552, // Cannot find name 'require'
        2580, // Cannot find name 'module'
        2692, // Imports are only allowed in TypeScript files
        7016  // Could not find a declaration file for module 'X'
      ]
    });
  }
}

export const supportedTextExtensions = [
  // JavaScript
  '.js', '.jsx', '.mjs', '.cjs',
  // TypeScript
  '.ts', '.tsx',
  // Python
  '.py', '.pyi', '.pyw', '.pyx', '.pxd', '.pxi', '.pyd',
  // Java
  '.java', '.jav',
  // C/C++
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx',
  // C#
  '.cs', '.csx',
  // HTML
  '.html', '.htm', '.shtml', '.xhtml',
  // CSS
  '.css', '.scss', '.sass', '.less',
  // JSON
  '.json', '.jsonc', '.json5',
  // Markdown
  '.md', '.markdown', '.mdown',
  // XML
  '.xml', '.xsd', '.xsl', '.xslt',
  // YAML
  '.yml', '.yaml',
  // Shell
  '.sh', '.bash', '.zsh', '.fish', '.ksh',
  // PowerShell
  '.ps1', '.psm1', '.psd1',
  // PHP
  '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.phps',
  // Ruby
  '.rb', '.rbx', '.rjs', '.gemspec', '.rake', '.ru', '.erb',
  // Go
  '.go',
  // Rust
  '.rs', '.rlib',
  // Swift
  '.swift',
  // Kotlin
  '.kt', '.kts',
  // Scala
  '.scala', '.sc',
  // R
  '.r', '.rdata', '.rds', '.rda',
  // Dart
  '.dart',
  // Lua
  '.lua',
  // Perl
  '.pl', '.pm', '.pod', '.t',
  // SQL
  '.sql', '.psql', '.plsql', '.mysql', '.sqlite',
  // GraphQL
  '.graphql', '.gql',
  // Docker
  '.dockerfile', '.dockerignore',
  // Git
  '.gitignore',
  // Plain text
  '.txt', '.text', '.log'
];

export const supportedImageExtensions = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif', '.avif'
];

export const supportedVideoExtensions = [
  '.mp4', '.avi', '.mov', '.webm', '.mkv'
]; 