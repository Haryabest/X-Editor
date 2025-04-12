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
  const [creatingDir, setCreatingDir] = useState(false);
  const [creatingItemName, setCreatingItemName] = useState('');
  const [creatingItemIsDir, setCreatingItemIsDir] = useState(true);
  
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

  useEffect(() => {
    if (gitChanges && gitChanges.length > 0) {
      prepareGitStatusMap(gitChanges);
    } else {
      setGitStatusMap(new Map());
      setDirectoryChangesMap(new Map());
    }
  }, [gitChanges]);

  // Add debugging for file issues
  useEffect(() => {
    if (Object.keys(fileIssues).length > 0) {
      console.log('🔍 FileManager received file issues:', fileIssues);
    }
  }, [fileIssues]);

  // Обновляем список видимых элементов при каждом изменении дерева файлов
  useEffect(() => {
    if (fileTree.length > 0) {
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
  
  // Normalize paths for consistent comparison
  const normalizePath = (path: string): string => {
    if (!path) return '';
    
    // 1. Remove trailing slashes
    // 2. Convert backslashes to forward slashes
    // 3. Lowercase for case-insensitive comparison on Windows
    let normalized = path.replace(/[\/\\]+$/, '').replace(/\\/g, '/');
    
    // Lowercase Windows drive letters
    if (/^[a-zA-Z]:/.test(normalized)) {
      return normalized.charAt(0).toLowerCase() + normalized.slice(1);
    }
    
    return normalized;
  };
  
  // Function to explicitly track expanded state across tree updates
  const updateExpandedPaths = (path: string, isExpanded: boolean) => {
    const normalizedPath = normalizePath(path);
    
    if (isExpanded) {
      expandedPathsRef.current.add(normalizedPath);
    } else {
      expandedPathsRef.current.delete(normalizedPath);
    }
  };
  
  // Function to find an item in the tree by path
  const findItem = (items: FileItem[], path: string): FileItem | null => {
    if (!items || items.length === 0) return null;
    
    // Special case for root folder
    if (path === selectedFolder && items.length === 1) {
      return items[0];
    }

    const searchPath = normalizePath(path);
    
    for (const item of items) {
      const itemPath = normalizePath(item.path);
      
      if (itemPath === searchPath) {
        return item;
      }
      
      if (item.children && item.children.length > 0) {
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
            expanded: expandedPathsRef.current.has(normalizePath(child.path)),
            loaded: child.children !== undefined
          }))
        };
        
        // Обновляем конкретную часть дерева
        setFileTree(prev => {
          const updatedTree = prev.map(root => updateTree([root], item.path, processedResult)[0]);
          return updatedTree;
        });
      } catch (error) {
        console.error('Error loading subdirectory:', error);
      }
    } else {
      // Track the expanded state change
      const newExpandedState = !item.expanded;
      updateExpandedPaths(item.path, newExpandedState);
      
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
    const normalizedPath = normalizePath(item.path);
    const shouldExpand = expandedPathsRef.current.has(normalizedPath);
    
    return {
      ...item,
      expanded: shouldExpand,
      loaded: item.loaded || shouldExpand,
      children: item.children?.map(processTreeWithExpandedPaths)
    };
  };

  // Handler for context menu create actions
  const handleContextCreateDirectory = async (path: string) => {
    // Close the context menu immediately
    setContextMenu(null);
    
    // Make sure the parent directory is expanded first
    try {
      const item = findItem(fileTree, path);
      if (item && !item.expanded) {
        await toggleDirectory(item);
      }
      
      // Set creating state
      setCreatingItem({
        parentPath: path,
        isDirectory: true
      });
    } catch (error) {
      console.error("Error expanding directory:", error);
    }
  };
  
  const handleContextCreateFile = async (path: string) => {
    // Close the context menu immediately
    setContextMenu(null);
    
    // Make sure the parent directory is expanded first
    try {
      const item = findItem(fileTree, path);
      if (item && !item.expanded) {
        await toggleDirectory(item);
      }
      
      // Set creating state
      setCreatingItem({
        parentPath: path,
        isDirectory: false
      });
    } catch (error) {
      console.error("Error expanding directory:", error);
    }
  };
  
  // Function to render the CreateInput component with improved styling
  const CreateInput = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);
    
    return (
      <div style={{
        padding: '8px 10px',
        margin: '4px 0',
        background: '#2d3748',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}>
        <span style={{ marginRight: '8px', color: creatingItemIsDir ? '#ffd700' : '#cccccc' }}>
          {creatingItemIsDir ? <FolderIcon width={16} height={16} /> : 
            <div style={{ width: 16, height: 16 }}>{getFileIcon("")}</div>}
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder={creatingItemIsDir ? "New folder name" : "New file name"}
          value={creatingItemName}
          onChange={(e) => setCreatingItemName(e.target.value)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            padding: '4px 0'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreateSubmit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCreateCancel();
            }
          }}
          autoFocus
        />
      </div>
    );
  };

  const handleCreateSubmit = async () => {
    if (!creatingItem) return;
    
    if (!creatingItemName.trim()) {
      handleCreateCancel();
      return;
    }

    try {
      // Join paths properly
      const separator = '\\';
      const normalizedParent = creatingItem.parentPath.replace(/[\/\\]+$/, '');
      const fullPath = `${normalizedParent}${separator}${creatingItemName}`;
      
      if (creatingItem.isDirectory) {
        await invoke('create_folder', { path: fullPath });
      } else {
        await invoke('create_file', { path: fullPath });
      }

      // Refresh the parent directory
      await handleRefresh();
      
      // Clear creating state
      setCreatingItem(null);
    } catch (error) {
      console.error("Error creating item:", error);
    }
  };

  const handleCreateCancel = () => {
    setCreatingItem(null);
  };

  const handleFileClick = (path: string, isDirectory: boolean) => {
    if (isDirectory) {
      // For directories, just expand/collapse
      const item = findItem(fileTree, path);
      if (item) {
        toggleDirectory(item);
      }
    } else {
      // For files, set as selected file
      if (path) {
        setSelectedFile(path);
      }
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
      console.log(`🔍 Checking issues for ${path}:`, issue);
      if (issue.errors > 0) return 'error';
      if (issue.warnings > 0) return 'warning';
    }
    return '';
  };

  const handleRefresh = async () => {
    if (selectedFolder) {
      try {
        // Save expanded paths before refresh
        const expandedPathsSet = new Set<string>(expandedPathsRef.current);
        
        // Reload the tree
        const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
        
        // Process the tree with our expanded paths
        const processedTree = processTreeWithExpandedPaths(tree);
        
        // Always ensure the root is expanded
        processedTree.expanded = true;
        processedTree.loaded = true;
        
        setFileTree([processedTree]);
        
        // Also refresh Python diagnostics if available
        if (typeof window !== 'undefined') {
          const win = window as any;
          if (win.updateAllPythonDiagnostics) {
            console.log('🐍 Refreshing all Python diagnostics from file manager...');
            win.updateAllPythonDiagnostics().catch((err: any) => {
              console.error('Error refreshing Python diagnostics:', err);
            });
          }
        }
      } catch (error) {
        console.error('Ошибка при обновлении:', error);
      }
    }
  };

  const deleteFile = async (path: string) => {
    // Determine if the path is a directory
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
        await invoke("delete_file", { path });
        
        // If deleted file was selected, unselect it
        if (selectedFile === path) {
          setSelectedFile(null);
        }
        
        // Refresh the tree
        await handleRefresh();
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
      
      // Call backend function for renaming
      await invoke('rename_file', { oldPath, newPath });
      
      // If the renamed file was selected, update selected file
      if (selectedFile === oldPath) {
        setSelectedFile(newPath);
      }
      
      // Refresh the tree
      await handleRefresh();
    } catch (error) {
      console.error('Error renaming file:', error);
      alert(`Failed to rename: ${error}`);
    } finally {
      setRenamingItem(null);
    }
  };

  const handleRenameCancel = () => {
    setRenamingItem(null);
  };

  // Обработчик для установки пути в терминале
  const handleSetTerminalPath = (path: string) => {
    // Эмитим событие для установки пути в терминале
    window.dispatchEvent(new CustomEvent('set-terminal-path', { detail: { path } }));
  };

  const renderTree = (items: FileItem[]) => {
    return (
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
  };

  return (
    <div 
      ref={fileManagerRef} 
      className="file-manager"
      style={{ position: 'relative' }}
    >
      <div className="file-manager-controls" style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        borderBottom: '1px solid #3a3a3a'
      }}>
        <span className="file-manager-title" style={{ fontWeight: 500 }}>
          Explorer{selectedFolder ? `: ${selectedFolder.split(/[\/\\]/).pop()}` : ''}
        </span>
        <div className="file-manager-actions">
          <button 
            onClick={handleRefresh}
            title="Refresh file tree and diagnostics"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cccccc'
            }}
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>
      
      {/* Always display the creation input when creatingItem is set */}
      {creatingItem && <CreateInput />}
      {renderTree(fileTree)}
      
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