import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitBranch, FileEdit, FilePlus, FileX, FolderOpen, RefreshCcw } from 'lucide-react';
import './GitChanges.css';

interface GitChange {
  status: string;
  path: string;
}

interface GitInfo {
  current_branch: string;
  changes: GitChange[];
  status: string;
  branches: string[];
}

interface FileItem {
  name: string;
  is_directory: boolean;
  path: string;
  children?: FileItem[];
}

// Функция для получения относительного пути
const getRelativePath = (fullPath: string, rootPath: string): string => {
  if (!fullPath || !rootPath) return fullPath || '';
  
  // Нормализуем пути для корректного сравнения
  const normalizedFullPath = fullPath.replace(/\\/g, '/');
  const normalizedRootPath = rootPath.replace(/\\/g, '/');
  
  if (!normalizedFullPath.startsWith(normalizedRootPath)) return normalizedFullPath;
  
  // Возвращаем относительный путь
  const relativePath = normalizedFullPath.slice(normalizedRootPath.length);
  return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
};

// Проверка, находится ли файл в указанной директории
const isInDirectory = (filePath: string, directory: string): boolean => {
  if (!filePath || !directory) return false;
  
  // Нормализуем пути для корректного сравнения
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const normalizedDirectory = directory.replace(/\\/g, '/');
  
  return normalizedFilePath.startsWith(normalizedDirectory) && normalizedFilePath !== normalizedDirectory;
};

// Функция для определения корня Git репозитория
const findGitRoot = async (folder: string): Promise<string | null> => {
  try {
    // Вызываем git rev-parse --show-toplevel
    const gitRoot = await invoke('git_command', {
      projectRoot: folder,
      command: 'rev-parse',
      args: ['--show-toplevel']
    }) as string;
    
    return gitRoot.trim();
  } catch (error) {
    console.log('Указанная папка не является Git-репозиторием:', error);
    return null;
  }
};

