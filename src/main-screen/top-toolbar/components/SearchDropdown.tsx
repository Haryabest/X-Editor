import React from 'react';
import { Search } from "lucide-react";

interface FileItem {
  name: string;
  path: string;
  icon: string;
}

interface SearchDropdownProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  files: FileItem[];
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ searchQuery, onSearchChange, files }) => (
  <div className="search-dropdown">
    <div className="search-container">
      <Search size={16} className="search-icon" />
      <input
        type="text"
        placeholder="Поиск по файлам..."
        autoFocus
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
    
    <div className="file-list-container">
      {files.map((file, index) => (
        <div key={index} className="file-item">
          <span className="file-icon">{file.icon}</span>
          <div className="file-info">
            <span className="file-name">{file.name}</span>
            <span className="file-path">{file.path}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SearchDropdown;