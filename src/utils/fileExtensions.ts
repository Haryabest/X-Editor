/**
 * Утилиты для работы с расширениями файлов и обработки TypeScript/JavaScript совместимости
 */

/**
 * Проверяет, является ли файл TypeScript файлом
 * @param filename Имя файла или путь к файлу
 */
export function isTypeScriptFile(filename: string): boolean {
  const extension = getFileExtension(filename);
  return extension === 'ts' || extension === 'tsx';
}

/**
 * Проверяет, является ли файл JavaScript файлом
 * @param filename Имя файла или путь к файлу
 */
export function isJavaScriptFile(filename: string): boolean {
  const extension = getFileExtension(filename);
  return extension === 'js' || extension === 'jsx';
}

/**
 * Проверяет, поддерживает ли файл JSX синтаксис (React)
 * @param filename Имя файла или путь к файлу
 */
export function isJSXFile(filename: string): boolean {
  const extension = getFileExtension(filename);
  return extension === 'jsx' || extension === 'tsx';
}

/**
 * Получает расширение файла из имени или пути
 * @param filename Имя файла или путь к файлу
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
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
  try {
    const module = getMonacoLanguageModule(filename, monaco);
    if (!module) return;
    
    const isJSX = isJSXFile(filename);
    const compilerOptions: any = {
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      noEmit: true,
      typeRoots: ['node_modules/@types']
    };
    
    if (isJSX) {
      compilerOptions.jsx = monaco.languages.typescript.JsxEmit.React;
    }
    
    module.setCompilerOptions(compilerOptions);
    
    // Отключаем ошибки TypeScript в JavaScript файлах
    if (isJavaScriptFile(filename)) {
      module.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [
          8006, 8010, 2307, 2304, 2552, 2580, 2692, 7016, 1005, 1003, 2551, 7006, 7031
        ]
      });
    }
    
    // Настраиваем модель, если она существует
    try {
      // Используем безопасное получение modelsMap и поиск модели
      const models = monaco.editor.getModels();
      const fileUri = filename.startsWith('file://') ? filename : `file://${filename}`;
      
      // Ищем модель по пути файла (обходим потенциальные различия в реализации Uri)
      const model = models.find((m: any) => {
        try {
          const uri = m.uri.toString();
          return uri.includes(filename) || uri === fileUri;
        } catch (e) {
          return false;
        }
      });
      
      if (model) {
        console.log(`Configuring model for ${filename}`);
        
        // Добавляем обработчик для TypeScript/JavaScript файлов
        if (isScriptFile(filename)) {
          // Здесь может быть дополнительная настройка модели
          console.log(`Applied TypeScript/JavaScript configuration for ${filename}`);
        }
      }
    } catch (e) {
      console.error(`Error configuring model for ${filename}:`, e);
    }
  } catch (e) {
    console.error(`Error in applyLanguageConfiguration for ${filename}:`, e);
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
  '.png', '.jpg', '.jpeg', '.gif'
];

export const supportedVideoExtensions = [
  '.mp4', '.avi', '.mov', '.webm', '.mkv'
]; 