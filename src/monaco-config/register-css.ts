import * as monaco from 'monaco-editor';

/**
 * Регистрирует CSS поддержку в Monaco Editor
 * @param monacoInstance Экземпляр Monaco Editor
 */
export function registerCSS(monacoInstance: any): void {
  try {
    console.log('Регистрация CSS в Monaco Editor...');
    
    // Используем параметр или глобальный экземпляр Monaco
    const m = monacoInstance || monaco;
    
    // Проверяем наличие monaco.languages
    if (!m.languages) {
      console.error('monaco.languages не доступен');
      return;
    }
    
    // Регистрируем язык CSS, если еще не зарегистрирован
    const languages = m.languages.getLanguages();
    const cssRegistered = languages.some((lang: any) => lang.id === 'css');
    
    if (!cssRegistered) {
      // Регистрируем язык CSS
      m.languages.register({
        id: 'css',
        extensions: ['.css'],
        aliases: ['CSS', 'css'],
        mimetypes: ['text/css']
      });
      
      console.log('CSS язык зарегистрирован в Monaco');
    }
    
    // Регистрируем конфигурацию языка CSS
    m.languages.setLanguageConfiguration('css', {
      wordPattern: /(#?-?\d*\.\d\w*%?)|((::|[@#.!:])?[\w-?]+%?)|::|[@#.!:]/g,
      comments: {
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
        { open: '"', close: '"', notIn: ['string', 'comment'] }
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
      }
    });
    
    // Добавляем диагностику CSS
    if (m.languages.css && m.languages.css.cssDefaults) {
      m.languages.css.cssDefaults.setDiagnosticsOptions({
        validate: true,
        lint: {
          compatibleVendorPrefixes: 'warning',
          vendorPrefix: 'warning',
          duplicateProperties: 'warning',
          emptyRules: 'warning',
          importStatement: 'warning',
          boxModel: 'warning',
          universalSelector: 'warning',
          zeroUnits: 'warning',
          fontFaceProperties: 'warning',
          hexColorLength: 'warning',
          argumentsInColorFunction: 'warning',
          unknownProperties: 'warning',
          ieHack: 'warning',
          unknownVendorSpecificProperties: 'warning',
          propertyIgnoredDueToDisplay: 'warning',
          important: 'warning',
          float: 'warning',
          idSelector: 'warning'
        }
      });
    } else {
      console.warn('CSS диагностика не поддерживается в данной версии Monaco');
    }
    
    console.log('CSS поддержка успешно настроена в Monaco Editor');
  } catch (error) {
    console.error('Ошибка при регистрации CSS в Monaco Editor:', error);
  }
} 