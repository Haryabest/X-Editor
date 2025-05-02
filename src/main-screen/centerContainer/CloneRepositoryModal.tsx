import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './CloneRepositoryModal.css';
import { 
  GitFork, 
  FolderSearch, 
  X, 
  Terminal, 
  GitBranch, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Download, 
  FileCode,
  Clock,
  Github,
  GitCommit,
  Info,
  Link,
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface CloneResponse {
  success: boolean;
  message: string;
}

interface CloneRepositoryModalProps {
  onClose: () => void;
  onClone: (repoUrl: string, targetDir: string) => Promise<CloneResponse>;
}

// Интерфейс для данных прогресса
interface CloneProgress {
  percentage: number;
  stage: string;
  currentFile?: string;
  filesProcessed?: number;
  totalFiles?: number;
  speed?: string;
  estimatedTimeLeft?: string;
}

interface ProgressPayload {
  stage: string;
  percentage: number;
  message: string;
}

const CloneRepositoryModal: React.FC<CloneRepositoryModalProps> = ({ onClose, onClone }) => {
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [targetDir, setTargetDir] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [cloneStarted, setCloneStarted] = useState<boolean>(false);
  const [useSimulation, setUseSimulation] = useState<boolean>(true);
  const [isUrlValid, setIsUrlValid] = useState<boolean | null>(null);
  const [showUrlExamples, setShowUrlExamples] = useState<boolean>(false);
  const [isUrlChecking, setIsUrlChecking] = useState<boolean>(false);
  const logContentRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Примеры репозиториев для подсказки
  const repoExamples = [
    { name: 'React', url: 'https://github.com/facebook/react.git', provider: 'github' },
    { name: 'VS Code', url: 'https://github.com/microsoft/vscode.git', provider: 'github' },
    { name: 'TensorFlow', url: 'https://github.com/tensorflow/tensorflow.git', provider: 'github' },
    { name: 'Rust', url: 'https://github.com/rust-lang/rust.git', provider: 'github' },
    { name: 'GitLab CE', url: 'https://gitlab.com/gitlab-org/gitlab-ce.git', provider: 'gitlab' }
  ];

  // Фокус на ввод URL при открытии модального окна
  useEffect(() => {
    if (urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, []);

  // Эффект для автоскролла логов
  useEffect(() => {
    if (logContentRef.current && logs.length > 0) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
    }
  }, [logs]);

  // Слушаем события прогресса от Tauri
  useEffect(() => {
    // Подписка на события прогресса клонирования
    const unlisten = listen<ProgressPayload>('git-clone-progress', (event) => {
      const { stage, percentage, message } = event.payload;
      
      // Обновляем логи
      setLogs(prev => [...prev, `[Git] ${message}`]);
      
      // Обновляем прогресс
      setProgress(prev => ({
        percentage,
        stage,
        currentFile: prev?.currentFile,
        filesProcessed: prev?.filesProcessed,
        totalFiles: prev?.totalFiles,
        speed: prev?.speed,
        estimatedTimeLeft: prev?.estimatedTimeLeft
      }));
      
      // Если получили 100%, значит клонирование завершено
      if (percentage === 100) {
        setIsLoading(false);
      }
    });
    
    // Отписываемся при размонтировании компонента
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Функция для симуляции обновления прогресса клонирования
  // В реальном приложении это будет заменено на данные от backend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let percentage = 0;
    const stages = [
      'Инициализация...',
      'Подключение к серверу...',
      'Получение информации о репозитории...',
      'Подсчет объектов...',
      'Компрессия данных...',
      'Скачивание файлов...',
      'Распаковка файлов...',
      'Установка ссылок...',
      'Финализация...'
    ];
    const fakeFiles = [
      'index.js', 'README.md', 'package.json', 'src/App.js', 
      'src/components/Header.js', 'src/components/Footer.js', 
      'src/styles/main.css', 'public/index.html', 'tests/main.test.js'
    ];
    let currentStageIndex = 0;
    let currentFileIndex = 0;

    // Только если клонирование запущено и используем симуляцию
    if (cloneStarted && isLoading && useSimulation) {
      timer = setInterval(() => {
        // Увеличиваем процент выполнения
        percentage += Math.random() * 2;
        
        // Добавляем логи периодически
        if (Math.random() > 0.7) {
          const log = `[Git] ${stages[currentStageIndex % stages.length]} ${Math.floor(percentage)}%`;
          setLogs(prev => [...prev, log]);
        }

        // Меняем этап выполнения
        if (percentage > (currentStageIndex + 1) * 10) {
          currentStageIndex++;
        }

        // Обновляем текущий файл
        if (percentage > 20 && percentage < 80) {
          currentFileIndex = Math.floor((percentage - 20) / (60 / fakeFiles.length));
          currentFileIndex = Math.min(currentFileIndex, fakeFiles.length - 1);
        }

        // Расчет оставшегося времени и скорости
        const totalFiles = fakeFiles.length;
        const filesProcessed = Math.min(Math.floor(percentage / 100 * totalFiles), totalFiles);
        const speed = `${(Math.random() * 500 + 500).toFixed(1)} KB/s`;
        const estimatedTimeLeft = `${Math.max(1, Math.floor((100 - percentage) / 10))} сек`;

        // Обновляем прогресс
        setProgress({
          percentage: Math.min(Math.floor(percentage), 100),
          stage: stages[currentStageIndex % stages.length],
          currentFile: percentage > 20 && percentage < 80 ? fakeFiles[currentFileIndex] : undefined,
          filesProcessed,
          totalFiles,
          speed,
          estimatedTimeLeft
        });

        // Завершаем таймер, если достигли 100%
        if (percentage >= 100) {
          clearInterval(timer);
          // Добавляем финальный лог
          setLogs(prev => [...prev, "[Git] Клонирование завершено успешно!"]);
          setIsLoading(false);
          setCloneStarted(false);
        }
      }, 300);

      return () => clearInterval(timer);
    }
  }, [cloneStarted, isLoading, useSimulation]);

  // Функция для выбора директории клонирования
  const handleBrowseDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Выберите директорию для клонирования',
      });
      
      if (selected) {
        // Сохраняем базовую директорию
        setTargetDir(selected as string);
        setError(null);
      }
    } catch (error) {
      console.error('Ошибка при выборе директории:', error);
      setError('Не удалось выбрать директорию');
    }
  };

  // Функция для извлечения имени репозитория из URL
  const extractRepoName = (url: string): string => {
    try {
      // Удаляем .git в конце, если есть
      let cleanUrl = url.trim();
      if (cleanUrl.endsWith('.git')) {
        cleanUrl = cleanUrl.slice(0, -4);
      }

      // Извлекаем последнюю часть пути
      const parts = cleanUrl.split('/');
      const repoName = parts[parts.length - 1];
      
      // Возвращаем имя или значение по умолчанию, если не удалось извлечь
      return repoName || 'repository';
    } catch (error) {
      return 'repository';
    }
  };

  // Получаем полный путь с именем репозитория
  const getFullTargetPath = (): string => {
    if (!targetDir || !repoUrl) return '';
    
    // Извлекаем имя репозитория из URL
    const repoName = extractRepoName(repoUrl);
    
    // Соединяем базовую директорию с именем репозитория
    return `${targetDir}/${repoName}`;
  };

  // Функция валидации URL репозитория
  const validateRepoUrl = (url: string): boolean => {
    // Проверка на пустой URL
    if (!url.trim()) return false;
    
    // Проверяем, соответствует ли URL формату Git-репозитория
    const gitRepoPatterns = [
      // GitHub
      /^(https?:\/\/)(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/,
      // GitLab
      /^(https?:\/\/)(www\.)?gitlab\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/,
      // Bitbucket
      /^(https?:\/\/)(www\.)?bitbucket\.org\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/,
      // SSH формат для GitHub, GitLab, и др.
      /^git@([A-Za-z0-9_.-]+):[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/,
      // Общий HTTP/HTTPS формат с .git в конце
      /^(https?:\/\/)[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+(\.git)$/
    ];
    
    return gitRepoPatterns.some(pattern => pattern.test(url));
  };

  // Обработчик изменения URL репозитория
  const handleRepoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setRepoUrl(newUrl);
    
    // Если URL пустой, сбрасываем состояние валидации
    if (!newUrl.trim()) {
      setIsUrlValid(null);
      return;
    }
    
    // Симулируем проверку URL
    setIsUrlChecking(true);
    
    // Симулируем задержку проверки
    setTimeout(() => {
      const isValid = validateRepoUrl(newUrl);
      setIsUrlValid(isValid);
      setIsUrlChecking(false);
      
      if (!isValid) {
        setError(null); // Сбрасываем ошибку, так как это интерактивная валидация
      }
    }, 500);
  };

  // Обработчик применения примера URL
  const applyExampleUrl = (url: string) => {
    setRepoUrl(url);
    setIsUrlChecking(true);
    
    // Симулируем задержку проверки
    setTimeout(() => {
      setIsUrlValid(true);
      setIsUrlChecking(false);
      setError(null);
      // Фокусируемся на следующем поле (директории)
    }, 300);
  };

  // Проверяем, является ли URL GitHub-репозиторием
  const isGithubRepo = (url: string): boolean => {
    return url.includes('github.com');
  };

  // Проверяем, является ли URL GitLab-репозиторием
  const isGitlabRepo = (url: string): boolean => {
    return url.includes('gitlab.com');
  };

  // Форматируем отображение URL репозитория
  const formatRepoUrl = (url: string): React.ReactNode => {
    try {
      // Получаем имя репозитория
      const repoName = extractRepoName(url);
      
      // Определяем провайдера (GitHub, GitLab и т.д.)
      let icon = <GitFork size={14} />;
      if (isGithubRepo(url)) {
        icon = <Github size={14} />;
      } else if (isGitlabRepo(url)) {
        icon = <Link size={14} />;
      }
      
      return (
        <div className="repo-url-display">
          {icon}
          <span className="repo-name">{repoName}</span>
          <span className="repo-url">{url}</span>
        </div>
      );
    } catch (error) {
      return url;
    }
  };

  // Обработчик формы клонирования репозитория
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Валидация URL перед отправкой
    if (!validateRepoUrl(repoUrl)) {
      setError('Пожалуйста, введите корректный URL Git-репозитория');
      setIsUrlValid(false);
      return;
    }
    
    // Проверяем, что директория выбрана
    if (!targetDir) {
      setError('Пожалуйста, выберите директорию для клонирования');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      setCloneStarted(true);
      setLogs([`[Git] Начинаем клонирование из ${repoUrl}`]);
      
      // Инициализируем прогресс
      setProgress({
        percentage: 0,
        stage: 'Подготовка...',
      });
      
      // Начинаем клонирование через функцию onClone
      const result = await onClone(repoUrl, getFullTargetPath());
      
      // Если используем симуляцию, то дальнейшие обновления прогресса
      // будут осуществляться useEffect-ом выше
      
      // Если не используем симуляцию и получили результат
      if (!useSimulation) {
        if (result.success) {
          setLogs(prev => [...prev, "[Git] Клонирование завершено успешно!"]);
          // Устанавливаем 100% прогресс
          setProgress(prev => {
            if (prev) {
              return {
                ...prev,
                percentage: 100,
                stage: 'Завершено',
              };
            } else {
              return {
                percentage: 100,
                stage: 'Завершено',
              };
            }
          });
          setIsLoading(false);
          setCloneStarted(false);
        } else {
          throw new Error(result.message);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Произошла неизвестная ошибка';
      setError(errorMessage);
      setLogs(prev => [...prev, `[Error] ${errorMessage}`]);
      setIsLoading(false);
      setCloneStarted(false);
      
      // Устанавливаем прогресс как прерванный
      setProgress(prev => {
        if (prev) {
          return {
            ...prev,
            stage: 'Ошибка',
          };
        } else {
          return {
            percentage: 0,
            stage: 'Ошибка',
          };
        }
      });
      
      console.error('Ошибка при клонировании:', err);
    }
  };

  // Компонент прогресс-бара
  const ProgressBar = ({ percentage }: { percentage: number }) => (
    <div className="progress-bar-container">
      <div 
        className="progress-bar-fill" 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            <GitFork size={18} />
            Клонировать репозиторий
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        {cloneStarted ? (
          <div className="cloning-progress">
            <div className="progress-container">
              <div className="progress-info">
                <div className="progress-stage">
                  {progress?.stage === 'Завершено' ? (
                    <CheckCircle2 size={16} color="#4caf50" />
                  ) : progress?.stage === 'Ошибка' ? (
                    <AlertCircle size={16} color="#e74c3c" />
                  ) : (
                    <span className="spinner">
                      <Loader2 size={16} className="spinning" />
                    </span>
                  )}
                  {progress?.stage || 'Подготовка...'}
                </div>
                <div className="progress-percentage">
                  {progress?.percentage || 0}%
                </div>
              </div>
              
              <ProgressBar percentage={progress?.percentage || 0} />
              
              {progress?.currentFile && (
                <div className="progress-file">
                  <FileCode size={14} />
                  {progress.currentFile}
                </div>
              )}
              
              {progress && (
                <div className="progress-stats">
                  {progress.filesProcessed !== undefined && progress.totalFiles !== undefined && (
                    <span>
                      <Download size={14} />
                      {progress.filesProcessed} / {progress.totalFiles} файлов
                    </span>
                  )}
                  
                  {progress.speed && (
                    <span>
                      <ArrowRight size={14} />
                      {progress.speed}
                    </span>
                  )}
                  
                  {progress.estimatedTimeLeft && (
                    <span>
                      <Clock size={14} />
                      Осталось: {progress.estimatedTimeLeft}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="log-container">
              <div className="log-header">
                <Terminal size={14} /> Журнал клонирования
              </div>
              <div className="log-content" ref={logContentRef}>
                {logs.map((log, index) => {
                  const isError = log.includes('[Error]');
                  return (
                    <div key={index} className={`log-entry ${isError ? 'error' : ''}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="form-button form-button-secondary" 
                onClick={onClose}
                disabled={isLoading && progress?.percentage !== 100 && progress?.stage !== 'Ошибка'}
              >
                Закрыть
              </button>
              
              {(progress?.percentage === 100 || progress?.stage === 'Ошибка') && (
                <button 
                  className="form-button" 
                  onClick={onClose}
                >
                  {progress?.stage === 'Ошибка' ? 'Закрыть' : 'Готово'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label" htmlFor="repo-url">URL репозитория</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  id="repo-url"
                  className={`form-input with-icon ${isUrlValid === true ? 'is-valid' : isUrlValid === false ? 'is-invalid' : ''}`}
                  value={repoUrl}
                  onChange={handleRepoUrlChange}
                  placeholder="https://github.com/username/repository.git"
                  required
                  ref={urlInputRef}
                />
                <Link className={`input-icon ${isUrlValid === true ? 'valid-icon' : isUrlValid === false ? 'invalid-icon' : ''}`} size={16} />
                
                {isUrlChecking ? (
                  <Loader2 size={16} className="input-status-icon spinning" />
                ) : isUrlValid === true ? (
                  <Check size={16} className="input-status-icon valid" />
                ) : isUrlValid === false ? (
                  <AlertTriangle size={16} className="input-status-icon invalid-icon" />
                ) : null}
              </div>
              
              <div className="url-help-section">
                <div className="form-hint">
                  {isUrlValid === true ? 
                    'URL репозитория корректен' : 
                    'Введите URL в формате https://github.com/username/repo.git'
                  }
                </div>
                
                <button 
                  type="button" 
                  className="url-examples-toggle"
                  onClick={() => setShowUrlExamples(!showUrlExamples)}
                >
                  {showUrlExamples ? 'Скрыть примеры' : 'Показать примеры'}
                  <Info size={12} />
                </button>
              </div>
              
              {showUrlExamples && (
                <div className="url-examples">
                  <div className="url-examples-header">
                    Примеры Git-репозиториев для клонирования:
                  </div>
                  <div className="url-examples-list">
                    {repoExamples.map((example, index) => (
                      <button
                        key={index}
                        type="button"
                        className="example-url-button"
                        onClick={() => applyExampleUrl(example.url)}
                      >
                        {example.provider === 'github' ? (
                          <Github size={14} />
                        ) : example.provider === 'gitlab' ? (
                          <GitBranch size={14} />
                        ) : (
                          <GitFork size={14} />
                        )}
                        <span className="example-name">{example.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="target-dir">Директория для клонирования</label>
              <div className="input-with-button">
                <div className="input-with-icon">
                  <input
                    type="text"
                    id="target-dir"
                    className="form-input with-icon"
                    value={targetDir}
                    onChange={(e) => setTargetDir(e.target.value)}
                    placeholder="Выберите директорию..."
                    readOnly
                    required
                  />
                  <FolderSearch size={16} className="input-icon" />
                </div>
                <button 
                  type="button" 
                  className="form-button browse-button" 
                  onClick={handleBrowseDirectory}
                >
                  Обзор...
                </button>
              </div>
              
              {repoUrl && targetDir && (
                <div className="form-hint target-path-preview">
                  Будет клонировано в: <strong>{getFullTargetPath()}</strong>
                </div>
              )}
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="form-button form-button-secondary"
                onClick={onClose}
              >
                Отмена
              </button>
              
              <button 
                type="submit" 
                className="form-button"
                disabled={isLoading || !repoUrl || !targetDir || isUrlValid === false}
              >
                <GitFork size={16} />
                Клонировать
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CloneRepositoryModal; 