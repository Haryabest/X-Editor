import * as monaco from 'monaco-editor';

/**
 * Регистрирует HTML поддержку в Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function registerHTML(monacoInstance: any): void {
  try {
    console.log('Регистрация HTML в Monaco Editor...');
    
    // Используем параметр или глобальный экземпляр Monaco
    const m = monacoInstance || monaco;
    
    // Проверяем наличие monaco.languages
    if (!m.languages) {
      console.error('monaco.languages не доступен');
      return;
    }
    
    // Регистрируем язык HTML, если еще не зарегистрирован
    const languages = m.languages.getLanguages();
    const htmlRegistered = languages.some((lang: any) => lang.id === 'html');
    
    if (!htmlRegistered) {
      // Регистрируем язык HTML
      m.languages.register({
        id: 'html',
        extensions: ['.html', '.htm', '.xhtml', '.vue'],
        aliases: ['HTML', 'html'],
        mimetypes: ['text/html', 'text/x-html']
      });
      
      console.log('HTML язык зарегистрирован в Monaco');
    }
    
    // Регистрируем конфигурацию языка HTML
    m.languages.setLanguageConfiguration('html', {
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      comments: {
        blockComment: ['<!--', '-->']
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['<', '>']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string', 'comment'] },
        { open: '<!--', close: '-->', notIn: ['comment'] },
        { open: '<', close: '>', notIn: ['string', 'comment'] }
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
        { open: '<', close: '>' }
      ],
      folding: {
        markers: {
          start: /<!--\s*#region\b.*-->/,
          end: /<!--\s*#endregion\b.*-->/
        }
      },
      onEnterRules: [
        {
          beforeText: /^\s*<(div|section|article|main|header|footer|p|h[1-6]|ul|ol|li|table|tr|td|th).*>\s*$/i,
          afterText: /^\s*<\/(div|section|article|main|header|footer|p|h[1-6]|ul|ol|li|table|tr|td|th)>\s*$/i,
          action: { indentAction: m.languages.IndentAction.Indent }
        }
      ]
    });
    
    // Добавляем диагностику HTML
    if (m.languages.html && m.languages.html.htmlDefaults) {
      m.languages.html.htmlDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        format: {
          tabSize: 2,
          insertSpaces: true,
          wrapLineLength: 120,
          unformatted: 'pre,code,textarea',
          indentInnerHtml: true,
          preserveNewLines: true,
          maxPreserveNewLines: 2,
          indentHandlebars: false,
          endWithNewline: false,
          extraLiners: 'head, body, /html'
        }
      });
    } else {
      console.warn('HTML диагностика не поддерживается в данной версии Monaco');
    }
    
    console.log('HTML поддержка успешно настроена в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при регистрации HTML в Monaco Editor:', error);
  }
} 