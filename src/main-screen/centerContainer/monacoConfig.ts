export const configureMonaco = (monaco: any) => {
  if (!monaco) {
    console.error('Monaco instance is undefined');
    return;
  }

  // Настройка проверки существования модулей:
  // 1. Для импортов вида import ... from './путь' проверяется существование файла
  // 2. Если файл не существует, показывается ошибка Cannot find module
  // 3. Для внешних пакетов (npm) ошибки не показываются

  // Add basic React types
  const reactTypes = `
    declare module "react" {
      export = React;
      export as namespace React;
      
      declare namespace React {
        export type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactFragment | React.ReactPortal;
        export interface ReactElement<P = any> {
          type: string | React.ComponentType<P>;
          props: P;
          key: string | number | null;
        }
        export type ComponentType<P = {}> = React.ComponentClass<P> | React.FunctionComponent<P>;
        export interface FunctionComponent<P = {}> {
          (props: P): ReactElement | null;
        }
        export const useState: <T>(initialState: T | (() => T)) => [T, (newState: T | ((prev: T) => T)) => void];
        export const useEffect: (effect: () => void | (() => void), deps?: readonly any[]) => void;
        export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: readonly any[]) => T;
        export const useMemo: <T>(factory: () => T, deps: readonly any[]) => T;
        export const useRef: <T>(initialValue: T) => { current: T };
      }
    }
  `;

  // Configure TypeScript compiler options
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
    isolatedModules: true,
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    typeRoots: ["node_modules/@types"],
    noUnusedLocals: false,
    noUnusedParameters: false,
    strictNullChecks: false,
    noStrictGenericChecks: true,
    suppressImplicitAnyIndexErrors: true,
    baseUrl: ".",
    paths: {
      "*": ["*", "node_modules/*", "src/*"],
      "@/*": ["./src/*", "./components/*"],
      "../*": ["../src/*", "../*"],
      "~/*": ["./*"],
      "react": ["./node_modules/react", "./src/types/react"],
      "react-dom": ["./node_modules/react-dom"]
    }
  });

  // Configure diagnostics options - расширяем список игнорируемых ошибок
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
      1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004, 7027,
      2451, 6133, 2769, 7005, 2355, 18002, 18003, 2306, 2665, 6196,
      7053, 2602, 2551, 2578, 7008, 2525, 2683, 2821, 2614, 2459, 2580, 2487,
      1011, // An element access expression should take an argument
      8016  // Type assertion expressions can only be used in TypeScript files
    ]
  });

  // Add React types
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    reactTypes,
    'file:///node_modules/@types/react/index.d.ts'
  );

  // Enable language features
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // Применяем те же настройки для JavaScript файлов
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowJs: true,
    skipLibCheck: true,
    noImplicitAny: false,
    suppressImplicitAnyIndexErrors: true
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: [
      2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
      2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
      1128, 1434, 1136, 1110, 8006, 8010, 2688, 1039, 2792, 1183, 
      1254, 2695, 2365, 2714, 2552, 2362, 2503, 2363, 18004, 7027,
      2451, 6133, 2769, 7005, 2355, 18002, 18003, 2306, 2665, 6196,
      7053, 2602, 2551, 2578, 7008, 2525, 2683, 2821, 2614, 2459, 2580, 2487,
      1011, // An element access expression should take an argument
      8016  // Type assertion expressions can only be used in TypeScript files (важно для .jsx файлов)
    ]
  });

  // Настройка отображения полных путей при наведении на импортируемые модули
  setupHoverProviders(monaco);

  return monaco;
};

/**
 * Настраивает отображение подсказок при наведении на элементы
 */