export const GitChanges: React.FC<{selectedFolder?: string | null}> = ({ selectedFolder }) => {
  const [gitInfo, setGitInfo] = useState<GitInfo>({
    current_branch: '',
    changes: [],
    status: 'clean',
    branches: []
  });
  const [directoryFiles, setDirectoryFiles] = useState<FileItem[]>([]);
  const [rootDirectory, setRootDirectory] = useState<string>('');
  const [gitRootDirectory, setGitRootDirectory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshGitStatus = async () => {
    if (!selectedFolder) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await updateGitInfo();
    } catch (error) {
      console.error('Ошибка при обновлении Git-информации:', error);
      setError('Не удалось обновить информацию о Git-изменениях');
    } finally {
      setLoading(false);
    }
  };

  // Получаем информацию о Git
  const updateGitInfo = async () => {
    if (!selectedFolder) {
      console.log('Папка не выбрана');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Получение информации Git для папки:', selectedFolder);
      
      // Определяем корень Git репозитория
      const gitRoot = await findGitRoot(selectedFolder);
      
      if (!gitRoot) {
        console.log('Выбранная папка не является частью Git-репозитория');
        setGitInfo({
          current_branch: '',
          changes: [],
          status: 'not-a-repo',
          branches: []
        });
        setLoading(false);
        return;
      }
      
      console.log('Найден корень Git-репозитория:', gitRoot);
      setGitRootDirectory(gitRoot);
      
      // Устанавливаем корневую директорию для вычисления относительных путей
      setRootDirectory(selectedFolder);
      
      // Получаем информацию о Git напрямую от git репозитория
      try {
        // Получаем текущую ветку
        const branchOutput = await invoke('git_command', {
          projectRoot: gitRoot,
          command: 'rev-parse',
          args: ['--abbrev-ref', 'HEAD']
        }) as string;
        const currentBranch = branchOutput.trim();
        
        console.log('Текущая ветка:', currentBranch);
        
        // Получаем статус репозитория через git status --porcelain
        const statusOutput = await invoke('git_command', {
          projectRoot: gitRoot,
          command: 'status',
          args: ['--porcelain']
        }) as string;
        
        console.log('Git статус:', statusOutput ? statusOutput : 'Нет изменений');
        
        // Парсим результат статуса
        const changes: GitChange[] = statusOutput
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const status = line.substring(0, 2).trim();
            const path = line.substring(3).trim();
            const fullPath = `${gitRoot}/${path}`;
            return { status, path: fullPath };
          });
        
        // Получаем список веток
        const branchesOutput = await invoke('git_command', {
          projectRoot: gitRoot,
          command: 'branch',
          args: ['--all']
        }) as string;
        
        const branches = branchesOutput
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.replace(/^\*\s+/, '').trim());
        
        // Определяем общий статус репозитория
        const status = changes.length > 0 ? 'modified' : 'clean';
        
        console.log(`Найдено ${changes.length} изменений, статус: ${status}`);
        
        // Обновляем состояние
        setGitInfo({
          current_branch: currentBranch,
          changes,
          status,
          branches
        });
        
        // Получаем структуру директории
        try {
          const dirTree = await invoke<FileItem>('get_directory_tree', { path: selectedFolder });
          setDirectoryFiles(dirTree.children || []);
        } catch (err) {
          console.error('Ошибка получения структуры директории:', err);
        }
      } catch (err) {
        console.error('Ошибка выполнения git-команды:', err);
        setError('Ошибка получения информации от Git');
      }
    } catch (error) {
      console.error('Ошибка получения информации Git:', error);
      setError('Не удалось получить информацию о Git');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateGitInfo();
    const interval = setInterval(updateGitInfo, 10000); // Обновляем каждые 10 секунд
    return () => clearInterval(interval);
  }, [selectedFolder]);

  const getStatusIcon = (status: string) => {
    switch (status.charAt(0)) {
      case 'M':
        return <FileEdit className="icon modified" />;
      case 'A':
        return <FilePlus className="icon added" />;
      case 'D':
        return <FileX className="icon deleted" />;
      case '?':
        return <FilePlus className="icon untracked" />;
      case 'R':
        return <FileEdit className="icon renamed" />;
      default:
        return <FileEdit className="icon" />;
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status.charAt(0)) {
      case 'M': return 'modified';
      case 'A': return 'added';
      case 'D': return 'deleted';
      case '?': return 'untracked';
      case 'R': return 'renamed';
      default: return '';
    }
  };

  // Фильтрация изменений для выбранной директории
  const filteredChanges = selectedFolder 
    ? gitInfo.changes.filter(change => {
        // Для файлов в выбранной директории или её подпапках
        if (isInDirectory(change.path, selectedFolder)) {
          return true;
        }
        
        // Для файлов, которые напрямую соответствуют выбранной директории
        if (change.path === selectedFolder) {
          return true;
        }
        
        return false;
      })
    : gitInfo.changes;

  return (
    <div className="git-changes">
      <div className="git-header">
        <GitBranch className="icon" />
        <span className="branch-name">{gitInfo.current_branch || 'Нет ветки'}</span>
        <button 
          onClick={refreshGitStatus} 
          className="refresh-button"
          disabled={loading}
          title="Обновить Git-информацию"
        >
          <RefreshCcw size={16} className={loading ? "spinning" : ""} />
        </button>
        {selectedFolder && (
          <div className="selected-folder">
            <FolderOpen size={14} />
            <span>{getRelativePath(selectedFolder, rootDirectory)}</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      <div className="changes-list">
        {loading ? (
          <div className="loading">Загрузка Git-изменений...</div>
        ) : filteredChanges.length > 0 ? (
          filteredChanges.map((change, index) => (
            <div key={index} className={`change-item ${getStatusClass(change.status)}`}>
              {getStatusIcon(change.status)}
              <span className="change-path">
                {getRelativePath(change.path, gitRootDirectory)}
              </span>
              <span className="change-status">{change.status}</span>
            </div>
          ))
        ) : selectedFolder ? (
          <div className="no-changes">
            Нет изменений в папке{' '}
            <span className="folder-path">{getRelativePath(selectedFolder, rootDirectory)}</span>
          </div>
        ) : (
          <div className="no-changes">Нет изменений</div>
        )}
      </div>
    </div>
  );
}; 