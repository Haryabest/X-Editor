import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileIcon, FolderIcon } from './fileIcons';
import { ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import FileContextMenu from './context/FileContextMenu';
import FolderContextMenu from './context/FolderContextMenu';

import "./style.css";

interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
  expanded: boolean;
  loaded: boolean;
}

interface FileManagerProps {
  selectedFolder: string | null;
  setSelectedFile: (filePath: string | null) => void;
  setCurrentFiles: (files: FileItem[]) => void; // Добавляем новый пропс
}


const FileManager: React.FC<FileManagerProps> = ({ selectedFolder, setSelectedFile, setCurrentFiles }) => {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDirectory: boolean;
  } | null>(null);

  useEffect(() => {
    const loadTree = async () => {
      if (selectedFolder) {
        try {
          const tree = await invoke<FileItem>("get_directory_tree", { path: selectedFolder });
          const processed = processTree(tree);
          
          // Собираем все файлы из корневой директории
          const rootFiles = processed.children?.filter(item => !item.is_directory) || [];
          setCurrentFiles(rootFiles.map(file => ({
            name: file.name,
            path: file.path,
            icon: getFileIcon(file.name),
            is_directory: false, // Указываем, что это не директория
            expanded: false,
            loaded: true, // Файл считается "загруженным" сразу
          })));

          setFileTree([{ ...processed, expanded: true, loaded: true }]);
        } catch (error) {
          console.error('Ошибка загрузки директории:', error);
          alert(`Не удалось загрузить директорию: ${error}`);
        }
      } else {
        setFileTree([]);
      }
    };
    loadTree();
  }, [selectedFolder]);

  const processTree = (item: FileItem): FileItem => ({
    ...item,
    expanded: false,
    loaded: item.is_directory ? item.children !== undefined : true,
    children: item.children?.map(processTree),
  });

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

  const toggleDirectory = async (item: FileItem) => {
    if (!item.loaded && item.is_directory) {
      try {
        const result = await invoke<FileItem>("get_subdirectory", { path: item.path });
        const processed = processTree(result);
        setFileTree((prev) => prev.map((root) => updateTree([root], item.path, processed)[0]));
      } catch (error) {
        console.error('Ошибка загрузки поддиректории:', error);
        alert(`Не удалось загрузить поддиректорию: ${error}`);
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

  const createNewDirectory = async (path: string) => {
    const newFolderName = prompt('Введите имя новой папки:');
    if (newFolderName) {
      try {
        await invoke("create_folder", { path: `${path}/${newFolderName}` });
        const result = await invoke<FileItem>("get_subdirectory", { path });
        setFileTree((prev) => prev.map((root) => updateTree([root], path, processTree(result))[0]));
      } catch (error) {
        console.error('Ошибка создания папки:', error);
        alert(`Не удалось создать папку: ${error}`);
      }
    }
  };

  const createNewFile = async (path: string) => {
    const newFileName = prompt('Введите имя файла:');
    if (newFileName) {
      try {
        await invoke("create_file", { path: `${path}/${newFileName}` });
        const parentPath = path.split('/').slice(0, -1).join('/') || path;
        const tree = await invoke<FileItem>("get_subdirectory", { path: parentPath });
        setFileTree((prev) =>
          prev.map((root) => updateTree([root], parentPath, processTree(tree))[0])
        );
      } catch (error) {
        console.error('Ошибка создания файла:', error);
        alert(`Не удалось создать файл: ${error}`);
      }
    }
  };

  const handleFileClick = (path: string, isDirectory: boolean) => {
    if (!isDirectory) {
      console.log('Selected file:', path);
      setSelectedFile(path); // Устанавливаем выбранный файл
    }
  };

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
              <div onClick={() => toggleDirectory(item)} className="directory-item">
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
              onClick={() => handleFileClick(item.path, item.is_directory)} // Обработчик ЛКМ для файлов
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
      <h5>ПРОВОДНИК</h5>
      {renderTree(fileTree)}
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