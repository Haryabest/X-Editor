import React from 'react';
import { Search } from "lucide-react";
import { getFileIcon, FolderIcon } from '../../leftBar/fileIcons';

interface FileItem {
  name: string;
  path: string;
  icon: string;
  isFolder?: boolean;
}

interface SearchDropdownProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  files: FileItem[];
  onFileSelect: (path: string) => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ searchQuery, onSearchChange, files, onFileSelect }) => {
  const renderFileIcon = (fileName: string) => {
    const icon = getFileIcon(fileName);
    return icon;
  };

  return (
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
        {files
          .filter(file =>
            file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            file.path.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((file, index) => (
            <div 
              key={index} 
              className="file-item"
              onClick={() => onFileSelect(file.path)}
            >
              <div className="file-icon">
                {file.isFolder ? <FolderIcon /> : renderFileIcon(file.name)}
              </div>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-path">{file.path}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default SearchDropdown;