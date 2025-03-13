import React, { useState, useEffect } from "react";
import { CircleX, CircleAlert, Bell, Check } from "lucide-react";

import EncodingDropdown from "./modals/ModalEncoding";
import LanguageDropdown from "./modals/ModalsLanguage";
import PositionDropdown from "./modals/ModalsPosition";
import NotificationsDropdown from "./modals/ModalsNotification";

import "devicon/devicon.min.css";
import "./style.css";

const tooltips = {
  encoding: "Кодировку",
  indent: "Настройки отступа",
  position: "Позиция курсора: Строка 1, Столбец 1",
  language: "Выбрать язык",
  notifications: "Уведомления"
};

type VisibleElementKeys = "encoding" | "position" | "language" | "notifications";

const BottomToolbar: React.FC = () => {
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Handle outside click
  const handleOutsideClick = () => {
    setActiveDropdown(null);
  };

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
      // Вычитаем 10px, чтобы разместить меню выше
      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY - 160}px`;  // смещение вверх на 10px
      menu.style.display = "block";
    }
  };
  
  const handleToggleVisibility = (key: VisibleElementKeys) => {
    setVisibleElements((prevState) => ({
      ...prevState,
      [key]: !prevState[key],
    }));
  };

  return (
    <>
      {/* Контекстное меню */}
      <div
        id="context-menu"
        className="context-menu"
        style={{ display: "none" }}
        onClick={handleOutsideClick}
      >
        <div onClick={() => handleToggleVisibility("encoding")}>
          <Check width={14} height={14} className={`check ${visibleElements.encoding ? "active" : ""}`} />
          <span>Encoding</span>
        </div>
        <div onClick={() => handleToggleVisibility("position")}>
          <Check width={14} height={14} className={`check ${visibleElements.position ? "active" : ""}`} />
          <span>Position</span>
        </div>
        <div onClick={() => handleToggleVisibility("language")}>
          <Check width={14} height={14} className={`check ${visibleElements.language ? "active" : ""}`} />
          <span>Language</span>
        </div>
        <div onClick={() => handleToggleVisibility("notifications")}>
          <Check width={14} height={14} className={`check ${visibleElements.notifications ? "active" : ""}`} />
          <span>Notifications</span>
        </div>
      </div>

      {activeDropdown && (
        <div className="dropdown-overlay" onClick={handleOutsideClick}>
          <div className="dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            {activeDropdown === "encoding" && <EncodingDropdown />}
            {activeDropdown === "position" && <PositionDropdown />}
            {activeDropdown === "language" && <LanguageDropdown />}
            {activeDropdown === "notifications" && <NotificationsDropdown />}
          </div>
        </div>
      )}

      <div className="bottom-toolbar" onContextMenu={handleRightClick}>
        {/* Левая часть */}
        <div className="left-info">
          {visibleElements.encoding && (
            <div className="status-item">
              <CircleX width={14} height={14} />
              <span>0</span>
            </div>
          )}
          {visibleElements.position && (
            <div className="status-item">
              <CircleAlert width={14} height={14} />
              <span>0</span>
            </div>
          )}
        </div>

        {/* Правая часть */}
        <div className="right-info">
          {visibleElements.encoding && (
            <button
              className="right-item"
              onMouseEnter={() => handleMouseEnter("encoding")}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleButtonClick("encoding")}
            >
              UTF-8
              {visibleTooltip === "encoding" && (
                <span className="tooltip">{tooltips.encoding}</span>
              )}
            </button>
          )}

          {visibleElements.position && (
            <button
              className="right-item"
              onMouseEnter={() => handleMouseEnter("position")}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleButtonClick("position")}
            >
              Строка 1 Столбец 1 Всего 312
              {visibleTooltip === "position" && (
                <span className="tooltip">{tooltips.position}</span>
              )}
            </button>
          )}

          {visibleElements.language && (
            <button
              className="right-item"
              onMouseEnter={() => handleMouseEnter("language")}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleButtonClick("language")}
            >
              Python
              {visibleTooltip === "language" && (
                <span className="tooltip">{tooltips.language}</span>
              )}
            </button>
          )}

          {visibleElements.notifications && (
            <button
              className="right-item"
              onMouseEnter={() => handleMouseEnter("notifications")}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleButtonClick("notifications")}
            >
              <Bell width={14} height={14} />
              {visibleTooltip === "notifications" && (
                <span className="tooltip">{tooltips.notifications}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default BottomToolbar;
