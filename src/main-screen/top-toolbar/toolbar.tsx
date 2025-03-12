import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Square, X, Minus, Search } from "lucide-react";

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

  return (
    <div className="top-toolbar" data-tauri-drag-region>
      <div className="draggable-area">
        <div className="left-section">
          <div className="menu-items">
            {Object.keys(menuData).map((item) => (
              <div key={item} className="menu-container">
                <button
                  className={`menu-item ${activeMenu === item ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation(); // Останавливаем распространение события, чтобы не сработал клик на документе
                    toggleMenu(item);
                  }} // При клике открываем/закрываем меню
                >
                  {item}
                </button>
                {activeMenu === item && ( // Показываем дропдаун только для активного меню
                  <div className="dropdown-menu" ref={menuRef}>
                    {menuData[item].map((option: MenuItem, index: number) => (
                      <button key={index} className="dropdown-btn">
                        {option.text} <span className="shortcut">{option.shortcut}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="search-bar">
          <Search />
          <input type="text" />
        </div>
      </div>

      <div className="window-controls">
        <button className="control-btn" onClick={handleMinimize} aria-label="Minimize">
          <Minus width={14} height={14} />
        </button>
        <button className="control-btn" onClick={handleMaximize} aria-label="Maximize">
          <Square width={14} height={14} />
        </button>
        <button className="control-btn close-btn" onClick={handleClose} aria-label="Close">
          <X width={14} height={14} />
        </button>
      </div>
    </div>
  );
};

export default TopToolbar;
