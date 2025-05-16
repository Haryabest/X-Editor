import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitBranch, FileEdit, FilePlus, FileX, FolderOpen, RefreshCcw, ChevronDown, ChevronRight, User, Clock, Info, MessageSquare } from 'lucide-react';
import './GitChanges.css';

interface GitChange {
  status: string;
  path: string;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  relativeDate: string;
  stats?: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

interface GitInfo {
  current_branch: string;
  changes: GitChange[];
  status: string;
  branches: string[];
  commits: GitCommit[];
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
    branches: [],
    commits: []
  });
  const [directoryFiles, setDirectoryFiles] = useState<FileItem[]>([]);
  const [rootDirectory, setRootDirectory] = useState<string>('');
  const [gitRootDirectory, setGitRootDirectory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommits, setShowCommits] = useState<boolean>(true);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'changes' | 'commits'>('changes');

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
          branches: [],
          commits: []
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
        
        // Получаем последние коммиты с расширенной информацией
        const commitsOutput = await invoke('git_command', {
          projectRoot: gitRoot,
          command: 'log',
          args: [
            '--pretty=format:%H|%h|%s|%an|%ae|%ad|%at|%ar', 
            '--date=format:%B %d, %Y at %H:%M:%S',
            '--max-count=30'
          ]
        }) as string;
        
        // Парсим коммиты с расширенной информацией
        const commits: GitCommit[] = commitsOutput
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [hash, shortHash, message, author, email, date, timestamp, relativeDate] = line.split('|');
            return { 
              hash, 
              shortHash, 
              message, 
              author, 
              email,
              date, 
              timestamp: parseInt(timestamp, 10),
              relativeDate,
              stats: undefined 
            };
          });
        
        // Определяем общий статус репозитория
        const status = changes.length > 0 ? 'modified' : 'clean';
        
        console.log(`Найдено ${changes.length} изменений, ${commits.length} коммитов, статус: ${status}`);
        
        // Обновляем состояние
        setGitInfo({
          current_branch: currentBranch,
          changes,
          status,
          branches,
          commits
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

  // Получаем подробную информацию о коммите
  const fetchCommitDetails = async (hash: string) => {
    if (!gitRootDirectory) return;
    
    try {
      // Получаем статистику (добавлено/удалено строк)
      const statsOutput = await invoke('git_command', {
        projectRoot: gitRootDirectory,
        command: 'show',
        args: ['--stat', '--format=', hash]
      }) as string;
      
      // Находим строку с общей статистикой
      const statsLine = statsOutput.split('\n').find(line => line.includes('changed,') && (line.includes('insertion') || line.includes('deletion')));
      
      let additions = 0;
      let deletions = 0;
      let filesChanged = 0;
      
      if (statsLine) {
        const filesMatch = statsLine.match(/(\d+) file/);
        const addMatch = statsLine.match(/(\d+) insertion/);
        const delMatch = statsLine.match(/(\d+) deletion/);
        
        if (filesMatch) filesChanged = parseInt(filesMatch[1], 10);
        if (addMatch) additions = parseInt(addMatch[1], 10);
        if (delMatch) deletions = parseInt(delMatch[1], 10);
      }
      
      // Обновляем состояние коммита
      setGitInfo(prev => {
        const updatedCommits = prev.commits.map(commit => {
          if (commit.hash === hash) {
            return { ...commit, stats: { additions, deletions, filesChanged } };
          }
          return commit;
        });
        
        return { ...prev, commits: updatedCommits };
      });
    } catch (error) {
      console.error('Ошибка получения детальной информации о коммите:', error);
    }
  };

  // Обработчик переключения состояния коммита (свернут/развернут)
  const toggleCommit = (hash: string) => {
    setExpandedCommits(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(hash)) {
        newExpanded.delete(hash);
      } else {
        newExpanded.add(hash);
        // Получаем детали коммита при разворачивании
        fetchCommitDetails(hash);
      }
      return newExpanded;
    });
  };

  useEffect(() => {
    updateGitInfo();
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
      
      <div className="minimal-button-container">
        <button 
          className={`minimal-button ${activeTab === 'changes' ? 'active' : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          <FileEdit size={10} className="button-icon" />
          <span>Изменения</span>
        </button>
        <button 
          className={`minimal-button ${activeTab === 'commits' ? 'active' : ''}`}
          onClick={() => setActiveTab('commits')}
        >
          <MessageSquare size={10} className="button-icon" />
          <span>Коммиты</span>
        </button>
      </div>
      
      {activeTab === 'changes' && (
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
      )}
      
      {activeTab === 'commits' && (
        <div className="commits-list">
          {loading ? (
            <div className="loading">Загрузка коммитов...</div>
          ) : gitInfo.commits.length > 0 ? (
            gitInfo.commits.map((commit, index) => (
              <div key={index} className="commit-container">
                <div 
                  className={`commit-header ${expandedCommits.has(commit.hash) ? 'expanded' : ''}`}
                  onClick={() => toggleCommit(commit.hash)}
                >
                  <div className="commit-left">
                    {expandedCommits.has(commit.hash) ? 
                      <ChevronDown size={16} className="commit-chevron" /> : 
                      <ChevronRight size={16} className="commit-chevron" />
                    }
                    <div className="commit-avatar">
                      {commit.author.substring(0, 2).toLowerCase()}
                    </div>
                  </div>
                  <div className="commit-content">
                    {expandedCommits.has(commit.hash) ? (
                      <>
                        <div className="commit-info-line">
                          <span className="commit-author-name">{commit.author}</span>
                          <span className="commit-time">{commit.relativeDate} ({commit.date})</span>
                        </div>
                        <div className="commit-message-line">{commit.message}</div>
                        
                        {commit.stats && (
                          <div className="commit-summary-line">
                            <span>{commit.stats.filesChanged} {getFilesCountText(commit.stats.filesChanged)} изменено,</span>
                            <span className="stats-additions-text">{commit.stats.additions} {getAdditionsText(commit.stats.additions)}(+),</span>
                            <span className="stats-deletions-text">{commit.stats.deletions} {getDeletionsText(commit.stats.deletions)}(-)</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="commit-collapsed-content">
                        <div className="commit-date-line">
                          {commit.relativeDate} ({commit.date.split(' at ')[0]})
                        </div>
                        <div className="commit-message-line">{commit.message}</div>
                        {commit.stats && (
                          <div className="commit-brief-stats">
                            <span>{commit.stats.filesChanged} {getFilesCountText(commit.stats.filesChanged)},</span>
                            <span className="stats-additions-text">{commit.stats.additions}(+),</span>
                            <span className="stats-deletions-text">{commit.stats.deletions}(-)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {expandedCommits.has(commit.hash) && (
                  <div className="commit-details">
                    <div className="commit-detail-buttons">
                      <button className="commit-detail-button commit-id">
                        <span className="button-icon">#{commit.shortHash}</span>
                      </button>
                      <button className="commit-detail-button">
                        <MessageSquare size={14} className="button-icon" />
                        <span>Сообщение</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-commits">
              Нет коммитов в репозитории
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Вспомогательные функции для русификации текстов
function getFilesCountText(count: number): string {
  if (count === 0) return 'файлов';
  if (count === 1) return 'файл';
  if (count >= 2 && count <= 4) return 'файла';
  return 'файлов';
}

function getAdditionsText(count: number): string {
  if (count === 0) return 'добавлений';
  if (count === 1) return 'добавление';
  if (count >= 2 && count <= 4) return 'добавления';
  return 'добавлений';
}

function getDeletionsText(count: number): string {
  if (count === 0) return 'удалений';
  if (count === 1) return 'удаление';
  if (count >= 2 && count <= 4) return 'удаления';
  return 'удалений';
} 