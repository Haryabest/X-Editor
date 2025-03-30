/**
 * Monaco LSP Diagnostics
 * 
 * Управление диагностическими сообщениями от языковых серверов
 * и их отображение в Monaco Editor
 */

// @ts-nocheck
import * as monaco from 'monaco-editor';
import { Diagnostic } from 'vscode-languageserver-protocol';

// Интерфейс для хранения диагностики по URI
interface DiagnosticCollection {
  [uri: string]: monaco.editor.IMarkerData[];
}

/**
 * Менеджер диагностики для LSP
 */
export class MonacoLSPDiagnostics {
  private monaco: any = null;
  private diagnostics: DiagnosticCollection = {};
  private owners: Map<string, string> = new Map(); // URI -> Owner (serverId)
  
  /**
   * Инициализация менеджера диагностики
   */
  public initialize(monaco: any): void {
    if (!monaco) {
      console.warn('Не удалось инициализировать LSP Diagnostics: monaco не определен');
      return;
    }
    
    this.monaco = monaco;
    this.diagnostics = {};
    console.log('LSP Diagnostics Manager инициализирован');
  }
  
  /**
   * Публикация диагностических сообщений от языкового сервера
   */
  public publishDiagnostics(
    serverId: string, 
    uri: string, 
    diagnostics: Diagnostic[]
  ): void {
    if (!this.monaco) {
      console.warn('Monaco не инициализирован в менеджере диагностики');
      return;
    }
    
    try {
      if (!uri || !diagnostics || !Array.isArray(diagnostics)) {
        console.warn('Некорректные параметры для publishDiagnostics');
        return;
      }
      
      // Сохраняем владельца диагностики для этого URI
      this.owners.set(uri, serverId);
      
      // Преобразуем диагностику в формат Monaco
      const markers = this.convertDiagnosticsToMarkers(diagnostics);
      
      // Сохраняем диагностику
      this.diagnostics[uri] = markers;
      
      // Обновляем маркеры в редакторе
      this.updateMarkersForUri(uri);
      
      console.log(`Получено ${diagnostics.length} диагностических сообщений для ${uri} от сервера ${serverId}`);
    } catch (error) {
      console.error('Ошибка при публикации диагностики:', error);
    }
  }
  
  /**
   * Очистка диагностики для указанного URI
   */
  public clearDiagnostics(uri: string): void {
    if (!this.monaco || !uri) return;
    
    try {
      // Удаляем диагностику
      delete this.diagnostics[uri];
      this.owners.delete(uri);
      
      // Очищаем маркеры в редакторе
      this.updateMarkersForUri(uri);
      
      console.log(`Диагностика очищена для ${uri}`);
    } catch (error) {
      console.error('Ошибка при очистке диагностики:', error);
    }
  }
  
  /**
   * Очистка всей диагностики от указанного сервера
   */
  public clearAllDiagnosticsFromServer(serverId: string): void {
    if (!this.monaco || !serverId) return;
    
    try {
      // Находим все URI, принадлежащие этому серверу
      const urisToRemove: string[] = [];
      
      this.owners.forEach((owner, uri) => {
        if (owner === serverId) {
          urisToRemove.push(uri);
        }
      });
      
      // Очищаем диагностику для каждого URI
      urisToRemove.forEach(uri => {
        this.clearDiagnostics(uri);
      });
      
      console.log(`Вся диагностика от сервера ${serverId} очищена`);
    } catch (error) {
      console.error('Ошибка при очистке диагностики сервера:', error);
    }
  }
  
  /**
   * Очистка всей диагностики
   */
  public clearAllDiagnostics(): void {
    if (!this.monaco) return;
    
    try {
      // Получаем все URI
      const uris = Object.keys(this.diagnostics);
      
      // Очищаем диагностику для каждого URI
      uris.forEach(uri => {
        this.clearDiagnostics(uri);
      });
      
      // Очищаем коллекции
      this.diagnostics = {};
      this.owners.clear();
      
      console.log('Вся диагностика очищена');
    } catch (error) {
      console.error('Ошибка при очистке всей диагностики:', error);
    }
  }
  
  /**
   * Обновление маркеров для указанного URI
   */
  private updateMarkersForUri(uri: string): void {
    if (!this.monaco || !uri) return;
    
    try {
      // Получаем маркеры
      const markers = this.diagnostics[uri] || [];
      
      // Находим модель по URI
      const model = this.findModelByUri(uri);
      
      // Устанавливаем маркеры
      if (model) {
        this.monaco.editor.setModelMarkers(model, 'lsp', markers);
      }
    } catch (error) {
      console.error('Ошибка при обновлении маркеров:', error);
    }
  }
  
