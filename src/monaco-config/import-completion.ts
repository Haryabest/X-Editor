/**
 * Система автодополнения путей для импортов в TSX/TS файлах
 * Предоставляет интеллектуальное автодополнение путей на основе анализа файловой структуры проекта
 */

import { invoke } from '@tauri-apps/api/core';
import * as monacoEditor from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { getPath, getDefaultRules, getAbsolutePathFromImport, trimLines, getModuleIdCompletions } from './import-utils';
import { getTypeDefs } from '../main-screen/centerContainer/monaco-lsp-path-intellisense';
import path from 'path';
import fuzzysort from 'fuzzysort';
type Monaco = typeof monacoEditor;
type Position = monacoEditor.Position;
type ITextModel = monacoEditor.editor.ITextModel;
type CancellationToken = monacoEditor.CancellationToken;
type CompletionContext = monacoEditor.languages.CompletionContext;
type CompletionList = monacoEditor.languages.CompletionList;
type CompletionItemKind = monacoEditor.languages.CompletionItemKind;

/**
 * Интерфейс для результата из Rust-функции list_dir и get_importable_files
 */
interface DirEntry {
  path: string;
  isDir: boolean;
}

/**
 * Интерфейс для описания информации о разборе относительного пути
 */
interface RelativePathInfo {
  /** Исходный путь */
  original: string;
  /** Является ли путь относительным */
  isRelative: boolean;
  /** Включает ли путь переходы на уровень выше (через ..) */
  goesUp: boolean;
  /** Количество переходов на уровень выше */
  upLevels: number;
  /** Количество переходов на уровень выше (альтернативное имя) */
  parentLevels: number;
  /** Базовая часть пути (до последнего слеша) */
  basePath: string;
  /** Текст поиска (часть после последнего слеша) */
  searchText: string;
  /** Оставшаяся часть пути */
  remainingPath?: string;
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

// Добавляем константы и переменную для отслеживания обновления кэша
let lastCacheUpdate = 0;
const CACHE_UPDATE_INTERVAL = 30000; // 30 секунд
let currentDirPath = ''; // Текущая директория

// Объявление типа кэша файлов
interface FileStructureCache {
  files: string[];
  directories: string[];
  length: number;
}

// Кэш файлов проекта
let fileCache: string[] = [];
let dirCache: string[] = [];
let npmPackages: string[] = []; // NPM пакеты

/**
 * Проверяет, актуален ли кэш
 */
function isCacheValid(): boolean {
  return !!(fileCache && (Date.now() - lastCacheUpdate < CACHE_UPDATE_INTERVAL));
}

/**
 * Обновляет кэш файлов и директорий для автодополнения импортов
 * @param rootPath Корневой путь проекта
 */
async function updateFileCache(rootPath: string, forceRefresh = false): Promise<void> {
  console.log(`[Автодополнение импортов] Обновление кэша для: ${rootPath}`);
  
  try {
    // Если кэш уже актуален и не требуется принудительное обновление, пропускаем
    if (isCacheValid() && !forceRefresh) {
      console.log('[Автодополнение импортов] Кэш актуален, пропускаем обновление');
      return;
    }
    
    // Получаем текущую директорию
    try {
      currentDirPath = await invoke<string>('get_current_dir', {});
      console.log(`[Автодополнение импортов] Текущая директория: ${currentDirPath}`);
    } catch (error) {
      console.warn('[Автодополнение импортов] Не удалось получить текущую директорию:', error);
      currentDirPath = rootPath; // Используем корень проекта как запасной вариант
    }
    
    // Получаем список файлов и директорий
    const files: string[] = [];
    const directories = new Set<string>();
    
    // Сканируем файловую систему
    await scanDirectory(rootPath);
    
    // Получаем npm пакеты
    try {
      npmPackages = await invoke<string[]>('get_npm_packages', { project_root: rootPath });
      console.log(`[Автодополнение импортов] Получено ${npmPackages.length} npm пакетов`);
    } catch (error) {
      console.warn('[Автодополнение импортов] Ошибка при получении npm пакетов:', error);
      npmPackages = []; // В случае ошибки очищаем список пакетов
    }
    
    // Обновляем кэш с полученными данными
    fileCache = files;
    dirCache = Array.from(directories);
    lastCacheUpdate = Date.now();
    
    console.log('[Автодополнение импортов] Кэш обновлен успешно');
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
        if (fileCache && !fileCache.includes(entry.path)) {
          fileCache.push(entry.path);
        }
        await scanDirectory(entry.path);
      } else {
        // Проверяем, что файл имеет нужное расширение
        const ext = entry.path.split('.').pop()?.toLowerCase();
        if (ext && ['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(ext)) {
          console.log(`[Автодополнение импортов] Найден файл: ${entry.path}`);
          // Добавляем файл в список, если его ещё нет
          if (fileCache && !fileCache.includes(entry.path)) {
            fileCache.push(entry.path);
          }
        }
      }
    }
    
    console.log(`[Автодополнение импортов] Завершено сканирование: ${directory}, всего найдено ${fileCache.length} файлов и ${dirCache.length} директорий`);
  } catch (error) {
    console.error(`[Автодополнение импортов] Ошибка при сканировании ${directory}:`, error);
  }
}

/**
 * Разбирает относительный путь на компоненты
 * @param relativePath Относительный путь для анализа
 * @returns Структура пути
 */
function parseRelativePath(relativePath: string): RelativePathInfo {
  console.log(`[Автодополнение импортов] Разбор относительного пути: ${relativePath}`);

  const result: RelativePathInfo = {
    original: relativePath,
    isRelative: false,
    goesUp: false,
    upLevels: 0,
    parentLevels: 0,
    basePath: '',
    searchText: ''
  };

  // Проверяем, является ли путь относительным
  if (relativePath.startsWith('./') || relativePath.startsWith('../') || relativePath === '.' || relativePath === '..') {
    result.isRelative = true;
    
    // Подсчитываем количество переходов вверх
    const upLevelPatterns = relativePath.match(/\.\.\//g);
    result.upLevels = upLevelPatterns ? upLevelPatterns.length : 0;
    
    // Устанавливаем parentLevels как синоним для upLevels
    result.parentLevels = result.upLevels;
    
    // Проверяем, есть ли отдельно стоящее .. в конце пути или это сам путь
    if (relativePath === '..') {
      result.upLevels = 1;
      result.parentLevels = 1;
      result.goesUp = true;
    } else if (relativePath.endsWith('/..')) {
      result.upLevels += 1;
      result.parentLevels = result.upLevels;
      result.goesUp = true;
    } else if (relativePath.includes('..')) {
      result.goesUp = true;
    }
    
    // Определяем базовую часть пути (до последнего слеша)
    const lastSlashIndex = relativePath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      result.basePath = relativePath.substring(0, lastSlashIndex + 1);
      result.searchText = relativePath.substring(lastSlashIndex + 1);
    } else {
      result.basePath = relativePath;
      result.searchText = '';
    }
    
    // Добавляем оставшуюся часть пути
    // Извлекаем часть пути после всех переходов вверх
    let remainingPath = '';
    if (result.upLevels > 0) {
      // Находим последнее вхождение "../" и берем всё, что после него
      const lastUpPatternIndex = relativePath.lastIndexOf('../');
      if (lastUpPatternIndex !== -1 && lastUpPatternIndex + 3 < relativePath.length) {
        remainingPath = relativePath.substring(lastUpPatternIndex + 3);
      }
    } else if (relativePath.startsWith('./') && relativePath.length > 2) {
      // Для ./path/to берем path/to
      remainingPath = relativePath.substring(2);
    }
    
    result.remainingPath = remainingPath;
    
    console.log('[Автодополнение импортов] Результат разбора относительного пути:', 
      {
        isRelative: result.isRelative, 
        goesUp: result.goesUp, 
        upLevels: result.upLevels,
        parentLevels: result.parentLevels,
        basePath: result.basePath, 
        searchText: result.searchText,
        remainingPath: result.remainingPath
      }
    );
  }
  
  return result;
}

/**
 * Получает содержимое директории с учетом многоуровневых путей
 * @param basePath Базовый путь начала поиска
 * @param relativePath Относительный путь для разрешения
 */
