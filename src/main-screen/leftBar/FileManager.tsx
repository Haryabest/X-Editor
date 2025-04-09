import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon, FolderIcon } from './fileIcons';
import { FolderPlusIcon } from "@heroicons/react/24/outline";
import { ChevronRight, ChevronDown, FolderOpen, FilePlus, RefreshCcw } from 'lucide-react';

import FileContextMenu from './context/FileContextMenu';
import FolderContextMenu from './context/FolderContextMenu';
import InlineRenameInput from './InlineRenameInput';

import "./style.css";

interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
  expanded?: boolean;
  loaded?: boolean;
  icon?: React.ReactNode;
  gitStatus?: string;
  hasChanges?: boolean;
  changesCount?: number;
  fileIssue?: {
    errors: number;
    warnings: number;
  };
}

interface DirEntry {
  path: string;
  isDir: boolean;
}

interface GitChange {
  status: string;
  path: string;
}

interface FileManagerProps {
  selectedFolder: string | null;
  setSelectedFolder: (path: string | null) => void;
  setSelectedFile: (filePath: string | null) => void;
  setCurrentFiles: (files: FileItem[]) => void;
  setLastOpenedFolder?: (path: string) => void;
  selectedFile?: string | null;
  gitChanges?: GitChange[];
  fileIssues?: { 
    [filePath: string]: { 
      errors: number;
      warnings: number;
    }
  };
}