  /**
   * Поиск модели Monaco по URI
   */
  private findModelByUri(uri: string): any {
    if (!this.monaco || !uri) return null;
    
    try {
      // Прямое совпадение
      const models = this.monaco.editor.getModels();
      if (!models || !Array.isArray(models)) return null;
      
      for (const model of models) {
        if (!model || !model.uri) continue;
        
        if (model.uri.toString() === uri) {
          return model;
        }
      }
      
      // Если прямое совпадение не найдено, пробуем проверить без схемы
      const normalizedUri = this.normalizeUri(uri);
      
      for (const model of models) {
        if (!model || !model.uri) continue;
        
        const modelUri = this.normalizeUri(model.uri.toString());
        if (modelUri === normalizedUri) {
          return model;
        }
      }
      
      // Также проверим специальные случаи для React (.jsx/.tsx файлы)
      if (uri.endsWith('.tsx') || uri.endsWith('.jsx')) {
        for (const model of models) {
          if (!model || !model.uri) continue;
          
          const modelUriStr = model.uri.toString();
          // Сравниваем только имена файлов для .tsx/.jsx
          const uriFileName = uri.split('/').pop();
          const modelFileName = modelUriStr.split('/').pop();
          
          if (uriFileName === modelFileName) {
            return model;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при поиске модели по URI:', error);
      return null;
    }
  }
  
  /**
   * Нормализация URI для сравнения
   */
  private normalizeUri(uri: string): string {
    if (!uri) return '';
    
    try {
      // Удаляем схему и начальные слэши
      return uri.replace(/^[a-zA-Z]+:\/\//, '').replace(/^\/+/, '');
    } catch (error) {
      console.error('Ошибка при нормализации URI:', error);
      return uri;
    }
  }
  
  /**
   * Конвертация диагностики из формата LSP в формат Monaco
   */
  private convertDiagnosticsToMarkers(diagnostics: Diagnostic[]): monaco.editor.IMarkerData[] {
    if (!diagnostics || !Array.isArray(diagnostics)) return [];
    
    try {
      return diagnostics.map(diagnostic => {
        if (!diagnostic || !diagnostic.range) {
          return {
            severity: this.monaco.MarkerSeverity.Info,
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 2,
            message: diagnostic?.message || 'Неизвестная ошибка',
            source: 'LSP'
          };
        }
        
        return {
          severity: this.convertSeverity(diagnostic.severity),
          startLineNumber: (diagnostic.range.start.line + 1) || 1,
          startColumn: (diagnostic.range.start.character + 1) || 1,
          endLineNumber: (diagnostic.range.end.line + 1) || 1,
          endColumn: (diagnostic.range.end.character + 1) || 1,
          message: diagnostic.message || 'Неизвестная ошибка',
          code: diagnostic.code ? diagnostic.code.toString() : undefined,
          source: diagnostic.source || 'LSP'
        };
      });
    } catch (error) {
      console.error('Ошибка при конвертации диагностики в маркеры:', error);
      return [];
    }
  }
  
  /**
   * Конвертация уровня серьезности из формата LSP в формат Monaco
   */
  private convertSeverity(severity?: number): any {
    if (!this.monaco) return 1; // Info по умолчанию
    
    try {
      if (!severity) return this.monaco.MarkerSeverity.Info;
      
      switch (severity) {
        case 1: return this.monaco.MarkerSeverity.Error;
        case 2: return this.monaco.MarkerSeverity.Warning;
        case 3: return this.monaco.MarkerSeverity.Info;
        case 4: return this.monaco.MarkerSeverity.Hint;
        default: return this.monaco.MarkerSeverity.Info;
      }
    } catch (error) {
      console.error('Ошибка при конвертации уровня серьезности:', error);
      return 1; // Info по умолчанию
    }
  }
  
  /**
   * Получение диагностики для указанного URI
   */
  public getDiagnosticsForUri(uri: string): any[] {
    if (!uri) return [];
    
    return this.diagnostics[uri] || [];
  }
  
  /**
   * Получение всей диагностики
   */
  public getAllDiagnostics(): DiagnosticCollection {
    return { ...this.diagnostics };
  }
  
  /**
   * Получение владельца диагностики для указанного URI
   */
  public getDiagnosticsOwner(uri: string): string | undefined {
    if (!uri) return undefined;
    
    return this.owners.get(uri);
  }
  
  /**
   * Очистка ресурсов
   */
  public dispose(): void {
    try {
      this.clearAllDiagnostics();
      this.diagnostics = {};
      this.owners.clear();
      this.monaco = null;
      
      console.log('LSP Diagnostics Manager освобожден');
    } catch (error) {
      console.error('Ошибка при освобождении ресурсов:', error);
    }
  }
}

// Экспортируем singleton экземпляр менеджера диагностики
export const monacoLSPDiagnostics = new MonacoLSPDiagnostics(); 