/**
 * Monaco LSP Jump to Definition Provider
 * 
 * Обеспечивает переход к определению при клике на элемент кода
 * Интегрируется с Language Server Protocol
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { languageServerManager } from './monaco-lsp-server-manager';

/**
 * Класс для реализации перехода к определению через LSP
 */
export class MonacoLSPDefinitionProvider {
  private monaco: any;
  private providers: Map<string, any> = new Map();
  
  /**
   * Конструктор
   */
  constructor(monaco: any) {
    if (!monaco) {
      console.warn('Monaco не определен в DefinitionProvider');
      return;
    }
    this.monaco = monaco;
  }
  
  /**
   * Регистрация провайдера для языка
   */
  public registerDefinitionProvider(languageId: string): any {
    if (!this.monaco || !languageId) return null;
    
    try {
      // Проверяем, не зарегистрирован ли уже провайдер для этого языка
      if (this.providers.has(languageId)) {
        return this.providers.get(languageId);
      }
      
      // Создаем провайдер определений
      const provider = this.monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: this.provideDefinition.bind(this)
      });
      
      // Сохраняем ссылку на провайдер
      this.providers.set(languageId, provider);
      
      console.log(`Зарегистрирован LSP DefinitionProvider для языка: ${languageId}`);
      return provider;
    } catch (error) {
      console.error(`Ошибка при регистрации DefinitionProvider для языка ${languageId}:`, error);
      return null;
    }
  }
  
  /**
   * Предоставление определения
   */
  private async provideDefinition(model: any, position: any, token: any): Promise<any> {
    if (!model || !position) return null;
    
    try {
      const uri = model.uri.toString();
      const languageId = model.getLanguageId();
      
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
      
      // Отправляем запрос на сервер
      const response = await languageServerManager.sendRequest(serverId, 'textDocument/definition', {
        textDocument: { uri },
        position: lspPosition
      });
      
      // Если нет данных или отмена запроса, возвращаем null
      if (!response || token.isCancellationRequested) return null;
      
      // Обрабатываем ответ от LSP в формат Monaco
      return this.convertDefinitionResponse(response);
    } catch (error) {
      console.error('Ошибка при получении определения:', error);
      return null;
    }
  }
  
  /**
   * Конвертация ответа LSP в формат Monaco
   */
  private convertDefinitionResponse(response: any): any {
    if (!response) return null;
    
    try {
      // Проверяем тип ответа (одиночный или массив)
      const locations = Array.isArray(response) ? response : [response];
      
      return locations.map(location => {
        // Формируем URI в формате Monaco
        let uri = location.uri;
        
        // Если URI начинается с 'file://', модифицируем его для Monaco
        if (uri.startsWith('file://')) {
          uri = this.monaco.Uri.parse(uri);
        }
        
        // Создаем диапазон для определения
        const range = {
          startLineNumber: location.range.start.line + 1,
          startColumn: location.range.start.character + 1,
          endLineNumber: location.range.end.line + 1,
          endColumn: location.range.end.character + 1
        };
        
        // Возвращаем определение в формате Monaco
        return {
          uri,
          range
        };
      });
    } catch (error) {
      console.error('Ошибка при конвертации ответа определения:', error);
      return null;
    }
  }
  
  /**
   * Регистрация провайдера для перехода к типу
   */
  public registerTypeDefinitionProvider(languageId: string): any {
    if (!this.monaco || !languageId) return null;
    
    try {
      // Создаем провайдер определений типов
      const provider = this.monaco.languages.registerTypeDefinitionProvider(languageId, {
        provideTypeDefinition: this.provideTypeDefinition.bind(this)
      });
      
      // Сохраняем ссылку на провайдер
      this.providers.set(`${languageId}_type`, provider);
      
      console.log(`Зарегистрирован LSP TypeDefinitionProvider для языка: ${languageId}`);
      return provider;
    } catch (error) {
      console.error(`Ошибка при регистрации TypeDefinitionProvider для языка ${languageId}:`, error);
      return null;
    }
  }
  
  /**
   * Предоставление определения типа
   */
  private async provideTypeDefinition(model: any, position: any, token: any): Promise<any> {
    if (!model || !position) return null;
    
    try {
      const uri = model.uri.toString();
      const languageId = model.getLanguageId();
      
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
      
      // Отправляем запрос на сервер
      const response = await languageServerManager.sendRequest(serverId, 'textDocument/typeDefinition', {
        textDocument: { uri },
        position: lspPosition
      });
      
      // Если нет данных или отмена запроса, возвращаем null
      if (!response || token.isCancellationRequested) return null;
      
      // Обрабатываем ответ от LSP в формат Monaco
      return this.convertDefinitionResponse(response);
    } catch (error) {
      console.error('Ошибка при получении определения типа:', error);
      return null;
    }
  }
  
  /**
   * Обрботка клика по ссылке в тексте
   */
  public setupLinkOpener(editor: any): void {
    if (!editor || !this.monaco) return;
    
    try {
      // Добавляем обработчик для открытия ссылок
      editor.onMouseDown(async (e: any) => {
        if (e.target.type !== this.monaco.editor.MouseTargetType.CONTENT_TEXT) {
          return;
        }
        
        // Проверяем, был ли нажат Ctrl (или Cmd на Mac)
        if (!e.event.ctrlKey && !e.event.metaKey) {
          return;
        }
        
        const model = editor.getModel();
        if (!model) return;
        
        // Получаем слово под курсором
        const word = model.getWordAtPosition(e.target.position);
        if (!word) return;
        
        // Получаем определение для слова
        const definitions = await this.provideDefinition(
          model,
          e.target.position,
          { isCancellationRequested: false }
        );
        
        if (definitions && definitions.length > 0) {
          // Открываем первое определение
          const definition = definitions[0];
          if (definition.uri && definition.range) {
            // Перебрасываем редактор на определение
            this.openDefinition(editor, definition);
          }
        }
      });
      
      console.log('LSP LinkOpener настроен для редактора');
    } catch (error) {
      console.error('Ошибка при настройке LinkOpener:', error);
    }
  }
  
  /**
   * Открытие определения
   */
  private openDefinition(editor: any, definition: any): void {
    try {
      // Проверяем, открыт ли файл определения
      const currentModel = editor.getModel();
      const isSameFile = currentModel && 
        currentModel.uri.toString() === definition.uri.toString();
      
      if (isSameFile) {
        // Если определение в том же файле, просто перемещаем курсор
        editor.revealPositionInCenter({
          lineNumber: definition.range.startLineNumber,
          column: definition.range.startColumn
        });
        
        editor.setPosition({
          lineNumber: definition.range.startLineNumber,
          column: definition.range.startColumn
        });
      } else {
        // Если определение в другом файле, нужно его открыть
        // Для этого можно использовать внешний обработчик
        if (window.openFileAtPosition) {
          window.openFileAtPosition(definition.uri.toString(), {
            lineNumber: definition.range.startLineNumber,
            column: definition.range.startColumn
          });
        } else {
          console.warn('Функция openFileAtPosition не определена');
          
          // Попытка открыть файл напрямую через Monaco
          this.monaco.editor.openEditor({
            resource: definition.uri,
            options: {
              selection: {
                startLineNumber: definition.range.startLineNumber,
                startColumn: definition.range.startColumn,
                endLineNumber: definition.range.endLineNumber,
                endColumn: definition.range.endColumn
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Ошибка при открытии определения:', error);
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
      
      console.log('LSP DefinitionProvider освобождён');
    } catch (error) {
      console.error('Ошибка при освобождении LSP DefinitionProvider:', error);
    }
  }
}

// Экспортируем создание экземпляра
export const createDefinitionProvider = (monaco: any) => new MonacoLSPDefinitionProvider(monaco); 