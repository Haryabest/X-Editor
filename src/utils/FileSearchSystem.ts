// FileSearchSystem.ts
// This utility provides functions for searching files in the workspace

// Extend Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI?: {
      getCurrentWorkspace: () => string;
      getAllFiles: (path: string) => Promise<string[]>;
    };
  }
}

interface FileInfo {
  fullPath: string;
  name: string;
  extension: string;
  isDirectory: boolean;
}

export interface SearchResult {
  fullPath: string;
  relativePath: string;
  name: string;
  isDirectory: boolean;
  matchScore: number;
}

class FileSearchSystem {
  private workspacePath: string = '';
  private fileIndex: FileInfo[] = [];
  private isIndexed: boolean = false;
  private isIndexing: boolean = false;

  constructor() {
    // Initialize with the current workspace path
    this.workspacePath = window.electronAPI?.getCurrentWorkspace() || '';
  }

  /**
   * Index all files in the workspace
   * @returns Promise that resolves when indexing is complete
   */
  async indexFiles(): Promise<void> {
    if (this.isIndexing) return;
    
    this.isIndexing = true;
    try {
      console.log('Indexing files from:', this.workspacePath);
      
      if (!this.workspacePath) {
        console.error('No workspace path set');
        return;
      }

      // Use the electron API to get all files in the workspace
      const files = await window.electronAPI?.getAllFiles(this.workspacePath) || [];
      
      this.fileIndex = files.map((file: string) => {
        const name = this.getBasename(file);
        return {
          fullPath: file,
          name,
          extension: this.getExtension(name),
          isDirectory: file.endsWith('/') || file.endsWith('\\')
        };
      });
      
      console.log(`Indexed ${this.fileIndex.length} files`);
      this.isIndexed = true;
    } catch (error) {
      console.error('Error indexing files:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Search for files matching the given query
   * @param query Partial path or filename to search for
   * @returns Promise with search results
   */
  async searchFiles(query: string): Promise<SearchResult[]> {
    if (!this.isIndexed && !this.isIndexing) {
      await this.indexFiles();
    }

    if (!query.trim()) {
      return [];
    }

    // Normalize query and prepare for matching
    const normalizedQuery = query.toLowerCase().replace(/\\/g, '/');
    const queryParts = normalizedQuery.split('/').filter(Boolean);
    
    // Filter and score files
    const results = this.fileIndex
      .map(file => {
        const normalizedPath = file.fullPath.toLowerCase().replace(/\\/g, '/');
        const relativePath = normalizedPath.replace(this.workspacePath.toLowerCase().replace(/\\/g, '/'), '');
        
        let matchScore = 0;
        
        // Check if file path contains the query parts in the correct order
        let remainingPath = relativePath;
        let allPartsMatch = true;
        
        for (const part of queryParts) {
          const index = remainingPath.indexOf(part);
          if (index === -1) {
            allPartsMatch = false;
            break;
          }
          
          // Higher score for exact matches or matches at start of segments
          if (index === 0 || remainingPath[index - 1] === '/') {
            matchScore += 10;
          } else {
            matchScore += 5;
          }
          
          remainingPath = remainingPath.substring(index + part.length);
        }
        
        if (!allPartsMatch) {
          return null;
        }
        
        // Boost score for shorter paths (more relevant)
        matchScore += 100 - Math.min(100, relativePath.length);
        
        // Boost score for exact filename matches
        if (file.name.toLowerCase() === queryParts[queryParts.length - 1]) {
          matchScore += 50;
        }
        
        return {
          fullPath: file.fullPath,
          relativePath: this.getRelativePath(file.fullPath),
          name: file.name,
          isDirectory: file.isDirectory,
          matchScore
        };
      })
      .filter(Boolean) as SearchResult[];
    
    // Sort by match score (highest first)
    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 20);
  }

  /**
   * Get the extension of a filename
   */
  private getExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  /**
   * Get the basename of a path
   */
  private getBasename(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const lastSlashIndex = normalized.lastIndexOf('/');
    return lastSlashIndex === -1 ? normalized : normalized.substring(lastSlashIndex + 1);
  }

  /**
   * Get a relative path from a full path
   */
  private getRelativePath(fullPath: string): string {
    if (!this.workspacePath || !fullPath.startsWith(this.workspacePath)) {
      return fullPath;
    }
    return fullPath.substring(this.workspacePath.length).replace(/^[\/\\]/, '');
  }

  /**
   * Update the workspace path
   */
  setWorkspacePath(path: string): void {
    this.workspacePath = path;
    this.isIndexed = false;
    this.fileIndex = [];
  }
}

// Export a singleton instance
export const fileSearchSystem = new FileSearchSystem();
