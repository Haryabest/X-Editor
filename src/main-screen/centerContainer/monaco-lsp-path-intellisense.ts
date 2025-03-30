/**
 * Monaco LSP Path Intellisense
 * 
 * Обеспечивает подсказки при работе с путями в импортах и включениях файлов
 * Интегрируется с Language Server Protocol
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { languageServerManager } from './monaco-lsp-server-manager';

/**
 * Класс для реализации интеллектуальных подсказок путей
 */
export class MonacoLSPPathIntellisense {
  private monaco: any;
  private providers: Map<string, any> = new Map();
  
  /**
   * Конструктор
   */
  constructor(monaco: any) {
    if (!monaco) {
      console.warn('Monaco не определен в PathIntellisense');
      return;
    }
    this.monaco = monaco;
  }
  
  /**
   * Регистрация провайдера для языка
   */
  public registerPathCompletionProvider(languageId: string): any {
    if (!this.monaco || !languageId) return null;
    
    try {
      // Проверяем, не зарегистрирован ли уже провайдер для этого языка
      if (this.providers.has(languageId)) {
        return this.providers.get(languageId);
      }
      
      // Условия срабатывания автодополнений путей
      const triggerCharacters = ["'", '"', "/", "./", "../"];
      
      // Создаем провайдер автодополнений
      const provider = this.monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters,
        provideCompletionItems: this.providePathCompletionItems.bind(this)
      });
      
      // Сохраняем ссылку на провайдер
      this.providers.set(languageId, provider);
      