async function getDirectoryContents(basePath: string, relativePath: string): Promise<DirEntry[]> {
  try {
    console.log(`[Автодополнение импортов] Получаем содержимое директории для пути: ${basePath}, относительный путь: ${relativePath}`);
    
    // Разбираем структуру относительного пути с улучшенным алгоритмом
    const pathInfo = parseRelativePath(relativePath);
    
    if (!pathInfo.isRelative) {
      console.warn(`[Автодополнение импортов] Путь ${relativePath} не является относительным`);
      return [];
    }
    
    // Получаем абсолютный путь директории для поиска
    let targetPath = basePath;
    
    // Проверяем, является ли базовый путь файлом, а не директорией
    let isBasePathDirectory = true;
    try {
      isBasePathDirectory = await invoke<boolean>('fs_is_directory', { path: basePath });
    } catch (error) {
      // Пробуем альтернативную функцию для проверки
      try {
        const fileInfo = await invoke<any>('fs_get_file_info', { path: basePath });
        isBasePathDirectory = fileInfo.isDir;
      } catch (innerError) {
        console.warn(`[Автодополнение импортов] Ошибка при проверке базового пути: ${error}, ${innerError}`);
      }
    }
    
    // Если базовый путь - файл, переходим к его директории
    if (!isBasePathDirectory) {
      const lastSlashIndex = basePath.lastIndexOf('/');
      const lastBackslashIndex = basePath.lastIndexOf('\\');
      const lastDelimIndex = Math.max(lastSlashIndex, lastBackslashIndex);
      
      if (lastDelimIndex !== -1) {
        targetPath = basePath.substring(0, lastDelimIndex);
        console.log(`[Автодополнение импортов] Базовый путь - файл, используем его директорию: ${targetPath}`);
      }
    }
    
    // Нормализуем разделители
    targetPath = targetPath.replace(/\\/g, '/');
    
    // Логируем начальное состояние
    console.log(`[Автодополнение импортов] Начальный целевой путь: ${targetPath}, необходимо подняться на ${pathInfo.parentLevels} уровней вверх`);
    
    // Применяем переходы к родительским директориям, если необходимо
    for (let i = 0; i < pathInfo.parentLevels; i++) {
      const lastSlashIndex = targetPath.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        targetPath = targetPath.substring(0, lastSlashIndex);
        console.log(`[Автодополнение импортов] Переход на уровень выше #${i+1}: ${targetPath}`);
      } else {
        console.warn(`[Автодополнение импортов] Достигнут корень файловой системы при переходе на уровень выше после ${i} переходов`);
        break;
      }
    }
    
    // Если есть оставшаяся часть пути, применяем её
    if (pathInfo.remainingPath) {
      // Убеждаемся, что путь не начинается со слеша
      const remainingPathNormalized = pathInfo.remainingPath.startsWith('/') 
                                    ? pathInfo.remainingPath.substring(1) 
                                    : pathInfo.remainingPath;
      
      if (remainingPathNormalized) {
        targetPath = `${targetPath}/${remainingPathNormalized}`;
        console.log(`[Автодополнение импортов] Добавлена оставшаяся часть пути: ${targetPath}`);
      }
    }
    
    // Получаем содержимое целевой директории
    console.log(`[Автодополнение импортов] Запрашиваем содержимое директории: ${targetPath}`);
    let entries: DirEntry[] = [];
    
    try {
      // Пробуем основную функцию
      entries = await invoke<DirEntry[]>('fs_list_dir', { path: targetPath });
    } catch (error) {
      try {
        // Пробуем альтернативную функцию
        entries = await invoke<DirEntry[]>('list_dir', { path: targetPath });
      } catch (alternativeError) {
        // Пробуем третью функцию
        try {
          entries = await invoke<DirEntry[]>('scan_directory', { path: targetPath, recursive: false });
        } catch (thirdError) {
          console.error(`[Автодополнение импортов] Ошибки при получении содержимого директории ${targetPath}:`, 
                        { primaryError: error, alternativeError: alternativeError, thirdError: thirdError });
          return [];
        }
      }
    }
    
    console.log(`[Автодополнение импортов] Получено ${entries.length} элементов в директории ${targetPath}`);
    
    // Добавляем возможность подняться на один уровень выше, если мы не в корне
    if (targetPath.includes('/')) {
      const parentPath = '..';
      entries.unshift({
        path: parentPath,
        isDir: true
      });
      console.log(`[Автодополнение импортов] Добавлен переход на уровень выше в результаты`);
    }
    
    return entries;
  } catch (error) {
    console.error(`[Автодополнение импортов] Ошибка при получении содержимого директории: ${error}`);
    return [];
  }
}

/**
 * Получает список файлов для автодополнения
 * @param basePath Базовый путь для относительного импорта (текущая директория файла)
 * @param prefix Префикс пути (начальная часть пути, которую ввел пользователь)
 */
