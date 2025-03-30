/**
 * Monaco LSP Completion
 * 
 * Реализация автодополнения кода через LSP в Monaco Editor
 */

// @ts-nocheck - Disable TypeScript checking due to Monaco types issues
import * as monaco from 'monaco-editor';
import { CompletionItem, CompletionList, TextEdit } from 'vscode-languageserver-protocol';
import { languageServerManager } from './monaco-lsp-server-manager';

/**
 * Провайдер автодополнения LSP для Monaco
 */
export class MonacoLSPCompletionProvider implements monaco.languages.CompletionItemProvider {
  private monacoInstance: any;
  private activeServers: string[] = [];
  
  // Символы, которые вызывают автодополнение
  public readonly triggerCharacters = ['.', ':', '<', '"', '=', '/', '@', '(', ','];
  
  constructor(monacoInstance: any) {
    this.monacoInstance = monacoInstance;
  }
  
  /**
   * Установка активных серверов
   */
  public setActiveServers(servers: string[]): void {
    this.activeServers = [...servers];
  }
  
  /**
   * Получение автодополнений
   */
  async provideCompletionItems(
    model: any,
    position: any,
    context: any,
    token: any
  ): Promise<any> {
    // Проверяем, есть ли активные серверы
    if (this.activeServers.length === 0) {
      return { suggestions: [] };
    }
    
    // Получаем URI документа
    const uri = model.uri.toString();
    
    try {
      // Собираем результаты автодополнения от всех активных серверов
      let allCompletions: any[] = [];
      
      for (const serverId of this.activeServers) {
        // Отправляем запрос на автодополнение
        const completions = await this.requestCompletionsFromServer(
          serverId,
          uri,
          position,
          context
        );
        
        // Добавляем результаты, если они есть
        if (completions && completions.length > 0) {
          allCompletions = [...allCompletions, ...completions];
        }
      }
      
      // Удаляем дубликаты по label
      const uniqueCompletions = this.removeDuplicates(allCompletions);
      
      return {
        suggestions: uniqueCompletions,
        incomplete: uniqueCompletions.length > 0
      };
    } catch (error) {
      console.error('Ошибка при получении автодополнений:', error);
      return { suggestions: [] };
    }
  }
  
  /**
   * Запрос автодополнений от сервера
   */
  private async requestCompletionsFromServer(
    serverId: string,
    uri: string,
    position: any,
    context: any
  ): Promise<any[]> {
    try {
      // Отправляем запрос на автодополнение к серверу
      const result = await languageServerManager.sendRequest(serverId, 'textDocument/completion', {
        textDocument: { uri },
        position: {
          line: position.lineNumber - 1,
          character: position.column - 1
        },
        context: {
          triggerKind: this.convertTriggerKind(context.triggerKind),
          triggerCharacter: context.triggerCharacter
        }
      });
      
      // Если сервер не вернул результатов
      if (!result) {
        return [];
      }
      
      // Преобразуем результаты
      if (Array.isArray(result)) {
        return this.convertCompletionItems(result as CompletionItem[]);
      } else if (result.items) {
        return this.convertCompletionItems(result.items as CompletionItem[]);
      }
      
      return [];
    } catch (error) {
      console.error(`Ошибка при запросе автодополнений от сервера ${serverId}:`, error);
      return [];
    }
  }
  
