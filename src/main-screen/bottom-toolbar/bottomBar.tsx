import React, { useState, useEffect } from "react";
import { CircleX, CircleAlert, Bell, Check, GitCommit, GitPullRequest } from "lucide-react";

import EncodingDropdown from "./modals/Encoding/ModalEncoding";
import LanguageDropdown from "./modals/Language/ModalsLanguage";
import PositionDropdown from "./modals/Position/ModalsPosition";
import NotificationsDropdown from "./modals/Notification/ModalsNotification";

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
};

type VisibleElementKeys = "encoding" | "position" | "language" | "notifications";

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
    gitBranch?: string; // Добавляем информацию о ветке
  };
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ editorInfo }) => {
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);

  const [visibleElements, setVisibleElements] = useState<{
    encoding: boolean;
    position: boolean;
    language: boolean;
    notifications: boolean;
  }>({
    encoding: true,
    position: true,
    language: true,
    notifications: true,
  });

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
    if (menu) {
      menu.style.display = "none";
      setContextMenuVisible(false);
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
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

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const menu = document.getElementById("context-menu");
    if (menu) {
      menu.style.display = "block";
      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY - 150}px`;
      setContextMenuVisible(true);
    }
  };

  const handleToggleVisibility = (key: VisibleElementKeys, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleElements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleGitPush = () => {
    console.log("Git Push clicked");
    // Здесь можно добавить логику для git push
  };

  const handleGitPull = () => {
    console.log("Git Pull clicked");
    // Здесь можно добавить логику для git pull
  };

  return (
    <>
      <div
        id="context-menu"
        className="context-menu"
        style={{ display: "none" }}
      >
        <div onClick={(e) => handleToggleVisibility("encoding", e)}>
          <span>Кодировка</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.encoding ? "active" : ""}`}
          />
        </div>
        <div onClick={(e) => handleToggleVisibility("position", e)}>
          <span>Позиция</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.position ? "active" : ""}`}
          />
        </div>
        <div onClick={(e) => handleToggleVisibility("language", e)}>
          <span>Выбор редактора</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.language ? "active" : ""}`}
          />
        </div>
        <div onClick={(e) => handleToggleVisibility("notifications", e)}>
          <span>Уведомления</span>
          <Check
            color="#fff"
            width={14}
            height={14}
            className={`check ${visibleElements.notifications ? "active" : ""}`}
          />
        </div>
      </div>

      {activeDropdown && (
        <div className="dropdown-overlay" onClick={closeContextMenu}>
          <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            {activeDropdown === "encoding" && <EncodingDropdown />}
            {activeDropdown === "position" && <PositionDropdown />}
            {activeDropdown === "language" && <LanguageDropdown />}
            {activeDropdown === "notifications" && <NotificationsDropdown />}
          </div>
        </div>
      )}

      <div className="bottom-toolbar" onContextMenu={handleRightClick}>
        <div className="left-info">
          <div className={`status-item ${!visibleElements.encoding ? "hidden" : ""}`}>
            <CircleX width={14} height={14} color={editorInfo?.errors ? "#ff0000" : "#858585"} />
            <span>{editorInfo?.errors || 0}</span>
          </div>
          <div className={`status-item ${!visibleElements.position ? "hidden" : ""}`}>
            <CircleAlert width={14} height={14} color={editorInfo?.warnings ? "#FFA500" : "#858585"} />
            <span>{editorInfo?.warnings || 0}</span>
          </div>
          <div className="status-item git-branch">
            <span>{editorInfo?.gitBranch || "main"}</span>
          </div>
        </div>

        <div className="right-info">
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
            onClick={() => handleButtonClick("encoding")}
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
            onClick={() => handleButtonClick("position")}
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