async function getImportPathCompletions(basePath: string, prefix: string): Promise<string[]> {
  try {
    console.log(`[Автодополнение импортов] Получение автодополнений для базового пути: ${basePath}, префикс: "${prefix}"`);
    
    // Нормализуем префикс для более точной обработки
    const normalizedPrefix = normalizePath(prefix);
    if (normalizedPrefix !== prefix) {
      console.log(`[Автодополнение импортов] Нормализованный префикс: "${normalizedPrefix}"`);
    }
    
    // Используем нормализованный префикс для дальнейшей работы
    const prefixToUse = normalizedPrefix;
    
    // Если кэш устарел или отсутствует, обновляем его
    if (!isCacheValid()) {
      console.log('[Автодополнение импортов] Кэш невалиден или отсутствует, обновляем...');
      try {
        console.log(`[Автодополнение импортов] Вызываем fs_get_project_root с параметром currentFilePath: ${basePath}`);
        
        const projectRootInfo = await invoke<string>('fs_get_project_root', { 
          currentFilePath: basePath 
        });
        
        console.log(`[Автодополнение импортов] Получена информация о проекте: ${projectRootInfo}`);
        
        // Разбираем результат на путь к корню проекта и текущую директорию с новым разделителем
        let rootPath = projectRootInfo;
        let currentDirPath = '';
        
        if (projectRootInfo.includes('###')) {
          const parts = projectRootInfo.split('###');
          rootPath = parts[0];
          currentDirPath = parts.length > 1 ? parts[1] : '';
          console.log(`[Автодополнение импортов] Разобрана информация о проекте: корень проекта = ${rootPath}, текущая директория = ${currentDirPath}`);
        }
        
        // Используем корень проекта для обновления кэша
        await updateFileCache(projectRootInfo);
      } catch (error) {
        console.error('[Автодополнение импортов] Ошибка при обновлении кэша:', error);
      }
    } else {
      console.log('[Автодополнение импортов] Используем существующий кэш файловой структуры');
    }
    
    // Если это относительный путь, обрабатываем специальным образом
    if (prefixToUse.startsWith('./') || prefixToUse.startsWith('../') || prefixToUse === '.' || prefixToUse === '..') {
      try {
        console.log(`[Автодополнение импортов] Специальная обработка для относительного пути: ${prefixToUse}`);
        
        // Получаем путь к текущей директории файла
        let currentDir = basePath;
        if (!currentDir) {
          console.warn('[Автодополнение импортов] Путь к текущей директории не найден, используем последний известный путь');
          currentDir = currentDirPath || './';
        }
        
        // Получаем информацию о структуре относительного пути
        const pathInfo = parseRelativePath(prefixToUse);
        
        // Если это простой случай "./" или "../", обрабатываем быстро
        if (prefixToUse === './' || prefixToUse === '../' || prefixToUse === '.' || prefixToUse === '..') {
          // Базовые варианты для начала ввода
          if (prefixToUse === '.' || prefixToUse === '..') {
            return prefixToUse === '.' ? ['./', '../'] : ['../'];
          }
          
          // Получаем содержимое директории
          const entries = await getDirectoryContents(currentDir, prefixToUse);
          
          // Формируем список автодополнений
          const completions: string[] = [];
          
          // Добавляем в список автодополнений только директорию и её содержимое
          entries.forEach(entry => {
            const itemName = entry.path.split('/').pop()?.split('\\').pop() || '';
            let completion = prefixToUse + itemName + (entry.isDir ? '/' : '');
            completions.push(completion);
          });
          
          console.log(`[Автодополнение импортов] Сформировано ${completions.length} вариантов автодополнения для ${prefixToUse}`, completions);
          return completions;
        }
        
        // Многоуровневый относительный путь
        // Получаем содержимое директории с учётом множественных уровней
        const entries = await getDirectoryContents(currentDir, prefixToUse);
        
        // Определяем, какую часть префикса нужно сохранить
        let prefixBase = prefixToUse;
        const lastSlashIndex = prefixToUse.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
          prefixBase = prefixToUse.substring(0, lastSlashIndex + 1);
        }
        
        // Фильтруем по последней части пути, если есть
        const searchSuffix = lastSlashIndex !== -1 ? 
                            prefixToUse.substring(lastSlashIndex + 1).toLowerCase() : 
                            '';
        
        // Формируем список автодополнений
        const completions: string[] = [];
        
        // Улучшенная обработка многоуровневых путей
        // Определяем, завершается ли путь на ".." или "../"
        const endsWithDotDot = prefixToUse.endsWith('..'); 
        const endsWithDotDotSlash = prefixToUse.endsWith('../');
        const endsWithSlash = prefixToUse.endsWith('/');
        
        // Если путь заканчивается на '..' (без слеша), предлагаем добавить слеш
        if (endsWithDotDot) {
          completions.push(prefixToUse + '/');
          console.log(`[Автодополнение импортов] Добавлен вариант со слешем: ${prefixToUse}/`);
        }
        
        // Добавляем специальную обработку для переходов на уровень выше
        if ((endsWithDotDotSlash || endsWithDotDot)) {
          // Если путь заканчивается на ../ или .., добавляем еще один уровень вверх
          let nextLevelUp;
          if (endsWithDotDotSlash) {
            nextLevelUp = prefixToUse + '../';
          } else {
            nextLevelUp = prefixToUse + '/../';
          }
          completions.push(nextLevelUp);
          console.log(`[Автодополнение импортов] Добавлен дополнительный переход вверх: ${nextLevelUp}`);
          
          // Для случаев с ../ предлагаем также вернуться к предыдущему состоянию с ..
          if (endsWithDotDotSlash && prefixToUse !== '../') {
            const parentPath = prefixToUse.replace(/\/+$/, ''); // Удаляем все завершающие слеши
            completions.push(parentPath);
            console.log(`[Автодополнение импортов] Добавлен вариант без слеша: ${parentPath}`);
          }
        }
        
        // Добавляем в список автодополнений только подходящие по префиксу элементы
        entries.forEach(entry => {
          const itemName = entry.path.split('/').pop()?.split('\\').pop() || '';
          
          // Проверяем, соответствует ли имя файла/директории поисковому суффиксу
          if (!searchSuffix || itemName.toLowerCase().startsWith(searchSuffix)) {
            if (itemName === '..' && prefixToUse.endsWith('../')) {
              // Если это родительская директория и путь уже заканчивается на "../", добавляем еще один "../"
              const oneMoreLevel = prefixToUse + '../';
              completions.push(oneMoreLevel);
              console.log(`[Автодополнение импортов] Добавлен еще один уровень вверх: ${oneMoreLevel}`);
            } else {
              // Обычное завершение
              let completion = prefixBase + itemName + (entry.isDir ? '/' : '');
              
              // Не добавляем дубликаты в список автодополнений
              if (!completions.includes(completion)) {
                completions.push(completion);
                console.log(`[Автодополнение импортов] Добавлено автодополнение: ${completion}`);
              }
            }
          }
        });
        
        // Для внутренних путей многоуровневой навигации всегда добавляем возможность перейти на уровень выше
        if (endsWithSlash && !endsWithDotDotSlash) {
          // Проверяем, есть ли уже .. в результатах
          const hasParentOption = completions.some(c => c.endsWith('../') || c === prefixToUse + '..');
          
          if (!hasParentOption) {
            completions.push(prefixToUse + '..');
            console.log(`[Автодополнение импортов] Добавлена возможность перехода на уровень выше: ${prefixToUse}..`);
          }
        }
        
        console.log(`[Автодополнение импортов] Сформировано ${completions.length} вариантов автодополнения для многоуровневого пути ${prefixToUse}`, completions);
        
        // Если не нашли ни одного варианта и это относительный путь с родительскими директориями
        if (completions.length === 0 && (prefixToUse.includes('../') || prefixToUse.includes('/..'))) {
          // Добавляем возможность подняться еще на уровень выше
          let oneLevelUp = '';
          
          if (prefixToUse.endsWith('/')) {
            oneLevelUp = prefixToUse + '../';
          } else if (prefixToUse.endsWith('..')) {
            oneLevelUp = prefixToUse + '/';
          } else {
            oneLevelUp = prefixToUse + '/../';
          }
          
          completions.push(oneLevelUp);
          console.log(`[Автодополнение импортов] Добавлен запасной переход на уровень выше: ${oneLevelUp}`);
        }
        
        return completions;
      } catch (error) {
        console.error(`[Автодополнение импортов] Ошибка при обработке относительного пути ${prefixToUse}:`, error);
      }
    }
    
    if (!fileCache) {
      console.error('[Автодополнение импортов] Кэш файловой структуры не инициализирован');
      return [];
    }
    
    console.log(`[Автодополнение импортов] Кэш содержит ${fileCache.length} файлов и ${dirCache.length} директорий`);
    
    // Важно: нормализуем все пути для единообразия
    const normalizedFiles = fileCache.map(f => f.replace(/\\/g, '/'));
    const normalizedDirs = dirCache.map(d => d.replace(/\\/g, '/'));
    
    // Определяем тип импорта
    const isRelativeImport = prefixToUse.startsWith('./') || prefixToUse.startsWith('../');
    const isAbsoluteImport = prefixToUse.startsWith('/');
    const isSpecificDirectory = !isRelativeImport && !isAbsoluteImport && 
                              prefixToUse.includes('/') && !prefixToUse.startsWith('@');
    const isNpmImport = !isRelativeImport && !isAbsoluteImport && 
                      !isSpecificDirectory && !prefixToUse.startsWith('@');
    
    console.log(`[Автодополнение импортов] Тип импорта: ${
      isRelativeImport ? 'относительный' : 
      isAbsoluteImport ? 'абсолютный' : 
      isSpecificDirectory ? 'конкретная директория' :
      isNpmImport ? 'npm пакет' : 'другой'
    }`);
    
    // Подготавливаем результат
    const matchingFiles: string[] = [];
    const matchingDirs: string[] = [];
    const matchingNpmPackages: string[] = [];
    
    // Если префикс пустой или это начало относительного пути, всегда добавляем основные директории
    if (prefixToUse === '' || prefixToUse === '.' || prefixToUse === '..') {
      console.log('[Автодополнение импортов] Добавляем базовые директории');
      
      if (prefixToUse === '' || prefixToUse === '.') {
        matchingDirs.push('./');
      }
      
      if (prefixToUse === '' || prefixToUse === '..') {
        matchingDirs.push('../');
      }
    }
    
    // Получаем абсолютный путь к директории текущего файла
    // Важно: нормализуем базовый путь для единообразия
    const absoluteBasePath = basePath.replace(/\\/g, '/');
    console.log(`[Автодополнение импортов] Нормализованный базовый путь: ${absoluteBasePath}`);
    
    // Используем путь из текущей директории, если basePath пуст или некорректен
    let effectiveBasePath = absoluteBasePath;
    
    // Проверяем, существует ли basePath как директория
    let basePathExists = false;
    try {
      basePathExists = await invoke<boolean>('fs_file_exists', { filePath: absoluteBasePath });
      console.log(`[Автодополнение импортов] Базовый путь существует: ${basePathExists}`);
    } catch (error) {
      console.warn(`[Автодополнение импортов] Ошибка при проверке существования базового пути: ${error}`);
    }
    
    // Если базовый путь не существует, пробуем использовать кэш
    if (!basePathExists || !effectiveBasePath) {
      if (fileCache && currentDirPath) {
        effectiveBasePath = currentDirPath;
        console.log(`[Автодополнение импортов] Используем текущую директорию из кэша: ${effectiveBasePath}`);
        
        // Проверяем существование этой директории
        try {
          const cachePathExists = await invoke<boolean>('fs_file_exists', { filePath: effectiveBasePath });
          console.log(`[Автодополнение импортов] Директория из кэша существует: ${cachePathExists}`);
          
          if (!cachePathExists) {
            // Если даже директория из кэша не существует, пробуем использовать корень проекта
            effectiveBasePath = fileCache[0] || '';
            console.log(`[Автодополнение импортов] Используем корень проекта из кэша: ${effectiveBasePath}`);
          }
        } catch (error) {
          console.warn(`[Автодополнение импортов] Ошибка при проверке существования директории из кэша: ${error}`);
        }
      } else if (!effectiveBasePath) {
        // Если basePath пуст и нет текущей директории в кэше, используем корень проекта
        effectiveBasePath = fileCache[0] || '';
        console.log(`[Автодополнение импортов] Используем корень проекта из кэша: ${effectiveBasePath}`);
      }
    }
    
    // Обработка относительных импортов (./ и ../)
    if (isRelativeImport) {
      // Для "./": поиск в текущей директории
      if (prefixToUse === './') {
        console.log(`[Автодополнение импортов] Ищем файлы в текущей директории: ${effectiveBasePath}`);
        
        // Добавляем стандартные каталоги даже если кэш пустой
        matchingDirs.push('./');
        matchingDirs.push('../');
        
        // Дополнительная проверка – убедимся, что директория существует
        try {
          const dirExists = await invoke<boolean>('fs_file_exists', { filePath: effectiveBasePath });
          console.log(`[Автодополнение импортов] Директория существует: ${dirExists}`);
          
          if (!dirExists) {
            console.log(`[Автодополнение импортов] Директория не существует, перезапрашиваем информацию о проекте`);
            const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
            
            // Используем текущую директорию из информации о проекте, если она доступна
            if (projectRootInfo && projectRootInfo.includes('###')) {
              const parts = projectRootInfo.split('###');
              if (parts.length > 1 && parts[1]) {
                effectiveBasePath = parts[1];
                console.log(`[Автодополнение импортов] Перезапрошенная текущая директория: ${effectiveBasePath}`);
                
                // Если мы изменили базовый путь, обновим кэш для новой директории
                try {
                  await updateFileCache(parts[0], true); // Принудительное обновление кэша
                  console.log(`[Автодополнение импортов] Обновлен кэш после изменения базового пути`);
                } catch (error) {
                  console.warn(`[Автодополнение импортов] Ошибка при обновлении кэша: ${error}`);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[Автодополнение импортов] Ошибка при проверке существования директории: ${error}`);
        }
        
        // Находим все файлы, которые находятся в той же директории, что и текущий файл
        let foundAnyFiles = false;
        for (const file of normalizedFiles) {
          // Получаем директорию файла
          const lastSlash = file.lastIndexOf('/');
          const fileDir = lastSlash > 0 ? file.substring(0, lastSlash) : file;
          
          // Проверяем, находится ли файл в текущей директории
          if (fileDir === effectiveBasePath || file.startsWith(effectiveBasePath + '/')) {
            const fileName = file.split('/').pop() || '';
            matchingFiles.push(`./${fileName}`);
            console.log(`[Автодополнение импортов] Найден файл в текущей директории: ${fileName}`);
            foundAnyFiles = true;
          }
        }
        
        // Если не найдены никакие файлы, логируем информацию для отладки
        if (!foundAnyFiles) {
          console.log(`[Автодополнение импортов] Не найдено файлов в директории ${effectiveBasePath}`);
          console.log(`[Автодополнение импортов] Всего файлов в кэше: ${normalizedFiles.length}`);
          
          // Проверим, есть ли какие-либо файлы в этой директории или её поддиректориях
          const possiblePaths = normalizedFiles.filter(file => file.startsWith(effectiveBasePath));
          console.log(`[Автодополнение импортов] Файлы, содержащие путь ${effectiveBasePath}: ${possiblePaths.length}`);
          
          if (possiblePaths.length > 0) {
            console.log(`[Автодополнение импортов] Примеры файлов: ${possiblePaths.slice(0, 3).join(', ')}`);
          }
          
          // Если директория не существует в кэше, перезапросим кэш
          if (possiblePaths.length === 0) {
            try {
              // Попробуем получить корень проекта с текущим путем
              const projectRoot = await invoke<string>('fs_get_project_root', { currentFilePath: effectiveBasePath });
              if (projectRoot) {
                // Принудительно обновим кэш с корнем проекта
                await updateFileCache(projectRoot.split('###')[0], true); // Принудительное обновление
                console.log(`[Автодополнение импортов] Принудительно обновлен кэш для пути ${effectiveBasePath}`);
                
                // После обновления кэша повторно попробуем найти файлы
                const updatedNormalizedFiles = fileCache.map(f => f.replace(/\\/g, '/'));
                console.log(`[Автодополнение импортов] После обновления кэша: ${updatedNormalizedFiles.length} файлов`);
                
                for (const file of updatedNormalizedFiles) {
                  const fileDir = file.substring(0, file.lastIndexOf('/'));
                  if (fileDir === effectiveBasePath) {
                    const fileName = file.split('/').pop() || '';
                    matchingFiles.push(`./${fileName}`);
                    console.log(`[Автодополнение импортов] Найден файл после обновления кэша: ${fileName}`);
                  }
                }
              }
            } catch (error) {
              console.error(`[Автодополнение импортов] Ошибка при принудительном обновлении кэша: ${error}`);
            }
          }
        }
      }
      // Для "../": поиск в родительской директории
      else if (prefixToUse === '../') {
        // Всегда добавляем стандартные директории
        matchingDirs.push('../');
        
        // Получаем родительскую директорию текущего файла
        const parentDirPath = effectiveBasePath.substring(0, effectiveBasePath.lastIndexOf('/'));
        console.log(`[Автодополнение импортов] Ищем файлы в родительской директории: ${parentDirPath}`);
        
        // Дополнительная проверка – убедимся, что родительская директория существует
        try {
          const dirExists = await invoke<boolean>('fs_file_exists', { filePath: parentDirPath });
          console.log(`[Автодополнение импортов] Родительская директория существует: ${dirExists}`);
          
          if (!dirExists) {
            console.log(`[Автодополнение импортов] Родительская директория не существует, перезапрашиваем информацию о проекте`);
            // Пытаемся перезапросить информацию о проекте для получения правильной родительской директории
            const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
            console.log(`[Автодополнение импортов] Результат запроса: ${projectRootInfo}`);
            
            // Принудительно обновляем кэш с полученной информацией
            if (projectRootInfo) {
              await updateFileCache(projectRootInfo, true);
            }
          }
        } catch (error) {
          console.warn(`[Автодополнение импортов] Ошибка при проверке существования родительской директории: ${error}`);
        }
        
        // Принудительно сканируем родительскую директорию, если она существует
        if (parentDirPath) {
          try {
            // Вызываем Rust API для сканирования директории
            const entries = await invoke<DirEntry[]>('scan_directory', { 
              path: parentDirPath, 
              recursive: false 
            });
            
            console.log(`[Автодополнение импортов] Сканирование родительской директории вернуло ${entries.length} элементов`);
            
            // Обрабатываем результаты и добавляем в предложения
            for (const entry of entries) {
              const name = entry.path.split('/').pop();
              if (name) {
                if (entry.isDir) {
                  matchingDirs.push(`../${name}/`);
                  console.log(`[Автодополнение импортов] Добавлена директория из сканирования: ${name}`);
                } else {
                  matchingFiles.push(`../${name}`);
                  console.log(`[Автодополнение импортов] Добавлен файл из сканирования: ${name}`);
                }
              }
            }
          } catch (error) {
            console.warn(`[Автодополнение импортов] Ошибка при сканировании родительской директории:`, error);
          }
        }
        
        if (parentDirPath) {
          // Находим все файлы в родительской директории
          let foundAnyFiles = false;
          for (const file of normalizedFiles) {
            // Получаем директорию файла
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            // Проверяем, находится ли файл в родительской директории
            if (fileDir === parentDirPath) {
              const fileName = file.split('/').pop() || '';
              // Исключаем директорию с текущим файлом
              const fullPath = `${fileDir}/${fileName}`;
              if (fullPath !== `${effectiveBasePath}/${effectiveBasePath.split('/').pop()}`) {
                matchingFiles.push(`../${fileName}`);
                console.log(`[Автодополнение импортов] Найден файл в родительской директории: ${fileName}`);
                foundAnyFiles = true;
              }
            }
          }
          
          // Если не найдены никакие файлы, логируем информацию для отладки
          if (!foundAnyFiles) {
            console.log(`[Автодополнение импортов] Не найдено файлов в родительской директории ${parentDirPath}`);
            console.log(`[Автодополнение импортов] Всего файлов в кэше: ${normalizedFiles.length}`);
            
            // Проверим, есть ли какие-либо файлы в этой директории или её поддиректориях
            const possiblePaths = normalizedFiles.filter(file => file.startsWith(parentDirPath));
            console.log(`[Автодополнение импортов] Файлы, содержащие родительский путь ${parentDirPath}: ${possiblePaths.length}`);
            
            if (possiblePaths.length > 0) {
              console.log(`[Автодополнение импортов] Примеры файлов: ${possiblePaths.slice(0, 3).join(', ')}`);
            }
            
            // Если директория не существует в кэше, перезапросим кэш
            if (possiblePaths.length === 0) {
              try {
                // Принудительно обновим кэш с родительским путем
                await updateFileCache(await invoke<string>('fs_get_project_root', { currentFilePath: parentDirPath }), true);
                console.log(`[Автодополнение импортов] Принудительно обновлен кэш для родительского пути ${parentDirPath}`);
              } catch (error) {
                console.error(`[Автодополнение импортов] Ошибка при принудительном обновлении кэша: ${error}`);
              }
            }
          }
          
          // Находим все директории в родительской директории
          let foundAnyDirs = false;
          for (const dir of normalizedDirs) {
            // Исключаем саму текущую директорию и родительскую директорию
            if (dir !== effectiveBasePath && dir !== parentDirPath) {
              const dirParts = dir.split('/');
              const parentParts = parentDirPath.split('/');
              
              // Проверяем, является ли директория прямым потомком родительской
              if (dirParts.length === parentParts.length + 1 && 
                  dir.startsWith(parentDirPath + '/')) {
                const dirName = dirParts[dirParts.length - 1] || '';
                matchingDirs.push(`../${dirName}/`);
                console.log(`[Автодополнение импортов] Найдена директория в родительской директории: ${dirName}`);
                foundAnyDirs = true;
              }
            }
          }
          
          // Если не найдены никакие директории, логируем информацию для отладки
          if (!foundAnyDirs) {
            console.log(`[Автодополнение импортов] Не найдено поддиректорий в родительской директории ${parentDirPath}`);
            console.log(`[Автодополнение импортов] Всего директорий в кэше: ${normalizedDirs.length}`);
          }
        }
      }
      // Обработка многоуровневых относительных путей
      else if (prefixToUse.includes('../')) {
        console.log(`[Автодополнение импортов] Обработка многоуровневого пути: ${prefixToUse}`);
        
        // Определяем количество переходов на уровень вверх
        const parentMatches = prefixToUse.match(/\.\.\//g);
        const parentCount = parentMatches ? parentMatches.length : 0;
        
        console.log(`[Автодополнение импортов] Обнаружено ${parentCount} переходов вверх`);
        
        // Вычисляем целевую директорию, поднимаясь вверх на нужное количество уровней
        let targetDir = effectiveBasePath;
        for (let i = 0; i < parentCount; i++) {
          const lastSlash = targetDir.lastIndexOf('/');
          if (lastSlash === -1) {
            console.log(`[Автодополнение импортов] Достигнут корень файловой системы`);
            break;
          }
          targetDir = targetDir.substring(0, lastSlash);
        }
        
        console.log(`[Автодополнение импортов] Целевая директория после подъема: ${targetDir}`);
        
        // Получаем остаток пути после последнего '../'
        const restPath = prefixToUse.substring(parentCount * 3);
        console.log(`[Автодополнение импортов] Остаток пути после переходов вверх: "${restPath}"`);
        
        // Если остаток пути содержит слеш, ищем в поддиректории
        if (restPath.includes('/')) {
          const lastSlashIndex = restPath.lastIndexOf('/');
          const subPath = restPath.substring(0, lastSlashIndex);
          const searchPrefix = restPath.substring(lastSlashIndex + 1);
          
          // Полный путь для поиска
          const fullTargetPath = subPath ? `${targetDir}/${subPath}` : targetDir;
          console.log(`[Автодополнение импортов] Полный путь поиска: ${fullTargetPath}, префикс поиска: "${searchPrefix}"`);
          
          // Ищем файлы в целевой директории
          for (const file of normalizedFiles) {
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            if (fileDir === fullTargetPath) {
              const fileName = file.split('/').pop() || '';
              if (searchPrefix === '' || fileName.startsWith(searchPrefix)) {
                // Формируем относительный путь с сохранением точного префикса
                const importPath = `${prefixToUse.substring(0, prefixToUse.lastIndexOf('/') + 1)}${fileName}`;
                matchingFiles.push(importPath);
                console.log(`[Автодополнение импортов] Найден файл: ${fileName}, относительный путь: ${importPath}`);
              }
            }
          }
          
          // Ищем поддиректории в целевой директории
          for (const dir of normalizedDirs) {
            if (dir !== fullTargetPath && dir.startsWith(fullTargetPath + '/')) {
              const dirParts = dir.split('/');
              const targetParts = fullTargetPath.split('/');
              
              // Проверяем, является ли это непосредственным потомком целевой директории
              if (dirParts.length === targetParts.length + 1) {
                const dirName = dirParts[dirParts.length - 1] || '';
                
                if (searchPrefix === '' || dirName.startsWith(searchPrefix)) {
                  // Формируем относительный путь с сохранением точного префикса
                  const importPath = `${prefixToUse.substring(0, prefixToUse.lastIndexOf('/') + 1)}${dirName}/`;
                  matchingDirs.push(importPath);
                  console.log(`[Автодополнение импортов] Найдена директория: ${dirName}, относительный путь: ${importPath}`);
                }
              }
            }
          }
        } 
        // Если после всех '../' нет дополнительного пути
        else {
          // Ищем файлы в целевой директории
          for (const file of normalizedFiles) {
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            if (fileDir === targetDir) {
              const fileName = file.split('/').pop() || '';
              
              if (restPath === '' || fileName.startsWith(restPath)) {
                // Формируем относительный путь с нужным количеством '../'
                const relativePath = `${'../'.repeat(parentCount)}${fileName}`;
                matchingFiles.push(relativePath);
                console.log(`[Автодополнение импортов] Найден файл: ${fileName}, относительный путь: ${relativePath}`);
              }
            }
          }
          
          // Ищем директории в целевой директории
          for (const dir of normalizedDirs) {
            if (dir !== targetDir && dir.startsWith(targetDir + '/')) {
              const dirParts = dir.split('/');
              const targetParts = targetDir.split('/');
              
              // Проверяем, является ли это непосредственным потомком целевой директории
              if (dirParts.length === targetParts.length + 1) {
                const dirName = dirParts[dirParts.length - 1] || '';
                
                if (restPath === '' || dirName.startsWith(restPath)) {
                  // Формируем относительный путь с нужным количеством '../'
                  const relativePath = `${'../'.repeat(parentCount)}${dirName}/`;
                  matchingDirs.push(relativePath);
                  console.log(`[Автодополнение импортов] Найдена директория: ${dirName}, относительный путь: ${relativePath}`);
                }
              }
            }
          }
        }
      }
      // Обработка относительных путей с './path'
      else if (prefixToUse.startsWith('./')) {
        const pathAfterDot = prefixToUse.substring(2);
        
        // Если есть слеш в пути после ./
        if (pathAfterDot.includes('/')) {
          // Находим последний слеш, чтобы определить директорию поиска
          const lastSlashIndex = pathAfterDot.lastIndexOf('/');
          const subDirPath = pathAfterDot.substring(0, lastSlashIndex); // директория для поиска
          const searchPrefix = pathAfterDot.substring(lastSlashIndex + 1); // поисковый префикс
          
          // Полный путь до целевой директории
          const targetDirPath = `${effectiveBasePath}/${subDirPath}`;
          console.log(`[Автодополнение импортов] Ищем в поддиректории: ${targetDirPath}, префикс: ${searchPrefix}`);
          
          // Ищем файлы в этой директории
          for (const file of normalizedFiles) {
            // Получаем директорию файла
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            // Проверяем, находится ли файл в указанной директории и соответствует ли префиксу
            if (fileDir === targetDirPath) {
              const fileName = file.split('/').pop() || '';
              if (searchPrefix === '' || fileName.startsWith(searchPrefix)) {
                const importPath = `./${subDirPath}/${fileName}`;
                matchingFiles.push(importPath);
                console.log(`[Автодополнение импортов] Найден файл в поддиректории: ${fileName}`);
              }
            }
          }
          
          // Ищем поддиректории
          for (const dir of normalizedDirs) {
            if (dir !== targetDirPath && dir.startsWith(targetDirPath + '/')) {
              const dirParts = dir.split('/');
              const targetParts = targetDirPath.split('/');
              
              // Проверяем, является ли директория непосредственным потомком целевой директории
              if (dirParts.length === targetParts.length + 1) {
                const dirName = dirParts[dirParts.length - 1] || '';
                
                if (searchPrefix === '' || dirName.startsWith(searchPrefix)) {
                  const importPath = `./${subDirPath}/${dirName}/`;
                  matchingDirs.push(importPath);
                  console.log(`[Автодополнение импортов] Найдена поддиректория: ${dirName}`);
                }
              }
            }
          }
        }
        // Если нет слеша, значит это ./prefix
        else {
          // Ищем файлы в текущей директории, соответствующие префиксу
          for (const file of normalizedFiles) {
            // Получаем директорию файла
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            // Проверяем, находится ли файл в текущей директории
            if (fileDir === effectiveBasePath) {
              const fileName = file.split('/').pop() || '';
              if (fileName.startsWith(pathAfterDot)) {
                matchingFiles.push(`./${fileName}`);
                console.log(`[Автодополнение импортов] Найден файл в текущей директории: ${fileName}`);
              }
            }
          }
          
          // Находим все поддиректории текущей директории, соответствующие префиксу
          for (const dir of normalizedDirs) {
            if (dir !== effectiveBasePath && dir.startsWith(effectiveBasePath + '/')) {
              const dirParts = dir.split('/');
              const baseParts = effectiveBasePath.split('/');
              
              // Проверяем, является ли директория непосредственным потомком текущей директории
              if (dirParts.length === baseParts.length + 1) {
                const dirName = dirParts[dirParts.length - 1] || '';
                
                if (dirName.startsWith(pathAfterDot)) {
                  matchingDirs.push(`./${dirName}/`);
                  console.log(`[Автодополнение импортов] Найдена поддиректория: ${dirName}`);
                }
              }
            }
          }
        }
      }
    }
    // Обработка абсолютных импортов (начинаются с /)
    else if (isAbsoluteImport) {
      console.log(`[Автодополнение импортов] Обработка абсолютного импорта: ${prefixToUse}`);
      // Получаем корень проекта из кэша
      let rootPath = fileCache[0];
      
      // Используем текущий effectiveBasePath если корневой путь неизвестен
      if (!rootPath && effectiveBasePath) {
        const firstSlash = effectiveBasePath.indexOf('/');
        if (firstSlash !== -1) {
          rootPath = effectiveBasePath.substring(0, firstSlash);
          console.log(`[Автодополнение импортов] Используем корень из текущего пути: ${rootPath}`);
        }
      }
      
      // Если префикс просто /, возвращаем директории корневого уровня
      if (prefixToUse === '/') {
        // Получаем директории только первого уровня
        const rootDirs = new Set<string>();
        
        for (const dir of normalizedDirs) {
          if (dir.startsWith(rootPath)) {
            const relativePath = dir.substring(rootPath.length);
            const firstLevel = relativePath.split('/').filter(p => p !== '')[0];
            if (firstLevel) {
              rootDirs.add(`/${firstLevel}/`);
            }
          }
        }
        
        matchingDirs.push(...Array.from(rootDirs));
      }
      // Если префикс содержит путь после /
      else {
        const pathWithoutSlash = prefixToUse.slice(1); // Убираем начальный /
        
        // Если путь содержит слеш, нужно найти последнюю директорию
        if (pathWithoutSlash.includes('/')) {
          const lastSlashIndex = pathWithoutSlash.lastIndexOf('/');
          const dirPath = pathWithoutSlash.substring(0, lastSlashIndex);
          const searchPrefix = pathWithoutSlash.substring(lastSlashIndex + 1);
          
          const fullPath = `${rootPath}/${dirPath}`;
          
          // Ищем файлы в этой директории
          for (const file of normalizedFiles) {
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            if (fileDir === fullPath) {
              const fileName = file.split('/').pop() || '';
              if (searchPrefix === '' || fileName.startsWith(searchPrefix)) {
                matchingFiles.push(`/${dirPath}/${fileName}`);
              }
            }
          }
          
          // Ищем директории в этой директории
          for (const dir of normalizedDirs) {
            if (dir !== fullPath && dir.startsWith(fullPath + '/')) {
              const dirParts = dir.split('/');
              const fullPathParts = fullPath.split('/');
              
              if (dirParts.length === fullPathParts.length + 1) {
                const dirName = dirParts[dirParts.length - 1] || '';
                if (searchPrefix === '' || dirName.startsWith(searchPrefix)) {
                  matchingDirs.push(`/${dirPath}/${dirName}/`);
                }
              }
            }
          }
        } 
        // Если просто /path без дополнительных слешей
        else {
          // Ищем все директории, которые начинаются с префикса
          for (const dir of normalizedDirs) {
            if (dir.startsWith(rootPath)) {
              const relativePath = dir.substring(rootPath.length);
              const firstLevel = relativePath.split('/').filter(p => p !== '')[0];
              
              if (firstLevel && firstLevel.startsWith(pathWithoutSlash)) {
                matchingDirs.push(`/${firstLevel}/`);
              }
            }
          }
          
          // Ищем все файлы в корне, которые начинаются с префикса
          for (const file of normalizedFiles) {
            const fileDir = file.substring(0, file.lastIndexOf('/'));
            
            if (fileDir === rootPath) {
              const fileName = file.split('/').pop() || '';
              if (fileName.startsWith(pathWithoutSlash)) {
                matchingFiles.push(`/${fileName}`);
              }
            }
          }
        }
      }
    }
    // Поддержка импортов NPM пакетов
    else if (isNpmImport) {
      console.log(`[Автодополнение импортов] Обработка NPM пакета: ${prefixToUse}`);
      
      // Проверяем список NPM пакетов из package.json
      if (npmPackages && npmPackages.length > 0) {
        for (const pkg of npmPackages) {
          if (prefixToUse === '' || pkg.startsWith(prefixToUse)) {
            matchingNpmPackages.push(pkg);
          }
        }
        
        // Если ничего не найдено, добавляем часто используемые пакеты
        if (matchingNpmPackages.length === 0 && prefixToUse === '') {
          const commonPackages = [
            'react', 'react-dom', 'react-router', 'react-router-dom',
            'next', '@next/font', '@next/image',
            'lodash', 'axios', 'moment', 'date-fns',
            'redux', 'react-redux', '@reduxjs/toolkit',
            'styled-components', '@emotion/react', '@emotion/styled',
            'tailwindcss', '@material-ui/core', '@mui/material',
            'framer-motion', 'uuid', 'zod', 'yup'
          ];
          
          matchingNpmPackages.push(...commonPackages);
        }
      } else if (prefixToUse === '') {
        // Если нет NPM пакетов в кэше, но префикс пустой, предлагаем общие пакеты
        matchingNpmPackages.push(
          'react', 'react-dom', 'next', 'lodash', 'axios', 
          'tailwindcss', '@mui/material', 'framer-motion'
        );
      }
    }
    
    // Собираем все результаты: сначала директории, затем NPM пакеты, потом файлы
    const result = [...matchingDirs, ...matchingNpmPackages, ...matchingFiles];
    console.log(`[Автодополнение импортов] Всего найдено ${result.length} совпадений`);
    
    return result;
  } catch (error) {
    console.error('[Автодополнение импортов] Ошибка при поиске автодополнений:', error);
    return [];
  }
}

/**
 * Инициализация кэша файловой системы
 */
async function initCache() {
  console.log('[Автодополнение импортов] Инициализация кэша файловой системы');
  try {
    // Сначала попробуем использовать текущий путь страницы для инициализации
    let currentPath = window.location.pathname || '';
    
    // Для некоторых сред (например, локальной разработки), может потребоваться запрос корня проекта без пути
    if (!currentPath || currentPath === '/' || currentPath === '/index.html') {
      currentPath = '';
      console.log('[Автодополнение импортов] Используем пустой путь для запроса корня проекта');
    }
    
    console.log(`[Автодополнение импортов] Запрашиваем корень проекта с путем: ${currentPath}`);
    const projectRoot = await invoke<string>('fs_get_project_root', { 
      currentFilePath: currentPath 
    });
    
    console.log(`[Автодополнение импортов] Получен корень проекта: ${projectRoot}`);
    
    if (projectRoot) {
      await updateFileCache(projectRoot);
    } else {
      console.error('[Автодополнение импортов] Не удалось получить корень проекта');
    }
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
        // Расширяем список триггеров, чтобы активировать автодополнение в большем количестве случаев
        triggerCharacters: ['/', '\'', '"', '.', '@'],
        
        async provideCompletionItems(model: ITextModel, position: Position, context: CompletionContext, token: CancellationToken): Promise<CompletionList | undefined> {
          try {
            // Проверяем, является ли триггер-символом точка
            const isTriggerDot = context?.triggerCharacter === '.';
            
            // Если символ-триггер - точка, проверяем, находимся ли мы в импорте
            if (isTriggerDot) {
              console.log('[Автодополнение импортов] Триггер - точка');
              
              // Получаем текст до позиции курсора
              const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              });
              
              // Проверяем, содержит ли строка импорт и заканчивается ли на точку
              if (textUntilPosition.includes('import') && textUntilPosition.trim().endsWith('.')) {
                console.log('[Автодополнение импортов] Обнаружена точка в импорте');
                
                // Предлагаем варианты для точки с высоким приоритетом для текущей директории
                const suggestions = [{
                  label: './',
                  kind: monaco.languages.CompletionItemKind.Folder,
                  detail: 'Текущая директория',
                  insertText: './',
                  sortText: '0', // Наивысший приоритет
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endColumn: position.column
                  },
                  command: { // Добавляем команду для немедленного показа следующих подсказок
                    id: 'editor.action.triggerSuggest',
                    title: 'Показать подсказки'
                  }
                }, 
                {
                  label: '../',
                  kind: monaco.languages.CompletionItemKind.Folder,
                  detail: 'Родительская директория',
                  insertText: '../',
                  sortText: '1', // Высокий приоритет, но ниже ./
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endColumn: position.column
                  },
                  command: { // Добавляем команду для немедленного показа следующих подсказок
                    id: 'editor.action.triggerSuggest',
                    title: 'Показать подсказки'
                  }
                }];
                
                return { suggestions };
              }
            }
            
            // Инициализируем кэш файлов при первом вызове
            await initializeFileCache();
            
            // Получаем актуальный путь к текущему файлу
            let filePath = await getCurrentFilePath(monaco, model);
            
            // Проверяем, не является ли путь inmemory путем
            if (filePath.includes('inmemory://')) {
              console.log(`[Автодополнение импортов] Обнаружен inmemory путь: ${filePath}`);
              
              // Ищем реальный файл среди моделей
              const models = monaco.editor.getModels();
              for (const m of models) {
                const modelUri = m.uri.toString();
                if (!modelUri.startsWith('inmemory://') && modelUri.startsWith('file://')) {
                  let realPath = modelUri.substring(7); // Убираем 'file://'
                  realPath = decodeURIComponent(realPath);
                  
                  // Нормализуем для Windows
                  if (navigator.platform.startsWith('Win')) {
                    if (realPath.startsWith('/') && realPath.charAt(2) === ':') {
                      realPath = realPath.substring(1);
                    }
                    realPath = realPath.replace(/\//g, '\\');
                  }
                  
                  console.log(`[Автодополнение импортов] Используем путь из другой модели: ${realPath}`);
                  filePath = realPath;
                  break;
                }
              }
              
              // Если не нашли подходящей модели, запрашиваем инфо от проекта
              if (filePath.includes('inmemory://')) {
                try {
                  const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
                  if (projectRootInfo && projectRootInfo.includes('###')) {
                    const parts = projectRootInfo.split('###');
                    const currentDir = parts.length > 1 ? parts[1] : '';
                    if (currentDir) {
                      console.log(`[Автодополнение импортов] Используем текущую директорию из проекта: ${currentDir}`);
                      filePath = currentDir;
                    }
                  }
                } catch (error) {
                  console.warn(`[Автодополнение импортов] Ошибка при получении пути из проекта:`, error);
                  filePath = './';
                }
              }
            }
            
            console.log(`[Автодополнение импортов] Текущий файл: ${filePath}`);

            // Получаем текущую строку для анализа
            const textUntilPosition = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });

            console.log(`[Автодополнение импортов] Текущая строка: ${textUntilPosition}`);

            // Проверяем, похоже ли это на импорт
            const importMatch = textUntilPosition.match(/import\s+(?:.*\s+from\s+)?['"]([^'"]*)/);
            if (!importMatch) {
              // Пробуем альтернативный шаблон для поддержки случая, когда пользователь набирает '.'
              const dotPattern = /import\s+(?:.*\s+from\s+)?['"](.*?)\./;
              const dotMatch = textUntilPosition.match(dotPattern);
              
              if (dotMatch) {
                const prefix = dotMatch[1] + '.';
                console.log(`[Автодополнение импортов] Обнаружен префикс импорта с точкой: "${prefix}"`);
                
                // Проверяем, не является ли это просто точкой
                if (prefix === '.') {
                  const suggestions = [{
                    label: './',
                    kind: monaco.languages.CompletionItemKind.Folder,
                    detail: 'Текущая директория',
                    insertText: './',
                    sortText: '0', // Наивысший приоритет
                    range: {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: position.column - 1,
                      endColumn: position.column
                    },
                    command: { // Добавляем команду для немедленного показа следующих подсказок
                      id: 'editor.action.triggerSuggest',
                      title: 'Показать подсказки'
                    }
                  }, 
                  {
                    label: '../',
                    kind: monaco.languages.CompletionItemKind.Folder,
                    detail: 'Родительская директория',
                    insertText: '../',
                    sortText: '1', // Высокий приоритет, но ниже ./
                    range: {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: position.column - 1,
                      endColumn: position.column
                    },
                    command: { // Добавляем команду для немедленного показа следующих подсказок
                      id: 'editor.action.triggerSuggest',
                      title: 'Показать подсказки'
                    }
                  }];
                  
                  return { suggestions };
                }
              }
              
              console.log('[Автодополнение импортов] Не обнаружен шаблон импорта');
              return { suggestions: [] };
            }

            // Получаем префикс, который пользователь уже напечатал в кавычках
            const prefix = importMatch[1];
            console.log(`[Автодополнение импортов] Обнаружен префикс импорта: "${prefix}"`);

            // Инициализируем путь к текущему файлу
            let currentFilePath = filePath;

            // Проверяем, что мы смогли получить путь
            if (!currentFilePath) {
              console.log('[Автодополнение импортов] Не удалось получить путь текущего файла, используем ./');
              currentFilePath = './';
            }

            // Вычисляем каталог текущего файла для относительных импортов
            const lastSlashIndex = currentFilePath.lastIndexOf('/');
            let basePath = '';
            
            if (lastSlashIndex !== -1) {
              basePath = currentFilePath.substring(0, lastSlashIndex);
              console.log(`[Автодополнение импортов] Базовый путь (директория текущего файла): ${basePath}`);
            } else {
              // Проверяем также обратный слеш для Windows
              const lastBackslashIndex = currentFilePath.lastIndexOf('\\');
              if (lastBackslashIndex !== -1) {
                basePath = currentFilePath.substring(0, lastBackslashIndex);
                console.log(`[Автодополнение импортов] Базовый путь с обратным слешем: ${basePath}`);
              } else {
                basePath = currentFilePath;
                console.log(`[Автодополнение импортов] Слеш не найден, используется весь путь: ${basePath}`);
              }
            }

            // Проверяем существование базового пути
            try {
              const pathExists = await invoke<boolean>('fs_file_exists', { filePath: basePath });
              if (!pathExists) {
                console.log(`[Автодополнение импортов] Базовый путь не существует: ${basePath}`);
                
                // Пробуем получить директорию из проектной информации
                const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
                if (projectRootInfo && projectRootInfo.includes('###')) {
                  const parts = projectRootInfo.split('###');
                  const currentDir = parts.length > 1 ? parts[1] : '';
                  if (currentDir) {
                    basePath = currentDir;
                    console.log(`[Автодополнение импортов] Используем текущую директорию из проекта: ${basePath}`);
                  }
                }
              }
            } catch (error) {
              console.warn(`[Автодополнение импортов] Ошибка при проверке существования пути: ${error}`);
            }

            // Получаем список автодополнений в зависимости от префикса
            const completions = await getImportPathCompletions(basePath, prefix);
            
            console.log(`[Автодополнение импортов] Найдено ${completions.length} вариантов автодополнения`);

            // Если нет предложений, но это относительный путь, добавляем базовые директории
            if (completions.length === 0 && (prefix === '../' || prefix === './' || prefix === '.')) {
              console.log(`[Автодополнение импортов] Добавляем базовые директории для префикса: ${prefix}`);
              
              if (prefix === './' || prefix === '.') {
                completions.push('./');
                completions.push('../');
              } else if (prefix === '../') {
                completions.push('../');
              }
            }

            // Добавляем автодополнение для пустого префикса или начала импорта
            if (completions.length === 0 && (prefix === '' || prefix === '"' || prefix === "'")) {
              console.log(`[Автодополнение импортов] Добавляем базовые пути для пустого префикса`);
              completions.push('./');
              completions.push('../');
            }

            // Преобразуем в CompletionItem с высоким приоритетом для ./
            const suggestions = completions.map((completion) => {
              const isDirectory = completion.endsWith('/');
              const label = completion;
              
              // Определяем приоритет автодополнения в зависимости от типа пути
              let sortText = '';
              if (completion === './') {
                sortText = '0'; // Наивысший приоритет для ./
              } else if (completion === '../') {
                sortText = '1'; // Второй приоритет для ../
              } else if (isDirectory) {
                sortText = '2' + label; // Третий приоритет для других директорий
              } else {
                sortText = '3' + label; // Последний приоритет для файлов
              }
              
              return {
                label,
                kind: isDirectory 
                  ? monaco.languages.CompletionItemKind.Folder 
                  : monaco.languages.CompletionItemKind.File,
                insertText: completion,
                detail: isDirectory ? 'Директория' : 'Файл',
                sortText: sortText,
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column - prefix.length,
                  endColumn: position.column
                },
                // Добавляем команду автодополнения для директорий
                command: isDirectory ? {
                  id: 'editor.action.triggerSuggest',
                  title: 'Показать подсказки'
                } : undefined
              };
            });

            return { suggestions };
          } catch (error) {
            console.error('[Автодополнение импортов] Ошибка при получении автодополнений:', error);
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

/**
 * Нормализует относительный путь, обрабатывая случаи вроде ./../ и ../../
 * @param path Путь для нормализации
 * @returns Нормализованный путь
 */
function normalizePath(path: string): string {
  // Нормализуем слеши
  let normalized = path.replace(/\\/g, '/');
  
  // Обрабатываем смешанные пути вида ./../
  while (normalized.includes('./../')) {
    normalized = normalized.replace('./../', '../');
  }
  
  // Нормализация не нужна для простых путей
  if (!normalized.includes('../') && !normalized.includes('./')) {
    return normalized;
  }
  
  // Разбиваем путь на компоненты
  const parts = normalized.split('/');
  const result: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '..') {
      if (result.length > 0 && result[result.length - 1] !== '..' && result[result.length - 1] !== '.') {
        result.pop(); // Удаляем предыдущую часть пути
      } else {
        result.push('..'); // Сохраняем .. если нет предыдущих частей или предыдущая часть - ..
      }
    } else if (parts[i] === '.') {
      // Пропускаем одиночные точки, кроме случая начала пути
      if (i === 0 || result.length === 0) {
        result.push('.');
      }
    } else if (parts[i] !== '') {
      result.push(parts[i]);
    } else if (i === 0 || i === parts.length - 1) {
      // Сохраняем начальный и конечный пустые элементы (для абсолютных путей и путей с завершающим слешем)
      result.push('');
    }
  }
  
  return result.join('/');
}

// Добавим функцию для получения актуального пути к файлу
async function getCurrentFilePath(monaco: Monaco, model: ITextModel): Promise<string> {
  const uri = model.uri.toString();
  console.log(`[Автодополнение импортов] URI модели: ${uri}`);
  
  // Если модель не inmemory, используем её
  if (!uri.startsWith('inmemory://')) {
    if (uri.startsWith('file://')) {
      let filePath = uri.substring(7); // Убираем 'file://'
      filePath = decodeURIComponent(filePath);
      
      // Нормализуем путь для Windows
      if (navigator.platform.startsWith('Win')) {
        if (filePath.startsWith('/') && filePath.charAt(2) === ':') {
          filePath = filePath.substring(1); // Удаляем начальный слэш для путей типа /C:/...
        }
        filePath = filePath.replace(/\//g, '\\');
      }
      
      console.log(`[Автодополнение импортов] Используем URI модели как путь: ${filePath}`);
      return filePath;
    }
  }
  
  // Если текущая модель - inmemory, ищем другие активные модели
  const models = monaco.editor.getModels();
  console.log(`[Автодополнение импортов] Найдено ${models.length} активных моделей`);
  
  // Ищем модель, которая не является inmemory
  for (const m of models) {
    const modelUri = m.uri.toString();
    if (!modelUri.startsWith('inmemory://') && modelUri.startsWith('file://')) {
      console.log(`[Автодополнение импортов] Найдена реальная модель файла: ${modelUri}`);
      
      // Преобразуем URI в путь
      let filePath = modelUri.substring(7); // Убираем 'file://'
      filePath = decodeURIComponent(filePath);
      
      // Нормализуем путь для Windows
      if (navigator.platform.startsWith('Win')) {
        if (filePath.startsWith('/') && filePath.charAt(2) === ':') {
          filePath = filePath.substring(1); // Удаляем начальный слэш для путей типа /C:/...
        }
        filePath = filePath.replace(/\//g, '\\');
      }
      
      console.log(`[Автодополнение импортов] Используем путь из другой модели: ${filePath}`);
      return filePath;
    }
  }
  
  // Если не нашли подходящих моделей, пытаемся получить информацию от бэкенда
  try {
    const editorInfo = await invoke<any>('editor_get_current_file_path', {});
    console.log(`[Автодополнение импортов] Информация о текущем редакторе:`, editorInfo);
    
    if (editorInfo && editorInfo.filePath) {
      // Если получили директорию, а не файл, пробуем найти /src
      if (editorInfo.isDirectory) {
        console.log(`[Автодополнение импортов] Получена директория из редактора: ${editorInfo.filePath}`);
        
        // Проверяем, существует ли директория src
        const srcDir = `${editorInfo.filePath}/src`;
        try {
          const srcExists = await invoke<boolean>('fs_file_exists', { filePath: srcDir });
          if (srcExists) {
            console.log(`[Автодополнение импортов] Используем директорию src: ${srcDir}`);
            return srcDir;
          }
        } catch (error) {
          console.warn(`[Автодополнение импортов] Ошибка при проверке директории src:`, error);
        }
      }
      
      console.log(`[Автодополнение импортов] Используем путь из редактора: ${editorInfo.filePath}`);
      return editorInfo.filePath;
    }
  } catch (error) {
    console.warn(`[Автодополнение импортов] Ошибка при получении информации от редактора:`, error);
  }
  
  // Если всё ещё не удалось получить путь, запрашиваем корень проекта
  try {
    const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
    console.log(`[Автодополнение импортов] Информация о проекте: ${projectRootInfo}`);
    
    if (projectRootInfo && projectRootInfo.includes('###')) {
      const parts = projectRootInfo.split('###');
      const rootDir = parts[0];
      const currentDir = parts.length > 1 ? parts[1] : '';
      
      // Проверяем наличие директории /src в корне проекта
      const srcDir = `${rootDir}/src`;
      try {
        const srcExists = await invoke<boolean>('fs_file_exists', { filePath: srcDir });
        if (srcExists) {
          console.log(`[Автодополнение импортов] Используем директорию src из корня проекта: ${srcDir}`);
          return srcDir;
        }
      } catch (error) {
        console.warn(`[Автодополнение импортов] Ошибка при проверке директории src в корне проекта:`, error);
      }
      
      if (currentDir) {
        console.log(`[Автодополнение импортов] Используем текущую директорию из проекта: ${currentDir}`);
        return currentDir;
      }
      
      console.log(`[Автодополнение импортов] Используем корень проекта: ${rootDir}`);
      return rootDir;
    }
  } catch (error) {
    console.warn(`[Автодополнение импортов] Ошибка при получении корня проекта:`, error);
  }
  
  // Если ничего не сработало, возвращаем ./
  console.log(`[Автодополнение импортов] Не удалось определить путь к файлу, используем ./`);
  return './';
}

// Обновление функции initializeFileCache
async function initializeFileCache() {
  try {
    if (fileCache.length > 0) {
      console.log('[Автодополнение импортов] Использую существующий кэш файлов');
      return;
    }
    
    // Получаем информацию о текущем проекте
    const projectRoot = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
    console.log(`[Автодополнение импортов] Корень проекта: ${projectRoot}`);
    
    if (!projectRoot) {
      console.warn('[Автодополнение импортов] Не удалось определить корень проекта');
      return;
    }
    
    await updateFileCache(projectRoot);
    console.log(`[Автодополнение импортов] Кэш файлов инициализирован, найдено ${fileCache.length} файлов`);
  } catch (error) {
    console.error(`[Автодополнение импортов] Ошибка при инициализации кэша файлов: ${error}`);
  }
}

/**
 * Функция для нахождения реального пути к файлу среди моделей Monaco
 * Используется для работы с относительными импортами при наличии inmemory моделей
 */
async function findActualFilePath(monaco: Monaco): Promise<string> {
  // Получаем все активные модели
  const models = monaco.editor.getModels();
  console.log(`[Автодополнение импортов] Найдено ${models.length} активных моделей`);
  
  // Ищем первую модель, которая не является inmemory
  for (const model of models) {
    const uri = model.uri.toString();
    if (!uri.startsWith('inmemory://') && uri.startsWith('file://')) {
      // Преобразуем URI в путь
      let filePath = uri.substring(7); // Убираем 'file://'
      filePath = decodeURIComponent(filePath); // Декодируем URL-encoded символы
      
      // Нормализуем путь для Windows
      if (navigator.platform.startsWith('Win')) {
        if (filePath.startsWith('/') && filePath.charAt(2) === ':') {
          filePath = filePath.substring(1); // Удаляем начальный слэш для путей типа /C:/...
        }
        filePath = filePath.replace(/\//g, '\\');
      }
      
      console.log(`[Автодополнение импортов] Найден реальный файл из активной модели: ${filePath}`);
      return filePath;
    }
  }
  
  // Если не нашли файл, запрашиваем информацию у редактора
  try {
    const editorInfo = await invoke<any>('editor_get_current_file_path', {});
    if (editorInfo && editorInfo.filePath) {
      const filePath = editorInfo.filePath;
      
      // Если это директория, проверяем наличие src поддиректории
      if (editorInfo.isDirectory) {
        const srcDir = `${filePath}/src`;
        try {
          const srcExists = await invoke<boolean>('fs_file_exists', { filePath: srcDir });
          if (srcExists) {
            console.log(`[Автодополнение импортов] Используем директорию src из редактора: ${srcDir}`);
            return srcDir;
          }
        } catch (error) {
          console.warn(`[Автодополнение импортов] Ошибка при проверке директории src:`, error);
        }
      }
      
      console.log(`[Автодополнение импортов] Используем путь из редактора: ${filePath}`);
      return filePath;
    }
  } catch (error) {
    console.warn(`[Автодополнение импортов] Ошибка при получении пути из редактора:`, error);
  }
  
  // Если ничего не помогло, запрашиваем корень проекта
  try {
    const projectRootInfo = await invoke<string>('fs_get_project_root', { currentFilePath: '' });
    if (projectRootInfo && projectRootInfo.includes('###')) {
      const parts = projectRootInfo.split('###');
      const rootDir = parts[0];
      const currentDir = parts.length > 1 ? parts[1] : '';
      
      // Приоритет: текущая директория -> src директория -> корень проекта
      if (currentDir) {
        console.log(`[Автодополнение импортов] Используем текущую директорию из проекта: ${currentDir}`);
        return currentDir;
      }
      
      const srcDir = `${rootDir}/src`;
      try {
        const srcExists = await invoke<boolean>('fs_file_exists', { filePath: srcDir });
        if (srcExists) {
          console.log(`[Автодополнение импортов] Используем директорию src из корня проекта: ${srcDir}`);
          return srcDir;
        }
      } catch (error) {
        console.warn(`[Автодополнение импортов] Ошибка при проверке директории src:`, error);
      }
      
      console.log(`[Автодополнение импортов] Используем корень проекта: ${rootDir}`);
      return rootDir;
    }
  } catch (error) {
    console.warn(`[Автодополнение импортов] Ошибка при получении корня проекта:`, error);
  }
  
  // Если всё ещё не нашли путь, возвращаем ./
  console.log(`[Автодополнение импортов] Не удалось найти реальный путь к файлу, используем ./`);
  return './';
} 