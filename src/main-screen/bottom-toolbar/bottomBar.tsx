import React, { useState, useEffect } from "react";
import { CircleX, CircleAlert, Bell, Search, File, Database, Settings } from "lucide-react";

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
      { name: 'CSS', ext: '.css', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-plain.svg" width="14"height="14"/>
       },
      { name: 'Batch', ext: '.bat', icon: <File width={14} height={14}/>}, // Иконка CSV отсутствует, используем общую
      { name: 'BibTeX', ext: '.bibtex', icon: <File width={14} height={14}/>}, // Иконка CSV отсутствует, используем общую
      { name: 'C', ext: '.c', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-plain.svg" width="14"height="14"/>
       }, // Иконка CSV отсутствует, используем общую
      { name: 'C#', ext: '.csharp', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/csharp/csharp-plain.svg"width="14"height="14"/>
       }, // Иконка CSV отсутствует, используем общую
      { name: 'C++', ext: '.cpp', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-plain.svg"  width="14"height="14"/>
      }, // Иконка CSV отсутствует, используем общую
      { name: 'CSV', ext: '.csv', icon: <File width={14} height={14}/>}, // Иконка CSV отсутствует, используем общую
      { name: 'Dart', ext: '.dart', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dart/dart-plain.svg" width="14"height="14"/>
       }, // Иконка CSV отсутствует, используем общую
      { name: 'Databse', ext: '.db', icon: <Database width={14} height={14}/> }, // Иконка CSV отсутствует, используем общую
      { name: 'F#', ext: '.fsharp', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fsharp/fsharp-original.svg" width={14} height={14}/>
       }, // Иконка CSV отсутствует, используем общую
      { name: 'Git', ext: '.git', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/>
       }, // Иконка CSV отсутствует, используем общую
      { name: 'Go', ext: '.go', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg" width={14} height={14}/>
      }, // Иконка CSV отсутствует, используем общую
      { name: 'Gradle', ext: '.gradle', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gradle/gradle-original.svg" width={14} height={14}/>
      }, // Иконка CSV отсутствует, используем общую
      { name: 'Gradle build', ext: '.gradle build', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gradle/gradle-original.svg" width={14} height={14}/>
       },
      { name: 'Graphql', ext: '.graphql', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/graphql/graphql-plain.svg" width={14} height={14}/>
       }, // Иконка XML отсутствует
      { name: 'Groovy', ext: '.groovy', icon: <File width={14} height={14}/>},
      { name: 'HLSL', ext: '.hlsl', icon: <File width={14} height={14}/> },
      { name: 'HTML', ext: '.html', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-plain.svg" width={14} height={14}/>
       },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ini', ext: '.ini', icon: <Settings width={14} height={14}/> },
      { name: 'JavaScript React', ext: '.javascriptreact', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width={14} height={14}/>
      
      },
      { name: 'Jinja', ext: '.jinja', icon: <File width={14} height={14}/>},
      { name: 'JSON', ext: '.json', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-plain.svg" width={14} height={14}/>
       },
      { name: 'Jsx', ext: '.Jsx', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width={14} height={14}/>},
      { name: 'Julia', ext: '.Julia', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/julia/julia-original.svg" width={14} height={14}/>
       },
      { name: 'Kotlin', ext: '.kotlin', icon: <File width={14} height={14}/> },
      { name: 'Kotlin Script', ext: '.kotlinscript', icon: <File width={14} height={14}/> },
      { name: 'LaTeX', ext: '.latex', icon: 
        <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/latex/latex-original.svg" width={14} height={14}/>
      },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
      { name: 'Ingnore', ext: '.ignore', icon: <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"width={14} height={14}/> },
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
          <span className="file-icons">{lang.icon}</span>
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