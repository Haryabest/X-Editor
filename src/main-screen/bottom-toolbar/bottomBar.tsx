import React, { useState, useEffect } from "react";
import { CircleX, CircleAlert, Bell, Search } from "lucide-react";

import "devicon/devicon.min.css";
import "./style.css";
import "./styleLanguage.css";

const tooltips = {
  encoding: "Выбрать кодировку",
  indent: "Настройки отступа",
  position: "Позиция курсора: Строка 1, Столбец 1",
  language: "Выбрать язык программирования",
  notifications: "Настройки уведомлений"
};

const BottomToolbar: React.FC = () => {
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
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

  const EncodingDropdown = () => (
    <div className="dropdown-content dropdown-encoding">
      <h3>Кодировка</h3>
      <ul>
        <li>UTF-8</li>
        <li>UTF-16</li>
        <li>ISO-8859-1</li>
      </ul>
    </div>
  );
  
  const IndentDropdown = () => (
    <div className="dropdown-content dropdown-indent">
      <h3>Отступ</h3>
      <ul>
        <li>2 пробела</li>
        <li>4 пробела</li>
        <li>Табуляция</li>
      </ul>
    </div>
  );
  
  const PositionDropdown = () => (
    <div className="dropdown-content dropdown-position">
      <h3>Позиция</h3>
      <p>Текущая позиция: Строка 1, Столбец 1</p>
      <button>Перейти к строке</button>
    </div>
  );
  
  const LanguageDropdown = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const languages = [
      { name: 'Python', ext: '.py', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg" width="14"height="14"/>},
      { name: 'JavaScript', ext: '.js', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" width="14"height="14"/>
       },
      { name: 'Java', ext: '.java', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg"width="14"height="14"/>
       },
      { name: 'TypeScript', ext: '.ts', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" width="14"height="14"/>
      },
      { name: 'TypeScript JSX', ext: '.tsx', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width="14"height="14"/>
       },
      { name: 'CSS', ext: '.css', icon: 'devicon-css3-plain colored' },
      { name: 'CSV', ext: '.csv', icon: 'devicon-csv-plain colored' }, // Иконка CSV отсутствует, используем общую
      { name: 'Dart', ext: '.dart', icon: 'devicon-dart-plain colored' },
      { name: 'XML', ext: '.xml', icon: 'devicon-xml-plain colored' }, // Иконка XML отсутствует
      { name: 'Rust', ext: '.rs', icon: 'devicon-rust-plain colored' },
      { name: 'SCSS', ext: '.scss', icon: 'devicon-sass-original colored' },
      { name: 'Go', ext: '.go', icon: 'devicon-go-plain colored' },
      { name: 'HTML', ext: '.html', icon: 'devicon-html5-plain colored' },
      { name: 'JavaScript React', ext: '.jsx', icon: 'devicon-react-original colored' },
    ];
    const filteredLanguages = languages.filter(lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  
    return (
      <div className="dropdown-content dropdown-language">
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Поиск языка..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="language-list-container">
          <ul>
            {filteredLanguages.map((lang) => (
        <li key={lang.name} className="language-item">
        <div className="language-content">
          {lang.icon}
          {lang.name}
        </div>
        <span className="file-ext">{lang.ext}</span>
      </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const NotificationsDropdown = () => (
    <div className="dropdown-content dropdown-notifications">
      <h3>Уведомления</h3>
      <ul>
        <li>Все</li>
        <li>Только ошибки</li>
        <li>Отключить</li>
      </ul>
    </div>
  );
  

  return (
    <>
      {activeDropdown && (
        <div className="dropdown-overlay" onClick={handleOutsideClick}>
          <div className="dropdown-wrapper" onClick={e => e.stopPropagation()}>
            {activeDropdown === 'encoding' && <EncodingDropdown />}
            {activeDropdown === 'indent' && <IndentDropdown />}
            {activeDropdown === 'position' && <PositionDropdown />}
            {activeDropdown === 'language' && <LanguageDropdown />}
            {activeDropdown === 'notifications' && <NotificationsDropdown />}
          </div>
        </div>
      )}
      
      <div className="bottom-toolbar">
        {/* Left part */}
        <div className="left-info">
          <div className="status-item">
            <CircleX width={14} height={14} />
            <span>0</span>
          </div>
          <div className="status-item">
            <CircleAlert width={14} height={14} />
            <span>0</span>
          </div>
        </div>

        {/* Right part */}
        <div className="right-info">
          <button 
            className="right-item"
            onMouseEnter={() => handleMouseEnter('encoding')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick('encoding')}
          >
            UTF-8
            {visibleTooltip === 'encoding' && (
              <span className="tooltip">{tooltips.encoding}</span>
            )}
          </button>
          
          <button 
            className="right-item"
            onMouseEnter={() => handleMouseEnter('indent')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick('indent')}
          >
            Отступ
            {visibleTooltip === 'indent' && (
              <span className="tooltip">{tooltips.indent}</span>
            )}
          </button>

          <button 
            className="right-item"
            onMouseEnter={() => handleMouseEnter('position')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick('position')}
          >
            Строка Столбец
            {visibleTooltip === 'position' && (
              <span className="tooltip">{tooltips.position}</span>
            )}
          </button>
          <button 
  className="right-item"
  onMouseEnter={() => handleMouseEnter('language')}
  onMouseLeave={handleMouseLeave}
  onClick={() => handleButtonClick('language')}
>
  Python
  {visibleTooltip === 'language' && (
    <span className="tooltip">{tooltips.language}</span>
  )}
</button>

          <button 
            className="right-item"
            onMouseEnter={() => handleMouseEnter('notifications')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleButtonClick('notifications')}
          >
            <Bell width={14} height={14} />
            {visibleTooltip === 'notifications' && (
              <span className="tooltip">{tooltips.notifications}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default BottomToolbar;