      console.log(`Зарегистрирован LSP PathIntellisense для языка: ${languageId}`);
      return provider;
    } catch (error) {
      console.error(`Ошибка при регистрации PathIntellisense для языка ${languageId}:`, error);
      return null;
    }
  }
  
  /**
   * Обнаружение типа импорта и пути
   */
  private detectImportContext(model: any, position: any): { isImport: boolean, path: string } | null {
    try {
      if (!model || !position) return null;
      
      // Получаем текущую строку
      const lineContent = model.getLineContent(position.lineNumber);
      if (!lineContent) return null;
      
      // Проверяем, находимся ли мы в импорте
      const importMatch = lineContent.match(/import\s+.*?from\s+['"](.*?)['"]|import\s+['"](.*?)['"]|require\s*\(\s*['"](.*?)['"]/);
      const includeMatch = lineContent.match(/<include\s+.*?src=['"](.*?)['"]|<script\s+.*?src=['"](.*?)['"]|<link\s+.*?href=['"](.*?)['"]/);
      
      if (importMatch || includeMatch) {
        const match = importMatch || includeMatch;
        const pathPart = match[1] || match[2] || match[3] || '';
        
        // Проверяем, находится ли курсор внутри пути
        const startIndex = lineContent.indexOf(pathPart);
        const endIndex = startIndex + pathPart.length;
        
        if (position.column > startIndex && position.column <= endIndex + 1) {
          return {
            isImport: true,
            path: pathPart
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при определении контекста импорта:', error);
      return null;
    }
  }
  
  /**
   * Предоставление элементов автодополнения для путей
   */
  private async providePathCompletionItems(model: any, position: any, context: any, token: any): Promise<any> {
    if (!model || !position) return null;
    
    try {
      const uri = model.uri.toString();
      const languageId = model.getLanguageId();
      
      // Проверяем, находимся ли мы в контексте импорта
      const importContext = this.detectImportContext(model, position);
      if (!importContext) {
        return this.provideFallbackPathCompletions(model, position);
      }
      
      // Получаем список серверов, которые могут обрабатывать этот язык
      const servers = this.getLanguageServersForLanguage(languageId);
      if (!servers || servers.length === 0) {
        return this.provideFallbackPathCompletions(model, position);
      }
      
      // Используем первый доступный сервер
      const serverId = servers[0];
      
      // Преобразуем позицию Monaco в формат LSP
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1
      };
      
      // Отправляем запрос на сервер
      const response = await languageServerManager.sendRequest(serverId, 'textDocument/completion', {
        textDocument: { uri },
        position: lspPosition,
        context: {
          triggerKind: 1, // Triggered by user
          triggerCharacter: context?.triggerCharacter
        }
      });
      
      // Если нет данных или отмена запроса, возвращаем fallback
      if (!response || token.isCancellationRequested) {
        return this.provideFallbackPathCompletions(model, position);
      }
      
      // Фильтруем ответ, чтобы получить только элементы, относящиеся к путям
      const pathItems = this.filterPathCompletionItems(response, importContext.path);
      
      // Если нет подходящих элементов, возвращаем fallback
      if (!pathItems || pathItems.length === 0) {
        return this.provideFallbackPathCompletions(model, position);
      }
      
      // Преобразуем в формат Monaco
      return {
        suggestions: this.convertCompletionItems(pathItems, position)
      };
    } catch (error) {
      console.error('Ошибка при получении подсказок путей:', error);
      return this.provideFallbackPathCompletions(model, position);
    }
  }
  
  /**
   * Фильтрация элементов автодополнения для получения только путей
   */
  private filterPathCompletionItems(response: any, currentPath: string): any[] {
    if (!response) return [];
    
    try {
      const items = response.items || response;
      if (!items || !Array.isArray(items)) return [];
      
      // Фильтруем только элементы, относящиеся к путям
      return items.filter(item => {
        // Проверяем тип элемента (файл или директория)
        const isPathLike = 
          item.kind === 17 || // File
          item.kind === 18 || // Folder
          item.kind === 19;   // Unit
          
        // Проверяем, соответствует ли элемент текущему пути
        const matchesCurrentPath = currentPath ? 
          (item.filterText && item.filterText.includes(currentPath)) || 
          (item.label && item.label.includes(currentPath)) : 
          true;
          
        return isPathLike && matchesCurrentPath;
      });
    } catch (error) {
      console.error('Ошибка при фильтрации элементов автодополнения:', error);
      return [];
    }
  }
  
  /**
   * Конвертация элементов LSP в формат Monaco
   */
  private convertCompletionItems(items: any[], position: any): any[] {
    if (!items || !Array.isArray(items)) return [];
    
    try {
      return items.map(item => {
        // Определяем тип элемента (для правильного отображения иконки)
        let kind = this.monaco.languages.CompletionItemKind.File;
        if (item.kind === 18) { // Folder
          kind = this.monaco.languages.CompletionItemKind.Folder;
        }
        
        // Формируем подсказку в формате Monaco
        return {
          label: item.label,
          kind: kind,
          detail: item.detail || null,
          documentation: item.documentation ? 
            (typeof item.documentation === 'string' ? item.documentation : item.documentation.value) : 
            null,
          insertText: item.insertText || item.label,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column - (item.filterText ? item.filterText.length : 0),
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          sortText: item.sortText || item.label,
          filterText: item.filterText || item.label,
          command: item.command,
          commitCharacters: ['/']
        };
      });
    } catch (error) {
      console.error('Ошибка при конвертации элементов автодополнения:', error);
      return [];
    }
  }
  
  /**
   * Предоставление запасных элементов автодополнения, если LSP не сработал
   */
  private provideFallbackPathCompletions(model: any, position: any): any {
    try {
      // Получаем текущую строку
      const lineContent = model.getLineContent(position.lineNumber);
      if (!lineContent) return null;
      
      // Определяем контекст импорта
      const importMatch = lineContent.match(/import\s+.*?from\s+['"](.*?)['"]|import\s+['"](.*?)['"]|require\s*\(\s*['"](.*?)['"]/);
      if (!importMatch) return null;
      
      // Предоставляем базовые пути в качестве подсказок
      const baseSuggestions = [
        {
          label: './components/',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Папка компонентов',
          insertText: './components/',
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        },
        {
          label: './utils/',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Папка утилит',
          insertText: './utils/',
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        },
        {
          label: '../',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Родительская директория',
          insertText: '../',
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        }
      ];
      
      return {
        suggestions: baseSuggestions
      };
    } catch (error) {
      console.error('Ошибка при предоставлении запасных автодополнений:', error);
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
      
      console.log('LSP PathIntellisense освобождён');
    } catch (error) {
      console.error('Ошибка при освобождении LSP PathIntellisense:', error);
    }
  }
}

// Экспортируем создание экземпляра
export const createPathIntellisense = (monaco: any) => new MonacoLSPPathIntellisense(monaco); 