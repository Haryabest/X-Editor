import * as monaco from 'monaco-editor';
import { getLanguageFromExtension } from './language-detector';

/**
 * Регистрирует все основные языки в Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function registerLanguages(monacoInstance: any): void {
  try {
    console.log('Регистрация основных языков в Monaco Editor...');
    
    // Используем параметр или глобальный экземпляр Monaco
    const m = monacoInstance || monaco;
    
    // Проверяем наличие monaco.languages
    if (!m.languages) {
      console.error('monaco.languages не доступен');
      return;
    }
    
    // Базовые языки программирования и их расширения файлов
    const languageDefinitions = [
      {
        id: 'typescript',
        extensions: ['.ts', '.d.ts'],
        aliases: ['TypeScript', 'ts', 'typescript'],
        mimetypes: ['text/typescript']
      },
      {
        id: 'typescriptreact',
        extensions: ['.tsx'],
        aliases: ['TypeScript React', 'tsx', 'typescriptreact'],
        mimetypes: ['text/typescript-jsx']
      },
      {
        id: 'javascript',
        extensions: ['.js', '.mjs', '.cjs'],
        aliases: ['JavaScript', 'javascript', 'js'],
        mimetypes: ['text/javascript']
      },
      {
        id: 'javascriptreact',
        extensions: ['.jsx'],
        aliases: ['JavaScript React', 'jsx'],
        mimetypes: ['text/jsx']
      },
      {
        id: 'html',
        extensions: ['.html', '.htm', '.xhtml', '.vue'],
        aliases: ['HTML', 'html'],
        mimetypes: ['text/html', 'text/x-html']
      },
      {
        id: 'css',
        extensions: ['.css'],
        aliases: ['CSS', 'css'],
        mimetypes: ['text/css']
      },
      {
        id: 'scss',
        extensions: ['.scss'],
        aliases: ['SCSS', 'scss', 'sass'],
        mimetypes: ['text/x-scss', 'text/scss']
      },
      {
        id: 'less',
        extensions: ['.less'],
        aliases: ['LESS', 'less'],
        mimetypes: ['text/x-less', 'text/less']
      },
      {
        id: 'json',
        extensions: ['.json', '.jsonld'],
        aliases: ['JSON', 'json'],
        mimetypes: ['application/json']
      },
      {
        id: 'jsonc',
        extensions: ['.jsonc'],
        aliases: ['JSONC', 'jsonc'],
        mimetypes: ['application/json']
      },
      {
        id: 'markdown',
        extensions: ['.md', '.markdown', '.mdown', '.mkdn'],
        aliases: ['Markdown', 'markdown'],
        mimetypes: ['text/markdown']
      },
      {
        id: 'yaml',
        extensions: ['.yaml', '.yml'],
        aliases: ['YAML', 'yaml', 'yml'],
        mimetypes: ['application/x-yaml']
      },
      {
        id: 'xml',
        extensions: ['.xml', '.xsd', '.xsl', '.xslt', '.svg'],
        aliases: ['XML', 'xml'],
        mimetypes: ['application/xml', 'text/xml']
      },
      {
        id: 'python',
        extensions: ['.py', '.pyw', '.pyi', '.pyc', '.pyd'],
        aliases: ['Python', 'python', 'py'],
        mimetypes: ['text/x-python', 'application/x-python']
      },
      {
        id: 'shell',
        extensions: ['.sh', '.bash', '.zsh', '.ksh'],
        aliases: ['Shell', 'shell', 'bash'],
        mimetypes: ['text/x-sh', 'application/x-sh']
      },
      {
        id: 'powershell',
        extensions: ['.ps1', '.psm1', '.psd1'],
        aliases: ['PowerShell', 'powershell', 'ps', 'ps1'],
        mimetypes: ['application/x-powershell']
      },
      {
        id: 'sql',
        extensions: ['.sql'],
        aliases: ['SQL', 'sql'],
        mimetypes: ['application/sql', 'text/x-sql']
      },
      {
        id: 'rust',
        extensions: ['.rs', '.rlib'],
        aliases: ['Rust', 'rust'],
        mimetypes: ['text/x-rust']
      },
      {
        id: 'go',
        extensions: ['.go'],
        aliases: ['Go', 'go'],
        mimetypes: ['text/x-go']
      },
      {
        id: 'c',
        extensions: ['.c', '.h'],
        aliases: ['C', 'c'],
        mimetypes: ['text/x-c']
      },
      {
        id: 'cpp',
        extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
        aliases: ['C++', 'Cpp', 'cpp'],
        mimetypes: ['text/x-c++src']
      }
    ];
    
    // Получаем текущие зарегистрированные языки
    const existingLanguages = m.languages.getLanguages().map((lang: any) => lang.id);
    
    // Регистрируем недостающие языки
    languageDefinitions.forEach(def => {
      if (!existingLanguages.includes(def.id)) {
        m.languages.register(def);
        console.log(`Зарегистрирован язык: ${def.id}`);
      }
    });
    
    // Установка обработчика для автоматического определения языка файла
    m.editor.onDidCreateModel((model: any) => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      
      // Определяем язык на основе расширения файла
      const language = getLanguageFromExtension(fileName);
      
      // Если язык определен и не совпадает с текущим, устанавливаем новый
      if (language && model.getLanguageId() !== language) {
        m.editor.setModelLanguage(model, language);
      }
    });
    
    console.log('Успешно зарегистрированы основные языки в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при регистрации языков в Monaco Editor:', error);
  }
}

/**
 * Настраивает темную тему Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function configureDarkTheme(monacoInstance: any): void {
  try {
    const m = monacoInstance || monaco;
    
    // Регистрируем темную тему
    m.editor.defineTheme('x-editor-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'regexp', foreground: 'D16969' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'namespace', foreground: '4EC9B0' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'struct', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0' },
        { token: 'interface', foreground: '4EC9B0' },
        { token: 'enum', foreground: '4EC9B0' },
        { token: 'typeParameter', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'member', foreground: '9CDCFE' },
        { token: 'macro', foreground: 'BD63C5' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'parameter', foreground: '9CDCFE' },
        { token: 'property', foreground: '9CDCFE' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'enumMember', foreground: '4FC1FF' },
        { token: 'boolean', foreground: '569CD6' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'symbol', foreground: 'D4D4D4' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorCursor.foreground': '#AEAFAD',
        'editor.lineHighlightBackground': '#2D2D2D',
        'editorLineNumber.foreground': '#858585',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editor.selectionHighlightBackground': '#ADD6FF26',
        'editor.findMatchBackground': '#A8AC94',
        'editor.findMatchHighlightBackground': '#515C6A',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.foreground': '#D4D4D4',
        'editorSuggestWidget.highlightForeground': '#0097FB',
        'editorSuggestWidget.selectedBackground': '#04395E',
        'editorHoverWidget.background': '#252526',
        'editorHoverWidget.border': '#454545',
        'debugToolBar.background': '#333333',
        'editor.lineHighlightBorder': '#282828',
        'editorOverviewRuler.border': '#7F7F7F4D',
        'editor.wordHighlightBackground': '#575757B8'
      }
    });
    
    console.log('Настроена темная тема для Monaco Editor');
  } catch (error) {
    console.error('Ошибка при настройке темной темы Monaco Editor:', error);
  }
}

/**
 * Настраивает светлую тему Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function configureLightTheme(monacoInstance: any): void {
  try {
    const m = monacoInstance || monaco;
    
    // Регистрируем светлую тему
    m.editor.defineTheme('x-editor-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000FF' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
        { token: 'regexp', foreground: '811F3F' },
        { token: 'operator', foreground: '000000' },
        { token: 'namespace', foreground: '267F99' },
        { token: 'type', foreground: '267F99' },
        { token: 'struct', foreground: '267F99' },
        { token: 'class', foreground: '267F99' },
        { token: 'interface', foreground: '267F99' },
        { token: 'enum', foreground: '267F99' },
        { token: 'typeParameter', foreground: '267F99' },
        { token: 'function', foreground: '795E26' },
        { token: 'member', foreground: '001080' },
        { token: 'macro', foreground: 'AF00DB' },
        { token: 'variable', foreground: '001080' },
        { token: 'parameter', foreground: '001080' },
        { token: 'property', foreground: '001080' },
        { token: 'constant', foreground: '0070C1' },
        { token: 'enumMember', foreground: '0070C1' },
        { token: 'boolean', foreground: '0000FF' },
        { token: 'tag', foreground: '800000' },
        { token: 'symbol', foreground: '000000' },
        { token: 'delimiter', foreground: '000000' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#000000',
        'editorCursor.foreground': '#000000',
        'editor.lineHighlightBackground': '#F5F5F5',
        'editorLineNumber.foreground': '#237893',
        'editor.selectionBackground': '#ADD6FF',
        'editor.inactiveSelectionBackground': '#E5EBF1',
        'editorIndentGuide.background': '#D3D3D3',
        'editorIndentGuide.activeBackground': '#939393',
        'editor.selectionHighlightBackground': '#ADD6FF80',
        'editor.findMatchBackground': '#A8AC94',
        'editor.findMatchHighlightBackground': '#EA5C0055',
        'editorSuggestWidget.background': '#F3F3F3',
        'editorSuggestWidget.border': '#C8C8C8',
        'editorSuggestWidget.foreground': '#000000',
        'editorSuggestWidget.highlightForeground': '#0066BF',
        'editorSuggestWidget.selectedBackground': '#DCEBFC',
        'editorHoverWidget.background': '#F3F3F3',
        'editorHoverWidget.border': '#C8C8C8',
        'debugToolBar.background': '#F3F3F3',
        'editor.lineHighlightBorder': '#EEEEEE',
        'editorOverviewRuler.border': '#7F7F7F4D',
        'editor.wordHighlightBackground': '#57575720'
      }
    });
    
    console.log('Настроена светлая тема для Monaco Editor');
  } catch (error) {
    console.error('Ошибка при настройке светлой темы Monaco Editor:', error);
  }
}

/**
 * Настраивает форматтеры для различных языков
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function setupFormatters(monacoInstance: any): void {
  try {
    const m = monacoInstance || monaco;
    
    // Базовые настройки форматирования для всех языков
    const defaultFormatOptions = {
      tabSize: 2,
      insertSpaces: true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true,
      trimFinalNewlines: true
    };
    
    // Применяем форматирование для различных языков
    if (m.languages.typescript) {
      // JavaScript и TypeScript
      m.languages.typescript.typescriptDefaults.setFormattingOptions(defaultFormatOptions);
      m.languages.typescript.javascriptDefaults.setFormattingOptions(defaultFormatOptions);
    }
    
    if (m.languages.json) {
      // JSON
      m.languages.json.jsonDefaults.setFormattingOptions(defaultFormatOptions);
    }
    
    if (m.languages.css) {
      // CSS
      m.languages.css.cssDefaults.setFormattingOptions(defaultFormatOptions);
    }
    
    if (m.languages.html) {
      // HTML
      m.languages.html.htmlDefaults.setFormattingOptions({
        ...defaultFormatOptions,
        wrapLineLength: 120,
        unformatted: 'pre,code,textarea',
        indentInnerHtml: true,
        preserveNewLines: true,
        maxPreserveNewLines: 2,
        indentHandlebars: false,
        endWithNewline: true
      });
    }
    
    console.log('Настроены форматтеры для языков в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при настройке форматтеров в Monaco Editor:', error);
  }
} 