import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon, FolderIcon } from './fileIcons';
import { ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';

import "./style.css";

interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
  expanded?: boolean;
  loaded?: boolean;
}

interface FileManagerProps {
  selectedFolder: string | null;
}
const FileManager: React.FC<FileManagerProps> = ({ selectedFolder }) => {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    const loadTree = async () => {
      if (selectedFolder) {
        try {
          const tree = await invoke<FileItem>("get_directory_tree", { 
            path: selectedFolder 
          });
          setFileTree(tree.children || []);
        } catch (error) {
          console.error('Error loading directory:', error);
        }
      }
    };
    loadTree();
  }, [selectedFolder]);
  const toggleDirectory = async (item: FileItem) => {
    if (!item.loaded) {
      try {
        const result = await invoke<FileItem>("get_directory_tree", { 
          path: item.path 
        });
        
        const newChildren = result.children?.map(child => ({
          ...child,
          expanded: false,
          loaded: false
        })) || [];

        setFileTree(prev => updateTree(prev, item.path, newChildren));
      } catch (error) {
        console.error('Error loading directory:', error);
      }
    } else {
      setFileTree(prev => updateTree(prev, item.path, item.children || []));
    }
  };
  const updateTree = (items: FileItem[], path: string, newChildren: FileItem[]): FileItem[] => {
    return items.map(item => {
      if (item.path === path) {
        return { 
          ...item, 
          children: newChildren,
          expanded: true,
          loaded: true
        };
      }
      if (item.children) {
        return {
          ...item,
          children: updateTree(item.children, path, newChildren)
        };
      }
      return item;
    });
  };

  const createNewDirectory = async (path: string) => {
    const newFolderName = prompt('Введите имя новой папки:');
    if (newFolderName) {
      try {
        await invoke("create_folder", { path: `${path}/${newFolderName}` });
        
        // Обновляем только родительскую папку
        const result = await invoke<FileItem>("get_directory_tree", { path });
        const newChildren = result.children?.map(child => ({
          ...child,
          expanded: false,
          loaded: false
        })) || [];

        setFileTree(prev => updateTree(prev, path, newChildren));
      } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка создания: ${error}`);
      }
    }
  };

  const createNewFile = async (path: string) => {
    const newFileName = prompt('Введите имя файла:');
    if (newFileName) {
      try {
        await invoke("create_file", { path: `${path}/${newFileName}` });
        const parentPath = path.split('/').slice(0, -1).join('/');
        const tree = await invoke<FileItem>("get_directory_tree", { path: parentPath });
        setFileTree(tree.children || []);
      } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка создания: ${error}`);
      }
    }
  };

  const renderTree = (items: FileItem[]) => (
    <ul className="file-tree">
      {items.map((item) => (
        <li key={item.path} className="tree-item" onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, path: item.path });
        }}>
          {item.is_directory ? (
            <div className="directory">
              <div onClick={() => toggleDirectory(item)} className="directory-item">
                <span className="chevron">
                  {item.expanded ? <ChevronDown width={14} height={14} /> : <ChevronRight width={14} height={14} />}
                </span>
                <span className="icon">
                  {item.expanded ? <FolderOpen width={14} height={14}/> : <FolderIcon width={14} height={14}/>}
                </span>
                <span className="name">{item.name}</span>
              </div>
              {item.expanded && item.children && (
                <div className="children-container">
                  {renderTree(item.children)}
                </div>
              )}
            </div>
          ) : (
            <div className="file-item">
              <span className="icon">{getFileIcon(item.name)}</span>
              <span className="name">{item.name}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="file-manager" onClick={() => setContextMenu(null)}>
      <h5>ПРОВОДНИК</h5>
      {renderTree(fileTree)}

      {contextMenu && (
        <div className="context-menu" style={{ 
          top: contextMenu.y, 
          left: contextMenu.x,
          position: 'fixed',
          zIndex: 1000
        }}>
          <button onClick={() => {
            createNewDirectory(contextMenu.path);
            setContextMenu(null);
          }}>
            Новая папка
          </button>
          <button onClick={() => {
            createNewFile(contextMenu.path);
            setContextMenu(null);
          }}>
            Новый файл
          </button>
        </div>
      )}
    </div>
  );
};

export default FileManager;