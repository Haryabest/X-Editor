// Определяем интерфейсы для Monaco Editor, чтобы не зависеть от модуля
interface IMonacoMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: number;
  code?: string | {
    value: string;
    target: string;
  };
}

interface IMonacoModel {
  uri: { toString: () => string };
  dispose: () => void;
  isDisposed: () => boolean;
}

interface IMonacoUri {
  toString: () => string;
}

interface IMonacoInstance {
  editor: {
    createModel: (content: string, language?: string, uri?: IMonacoUri) => IMonacoModel;
    getModelMarkers: (filter: { resource?: IMonacoUri }) => IMonacoMarker[];
  };
  Uri: {
    file: (path: string) => IMonacoUri;
  };
  MarkerSeverity: {
    Error: number;
    Warning: number;
    Info: number;
    Hint: number;
  };
}

// Импортируем API для Tauri
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, readDir, FsDirOptions } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';

// Типы и интерфейсы для внутреннего использования
interface RawIssueInfo {
  filePath: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  endLine?: number; 
  endColumn?: number;
}

// Интерфейсы для внешнего использования (совместимые с Terminal)
export interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source?: string;
  code?: string;
}

export interface IssueInfo {
  filePath: string;
  fileName: string;
  issues: Issue[];
}

export interface ScanResult {
  allIssues: IssueInfo[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

// Список поддерживаемых расширений файлов для сканирования
const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.less',
  '.html', '.htm', '.json', '.md', '.yaml', '.yml', '.toml',
  '.rs', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rb'
];

/**
 * Сервис для сканирования файлов и директорий на наличие ошибок и предупреждений
 */
class FileScannerService {
  private monacoInstance: IMonacoInstance | null = null;
  private disposed = false;
  private temporaryModels: IMonacoModel[] = [];

  /**
   * Инициализирует сервис с экземпляром Monaco Editor
   */
  initialize(monacoInstance: any): void {
    this.monacoInstance = monacoInstance as IMonacoInstance;
    this.disposed = false;
  }

  /**
   * Освобождает ресурсы сервиса
   */
  dispose(): void {
    this.disposed = true;
    
    // Очистка временных моделей
    this.temporaryModels.forEach(model => {
      if (model && !model.isDisposed()) {
        model.dispose();
      }
    });
    this.temporaryModels = [];
    
    this.monacoInstance = null;
  }

