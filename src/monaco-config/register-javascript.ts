import * as monaco from 'monaco-editor';

/**
 * Регистрирует JavaScript поддержку в Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function registerJavaScript(monacoInstance: any): void {
  try {
    console.log('Регистрация JavaScript в Monaco Editor...');
    
    // Используем параметр или глобальный экземпляр Monaco
    const m = monacoInstance || monaco;
    
    // Проверяем наличие monaco.languages
    if (!m.languages) {
      console.error('monaco.languages не доступен');
      return;
    }
    
    // Проверяем наличие monaco.languages.typescript для настройки JavaScript
    if (!m.languages.typescript) {
      console.error('monaco.languages.typescript не доступен');
      return;
    }
    
    // Регистрируем языки JavaScript и JSX, если еще не зарегистрированы
    const languages = m.languages.getLanguages();
    const jsRegistered = languages.some((lang: any) => lang.id === 'javascript');
    const jsxRegistered = languages.some((lang: any) => lang.id === 'javascriptreact');
    
    if (!jsRegistered) {
      // Регистрируем язык JavaScript
      m.languages.register({
        id: 'javascript',
        extensions: ['.js', '.mjs', '.cjs'],
        aliases: ['JavaScript', 'javascript', 'js'],
        mimetypes: ['text/javascript']
      });
      
      console.log('JavaScript язык зарегистрирован в Monaco');
    }
    
    if (!jsxRegistered) {
      // Регистрируем язык JSX
      m.languages.register({
        id: 'javascriptreact',
        extensions: ['.jsx'],
        aliases: ['JavaScript React', 'jsx'],
        mimetypes: ['text/jsx']
      });
      
      console.log('JSX язык зарегистрирован в Monaco');
    }
    
    // Настраиваем компилятор для JavaScript
    const jsDefaults = m.languages.typescript.javascriptDefaults;
    
    // Настройка компилятора JavaScript
    jsDefaults.setCompilerOptions({
      target: m.languages.typescript.ScriptTarget.ESNext,
      module: m.languages.typescript.ModuleKind.ESNext,
      allowNonTsExtensions: true,
      lib: ['dom', 'es2020'],
      jsx: m.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowJs: true,
      checkJs: false,
      strict: false,
      noImplicitAny: false,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs
    });
    
    // Настройка параметров диагностики
    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        // Игнорируем ошибки модулей
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016, // Could not find a declaration file for module 'X'
        // TypeScript-специфичные конструкции в JavaScript
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        // Другие частые ошибки
        2304,  // Cannot find name 'X'
        2339,  // Property 'X' does not exist on type 'Y'
        2551   // Property 'X' does not exist on type 'Y'. Did you mean 'Z'?
      ]
    });
    
    // Настраиваем форматирование
    jsDefaults.setFormattingOptions({
      tabSize: 2,
      insertSpaces: true,
      convertTabsToSpaces: true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true,
      trimFinalNewlines: true
    });
    
    // Конфигурация языка для JavaScript и JSX
    m.languages.setLanguageConfiguration('javascript', {
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string', 'comment'] },
        { open: '`', close: '`', notIn: ['string', 'comment'] },
        { open: '/**', close: ' */', notIn: ['string'] }
      ],
      onEnterRules: [
        {
          // Автоматически добавляем звездочку в блочном комментарии
          beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
          afterText: /^\s*\*\/$/,
          action: {
            indentAction: m.languages.IndentAction.IndentOutdent,
            appendText: ' * '
          }
        },
        {
          // Автоматически добавляем звездочку для продолжения блочного комментария
          beforeText: /^\s*\*(?!\/)([^\*]|\*(?!\/))*$/,
          action: {
            indentAction: m.languages.IndentAction.None,
            appendText: '* '
          }
        },
        {
          // Автоматическое закрытие блока JSX после открывающего тега
          beforeText: /^\s*<(\w+)(?:\s+[\w\-.:]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^\}]*\}))?)*\s*>\s*$/,
          afterText: /^\s*<\/(\w+)>\s*$/,
          action: { indentAction: m.languages.IndentAction.Indent }
        }
      ]
    });
    
    // Применяем те же настройки для JSX
    m.languages.setLanguageConfiguration('javascriptreact', m.languages.getLanguageConfiguration('javascript'));
    
    console.log('JavaScript и JSX поддержка успешно настроена в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при регистрации JavaScript в Monaco Editor:', error);
  }
} 