import React from 'react';
import { Search } from "lucide-react";

interface SearchTriggerProps {
  width: string;
  onClick: () => void;
  selectedFolder?: string | null;
}

const SearchTrigger: React.FC<SearchTriggerProps> = ({ width, onClick, selectedFolder }) => {
  const displayText = selectedFolder 
    ? selectedFolder.split(/[\\/]/).pop() || selectedFolder
    : "Поиск...";

  return (
    <button
      className="search-trigger"
      onClick={onClick}
      style={{ width }}
    >
      <Search size={16} />
      <span>{displayText}</span>
    </button>
  );
};

export default SearchTrigger;