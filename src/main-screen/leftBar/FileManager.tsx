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
  
  // Add this ref for the file manager
  const fileManagerRef = useRef<HTMLDivElement>(null);
  
  // Add this effect at the component level
  useEffect(() => {
    if (creatingItem && createInputRef.current) {
      createInputRef.current.focus();
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
      
      // Добавляем все элементы, независимо от того, директория это или файл
      visible.push(processedItem);
      
      // Если это директория и она развернута, добавляем ее дочерние элементы
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

  // Обновляем список видимых элементов при каждом изменении дерева файлов
  useEffect(() => {
    if (fileTree.length > 0) {
      updateVisibleItems(fileTree);
    }
  }, [fileTree]);

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
  const normalizePath = (path: string, fileName: string): string => {
    // Ensure we use backslashes for Windows
    const separator = '\\';
    // Make sure path doesn't end with a separator
    const cleanPath = path.endsWith(separator) ? path.slice(0, -1) : path;
    return `${cleanPath}${separator}${fileName}`;
  };
  
  // Function to explicitly track expanded state across tree updates
  const updateExpandedPaths = (path: string, isExpanded: boolean) => {
    // Normalize path for storage
    const normalizedPath = normalizePath(path, '');
    
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
    if (!items || items.length === 0) {
      console.log('findItem: items array is empty');
      return null;
    }

    // Simple path normalization for comparison
    const normalizePath = (p: string): string => {
      // Remove trailing slashes for consistent comparison
      return p.replace(/[\\\/]$/, '');
    };
    
    const searchPath = normalizePath(path);
    console.log('findItem: searching for path:', searchPath);
    console.log('findItem: current items:', items);
    
    for (const item of items) {
      const itemPath = normalizePath(item.path);
      console.log('findItem: comparing with item path:', itemPath);
      
      if (itemPath === searchPath) {
        console.log('findItem: found matching item:', item);
        return item;
      }
      
      if (item.children && item.children.length > 0) {
        console.log('findItem: searching in children of:', itemPath);
        const found = findItem(item.children, path);
        if (found) return found;
      }
    }
    
    console.log('findItem: no matching item found');
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
    const normalizedPath = normalizePath(item.path, '');
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

  // Handler for context menu create actions
  const handleContextCreateDirectory = async (path: string) => {
    console.log('Creating directory in:', path);
    console.log('Selected folder:', selectedFolder);
    console.log('Current file tree:', fileTree);
    
    if (!fileTree || fileTree.length === 0) {
      console.log('File tree is empty, cannot create directory');
      return;
    }
    
    // Close the context menu immediately
    setContextMenu(null);
    
    // Make sure the parent directory is expanded first
    try {
      const item = findItem(fileTree, path);
      console.log('Found item:', item);
      if (item && !item.expanded) {
        await toggleDirectory(item);
      }
      
      // Then set creating state with a small delay to ensure proper rendering
      setTimeout(() => {
        setCreatingItem({
          parentPath: path,
          isDirectory: true
        });
      }, 50);
    } catch (error) {
      console.error("Error expanding directory:", error);
    }
  };
  
  const handleContextCreateFile = async (path: string) => {
    console.log('Creating file in:', path);
    console.log('Selected folder:', selectedFolder);
    console.log('Current file tree:', fileTree);
    
    if (!fileTree || fileTree.length === 0) {
      console.log('File tree is empty, cannot create file');
      return;
    }
    
    // Close the context menu immediately
    setContextMenu(null);
    
    // Make sure the parent directory is expanded first
    try {
      const item = findItem(fileTree, path);
      console.log('Found item:', item);
      if (item && !item.expanded) {
        await toggleDirectory(item);
      }
      
      // Then set creating state with a small delay to ensure proper rendering
      setTimeout(() => {
        setCreatingItem({
          parentPath: path,
          isDirectory: false
        });
      }, 50);
    } catch (error) {
      console.error("Error expanding directory:", error);
    }
  };
  
  const renderCreatingInput = () => {
    if (!creatingItem) {
      console.log('No creating item, not rendering input');
      return null;
    }

    console.log('Rendering creating input for:', creatingItem);
    
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Enter pressed, submitting creation');
        await handleCreateSubmit(e.currentTarget.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Escape pressed, canceling creation');
        handleCreateCancel();
      }
    };

    return (
      <div className="creating-input-container" style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '2px 0',
        marginLeft: '20px'
      }}>
        <span className="icon" style={{ marginRight: '5px' }}>
          {creatingItem.isDirectory ? (
            <FolderIcon width={14} height={14} />
          ) : (
            getFileIcon(createInputRef.current?.value || "")
          )}
        </span>
        <input
          ref={createInputRef}
          type="text"
          autoFocus
          onKeyDown={handleKeyDown}
          onBlur={handleCreateCancel}
          placeholder={creatingItem.isDirectory ? "Folder name" : "File name"}
          className="creating-input"
          style={{ 
            flex: 1,
            padding: '2px 4px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            outline: 'none'
          }}
        />
      </div>
    );
  };

  const handleCreateSubmit = async (name: string) => {
    if (!creatingItem) {
      console.log('No creating item, cannot submit');
      return;
    }

    console.log('Submitting creation with name:', name);
    console.log('Creating item:', creatingItem);
    
    if (!name.trim()) {
      console.log('Empty name, canceling');
      handleCreateCancel();
      return;
    }

    try {
      const fullPath = `${creatingItem.parentPath}/${name}`;
      console.log('Creating at path:', fullPath);
      
      if (creatingItem.isDirectory) {
        await invoke('create_folder', { path: fullPath });
        console.log('Directory created successfully');
      } else {
        await invoke('create_file', { path: fullPath });
        console.log('File created successfully');
      }

      // Сохраняем текущее состояние раскрытых папок
      const expandedPaths = getExpandedPaths(fileTree);
      console.log('Expanded paths before refresh:', [...expandedPaths]);

      // Особая логика для обновления только конкретной папки
      const parentPath = creatingItem.parentPath;
      
      try {
        // Найдем родительскую папку, которую нужно обновить
        const parentItem = findItem(fileTree, parentPath);
        
        if (parentItem && parentItem.is_directory) {
          console.log('Refreshing only parent folder:', parentPath);
          
          // Запрашиваем только содержимое этой директории
          const result = await invoke<FileItem>("get_subdirectory", { path: parentPath });
          
          // Обрабатываем результат, сохраняя развернутый статус
          const processedResult = {
            ...result,
            expanded: true,
            loaded: true,
            children: result.children?.map(child => ({
              ...child,
              expanded: expandedPaths.has(child.path),
              loaded: child.children !== undefined
            }))
          };
          
          // Обновляем только эту часть дерева
          setFileTree(prev => {
            const updatedTree = prev.map(root => updateTree([root], parentPath, processedResult)[0]);
            console.log("Directory updated with new content:", parentPath);
            return updatedTree;
          });
        } else {
          // Если не удалось найти родительскую папку, обновляем все дерево
          console.log('Could not find parent folder, refreshing entire tree');
          await handleRefresh();
        }
      } catch (error) {
        console.error('Error refreshing parent directory:', error);
        await handleRefresh();
      }
      
      // Clear creating state
      setCreatingItem(null);
    } catch (error) {
      console.error("Error creating item:", error);
      // Keep the input visible if there was an error
    }
  };

  const handleCreateCancel = () => {
    setCreatingItem(null);
  };

  const handleFileClick = (path: string, isDirectory: boolean) => {
    console.log(`Клик по ${isDirectory ? 'директории' : 'файлу'}: ${path}`);
    
    if (isDirectory) {
      // Для директорий только разворачиваем/сворачиваем, 
      // но не устанавливаем как выбранный файл
      const item = findItem(fileTree, path);
      if (item) {
        toggleDirectory(item);
      }
    } else {
      // Для файлов обычное поведение
      if (path) {
        setSelectedFile(path);
        
        // Проверяем, существует ли файл физически
        invoke('file_exists', { path })
          .then((exists) => {
            if (!exists) {
              console.warn(`Файл не существует: ${path}`);
              // Можно показать уведомление пользователю
            }
          })
          .catch(error => {
            console.error('Ошибка при проверке файла:', error);
          });
      }
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
        
        // Save expanded paths before refresh
        const expandedPathsSet = new Set<string>(expandedPathsRef.current);
        
        // Перезагружаем дерево файлов
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Process the tree with our expanded paths
        const processedTree = processTreeWithExpandedPaths(tree);
        
        // Always ensure the root is expanded
        processedTree.expanded = true;
        processedTree.loaded = true;
        
        // After loading the tree, ensure expanded paths are still maintained
        const ensurePathsExpanded = (item: FileItem) => {
          if (item.path && item.is_directory) {
            // Normalize the path for comparison
            const normalizedPath = normalizePath(item.path, '');
            if (expandedPathsSet.has(normalizedPath)) {
              // This is important - directly update the expandedPathsRef for persistence
              expandedPathsRef.current.add(normalizedPath);
              console.log(`Re-expanding path: ${normalizedPath}`);
              item.expanded = true;
              item.loaded = true;
            }
            
            // Process children recursively
            if (item.children) {
              item.children.forEach(ensurePathsExpanded);
            }
          }
        };
        
        // Apply the recursive function to ensure all paths stay expanded
        ensurePathsExpanded(processedTree);
        
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
      
      // Split path using both forward and backslashes
      const pathParts = oldPath.split(/[\/\\]/);
      pathParts.pop(); // Remove the last element (file/folder name)
      
      // Create new path using the system's preferred separator (backslash for Windows)
      const newPath = [...pathParts, newName].join('\\');
      
      console.log(`Переименование: ${oldPath} -> ${newPath}`);
      
      // Call backend function for renaming
      await invoke('rename_file', { oldPath, newPath });
      
      // Save the state of expanded directories
      const expandedPaths = getExpandedPaths(fileTree);
      
      // Update file tree starting from the root of the selected directory
      if (selectedFolder) {
        // Completely update the entire file tree
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Process the tree and restore expanded directories state
        const processedTree = {
          ...tree,
          expanded: true,
          loaded: true,
          children: tree.children?.map(child => processChildWithExpanded(child, expandedPaths))
        };
        
        setFileTree([processedTree]);
        updateVisibleItems([processedTree]);
        
        // If the renamed file was selected, update selected file
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
      {creatingItem && selectedFolder && creatingItem.parentPath === selectedFolder && (
        <li className="tree-item">
          <div className="creating-input-wrapper" style={{ marginLeft: "28px" }}>
            {renderCreatingInput()}
          </div>
        </li>
      )}
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
                    if (
                      e.target instanceof Element && 
                      (e.target.closest('.chevron') || e.target.closest('.icon'))
                    ) {
                      toggleDirectory(item);
                    } else {
                      // Всегда только раскрываем/сворачиваем папку при клике
                      toggleDirectory(item);
                    }
                  }}
                  className={`directory-item ${gitStatusClass}`}
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
                  <span className={`icon ${gitStatusClass}`}>
                    {item.expanded ? <FolderOpen width={14} height={14} /> : <FolderIcon width={14} height={14} />}
                  </span>
                  <span className="item-name">{item.name}</span>
                  {item.changesCount && item.changesCount > 0 && <span className="changes-badge">{item.changesCount}</span>}
                </div>
                {item.expanded && item.children && renderTree(item.children)}
                {creatingItem && creatingItem.parentPath === item.path && renderCreatingInput()}
              </div>
            ) : (
              <div
                className={`file-item ${gitStatusClass} ${issueClass} ${isActive ? 'active' : ''}`}
                onClick={() => handleFileClick(item.path, false)}
              >
                <span className="icon">
                  {getFileIcon(item.name)}
                </span>
                <span className="item-name">{item.name}</span>
                {item.fileIssue && (item.fileIssue.errors > 0 || item.fileIssue.warnings > 0) && (
                  <span className="issues-badge">
                    {item.fileIssue.errors > 0 ? `E:${item.fileIssue.errors}` : ''}
                    {item.fileIssue.errors > 0 && item.fileIssue.warnings > 0 ? '/' : ''}
                    {item.fileIssue.warnings > 0 ? `W:${item.fileIssue.warnings}` : ''}
                  </span>
                )}
              </div>
            )}
            {renamingItem && renamingItem.path === item.path && (
              <InlineRenameInput
                initialValue={item.name}
                onSubmit={handleRenameSubmit}
                onCancel={handleRenameCancel}
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={fileManagerRef} className="file-manager">
      {renderTree(fileTree)}
      
      {/* Контекстное меню для файлов и папок */}
      {contextMenu && (
        <>
          {contextMenu.isDirectory ? (
            <FolderContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              onClose={() => setContextMenu(null)}
              onCreateFile={(path: string) => handleContextCreateFile(path)}
              onCreateDirectory={(path: string) => handleContextCreateDirectory(path)}
              onRename={(path: string) => handleRenameFile(path)}
              onDelete={(path: string) => deleteFile(path)}
              onSetTerminalPath={(path: string) => handleSetTerminalPath(path)}
              workspaceRoot={selectedFolder || ""}
            />
          ) : (
            <FileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              onClose={() => setContextMenu(null)}
              onRename={(path: string) => handleRenameFile(path)}
              onDelete={(path: string) => deleteFile(path)}
              onSetTerminalPath={(path: string) => handleSetTerminalPath(path)}
              workspaceRoot={selectedFolder || ""}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;