const FileManager: React.FC<FileManagerProps> = ({ 
  selectedFolder, 
  setSelectedFile, 
  setCurrentFiles, 
  setLastOpenedFolder,
  setSelectedFolder,
  selectedFile,
  gitChanges = [],
  fileIssues = {}
}) => {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, string>>(new Map());
  const [directoryChangesMap, setDirectoryChangesMap] = useState<Map<string, number>>(new Map());
  const [renamingItem, setRenamingItem] = useState<{
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [creatingItem, setCreatingItem] = useState<{
    parentPath: string;
    isDirectory: boolean;
  } | null>(null);
  
  // Add a ref for the creating input
  const createInputRef = useRef<HTMLInputElement>(null);
  
  // Effect to focus input whenever creatingItem changes
  useEffect(() => {
    if (creatingItem && createInputRef.current) {
      setTimeout(() => {
        if (createInputRef.current) {
          createInputRef.current.focus();
        }
      }, 50);
    }
  }, [creatingItem]);

  const prepareGitStatusMap = (changes: GitChange[]) => {
    const newStatusMap = new Map<string, string>();
    const dirChangesMap = new Map<string, number>();
    
    changes.forEach(change => {
      newStatusMap.set(change.path, change.status);
      
      let pathParts = change.path.split('/');
      let dirPath = '';
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        dirPath = dirPath ? `${dirPath}/${pathParts[i]}` : pathParts[i];
        
        const currentCount = dirChangesMap.get(dirPath) || 0;
        dirChangesMap.set(dirPath, currentCount + 1);
      }
    });
    
    setGitStatusMap(newStatusMap);
    setDirectoryChangesMap(dirChangesMap);
  };

  const processTree = (tree: FileItem): FileItem => {
    const gitStatus = gitStatusMap.get(tree.path);
    const changesCount = directoryChangesMap.get(tree.path) || 0;
    
    return {
      ...tree,
      expanded: false,
      loaded: !!tree.children,
      gitStatus,
      hasChanges: !!gitStatus || changesCount > 0,
      changesCount,
      children: tree.children?.map(child => processTree(child))
    };
  };

  useEffect(() => {
    if (gitChanges && gitChanges.length > 0) {
      prepareGitStatusMap(gitChanges);
    } else {
      setGitStatusMap(new Map());
      setDirectoryChangesMap(new Map());
    }
  }, [gitChanges]);

  useEffect(() => {
    if (fileTree.length > 0 && (gitStatusMap.size > 0 || directoryChangesMap.size > 0)) {
      setFileTree(prevTree => {
        const updatedTree = prevTree.map(item => ({
          ...item,
          gitStatus: gitStatusMap.get(item.path),
          hasChanges: !!gitStatusMap.get(item.path) || (directoryChangesMap.get(item.path) || 0) > 0,
          changesCount: directoryChangesMap.get(item.path) || 0,
          children: item.children?.map(child => processTree(child))
        }));
        
        return updatedTree;
      });
    }
  }, [gitStatusMap, directoryChangesMap]);

  // Добавим флаг для отслеживания первого рендера, чтобы избежать цикла обновлений
  const isFirstRender = useRef(true);
  
  // Add a separate effect to update visible items whenever fileTree changes
  useEffect(() => {
    // Избегаем обновления при первом рендеринге или когда дерево пустое
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (fileTree.length > 0) {
      console.log("Обновление видимых элементов...");
      updateVisibleItems(fileTree);
    }
  }, [fileTree]);

  // Собираем видимые элементы из текущего дерева
  const collectVisibleItems = (items: FileItem[]): FileItem[] => {
    let visible: FileItem[] = [];
    
    items.forEach(item => {
      const gitStatus = gitStatusMap.get(item.path);
      const fileIssue = fileIssues[item.path];
      
      const processedItem = {
        ...item,
        icon: !item.is_directory ? getFileIcon(item.name) : undefined,
        gitStatus,
        hasChanges: !!gitStatus,
        fileIssue
      };
      
      if (!item.is_directory) {
        visible.push(processedItem);
      }
      
      if (item.children && item.expanded) {
        const childItems = collectVisibleItems(item.children);
        visible = [...visible, ...childItems];
      }
    });
    
    return visible;
  };

  // Обновляем состояние
  const updateVisibleItems = (tree: FileItem[]) => {
    const items = collectVisibleItems(tree);
    setCurrentFiles(items);
  };

  useEffect(() => {
    const loadTree = async () => {
      if (selectedFolder) {
        try {
          // Mark the root folder as expanded
          updateExpandedPaths(selectedFolder, true);
          
          // Загружаем дерево для отображения в интерфейсе
          const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
          
          // Process the tree with our expanded paths
          const processedTree = processTreeWithExpandedPaths(tree);
          
          // Always ensure the root is expanded
          processedTree.expanded = true;
          processedTree.loaded = true;
          
          setFileTree([processedTree]);
          
          console.log('Дерево файлов успешно загружено');
        } catch (error) {
          console.error('Error loading directory:', error);
          alert(`Failed to load directory: ${error}`);
        }
      } else {
        setFileTree([]);
        setCurrentFiles([]);
      }
    };
    loadTree();
  }, [selectedFolder]);

  useEffect(() => {
    const loadInitialFolder = async () => {
      try {
        const args = await invoke<string[]>("get_args");
        const pathIndex = args.findIndex(arg => arg === "--path");
        if (pathIndex !== -1 && args.length > pathIndex + 1) {
          const folderPath = args[pathIndex + 1];
          setSelectedFolder(folderPath);
          if (setLastOpenedFolder) {
            setLastOpenedFolder(folderPath);
          }
        }
      } catch (error) {
        console.error('Error loading initial folder:', error);
      }
    };
    loadInitialFolder();
  }, [setSelectedFolder, setLastOpenedFolder]);

  // Create a persistent tracking of expanded paths across refreshes
  const expandedPathsRef = useRef<Set<string>>(new Set());
  
  // Функция для нормализации путей
  const normalizePath = (path: string): string => {
    // Преобразуем все слеши в обратные для Windows
    return path.replace(/\//g, '\\');
  };
  
  // Function to explicitly track expanded state across tree updates
  const updateExpandedPaths = (path: string, isExpanded: boolean) => {
    // Normalize path for storage
    const normalizedPath = normalizePath(path);
    
    if (isExpanded) {
      expandedPathsRef.current.add(normalizedPath);
      console.log(`Path added to expanded set: ${normalizedPath}`);
    } else {
      expandedPathsRef.current.delete(normalizedPath);
      console.log(`Path removed from expanded set: ${normalizedPath}`);
    }
  };
  
  // Function to find an item in the tree by path
  const findItem = (items: FileItem[], path: string): FileItem | null => {
    // Normalize the search path
    const normalizedSearchPath = normalizePath(path);
    
    for (const item of items) {
      // Normalize the item path for comparison
      const normalizedItemPath = normalizePath(item.path);
      
      if (normalizedItemPath === normalizedSearchPath) {
        return item;
      }
      if (item.children && item.children.length) {
        const found = findItem(item.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const toggleDirectory = async (item: FileItem) => {
    if (item.is_directory && !item.loaded) {
      try {
        // Запрашиваем содержимое директории
        const result = await invoke<FileItem>("get_subdirectory", { path: item.path });
        
        // Mark as expanded in our persistent tracker
        updateExpandedPaths(item.path, true);
        
        // Обрабатываем результат, сохраняя развернутый статус
        const processedResult = {
          ...result,
          expanded: true,
          loaded: true,
          children: result.children?.map(child => ({
            ...child,
            expanded: expandedPathsRef.current.has(child.path),
            loaded: child.children !== undefined
          }))
        };
        
        // Обновляем конкретную часть дерева
        setFileTree(prev => {
          const updatedTree = prev.map(root => updateTree([root], item.path, processedResult)[0]);
          console.log("Directory expanded with contents:", item.path);
          return updatedTree;
        });
      } catch (error) {
        console.error('Error loading subdirectory:', error);
      }
    } else {
      // Track the expanded state change
      const newExpandedState = !item.expanded;
      updateExpandedPaths(item.path, newExpandedState);
      
      console.log(`Toggling directory: ${item.path} to ${newExpandedState ? 'expanded' : 'collapsed'}`);
      
      // Просто переключаем видимость дочерних элементов
      setFileTree(prev => {
        const updatedTree = prev.map(root => ({
          ...root,
          expanded: root.path === item.path ? newExpandedState : root.expanded,
          children: root.children ? toggleExpandedWithState(root.children, item.path, newExpandedState) : undefined,
        }));
        
        return updatedTree;
      });
    }
  };

  // Modified function that allows explicit state setting instead of toggling
  const toggleExpandedWithState = (items: FileItem[], path: string, newState?: boolean): FileItem[] => {
    return items.map((item) => {
      if (item.path === path) {
        // Use the provided state or toggle if not provided
        const newExpandedState = newState !== undefined ? newState : !item.expanded;
        return { ...item, expanded: newExpandedState };
      }
      if (item.children) {
        return { ...item, children: toggleExpandedWithState(item.children, path, newState) };
      }
      return item;
    });
  };

  const updateTree = (items: FileItem[], path: string, newItem: FileItem): FileItem[] => {
    return items.map((item) => {
      if (item.path === path) {
        return { ...newItem, expanded: true, loaded: true };
      }
      if (item.children) {
        return { ...item, children: updateTree(item.children, path, newItem) };
      }
      return item;
    });
  };

  // Update processTreeWithExpandedPaths for path normalization
  const processTreeWithExpandedPaths = (item: FileItem): FileItem => {
    // Normalize the path for comparison
    const normalizedPath = normalizePath(item.path);
    const shouldExpand = expandedPathsRef.current.has(normalizedPath);
    
    if (shouldExpand && item.is_directory) {
      console.log(`Setting path as expanded in tree: ${item.path} (normalized: ${normalizedPath})`);
    }
    
    return {
      ...item,
      expanded: shouldExpand,
      loaded: item.loaded || shouldExpand,
      children: item.children?.map(processTreeWithExpandedPaths)
    };
  };

  // Совершенно новый подход к созданию файлов/папок (как в VS Code)
  const handleCreateSubmit = async (name: string) => {
    if (!creatingItem || !name.trim()) return;
    
    try {
      const { parentPath, isDirectory } = creatingItem;
      // Используем обратные слеши для Windows
      const newPath = `${parentPath}\\${name}`;
      
      console.log(`Создание ${isDirectory ? 'папки' : 'файла'}: ${newPath}`);
      
      // Создаем файл или папку
      if (isDirectory) {
        await invoke("create_folder", { path: newPath });
        console.log(`Папка создана: ${newPath}`);
      } else {
        await invoke("create_file", { path: newPath });
        console.log(`Файл создан: ${newPath}`);
      }
      
      // Сначала находим родительский элемент в текущем дереве
      const findAndUpdateParent = (items: FileItem[]): FileItem[] => {
        return items.map(item => {
          // Если это родительский элемент
          if (item.path === parentPath) {
            console.log(`Найден родительский элемент: ${item.path}`);
            
            // Создаем новый дочерний элемент
            const newItem: FileItem = {
              name: name,
              is_directory: isDirectory,
              path: newPath,
              expanded: isDirectory, // Новая папка сразу раскрыта
              loaded: isDirectory, // Новая папка считается загруженной
              children: isDirectory ? [] : undefined // Для директории - пустой массив детей
            };
            
            // Клонируем существующие дочерние элементы и добавляем новый
            const updatedChildren = [...(item.children || []), newItem];
            
            // Сортируем: сначала директории, потом файлы, внутри групп - по алфавиту
            updatedChildren.sort((a, b) => {
              if (a.is_directory && !b.is_directory) return -1;
              if (!a.is_directory && b.is_directory) return 1;
              return a.name.localeCompare(b.name);
            });
            
            // Возвращаем обновленный элемент с новыми детьми и гарантированно раскрытый
            return {
              ...item,
              expanded: true, // Гарантируем, что родитель раскрыт
              loaded: true,
              children: updatedChildren
            };
          }
          
          // Если у текущего элемента есть дети, рекурсивно ищем среди них
          if (item.children) {
            return {
              ...item,
              children: findAndUpdateParent(item.children)
            };
          }
          
          // Если не нашли, возвращаем элемент как есть
          return item;
        });
      };
      
      // Обновляем дерево файлов, добавляя новый элемент к родителю
      setFileTree(prevTree => {
        const updatedTree = findAndUpdateParent(prevTree);
        return updatedTree;
      });
      
      // Очищаем состояние создания
      setCreatingItem(null);
      
      // Если создан файл, выбираем его
      if (!isDirectory) {
        setSelectedFile(newPath);
      }
      
      console.log("Дерево файлов успешно обновлено (в стиле VS Code)");
      } catch (error) {
      console.error(`Ошибка при создании ${creatingItem.isDirectory ? 'папки' : 'файла'}:`, error);
      alert(`Не удалось создать: ${error}`);
      setCreatingItem(null);
    }
  };
  
  // Function to handle creating input key events
  const handleCreateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const inputValue = e.currentTarget.value;
      if (inputValue && inputValue.trim()) {
        handleCreateSubmit(inputValue.trim());
      } else {
        setCreatingItem(null);
      }
    } else if (e.key === 'Escape') {
      setCreatingItem(null);
    }
  };

  // Function to handle creating input blur
  const handleCreateInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Получаем значение поля ввода
    const inputValue = e.currentTarget.value;
    
    // Проверяем блюр не происходит в процессе выполнения handleCreateSubmit
    if (inputValue && inputValue.trim()) {
      // Используем setTimeout, чтобы дать возможность другим обработчикам выполниться
      setTimeout(() => {
        // Если creatingItem все еще существует, вызываем handleCreateSubmit
        if (creatingItem) {
          handleCreateSubmit(inputValue.trim());
        }
      }, 0);
    } else {
      setCreatingItem(null);
    }
  };

  // Replace the SimpleFileInput component with a direct rendering approach
  const renderCreatingInput = (isDirectory: boolean) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '5px' }}>
        <span className="icon" style={{ marginRight: '5px' }}>
          {isDirectory ? (
            <FolderIcon width={14} height={14} />
          ) : (
            getFileIcon(createInputRef.current?.value || "")
          )}
        </span>
        <input
          ref={createInputRef}
          type="text"
          className="inline-rename-input"
          onKeyDown={handleCreateInputKeyDown}
          onBlur={handleCreateInputBlur}
          autoFocus
        />
      </div>
    );
  };

  // Function to ensure that a directory is expanded
  const ensureDirectoryExpanded = async (path: string) => {
    const normalizedPath = normalizePath(path);
    console.log(`Раскрытие директории: ${path} (нормализовано: ${normalizedPath})`);
    
    // Ищем элемент в дереве
    const findItemByNormalizedPath = (items: FileItem[], normalizedSearchPath: string): FileItem | null => {
      for (const item of items) {
        const itemNormPath = normalizePath(item.path);
        if (itemNormPath === normalizedSearchPath) {
          return item;
        }
        if (item.children && item.children.length) {
          const found = findItemByNormalizedPath(item.children, normalizedSearchPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Ищем элемент по нормализованному пути
    const item = findItemByNormalizedPath(fileTree, normalizedPath);
    
    if (item && item.is_directory && !item.expanded) {
      console.log(`Найдена директория ${path}, раскрываем её`);
      await toggleDirectory(item);
      
      // Wait a moment for the state to update
      return new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
    } else {
      if (item && item.expanded) {
        console.log(`Директория ${path} уже раскрыта`);
      } else if (!item) {
        console.log(`Директория ${path} не найдена в дереве`);
      }
    }
  };
  
  // Handler for context menu create actions
  const handleContextCreateDirectory = async (path: string) => {
    // Close the context menu immediately
    setContextMenu(null);
    
    // Use setTimeout to avoid state updates during render
    setTimeout(async () => {
      // Normalize the path for consistent comparison
      const normalizedPath = normalizePath(path);
      console.log(`Создание папки в директории: ${path} (нормализовано: ${normalizedPath})`);
      
      // Expand the directory if it's not already expanded
      await ensureDirectoryExpanded(path);
      
      // Set creating state
      setCreatingItem({
        parentPath: path,
        isDirectory: true
      });
    }, 0);
  };
  
  const handleContextCreateFile = async (path: string) => {
    // Close the context menu immediately
    setContextMenu(null);
    
    // Use setTimeout to avoid state updates during render
    setTimeout(async () => {
      // Normalize the path for consistent comparison
      const normalizedPath = normalizePath(path);
      console.log(`Создание файла в директории: ${path} (нормализовано: ${normalizedPath})`);
      
      // Expand the directory if it's not already expanded
      await ensureDirectoryExpanded(path);
      
      // Set creating state
      setCreatingItem({
        parentPath: path,
        isDirectory: false
      });
    }, 0);
  };

  const handleCreateCancel = () => {
    setCreatingItem(null);
  };

  const handleFileClick = (path: string, isDirectory: boolean) => {
    console.log(`Клик по ${isDirectory ? 'директории' : 'файлу'}: ${path}`);
    
    // Для директорий добавляем функциональность выбора (для горячих клавиш)
    if (isDirectory) {
      // Если это клик по директории, также выбираем её, но не открываем файл
      setSelectedFile(path);
    } else {
      // Для файлов обычное поведение
      setSelectedFile(path);
    }
    
    // Устанавливаем фокус на файловый менеджер после клика
    if (fileManagerRef.current) {
      fileManagerRef.current.focus();
    }
  };

  const getGitStatusClass = (item: FileItem): string => {
    if (item.gitStatus) {
      const status = item.gitStatus.charAt(0);
      
      switch (status) {
        case 'M': return 'modified';
        case 'A': return 'added';
        case 'D': return 'deleted';
        case '?': return 'untracked';
        case 'R': return 'renamed';
        default: return '';
      }
    }
    
    if (item.is_directory && item.changesCount && item.changesCount > 0) {
      return 'modified';
    }
    
    return '';
  };

  const getIssueClass = (path: string): string => {
    const issue = fileIssues[path];
    if (issue) {
      if (issue.errors > 0) return 'error';
      if (issue.warnings > 0) return 'warning';
    }
    return '';
  };

  const handleRefresh = async () => {
    if (selectedFolder) {
      try {
        console.log("Refreshing file tree");
        console.log("Currently expanded paths:", [...expandedPathsRef.current]);
        
        // Перезагружаем дерево файлов
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Process the tree with our expanded paths
        const processedTree = processTreeWithExpandedPaths(tree);
        
        // Always ensure the root is expanded
        processedTree.expanded = true;
        processedTree.loaded = true;
        
        setFileTree([processedTree]);
        updateVisibleItems([processedTree]);
        
        console.log('Дерево файлов успешно обновлено');
      } catch (error) {
        console.error('Ошибка при обновлении:', error);
      }
    }
  };

  const deleteFile = async (path: string) => {
    // Определяем, является ли путь директорией
    const isDirectory = fileTree.some(item => 
      item.path === path && item.is_directory || 
      (item.children && item.children.some(child => child.path === path && child.is_directory))
    );
    
    const fileName = path.split(/[\/\\]/).pop();
    const confirmMessage = isDirectory
      ? `Вы уверены, что хотите удалить директорию "${fileName}" и все её содержимое?`
      : `Вы уверены, что хотите удалить файл "${fileName}"?`;
      
    const confirmDelete = window.confirm(confirmMessage);
    
    if (confirmDelete) {
      try {
        // Находим родительский путь
        const pathParts = path.split(/[\/\\]/);
        pathParts.pop(); // Удаляем последний элемент (имя файла/папки)
        const parentPath = pathParts.join('\\');
        
        console.log(`Удаление ${isDirectory ? 'папки' : 'файла'}: ${path}`);
        console.log(`Родительский путь: ${parentPath}`);
        
        // Удаляем файл или директорию через API
        await invoke("delete_file", { path });
        console.log(`${isDirectory ? 'Директория' : 'Файл'} удален: ${path}`);
        
        // Если удаленный файл был выбран, снимаем выбор
        if (selectedFile === path) {
          setSelectedFile(null);
        }
        
        // Обновляем дерево файлов, удаляя элемент из родителя
        setFileTree(prevTree => {
          // Находим и обновляем родительский элемент
          const findAndUpdateParent = (items: FileItem[]): FileItem[] => {
            return items.map(item => {
              // Если это родительский элемент
              if (item.path === parentPath) {
                console.log(`Найден родительский элемент: ${item.path}`);
                
                // Фильтруем дочерние элементы, удаляя целевой
                const updatedChildren = item.children?.filter(child => child.path !== path) || [];
                
                // Возвращаем обновленный элемент без удаленного дочернего элемента
                return {
                  ...item,
                  children: updatedChildren
                };
              }
              
              // Если у текущего элемента есть дети, рекурсивно ищем среди них
              if (item.children) {
                return {
                  ...item,
                  children: findAndUpdateParent(item.children)
                };
              }
              
              // Если не нашли, возвращаем элемент как есть
              return item;
            });
          };
          
          // Обрабатываем дерево
          const updatedTree = findAndUpdateParent(prevTree);
          console.log("Дерево файлов обновлено после удаления (в стиле VS Code)");
          return updatedTree;
        });
      } catch (error) {
        console.error('Ошибка при удалении:', error);
        alert(`Не удалось удалить: ${error}`);
      }
    }
  };

  const handleRenameFile = (path: string) => {
    const isDir = fileTree.some(item => 
      item.path === path || 
      (item.children && item.children.some(child => child.path === path && child.is_directory))
    );
    
    setRenamingItem({
      path,
      isDirectory: isDir
    });
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renamingItem) return;
    
    try {
      const oldPath = renamingItem.path;
      const pathParts = oldPath.split(/[\/\\]/);
      pathParts.pop(); // Удаляем последний элемент (имя файла)
      
      const newPath = [...pathParts, newName].join('/');
      
      console.log(`Переименование: ${oldPath} -> ${newPath}`);
      
      // Вызываем backend функцию для переименования
      await invoke('rename_file', { oldPath, newPath });
      
      // Сохраняем состояние развернутых директорий
      const expandedPaths = getExpandedPaths(fileTree);
      
      // Обновляем дерево файлов, начиная с корня выбранной директории
      if (selectedFolder) {
        // Полностью обновляем все дерево файлов
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Обрабатываем дерево и восстанавливаем состояние развернутых директорий
        const processedTree = {
          ...tree,
          expanded: true,
          loaded: true,
          children: tree.children?.map(child => processChildWithExpanded(child, expandedPaths))
        };
        
        setFileTree([processedTree]);
        updateVisibleItems([processedTree]);
        
        // Если переименовываемый файл был выбран, обновляем выбранный файл
        if (selectedFile === oldPath) {
          setSelectedFile(newPath);
        }
      }
    } catch (error) {
      console.error('Error renaming file:', error);
      alert(`Failed to rename: ${error}`);
    } finally {
      setRenamingItem(null);
    }
  };
  
  // Enhanced function to get all expanded paths
  const getExpandedPaths = (tree: FileItem[]): Set<string> => {
    const expandedPaths = new Set<string>();
    
    const traverse = (item: FileItem) => {
      // Check if the item has a path and is expanded
      if (item.path && (item.expanded || expandedPathsRef.current.has(item.path))) {
        console.log(`Adding expanded path: ${item.path}`);
        expandedPaths.add(item.path);
      }
      
      // Recursively process children
      if (item.children && item.children.length > 0) {
        item.children.forEach(traverse);
      }
    };
    
    tree.forEach(traverse);
    return expandedPaths;
  };
  
  // Improved function to process a child with expanded state
  const processChildWithExpanded = (item: FileItem, expandedPaths: Set<string>): FileItem => {
    // Check if this item should be expanded
    const isForceExpand = item.path && expandedPaths.has(item.path);
    const isExpanded = Boolean(item.path && (expandedPaths.has(item.path) || isForceExpand));
    
    if (isForceExpand) {
      console.log(`Force expanding in processChild: ${item.path}`);
    }
    
    // If this is a newly created directory, ensure it's loaded
    const isLoaded = Boolean(item.loaded || isExpanded);
    
    return {
      ...item,
      expanded: isExpanded,
      loaded: isLoaded,
      children: item.children?.map(child => processChildWithExpanded(child, expandedPaths))
    };
  };

  const handleRenameCancel = () => {
    setRenamingItem(null);
  };

  // Обработчик для установки пути в терминале
  const handleSetTerminalPath = (path: string) => {
    // Эмитим событие для установки пути в терминале
    window.dispatchEvent(new CustomEvent('set-terminal-path', { detail: { path } }));
  };

  const renderTree = (items: FileItem[]) => (
    <ul className="file-tree">
      {items.map((item) => {
        const gitStatusClass = getGitStatusClass(item);
        const issueClass = getIssueClass(item.path);
        const isActive = selectedFile === item.path;
        
        return (
          <li
            key={item.path}
            className="tree-item"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                path: item.path,
                isDirectory: item.is_directory,
              });
            }}
          >
            {item.is_directory ? (
              <div className="directory">
                <div
                  onClick={(e) => {
                    // Если клик по иконке или шеврону, раскрываем/закрываем директорию
                    if (
                      e.target instanceof Element && 
                      (e.target.closest('.chevron') || e.target.closest('.icon'))
                    ) {
                      toggleDirectory(item);
                    } else {
                      // Иначе помечаем директорию как выбранную (для горячих клавиш)
                      handleFileClick(item.path, true);
                    }
                  }}
                  className={`directory-item ${gitStatusClass} ${isActive ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="chevron" onClick={(e) => {
                    e.stopPropagation();
                    toggleDirectory(item);
                  }}>
                    {item.expanded ? (
                      <ChevronDown width={14} height={14} />
                    ) : (
                      <ChevronRight width={14} height={14} />
                    )}
                  </span>
                  <span className={`icon ${gitStatusClass}`} onClick={(e) => {
                    e.stopPropagation();
                    toggleDirectory(item);
                  }}>
                    {item.expanded ? (
                      <FolderOpen width={14} height={14} />
                    ) : (
                      <FolderIcon width={14} height={14} />
                    )}
                  </span>
                  {renamingItem && renamingItem.path === item.path ? (
                    <InlineRenameInput
                      initialValue={item.name}
                      onSubmit={handleRenameSubmit}
                      onCancel={handleRenameCancel}
                    />
                  ) : (
                  <span className="name">{item.name}</span>
                  )}
                  
                  {item.changesCount && item.changesCount > 0 && (
                    <span className="changes-indicator">{item.changesCount}</span>
                  )}
                  
                  {gitStatusClass && <div className="git-status" />}
                </div>
                <div className="children-container">
                  {creatingItem && creatingItem.parentPath === item.path && item.expanded && (
                    <ul className="file-tree">
                      <li className="tree-item">
                        <div className={creatingItem.isDirectory ? "directory" : "file-item"}>
                          <div className={creatingItem.isDirectory ? "directory-item" : ""} style={{ marginLeft: "20px" }}>
                            {renderCreatingInput(creatingItem.isDirectory)}
                          </div>
                        </div>
                      </li>
                    </ul>
                  )}
                  {item.expanded && item.loaded && item.children && renderTree(item.children)}
                </div>
              </div>
            ) : (
              <div
                className={`file-item ${gitStatusClass} ${issueClass} ${isActive ? 'active' : ''}`}
                onClick={() => handleFileClick(item.path, item.is_directory)}
              >
                <span className={`icon ${gitStatusClass}`}>
                  {getFileIcon(item.name)}
                </span>
                {renamingItem && renamingItem.path === item.path ? (
                  <InlineRenameInput
                    initialValue={item.name}
                    onSubmit={handleRenameSubmit}
                    onCancel={handleRenameCancel}
                  />
                ) : (
                <span className="name">{item.name}</span>
                )}
                
                {(gitStatusClass || issueClass) && <div className="git-status" />}
              </div>
            )}
          </li>
        );
      })}
      {creatingItem && creatingItem.parentPath === selectedFolder && (
        <li className="tree-item">
          <div className={creatingItem.isDirectory ? "directory" : "file-item"}>
            <div className={creatingItem.isDirectory ? "directory-item" : ""} style={{ cursor: 'pointer' }}>
              <span className="chevron">
                {creatingItem.isDirectory && <ChevronRight width={14} height={14} />}
              </span>
              {renderCreatingInput(creatingItem.isDirectory)}
            </div>
          </div>
        </li>
      )}
    </ul>
  );

  // Добавляем состояние для отслеживания фокуса
  const [isFocused, setIsFocused] = useState(false);
  const fileManagerRef = useRef<HTMLDivElement>(null);
  
  // Обработчик горячих клавиш
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Проверяем, что элемент в фокусе и нет активного поля ввода
    if (!isFocused || creatingItem || renamingItem) return;
    
    const selectedItemPath = selectedFile || '';
    
    // Находим выбранный элемент в дереве
    const findSelectedItem = (): FileItem | null => {
      if (!selectedItemPath) return null;
      
      const findItem = (items: FileItem[]): FileItem | null => {
        for (const item of items) {
          if (item.path === selectedItemPath) {
            return item;
          }
          if (item.children && item.expanded) {
            const found = findItem(item.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      return findItem(fileTree);
    };
    
    // Находим родительскую директорию выбранного элемента
    const getParentPath = (path: string): string => {
      const parts = path.split(/[\/\\]/);
      parts.pop();
      return parts.join('\\');
    };
    
    const selectedItem = findSelectedItem();
    const parentPath = selectedItemPath ? getParentPath(selectedItemPath) : (selectedFolder || '');
    
    // Обрабатываем горячие клавиши
    switch (e.key) {
      case 'F2': // Переименование
        if (selectedItemPath) {
          e.preventDefault();
          handleRenameFile(selectedItemPath);
          console.log(`Горячая клавиша: F2 - переименование ${selectedItemPath}`);
        }
        break;
        
      case 'Delete': // Удаление
        if (selectedItemPath) {
          e.preventDefault();
          deleteFile(selectedItemPath);
          console.log(`Горячая клавиша: Delete - удаление ${selectedItemPath}`);
        }
        break;
        
      case 'n': // Alt+N или Ctrl+N - новый файл
        if ((e.altKey || e.ctrlKey) && !e.shiftKey && parentPath) {
          e.preventDefault();
          handleContextCreateFile(parentPath);
          console.log(`Горячая клавиша: ${e.altKey ? 'Alt' : 'Ctrl'}+N - создание файла в ${parentPath}`);
        }
        break;
        
      case 'd': // Alt+D - новая папка
        if (e.altKey && !e.ctrlKey && !e.shiftKey && parentPath) {
          e.preventDefault();
          handleContextCreateDirectory(parentPath);
          console.log(`Горячая клавиша: Alt+D - создание папки в ${parentPath}`);
        }
        break;
        
      case 'N': // Ctrl+Shift+N - новая папка
        if (e.ctrlKey && e.shiftKey && parentPath) {
          e.preventDefault();
          handleContextCreateDirectory(parentPath);
          console.log(`Горячая клавиша: Ctrl+Shift+N - создание папки в ${parentPath}`);
        }
        break;
        
      case 'F5': // Обновление
        e.preventDefault();
        handleRefresh();
        console.log(`Горячая клавиша: F5 - обновление дерева файлов`);
        break;
        
      default:
        break;
    }
  };
  
  // Обработчики фокуса для компонента
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
  };
  
  // Добавляем фокус на компонент при монтировании и клике
  useEffect(() => {
    const focusFileManager = () => {
      if (fileManagerRef.current) {
        fileManagerRef.current.focus();
      }
    };
    
    // Установить начальный фокус
    focusFileManager();
    
    // Очистка при размонтировании
    return () => {
      setIsFocused(false);
    };
  }, []);

  return (
    <div 
      className="file-manager" 
      onClick={() => {
        setContextMenu(null);
        // Устанавливаем фокус при клике на компонент
        if (fileManagerRef.current) {
          fileManagerRef.current.focus();
        }
      }} 
      ref={fileManagerRef}
      tabIndex={0} // Для возможности получения фокуса
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{ outline: 'none' }} // Убираем контур фокуса для лучшего вида
    >
      <div className="file-manager-header">
        <h4 title="Горячие клавиши: F2 - переименовать, Delete - удалить, Ctrl+N/Alt+N - новый файл, Ctrl+Shift+N/Alt+D - новая папка, F5 - обновить">
          Проводник
        </h4>
        <div className="header-buttons">
          <button className="file-icons" title="Новый файл (Ctrl+N, Alt+N)" onClick={() => selectedFolder && handleContextCreateFile(selectedFolder)}>
            <FilePlus width={18} height={18} />
          </button>
          <button className="file-icons" title="Новая папка (Ctrl+Shift+N, Alt+D)" onClick={() => selectedFolder && handleContextCreateDirectory(selectedFolder)}>
            <FolderPlusIcon width={20} height={20} />
          </button>
          <button 
            className="file-icons" 
            title="Обновить (F5)"
            onClick={handleRefresh}
          >
            <RefreshCcw width={18} height={18} />
          </button>
        </div>
      </div>
      
      {fileTree.length > 0 ? renderTree(fileTree) : <p>Выберите папку</p>}
    
      
      {contextMenu && (
        <>
          {contextMenu.isDirectory ? (
            <FolderContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              onClose={() => setContextMenu(null)}
              onCreateDirectory={handleContextCreateDirectory}
              onCreateFile={handleContextCreateFile}
              onDelete={deleteFile}
              onRename={handleRenameFile}
              onSetTerminalPath={handleSetTerminalPath}
              workspaceRoot={selectedFolder || ""}
            />
          ) : (
            <FileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              onClose={() => setContextMenu(null)}
              onDelete={deleteFile}
              onRename={handleRenameFile}
              onSetTerminalPath={handleSetTerminalPath}
              onSetSelectedFile={setSelectedFile}
              workspaceRoot={selectedFolder || ""}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;