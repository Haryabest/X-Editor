import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import { FileItem } from '../../types';
import { configureMonaco } from '../../monaco-config';

import "./style.css";

declare global {
  interface Window {
    monaco: any;
  }
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
  selectedFolder
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('# Start coding here...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const supportedTextExtensions = useMemo(() => [
    '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.py', '.java', '.cpp', '.c', '.md', '.dart'
  ], []);

  const supportedImageExtensions = useMemo(() => ['.png', '.jpg', '.jpeg', '.gif'], []);
  const supportedVideoExtensions = useMemo(() => ['.mp4', '.avi', '.mov', '.webm', '.mkv'], []);

  const getLanguageFromExtension = useCallback((filePath: string): string => {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.json':
        return 'json';
      case '.html':
        return 'html';
      case '.css':
        return 'css';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cpp':
      case '.c':
        return 'cpp';
      case '.md':
        return 'markdown';
      case '.dart':
        return 'dart';
      case '.txt':
      default:
        return 'plaintext';
    }
  }, []);

  useEffect(() => {
    if (window.monaco) {
      // Используем модульную конфигурацию Monaco
      configureMonaco(
        window.monaco, 
        openedFiles, 
        selectedFolder || null,
        supportedTextExtensions, 
        getLanguageFromExtension
      );
    }
  }, [openedFiles, supportedTextExtensions, selectedFolder, getLanguageFromExtension]);

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
            const fileUrl = `data:image/${ext.slice(1)};base64,${base64Content}`;
            setImageSrc(fileUrl);
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
      } else {
        setFileContent(null);
        setImageSrc(null);
        setVideoSrc(null);
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
      } else {
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      alert(`Failed to open folder: ${error}`);
    }
  }, [setSelectedFolder]);

  const handleSaveFile = useCallback(async () => {
    if (selectedFile && selectedFile.startsWith('untitled-')) {
      try {
        const filePath = await save({
          filters: [
            { name: 'Python Files', extensions: ['py'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          defaultPath: selectedFolder || undefined,
          title: 'Save File As...',
        });

        if (filePath) {
          await invoke('save_file', { path: filePath as string, content: code });
          setOpenedFiles((prev: FileItem[]) => 
            prev.map((file: FileItem) =>
              file.path === selectedFile
                ? { 
                    ...file, 
                    name: (filePath as string).split(/[\\/]/).pop() || 'Untitled', 
                    path: filePath as string 
                  }
                : file
            ));
        }
      } catch (error) {
        console.error('Error saving file:', error);
        alert(`Failed to save file: ${error}`);
      }
    }
  }, [selectedFile, selectedFolder, code, setOpenedFiles]);

  const isEditableFile = useCallback((filePath: string) => {
    return supportedTextExtensions.some((ext) => filePath.toLowerCase().endsWith(ext)) || filePath.startsWith('untitled-');
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
            <>
              <button onClick={handleSaveFile} className="save-btn">
                Save
              </button>
              <MonacoEditor
                height="100%"
                language={getLanguageFromExtension(selectedFile || 'untitled-1')}
                theme="vs-dark"
                value={fileContent || code}
                onChange={(value) => setCode(value ?? '')}
                options={{
                  automaticLayout: true,
                  fontSize: 14,
                  minimap: { enabled: true },
                  quickSuggestions: {
                    comments: true,
                    strings: true,
                    other: true
                  },
                  suggestOnTriggerCharacters: true,
                  autoClosingBrackets: 'languageDefined',
                  autoClosingQuotes: 'languageDefined',
                  autoIndent: 'full',
                  formatOnType: true,
                  formatOnPaste: true,
                  bracketPairColorization: { enabled: true },
                  scrollBeyondLastLine: false,
                  contextmenu: true,
                  fontFamily: 'Fira Code, Menlo, Monaco, Consolas, Courier New, monospace',
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto'
                  },
                  suggest: {
                    preview: true,
                    showKeywords: true,
                    showClasses: true,
                    showFunctions: true,
                    showVariables: true,
                    showModules: true,
                    snippetsPreventQuickSuggestions: false,
                    localityBonus: true
                  },
                  wordBasedSuggestions: 'onlyOtherDocuments',
                  parameterHints: { enabled: true, cycle: true },
                  hover: { enabled: true, delay: 300 },
                  inlineSuggest: { enabled: true },
                  acceptSuggestionOnCommitCharacter: true,
                  acceptSuggestionOnEnter: 'on',
                  tabCompletion: 'on',
                  snippetSuggestions: 'inline',
                  semanticHighlighting: { enabled: true }
                }}
                beforeMount={(monaco) => {
                  window.monaco = monaco;
                }}
                onMount={(editor, monaco) => {
                  // Настройка редактора для текущего файла
                  if (selectedFile) {
                    const normalizedPath = selectedFile.replace(/\\/g, '/');
                    const uri = monaco.Uri.parse(`file:///${normalizedPath}`);
                    
                    // Проверяем, существует ли уже модель для этого файла
                    let model = monaco.editor.getModel(uri);
                    
                    // Если модель не существует, создаем новую
                    if (!model) {
                      model = monaco.editor.createModel(
                        fileContent || code,
                        getLanguageFromExtension(selectedFile),
                        uri
                      );
                    } else {
                      // Если модель существует, но содержимое изменилось, обновляем его
                      if (model.getValue() !== (fileContent || code)) {
                        model.setValue(fileContent || code);
                      }
                    }
                    
                    // Устанавливаем модель для редактора
                    editor.setModel(model);
                    
                    // Для TypeScript/JavaScript файлов добавляем дополнительную настройку
                    const ext = selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase();
                    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                      // Добавляем текущий файл в виртуальную файловую систему
                      if (selectedFolder) {
                        const relativePath = normalizedPath.replace(selectedFolder.replace(/\\/g, '/'), '');
                        
                        // Создаем виртуальные пути для импортов
                        if (relativePath.startsWith('/')) {
                          monaco.editor.createModel(
                            fileContent || code,
                            getLanguageFromExtension(selectedFile),
                            monaco.Uri.parse(`file:///src${relativePath}`)
                          );
                          
                          // Добавляем также путь без префикса src
                          monaco.editor.createModel(
                            fileContent || code,
                            getLanguageFromExtension(selectedFile),
                            monaco.Uri.parse(`file:///${relativePath.substring(1)}`)
                          );
                        } else {
                          monaco.editor.createModel(
                            fileContent || code,
                            getLanguageFromExtension(selectedFile),
                            monaco.Uri.parse(`file:///src/${relativePath}`)
                          );
                          
                          // Добавляем также путь без префикса src
                          monaco.editor.createModel(
                            fileContent || code,
                            getLanguageFromExtension(selectedFile),
                            monaco.Uri.parse(`file:///${relativePath}`)
                          );
                        }
                      }
                    }
                  }
                }}
              />
            </>
          ) : imageSrc !== null && isImageFile(selectedFile || '') ? (
            <img src={imageSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : videoSrc !== null && isVideoFile(selectedFile || '') ? (
            <ReactPlayer
              url={videoSrc}
              controls={true}
              width="50%"
              height="50%"
              playing={false}
              onError={(e) => console.error('Video playback error:', e)}
            />
          ) : (
            <p>
              File {selectedFile} {fileContent === null && imageSrc === null && videoSrc === null 
                ? 'failed to load' 
                : 'is not supported for preview'}.
            </p>
          )}
        </>
      ) : (
        <div className="card-container">
          <button className="start-card" onClick={handleCreateFile}>
            <p>New Project</p>
            <span className="hotkey">CTRL + SHIFT + N</span>
          </button>
          <button className="start-card" onClick={handleCreateFile}>
            <p>New Folder</p>
            <span className="hotkey">CTRL + SHIFT + F</span>
          </button>
          <button className="start-card" onClick={handleOpenFolder}>
            <p>Open Folder</p>
            <span className="hotkey">CTRL + O</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CenterContainer;