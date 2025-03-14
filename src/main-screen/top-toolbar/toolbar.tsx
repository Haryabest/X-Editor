import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Square, X, Minus, Search, MoreHorizontal } from "lucide-react";

import './style.css';

interface MenuItem {
  text: string;
  shortcut: string;
}

const menuData: Record<string, MenuItem[]> = {
  "Файл": [
    { text: "Новый файл", shortcut: "Ctrl + N" },
    { text: "Открыть", shortcut: "Ctrl + O" },
    { text: "Сохранить", shortcut: "Ctrl + S" },
    { text: "Сохранить как", shortcut: "Ctrl + S" },
    { text: "Сохранить все", shortcut: "Ctrl + S" },
    { text: "Открыть новое окно", shortcut: "Ctrl + S" },
    { text: "Последнее", shortcut: "" },
    { text: "Настройки", shortcut: "" },
    { text: "Выход", shortcut: "Ctrl + Q" }
  ],
  "Выделение": [
    { text: "Выбрать всё", shortcut: "Ctrl + A" },
    { text: "Отменить выбор", shortcut: "Esc" },
    { text: "Инвертировать", shortcut: "Shift + I" },
    { text: "Расширенное выделение", shortcut: "Alt + E" }
  ],
  "Вид": [
    { text: "Полноэкранный режим", shortcut: "F11" },
    { text: "Масштаб +", shortcut: "Ctrl + Plus" },
    { text: "Масштаб -", shortcut: "Ctrl + Minus" },
    { text: "Сброс масштаба", shortcut: "Ctrl + 0" }
  ],
  "Выполнить": [
    { text: "Запустить", shortcut: "F5" },
    { text: "Перезапустить", shortcut: "Shift + F5" },
    { text: "Остановить", shortcut: "Ctrl + F2" },
    { text: "Отладка", shortcut: "F9" }
  ],
  "Консоль": [
    { text: "Открыть консоль", shortcut: "Ctrl + `" },
    { text: "Очистить консоль", shortcut: "Ctrl + L" },
    { text: "Закрыть консоль", shortcut: "Ctrl + W" },
    { text: "Настройки консоли", shortcut: "Ctrl + P" }
  ],
  "Справка": [
    { text: "Документация", shortcut: "F1" },
    { text: "Сообщество", shortcut: "Alt + C" },
    { text: "О программе", shortcut: "Alt + I" },
    { text: "Сообщить об ошибке", shortcut: "Alt + R" }
  ]
};

const TopToolbar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showHiddenMenu, setShowHiddenMenu] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const hiddenMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Minimize error:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize');
    } catch (error) {
      console.error('Maximize error:', error);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Close error:', error);
    }
  };
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Функция переключения активного меню
  const toggleMenu = (menu: string) => {
    setActiveMenu((prevMenu) => (prevMenu === menu ? null : menu)); // Если меню уже открыто, закрыть его
  };

  // Закрытие меню при клике вне
  const closeDropdown = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setActiveMenu(null); // Закрыть активное меню при клике вне
    }
  };

  useEffect(() => {
    document.addEventListener('click', closeDropdown);
    return () => {
      document.removeEventListener('click', closeDropdown);
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(e.target as Node)) {
        setShowHiddenMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const menuKeys = Object.keys(menuData);
  const mainMenuKeys = windowWidth > 1360 ? menuKeys : menuKeys.slice(0, -3);
  const hiddenMenuKeys = windowWidth > 1360 ? [] : menuKeys.slice(-3);

  return (
    <div className="top-toolbar" data-tauri-drag-region>
      <div className="draggable-area">
        <div className="left-section">
          <div className="menu-items">
            {mainMenuKeys.map((item) => (
              <div key={item} className="menu-container">
                <button
                  className={`menu-item ${activeMenu === item ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === item ? null : item);
                  }}
                >
                  {item}
                </button>
                {activeMenu === item && (
                  <div className="dropdown-menu" ref={menuRef}>
                    {menuData[item].map((option, index) => (
                      <button key={index} className="dropdown-btn">
                        {option.text} <span className="shortcut">{option.shortcut}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {hiddenMenuKeys.length > 0 && (
              <div className="menu-container" ref={hiddenMenuRef}>
                <button
                  className="menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHiddenMenu(!showHiddenMenu);
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
                {showHiddenMenu && (
                  <div className="dropdown-menu hidden-menu-dropdown">
                    {hiddenMenuKeys.map((item) => (
                      <div
                        key={item}
                        className="hidden-menu-item-container"
                        onMouseEnter={() => setActiveMenu(item)}
                        onMouseLeave={() => setActiveMenu(null)}
                      >
                        <button className="dropdown-btn">
                          {item}
                        </button>
                        {activeMenu === item && (
                          <div className="dropdown-menu submenu">
                            {menuData[item].map((option, index) => (
                              <button key={index} className="dropdown-btn">
                                {option.text} <span className="shortcut">{option.shortcut}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск..."
            style={{
              width: windowWidth < 800 ? '150px' : 
              windowWidth < 1000 ? '200px' : 
              windowWidth < 1200 ? '300px' : '400px'
            }}
          />
        </div>
      </div>

      <div className="window-controls">
        <button className="control-btn" onClick={handleMinimize}>
          <Minus size={14} />
        </button>
        <button className="control-btn" onClick={handleMaximize}>
          <Square size={14} />
        </button>
        <button className="control-btn close-btn" onClick={handleClose}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default TopToolbar;