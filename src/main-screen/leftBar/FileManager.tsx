import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon, FolderIcon } from './fileIcons';
import { FolderPlusIcon } from "@heroicons/react/24/outline";
import { ChevronRight, ChevronDown, FolderOpen, FilePlus, RefreshCcw } from 'lucide-react';

import FileContextMenu from './context/FileContextMenu';
import FolderContextMenu from './context/FolderContextMenu';

import "./style.css";

interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
  expanded?: boolean;
  loaded?: boolean;
  icon?: React.ReactNode;
}

interface FileManagerProps {
  selectedFolder: string | null;
  setSelectedFile: (filePath: string | null) => void;
  setCurrentFiles: (files: FileItem[]) => void;
}

const FileManager: React.FC<FileManagerProps> = ({ selectedFolder, setSelectedFile, setCurrentFiles }) => {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDirectory: boolean;
  } | null>(null);

  // Recursive function to collect all files
  const collectAllFiles = (items: FileItem[]): FileItem[] => {
    let allFiles: FileItem[] = [];
    items.forEach(item => {
      if (!item.is_directory) {
        allFiles.push({ ...item, icon: getFileIcon(item.name), expanded: false, loaded: true });
      }
      if (item.children) {
        allFiles = allFiles.concat(collectAllFiles(item.children));
      }
    });
    return allFiles;
  };

  // Process tree for rendering
  const processTree = (item: FileItem): FileItem => ({
    ...item,
    expanded: false,
    loaded: item.children !== undefined, // loaded = true, если дети уже загружены
    children: item.children?.map(processTree),
  });

  // Load initial tree
  useEffect(() => {
    const loadTree = async () => {
      if (selectedFolder) {
        try {
          const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
          const processed = processTree(tree);
          setFileTree([{ ...processed, expanded: true, loaded: true }]);
          const allFiles = collectAllFiles([processed]);
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
    loadTree();
  }, [selectedFolder]);

  // Toggle directory expansion and load children if needed
  const toggleDirectory = async (item: FileItem) => {
    if (item.is_directory && !item.loaded) {
      try {
        console.log(`Fetching subdirectory for: ${item.path}`);
        const result = await invoke<FileItem>("get_subdirectory", { path: item.path });
        setFileTree((prev) => {
          const updated = prev.map((root) => updateTree([root], item.path, result)[0]);
          const allFiles = collectAllFiles(updated);
          setCurrentFiles(allFiles);
          return updated;
        });
      } catch (error) {
        console.error('Error loading subdirectory:', error);
      }
    } else {
      setFileTree((prev) =>
        prev.map((root) => ({
          ...root,
          expanded: root.path === item.path ? !root.expanded : root.expanded,
          children: root.children ? toggleExpanded(root.children, item.path) : undefined,
        }))
      );
    }
  };

  // Toggle expansion of subdirectories
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

  // Update tree with new data
  const updateTree = (items: FileItem[], path: string, newData: FileItem): FileItem[] => {
    return items.map((item) => {
      const normalizedPath = item.path.replace(/\\/g, '/');
      const targetPath = path.replace(/\\/g, '/');
      if (normalizedPath === targetPath) {
        return { ...newData, expanded: true, loaded: true, path: item.path };
      }
      if (item.children) {
        return { ...item, children: updateTree(item.children, path, newData) };
      }
      return item;
    });
  };

  // Create new directory
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

  // Create new file
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

  // Handle file click
  const handleFileClick = (path: string, isDirectory: boolean) => {
    if (!isDirectory) {
      console.log('Selected file:', path);
      setSelectedFile(path);
    }
  };

  // Recursive rendering function
  const renderTree = (items: FileItem[]) => (
    <ul className="file-tree">
      {items.map((item) => (
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
                onClick={() => toggleDirectory(item)}
                className="directory-item"
                style={{ cursor: 'pointer' }}
              >
                <span className="chevron">
                  {item.expanded ? (
                    <ChevronDown width={14} height={14} />
                  ) : (
                    <ChevronRight width={14} height={14} />
                  )}
                </span>
                <span className="icon">
                  {item.expanded ? (
                    <FolderOpen width={14} height={14} />
                  ) : (
                    <FolderIcon width={14} height={14} />
                  )}
                </span>
                <span className="name">{item.name}</span>
              </div>
              {item.expanded && item.loaded && item.children && (
                <div className="children-container">{renderTree(item.children)}</div>
              )}
            </div>
          ) : (
            <div
              className="file-item"
              onClick={() => handleFileClick(item.path, item.is_directory)}
            >
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
      <div className="file-manager-header">
        <h4>File Explorer</h4>
        <div className="header-buttons">
          <FilePlus className="file-icons" width={18} height={18} />
          <FolderPlusIcon className="file-icons" width={20} height={20} />
          <RefreshCcw className="file-icons" width={18} height={18} />
        </div>
      </div>
      {fileTree.length > 0 ? renderTree(fileTree) : <p>Select a folder</p>}
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
            />
          ) : (
            <FileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              path={contextMenu.path}
              onClose={() => setContextMenu(null)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;