  /**
   * Конвертация элементов автодополнения из LSP в Monaco
   */
  private convertCompletionItems(items: CompletionItem[]): any[] {
    return items.map(item => {
      // Создаем базовый элемент автодополнения
      const completionItem: any = {
        label: item.label,
        kind: this.convertCompletionItemKind(item.kind),
        insertText: item.insertText || item.label,
        sortText: item.sortText,
        filterText: item.filterText,
        documentation: this.convertDocumentation(item.documentation),
        detail: item.detail,
        tags: item.deprecated ? [1] : undefined // 1 означает CompletionItemTag.Deprecated
      };
      
      // Если есть модификации текста, используем их
      if (item.textEdit) {
        if ('range' in item.textEdit) {
          const range = item.textEdit.range;
          completionItem.range = {
            startLineNumber: range.start.line + 1,
            startColumn: range.start.character + 1,
            endLineNumber: range.end.line + 1,
            endColumn: range.end.character + 1
          };
          completionItem.insertText = item.textEdit.newText;
        } else if ('insert' in item.textEdit) {
          // Обработка InsertReplaceEdit
          const insertRange = item.textEdit.insert;
          completionItem.range = {
            startLineNumber: insertRange.start.line + 1,
            startColumn: insertRange.start.character + 1,
            endLineNumber: insertRange.end.line + 1,
            endColumn: insertRange.end.character + 1
          };
          completionItem.insertText = item.textEdit.newText;
        }
      }
      
      // Если есть modifiers для вставки/замены (для LSP 3.0+)
      if (item.insertTextMode === 2) { // Replace
        completionItem.insertTextRules = 1; // KeepWhitespace
      }
      
      // Если это сниппет
      if (item.insertTextFormat === 2) { // Snippet
        completionItem.insertTextRules = 4; // InsertAsSnippet
      }
      
      // Преобразуем команду если она есть
      if (item.command) {
        completionItem.command = {
          id: item.command.command,
          title: item.command.title,
          arguments: item.command.arguments
        };
      }
      
      // Добавляем дополнительные данные для разрешения
      if (item.additionalTextEdits) {
        completionItem.additionalTextEdits = item.additionalTextEdits.map(edit => ({
          range: {
            startLineNumber: edit.range.start.line + 1,
            startColumn: edit.range.start.character + 1,
            endLineNumber: edit.range.end.line + 1,
            endColumn: edit.range.end.character + 1
          },
          text: edit.newText
        }));
      }
      
      return completionItem;
    });
  }
  
  /**
   * Конвертация типа элемента автодополнения из LSP в Monaco
   */
  private convertCompletionItemKind(kind?: number): number {
    if (!kind) return 1; // Text
    
    // LSP CompletionItemKind и Monaco CompletionItemKind почти совпадают
    // но на всякий случай делаем преобразование
    const lspToMonacoKind: { [key: number]: number } = {
      1: 1,  // Text
      2: 2,  // Method
      3: 3,  // Function
      4: 4,  // Constructor
      5: 5,  // Field
      6: 6,  // Variable
      7: 7,  // Class
      8: 8,  // Interface
      9: 9,  // Module
      10: 10, // Property
      11: 11, // Unit
      12: 12, // Value
      13: 13, // Enum
      14: 14, // Keyword
      15: 15, // Snippet
      16: 16, // Color
      17: 17, // File
      18: 18, // Reference
      19: 19, // Folder
      20: 20, // EnumMember
      21: 21, // Constant
      22: 22, // Struct
      23: 23, // Event
      24: 24, // Operator
      25: 25  // TypeParameter
    };
    
    return lspToMonacoKind[kind] || 1; // Default to Text
  }
  
  /**
   * Конвертация типа триггера автодополнения из Monaco в LSP
   */
  private convertTriggerKind(triggerKind: number): number {
    switch (triggerKind) {
      case 0: // Invoke
        return 1;
      case 1: // TriggerCharacter
        return 2;
      case 2: // TriggerForIncompleteCompletions
        return 3;
      default:
        return 1; // Invoke
    }
  }
  
  /**
   * Конвертация документации из LSP в Monaco
   */
  private convertDocumentation(documentation?: string | { kind: string, value: string }): any {
    if (!documentation) return undefined;
    
    if (typeof documentation === 'string') {
      return documentation;
    } else if ('kind' in documentation && documentation.kind === 'markdown') {
      return { value: documentation.value };
    } else if ('value' in documentation) {
      return documentation.value;
    }
    
    return undefined;
  }
  
  /**
   * Удаление дубликатов из результатов автодополнения
   */
  private removeDuplicates(items: any[]): any[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.label + (item.kind || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Разрешение элемента автодополнения
   */
  public async resolveCompletionItem(
    item: any,
    token: any
  ): Promise<any> {
    // В простой реализации возвращаем элемент без изменений
    return item;
    
    // В более сложной реализации здесь должен быть код для
    // отправки запроса 'completionItem/resolve' к серверу
  }
}

/**
 * Регистрация провайдера автодополнения LSP в Monaco
 */
export function registerCompletionProvider(
  monaco: any,
  languages: string[] = ['*']
): any[] {
  const provider = new MonacoLSPCompletionProvider(monaco);
  
  // Регистрируем провайдер для каждого языка
  const disposables = languages.map(language => {
    return monaco.languages.registerCompletionItemProvider(language, provider);
  });
  
  // Экспортируем провайдер
  (window as any).monacoLSPCompletionProvider = provider;
  
  return disposables;
}

// Экспортируем функцию для установки активных серверов
export function setActiveServersForCompletion(servers: string[]): void {
  const provider = (window as any).monacoLSPCompletionProvider as MonacoLSPCompletionProvider;
  if (provider) {
    provider.setActiveServers(servers);
  }
} 