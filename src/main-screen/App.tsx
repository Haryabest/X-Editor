import React from 'react';
import { fileScannerService, IssueInfo } from './centerContainer/fileScannerService';
import BottomToolbar from './bottom-toolbar/bottomBar';
import Terminal from './terminal/terminal';

interface AppState {
  fileIssues: IssueInfo[];
  totalErrors: number;
  totalWarnings: number;
  selectedFolder: string | null;
  scanIntervalId?: NodeJS.Timeout;
  openedFiles: Array<{path: string}>;
  currentLanguage?: string;
  cursorInfo?: any;
  gitInfo: { current_branch?: string };
  issueToNavigate?: { filePath: string; line: number; column: number };
}

class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      fileIssues: [],
      totalErrors: 0,
      totalWarnings: 0,
      selectedFolder: null,
      openedFiles: [],
      gitInfo: {}
    };

    window.addEventListener('scan-folder', (e: any) => {
      const detail = e.detail || {};
      if (detail.folderPath) {
        this.scheduleFolderScan(detail.folderPath);
      }
    });
  }

  componentDidMount() {
    if (this.state.selectedFolder) {
      this.scheduleFolderScan(this.state.selectedFolder);
    }
  }

  scheduleFolderScan = (folderPath: string) => {
    if (!folderPath) return;
    
    this.setState({ selectedFolder: folderPath });
    
    this.scanFolder(folderPath);
    
    if (this.state.scanIntervalId) {
      clearInterval(this.state.scanIntervalId);
    }
    
    const scanInterval = setInterval(() => {
      if (this.state.selectedFolder === folderPath) {
        this.scanFolder(folderPath);
      } else {
        clearInterval(scanInterval);
      }
    }, 30000);
    
    this.setState({ scanIntervalId: scanInterval });
  }

  scanFolder = async (folderPath: string) => {
    console.log(`Scanning folder: ${folderPath}`);
    
    try {
      const scanResult = await fileScannerService.scanDirectory(folderPath);
      
      this.setState({
        fileIssues: scanResult.allIssues,
        totalErrors: scanResult.errorCount,
        totalWarnings: scanResult.warningCount
      });
      
      console.log(`Scan completed: ${scanResult.errorCount} errors, ${scanResult.warningCount} warnings`);
    } catch (error) {
      console.error('Error scanning folder:', error);
    }
  }

  componentWillUnmount() {
    if (this.state.scanIntervalId) {
      clearInterval(this.state.scanIntervalId);
    }
    
    window.removeEventListener('scan-folder', (e: any) => {
      const detail = e.detail || {};
      if (detail.folderPath) {
        this.scheduleFolderScan(detail.folderPath);
      }
    });
  }

  handleFolderSelect = (folderPath: string | null) => {
    if (folderPath) {
      this.scheduleFolderScan(folderPath);
    }
  }

  addFileToOpenedFiles = (filePath: string) => {
    this.setState(prevState => ({
      openedFiles: [...prevState.openedFiles, { path: filePath }]
    }));
  };

  handleFileSelect = (filePath: string) => {
    console.log(`Selected file: ${filePath}`);
  };

  render() {
    return (
      <div className="app">
        <BottomToolbar
          editorInfo={{
            errors: this.state.totalErrors,
            warnings: this.state.totalWarnings,
            language: this.state.currentLanguage ?? "plaintext",
            encoding: "UTF-8",
            cursorInfo: this.state.cursorInfo,
            gitBranch: this.state.gitInfo.current_branch
          }}
          gitInfo={{ current_branch: this.state.gitInfo.current_branch ?? "", status: "" }}
          selectedFolder={this.state.selectedFolder}
        />
        
        <Terminal
          issues={this.state.fileIssues}
          onIssueClick={this.handleIssueClick}
        />
      </div>
    );
  }

  handleIssueClick = (filePath: string, line: number, column: number) => {
    if (!this.state.openedFiles.some(file => file.path === filePath)) {
      this.addFileToOpenedFiles(filePath);
    }
    
    this.handleFileSelect(filePath);
    
    this.setState({
      issueToNavigate: { filePath, line, column }
    });
  }

  handleEditorMount = (editor: any, monaco: any) => {
    fileScannerService.initialize(monaco);
  }
}

export default App; 