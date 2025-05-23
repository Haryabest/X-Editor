// FileSearchDialog.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fileSearchSystem, SearchResult } from '../utils/FileSearchSystem';
import './FileSearchDialog.css';

interface FileSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (fullPath: string) => void;
}

const FileSearchDialog: React.FC<FileSearchDialogProps> = ({ 
  isOpen, 
  onClose, 
  onFileSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);
  
  // Search for files when query changes
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await fileSearchSystem.searchFiles(query);
      setSearchResults(results);
      setSelectedIndex(results.length > 0 ? 0 : -1);
    } catch (err) {
      console.error('Error searching files:', err);
      setError('An error occurred while searching. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Debounced search
  useEffect(() => {
    const timerId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timerId);
  }, [searchQuery, performSearch]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (searchResults.length > 0) {
          setSelectedIndex(prev => (prev + 1) % searchResults.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (searchResults.length > 0) {
          setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        }
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          onFileSelect(searchResults[selectedIndex].fullPath);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };
  
  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    onFileSelect(result.fullPath);
    onClose();
  };
  
  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);
  
  if (!isOpen) return null;
  
  return (
    <div className="file-search-overlay" onClick={onClose}>
      <div className="file-search-dialog" onClick={e => e.stopPropagation()}>
        <h2 className="file-search-title">Find File</h2>
        
        <div className="file-search-input-container">
          <input
            ref={inputRef}
            type="text"
            className="file-search-input"
            placeholder="Enter partial path (e.g. components/Button)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        {error && <div className="file-search-error">{error}</div>}
        
        {isLoading && (
          <div className="file-search-loading">
            <div className="file-search-spinner"></div>
            <span>Searching...</span>
          </div>
        )}
        
        {!isLoading && searchResults.length === 0 && searchQuery.trim() !== '' && (
          <div className="file-search-no-results">
            No files found matching "{searchQuery}"
          </div>
        )}
        
        {searchResults.length > 0 && (
          <div className="file-search-results" ref={resultsRef}>
            {searchResults.map((result, index) => (
              <div
                key={result.fullPath}
                className={`file-search-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
                data-index={index}
                style={{ width: '100%' }}
              >
                <div 
                  className="file-search-result-name" 
                  title={result.name}
                  style={{ display: 'block', width: '100%' }}
                >
                  {result.name}
                  {result.isDirectory && '/'}
                </div>
                <div 
                  className="file-search-result-path" 
                  title={result.relativePath}
                  style={{ display: 'block', width: '100%' }}
                >
                  {result.relativePath}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="file-search-tips">
          <p>
            <span className="file-search-key">↑↓</span> 
            <span>для навигации</span>
            <span className="file-search-key">Enter</span> 
            <span>для выбора</span>
            <span className="file-search-key">Esc</span> 
            <span>для отмены</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileSearchDialog;
