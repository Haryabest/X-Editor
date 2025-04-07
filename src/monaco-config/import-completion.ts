/**
 * Система автодополнения путей для импортов в TSX/TS файлах
 * Предоставляет интеллектуальное автодополнение путей на основе анализа файловой структуры проекта
 */

import { invoke } from '@tauri-apps/api/core';
import * as monacoEditor from 'monaco-editor';
type Monaco = typeof monacoEditor;

/**
 * Интерфейс для результата из Rust-функции list_dir и get_importable_files
 */
interface DirEntry {
  path: string;
  isDir: boolean;
}

// Объявляем тип __TAURI__ для TypeScript
declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

// Типы файлов, которые можно импортировать
const IMPORTABLE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.less',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'
];

// Кэш файловой структуры
interface FileStructureCache {
  files: string[];
  directories: string[];
  lastUpdate: number;
  rootPath: string;
}

// Состояние кэша
let fileCache: FileStructureCache | null = null;
const CACHE_TTL = 30000; // Время жизни кэша в мс (30 секунд)

/**
 * Проверяет, актуален ли кэш
 */
function isCacheValid(): boolean {
  return !!(fileCache && (Date.now() - fileCache.lastUpdate < CACHE_TTL));
}

/**
 * Обновляет кэш файлов и директорий для автодополнения импортов
 * @param rootPath Корневой путь проекта
 */
async function updateFileCache(rootPath: string): Promise<void> {
  console.log(`[Автодополнение импортов] Обновление кэша файлов для корня проекта: ${rootPath}`);
  
  if (!rootPath) {
    console.error('[Автодополнение импортов] Корневой путь не определен');
    return;
  }
  
  try {
    // Используем нашу новую Rust-функцию для получения всех импортируемых файлов
    console.log('[Автодополнение импортов] Вызов get_importable_files...');
    const result = await invoke<DirEntry[]>('get_importable_files', { rootPath });
    
    console.log(`[Автодополнение импортов] Получено ${result.length} файлов и директорий`);
    
    // Обновляем кэш
    const files: string[] = [];
    const directories: string[] = [];
    
    for (const entry of result) {
      if (entry.isDir) {
        directories.push(entry.path);
      } else {
        files.push(entry.path);
      }
    }
    
    // Обновляем глобальный кэш
    fileCache = {
      files,
      directories,
      lastUpdate: Date.now(),
      rootPath
    };
    
    console.log(`[Автодополнение импортов] Кэш обновлен: ${files.length} файлов, ${directories.length} директорий`);
  } catch (error) {
    console.error('[Автодополнение импортов] Ошибка при обновлении кэша:', error);
  }
}

/**
 * Сканирует директорию рекурсивно для получения всех файлов и поддиректорий
 * @param directory Путь к директории
 * @deprecated Используйте updateFileCache с get_importable_files вместо этой функции
 */
