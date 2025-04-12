import React, { useState, useEffect } from "react";
import { CircleX, CircleAlert, Bell, Check, GitCommit, GitPullRequest, User, GitBranch } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';
import { FaPython } from "react-icons/fa";

import LanguageDropdown from "./modals/Language/ModalsLanguage";
import PositionDropdown from "./modals/Position/ModalsPosition";
import NotificationsDropdown from "./modals/Notification/ModalsNotification";
import GitBranches from "./modals/GitBranches/GitBranches";
import GitCommitModal from "./modals/GitCommit/GitCommit";

// Для лучшей типизации
import type { MouseEvent as ReactMouseEvent } from "react";

import "devicon/devicon.min.css";
import "./style.css";

const tooltips = {  
  encoding: "Кодировка",
  indent: "Настройки отступа",
  position: "Позиция курсора",
  language: "Выбрать язык",
  notifications: "Уведомления",
  gitPush: "Git Push",
  gitPull: "Git Pull",
  gitBranch: "Ветки Git",
  user: "Пользователь", // Добавляем тултип для логина
  gitCommit: "Git commit",
  pythonLint: "Проверить Python ошибки", // Добавляем новый тултип
};

type VisibleElementKeys = keyof typeof visibleElementsInitialState;

interface BottomToolbarProps {
  editorInfo?: {
    errors: number;
    warnings: number;
    language: string;
    encoding: string;
    cursorInfo: {
      line: number;
      column: number;
      totalChars: number;
    };
    gitBranch?: string;
  };
  userLogin?: string | null; // Добавляем пропс для логина
  gitInfo: GitInfo;
  selectedFolder: string | null;
  onGitInfoChange?: (gitInfo: GitInfo) => void; // Добавляем колбэк для обновления gitInfo
}

interface GitInfo {
  current_branch: string;
  status: string;
}



const visibleElementsInitialState = {
  encoding: true,
  lineEnding: true,
  indentation: true,
  language: true,
  notifications: true,
  gitBranch: true,
  position: true,
  user: true,
};

