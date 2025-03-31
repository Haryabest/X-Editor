/**
 * Monaco LSP Hover Provider
 * 
 * Обеспечивает показ подсказок при наведении на элементы кода
 * Интегрируется с Language Server Protocol
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { languageServerManager } from './monaco-lsp-server-manager';

/**
 * Класс для реализации подсказок при наведении через LSP
 */
export class MonacoLSPHoverProvider {
  private monaco: any;
  private providers: Map<string, any> = new Map();
  
  /**
   * Конструктор
   */
  constructor(monaco: any) {
    if (!monaco) {
      console.warn('Monaco не определен в HoverProvider');
      return;
    }
    this.monaco = monaco;
  }
  
  /**
   * Регистрация провайдера для языка
   */
  public registerHoverProvider(languageId: string): any {
    if (!this.monaco || !languageId) return null;
    
    try {
      // Проверяем, не зарегистрирован ли уже провайдер для этого языка
      if (this.providers.has(languageId)) {
        return this.providers.get(languageId);
      }
      
      // Создаем провайдер подсказок
      const provider = this.monaco.languages.registerHoverProvider(languageId, {
        provideHover: this.provideHover.bind(this)
      });
      
      // Сохраняем ссылку на провайдер
      this.providers.set(languageId, provider);
      
      console.log(`Зарегистрирован LSP HoverProvider для языка: ${languageId}`);
      return provider;
    } catch (error) {
      console.error(`Ошибка при регистрации HoverProvider для языка ${languageId}:`, error);
      return null;
    }
  }
  
