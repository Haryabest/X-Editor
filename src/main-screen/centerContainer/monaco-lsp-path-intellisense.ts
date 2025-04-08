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
      const triggerCharacters = ["'", '"', "/", "./", "../", "."];
      
      // Создаем провайдер автодополнений с высоким приоритетом
      const provider = this.monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters,
        provideCompletionItems: this.providePathCompletionItems.bind(this),
        // Устанавливаем высокий приоритет для провайдера путей
        // чтобы он имел преимущество перед другими провайдерами
        triggerCharactersWithSortingProvider: triggerCharacters
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
      
      // Получаем текст до текущей позиции курсора
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });
      
      // Специальный случай: если строка содержит import и последний символ - точка
      if (textUntilPosition.includes('import') && textUntilPosition.trim().endsWith('.')) {
        console.log('Обнаружен символ точки в контексте импорта.');
        return {
          isImport: true,
          path: '.'
        };
      }
      
      // Проверяем, находимся ли мы в импорте
      const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]*)/;
      const importMatch = textUntilPosition.match(importRegex);
      
      if (importMatch) {
        // Получаем текущий префикс пути
        const pathPrefix = importMatch[1] || '';
        
        console.log('Обнаружен контекст импорта с префиксом пути:', pathPrefix);
        
        return {
          isImport: true,
          path: pathPrefix
        };
      }
      
      // Проверяем include/script/link для HTML
      const includeRegex = /<(?:include|script|link)\s+.*?(?:src|href)=['"]([^'"]*)/;
      const includeMatch = textUntilPosition.match(includeRegex);
      
      if (includeMatch) {
        const pathPrefix = includeMatch[1] || '';
        
        console.log('Обнаружен контекст включения с префиксом пути:', pathPrefix);
        
        return {
          isImport: true,
          path: pathPrefix
        };
      }
      
      // Проверяем require
      const requireRegex = /require\s*\(\s*['"]([^'"]*)/;
      const requireMatch = textUntilPosition.match(requireRegex);
      
      if (requireMatch) {
        const pathPrefix = requireMatch[1] || '';
        
        console.log('Обнаружен контекст require с префиксом пути:', pathPrefix);
        
        return {
          isImport: true,
          path: pathPrefix
        };
      }
      
      // Проверка для одиночной точки или начала пути с точки вне явных паттернов импорта
      if (textUntilPosition.includes('import') || textUntilPosition.includes('require')) {
        const dotMatch = /['"](\.+)$/.exec(textUntilPosition);
        if (dotMatch) {
          console.log('Обнаружена точка в импорте:', dotMatch[1]);
          return {
            isImport: true,
            path: dotMatch[1]
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
      
      // Специальная обработка для символа "."
      if (context && context.triggerCharacter === '.') {
        // Получаем текст до текущей позиции курсора
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Проверяем, находимся ли мы в контексте импорта и последний символ - точка
        if (textUntilPosition.includes('import') && textUntilPosition.trim().endsWith('.')) {
          console.log('Специальная обработка для точки в импорте');
          
          // Возвращаем предложения с высоким приоритетом
          return {
            suggestions: [
              {
                label: './',
                kind: this.monaco.languages.CompletionItemKind.Folder,
                detail: 'Текущая директория',
                insertText: './',
                sortText: '0001', // Высокий приоритет
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
                sortText: '0002', // Высокий приоритет
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                }
              }
            ]
          };
        }
      }
      
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
      
      // Получаем текущий префикс импорта, если есть
      const importPath = importMatch[1] || importMatch[2] || importMatch[3] || '';
      
      // Предоставляем базовые пути в качестве подсказок
      let baseSuggestions = [];
      
      // Проверяем, находимся ли мы на уровне начала ввода или внутри пути
      const hasDirectoryPrefix = importPath.includes('/');
      const isSimpleDot = importPath === '.';
      const isSimpleDotDot = importPath === '..';
      
      // Если это простой случай с . или ..
      if (isSimpleDot || isSimpleDotDot) {
        // Для одной точки предлагаем ./ и ../
        if (isSimpleDot) {
          baseSuggestions.push({
            label: './',
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: 'Текущая директория',
            insertText: './',
            sortText: '0000', // Самый высокий приоритет
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
          
          baseSuggestions.push({
            label: '../',
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: 'Родительская директория',
            insertText: '../',
            sortText: '0001', // Высокий приоритет, но ниже ./
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
        } else {
          // Для .. предлагаем только ../
          baseSuggestions.push({
            label: '../',
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: 'Родительская директория',
            insertText: '../',
            sortText: '0000', // Самый высокий приоритет
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
        }
        
        return { suggestions: baseSuggestions };
      }
      
      // Улучшенный алгоритм обнаружения и обработки многоуровневых путей
      // Проверка паттернов вида: ./../, ../../, ./../../, ../../../
      const isMultilevelPath = this.isMultilevelPath(importPath);
      
      // Если у нас многоуровневый путь
      if (isMultilevelPath) {
        // Анализируем структуру многоуровневого пути
        const pathInfo = this.parseMultilevelPath(importPath);
        
        // Определяем, нужно ли предлагать очередной уровень вверх
        if (pathInfo.endsWithParentDir) {
          // Добавляем еще один уровень вверх
          const nextLevel = importPath + (importPath.endsWith('/') ? '../' : '/../');
          
          baseSuggestions.push({
            label: nextLevel,
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: `На ${pathInfo.parentLevels + 1} уровней вверх`,
            insertText: nextLevel,
            sortText: '0000', // Высокий приоритет
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - importPath.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
        }
        
        // Добавляем текущий путь с / на конце, если он еще не имеет / в конце
        if (!importPath.endsWith('/')) {
          baseSuggestions.push({
            label: importPath + '/',
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: 'Исследовать эту директорию',
            insertText: importPath + '/',
            sortText: '0001', // Высокий приоритет
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - importPath.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
        }
        
        // Если путь заканчивается косой чертой, предлагаем ".." как вариант навигации вверх
        // Этот подход работает внутри уже открытого пути
        if (importPath.endsWith('/')) {
          baseSuggestions.push({
            label: importPath + '..',
            kind: this.monaco.languages.CompletionItemKind.Folder,
            detail: 'Подняться на уровень выше',
            insertText: importPath + '..',
            sortText: '0002', // Высокий приоритет
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - importPath.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Показать подсказки',
              arguments: []
            }
          });
        }
        
        return { suggestions: baseSuggestions };
      }
      
      // Базовые подсказки для начала пути
      if (!hasDirectoryPrefix) {
        baseSuggestions.push({
          label: './',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Текущая директория',
          insertText: './',
          sortText: '0000', // Самый высокий приоритет
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          command: {
            id: 'editor.action.triggerSuggest',
            title: 'Показать подсказки',
            arguments: []
          }
        });
        
        baseSuggestions.push({
          label: '../',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Родительская директория',
          insertText: '../',
          sortText: '0001', // Высокий приоритет, но ниже ./
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          command: {
            id: 'editor.action.triggerSuggest',
            title: 'Показать подсказки',
            arguments: []
          }
        });
      }
      
      // Если префикс содержит точку, добавляем только подходящие предложения
      if (importPath) {
        if (importPath.startsWith('.')) {
          if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
            // Это просто точка, предлагаем ./ и ../
            baseSuggestions = baseSuggestions.filter(s => s.label === './' || s.label === '../');
          } else if (importPath.startsWith('./')) {
            // Для начала пути с ./ стимулируем немедленное открытие подсказок для содержимого
            baseSuggestions = [{
              label: './',
              kind: this.monaco.languages.CompletionItemKind.Folder,
              detail: 'Текущая директория',
              insertText: './',
              sortText: '0000',
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column - (importPath.length - 2), // Корректируем позицию
                endLineNumber: position.lineNumber,
                endColumn: position.column
              },
              command: {
                id: 'editor.action.triggerSuggest',
                title: 'Показать подсказки',
                arguments: []
              }
            }];
            
            // Добавляем возможность перейти на уровень выше
            baseSuggestions.push({
              label: './../',
              kind: this.monaco.languages.CompletionItemKind.Folder,
              detail: 'Родительская директория относительно текущей',
              insertText: './../',
              sortText: '0001',
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column - (importPath.length - 2),
                endLineNumber: position.lineNumber,
                endColumn: position.column
              },
              command: {
                id: 'editor.action.triggerSuggest',
                title: 'Показать подсказки',
                arguments: []
              }
            });
          } else if (importPath.startsWith('../')) {
            // Оставляем только ../ из предложений, если префикс уже начинается с ../
            baseSuggestions = baseSuggestions.filter(s => s.label === '../');
            
            // Добавляем многоуровневые подсказки для ../ и ./../ паттернов
            // Определяем, сколько уровней уже есть в пути
            const levels = (importPath.match(/\.\.\//g) || []).length;
            const remainingPath = importPath.replace(/^(\.\.\/)+/, '');
            
            // Добавляем ещё один уровень вверх, если мы уже на уровне ../
            if (levels >= 1 && !remainingPath) {
              let nextLevelPath = '';
              for (let i = 0; i < levels + 1; i++) {
                nextLevelPath += '../';
              }
              
              baseSuggestions.push({
                label: nextLevelPath,
                kind: this.monaco.languages.CompletionItemKind.Folder,
                detail: `На ${levels + 1} уровней вверх`,
                insertText: nextLevelPath,
                sortText: '0000',
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column - importPath.length,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                },
                command: {
                  id: 'editor.action.triggerSuggest',
                  title: 'Показать подсказки',
                  arguments: []
                }
              });
            }
          }
        }
      }
      
      // Добавляем некоторые общие директории, если это подходит
      if (!importPath || importPath === './' || importPath === '.') {
        baseSuggestions.push({
          label: './components/',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Папка компонентов',
          insertText: './components/',
          sortText: '0003',
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        });
        
        baseSuggestions.push({
          label: './utils/',
          kind: this.monaco.languages.CompletionItemKind.Folder,
          detail: 'Папка утилит',
          insertText: './utils/',
          sortText: '0004',
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        });
      }
      
      return {
        suggestions: baseSuggestions
      };
    } catch (error) {
      console.error('Ошибка при предоставлении запасных автодополнений:', error);
      return null;
    }
  }
  
  /**
   * Проверяет, является ли путь многоуровневым
   * Поддерживает паттерны вида: ./../, ../../, ./../../, ../../../ и т.д.
   */
  private isMultilevelPath(path: string): boolean {
    if (!path) return false;
    
    // Паттерны для обнаружения многоуровневых путей
    const patterns = [
      /^\.\.\//, // начинается с ../
      /^\.\/\.\.\//, // начинается с ./../
      /^(\.\.\/)(\.\.\/)/, // начинается с ../../
      /^(\.\/){1,}(\.\.\/)/, // начинается с ./ и содержит ../
      /^(\.\.\/)+(\.\/)*/, // несколько ../ с возможными ./
      /\.\.\/.*\/\.\./ // содержит ../ в середине или конце пути
    ];
    
    return patterns.some(pattern => pattern.test(path));
  }
  
  /**
   * Анализирует структуру многоуровневого пути
   * @param path Многоуровневый путь для анализа
   * @returns Информация о структуре пути
   */
  private parseMultilevelPath(path: string): {
    parentLevels: number,
    hasCurrentDir: boolean,
    endsWithParentDir: boolean,
    segments: string[]
  } {
    if (!path) {
      return {
        parentLevels: 0,
        hasCurrentDir: false,
        endsWithParentDir: false,
        segments: []
      };
    }
    
    // Разбиваем путь на сегменты
    const segments = path.split('/').filter(s => s.length > 0);
    
    // Подсчитываем количество переходов на уровень выше
    let parentLevels = 0;
    let hasCurrentDir = false;
    
    for (const segment of segments) {
      if (segment === '..') {
        parentLevels++;
      } else if (segment === '.') {
        hasCurrentDir = true;
      }
    }
    
    // Определяем, заканчивается ли путь на ..
    const endsWithParentDir = path.endsWith('..') || path.endsWith('../');
    
    return {
      parentLevels,
      hasCurrentDir,
      endsWithParentDir,
      segments
    };
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