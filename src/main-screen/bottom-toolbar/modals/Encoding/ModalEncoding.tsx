import { useState } from "react";
import { Search } from "lucide-react";

import "./styleEncoding.css";

interface EncodingDropdownProps {
  onClose?: () => void;
  onSelect?: (encoding: string) => void;
  currentEncoding?: string;
}

const EncodingDropdown: React.FC<EncodingDropdownProps> = ({ 
  onClose, 
  onSelect,
  currentEncoding = "UTF-8" 
}) => {
  const [search, setSearch] = useState("");
  // Полный список кодировок, как в VS Code
  const encodings = [
    "UTF-8", "UTF-8 with BOM", "UTF-16 LE", "UTF-16 BE", "UTF-32 LE", "UTF-32 BE", 
    "Windows 1252 (CP1252)", "Windows 1251 (CP1251)", "Windows 1250 (CP1250)",
    "Windows 1253 (CP1253)", "Windows 1254 (CP1254)", "Windows 1255 (CP1255)",
    "Windows 1256 (CP1256)", "Windows 1257 (CP1257)", "Windows 1258 (CP1258)",
    "ISO 8859-1 (Latin-1)", "ISO 8859-2 (Latin-2)", "ISO 8859-3 (Latin-3)",
    "ISO 8859-4 (Latin-4)", "ISO 8859-5 (Cyrillic)", "ISO 8859-6 (Arabic)",
    "ISO 8859-7 (Greek)", "ISO 8859-8 (Hebrew)", "ISO 8859-9 (Turkish)",
    "ISO 8859-10 (Nordic)", "ISO 8859-13 (Baltic)", "ISO 8859-14 (Celtic)",
    "ISO 8859-15 (Latin-9)", "ISO 8859-16 (Latin-10)", 
    "KOI8-R (Russian)", "KOI8-U (Ukrainian)", 
    "IBM437", "IBM850", "IBM866", 
    "GB2312", "GB18030", "Big5", "Big5-HKSCS",
    "Shift JIS", "EUC-JP", "EUC-KR", "ISO-2022-JP"
  ];

  const filteredEncodings = encodings.filter((encoding) => 
    encoding.toLowerCase().includes(search.toLowerCase())
  );

  const handleEncodingSelect = (encoding: string) => {
    if (onSelect) {
      onSelect(encoding);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="dropdown-content dropdown-encoding">
      
      <div className="search-container">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Поиск кодировки..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="encoding-list-container">
        <ul>
          {filteredEncodings.map((encoding, index) => (
            <li 
              key={index} 
              className={`encoding-item ${encoding === currentEncoding ? 'active' : ''}`}
              onClick={() => handleEncodingSelect(encoding)}
            >
              <div className="encoding-content">
                <span>{encoding}</span>
              </div>
            </li>
          ))}
        </ul>
        {filteredEncodings.length === 0 && (
          <div className="no-results">Кодировки не найдены</div>
        )}
      </div>
    </div>
  );
};

export default EncodingDropdown;