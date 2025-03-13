import { useState } from "react";
import {Search} from "lucide-react";

import "./styleEncoding.css";

const EncodingDropdown = () => {
    const [search, setSearch] = useState("");
    const encodings = [
      "UTF-8", "UTF-8 with BOM", "UTF-16 LE", "UTF-16 BE", "UTF-32 LE", "UTF-32 BE", "ISO 8859-1", "ISO 8859-2", "ISO 8859-3", "ISO 8859-4", "ISO 8859-5", "ISO 8859-6", "ISO 8859-7", "ISO 8859-8", "ISO 8859-9", "ISO 8859-10", "ISO 8859-13", "ISO 8859-14", "ISO 8859-15", "ISO 8859-16", "Windows 1250", "Windows 1251", "Windows 1252", "Windows 1253", "Windows 1254", "Windows 1255", "Windows 1256", "Windows 1257", "Windows 1258", "KOI8-R", "KOI8-U", "IBM850", "IBM866", "MacRoman", "MacCyrillic", "GB18030", "Big5", "Shift JIS", "EUC-JP", "EUC-KR"
    ];
  
    const filteredEncodings = encodings.filter((encoding) => 
      encoding.toLowerCase().includes(search.toLowerCase())
    );
  
    return (
      <div className="dropdown-content dropdown-encoding">
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="encoding-list-container">
          <ul>
            {filteredEncodings.map((encoding, index) => (
              <li key={index} className="encoding-item">{encoding}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  export default EncodingDropdown;