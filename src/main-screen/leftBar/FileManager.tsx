import React, { useEffect, useState } from 'react';
import { readDir, DirEntry } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileManagerProps {
  selectedFolder: string | null;
}

const FileManager: React.FC<FileManagerProps> = ({ selectedFolder }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    if (selectedFolder) {
      fetchFolderContents(selectedFolder);
    }
  }, [selectedFolder]);

  // Загрузка файлов в папке
  const fetchFolderContents = async (folderPath: string) => {
    try {
      const entries: DirEntry[] = await readDir(folderPath);
      const parsedFiles: FileItem[] = entries.map(entry => ({
        name: entry.name || '',
        isDirectory: entry.isDirectory || false,
        path: `${folderPath}/${entry.name}`,
      }));
      setFiles(parsedFiles);
    } catch (error) {
      console.error('Ошибка при чтении папки:', error);
    }
  };

  // Переключение раскрытия папок
  const toggleDirectory = async (path: string) => {
    setExpandedDirs(prev => {
      const newDirs = new Set(prev);
      if (newDirs.has(path)) {
        newDirs.delete(path);
      } else {
        newDirs.add(path);
        fetchFolderContents(path);
      }
      return newDirs;
    });
  };

  // Создание папки
  const createNewDirectory = async (path: string) => {
    const newFolderName = prompt('Введите имя новой папки:');
    if (newFolderName) {
      const newFolderPath = `${path}/${newFolderName}`;
      try {
        await invoke("create_folder", { path: newFolderPath });
        alert('Папка создана!');
        fetchFolderContents(path);
      } catch (error) {
        console.error('Ошибка при создании папки:', error);
        alert(error); // Показываем ошибку пользователю
      }
    }
  };
  

  // Создание файла
  const createNewFile = async (path: string) => {
    const newFileName = prompt('Введите имя нового файла (с расширением):');
    if (newFileName) {
      const newFilePath = `${path}/${newFileName}`;
      try {
        await invoke("create_file", { path: newFilePath });
        alert('Файл создан!');
        fetchFolderContents(path);
      } catch (error) {
        console.error('Ошибка при создании файла:', error);
      }
    }
  };

  // Обработчик ПКМ
  const handleContextMenu = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, path });
  };

  // Закрытие контекстного меню
  const closeContextMenu = () => setContextMenu(null);

  return (
    <div className="file-manager" onClick={closeContextMenu}>
      <h3>ПРОВОДНИК</h3>
      <ul className="file-tree">
        {files.map((file) => (
          <li key={file.path} onContextMenu={(e) => handleContextMenu(e, file.path)}>
            {file.isDirectory ? (
              <div>
                <span onClick={() => toggleDirectory(file.path)}>
                  {expandedDirs.has(file.path) ? '▼' : '▶'} {file.name}
                </span>
                {expandedDirs.has(file.path) && <ul></ul>}
              </div>
            ) : (
              <span>{file.name}</span>
            )}
          </li>
        ))}
      </ul>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x, position: 'absolute' }}
        >
          <button onClick={() => createNewDirectory(contextMenu.path)}>Создать папку</button>
          <button onClick={() => createNewFile(contextMenu.path)}>Создать файл</button>
        </div>
      )}

      <style>{`
        .file-manager {
          padding: 10px;
          background: #1e1e1e;
          color: white;
          width: 300px;
        }
        .file-tree {
          list-style: none;
          padding: 0;
        }
        .file-tree li {
          padding: 5px;
          cursor: pointer;
        }
        .context-menu {
          background: #333;
          padding: 5px;
          border-radius: 5px;
          box-shadow: 0px 0px 5px rgba(255, 255, 255, 0.2);
        }
        .context-menu button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          display: block;
          width: 100%;
          padding: 5px;
        }
        .context-menu button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default FileManager;
