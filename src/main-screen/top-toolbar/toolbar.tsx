import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save , open } from '@tauri-apps/plugin-dialog';
import { 
  Square, 
  X, 
  Minus, 
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  PanelTop,
  PanelBottom,
} from "lucide-react";
import { MenuItem, FileItem } from './types/types';
import SearchTrigger from './components/SearchTrigger';
import SearchDropdown from './components/SearchDropdown';
import Settings from '../lefttoolbar/settings/Settings';
import './style.css';

interface TopToolbarProps {
  onSelectAll?: () => void;
  onDeselect?: () => void;
  currentFiles: FileItem[];
  setSelectedFile: (path: string | null) => void;
  selectedFolder?: string | null;
  lastOpenedFolder?: string;
  selectedFile?: string | null;
  currentContent?: string;
  onSplitEditor?: (direction: 'right' | 'down' | 'left' | 'up') => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCreateNewFile?: (path: string) => void;
  onFileSaved?: (path: string) => void;
}

const menuData: Record<string, MenuItem[]> = {
  "Файл": [
    { text: "Новый файл", shortcut: "Ctrl + N" },
    { text: "Открыть папку", shortcut: "Ctrl + O" },
    { text: "Сохранить", shortcut: "Ctrl + S" },
    { text: "Сохранить как", shortcut: "Ctrl + SHIFT + S" },
    { text: "Сохранить все", shortcut: "Ctrl + S" },
    { text: "Открыть новое окно", shortcut: "Ctrl + S" },
    { text: "Последнее", shortcut: "" },
    { text: "Настройки", shortcut: "" },
    { text: "Выход", shortcut: "" }
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
    { text: "О программе", shortcut: "Alt + I" },
  ]
};
const TopToolbar = ({ 
  currentFiles, 
  setSelectedFile, 
  selectedFolder,
  lastOpenedFolder,
  selectedFile,
  currentContent,
  onSplitEditor, 
  onZoomIn, 
  onZoomOut,
  onCreateNewFile,
  onFileSaved ,
  onSelectAll,
  onDeselect
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showHiddenMenu, setShowHiddenMenu] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const hiddenMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const splitMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleMinimize = async () => {
    try { await invoke('minimize_window'); } catch (error) { console.error('Minimize error:', error); }
  };

  const handleMaximize = async () => {
    try { await invoke('toggle_maximize'); } catch (error) { console.error('Maximize error:', error); }
  };

  const handleClose = async () => {
    try { await invoke('close_window'); } catch (error) { console.error('Close error:', error); }
  };

  const handleSaveFile = async (saveAs: boolean = false) => {
    try {
      let targetPath: string | null = null;
      
      if (!saveAs && selectedFile) {
        targetPath = selectedFile;
      } else {
        const result = await save({
          title: 'Сохранить файл',
          defaultPath: selectedFile || lastOpenedFolder || undefined,
          filters: [{ name: 'Text Files', extensions: ['txt', 'js', 'ts', 'html', 'css'] }]
        });
        targetPath = result;
      }

      if (targetPath && currentContent !== undefined) {
        await invoke('save_file', {
          path: targetPath,
          content: currentContent
        });
        
        onFileSaved?.(targetPath);
        alert(`Файл сохранён: ${targetPath}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert(`Ошибка сохранения: ${error}`);
    }
  };

  const handleCreateNewFile = async () => {
    try {
      const filePath = await save({
        title: 'Создать новый файл',
        defaultPath: lastOpenedFolder || undefined,
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        // Создаем пустой файл
        await invoke('create_new_file1', { path: filePath });
        
        // Обновляем состояние
        onCreateNewFile?.(filePath);
        setSelectedFile(filePath);        
      }
    } catch (error) {
      console.error('Ошибка создания файла:', error);
      alert(`Ошибка создания файла: ${error}`);
    }
  };
  const handleOpenNewWindow = async () => {
    try {
      await invoke('spawn_new_process');
    } catch (error) {
      console.error("Error opening new window:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
      if (hiddenMenuRef.current && !hiddenMenuRef.current.contains(e.target as Node)) {
        setShowHiddenMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (splitMenuRef.current && !splitMenuRef.current.contains(e.target as Node)) {
        setShowSplitMenu(false);
      }
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showSettings]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        handleClose();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleCreateNewFile();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveFile(e.shiftKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentContent, selectedFile]);

  const menuKeys = Object.keys(menuData);
  const mainMenuKeys = windowWidth > 1360 ? menuKeys : menuKeys.slice(0, -3);
  const hiddenMenuKeys = windowWidth > 1360 ? [] : menuKeys.slice(-3);

  const handleSplitRight = () => {
    onSplitEditor?.('right');
    setActiveMenu(null);
  };

  const handleSplitDown = () => {
    onSplitEditor?.('down');
    setActiveMenu(null);
  };

  const handleSplitLeft = () => {
    onSplitEditor?.('left');
    setActiveMenu(null);
  };

  const handleSplitUp = () => {
    onSplitEditor?.('up');
    setActiveMenu(null);
  };

  

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Выберите рабочую папку',
      });
  
      if (selected) {
        // Добавляем небольшую задержку перед закрытием
        await new Promise(resolve => setTimeout(resolve, 300));
        await invoke('new_folder', { path: selected });
        await invoke('close_current_window');
      }
    } catch (error) {
      console.error('Ошибка открытия папки:', error);
      alert(`Ошибка открытия папки: ${error}`);
    }
  };
  const handleMenuItemClick = (menu: string, option: MenuItem) => {
    if (menu === "Файл") {
      switch(option.text) {
        case "Новый файл":
          handleCreateNewFile();
          break;
        case "Открыть файл":
          // Реализация открытия файла
          break;
        case "Открыть папку":
          handleOpenFolder();
          break;
        case "Сохранить":
          handleSaveFile(false);
          break;
        case "Сохранить как":
          handleSaveFile(true);
          break;
        case "Открыть новое окно":
          handleOpenNewWindow();
          break;
        case "Настройки":
          setShowSettings(true);
          break;
        case "Выход":
          handleClose();
          break;
      }
    } else if (menu === "Вид") {
      switch(option.text) {
        case "Масштаб +":
          onZoomIn?.();
          break;
        case "Масштаб -":
          onZoomOut?.();
          break;
      }
    }
    else if (menu === "Выделение") {
      switch(option.text) {
        case "Выбрать всё":
          onSelectAll?.();
          break;
        case "Отменить выбор":
          onDeselect?.();
          break;
      }
    setActiveMenu(null);
  };

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
                      <button 
                        key={index} 
                        className="dropdown-btn"
                        onClick={() => handleMenuItemClick(item, option)}
                      >
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
                              <button 
                                key={index} 
                                className="dropdown-btn"
                                onClick={() => handleMenuItemClick(item, option)}
                              >
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

        <div className="search-bar" ref={searchRef}>
          <SearchTrigger
            width={
              windowWidth < 800 ? '150px' : 
              windowWidth < 1000 ? '200px' : 
              windowWidth < 1200 ? '300px' : '400px'
            }
            onClick={() => setShowSearchDropdown(true)}
            selectedFolder={selectedFolder}
          />
          
          {showSearchDropdown && (
            <SearchDropdown
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              files={currentFiles.filter(file =>
                file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                file.path.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              onFileSelect={setSelectedFile}
            />
          )}
        </div>
      </div>

      <div className="window-controls">
        <div className="split-controls" ref={splitMenuRef}>
          {windowWidth > 800 ? (
            <>
              <button className="control-btn split-btn" onClick={handleSplitRight} title="Разделить справа">
                <PanelRight size={14} />
              </button>
              <button className="control-btn split-btn" onClick={handleSplitDown} title="Разделить вниз">
                <PanelBottom size={14} />
              </button>
              <button className="control-btn split-btn" onClick={handleSplitLeft} title="Разделить слева">
                <PanelLeft size={14} className="rotate-180" />
              </button>
              <button className="control-btn split-btn" onClick={handleSplitUp} title="Разделить вверх">
                <PanelTop size={14} className="rotate-180" />
              </button>
            </>
          ) : (
            <div className="split-menu-container">
              <button 
                className="control-btn split-btn" 
                onClick={() => setShowSplitMenu(!showSplitMenu)}
                title="Разделить экран"
              >
                <MoreHorizontal size={14} />
              </button>
              {showSplitMenu && (
                <div className="split-dropdown-menu">
                  <button className="split-dropdown-btn" onClick={handleSplitRight}>
                    <PanelRight size={14} />
                    <span>Разделить справа</span>
                  </button>
                  <button className="split-dropdown-btn" onClick={handleSplitDown}>
                    <PanelBottom size={14} />
                    <span>Разделить вниз</span>
                  </button>
                  <button className="split-dropdown-btn" onClick={handleSplitLeft}>
                    <PanelLeft size={14} />
                    <span>Разделить слева</span>
                  </button>
                  <button className="split-dropdown-btn" onClick={handleSplitUp}>
                    <PanelTop size={14} />
                    <span>Разделить вверх</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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

      {showSettings && (
        <Settings 
          isVisible={showSettings} 
          onClose={() => setShowSettings(false)}
          ref={settingsRef}
        />
      )}
    </div>
  );
};
}
export default TopToolbar;