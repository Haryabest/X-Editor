import React, { useState } from 'react';
// Импортируем функционал поиска файлов
import { FileSearchSystem } from '../monaco-config/file-search';
import { FileSearchDialog } from './FileSearchDialog';
import './TitleBar.css';

// Функция поиска файлов для использования в TitleBar
async function openFileSearch() {
  try {
    // Запрашиваем у пользователя частичный путь
    const partialPath = prompt('Введите частичный путь для поиска (например, components\\Notification):');
    
    if (!partialPath) return;
    
    // Ищем файлы по частичному пути
    const results = await FileSearchSystem.getFileInfo(partialPath);
    const formattedResults = FileSearchSystem.formatSearchResults(results);
    
    // Показываем результаты
    alert(formattedResults);
    
    // Вывод в консоль для отладки
    console.log('Результаты поиска:', results);
  } catch (error) {
    console.error('Ошибка при поиске файлов:', error);
    alert(`Ошибка поиска: ${error}`);
  }
}

// Добавляем кнопку поиска файлов в TitleBar
function TitleBar() {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  
  // Открытие диалога поиска файлов
  const openFileSearch = () => {
    setIsSearchDialogOpen(true);
  };
  
  // Закрытие диалога поиска файлов
  const closeFileSearch = () => {
    setIsSearchDialogOpen(false);
  };
  
  // Обработка выбора файла
  const handleFileSelect = (fullPath: string) => {
    console.log('Выбран файл:', fullPath);
    // Здесь можно добавить логику открытия файла в редакторе
    // Например:
    // openFileInEditor(fullPath);
  };
  
  return (
    <div className="titlebar">
      <div className="window-controls">
        {/* Кнопки управления окном (минимизировать, максимизировать, закрыть) */}
        <button className="window-control minimize">—</button>
        <button className="window-control maximize">□</button>
        <button className="window-control close">×</button>
      </div>
      <div className="titlebar-title">X-Editor</div>
      <div className="titlebar-actions">
        {/* Кнопка поиска файлов */}
        <button 
          className="titlebar-action-button"
          onClick={openFileSearch}
          title="Поиск файлов по частичному пути (аналог Everything)"
        >
          🔍 Поиск файлов
        </button>
        {/* Здесь могут быть другие элементы управления */}
      </div>
      
      {/* Диалог поиска файлов */}
      <FileSearchDialog 
        isOpen={isSearchDialogOpen}
        onClose={closeFileSearch}
        onFileSelect={handleFileSelect}
      />
    </div>
  );
}

export default TitleBar; 