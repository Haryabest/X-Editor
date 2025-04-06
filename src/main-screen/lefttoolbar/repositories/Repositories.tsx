import React, { useState, useEffect, useRef } from 'react';
import { GitFork, Star, Eye, GitBranch, ExternalLink, Book, RefreshCcw, AlertCircle, Calendar, Clock, Code, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './Repositories.css';

interface Repository {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  default_branch: string;
  html_url: string;
  private: boolean;
  clone_url: string;
  language: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  topics: string[];
  open_issues_count: number;
}

interface RepositoriesProps {
  isVisible: boolean;
}

const Repositories: React.FC<RepositoriesProps> = ({ isVisible }) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [userLogin, setUserLogin] = useState<string | null>(localStorage.getItem('github_user_login'));
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem('github_token')));
  const [repoCount, setRepoCount] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && isLoggedIn) {
      fetchUserRepositories();
    }
  }, [isVisible, isLoggedIn]);

  // Проверяем изменения токена в localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('github_token');
      const login = localStorage.getItem('github_user_login');
      
      setAccessToken(token);
      setUserLogin(login);
      setIsLoggedIn(Boolean(token));
      
      if (token) {
        fetchUserRepositories();
      } else {
        setRepositories([]);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Добавляем кастомное событие для обновления при входе/выходе
    const handleAuthChange = () => {
      handleStorageChange();
    };
    
    document.addEventListener('auth-changed', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('auth-changed', handleAuthChange);
    };
  }, []);

  // Добавляем отслеживание размера контейнера
  useEffect(() => {
    if (!isVisible) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    // Инициализируем ширину
    updateWidth();
    
    // Наблюдаем за изменениями размера
    const resizeObserver = new ResizeObserver(updateWidth);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current as Element);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible]);

  const fetchUserRepositories = async () => {
    if (!accessToken) {
      setError('Не авторизован. Войдите через GitHub в меню аккаунта.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Получаем репозитории пользователя через GitHub API
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API вернул ошибку: ${response.status}`);
      }

      const data = await response.json();
      setRepoCount(data.length);
      
      // Преобразуем данные в нужный формат
      const formattedRepos: Repository[] = data.map((repo: any) => ({
        name: repo.name,
        description: repo.description,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        private: repo.private,
        clone_url: repo.clone_url,
        language: repo.language,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        },
        topics: repo.topics || [],
        open_issues_count: repo.open_issues_count
      }));

      setRepositories(formattedRepos);
      setLoading(false);
    } catch (err) {
      console.error('Ошибка при получении репозиториев:', err);
      setError('Не удалось загрузить репозитории. Проверьте соединение или авторизацию.');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const timeSince = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
    let interval = seconds / 31536000;
    if (interval > 1) {
      return Math.floor(interval) + " лет назад";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + " мес. назад";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + " дн. назад";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + " ч. назад";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + " мин. назад";
    }
    return Math.floor(seconds) + " сек. назад";
  };

  const getLanguageColor = (language: string | null) => {
    if (!language) return '#999';
    
    const colors: {[key: string]: string} = {
      'JavaScript': '#f1e05a',
      'TypeScript': '#3178c6',
      'Python': '#3572A5',
      'Java': '#b07219',
      'C#': '#178600',
      'PHP': '#4F5D95',
      'C++': '#f34b7d',
      'C': '#555555',
      'Ruby': '#701516',
      'Go': '#00ADD8',
      'Rust': '#dea584',
      'Swift': '#F05138',
      'Kotlin': '#A97BFF',
      'Dart': '#00B4AB',
      'HTML': '#e34c26',
      'CSS': '#563d7c'
    };
    
    return colors[language] || '#999';
  };

  const handleClone = async (repo: Repository) => {
    if (!repo.clone_url) {
      setError('URL для клонирования не найден');
      return;
    }

    try {
      // Открываем диалог выбора директории через Tauri API
      const selected = await open({
        directory: true,
        multiple: false,
        title: `Выберите директорию для клонирования ${repo.name}`
      });
      
      if (!selected || Array.isArray(selected)) {
        console.log('Выбор директории отменен пользователем');
        return;
      }
      
      const directory = selected as string;
      
      // Показываем пользователю, что начался процесс клонирования
      setLoading(true);
      setError(null);
      
      // Клонируем репозиторий с помощью Git
      const targetPath = `${directory}/${repo.name}`;
      
      await invoke('git_clone_repository', { 
        url: repo.clone_url,
        targetPath
      });
      
      setLoading(false);
      
      // Отправляем событие для открытия папки в проводнике файлов
      const openFolderEvent = new CustomEvent('open-folder', { 
        detail: { 
          path: targetPath 
        } 
      });
      
      document.dispatchEvent(openFolderEvent);
    } catch (err) {
      console.error('Ошибка при клонировании репозитория:', err);
      setError(`Ошибка при клонировании: ${err}`);
      setLoading(false);
    }
  };

  const handleOpen = async (repo: Repository) => {
    try {
      // Открываем диалог выбора директории через Tauri API
      const selected = await open({
        directory: true,
        multiple: false,
        title: `Выберите директорию с репозиторием ${repo.name}`
      });
      
      if (!selected || Array.isArray(selected)) {
        console.log('Выбор директории отменен пользователем');
        return;
      }
      
      const repoPath = selected as string;
      
      // Отправляем событие для открытия папки в проводнике файлов
      const openFolderEvent = new CustomEvent('open-folder', { 
        detail: { 
          path: repoPath 
        } 
      });
      
      document.dispatchEvent(openFolderEvent);
    } catch (err) {
      console.error('Ошибка при открытии репозитория:', err);
      setError(`Ошибка при открытии: ${err}`);
    }
  };

  const handleOpenInBrowser = (url: string) => {
    window.open(url, '_blank');
  };

  const handleRefresh = () => {
    fetchUserRepositories();
  };

  if (!isVisible) return null;

  const isNarrow = containerWidth < 350;
  const isVeryNarrow = containerWidth < 300;

  return (
    <div className="repositories-modal" ref={containerRef}>
      <div className="repositories-content">
        <div className="header">
          <div className="title">
            <Book color="#fff" size={isNarrow ? 14 : 16} />
            <h2>{isNarrow ? 'Репозитории' : `Репозитории GitHub ${userLogin ? `(${userLogin})` : ''}`}</h2>
            {repoCount > 0 && <span className="repo-count">{repoCount}</span>}
          </div>
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            title="Обновить список репозиториев"
            disabled={loading}
          >
            <RefreshCcw size={isNarrow ? 12 : 14} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="loading">Загрузка репозиториев...</div>
        ) : error ? (
          <div className="error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : repositories.length === 0 ? (
          <div className="empty-state">
            {isLoggedIn 
              ? 'У вас нет репозиториев на GitHub'
              : 'Войдите через GitHub в меню аккаунта, чтобы увидеть свои репозитории'
            }
          </div>
        ) : (
          <div className="repositories-list">
            {repositories.map((repo) => (
              <div key={repo.name} className="repository-item">
                <div className="repo-header">
                  <h3 className="repo-name">
                    {repo.name}
                    {repo.private && !isVeryNarrow && <span className="private-badge">Private</span>}
                  </h3>
                  <button
                    className="external-link"
                    onClick={() => handleOpenInBrowser(repo.html_url)}
                    title="Открыть на GitHub"
                  >
                    <ExternalLink size={isNarrow ? 14 : 16} />
                  </button>
                </div>
                
                {!isVeryNarrow && <p className="repo-description">{repo.description || 'Нет описания'}</p>}
                
                {!isVeryNarrow && repo.topics && repo.topics.length > 0 && (
                  <div className="repo-topics">
                    {repo.topics.slice(0, isNarrow ? 2 : 3).map(topic => (
                      <span key={topic} className="topic-badge">{topic}</span>
                    ))}
                    {repo.topics.length > (isNarrow ? 2 : 3) && (
                      <span className="topic-more">+{repo.topics.length - (isNarrow ? 2 : 3)}</span>
                    )}
                  </div>
                )}
                
                <div className="repo-stats">
                  <span className="stat">
                    <Star size={isNarrow ? 14 : 16} />
                    {repo.stars}
                  </span>
                  <span className="stat">
                    <GitFork size={isNarrow ? 14 : 16} />
                    {repo.forks}
                  </span>
                  {!isNarrow && (
                    <span className="stat">
                      <Eye size={16} />
                      {repo.watchers}
                    </span>
                  )}
                  <span className="stat">
                    <GitBranch size={isNarrow ? 14 : 16} />
                    {repo.default_branch}
                  </span>
                  {repo.language && (
                    <span className="stat language">
                      <span 
                        className="language-color" 
                        style={{ backgroundColor: getLanguageColor(repo.language) }}
                      ></span>
                      {repo.language}
                    </span>
                  )}
                </div>
                
                <div className="repo-meta">
                  <div className="meta-item" title={`Создан: ${formatDate(repo.created_at)}`}>
                    <Calendar size={isNarrow ? 12 : 14} />
                    <span>Создан {timeSince(repo.created_at)}</span>
                  </div>
                  <div className="meta-item" title={`Обновлен: ${formatDate(repo.updated_at)}`}>
                    <Clock size={isNarrow ? 12 : 14} />
                    <span>{isNarrow ? '' : 'Обновлен'} {timeSince(repo.updated_at)}</span>
                  </div>
                  {repo.open_issues_count > 0 && !isVeryNarrow && (
                    <div className="meta-item">
                      <AlertCircle size={isNarrow ? 12 : 14} />
                      <span>{repo.open_issues_count} issues</span>
                    </div>
                  )}
                </div>

                <div className="repo-actions">
                  <button 
                    className="action-button clone"
                    onClick={() => handleClone(repo)}
                  >
                    <Code size={isNarrow ? 12 : 14} />
                    {isNarrow ? 'Клон.' : 'Клонировать'}
                  </button>
                  <button 
                    className="action-button open"
                    onClick={() => handleOpen(repo)}
                  >
                    <FolderOpen size={isNarrow ? 12 : 14} />
                    Открыть
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Repositories; 