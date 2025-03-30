/**
 * Language detector utility for file extensions
 */

// Helper function to get language ID based on file extension
export const getLanguageFromExtension = (filePath: string): string => {
  if (!filePath) return 'plaintext';
  
  const ext = filePath.toLowerCase().split('.').pop() || '';
  
  // Mapping file extensions to Monaco editor language IDs
  const languageMap: Record<string, string> = {
    // TypeScript/JavaScript
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'js': 'javascript',
    'jsx': 'javascriptreact',
    'mjs': 'javascript',
    'cjs': 'javascript',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'xhtml': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'svg': 'xml',
    
    // Data formats
    'json': 'json',
    'jsonc': 'jsonc',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'csv': 'plaintext',
    'toml': 'plaintext',
    
    // C-family
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'cxx': 'cpp',
    'cs': 'csharp',
    'java': 'java',
    
    // Python
    'py': 'python',
    'pyc': 'python',
    'pyd': 'python',
    'pyo': 'python',
    'pyw': 'python',
    
    // PHP
    'php': 'php',
    
    // Ruby
    'rb': 'ruby',
    
    // Go
    'go': 'go',
    
    // Rust
    'rs': 'rust',
    
    // Swift
    'swift': 'swift',
    
    // Kotlin
    'kt': 'kotlin',
    'kts': 'kotlin',
    
    // Shell scripts
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'bat': 'bat',
    'cmd': 'bat',
    'ps1': 'powershell',
    
    // Other programming languages
    'r': 'r',
    'lua': 'lua',
    'perl': 'perl',
    'pl': 'perl',
    'pm': 'perl',
    'hs': 'haskell',
    'sql': 'sql',
    
    // Configurations
    'ini': 'ini',
    'conf': 'ini',
    'properties': 'properties',
    'env': 'properties',
    
    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'txt': 'plaintext',
    'rst': 'plaintext',
    'tex': 'plaintext',
    'log': 'plaintext',
    
    // Common config files (convention-based)
    'gitignore': 'plaintext',
    'dockerignore': 'plaintext',
    'editorconfig': 'plaintext'
  };
  
  // Check if this is a known file extension
  return languageMap[ext] || 'plaintext';
};

// Export helper function to determine if a file is a text file
export const isTextFile = (filePath: string): boolean => {
  if (!filePath) return false;
  
  // Get the language for the file
  const language = getLanguageFromExtension(filePath);
  
  // Any file that has a language other than plaintext
  // or is explicitly a text format is considered a text file
  return language !== 'plaintext' || 
         filePath.toLowerCase().endsWith('.txt') ||
         filePath.toLowerCase().endsWith('.md') ||
         filePath.toLowerCase().endsWith('.log');
};

// Export helper to determine if a file is a TypeScript file
export const isTypeScriptFile = (filePath: string): boolean => {
  if (!filePath) return false;
  
  const language = getLanguageFromExtension(filePath);
  return language === 'typescript' || language === 'typescriptreact';
};

// Export helper to determine if a file is a JavaScript file
export const isJavaScriptFile = (filePath: string): boolean => {
  if (!filePath) return false;
  
  const language = getLanguageFromExtension(filePath);
  return language === 'javascript' || language === 'javascriptreact';
}; 