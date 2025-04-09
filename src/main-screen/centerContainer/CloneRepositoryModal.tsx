import React, { useState, FormEvent, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

  // Function to browse for the target directory
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

  // Function to handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLogs([]);
    setProgress(null);
    
    // Validate inputs
    if (!repoUrl.trim()) {
      setError('Пожалуйста, укажите URL репозитория');
      return;
    }
    
    if (!targetDir.trim()) {
      setError('Пожалуйста, выберите директорию для клонирования');
      return;
    }
    
    // Simple URL validation
    const gitUrlPattern = /^(https?:\/\/)?([\w.-]+@)?([\w.-]+\.[a-z]{2,})(:\d+)?\/.*\.git$/i;
    if (!gitUrlPattern.test(repoUrl) && !repoUrl.includes('github.com')) {
      setError('Пожалуйста, введите корректный URL Git репозитория');
      return;
    }
    
    try {
      setIsLoading(true);
      // Запускаем отображение прогресса
      setCloneStarted(true);
      
      // Добавляем начальные логи
      setLogs(['[Git] Начинаем клонирование репозитория...', `[Git] URL: ${repoUrl}`]);
      
      // Получаем полный путь с именем репозитория
      const fullTargetPath = getFullTargetPath();
      setLogs(prev => [...prev, `[Git] Целевая директория: ${fullTargetPath}`]);
      
      // Отключаем симуляцию при использовании реального API
      setUseSimulation(false);
      
      // Call the parent component's clone function
      const response = await onClone(repoUrl, fullTargetPath);
      
      if (!response.success) {
        setError(`Ошибка при клонировании: ${response.message}`);
        setLogs(prev => [...prev, `[Error] ${response.message}`]);
        setCloneStarted(false);
        setIsLoading(false);
      }
      // If successful, the modal will be closed by the parent component
    } catch (error) {
      console.error('Ошибка при клонировании репозитория:', error);
      setError(`Ошибка при клонировании: ${error instanceof Error ? error.message : String(error)}`);
      setLogs(prev => [...prev, `[Error] ${error instanceof Error ? error.message : String(error)}`]);
      setCloneStarted(false);
      setIsLoading(false);
    }
  };

  // Компонент прогресс-бара
  const ProgressBar = ({ percentage }: { percentage: number }) => (
    <div style={{ 
      width: '100%', 
      height: '10px', 
      backgroundColor: '#e0e0e0', 
      borderRadius: '5px',
      marginBottom: '10px',
      overflow: 'hidden'
    }}>
      <div style={{ 
        width: `${percentage}%`, 
        height: '100%', 
        backgroundColor: '#4caf50',
        transition: 'width 0.3s ease-in-out'
      }} />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Клонировать Git репозиторий</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="repo-url" className="form-label">URL репозитория</label>
            <input
              id="repo-url"
              type="text"
              className="form-input"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository.git"
              disabled={isLoading}
            />
            <div className="form-hint">Например: https://github.com/username/repository.git</div>
          </div>
          
          <div className="form-group">
            <label htmlFor="target-dir" className="form-label">Директория для клонирования</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                id="target-dir"
                type="text"
                className="form-input"
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                placeholder="Выберите директорию..."
                disabled={isLoading}
                style={{ flex: 1 }}
                readOnly
              />
              <button
                type="button"
                className="form-button"
                onClick={handleBrowseDirectory}
                disabled={isLoading}
              >
                Обзор...
              </button>
            </div>
            {targetDir && repoUrl && (
              <div className="form-hint" style={{ marginTop: '5px', color: '#4caf50' }}>
                Репозиторий будет клонирован в: {getFullTargetPath().replace(/\//g, '\\')}
              </div>
            )}
          </div>
          
          {error && (
            <div style={{ color: '#e74c3c', marginBottom: '10px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          
          {cloneStarted && progress && (
            <div className="progress-container" style={{ marginBottom: '15px' }}>
              <ProgressBar percentage={progress.percentage} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px' }}>{progress.stage}</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{progress.percentage}%</span>
              </div>
              
              {progress.currentFile && (
                <div style={{ fontSize: '13px', marginBottom: '3px' }}>
                  Файл: {progress.currentFile}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Файлы: {progress.filesProcessed}/{progress.totalFiles}</span>
                <span>Скорость: {progress.speed}</span>
                <span>Осталось: {progress.estimatedTimeLeft}</span>
              </div>
              
              <div 
                style={{
                  marginTop: '10px',
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#333'
                }}
              >
                {logs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '2px' }}>
                    {log.includes('[Error]') ? (
                      <span style={{ color: '#e74c3c' }}>{log}</span>
                    ) : (
                      <span>{log}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="form-actions">
            <button
              type="button"
              className="form-button form-button-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="form-button"
              disabled={isLoading}
            >
              {isLoading ? 'Клонирование...' : 'Клонировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloneRepositoryModal; 