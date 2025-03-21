import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import { FileItem } from '../../types';
import { Loader2, Save } from 'lucide-react';
import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import path from 'path-browserify';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { createMessageConnection } from 'vscode-jsonrpc';
import { configureMonaco } from './monacoConfig';

self.MonacoEnvironment = {
  getWorker: function (_, label) {
    const workerBasePath = '/node_modules/monaco-editor/esm/vs/';
    const getWorkerModule = (moduleUrl: string, label: string) => {
      return new Worker(moduleUrl, {
        name: label,
        type: 'module',
      });
    };

    switch (label) {
      case 'typescript':
      case 'javascript':
        return getWorkerModule(`${workerBasePath}language/typescript/ts.worker.js`, label);
      default:
        return getWorkerModule(`${workerBasePath}editor/editor.worker.js`, label);
    }
  },
};

import './style.css';

interface ProjectInfo {
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  dependencies: string[];
  devDependencies: string[];
  path: string;
}

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
  selectedFolder,
}) => {
  const [code, setCode] = useState('// Start coding here...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMonacoConfigured = useRef(false);
  const languageClient = useRef<MonacoLanguageClient | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Инициализация LSP клиента с messageTransports
  useEffect(() => {
    const initializeLanguageClient = () => {
      const socket = new WebSocket('ws://localhost:3000');

      socket.onopen = () => {
        console.log('WebSocket connection established');
        const socketWrapper = toSocket(socket);
        const reader = new WebSocketMessageReader(socketWrapper);
        const writer = new WebSocketMessageWriter(socketWrapper);
        const connection = createMessageConnection(reader, writer);

        const client = new MonacoLanguageClient({
          name: 'TypeScript Language Client',
          clientOptions: {
            documentSelector: ['typescript', 'javascript'],
            synchronize: {
              configurationSection: ['typescript', 'javascript'],
            },
            initializationOptions: {
              typescript: {
                tsserverPath: 'node_modules/typescript/lib/tsserver.js',
              },
            },
          },
          messageTransports: {
            reader,
            writer,
          },
        });

        client.start();
        connection.listen();

        languageClient.current = client;

        connection.onClose(() => {
          client.stop();
          console.log('Language client connection closed');
        });
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setErrorMessage('Failed to connect to LSP server');
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
      };
    };

    if (editorRef.current) {
      initializeLanguageClient();
    }

    return () => {
      if (languageClient.current) {
        languageClient.current.stop();
      }
    };
  }, []);

  const supportedTextExtensions = useMemo(
    () => [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
      '.html',
      '.css',
      '.scss',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.md',
      '.rs',
      '.toml',
      '.yaml',
      '.yml',
    ],
    []
  );

  const supportedImageExtensions = useMemo(() => ['.png', '.jpg', '.jpeg', '.gif', '.webp'], []);
  const supportedVideoExtensions = useMemo(() => ['.mp4', '.webm', '.ogg', '.mov'], []);

  const getLanguageFromExtension = useCallback((filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
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
      '.rs': 'rust',
      '.toml': 'toml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
    };
    return languageMap[ext] || 'plaintext';
  }, []);

  const editorOptions: editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'all',
      quickSuggestions: true,
      suggest: {
        preview: true,
        showStatusBar: true,
        showIcons: true,
        localityBonus: true,
        snippetsPreventQuickSuggestions: false,
      },
      hover: {
        enabled: true,
        delay: 100,
        sticky: true,
      },
      inlayHints: {
        enabled: 'on',
      },
      parameterHints: { enabled: true },
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoIndent: 'full',
      suggestSelection: 'first',
      tabCompletion: 'on',
      wordBasedSuggestions: 'allDocuments',
    }),
    []
  );

  useEffect(() => {
    if (selectedFolder) {
      console.log('Configuring Monaco with selected folder:', selectedFolder);
      configureMonaco(monaco, selectedFolder); // Передаем monaco и selectedFolder
    }
  }, [selectedFolder]);

  useEffect(() => {
    const loadProjectInfo = async () => {
      if (selectedFolder) {
        try {
          console.log('Loading project info for folder:', selectedFolder);
          const info = await invoke<ProjectInfo>('analyze_project', { folderPath: selectedFolder });
          setProjectInfo(info);

          if (info.hasPackageJson && !isInstalling) {
            setIsInstalling(true);
            try {
              console.log('Installing dependencies for folder:', selectedFolder);
              await invoke('install_dependencies', { folderPath: selectedFolder });
            } catch (error) {
              setErrorMessage(`Failed to install dependencies: ${error}`);
            } finally {
              setIsInstalling(false);
            }
          }
        } catch (error) {
          setErrorMessage(`Failed to load project info: ${error}`);
        }
      }
    };
    loadProjectInfo();
  }, [selectedFolder, isInstalling]);

  useEffect(() => {
    const loadFileContent = async () => {
      if (selectedFile) {
        const ext = path.extname(selectedFile).toLowerCase();

        try {
          if (supportedTextExtensions.includes(ext)) {
            console.log('Loading text file:', selectedFile);
            const content = await invoke<string>('read_text_file', { path: selectedFile });
            setFileContent(content);
            setCode(content);
          } else if (supportedImageExtensions.includes(ext)) {
            console.log('Loading image file:', selectedFile);
            const base64Content = await invoke<string>('read_binary_file', { path: selectedFile });
            setImageSrc(`data:image/${ext.slice(1)};base64,${base64Content}`);
          } else if (supportedVideoExtensions.includes(ext)) {
            console.log('Loading video file:', selectedFile);
            const videoUrl = await invoke<string>('stream_video', { path: selectedFile });
            setVideoSrc(videoUrl);
          }
        } catch (error) {
          setErrorMessage(`Failed to read file: ${error}`);
        }
      }
    };
    loadFileContent();
  }, [selectedFile, supportedTextExtensions, supportedImageExtensions, supportedVideoExtensions]);

  const handleOpenFolder = useCallback(async () => {
    try {
      console.log('Opening folder...');
      const folderPath = await open({ directory: true, multiple: false });
      if (folderPath) {
        setSelectedFolder(folderPath as string);
        setErrorMessage(null);
      }
    } catch (error) {
      setErrorMessage(`Failed to open folder: ${error}`);
    }
  }, [setSelectedFolder]);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      if (selectedFile.startsWith('untitled-')) {
        console.log('Saving new file...');
        const filePath = await save({
          filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'JavaScript', extensions: ['js', 'jsx'] },
            { name: 'TypeScript', extensions: ['ts', 'tsx'] },
          ],
          defaultPath: selectedFolder || undefined,
        });

        if (filePath) {
          await invoke('save_file', { path: filePath as string, content: code });
          setOpenedFiles((prev) =>
            prev.map((file) =>
              file.path === selectedFile
                ? { ...file, name: filePath.split(/[\\/]/).pop() || 'Untitled', path: filePath }
                : file
            )
          );
        }
      } else {
        console.log('Saving existing file:', selectedFile);
        await invoke('save_file', { path: selectedFile, content: code });
      }
    } catch (error) {
      setErrorMessage(`Failed to save file: ${error}`);
    }
  }, [selectedFile, selectedFolder, code, setOpenedFiles]);

  const isEditableFile = useCallback(
    (filePath: string) => supportedTextExtensions.some((ext) => filePath.toLowerCase().endsWith(ext)),
    [supportedTextExtensions]
  );

  const isImageFile = useCallback(
    (filePath: string) => supportedImageExtensions.some((ext) => filePath.toLowerCase().endsWith(ext)),
    [supportedImageExtensions]
  );

  const isVideoFile = useCallback(
    (filePath: string) => supportedVideoExtensions.some((ext) => filePath.toLowerCase().endsWith(ext)),
    [supportedVideoExtensions]
  );

  return (
    <div className="center-container" style={style}>
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {isInstalling && (
        <div className="installation-indicator">
          <Loader2 className="animate-spin" />
          Installing dependencies...
        </div>
      )}

      {selectedFile ? (
        <>
          {isEditableFile(selectedFile) ? (
            <div className="editor-wrapper">
              <div className="editor-header">
                <button onClick={handleSaveFile} className="control-btn save-btn">
                  <Save size={16} />
                  <span>Save</span>
                </button>

                {projectInfo && (
                  <div className="project-info">
                    {projectInfo.hasPackageJson && <span className="badge node-badge">Node.js</span>}
                    {projectInfo.hasCargoToml && <span className="badge rust-badge">Rust</span>}
                  </div>
                )}

                <button
                  onClick={() => setEditorTheme((theme) => (theme === 'vs-dark' ? 'light' : 'vs-dark'))}
                  className="theme-toggle"
                >
                  {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
                </button>
              </div>

              <MonacoEditor
                height="calc(100% - 40px)"
                language={getLanguageFromExtension(selectedFile)}
                theme={editorTheme}
                value={fileContent ?? code}
                onChange={(value) => {
                  setCode(value ?? '');
                  setFileContent(value ?? '');
                }}
                options={editorOptions}
                loading={<div className="editor-loading">Loading editor...</div>}
                beforeMount={(monaco) => configureMonaco(monaco, selectedFolder || '')} // Передаем monaco и selectedFolder
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>
          ) : isImageFile(selectedFile) && imageSrc ? (
            <div className="media-viewer image-viewer">
              <img src={imageSrc} alt="Preview" />
            </div>
          ) : isVideoFile(selectedFile) && videoSrc ? (
            <div className="media-viewer video-viewer">
              <ReactPlayer url={videoSrc} controls width="100%" height="100%" />
            </div>
          ) : (
            <div className="unsupported-file">Unsupported file format</div>
          )}
        </>
      ) : (
        <div className="welcome-screen">
          <div className="card-container">
            <button className="start-card" onClick={handleCreateFile}>
              <p>Create New File</p>
              <span className="hotkey">Ctrl + N</span>
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