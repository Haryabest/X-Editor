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
        allFiles.push({
          ...item,
          icon: getFileIcon(item.name),
          expanded: false,
          loaded: true,
        });
      }
      if (item.children) {
        allFiles = allFiles.concat(collectAllFiles(item.children));
      }
    });
    return allFiles;
  };

  // Function to process the tree for rendering
  const processTree = (item: FileItem): FileItem => ({
    ...item,
    expanded: false,
    loaded: item.is_directory ? false : true,
    children: item.children?.map(processTree),
  });

  // Load the initial tree
  useEffect(() => {
    const loadTree = async () => {
      if (selectedFolder) {
        try {
          const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
          console.log('Loaded tree:', JSON.stringify(tree, null, 2));
          const processed = processTree(tree);
          console.log('Processed tree:', JSON.stringify(processed, null, 2));
          setFileTree([{ ...processed, expanded: true, loaded: true }]);
          const allFiles = collectAllFiles([processed]);
          console.log('All files at startup:', allFiles);
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

  // Function to toggle directory expansion
  const toggleDirectory = async (item: FileItem) => {
    if (!item.loaded && item.is_directory) {
      try {
        console.log(`Fetching subdirectory for: ${item.path}`);
        const result = await invoke<FileItem>("get_subdirectory", { path: item.path });
        setFileTree((prev) => {
          const updated = prev.map((root) => updateTree([root], item.path, result)[0]);
          return updated;
        });
      } catch (error) {
        console.error('Error loading subdirectory:', error);
      }
    } else {
      setFileTree((prev) => {
        return prev.map(root => ({
          ...root,
          expanded: root.path === item.path ? !root.expanded : root.expanded,
          children: root.children ? toggleExpanded(root.children, item.path) : undefined,
        }));
      });
    }
  };
  

  // Function to toggle expansion of subdirectories
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

  // Function to update the tree with new data
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

  // Function to create a new directory
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

  // Function to create a new file
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

  // Function to handle file click
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
              {item.expanded && item.children && (
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
          {console.log('Rendering context menu:', contextMenu)}
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
                y={contextMenu.y} path={''} onClose={function (): void {
                  throw new Error('Function not implemented.');
                } }            />
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;