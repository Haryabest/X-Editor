import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SearchTrigger from './components/SearchTrigger';
import SearchDropdown from './components/SearchDropdown';

interface FileItem {
  name: string;
  path: string;
  is_directory?: boolean;
}

interface TopToolbarProps {
  selectedFolder: string | null;
  setSelectedFile?: (path: string | null) => void;
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  selectedFolder,
  setSelectedFile
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Получаем файлы из выбранной директории
  useEffect(() => {
    const loadFiles = async () => {
      if (selectedFolder && isSearchOpen) {
        setIsLoading(true);
        try {
          // Вызываем бэкенд для получения всех файлов в выбранной директории
          console.log('Запрос файлов из директории:', selectedFolder);
          const filePaths = await invoke<string[]>("get_all_files_in_directory", { directory: selectedFolder });
          console.log('Получено файлов:', filePaths.length);
          
          // Преобразуем пути файлов в объекты FileItem
          const fileItems: FileItem[] = filePaths.map(path => {
            const name = path.split(/[\/\\]/).pop() || path;
            return {
              name,
              path,
              is_directory: false // API возвращает только файлы
            };
          });
          
          console.log('Подготовлено объектов FileItem:', fileItems.length);
          setFiles(fileItems);
        } catch (error) {
          console.error('Ошибка при загрузке файлов:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadFiles();
  }, [selectedFolder, isSearchOpen]);
  
  const handleFileSelect = (path: string) => {
    if (setSelectedFile) {
      setSelectedFile(path);
    }
    setIsSearchOpen(false);
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setSearchQuery(''); // Сбрасываем поисковый запрос при открытии
    }
  };

  return (
    <div className="top-toolbar">
      <div className="left-section">
        <SearchTrigger 
          width="180px" 
          onClick={toggleSearch}
          selectedFolder={selectedFolder}
          isSearchActive={isSearchOpen}
        />
        {isSearchOpen && (
          <SearchDropdown
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            files={files}
            onFileSelect={handleFileSelect}
            selectedFolder={selectedFolder}
            onClose={() => setIsSearchOpen(false)}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

export default TopToolbar; 