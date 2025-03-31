/**
 * Система поиска файлов по частичному пути
 * Аналог функциональности Everything для поиска файлов в проекте
 */

// Определяем тип Monaco для корректной типизации
declare const monaco: any;

/**
 * Поиск файлов по частичному пути (аналог Everything)
 */
export const FileSearchSystem = {
  // Кэш найденных файлов
  fileCache: new Map<string, string[]>(),
  
  // Эмуляция файловой системы для демонстрации (в реальности заменить на API)
  mockFileSystem: [
    '/C:/PROJECTS/X-Editor/src/components/Button/Button.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Button/Button.css',
    '/C:/PROJECTS/X-Editor/src/components/Input/Input.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Form/Form.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Notification/Notification.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Notification/Notification.css',
    '/C:/PROJECTS/X-Editor/src/components/Notification/NotificationContext.tsx',
    '/C:/PROJECTS/X-Editor/src/components/TitleBar/TitleBar.tsx',
    '/C:/PROJECTS/X-Editor/src/components/NotesPages/NotesPages.tsx',
    '/C:/PROJECTS/X-Editor/src/components/NotesPages/GroupNotes/components/NoteEditor.tsx',
    '/C:/PROJECTS/X-Editor/src/components/AuthForm/AuthForm.tsx',
    '/C:/PROJECTS/X-Editor/src/components/Background3D/Background3D.tsx',
    '/C:/PROJECTS/X-Editor/src/utils/path-utils.ts',
    '/C:/PROJECTS/X-Editor/src/utils/file-utils.ts',
    '/C:/PROJECTS/X-Editor/src/services/api.ts',
    '/C:/PROJECTS/X-Editor/src/hooks/useData.ts',
    '/C:/PROJECTS/X-Editor/src/main-screen/centerContainer/monaco-advanced-config.ts',
    '/C:/PROJECTS/X-Editor/src/monaco-config/register-tsx.ts'
  ],
  
  /**
   * Поиск файлов по частичному пути
   * @param partialPath Частичный путь (например, "components\Notification")
   * @returns Массив полных путей к файлам, соответствующим шаблону
   */
  async searchFiles(partialPath: string): Promise<string[]> {
    console.log('Поиск файлов по частичному пути:', partialPath);
    
    // Нормализуем поисковый запрос
    const normalizedPath = partialPath.replace(/\\/g, '/').toLowerCase();
    
    // Проверяем кэш
    if (this.fileCache.has(normalizedPath)) {
      return this.fileCache.get(normalizedPath) || [];
    }
    
    // В реальном приложении здесь был бы запрос к API или использование
    // File System API для поиска файлов
    
    // Для демонстрации используем моковую файловую систему
    const results = this.mockFileSystem.filter(filePath => {
      return filePath.toLowerCase().includes(normalizedPath);
    });
    
    // Кэшируем результаты
    this.fileCache.set(normalizedPath, results);
    
    return results;
  },
  
  /**
   * Поиск файла по частичному пути и вывод полной информации о нем
   * @param partialPath Частичный путь к файлу
   * @returns Подробная информация о найденных файлах
   */
  async getFileInfo(partialPath: string): Promise<{
    fullPath: string;
    relativePath: string;
    directory: string;
    fileName: string;
    extension: string;
    exists: boolean;
  }[]> {
    const matchingFiles = await this.searchFiles(partialPath);
    
    const results = matchingFiles.map(fullPath => {
      // Разбираем путь
      const lastSlashIndex = fullPath.lastIndexOf('/');
      const directory = lastSlashIndex !== -1 ? fullPath.substring(0, lastSlashIndex) : '';
      const fileNameWithExt = lastSlashIndex !== -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;
      
      // Выделяем расширение
      const dotIndex = fileNameWithExt.lastIndexOf('.');
      const fileName = dotIndex !== -1 ? fileNameWithExt.substring(0, dotIndex) : fileNameWithExt;
      const extension = dotIndex !== -1 ? fileNameWithExt.substring(dotIndex) : '';
      
      // Вычисляем относительный путь относительно src
      const srcIndex = fullPath.indexOf('/src/');
      const relativePath = srcIndex !== -1 ? fullPath.substring(srcIndex + 4) : fullPath;
      
      return {
        fullPath,
        relativePath,
        directory,
        fileName,
        extension,
        exists: true // В реальном приложении нужно проверять существование файла
      };
    });
    
    return results;
  },
  
  /**
   * Форматирует результаты поиска для вывода в Monaco
   * @param results Результаты поиска
   * @returns Строка с форматированными результатами
   */
  formatSearchResults(results: {
    fullPath: string;
    relativePath: string;
    directory: string;
    fileName: string;
    extension: string;
    exists: boolean;
  }[]): string {
    if (results.length === 0) {
      return 'Файлы не найдены';
    }
    
    let output = `Найдено файлов: ${results.length}\n\n`;
    
    results.forEach((file, index) => {
      output += `${index + 1}. **${file.fileName}${file.extension}**\n`;
      output += `   Полный путь: \`${file.fullPath}\`\n`;
      output += `   Относительный путь: \`${file.relativePath}\`\n`;
      output += `   Директория: \`${file.directory}\`\n`;
      output += '\n';
    });
    
    return output;
  }
};