async function scanDirectory(directory: string): Promise<void> {
  console.log(`[Автодополнение импортов] Сканирование директории: ${directory}`);
  try {
    // Получаем содержимое директории
    const entries = await invoke<{ path: string, isDir: boolean }[]>('list_dir', { path: directory });
    console.log(`[Автодополнение импортов] Получено ${entries.length} элементов в директории ${directory}`);
    
    // Обходим все элементы
    for (const entry of entries) {
      // Пропускаем node_modules и .git директории
      if (entry.path.includes('node_modules') || entry.path.includes('.git')) {
        console.log(`[Автодополнение импортов] Пропускаем директорию: ${entry.path}`);
        continue;
      }
      
      // Директории обрабатываем рекурсивно
      if (entry.isDir) {
        console.log(`[Автодополнение импортов] Найдена директория: ${entry.path}`);
        if (fileCache && !fileCache.directories.includes(entry.path)) {
          fileCache.directories.push(entry.path);
        }
        await scanDirectory(entry.path);
      } else {
        // Проверяем, что файл имеет нужное расширение
        const ext = entry.path.split('.').pop()?.toLowerCase();
        if (ext && ['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(ext)) {
          console.log(`[Автодополнение импортов] Найден файл: ${entry.path}`);
          // Добавляем файл в список, если его ещё нет
          if (fileCache && !fileCache.files.includes(entry.path)) {
            fileCache.files.push(entry.path);
          }
        }
      }
    }
    
    console.log(`[Автодополнение импортов] Завершено сканирование: ${directory}, всего найдено ${fileCache?.files.length || 0} файлов и ${fileCache?.directories.length || 0} директорий`);
  } catch (error) {
    console.error(`[Автодополнение импортов] Ошибка при сканировании ${directory}:`, error);
  }
}

/**
 * Получает список файлов для автодополнения
 * @param basePath Базовый путь для относительного импорта
 * @param prefix Префикс пути (начальная часть пути, которую ввел пользователь)
 */
async function getImportPathCompletions(basePath: string, prefix: string): Promise<string[]> {
  try {
    console.log(`Получение автодополнений для базового пути: ${basePath}, префикс: ${prefix}`);
    
    // Если кэш устарел или отсутствует, обновляем его
    if (!isCacheValid()) {
      console.log('Кэш невалиден или отсутствует, обновляем...');
      try {
        const projectRoot = await invoke<string>('fs_get_project_root', { 
          currentFilePath: window.location.pathname 
        });
        
        console.log(`Полученный корень проекта: ${projectRoot}`);
        await updateFileCache(projectRoot);
      } catch (error) {
        console.error('Ошибка при обновлении кэша:', error);
      }
    } else {
      console.log('Используем существующий кэш файловой структуры');
    }
    
    if (!fileCache) {
      console.error('Кэш файловой структуры не инициализирован');
      return [];
    }
    
    console.log(`Кэш содержит ${fileCache.files.length} файлов и ${fileCache.directories.length} директорий`);
    
    const { files, directories } = fileCache;
    
    // Определяем тип импорта и преобразуем базовый путь
    let resolvedBasePath = basePath;
    let isRelativeImport = prefix.startsWith('./') || prefix.startsWith('../');
    let isAbsoluteImport = prefix.startsWith('/');
    
    console.log(`Тип импорта: ${isRelativeImport ? 'относительный' : isAbsoluteImport ? 'абсолютный' : 'другой'}`);
    
    // Очищаем префикс от начальных ./ или ../
    let cleanPrefix = prefix;
    if (isRelativeImport) {
      if (prefix.startsWith('./')) {
        cleanPrefix = prefix.slice(2);
        console.log(`Очищенный префикс (./): ${cleanPrefix}`);
      }
      
      // Для обработки ../
      if (prefix.startsWith('../')) {
        // Считаем количество ../ в пути
        const parentDirCount = prefix.match(/\.\.\//g)?.length || 0;
        console.log(`Количество "../" в пути: ${parentDirCount}`);
        
        // Поднимаемся на нужное количество директорий вверх
        let pathParts = basePath.split('/');
        pathParts = pathParts.slice(0, pathParts.length - parentDirCount - 1);
        resolvedBasePath = pathParts.join('/');
        
        console.log(`Новый базовый путь после ../ : ${resolvedBasePath}`);
        
        // Убираем все ../ из префикса
        cleanPrefix = prefix.replace(/(?:\.\.\/)*/g, '');
        console.log(`Очищенный префикс (../): ${cleanPrefix}`);
      }
    }
    
    // Подготавливаем результат
    const matchingFiles: string[] = [];
    const matchingDirs: string[] = [];
    
    // Вывод отладочной информации о базовом пути и префиксе
    console.log(`Поиск файлов с базовым путем: ${resolvedBasePath}, очищенный префикс: ${cleanPrefix}`);

    // Обрабатываем файлы в зависимости от типа импорта
    if (isRelativeImport) {
      // Для относительных импортов ищем в текущей директории и выше
      for (const file of files) {
        if (file.startsWith(resolvedBasePath)) {
          // Получаем относительный путь от базового пути
          let relativePath = file.slice(resolvedBasePath.length + 1);
          
          // Проверяем, соответствует ли файл префиксу
          if (relativePath.startsWith(cleanPrefix)) {
            // Формируем итоговый путь для импорта
            let importPath = prefix.replace(cleanPrefix, '') + relativePath;
            
            // Не добавляем директории как файлы
            if (!directories.includes(file)) {
              matchingFiles.push(importPath);
            }
          }
        }
      }
      
      // Добавляем директории
      for (const dir of directories) {
        if (dir.startsWith(resolvedBasePath)) {
          let relativePath = dir.slice(resolvedBasePath.length + 1);
          
          if (relativePath.startsWith(cleanPrefix)) {
            let importPath = prefix.replace(cleanPrefix, '') + relativePath + '/';
            matchingDirs.push(importPath);
          }
        }
      }
    } else if (isAbsoluteImport || prefix.startsWith('@')) {
      // Для абсолютных импортов и алиасов (например @src)
      let rootPath = fileCache.rootPath;
      
      for (const file of files) {
        // Для абсолютных импортов из корня проекта
        if (isAbsoluteImport) {
          const relativePath = file.slice(rootPath.length + 1);
          if (relativePath.startsWith(prefix.slice(1))) {
            matchingFiles.push('/' + relativePath);
          }
        } 
        // Для импортов с алиасами (например @src/)
        else if (prefix.startsWith('@')) {
          // Извлекаем часть алиаса до /
          const aliasMatch = prefix.match(/(@[^/]+)\/?(.*)/) || [];
          const alias = aliasMatch[1] || '';
          const aliasPrefix = aliasMatch[2] || '';
          
          // Преобразуем алиас в реальный путь
          if (alias === '@src' && file.includes('/src/')) {
            const srcIndex = file.indexOf('/src/');
            const relativePath = file.slice(srcIndex + 5); // +5 для пропуска "/src/"
            
            if (relativePath.startsWith(aliasPrefix)) {
              matchingFiles.push(`${alias}/${relativePath}`);
            }
          }
        }
      }
      
      // Добавляем директории для абсолютных импортов
      for (const dir of directories) {
        if (isAbsoluteImport) {
          const relativePath = dir.slice(rootPath.length + 1);
          if (relativePath.startsWith(prefix.slice(1))) {
            matchingDirs.push('/' + relativePath + '/');
          }
        } else if (prefix.startsWith('@')) {
          const aliasMatch = prefix.match(/(@[^/]+)\/?(.*)/) || [];
          const alias = aliasMatch[1] || '';
          const aliasPrefix = aliasMatch[2] || '';
          
          if (alias === '@src' && dir.includes('/src/')) {
            const srcIndex = dir.indexOf('/src/');
            const relativePath = dir.slice(srcIndex + 5);
            
            if (relativePath.startsWith(aliasPrefix)) {
              matchingDirs.push(`${alias}/${relativePath}/`);
            }
          }
        }
      }
    } else {
      // Для импортов пакетов (node_modules)
      // Здесь можно добавить логику для автодополнения npm пакетов
      console.log('Импорт пакета npm, не реализовано автодополнение для node_modules');
      return [];
    }
    
    // Объединяем директории и файлы, причем директории идут первыми
    const result = [...matchingDirs, ...matchingFiles];
    console.log(`Найдено ${result.length} совпадений для автодополнения (${matchingDirs.length} директорий, ${matchingFiles.length} файлов)`);
    return result;
  } catch (error) {
    console.error('Ошибка при получении путей для автодополнения:', error);
    return [];
  }
}

/**
 * Инициализация кэша файловой системы
 */
async function initCache() {
  console.log('[Автодополнение импортов] Инициализация кэша файловой системы');
  try {
    const projectRoot = await invoke<string>('fs_get_project_root', { 
      currentFilePath: window.location.pathname 
    });
    console.log(`[Автодополнение импортов] Получен корень проекта: ${projectRoot}`);
    await updateFileCache(projectRoot);
  } catch (error) {
    console.error('[Автодополнение импортов] Ошибка при инициализации кэша:', error);
  }
}

/**
 * Регистрирует провайдер автодополнения для import-строк
 */
export function registerImportCompletionProvider(monaco: Monaco) {
  console.log('[Автодополнение импортов] Регистрация провайдера автодополнения импортов');
  
  try {
    // Инициализируем кэш при регистрации провайдера
    initCache();
    
    // Регистрируем провайдер для JavaScript и TypeScript
    const languages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    
    languages.forEach(language => {
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['/', '\'', '"'],
        
        async provideCompletionItems(model: monacoEditor.editor.ITextModel, position: monacoEditor.Position) {
          console.log(`[Автодополнение импортов] Запрос автодополнения в позиции: ${position.lineNumber}:${position.column}`);
          
          try {
            const lineText = model.getLineContent(position.lineNumber);
            console.log(`[Автодополнение импортов] Текст строки: "${lineText}"`);
            
            // Проверяем, что текущая строка содержит import statement
            const importMatch = lineText.match(/import\s+['"]([^'"]*)/);
            const dynamicImportMatch = lineText.match(/import\s*\(\s*['"]([^'"]*)/);
            const requireMatch = lineText.match(/require\s*\(\s*['"]([^'"]*)/);
            
            if (!importMatch && !dynamicImportMatch && !requireMatch) {
              console.log('[Автодополнение импортов] Строка не содержит импорт, автодополнение не требуется');
              return { suggestions: [] };
            }
            
            // Извлекаем текущую часть пути
            let prefix = '';
            if (importMatch) {
              prefix = importMatch[1];
            } else if (dynamicImportMatch) {
              prefix = dynamicImportMatch[1];
            } else if (requireMatch) {
              prefix = requireMatch[1];
            }
            
            console.log(`[Автодополнение импортов] Извлеченный префикс: "${prefix}"`);
            
            // Получаем базовый путь текущего файла
            const filePath = model.uri.path;
            console.log(`[Автодополнение импортов] Путь текущего файла: ${filePath}`);
            
            // Получаем директорию текущего файла
            const lastSlashIndex = filePath.lastIndexOf('/');
            const basePath = filePath.substring(0, lastSlashIndex);
            console.log(`[Автодополнение импортов] Базовый путь для автодополнения: ${basePath}`);
            
            // Получаем подходящие пути для завершения
            const completions = await getImportPathCompletions(basePath, prefix);
            console.log(`[Автодополнение импортов] Получено ${completions.length} вариантов автодополнения`);
            
            // Преобразуем пути в suggestions для Monaco
            const suggestions = completions.map(path => {
              return {
                label: path,
                kind: monaco.languages.CompletionItemKind.File,
                insertText: path.replace(prefix, ''),
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column - (prefix.length || 0),
                  endColumn: position.column
                },
                sortText: path.endsWith('/') ? '0' + path : '1' + path // Директории сортируются первыми
              };
            });
            
            console.log(`[Автодополнение импортов] Возвращаем ${suggestions.length} предложений`);
            return { suggestions };
          } catch (error) {
            console.error('[Автодополнение импортов] Ошибка при формировании предложений:', error);
            return { suggestions: [] };
          }
        }
      });
      
      console.log(`[Автодополнение импортов] Провайдер зарегистрирован для языка: ${language}`);
    });
    
    console.log('[Автодополнение импортов] Провайдер успешно зарегистрирован для всех языков');
  } catch (error) {
    console.error('[Автодополнение импортов] Ошибка при регистрации провайдера:', error);
  }
} 