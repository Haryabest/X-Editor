import { useState } from "react";
import {Search,File,Database,Settings,FileText} from "lucide-react";

import "./styleLanguage.css";

const LanguageDropdown = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const languages = [
      {
        name: "Python",
        ext: ".py",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg"
            width="12"
            height="12"
          />
        ),
      },
      {
        name: "JavaScript",
        ext: ".js",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg"
            width="12"
            height="12"
          />
        ),
      },
      {
        name: "Java",
        ext: ".java",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "TypeScript",
        ext: ".ts",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "TypeScript JSX",
        ext: ".tsx",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "CSS",
        ext: ".css",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-plain.svg"
            width="14"
            height="14"
          />
        ),
      },
      { name: "Batch", ext: ".bat", icon: <File width={12} height={12} /> },
      { name: "BibTeX", ext: ".bibtex", icon: <File width={12} height={12} /> },
      {
        name: "C",
        ext: ".c",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-plain.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "C#",
        ext: ".csharp",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/csharp/csharp-plain.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "C++",
        ext: ".cpp",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-plain.svg"
            width="14"
            height="14"
          />
        ),
      },
      { name: "CSV", ext: ".csv", icon: <File width={12} height={12} /> },
      {
        name: "Dart",
        ext: ".dart",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/dart/dart-plain.svg"
            width="14"
            height="14"
          />
        ),
      },
      {
        name: "Databse",
        ext: ".db",
        icon: <Database width={12} height={12} />,
      },
      {
        name: "F#",
        ext: ".fsharp",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/fsharp/fsharp-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Git",
        ext: ".git",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Go",
        ext: ".go",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Gradle",
        ext: ".gradle",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gradle/gradle-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Gradle build",
        ext: ".gradle build",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/gradle/gradle-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Graphql",
        ext: ".graphql",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/graphql/graphql-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "Groovy", ext: ".groovy", icon: <File width={14} height={14} /> },
      { name: "HLSL", ext: ".hlsl", icon: <File width={14} height={14} /> },
      {
        name: "HTML",
        ext: ".html",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Ingnore",
        ext: ".ignore",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "Ini", ext: ".ini", icon: <Settings width={14} height={14} /> },
      {
        name: "JavaScript React",
        ext: ".javascriptreact",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "Jinja", ext: ".jinja", icon: <File width={14} height={14} /> },
      {
        name: "JSON",
        ext: ".json",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "JSX",
        ext: ".jsx",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Julia",
        ext: ".Julia",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/julia/julia-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "Kotlin", ext: ".kotlin", icon: <File width={14} height={14} /> },
      {
        name: "Kotlin Script",
        ext: ".kotlinscript",
        icon: <File width={14} height={14} />,
      },
      {
        name: "LaTeX",
        ext: ".latex",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/latex/latex-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Less",
        ext: ".less",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/less/less-plain-wordmark.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "Log", ext: ".log", icon: <File width={14} height={14} /> },
      {
        name: "Lua",
        ext: ".lua",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/lua/lua-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "MS SQL",
        ext: ".sql",
        icon: <Database width={14} height={14} />,
      },
      {
        name: "Perl",
        ext: ".perl",
        icon: (
          <img
            height="14"
            width="14"
            src="https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/perl.svg"
          />
        ),
      },
      {
        name: "PHP",
        ext: ".php",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "PowerShell",
        ext: ".powershell",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/powershell/powershell-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      { name: "R", ext: ".r", icon: <File width={14} height={14} /> },
      { name: "Raku", ext: ".raku", icon: <File width={14} height={14} /> },
      { name: "Razor", ext: ".razor", icon: <File width={14} height={14} /> },
      {
        name: "Ruby",
        ext: ".ruby",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ruby/ruby-plain.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "SCSS",
        ext: ".scss",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sass/sass-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Yaml",
        ext: ".yaml",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/yaml/yaml-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "XML",
        ext: ".xml",
        icon: (
          <img
            src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/xml/xml-original.svg"
            width={14}
            height={14}
          />
        ),
      },
      {
        name: "Простой текст",
        ext: ".plaintext",
        icon: <FileText width={14} height={14} />,
      },
      { name: "XSL", ext: ".xsl", icon: <File width={14} height={14} /> },
    ];
    const filteredLanguages = languages.filter(lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  
    return (
      <div className="dropdown-content dropdown-language">
        <div className="search-container">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Поиск языка..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="language-list-container">
          <ul>
            {filteredLanguages.map((lang) => (
        <li key={lang.name} className="language-item1">
        <div className="language-content">
<span className="file-icons">          {lang.icon}
</span>          {lang.name}
        </div>
        <span className="file-ext">{lang.ext}</span>
      </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  export default LanguageDropdown;