  /**
   * Сканирует один файл на наличие ошибок и предупреждений
   */
  async scanFile(filePath: string): Promise<RawIssueInfo[]> {
    if (!this.monacoInstance || this.disposed) {
      throw new Error('FileScannerService not initialized or disposed');
    }

    try {
      // Читаем содержимое файла
      const fileContent = await readTextFile(filePath);
      
      // Определяем язык на основе расширения файла
      const extension = filePath.substring(filePath.lastIndexOf('.'));
      const language = this.getLanguageFromExtension(extension);
      
      if (!language) {
        return []; // Неподдерживаемый язык
      }
      
      // Создаем временную модель для файла
      const uri = this.monacoInstance.Uri.file(filePath);
      const model = this.monacoInstance.editor.createModel(fileContent, language, uri);
      this.temporaryModels.push(model);
      
      // Получаем маркеры (ошибки/предупреждения) для этой модели
      const markers = this.monacoInstance.editor.getModelMarkers({ resource: uri });
      
      // Если модель не нужна для дальнейшей работы, сразу освобождаем
      model.dispose();
      this.temporaryModels = this.temporaryModels.filter(m => m !== model);
      
      // Преобразуем маркеры в структуру IssueInfo
      return markers.map((marker: IMonacoMarker) => ({
        filePath,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        message: marker.message,
        severity: this.getSeverityString(marker.severity),
        code: typeof marker.code === 'string' ? marker.code : 
              typeof marker.code === 'object' ? marker.code.value : undefined
      }));
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Сканирует всю директорию на наличие ошибок и предупреждений
   */
  async scanDirectory(directoryPath: string): Promise<ScanResult> {
    if (!this.monacoInstance || this.disposed) {
      throw new Error('FileScannerService not initialized or disposed');
    }

    try {
      // Получаем список всех файлов в директории и поддиректориях
      const allFiles = await this.getAllFilesInDirectory(directoryPath);
      
      // Фильтруем по поддерживаемым расширениям
      const filesToScan = allFiles.filter(file => 
        SUPPORTED_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext))
      );
      
      console.log(`Found ${filesToScan.length} files to scan in ${directoryPath}`);
      
      const result: ScanResult = {
        allIssues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };
      
      // Обрабатываем файлы партиями для оптимизации производительности
      const BATCH_SIZE = 20;
      
      for (let i = 0; i < filesToScan.length; i += BATCH_SIZE) {
        const batch = filesToScan.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(file => this.scanFile(file));
        
        const batchResults = await Promise.all(batchPromises);
        
        // Группируем результаты по файлам
        const issuesByFile: { [key: string]: RawIssueInfo[] } = {};
        
        // Собираем результаты из всех файлов партии
        for (const fileIssues of batchResults) {
          for (const issue of fileIssues) {
            // Подсчитываем общее количество ошибок и предупреждений
            if (issue.severity === 'error') {
              result.errorCount++;
            } else if (issue.severity === 'warning') {
              result.warningCount++;
            } else if (issue.severity === 'info') {
              result.infoCount++;
            }
            
            // Группируем проблемы по файлам
            if (!issuesByFile[issue.filePath]) {
              issuesByFile[issue.filePath] = [];
            }
            issuesByFile[issue.filePath].push(issue);
          }
        }
        
        // Преобразуем в структуру, совместимую с Terminal
        for (const [filePath, issues] of Object.entries(issuesByFile)) {
          if (issues.length > 0) {
            const fileName = await this.getFileName(filePath);
            
            result.allIssues.push({
              filePath,
              fileName,
              issues: issues.map(issue => ({
                severity: issue.severity,
                message: issue.message,
                line: issue.line,
                column: issue.column,
                endLine: issue.endLine || issue.line,
                endColumn: issue.endColumn || issue.column + 1,
                code: issue.code,
                source: this.getFileExtension(filePath)
              }))
            });
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error scanning directory ${directoryPath}:`, error);
      return {
        allIssues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      };
    }
  }

  /**
   * Получает имя файла из полного пути
   */
  private async getFileName(filePath: string): Promise<string> {
    try {
      return await path.basename(filePath);
    } catch (error) {
      // Если не удалось получить через API, используем JS
      const parts = filePath.split(/[/\\]/);
      return parts[parts.length - 1] || filePath;
    }
  }

  /**
   * Получает расширение файла
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filePath.substring(lastDotIndex + 1);
  }

  /**
   * Получает список всех файлов в директории и поддиректориях
   */
  private async getAllFilesInDirectory(directoryPath: string): Promise<string[]> {
    try {
      // Вызываем Rust-функцию для получения списка файлов
      const files = await invoke<string[]>('get_all_files_in_directory', { 
        directory: directoryPath 
      });
      return files;
    } catch (error) {
      // Резервный метод, если Rust-функция не доступна
      console.warn("Failed to use Rust function, falling back to recursive approach:", error);
      return this.recursivelyGetFiles(directoryPath);
    }
  }

  /**
   * Резервный метод для рекурсивного получения списка файлов
   */
  private async recursivelyGetFiles(directoryPath: string): Promise<string[]> {
    const options: FsDirOptions = { recursive: true };
    const entries = await readDir(directoryPath, options);
    let files: string[] = [];
    
    const processEntries = (entries: any[]): void => {
      for (const entry of entries) {
        if (entry.children) {
          // Если это директория, обрабатываем ее содержимое
          processEntries(entry.children);
        } else {
          // Если это файл, добавляем его в список
          files.push(entry.path);
        }
      }
    };
    
    processEntries(entries);
    return files;
  }

  /**
   * Преобразует числовую важность маркера Monaco в строковое представление
   */
  private getSeverityString(severity: number): 'error' | 'warning' | 'info' {
    if (this.monacoInstance) {
      if (severity === this.monacoInstance.MarkerSeverity.Error) {
        return 'error';
      } else if (severity === this.monacoInstance.MarkerSeverity.Warning) {
        return 'warning';
      }
    }
    return 'info';
  }

  /**
   * Определяет язык Monaco на основе расширения файла
   */
  private getLanguageFromExtension(extension: string): string | null {
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.md': 'markdown',
      '.py': 'python',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.go': 'go',
      '.rb': 'ruby',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.vue': 'html',
      '.scss': 'scss',
      '.less': 'less'
    };
    
    return extensionMap[extension] || null;
  }
}

// Экспортируем singleton-экземпляр сервиса
export const fileScannerService = new FileScannerService(); 