  /**
   * Предоставление подсказок
   */
  private async provideHover(model: any, position: any, token: any): Promise<any> {
    if (!model || !position) return null;
    
    try {
      const uri = model.uri.toString();
      const languageId = model.getLanguageId();
      
      // Извлекаем текст из модели для лучшего определения контекста
      const wordInfo = this.extractWordAtPosition(model, position);
      
      // Получаем список серверов, которые могут обрабатывать этот язык
      const servers = this.getLanguageServersForLanguage(languageId);
      if (!servers || servers.length === 0) return null;
      
      // Используем первый доступный сервер
      const serverId = servers[0];
      
      // Преобразуем позицию Monaco в формат LSP
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1
      };
      
      // Отправляем запрос на сервер с дополнительным контекстом
      const response = await languageServerManager.sendRequest(serverId, 'textDocument/hover', {
        textDocument: { uri },
        position: lspPosition,
        context: {
          word: wordInfo.word,
          range: wordInfo.range,
          lineText: wordInfo.lineText
        }
      });
      
      // Если нет данных или отмена запроса, возвращаем null
      if (!response || token.isCancellationRequested) return null;
      
      // Обрабатываем ответ от LSP в формат Monaco
      return this.convertHoverResponse(response);
    } catch (error) {
      console.error('Ошибка при получении подсказки:', error);
      return null;
    }
  }
  
  /**
   * Извлечение слова и контекста из позиции
   */
  private extractWordAtPosition(model: any, position: any): { word: string, range: any, lineText: string } {
    try {
      // Получаем текст строки, в которой находится курсор
      const lineText = model.getLineContent(position.lineNumber) || '';
      
      // Получаем информацию о слове в позиции (встроенная функция Monaco)
      let wordInfo = null;
      try {
        wordInfo = model.getWordAtPosition(position);
      } catch (e) {
        console.warn('Ошибка при получении слова из модели:', e);
      }
      
      // Если не смогли получить слово стандартным способом, извлекаем вручную
      if (!wordInfo) {
        // Простая эвристика для определения границ слова
        let startColumn = position.column;
        let endColumn = position.column;
        
        // Определяем начало слова
        while (startColumn > 1) {
          const char = lineText.charAt(startColumn - 2); // -1 для индекса, -1 для предыдущего символа
          if (!/[a-zA-Z0-9_$]/.test(char)) break;
          startColumn--;
        }
        
        // Определяем конец слова
        while (endColumn <= lineText.length) {
          const char = lineText.charAt(endColumn - 1); // -1 для индекса
          if (!/[a-zA-Z0-9_$]/.test(char)) break;
          endColumn++;
        }
        
        // Создаем информацию о слове
        const word = lineText.substring(startColumn - 1, endColumn - 1);
        
        wordInfo = {
          word,
          startColumn,
          endColumn
        };
      }
      
      // Подготавливаем диапазон слова
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: wordInfo ? wordInfo.startColumn : position.column,
        endLineNumber: position.lineNumber,
        endColumn: wordInfo ? wordInfo.endColumn : position.column + 1
      };
      
      return {
        word: wordInfo ? wordInfo.word : '',
        range,
        lineText
      };
    } catch (error) {
      console.error('Ошибка при извлечении слова из позиции:', error);
      return {
        word: '',
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column + 1
        },
        lineText: ''
      };
    }
  }
  
  /**
   * Конвертация ответа LSP в формат Monaco
   */
  private convertHoverResponse(response: any): any {
    if (!response || !response.contents) return null;
    
    try {
      const contents = [];
      
      // Обрабатываем различные форматы содержимого
      if (typeof response.contents === 'string') {
        // Строка
        contents.push({ value: response.contents });
      } else if (response.contents.kind === 'markdown' || response.contents.kind === 'plaintext') {
        // MarkupContent
        contents.push({ value: response.contents.value });
      } else if (Array.isArray(response.contents)) {
        // MarkedString[]
        response.contents.forEach(content => {
          if (typeof content === 'string') {
            contents.push({ value: content });
          } else if (content.language && content.value) {
            contents.push({ value: `\`\`\`${content.language}\n${content.value}\n\`\`\`` });
          }
        });
      } else if (response.contents.language && response.contents.value) {
        // MarkedString
        contents.push({ value: `\`\`\`${response.contents.language}\n${response.contents.value}\n\`\`\`` });
      }
      
      // Проверяем, содержит ли ответ достаточно информации
      const totalContent = contents.map(c => c.value || '').join('');
      
      // Если содержимое почти пустое или слишком короткое, добавляем дополнительную информацию
      if (totalContent.length < 30 && response.word) {
        const additionalInfo = this.provideFallbackHover(response.word, response.languageId);
        if (additionalInfo && additionalInfo.contents) {
          additionalInfo.contents.forEach((content: any) => {
            contents.push(content);
          });
        }
      }
      
      // Создаем диапазон для подсказки
      let range = undefined;
      if (response.range) {
        range = {
          startLineNumber: response.range.start.line + 1,
          startColumn: response.range.start.character + 1,
          endLineNumber: response.range.end.line + 1,
          endColumn: response.range.end.character + 1
        };
      }
      
      // Если все еще нет содержимого, возвращаем null
      if (contents.length === 0) return null;
      
      // Возвращаем подсказку в формате Monaco
      return {
        contents,
        range
      };
    } catch (error) {
      console.error('Ошибка при конвертации ответа hover:', error);
      return null;
    }
  }
  
  /**
   * Получение подходящих серверов для языка
   */
  private getLanguageServersForLanguage(languageId: string): string[] {
    if (!languageId) return [];
    
    try {
      // Мэппинг языков к серверам
      const languageToServer: Record<string, string[]> = {
        'typescript': ['typescript'],
        'javascript': ['typescript'],
        'typescriptreact': ['typescript'],
        'javascriptreact': ['typescript'],
        'html': ['html'],
        'css': ['css'],
        'json': ['json']
      };
      
      return languageToServer[languageId] || [];
    } catch (error) {
      console.error(`Ошибка при определении серверов для языка ${languageId}:`, error);
      return [];
    }
  }
  
  /**
   * Предоставление дополнительных подсказок для улучшения UX
   */
  public provideFallbackHover(word: string, languageId: string): any {
    // Общие подсказки для различных языков
    const commonHints: Record<string, Record<string, string>> = {
      'typescript': {
        'import': 'Импортирует модули или их части в текущий файл',
        'export': 'Экспортирует функции, объекты или значения для использования в других модулях',
        'const': 'Объявляет константу только для чтения',
        'let': 'Объявляет переменную с блочной областью видимости',
        'function': 'Объявляет функцию',
        'interface': 'Определяет типы для объектов',
        'type': 'Создаёт псевдоним типа или определяет составной тип',
        'class': 'Определяет класс',
      },
      'javascript': {
        'import': 'Импортирует модули или их части в текущий файл',
        'export': 'Экспортирует функции, объекты или значения для использования в других модулях',
        'const': 'Объявляет константу только для чтения',
        'let': 'Объявляет переменную с блочной областью видимости',
        'var': 'Объявляет переменную с функциональной или глобальной областью видимости',
        'function': 'Объявляет функцию',
      },
      'typescriptreact': {
        'import': 'Импортирует модули или их части в текущий файл',
        'export': 'Экспортирует компонент или значение для использования в других модулях',
        'const': 'Объявляет константу только для чтения',
        'React': 'Библиотека для создания пользовательских интерфейсов',
        'useState': 'React Hook для добавления состояния в функциональный компонент',
        'useEffect': 'React Hook для выполнения побочных эффектов в функциональном компоненте',
        'useRef': 'React Hook для сохранения изменяемой ссылки на DOM-элемент',
        'useCallback': 'React Hook для мемоизации функций',
        'useMemo': 'React Hook для мемоизации вычисляемых значений',
        'useContext': 'React Hook для доступа к контексту',
        'JSX': 'JavaScript XML - расширение синтаксиса для JavaScript',
        'component': 'Компонент React - изолированная часть UI с собственной логикой',
        'props': 'Свойства, передаваемые в React-компонент',
        'state': 'Внутреннее состояние компонента'
      },
      'html': {
        'div': 'Определяет раздел в HTML-документе',
        'span': 'Определяет встроенный контейнер для текста',
        'img': 'Встраивает изображение',
        'a': 'Определяет гиперссылку',
        'p': 'Определяет параграф',
        'h1': 'Заголовок первого уровня',
        'ul': 'Неупорядоченный список',
        'li': 'Элемент списка',
        'input': 'Поле ввода формы',
        'button': 'Кнопка, на которую можно нажать',
      },
      'css': {
        'display': 'Определяет тип отображения элемента',
        'flex': 'Создаёт flex-контейнер',
        'grid': 'Создаёт grid-контейнер',
        'color': 'Задаёт цвет текста',
        'background': 'Задаёт фон элемента',
        'margin': 'Задаёт внешние отступы элемента',
        'padding': 'Задаёт внутренние отступы элемента',
        'border': 'Задаёт границу элемента',
        'position': 'Задаёт способ позиционирования элемента',
        'font': 'Задаёт свойства шрифта',
      }
    };
    
    // Проверяем, есть ли информация для этого языка
    const languageHints = commonHints[languageId];
    if (!languageHints) return null;
    
    // Проверяем, есть ли информация для этого слова
    const hint = languageHints[word];
    if (!hint) return null;
    
    // Возвращаем форматированную подсказку
    return {
      contents: [
        { value: `**${word}**\n\n${hint}` }
      ]
    };
  }
  
  /**
   * Очистка ресурсов
   */
  public dispose(): void {
    try {
      // Удаляем все зарегистрированные провайдеры
      this.providers.forEach(provider => {
        if (provider && typeof provider.dispose === 'function') {
          provider.dispose();
        }
      });
      
      this.providers.clear();
      this.monaco = null;
      
      console.log('LSP HoverProvider освобождён');
    } catch (error) {
      console.error('Ошибка при освобождении LSP HoverProvider:', error);
    }
  }
}

// Экспортируем создание экземпляра
export const createHoverProvider = (monaco: any) => new MonacoLSPHoverProvider(monaco); 