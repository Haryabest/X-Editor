import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import { FileItem } from '../../types';
import { Loader2, Save, RefreshCw } from 'lucide-react';
import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';

import "./style.css";

interface ProjectInfo {
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  dependencies: string[];
  devDependencies: string[];
  path: string;
}

const analyzeProject = async (folderPath: string): Promise<ProjectInfo> => {
  const packageJsonPath = `${folderPath}/package.json`;
  let hasPackageJson = false;
  let dependencies: string[] = [];
  let devDependencies: string[] = [];

  try {
    const packageJsonContent = await invoke<string>('read_text_file', { path: packageJsonPath });
    const packageJson = JSON.parse(packageJsonContent);
    hasPackageJson = true;
    dependencies = Object.keys(packageJson.dependencies || {});
    devDependencies = Object.keys(packageJson.devDependencies || {});
  } catch (error) {
    console.log('No package.json found or error parsing:', error);
  }

  const hasCargoToml = await invoke<boolean>('file_exists', { path: `${folderPath}/Cargo.toml` });

  return {
    hasPackageJson,
    hasCargoToml,
    dependencies,
    devDependencies,
    path: folderPath,
  };
};

const installDependencies = async (folderPath: string): Promise<void> => {
  try {
    const hasPackageJson = await invoke<boolean>('file_exists', { path: `${folderPath}/package.json` });
    if (hasPackageJson) {
      console.log('Installing Node.js dependencies...');
      await invoke('run_command', { command: 'npm', args: ['install'], cwd: folderPath });
      console.log('Dependencies installed successfully.');
    }

    const hasCargoToml = await invoke<boolean>('file_exists', { path: `${folderPath}/Cargo.toml` });
    if (hasCargoToml) {
      console.log('Installing Rust dependencies...');
      await invoke('run_command', { command: 'cargo', args: ['build'], cwd: folderPath });
      console.log('Rust dependencies built successfully.');
    }
  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
};

interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void;
  selectedFile: string | null;
  openedFiles: FileItem[];
  setOpenedFiles: (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
  handleCreateFile: () => void;
  selectedFolder?: string | null;
}

const CenterContainer: React.FC<CenterContainerProps> = ({
  style,
  setSelectedFolder,
  selectedFile,
  openedFiles,
  setOpenedFiles,
  handleCreateFile,
  selectedFolder
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('// Start coding here...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  const supportedTextExtensions = useMemo(() => [
    '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss',
    '.py', '.java', '.cpp', '.c', '.md', '.dart', '.rs', '.toml', '.yaml', '.yml'
  ], []);

  const supportedImageExtensions = useMemo(() => ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'], []);
  const supportedVideoExtensions = useMemo(() => ['.mp4', '.webm', '.ogg', '.mov'], []);

  const getLanguageFromExtension = useCallback((filePath: string): string => {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'cpp',
      '.md': 'markdown',
      '.dart': 'dart',
      '.rs': 'rust',
      '.toml': 'toml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.txt': 'plaintext'
    };
    return languageMap[ext] || 'plaintext';
  }, []);

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    quickSuggestions: true,
    snippetSuggestions: 'top',
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'smart',
    tabCompletion: 'on',
    wordBasedSuggestions: 'currentDocument',
    parameterHints: { enabled: true },
    formatOnPaste: true,
    formatOnType: true,
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full',
  };

  const loadTypeScriptDefinitions = async (projectRoot: string) => {
    try {
      const tsConfigPath = `${projectRoot}/tsconfig.json`;
      const tsConfigExists = await invoke<boolean>('file_exists', { path: tsConfigPath });

      if (!tsConfigExists) {
        console.warn('tsconfig.json not found. Using default TypeScript settings.');
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          jsx: monaco.languages.typescript.JsxEmit.React,
          allowJs: true,
          checkJs: true,
          typeRoots: [`${projectRoot}/node_modules/@types`, `${projectRoot}/node_modules`],
        });
        return;
      }

      const tsConfigContent = await invoke<string>('read_text_file', { path: tsConfigPath });
      const tsConfigWithoutComments = tsConfigContent.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
      const tsConfig = JSON.parse(tsConfigWithoutComments);
      const { compilerOptions } = tsConfig;

      const typeRoots = compilerOptions?.typeRoots || [
        `${projectRoot}/node_modules/@types`,
        `${projectRoot}/node_modules`,
      ];

      typeRoots.forEach((typeRoot: string) => {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          `declare module '*' { const value: any; export = value; }`,
          `file://${typeRoot}/index.d.ts`
        );
      });

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        checkJs: true,
        typeRoots,
      });
    } catch (error) {
      console.error('Error loading TypeScript definitions:', error);
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        checkJs: true,
        typeRoots: [`${projectRoot}/node_modules/@types`, `${projectRoot}/node_modules`],
      });
    }
  };

  useEffect(() => {
    const loadProjectInfo = async () => {
      if (selectedFolder) {
        try {
          const info = await analyzeProject(selectedFolder);
          setProjectInfo(info);

          if (info.hasPackageJson && !isInstalling) {
            setIsInstalling(true);
            await installDependencies(selectedFolder);
            setIsInstalling(false);
          }

          await loadTypeScriptDefinitions(selectedFolder);
        } catch (error) {
          console.error('Error loading project info:', error);
          setIsInstalling(false);
        }
      }
    };
    loadProjectInfo();
  }, [selectedFolder]);

  useEffect(() => {
    const loadFileContent = async () => {
      if (selectedFile) {
        const ext = selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase();

        try {
          if (supportedTextExtensions.includes(ext)) {
            const content: string = await invoke('read_text_file', { path: selectedFile });
            setFileContent(content);
            setCode(content);
            setImageSrc(null);
            setVideoSrc(null);
          } else if (supportedImageExtensions.includes(ext)) {
            const base64Content: string = await invoke('read_binary_file', { path: selectedFile });
            setImageSrc(`data:image/${ext.slice(1)};base64,${base64Content}`);
            setFileContent(null);
            setVideoSrc(null);
          } else if (supportedVideoExtensions.includes(ext)) {
            const videoUrl: string = await invoke('stream_video', { path: selectedFile });
            setVideoSrc(videoUrl);
            setFileContent(null);
            setImageSrc(null);
          } else if (selectedFile.startsWith('untitled-')) {
            setFileContent('');
            setCode('');
            setImageSrc(null);
            setVideoSrc(null);
          } else {
            setFileContent(null);
            setImageSrc(null);
            setVideoSrc(null);
          }
        } catch (error) {
          console.error('Error reading file:', error);
          setFileContent(null);
          setImageSrc(null);
          setVideoSrc(null);
        }
      }
    };
    loadFileContent();
  }, [selectedFile, supportedTextExtensions, supportedImageExtensions, supportedVideoExtensions]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const folderPath = await open({ directory: true, multiple: false });
      if (folderPath) {
        setSelectedFolder(folderPath as string);
        setIsEditorOpen(false);
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      alert(`Failed to open folder: ${error}`);
    }
  }, [setSelectedFolder]);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      if (selectedFile.startsWith('untitled-')) {
        const filePath = await save({
          filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'JavaScript', extensions: ['js', 'jsx'] },
            { name: 'TypeScript', extensions: ['ts', 'tsx'] },
            { name: 'HTML', extensions: ['html', 'htm'] },
            { name: 'CSS', extensions: ['css', 'scss'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Python', extensions: ['py'] },
            { name: 'Rust', extensions: ['rs'] }
          ],
          defaultPath: selectedFolder || undefined
        });

        if (filePath) {
          await invoke('save_file', { path: filePath as string, content: code });

          setOpenedFiles((prev) => prev.map((file) =>
            file.path === selectedFile
              ? { 
                  ...file, 
                  name: (filePath as string).split(/[\\/]/).pop() || 'Untitled', 
                  path: filePath as string 
                }
              : file
          ));
        }
      } else {
        await invoke('save_file', { path: selectedFile, content: code });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save file: ${error}`);
    }
  }, [selectedFile, selectedFolder, code, setOpenedFiles]);

  const isEditableFile = useCallback((filePath: string) => {
    return supportedTextExtensions.some((ext) => filePath.toLowerCase().endsWith(ext)) || 
           filePath.startsWith('untitled-');
  }, [supportedTextExtensions]);

  const isImageFile = useCallback((filePath: string) => {
    return supportedImageExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));
  }, [supportedImageExtensions]);

  const isVideoFile = useCallback((filePath: string) => {
    return supportedVideoExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));
  }, [supportedVideoExtensions]);

  return (
    <div className="center-container" style={style}>
      {isEditorOpen || selectedFile ? (
        <>
          {isEditableFile(selectedFile || '') ? (
            <div className="editor-wrapper">
              <div className="editor-header">
                <div className="editor-controls">
                  <button 
                    onClick={handleSaveFile} 
                    className="control-btn save-btn"
                    title="Save file"
                  >
                    <Save size={16} />
                    <span>Save</span>
                  </button>
                  {isInstalling && (
                    <div className="installing-indicator">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Installing dependencies...</span>
                    </div>
                  )}
                </div>
                {projectInfo && (
                  <div className="project-info">
                    {projectInfo.hasPackageJson && (
                      <span className="badge node-badge">Node.js</span>
                    )}
                    {projectInfo.hasCargoToml && (
                      <span className="badge rust-badge">Rust</span>
                    )}
                    <span className="deps-count">
                      Dependencies: {projectInfo.dependencies.length + projectInfo.devDependencies.length}
                    </span>
                  </div>
                )}
                <div className="editor-actions">
                  <button
                    onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
                    className="theme-toggle"
                    title="Toggle theme"
                  >
                    {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>
              <MonacoEditor
                height="calc(100% - 40px)"
                language={getLanguageFromExtension(selectedFile || 'untitled-1')}
                theme={editorTheme}
                value={fileContent || code}
                onChange={(value) => setCode(value ?? '')}
                options={editorOptions}
                loading={<div className="editor-loading">Loading editor...</div>}
              />
            </div>
          ) : imageSrc !== null && isImageFile(selectedFile || '') ? (
            <div className="media-viewer image-viewer">
              <img src={imageSrc} alt="Preview" />
            </div>
          ) : videoSrc !== null && isVideoFile(selectedFile || '') ? (
            <div className="media-viewer video-viewer">
              <ReactPlayer
                url={videoSrc}
                controls
                width="100%"
                height="100%"
                playing={false}
                onError={(e) => console.error('Video playback error:', e)}
              />
            </div>
          ) : (
            <div className="unsupported-file">
              <p>
                File {selectedFile} {fileContent === null && imageSrc === null && videoSrc === null 
                  ? 'could not be loaded' 
                  : 'is not supported for viewing'}.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="welcome-screen">
          <div className="card-container">
            <button className="start-card" onClick={handleCreateFile}>
              <p>Create New File</p>
              <span className="hotkey">Ctrl + N</span>
            </button>
            <button className="start-card" onClick={handleCreateFile}>
              <p>Create New Folder</p>
              <span className="hotkey">Ctrl + Shift + N</span>
            </button>
            <button className="start-card" onClick={handleOpenFolder}>
              <p>Open Folder</p>
              <span className="hotkey">Ctrl + O</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CenterContainer;