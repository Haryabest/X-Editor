import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon, FolderIcon } from './fileIcons';
import { FolderPlusIcon } from "@heroicons/react/24/outline";
import { ChevronRight, ChevronDown, FolderOpen, FilePlus, RefreshCcw } from 'lucide-react';

import FileContextMenu from './context/FileContextMenu';
import FolderContextMenu from './context/FolderContextMenu';
import InlineRenameInput from './InlineRenameInput';

import "./filemanager.css";

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
  const [renamingItem, setRenamingItem] = useState<string | null>(null);

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
        
        const allFiles = collectAllFiles(updatedTree);
        setCurrentFiles(allFiles);
        
        return updatedTree;
      });
    }
  }, [gitStatusMap, directoryChangesMap]);

  const collectAllFiles = (items: FileItem[]): FileItem[] => {
    let allFiles: FileItem[] = [];
    
    items.forEach(item => {
      // Получаем Git статус и проблемы для файла
      const gitStatus = gitStatusMap.get(item.path);
      const fileIssue = fileIssues[item.path];
      
      // Создаем копию элемента с необходимыми свойствами
      const processedItem = {
        ...item,
        icon: !item.is_directory ? getFileIcon(item.name) : undefined,
        gitStatus,
        hasChanges: !!gitStatus,
        fileIssue
      };
      
      allFiles.push(processedItem);
      
      // Обрабатываем дочерние элементы, если они есть и папка раскрыта
      if (item.children && item.expanded) {
        const childrenFiles = collectAllFiles(item.children);
        allFiles = [...allFiles, ...childrenFiles];
      }
    });
    
    return allFiles;
  };

  // Функция для загрузки дерева директорий
  const loadTree = async () => {
    if (selectedFolder) {
      try {
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Базовая обработка дерева
        const processedTree = {
          ...tree,
          expanded: true,
          loaded: true,
          children: tree.children?.map(child => ({
            ...child,
            expanded: false,
            loaded: child.children !== undefined
          }))
        };
        
        setFileTree([processedTree]);
        const allFiles = collectAllFiles([processedTree]);
        setCurrentFiles(allFiles);
      } catch (error) {
        console.error('Error loading directory:', error);
        alert(`Failed to load directory: ${error}`);
      }
    } else {
      setFileTree([]);
      setCurrentFiles([]);
    }
  };

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

  const toggleDirectory = async (item: FileItem) => {
    if (item.is_directory && !item.loaded) {
      try {
        const result = await invoke<FileItem>("get_subdirectory", { path: item.path });
        
        const baseResult = {
          ...result,
          children: result.children?.map(child => ({
            ...child,
            expanded: false,
            loaded: child.children !== undefined
          }))
        };
        
        setFileTree(prev => {
          const updatedTree = prev.map(root => updateTree([root], item.path, baseResult)[0]);
          const allFiles = collectAllFiles(updatedTree);
          setCurrentFiles(allFiles);
          return updatedTree;
        });
      } catch (error) {
        console.error('Error loading subdirectory:', error);
      }
    } else {
      setFileTree(prev => {
        const updatedTree = prev.map(root => ({
          ...root,
          expanded: root.path === item.path ? !root.expanded : root.expanded,
          children: root.children ? toggleExpanded(root.children, item.path) : undefined,
        }));
        const allFiles = collectAllFiles(updatedTree);
        setCurrentFiles(allFiles);
        return updatedTree;
      });
    }
  };

  const toggleExpanded = (items: FileItem[], path: string): FileItem[] => {
    return items.map((item) => {
      if (item.path === path) {
        return { ...item, expanded: !item.expanded };
      }
      if (item.children) {
        return { ...item, children: toggleExpanded(item.children, path) };
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

  const createNewDirectory = async (path: string) => {
    const newFolderName = prompt('Enter the new folder name:');
    if (newFolderName) {
      try {
        await invoke("create_folder", { path: `${path}/${newFolderName}` });
        const result = await invoke<FileItem>("get_subdirectory", { path });
        setFileTree((prev) => {
          const updated = [updateTree(prev, path, processTree(result))[0]];
          const allFiles = collectAllFiles(updated);
          setCurrentFiles(allFiles);
          return updated;
        });
      } catch (error) {
        console.error('Error creating folder:', error);
        alert(`Failed to create folder: ${error}`);
      }
    }
  };

  const createNewFile = async (path: string) => {
    const newFileName = prompt('Enter the new file name:');
    if (newFileName) {
      try {
        await invoke("create_file", { path: `${path}/${newFileName}` });
        const parentPath = path.split('/').slice(0, -1).join('/') || path;
        const tree = await invoke<FileItem>("get_subdirectory", { path: parentPath });
        setFileTree((prev) => {
          const updated = [updateTree(prev, parentPath, processTree(tree))[0]];
          const allFiles = collectAllFiles(updated);
          setCurrentFiles(allFiles);
          return updated;
        });
      } catch (error) {
        console.error('Error creating file:', error);
        alert(`Failed to create file: ${error}`);
      }
    }
  };

  // Проверка наличия элемента в дереве
  const isItemInTree = (
    item: FileItem,
    path: string,
    checkIsDirectory: boolean
  ): boolean => {
    if (item.path === path) {
      return !checkIsDirectory || item.is_directory;
    }
    
    if (item.children) {
      return item.children.some(child => isItemInTree(child, path, checkIsDirectory));
    }
    
    return false;
  };

  // Функция для переименования
  const handleRename = (path: string) => {
    const isDirectory = fileTree.some(item => isItemInTree(item, path, true));
    console.log(`Rename requested for ${isDirectory ? 'directory' : 'file'}: ${path}`);
    setRenamingItem(path);
    setContextMenu(null);
  };

  // Функция для обработки завершения переименования
  const handleRenameSubmit = async (newName: string) => {
    if (!renamingItem) return;
    
    try {
      const oldPath = renamingItem;
      const pathParts = oldPath.split('/');
      pathParts.pop(); // Удаляем старое имя файла/папки
      const parentPath = pathParts.join('/');
      const newPath = `${parentPath}/${newName}`;
      
      const isDirectory = fileTree.some(item => isItemInTree(item, oldPath, true));
      console.log(`Renaming ${isDirectory ? 'directory' : 'file'} from ${oldPath} to ${newPath}`);
      
      await invoke("rename_item", { oldPath, newPath });
      
      // Обновляем дерево после переименования
      if (parentPath) {
        const result = await invoke<FileItem>("get_subdirectory", { path: parentPath });
        setFileTree(prev => {
          const updated = updateTree(prev, parentPath, processTree(result));
          const allFiles = collectAllFiles(updated);
          setCurrentFiles(allFiles);
          return updated;
        });
      } else {
        // Если это корневой элемент, перезагружаем все дерево
        loadTree();
      }
    } catch (error) {
      console.error('Error renaming item:', error);
      alert(`Failed to rename: ${error}`);
    } finally {
      setRenamingItem(null);
    }
  };

  // Функция для отмены переименования
  const handleRenameCancel = () => {
    setRenamingItem(null);
  };

  // Функция для удаления файла или папки
  const deleteItem = async (path: string, isDirectory: boolean) => {
    const itemName = path.split('/').pop() || '';
    const confirmMessage = isDirectory 
      ? `Are you sure you want to delete folder "${itemName}" and all its contents?`
      : `Are you sure you want to delete file "${itemName}"?`;
      
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      if (isDirectory) {
        await invoke("delete_folder", { path });
      } else {
        await invoke("delete_file", { path });
      }
      
      // Обновляем дерево после удаления
      const pathParts = path.split('/');
      pathParts.pop();
      const parentPath = pathParts.join('/');
      
      if (parentPath) {
        const result = await invoke<FileItem>("get_subdirectory", { path: parentPath });
        setFileTree(prev => {
          const updated = updateTree(prev, parentPath, processTree(result));
          const allFiles = collectAllFiles(updated);
          setCurrentFiles(allFiles);
          return updated;
        });
      } else {
        // Если это корневой элемент, перезагружаем все дерево
        loadTree();
      }
    } catch (error) {
      console.error(`Error deleting ${isDirectory ? 'folder' : 'file'}:`, error);
      alert(`Failed to delete: ${error}`);
    }
  };

  // Функция для обработки клика по файлу
  const handleFileClick = (path: string, isDirectory: boolean) => {
    console.log(`Clicked on ${isDirectory ? 'directory' : 'file'}: ${path}`);
    
    if (isDirectory) {
      // Для директорий находим элемент и переключаем его состояние
      const directory = fileTree.find(item => item.path === path) || 
                         fileTree.flatMap(item => item.children || []).find(child => child.path === path);
      
      if (directory) {
        toggleDirectory(directory);
      }
    } else {
      // Для файлов устанавливаем выбранный файл
      setSelectedFile(path);
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

  // Рекурсивная функция для отрисовки дерева файлов
  const renderTree = (items: FileItem[]) => (
    <ul className="file-tree" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((item) => {
        const gitStatusClass = getGitStatusClass(item);
        const issueClass = getIssueClass(item.path);
        const isActive = selectedFile === item.path;
        const isRenaming = renamingItem === item.path;
        
        // Элемент дерева
        return (
          <li
            key={item.path}
            className={`tree-item ${item.expanded ? 'expanded' : ''}`}
            style={{ 
              height: item.expanded && item.children ? 'auto' : '22px',
              maxHeight: item.expanded && item.children ? 'none' : '22px',
              overflow: 'hidden',
              position: 'relative',
              margin: 0,
              padding: 0
            }}
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
            {isRenaming ? (
              <InlineRenameInput
                initialValue={item.name}
                onSubmit={handleRenameSubmit}
                onCancel={handleRenameCancel}
              />
            ) : item.is_directory ? (
              <div
                onClick={() => toggleDirectory(item)}
                className={`directory-item ${gitStatusClass} ${item.expanded ? 'expanded' : ''}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  height: '22px',
                  maxHeight: '22px',
                  minHeight: '22px',
                  padding: '0 4px 0 2px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                <span className="chevron">
                  {item.expanded ? (
                    <ChevronDown width={14} height={14} />
                  ) : (
                    <ChevronRight width={14} height={14} />
                  )}
                </span>
                <span className={`icon ${gitStatusClass}`}>
                  {item.expanded ? (
                    <FolderOpen width={14} height={14} />
                  ) : (
                    <FolderIcon width={14} height={14} />
                  )}
                </span>
                <span className="name">{item.name}</span>
                
                {item.changesCount && item.changesCount > 0 && (
                  <span className="changes-indicator">{item.changesCount}</span>
                )}
              </div>
            ) : (
              <div
                className={`file-item ${gitStatusClass} ${issueClass} ${isActive ? 'active' : ''}`}
                onClick={() => handleFileClick(item.path, item.is_directory)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  height: '22px',
                  maxHeight: '22px',
                  minHeight: '22px',
                  padding: '0 4px 0 2px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                <span className={`icon ${gitStatusClass}`}>
                  {getFileIcon(item.name)}
                </span>
                <span className="name">{item.name}</span>
                
                {fileIssues[item.path] && (
                  <div className="issue-indicators">
                    {fileIssues[item.path].errors > 0 && (
                      <span className="error-count">{fileIssues[item.path].errors}</span>
                    )}
                    {fileIssues[item.path].warnings > 0 && (
                      <span className="warning-count">{fileIssues[item.path].warnings}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {item.is_directory && item.children && (
              <div className="children-container" style={{ 
                display: item.expanded ? 'block' : 'none', 
                marginLeft: '16px', 
                borderLeft: '1px dotted #383838',
                paddingLeft: '4px'
              }}>
                {renderTree(item.children)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  // Загружаем дерево при изменении выбранной папки
  useEffect(() => {
    loadTree();
  }, [selectedFolder]);

  return (
    <div className="file-manager" onClick={() => setContextMenu(null)}>
      <div className="file-manager-header">
        <h4 title="Проводник">Проводник</h4>
        <div className="header-buttons">
          <button 
            className="file-icons" 
            title="Новый файл"
            onClick={() => {
              if (selectedFolder) {
                createNewFile(selectedFolder);
              }
            }}
          >
            <FilePlus width={18} height={18} />
          </button>
          <button 
            className="file-icons" 
            title="Новая папка"
            onClick={() => {
              if (selectedFolder) {
                createNewDirectory(selectedFolder);
              }
            }}
          >
            <FolderPlusIcon width={20} height={20} />
          </button>
          <button 
            className="file-icons" 
            title="Обновить"
            onClick={() => {
              if (selectedFolder) {
                loadTree();
              }
            }}
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
              onCreateFolder={createNewDirectory}
              onCreateFile={createNewFile}
              onRename={handleRename}
              onDelete={(path) => deleteItem(path, true)}
            />
          ) : (
            <FileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              fileName={contextMenu.path.split('/').pop() || ''}
              onClose={() => setContextMenu(null)}
              onOpen={(path) => handleFileClick(path, false)}
              onRename={handleRename}
              onDelete={(path) => deleteItem(path, false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;