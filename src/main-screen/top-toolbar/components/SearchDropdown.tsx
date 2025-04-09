import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, File, Loader2 } from "lucide-react";

interface FileItem {
  name: string;
  path: string;
  icon?: string | React.ReactNode;
  is_directory?: boolean;
}

interface SearchDropdownProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  files: FileItem[];
  onFileSelect: (path: string) => void;
  selectedFolder: string | null;
  onClose?: () => void;
  isLoading?: boolean;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ 
  searchQuery, 
  onSearchChange, 
  files, 
  onFileSelect,
  selectedFolder,
  onClose,
  isLoading = false
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [displayedFiles, setDisplayedFiles] = useState<FileItem[]>([]);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  
  // Константы для настройки поведения
  const MAX_DISPLAY_COUNT = 100;   // Максимальное количество результатов
  const DISPLAY_INCREMENT = 50;    // Доп. результаты при прокрутке
  const MIN_SEARCH_LENGTH = 1;     // Минимальная длина поискового запроса
  
  // Получаем иконку для файла
  const getIcon = (fileName: string): React.ReactNode => {
    // Проверяем на самые распространенные типы файлов
    if (fileName.endsWith('.js')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.ts')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.html')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.css')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.scss') || fileName.endsWith('.sass')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sass/sass-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.less')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/less/less-plain-wordmark.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.json')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.md')) {
      return <img src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/markdown.svg" width={16} height={16} style={{ filter: "invert(70%)" }} />;
    } else if (fileName.endsWith('.py')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.java')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.c') || fileName.endsWith('.h')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.cpp') || fileName.endsWith('.hpp')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.cs')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/csharp/csharp-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.go')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.php')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.rb')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ruby/ruby-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.lua')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/lua/lua-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.rs')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-plain.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.swift')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/swift/swift-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.kt')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.dart')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dart/dart-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/yaml/yaml-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.sql')) {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg" width={16} height={16} />;
    } else if (fileName.endsWith('.svg')) {
      return <img src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/svg.svg" width={16} height={16} style={{ filter: "invert(70%)" }} />;
    } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.gif')) {
      return <img src="https://cdn.jsdelivr.net/npm/simple-icons@v4/icons/image.svg" width={16} height={16} style={{ filter: "invert(70%)" }} />;
    } else if (fileName === 'package.json') {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg" width={16} height={16} />;
    } else if (fileName.toLowerCase() === 'dockerfile') {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-plain.svg" width={16} height={16} />;
    } else if (fileName === '.gitignore') {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg" width={16} height={16} />;
    } else if (fileName === 'tsconfig.json') {
      return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" width={16} height={16} />;
    }
    
    // Возвращаем стандартную иконку файла, если ничего не найдено
    return <File width={16} height={16} color="#aaaaaa" />;
  };
  
  // Фильтрация файлов на основе запроса поиска
  const filteredFiles = useMemo(() => {
    // Не показываем результаты, если строка поиска пустая или слишком короткая
    if (!searchQuery || searchQuery.length < MIN_SEARCH_LENGTH) {
      return [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    if (!query) return [];
    
    // Приоритеты для сортировки результатов
    const exactMatches: FileItem[] = [];
    const startMatches: FileItem[] = [];
    const includesMatches: FileItem[] = [];
    
    // Проходим по всем файлам
    for (const file of files) {
      const fileName = file.name.toLowerCase();
      const filePath = file.path.toLowerCase();
      
      if (fileName === query) {
        exactMatches.push(file);
      } else if (fileName.startsWith(query)) {
        startMatches.push(file);
      } else if (fileName.includes(query) || filePath.includes(query)) {
        includesMatches.push(file);
      }
      
      // Ограничиваем количество результатов для производительности
      if (exactMatches.length + startMatches.length + includesMatches.length >= MAX_DISPLAY_COUNT * 2) {
        break;
      }
    }
    
    // Объединяем результаты по приоритету
    return [
      ...exactMatches,
      ...startMatches,
      ...includesMatches
    ];
  }, [files, searchQuery]);
  
  // Обновляем отображаемые файлы при изменении фильтра
  useEffect(() => {
    setDisplayedFiles(filteredFiles.slice(0, MAX_DISPLAY_COUNT));
    // Сбрасываем выделенный индекс при изменении результатов
    setSelectedIndex(-1);
  }, [filteredFiles]);
  
  // Обработчик клавиатурных событий
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Убедимся, что мы обрабатываем события только в Search Dropdown
      if (!displayedFiles.length) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prevIndex => {
            const newIndex = prevIndex < displayedFiles.length - 1 ? prevIndex + 1 : 0;
            scrollToSelected(newIndex);
            return newIndex;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prevIndex => {
            const newIndex = prevIndex > 0 ? prevIndex - 1 : displayedFiles.length - 1;
            scrollToSelected(newIndex);
            return newIndex;
          });
          break;
          
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < displayedFiles.length) {
            e.preventDefault();
            onFileSelect(displayedFiles[selectedIndex].path);
            if (onClose) onClose();
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          if (onClose) onClose();
          break;
      }
    };
    
    // Прокрутка к выделенному элементу
    const scrollToSelected = (index: number) => {
      if (resultsContainerRef.current && index >= 0) {
        const container = resultsContainerRef.current;
        const selectedElement = container.querySelector(`.file-item:nth-child(${index + 1})`);
        
        if (selectedElement) {
          const containerRect = container.getBoundingClientRect();
          const selectedRect = selectedElement.getBoundingClientRect();
          
          if (selectedRect.bottom > containerRect.bottom) {
            container.scrollTop += selectedRect.bottom - containerRect.bottom;
          } else if (selectedRect.top < containerRect.top) {
            container.scrollTop -= containerRect.top - selectedRect.top;
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [displayedFiles, selectedIndex, onFileSelect, onClose]);
  
  // Обработка прокрутки списка результатов
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Если прокрутили близко к концу списка
    if (scrollHeight - scrollTop <= clientHeight * 1.2) {
      // Загружаем больше результатов, если есть
      if (displayedFiles.length < filteredFiles.length) {
        setDisplayedFiles(prev => 
          filteredFiles.slice(0, Math.min(prev.length + DISPLAY_INCREMENT, filteredFiles.length))
        );
      }
    }
  };

  return (
    <div className="search-dropdown">
      <div className="search-container">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Введите имя файла для поиска..."
          autoFocus
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      {/* Контейнер списка файлов */}
      <div 
        ref={resultsContainerRef}
        className="file-list-container"
        onScroll={handleScroll}
        style={{ maxHeight: '500px', overflowY: 'auto' }}
      >
        {isLoading ? (
          <div className="loading-container">
            <Loader2 size={24} className="animate-spin" />
            <span>Сканирование файлов...</span>
          </div>
        ) : !searchQuery || searchQuery.length < MIN_SEARCH_LENGTH ? (
          <div className="search-placeholder">
            <p>Введите не менее {MIN_SEARCH_LENGTH} символов для поиска</p>
          </div>
        ) : displayedFiles.length > 0 ? (
          <>
            {displayedFiles.length > 10 && (
              <div className="search-stats">
                Найдено {filteredFiles.length} файлов
              </div>
            )}
            
            {/* Список найденных файлов */}
            {displayedFiles.map((file, index) => (
              <div 
                key={`${file.path}-${index}`} 
                className={`file-item ${selectedIndex === index ? 'selected' : ''}`}
                onClick={() => onFileSelect(file.path)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="file-icon">
                  {getIcon(file.name)}
              </div>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-path">{file.path}</span>
              </div>
            </div>
          ))}
            
            {/* Индикатор для загрузки дополнительных результатов */}
            {displayedFiles.length < filteredFiles.length && (
              <div className="load-more" onClick={() => {
                setDisplayedFiles(prev => 
                  filteredFiles.slice(0, Math.min(prev.length + DISPLAY_INCREMENT, filteredFiles.length))
                );
              }}>
                Показать ещё {Math.min(DISPLAY_INCREMENT, filteredFiles.length - displayedFiles.length)} из {filteredFiles.length - displayedFiles.length}
              </div>
            )}
          </>
        ) : (
          <div className="no-results">
            <p>Ничего не найдено по запросу "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchDropdown;