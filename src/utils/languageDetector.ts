export const getLanguageFromExtension = (filePath: string): string => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    // JavaScript
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    
    // TypeScript
    case '.ts':
    case '.tsx':
      return 'typescript';
    
    // Python
    case '.py':
    case '.pyi':
    case '.pyw':
    case '.pyx':
    case '.pxd':
    case '.pxi':
    case '.pyd':
      return 'python';
    
    // Java
    case '.java':
    case '.jav':
      return 'java';
    
    // C/C++
    case '.c':
    case '.h':
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.hpp':
    case '.hh':
    case '.hxx':
      return 'cpp';
    
    // C#
    case '.cs':
    case '.csx':
      return 'csharp';
    
    // HTML
    case '.html':
    case '.htm':
    case '.shtml':
    case '.xhtml':
      return 'html';
    
    // CSS
    case '.css':
    case '.scss':
    case '.sass':
    case '.less':
      return 'css';
    
    // JSON
    case '.json':
    case '.jsonc':
    case '.json5':
      return 'json';
    
    // Markdown
    case '.md':
    case '.markdown':
    case '.mdown':
      return 'markdown';
    
    // XML
    case '.xml':
    case '.xsd':
    case '.xsl':
    case '.xslt':
      return 'xml';
    
    // YAML
    case '.yml':
    case '.yaml':
      return 'yaml';
    
    // Shell
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.fish':
    case '.ksh':
      return 'shell';
    
    // PowerShell
    case '.ps1':
    case '.psm1':
    case '.psd1':
      return 'powershell';
    
    // PHP
    case '.php':
    case '.phtml':
    case '.php3':
    case '.php4':
    case '.php5':
    case '.php7':
    case '.phps':
      return 'php';
    
    // Ruby
    case '.rb':
    case '.rbx':
    case '.rjs':
    case '.gemspec':
    case '.rake':
    case '.ru':
    case '.erb':
      return 'ruby';
    
    // Go
    case '.go':
      return 'go';
    
    // Rust
    case '.rs':
    case '.rlib':
      return 'rust';
    
    // Swift
    case '.swift':
      return 'swift';
    
    // Kotlin
    case '.kt':
    case '.kts':
      return 'kotlin';
    
    // Scala
    case '.scala':
    case '.sc':
      return 'scala';
    
    // R
    case '.r':
    case '.rdata':
    case '.rds':
    case '.rda':
      return 'r';
    
    // Dart
    case '.dart':
      return 'dart';
    
    // Lua
    case '.lua':
      return 'lua';
    
    // Perl
    case '.pl':
    case '.pm':
    case '.pod':
    case '.t':
      return 'perl';
    
    // SQL
    case '.sql':
    case '.psql':
    case '.plsql':
    case '.mysql':
    case '.sqlite':
      return 'sql';
    
    // GraphQL
    case '.graphql':
    case '.gql':
      return 'graphql';
    
    // Docker
    case '.dockerfile':
    case '.dockerignore':
      return 'dockerfile';
    
    // Git
    case '.gitignore':
      return 'gitignore';
    
    // Plain text
    case '.txt':
    case '.text':
    case '.log':
    default:
      return 'plaintext';
  }
}; 