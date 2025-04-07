import * as monaco from 'monaco-editor';

/**
 * Регистрирует JSON поддержку в Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function registerJSON(monacoInstance: any): void {
  try {
    console.log('Регистрация JSON в Monaco Editor...');
    
    // Используем параметр или глобальный экземпляр Monaco
    const m = monacoInstance || monaco;
    
    // Проверяем наличие monaco.languages
    if (!m.languages) {
      console.error('monaco.languages не доступен');
      return;
    }
    
    // Регистрируем язык JSON и JSONC, если еще не зарегистрированы
    const languages = m.languages.getLanguages();
    const jsonRegistered = languages.some((lang: any) => lang.id === 'json');
    const jsoncRegistered = languages.some((lang: any) => lang.id === 'jsonc');
    
    if (!jsonRegistered) {
      // Регистрируем язык JSON
      m.languages.register({
        id: 'json',
        extensions: ['.json', '.jsonld'],
        aliases: ['JSON', 'json'],
        mimetypes: ['application/json']
      });
      
      console.log('JSON язык зарегистрирован в Monaco');
    }
    
    if (!jsoncRegistered) {
      // Регистрируем язык JSONC (JSON с комментариями)
      m.languages.register({
        id: 'jsonc',
        extensions: ['.jsonc'],
        aliases: ['JSONC', 'jsonc'],
        mimetypes: ['application/json']
      });
      
      console.log('JSONC язык зарегистрирован в Monaco');
    }
    
    // Настраиваем конфигурацию языка JSON
    m.languages.setLanguageConfiguration('json', {
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
        { open: '"', close: '"', notIn: ['string'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: "'", close: "'" },
        { open: '"', close: '"' }
      ],
      folding: {
        markers: {
          start: /^\s*\/\*\s*#region\b\s*(.*?)\s*\*\//,
          end: /^\s*\/\*\s*#endregion\b.*\*\//
        }
      },
      onEnterRules: [
        {
          // Правило для обработки запятых и переносов строк
          beforeText: /^\s*("[^"]*"\s*:\s*)?(\{|\[)(\s*|\s*\/\/.*|\s*\/\*.*\*\/\s*)$/,
          afterText: /^\s*\}|\]$/,
          action: {
            indentAction: m.languages.IndentAction.Indent
          }
        }
      ]
    });
    
    // Копируем настройки для JSONC
    m.languages.setLanguageConfiguration('jsonc', m.languages.getLanguageConfiguration('json'));
    
    // Настройка форматирования и проверки JSON
    if (m.languages.json && m.languages.json.jsonDefaults) {
      m.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false, // Стандартный JSON без комментариев
        schemaValidation: 'error',
        schemaRequest: 'error',
        trailingCommas: 'error'
      });
      
      // Настраиваем форматирование
      m.languages.json.jsonDefaults.setFormattingOptions({
        tabSize: 2,
        insertSpaces: true,
        convertTabsToSpaces: true,
        trimTrailingWhitespace: true,
        insertFinalNewline: true,
        trimFinalNewlines: true
      });
    } else {
      console.warn('JSON диагностика не поддерживается в данной версии Monaco');
    }
    
    // Настройка форматирования и проверки JSONC (JSON с комментариями)
    if (m.languages.json && m.languages.json.jsonDefaults) {
      // Для JSONC создаем тот же обработчик, но разрешаем комментарии
      m.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true, // JSONC с поддержкой комментариев
        schemaValidation: 'error',
        schemaRequest: 'warning',
        trailingCommas: 'warning' // В JSONC к запятым мы более снисходительны
      });
    }
    
    console.log('JSON поддержка успешно настроена в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при регистрации JSON в Monaco Editor:', error);
  }
} 