const BottomToolbar: React.FC<BottomToolbarProps> = ({ editorInfo, userLogin, gitInfo, selectedFolder, onGitInfoChange }) => {
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [localGitInfo, setLocalGitInfo] = useState<GitInfo>(gitInfo);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  const [visibleElements, setVisibleElements] = useState(visibleElementsInitialState);

  const [errorCount, setErrorCount] = useState(editorInfo?.errors || 0);
  const [warningCount, setWarningCount] = useState(editorInfo?.warnings || 0);
  
  // Обработчик изменений в editorInfo
  useEffect(() => {
    setErrorCount(editorInfo?.errors || 0);
    setWarningCount(editorInfo?.warnings || 0);
  }, [editorInfo]);
  
  // Слушатель для обновлений маркеров Python
  useEffect(() => {
    const updatePythonDiagnostics = () => {
      try {
        // Получаем Python диагностику, если доступна
        if ((window as any).getPythonDiagnostics) {
          const pythonIssues = (window as any).getPythonDiagnostics();
          
          // Подсчитываем количество ошибок и предупреждений
          let pythonErrors = 0;
          let pythonWarnings = 0;
          
          if (pythonIssues && Array.isArray(pythonIssues)) {
            pythonIssues.forEach((fileIssue: any) => {
              fileIssue.issues?.forEach((issue: any) => {
                if (issue.severity === 'error') {
                  pythonErrors++;
                } else if (issue.severity === 'warning') {
                  pythonWarnings++;
                }
              });
            });
          }
          
          // Обновляем счетчики, учитывая Python диагностику и диагностику из editorInfo
          setErrorCount(prevErrors => {
            const baseErrors = editorInfo?.errors || 0;
            return baseErrors + pythonErrors;
          });
          
          setWarningCount(prevWarnings => {
            const baseWarnings = editorInfo?.warnings || 0;
            return baseWarnings + pythonWarnings;
          });
        }
      } catch (e) {
        console.error('Ошибка при получении Python диагностики для BottomToolbar:', e);
      }
    };
    
    // Обновляем счетчики при первой загрузке
    updatePythonDiagnostics();
    
    // Подписываемся на обновления маркеров
    document.addEventListener('markers-updated', updatePythonDiagnostics);
    
    return () => {
      document.removeEventListener('markers-updated', updatePythonDiagnostics);
    };
  }, [editorInfo]);

  // Синхронизируем localGitInfo с gitInfo из пропсов
  useEffect(() => {
    setLocalGitInfo(gitInfo);
  }, [gitInfo]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
        closeContextMenu();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const closeContextMenu = () => {
    const menu = document.getElementById("context-menu");
    if (menu?.style) {
      menu.style.display = "none";
      setContextMenuVisible(false);
    }
  };

  useEffect(() => {
    // Исправляем тип события для DOM MouseEvent, а не React MouseEvent
    const handleClick = (e: globalThis.MouseEvent) => {
      const menu = document.getElementById("context-menu");
      if (menu && !menu.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleMouseEnter = (tooltipKey: keyof typeof tooltips) => {
    const id = setTimeout(() => {
      setVisibleTooltip(tooltipKey);
    }, 1000);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setVisibleTooltip(null);
  };

  const handleButtonClick = (dropdownKey: string) => {
    setActiveDropdown(activeDropdown === dropdownKey ? null : dropdownKey);
  };

  const handleRightClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const menu = document.getElementById("context-menu");
    if (menu?.style) {
      menu.style.display = "block";
      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY - 150}px`;
      setContextMenuVisible(true);
    }
  };

  // Исправляем тип события для корректной работы
  const handleToggleVisibility = (key: VisibleElementKeys, e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setVisibleElements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleGitPush = async () => {
    if (!selectedFolder) {
      setNotification({
        message: 'Не выбрана папка проекта',
        type: 'error'
      });
      return;
    }

    try {
      await invoke('git_command', {
        projectRoot: selectedFolder,
        command: 'push',
        args: []
      });

      setNotification({
        message: 'Изменения успешно отправлены',
        type: 'success'
      });
    } catch (error) {
      console.error('Error pushing changes:', error);
      setNotification({
        message: 'Ошибка при отправке изменений',
        type: 'error'
      });
    }

    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleGitPull = async () => {
    if (!selectedFolder) {
      setNotification({
        message: 'Не выбрана папка проекта',
        type: 'error'
      });
      return;
    }

    try {
      await invoke('git_command', {
        projectRoot: selectedFolder,
        command: 'pull',
        args: []
      });

      // Обновляем информацию о Git после pull
      const updatedInfo = await invoke('get_git_info', { projectRoot: selectedFolder }) as GitInfo;
      setLocalGitInfo(updatedInfo);
      if (onGitInfoChange) {
        onGitInfoChange(updatedInfo);
      }

      setNotification({
        message: 'Изменения успешно получены',
        type: 'success'
      });
    } catch (error) {
      console.error('Error pulling changes:', error);
      setNotification({
        message: 'Ошибка при получении изменений',
        type: 'error'
      });
    }

    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleCommitSuccess = async () => {
    // Обновляем информацию о Git после успешного коммита
    if (selectedFolder) {
      const updatedInfo = await invoke('get_git_info', { projectRoot: selectedFolder }) as GitInfo;
      setLocalGitInfo(updatedInfo);
      if (onGitInfoChange) {
        onGitInfoChange(updatedInfo);
      }
    }
  };

  const handleGitBranchClick = () => {
    setActiveDropdown(activeDropdown === "gitBranch" ? null : "gitBranch");
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  useEffect(() => {
    const updateGitInfo = async () => {
      try {
        // Используем текущую директорию для определения корня проекта
        const currentDir = await invoke('tauri_current_dir');
        const projectRoot = await invoke('get_project_root', { currentFilePath: currentDir });
        
        // Сначала проверяем, является ли каталог Git репозиторием
        try {
          await invoke('git_command', { 
            projectRoot,
            command: 'rev-parse',
            args: ['--is-inside-work-tree'] 
          });
        } catch (err) {
          // Если не является Git репозиторием, устанавливаем пустую информацию
          setLocalGitInfo({ current_branch: '---', status: 'none' });
          return;
        }
        
        // Если это Git репозиторий, получаем информацию о ветке и изменениях
        const info = await invoke('get_git_info', { projectRoot });
        setLocalGitInfo(info as GitInfo);
      } catch (error) {
        console.error('Error getting git info:', error);
        // При ошибке устанавливаем значение по умолчанию
        setLocalGitInfo({ current_branch: '---', status: 'none' });
      }
    };

    updateGitInfo();
    const interval = setInterval(updateGitInfo, 5000); // Обновляем каждые 5 секунд
    return () => clearInterval(interval);
  }, []);

  // Обработчик смены ветки
  const handleBranchSwitch = async (branchName: string) => {
    try {
      // Получаем обновленную информацию о Git
      if (selectedFolder) {
        const updatedInfo = await invoke('get_git_info', { projectRoot: selectedFolder }) as GitInfo;
        
        // Обновляем локальное состояние
        setLocalGitInfo(updatedInfo);
        
        // Уведомляем родительский компонент
        if (onGitInfoChange) {
          onGitInfoChange(updatedInfo);
        }
        
        // Показываем уведомление
        setNotification({
          message: `Переключено на ветку: ${branchName}`,
          type: 'success'
        });
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => {
          setNotification(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error updating git info after branch switch:', error);
      setNotification({
        message: `Ошибка при обновлении информации о ветке`,
        type: 'error'
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  const handleRunPythonDiagnostics = () => {
    try {
      console.log('Запуск ручной проверки Python кода...');
      
      // Используем глобальную функцию для запуска диагностики
      if ((window as any).updatePythonDiagnostics) {
        (window as any).updatePythonDiagnostics();
        
        setNotification({
          message: 'Проверка Python кода запущена',
          type: 'success'
        });
        
        setTimeout(() => {
          setNotification(null);
        }, 3000);
      } else {
        console.warn('Функция updatePythonDiagnostics не найдена');
        
        setNotification({
          message: 'Проверка Python кода недоступна',
          type: 'error'
        });
        
        setTimeout(() => {
          setNotification(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Ошибка при запуске Python диагностики:', error);
      
      setNotification({
        message: 'Ошибка при проверке Python кода',
        type: 'error'
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  return (
    <>
      {/* Уведомление о смене ветки */}
      {notification && (
        <div className={`branch-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div
        id="context-menu"
        className="context-menu"
        style={{ display: "none" }}
      >
        <div onClick={(e: ReactMouseEvent<HTMLDivElement>) => handleToggleVisibility("encoding", e)}>
          <span>Кодировка</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.encoding ? "active" : ""}`}
          />
        </div>
        <div onClick={(e: ReactMouseEvent<HTMLDivElement>) => handleToggleVisibility("position", e)}>
          <span>Позиция</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.position ? "active" : ""}`}
          />
        </div>
        <div onClick={(e: ReactMouseEvent<HTMLDivElement>) => handleToggleVisibility("language", e)}>
          <span>Выбор редактора</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.language ? "active" : ""}`}
          />
        </div>
        <div onClick={(e: ReactMouseEvent<HTMLDivElement>) => handleToggleVisibility("notifications", e)}>
          <span>Уведомления</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.notifications ? "active" : ""}`}
          />
        </div>
        <div onClick={(e: ReactMouseEvent<HTMLDivElement>) => handleToggleVisibility("user", e)}>
          <span>Пользователь</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.user ? "active" : ""}`}
          />
        </div>
      </div>

      {activeDropdown && (
        <div className="dropdown-overlay" onClick={closeDropdown}>
          <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            {activeDropdown === "position" && <PositionDropdown />}
            {activeDropdown === "language" && <LanguageDropdown />}
            {activeDropdown === "notifications" && <NotificationsDropdown />}
            {activeDropdown === "gitBranch" && (
              <GitBranches 
                currentBranch={localGitInfo.current_branch} 
                onClose={closeDropdown}
                selectedFolder={selectedFolder}
                onBranchSwitch={handleBranchSwitch}
              />
            )}
          </div>
        </div>
      )}

      {isCommitModalOpen && (
        <div className="dropdown-overlay" onClick={() => setIsCommitModalOpen(false)}>
          <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            <GitCommitModal
              onClose={() => setIsCommitModalOpen(false)}
              selectedFolder={selectedFolder}
              onSuccess={handleCommitSuccess}
            />
          </div>
        </div>
      )}

      <div className="bottom-toolbar" onContextMenu={handleRightClick}>
        <div className="left-info">
          <div className={`status-item ${!visibleElements.encoding ? "hidden" : ""}`}>
            <CircleX width={14} height={14} color={errorCount > 0 ? "#ff0000" : "#858585"} />
            <span>{errorCount}</span>
          </div>
          <div className={`status-item ${!visibleElements.position ? "hidden" : ""}`}>
            <CircleAlert width={14} height={14} color={warningCount > 0 ? "#FFA500" : "#858585"} />
            <span>{warningCount}</span>
          </div>
          {localGitInfo.status !== 'none' && (
            <div className="status-item git-branch" onClick={handleGitBranchClick} title="Нажмите, чтобы выбрать ветку">
              <GitBranch className="icon" />
              <span 
                className={`branch-name ${localGitInfo.status}`}
                onMouseEnter={() => handleMouseEnter("gitBranch")}
                onMouseLeave={handleMouseLeave}
              >
                {localGitInfo.current_branch}
                {visibleTooltip === "gitBranch" && (
                  <span className="tooltip">{tooltips.gitBranch}</span>
                )}
              </span>
            </div>
          )}
          {/* Python диагностика */}
          {editorInfo?.language === 'python' && (
            <div 
              className="status-item python-lint" 
              onClick={handleRunPythonDiagnostics}
              onMouseEnter={() => handleMouseEnter("pythonLint")}
              onMouseLeave={handleMouseLeave}
              title="Проверить Python код"
            >
              <FaPython size={14} color="#3776AB" />
              {visibleTooltip === "pythonLint" && (
                <span className="tooltip">{tooltips.pythonLint}</span>
              )}
            </div>
          )}
        </div>

        <div className="right-info">
          {userLogin && visibleElements.user && (
            <div
              className="right-item user-info"
              onMouseEnter={() => handleMouseEnter("user")}
              onMouseLeave={handleMouseLeave}
            >
              <User width={14} height={14} />
              <span>{userLogin}</span>
              {visibleTooltip === "user" && (
                <span className="tooltip">{tooltips.user}</span>
              )}
            </div>
          )}
          <button
            className="right-item git-button"
            onMouseEnter={() => handleMouseEnter("gitCommit")}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsCommitModalOpen(true)}
          >
            <GitCommit width={14} height={14} />
            {visibleTooltip === "gitCommit" && (
              <span className="tooltip">{tooltips.gitCommit}</span>
            )}
          </button>
          <button
            className="right-item git-button"
            onMouseEnter={() => handleMouseEnter("gitPush")}
            onMouseLeave={handleMouseLeave}
            onClick={handleGitPush}
          >
            <GitCommit width={14} height={14} />
            {visibleTooltip === "gitPush" && (
              <span className="tooltip">{tooltips.gitPush}</span>
            )}
          </button>
          <button
            className="right-item git-button"
            onMouseEnter={() => handleMouseEnter("gitPull")}
            onMouseLeave={handleMouseLeave}
            onClick={handleGitPull}
          >
            <GitPullRequest width={14} height={14} />
            {visibleTooltip === "gitPull" && (
              <span className="tooltip">{tooltips.gitPull}</span>
            )}
          </button>
          <button
            className={`right-item ${!visibleElements.encoding ? "hidden" : ""}`}
            onMouseEnter={() => handleMouseEnter("encoding")}
            onMouseLeave={handleMouseLeave}
          >
            {editorInfo?.encoding || "UTF-8"}
            {visibleTooltip === "encoding" && (
              <span className="tooltip">{tooltips.encoding}</span>
            )}
          </button>
          <button
            className={`right-item ${!visibleElements.position ? "hidden" : ""}`}
            onMouseEnter={() => handleMouseEnter("position")}
            onMouseLeave={handleMouseLeave}
          >
            Строка {editorInfo?.cursorInfo.line || 1} Столбец {editorInfo?.cursorInfo.column || 1} Всего {editorInfo?.cursorInfo.totalChars || 0}
            {visibleTooltip === "position" && (
              <span className="tooltip">{tooltips.position}</span>
            )}
          </button>
          <button
            className={`right-item ${!visibleElements.language ? "hidden" : ""}`}
            onMouseEnter={() => handleMouseEnter("language")}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick("language")}
          >
            {editorInfo?.language || "Plain Text"}
            {visibleTooltip === "language" && (
              <span className="tooltip">{tooltips.language}</span>
            )}
          </button>
          <button
            className={`right-item ${!visibleElements.notifications ? "hidden" : ""}`}
            onMouseEnter={() => handleMouseEnter("notifications")}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick("notifications")}
          >
            <Bell width={14} height={14} />
            {visibleTooltip === "notifications" && (
              <span className="tooltip">{tooltips.notifications}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default BottomToolbar;