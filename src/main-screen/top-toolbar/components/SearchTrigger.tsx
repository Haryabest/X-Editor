import React from 'react';
import { Search } from "lucide-react";

interface SearchTriggerProps {
  width: string;
  onClick: () => void;
}

const SearchTrigger: React.FC<SearchTriggerProps> = ({ width, onClick }) => (
  <button
    className="search-trigger"
    onClick={onClick}
    style={{ width }}
  >
    <Search size={16} />
    <span>Поиск...</span>
  </button>
);

export default SearchTrigger;