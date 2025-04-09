import React from 'react';
import { Search } from "lucide-react";

interface SearchTriggerProps {
  width: string;
  onClick: () => void;
  selectedFolder?: string | null;
  isSearchActive?: boolean;
}

const SearchTrigger: React.FC<SearchTriggerProps> = ({ 
  width, 
  onClick, 
  selectedFolder,
  isSearchActive 
}) => {
  const displayText = selectedFolder 
    ? `${selectedFolder.split(/[\\/]/).pop() || selectedFolder}`
    : "Поиск (Ctrl+P)";

  return (
    <button
      className={`search-trigger ${isSearchActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ width }}
      title={selectedFolder 
        ? `Поиск файлов в ${selectedFolder}` 
        : "Выберите папку для поиска файлов"}
    >
      <Search size={16} />
      <span>{displayText}</span>
    </button>
  );
};

export default SearchTrigger;