function setupHoverProviders(monaco: any) {
  // Функция для определения относительных путей
  const resolveRelativePath = (basePath: string, relativePath: string): string => {
    // Если путь абсолютный, возвращаем его как есть
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    
    // Получаем корректный базовый путь
    // Удаляем file:// префикс и нормализуем путь
    const normalizedBasePath = basePath.replace(/^file:\/\//, '');
    
    // Получаем путь до корня проекта (предполагаем, что корень проекта - это папка src)
    const projectRoot = normalizedBasePath.includes('/src/') 
      ? normalizedBasePath.substring(0, normalizedBasePath.indexOf('/src/') + 4) // +4 чтобы включить '/src'
      : normalizedBasePath;
    
    // Добавляем информацию о диске, если ее нет
    const fullProjectRoot = projectRoot.match(/^[A-Z]:/i) 
      ? projectRoot 
      : `C:/PROJECTS/X-Editor${projectRoot.startsWith('/') ? '' : '/'}${projectRoot}`;
    
    // Для путей вида ./something
    if (relativePath.startsWith('./')) {
      // Получаем путь без первых двух символов (./)
      const cleanPath = relativePath.slice(2);
      // Получаем директорию текущего файла
      const currentDir = normalizedBasePath.substring(0, normalizedBasePath.lastIndexOf('/'));
      return `${currentDir}/${cleanPath}`;
    }
    
    // Для путей вида ../something
    if (relativePath.startsWith('../')) {
      let currentPath = normalizedBasePath;
      let relPath = relativePath;
      
      // Поднимаемся по "../" вверх по дереву директорий
      while (relPath.startsWith('../')) {
        currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        relPath = relPath.slice(3);
      }
      
      return `${currentPath}/${relPath}`;
    }
    
    // Для импортов без ./ или ../ (модули или абсолютные пути внутри проекта)
    if (!relativePath.startsWith('.')) {
      // Если путь выглядит как путь к модулю проекта, добавляем полный путь
      if (relativePath.includes('/') && !relativePath.startsWith('@')) {
        return `${fullProjectRoot}/${relativePath}`;
      }
      return relativePath;
    }
    
    // Для остальных случаев используем стандартную логику
    // Разбиваем пути на сегменты
    const baseSegments = normalizedBasePath.split('/');
    const relativeSegments = relativePath.split('/');
    
    // Создаем новый результирующий массив сегментов
    const resultSegments = [...baseSegments.slice(0, baseSegments.length - 1)]; // Удаляем последний сегмент (имя файла)
    
    for (const segment of relativeSegments) {
      if (segment === '..') {
        // Поднимаемся на уровень выше
        resultSegments.pop();
      } else if (segment !== '.' && segment !== '') {
        // Добавляем сегмент к пути
        resultSegments.push(segment);
      }
    }
    
    // Собираем путь обратно
    return resultSegments.join('/');
  };
  
  // Функция для получения описания типа
  const getDescriptionForType = (type: string, name: string): string => {
    switch (type) {
      case 'const':
        return `Константа, объявленная с помощью 'const'`;
      case 'let':
        return `Переменная, объявленная с помощью 'let'`;
      case 'var':
        return `Переменная, объявленная с помощью 'var'`;
      case 'function':
        return `Функция '${name}'`;
      case 'class':
        return `Класс '${name}'`;
      case 'interface':
        return `Интерфейс TypeScript '${name}'`;
      case 'type':
        return `Пользовательский тип TypeScript '${name}'`;
      default:
        return `Объявление '${name}'`;
    }
  };

  // Шаблон для обработки наведения на импорты
  const processImportHover = (model: any, position: any, importPath: string, isRequire: boolean = false) => {
    const isNpmPackage = !importPath.startsWith('./') && !importPath.startsWith('../') && 
                          (importPath.startsWith('@') || !importPath.includes('/'));
    
    let hoverContent = '';
    
    if (isNpmPackage) {
      // Информация о npm пакете
      const packageInfo: Record<string, string> = {
        'react': 'React - библиотека для создания пользовательских интерфейсов',
        'react-dom': 'ReactDOM - рендерер для React в браузере',
        'next': 'Next.js - фреймворк для React с SSR',
        '@tauri-apps': 'Tauri - фреймворк для создания нативных приложений',
        'monaco-editor': 'Monaco Editor - редактор кода, используемый в VS Code',
        '@monaco-editor/react': 'React компонент для Monaco Editor',
        'clsx': 'Утилита для условной конкатенации строк CSS классов',
        'tailwind-merge': 'Утилита для объединения Tailwind CSS классов без конфликтов',
      };
      
      const packageName = importPath.split('/')[0];
      hoverContent = `**${importPath}**\n\n`;
      
      if (packageInfo[packageName]) {
        hoverContent += packageInfo[packageName] + '\n\n';
      }
      
      hoverContent += 'Полный путь: `node_modules/' + importPath + '`';
      
      // Тип импорта для JavaScript
      if (isRequire) {
        hoverContent += '\n\nТип: CommonJS импорт (require)';
      } else {
        hoverContent += '\n\nТип: ES модуль';
      }
    } else {
      // Относительный импорт
      const filePath = model.uri.path;
      const basePath = filePath.substring(0, filePath.lastIndexOf('/'));
      const fullPath = resolveRelativePath(basePath, importPath);
      
      // Проверяем на дублирование пути в тексте подсказки
      const importPathClean = importPath.endsWith('/') ? importPath.slice(0, -1) : importPath;
      const fullPathClean = fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
      
      // Проверяем, не повторяет ли полный путь уже показанный относительный
      const showBothPaths = !fullPathClean.endsWith(importPathClean) && 
                           !importPathClean.endsWith(fullPathClean);
      
      hoverContent = `**${importPath}**\n\n`;
      
      if (showBothPaths) {
        hoverContent += `Полный путь: \`${fullPath}\``;
      } else {
        // Если один путь содержит другой, показываем только полный
        hoverContent += `Путь: \`${fullPath}\``;
      }
      
      // Определение типа файла
      let fileExtension = '';
      
      // Извлекаем расширение из пути модуля
      if (importPath.includes('.')) {
        fileExtension = importPath.split('.').pop() || '';
      } else {
        // Если расширение не указано, предполагаем несколько вариантов
        const possibleExts = ['ts', 'tsx', 'js', 'jsx'];
        hoverContent += '\n\nРасширение не указано, может быть один из следующих файлов:';
        for (const ext of possibleExts) {
          hoverContent += `\n- \`${fullPath}.${ext}\``;
        }
        hoverContent += `\n- \`${fullPath}/index.[ts|tsx|js|jsx]\``;
      }
      
      if (fileExtension) {
        const fileTypeInfo: Record<string, string> = {
          'ts': 'TypeScript файл',
          'tsx': 'TypeScript с JSX компонентами',
          'js': 'JavaScript файл',
          'jsx': 'JavaScript с JSX компонентами',
          'css': 'CSS стили',
          'scss': 'SCSS стили',
          'less': 'LESS стили',
          'json': 'JSON файл данных',
          'md': 'Markdown документация',
          'mdx': 'MDX документация с компонентами',
          'svg': 'SVG векторная графика',
          'png': 'PNG изображение',
          'jpg': 'JPEG изображение',
          'jpeg': 'JPEG изображение',
          'gif': 'GIF изображение',
          'webp': 'WebP изображение',
          'woff': 'Web Open Font Format шрифт',
          'woff2': 'Web Open Font Format 2 шрифт',
          'eot': 'Embedded OpenType шрифт',
          'ttf': 'TrueType шрифт',
          'otf': 'OpenType шрифт',
        };
        
        if (fileTypeInfo[fileExtension]) {
          hoverContent += `\n\nТип: ${fileTypeInfo[fileExtension]}`;
        }
      }
      
      // Тип импорта
      if (isRequire) {
        hoverContent += '\n\nТип: CommonJS импорт (require)';
      } else {
        hoverContent += '\n\nТип: ES модуль';
      }
    }
    
    return {
      contents: [
        { value: hoverContent }
      ]
    };
  };

  // Регистрируем провайдер наведения для TypeScript
  monaco.languages.registerHoverProvider('typescript', {
    provideHover: function(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      
      const lineContent = model.getLineContent(position.lineNumber);
      
      // Проверяем, является ли это импортом
      const importMatch = lineContent.match(/import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch && lineContent.includes(word.word)) {
        const modulePath = importMatch[1];
        return processImportHover(model, position, modulePath);
      }
      
      // Проверяем, является ли это переменной или функцией
      const variableMatch = lineContent.match(/(const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]+)/);
      if (variableMatch && word.word === variableMatch[2]) {
        // Находим объявления переменных/функций и добавляем к ним подсказки
        return {
          contents: [
            { value: `**${word.word}** - ${getDescriptionForType(variableMatch[1], word.word)}` }
          ]
        };
      }
      
      return null;
    }
  });
  
  // Регистрируем для JavaScript
  monaco.languages.registerHoverProvider('javascript', {
    provideHover: function(model: any, position: any) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      
      const lineContent = model.getLineContent(position.lineNumber);
      
      // Проверяем, является ли это импортом
      const importMatch = lineContent.match(/import\s+(?:.*?)\s+from\s+['"]([^'"]+)['"]/);
      const requireMatch = lineContent.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
      
      if ((importMatch && lineContent.includes(word.word))) {
        return processImportHover(model, position, importMatch[1]);
      } else if (requireMatch && lineContent.includes(word.word)) {
        return processImportHover(model, position, requireMatch[1], true);
      }
      
      // Проверяем, является ли это переменной или функцией
      const variableMatch = lineContent.match(/(const|let|var|function|class)\s+([a-zA-Z0-9_]+)/);
      if (variableMatch && word.word === variableMatch[2]) {
        // Находим объявления переменных/функций и добавляем к ним подсказки
        return {
          contents: [
            { value: `**${word.word}** - ${getDescriptionForType(variableMatch[1], word.word)}` }
          ]
        };
      }
      
      return null;
    }
  });
}