/**
 * Выполняет поиск файлов и показывает результаты
 * @param editor Экземпляр редактора Monaco
 * @param initialQuery Начальный поисковый запрос
 */
async function searchFiles(editor: any, initialQuery: string = ''): Promise<void> {
  // В реальном приложении здесь можно показать UI для ввода поискового запроса
  // Для демонстрации используем простой prompt
  const query = prompt('Введите частичный путь для поиска (например, components\\Notification):', initialQuery);
  
  if (!query) return;
  
  try {
    // Поиск файлов
    const results = await FileSearchSystem.getFileInfo(query);
    const formattedResults = FileSearchSystem.formatSearchResults(results);
    
    // В реальном приложении можно отобразить результаты в выпадающем меню или панели
    // Для демонстрации просто показываем alert
    alert(formattedResults);
    
    // Вывод в консоль для отладки
    console.log('Результаты поиска:', results);
  } catch (error) {
    console.error('Ошибка при поиске файлов:', error);
    alert(`Ошибка поиска: ${error}`);
  }
}

/**
 * Регистрирует команду поиска файлов в Monaco Editor
 * @param editor Экземпляр редактора Monaco
 */
export function registerFileSearchCommand(editor: any): void {
  if (!editor || !editor.addAction) {
    console.warn('Не удалось зарегистрировать команду поиска файлов: редактор не определен');
    return;
  }
  
  if (typeof monaco === 'undefined') {
    console.warn('Monaco не определен, невозможно зарегистрировать команду поиска файлов');
    return;
  }
  
  editor.addAction({
    id: 'search-files',
    label: 'Поиск файлов по частичному пути',
    keybindings: [
      // Ctrl+Alt+F или Cmd+Alt+F (чтобы не конфликтовать со стандартным поиском)
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF
    ],
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run: function(ed: any) {
      // Получаем выделенный текст или текст под курсором
      const selection = ed.getSelection();
      const model = ed.getModel();
      let searchText = '';
      
      if (selection && !selection.isEmpty()) {
        searchText = model.getValueInRange(selection);
      } else {
        // Если нет выделения, пытаемся получить слово под курсором
        const position = ed.getPosition();
        const word = model.getWordAtPosition(position);
        
        if (word) {
          searchText = word.word;
        }
      }
      
      // Показываем диалог поиска
      searchFiles(ed, searchText);
    }
  });
  
  console.log('Команда поиска файлов зарегистрирована. Используйте Ctrl+Alt+F для поиска.');
} 