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
 * Провайдер подсказок при наведении для Monaco Editor через LSP
 */
export class MonacoLSPHoverProvider {
  private monaco: any;
  private monacoLSPWrapper: any;
  private disposables: any[] = [];
  
  constructor(monaco: any, monacoLSPWrapper: any) {
    this.monaco = monaco;
    this.monacoLSPWrapper = monacoLSPWrapper;
  }
  
  /**
   * Регистрация провайдера подсказок при наведении для языка
   */
  public registerHoverProvider(languageId: string): void {
    try {
      if (!this.monaco || !languageId) return;
      
      // АВАРИЙНЫЙ РЕЖИМ - упрощенная версия
      const disposable = this.monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (model: any, position: any) => {
          try {
            // Проверяем наличие модели и позиции
            if (!model || !position) return null;
            
            // Ограничиваем выполнение по времени
            return await Promise.race([
              this.getSimpleHoverContent(model, position, languageId),
              new Promise(resolve => setTimeout(() => resolve(null), 150)) // Короткий таймаут
            ]);
          } catch (error) {
            // В случае ошибки возвращаем null
            return null;
          }
        }
      });
      
      this.disposables.push(disposable);
    } catch (error) {
      // Игнорируем ошибки
    }
  }
  
  /**
   * Получение упрощенного содержимого подсказки
   */
  private async getSimpleHoverContent(model: any, position: any, languageId: string): Promise<any> {
    try {
      // Получаем слово под курсором - самая базовая операция
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo || !wordInfo.word) return null;
      
      // Создаем базовую подсказку
      return {
        contents: [
          { value: `**${wordInfo.word}**\n\nПозиция: строка ${position.lineNumber}, столбец ${position.column}` }
        ],
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn
        }
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Очистка ресурсов
   */
  public dispose(): void {
    this.disposables.forEach(disposable => {
      try { 
        disposable.dispose(); 
      } catch (e) {}
    });
    this.disposables = [];
  }
}

// Экспортируем создание экземпляра
export const createHoverProvider = (monaco: any, monacoLSPWrapper: any) => new MonacoLSPHoverProvider(monaco, monacoLSPWrapper); 