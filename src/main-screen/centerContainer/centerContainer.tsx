// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import { FileItem } from '../../types';
import { configureMonaco, setCurrentProject, setOpenedFilesList } from './monacoConfig';
import { getLanguageFromExtension } from '../../utils/languageDetector';
import { fileFilters } from '../../utils/fileFilters';
import { supportedTextExtensions, supportedImageExtensions, supportedVideoExtensions } from '../../utils/fileExtensions';
import { FontSizeContext } from '../../App';

import "./style.css";

declare global {
  interface Window {
    monaco: any;
  }
}

interface MarkerData {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source?: string;
  code?: string;
}

export interface CenterContainerHandle {
  selectAll: () => void;
  deselect: () => void;
}

interface IssueInfo {
  filePath: string;
  fileName: string;
  issues: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    source?: string;
    code?: string;
  }[];
}

interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void;
  selectedFile: string | null;
  openedFiles: FileItem[];
  setOpenedFiles: (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
  handleCreateFile: () => void;
  selectedFolder?: string | null;
  onEditorInfoChange?: (info: {
    errors: number;
    warnings: number;
    language: string;
    encoding: string;
    cursorInfo: {
      line: number;
      column: number;
      totalChars: number;
    };
  }) => void;
  onIssuesChange?: (issues: IssueInfo[]) => void;
  handleFileSelect?: (filePath: string | null) => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;
  editorRef?: React.RefObject<any>;
}

const CenterContainer: React.FC<CenterContainerProps> = ({
  style,
  setSelectedFolder,
  selectedFile,
  openedFiles,
  setOpenedFiles,
  handleCreateFile,
  selectedFolder,
  onEditorInfoChange,
  onIssuesChange,
  handleFileSelect,
  onSelectAll,
  onDeselect,
  editorRef
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('# Start coding here...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [monacoInstance, setMonacoInstance] = useState<any>(null);
  const { fontSize, setFontSize } = useContext(FontSizeContext);
  
  // Конфигурируем Monaco сразу при загрузке компонента
  useEffect(() => {
    console.log("Конфигурирую Monaco при монтировании компонента");
    // Если Monaco уже загружен через window
    if (window.monaco) {
      try {
        console.log("Monaco доступен через window.monaco");
        const configuredMonaco = configureMonaco(window.monaco);
        setMonacoInstance(configuredMonaco);
        console.log("Monaco успешно сконфигурирован");
      } catch (error) {
        console.error('Ошибка при конфигурации Monaco через window:', error);
      }
    }
  }, []);

  // Оставляем предыдущий useEffect для обновления при изменении параметров
  useEffect(() => {
    if (window.monaco) {
      try {
        configureMonaco(window.monaco);
      } catch (error) {
        console.error('Ошибка при конфигурации Monaco:', error);
      }
    }
  }, [openedFiles, supportedTextExtensions, selectedFolder, getLanguageFromExtension]);

  // Применяем размер шрифта при изменении глобального fontSize
  useEffect(() => {
    if (editorInstance) {
      console.log('Applying font size from context:', fontSize);
      editorInstance.updateOptions({ fontSize });
    }
  }, [fontSize, editorInstance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        if (editorInstance) {
          const model = editorInstance.getModel();
          if (model) {
            const fullRange = model.getFullModelRange();
            editorInstance.setSelection(fullRange);
            editorInstance.focus();
          }
        }
      } else if (e.key === 'Escape') {
        if (editorInstance) {
          editorInstance.setSelection({
            startLineNumber: 0,
            startColumn: 0,
            endLineNumber: 0,
            endColumn: 0
          });
          editorInstance.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorInstance]);

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
          filters: fileFilters,
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

  // Функция для преобразования маркеров в формат проблем
  const convertMarkersToIssues = (markers: MarkerData[], filePath: string) => {
    const fileName = filePath.split(/[\\/]/).pop() || '';
    return {
      filePath,
      fileName,
      issues: markers.map(marker => ({
        severity: marker.severity === monacoInstance.MarkerSeverity.Error ? 'error' :
                 marker.severity === monacoInstance.MarkerSeverity.Warning ? 'warning' : 'info',
        message: marker.message,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        source: marker.source,
        code: marker.code
      }))
    };
  };

  // Обновляем useEffect для отслеживания маркеров
  useEffect(() => {
    if (editorInstance && monacoInstance && (onEditorInfoChange || onIssuesChange)) {
      // Подписываемся на изменения маркеров (ошибки/предупреждения)
      const markersListener = monacoInstance.editor.onDidChangeMarkers((_uris: any[]) => {
        const allIssues: IssueInfo[] = [];

        // Собираем маркеры для всех открытых файлов
        openedFiles.forEach(file => {
          const uri = monacoInstance.Uri.parse(`file:///${file.path.replace(/\\/g, '/')}`);
          const markers = monacoInstance.editor.getModelMarkers({ resource: uri }) as MarkerData[];
          
          if (markers.length > 0) {
            const issues = convertMarkersToIssues(markers, file.path);
            allIssues.push({
              ...issues,
              issues: issues.issues.map(issue => ({
                ...issue,
                severity: issue.severity as "error" | "warning" | "info"
              }))
            });
          }
        });

        // Обновляем информацию о проблемах
        if (onIssuesChange) {
          onIssuesChange(allIssues);
        }

        // Обновляем информацию для текущего файла в нижней панели
        if (onEditorInfoChange && editorInstance.getModel()) {
          const currentFileMarkers = monacoInstance.editor.getModelMarkers({
            resource: editorInstance.getModel().uri
          }) as MarkerData[];

          const errors = currentFileMarkers.filter(m => m.severity === monacoInstance.MarkerSeverity.Error).length;
          const warnings = currentFileMarkers.filter(m => m.severity === monacoInstance.MarkerSeverity.Warning).length;
          
          updateEditorInfo({ errors, warnings });
        }
      });

      // Подписываемся на изменения позиции курсора
      const cursorListener = editorInstance.onDidChangeCursorPosition((_e: any) => {
        const position = editorInstance.getPosition();
        const model = editorInstance.getModel();
        const totalChars = model.getValueLength();
        
        updateEditorInfo({
          cursorInfo: {
            line: position.lineNumber,
            column: position.column,
            totalChars
          }
        });
      });

      // Функция для обновления информации
      const updateEditorInfo = (newInfo: any) => {
        if (onEditorInfoChange) {
          onEditorInfoChange({
            errors: newInfo.errors ?? 0,
            warnings: newInfo.warnings ?? 0,
            language: getLanguageFromExtension(selectedFile || ''),
            encoding: 'UTF-8', // В будущем можно добавить определение кодировки
            cursorInfo: newInfo.cursorInfo ?? {
              line: 1,
              column: 1,
              totalChars: editorInstance.getModel()?.getValueLength() ?? 0
            }
          });
        }
      };

      return () => {
        markersListener?.dispose();
        cursorListener?.dispose();
      };
    }
  }, [editorInstance, monacoInstance, selectedFile, onEditorInfoChange, onIssuesChange, openedFiles]);

  // Функция для навигации к проблеме
  const navigateToIssue = useCallback((filePath: string, line: number, column: number) => {
    // Если файл не открыт, открываем его
    if (!openedFiles.some(file => file.path === filePath)) {
      setOpenedFiles(prev => [...prev, { name: filePath.split(/[\\/]/).pop() || '', path: filePath, isFolder: false }]);
    }
    
    // Выбираем файл
    if (selectedFile !== filePath && handleFileSelect) {
      handleFileSelect(filePath);
    }
    
    // После небольшой задержки для загрузки файла, переходим к нужной позиции
    setTimeout(() => {
      if (editorInstance) {
        editorInstance.revealLineInCenter(line);
        editorInstance.setPosition({ lineNumber: line, column: column });
        editorInstance.focus();
      }
    }, 100);
  }, [openedFiles, selectedFile, editorInstance, handleFileSelect]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    console.log("Editor mounted, configuring Monaco...");
    try {
      // Сохраняем экземпляр редактора
      setEditorInstance(editor);
      
      // Сохраняем ссылку на Monaco
      window.monaco = monaco;
      setMonacoInstance(monaco);
      
      // Применяем конфигурацию Monaco
      configureMonaco(monaco);
      console.log("Monaco configured successfully in handleEditorDidMount");
      
      // Применяем размер шрифта из контекста
      editor.updateOptions({ fontSize });
      console.log("Applied font size from context:", fontSize);
      
      // Подготавливаем интерфейс для editorRef
      if (editorRef) {
        const editorInterface = {
          selectAll: () => {
            const model = editor.getModel();
            if (model) {
              const fullRange = model.getFullModelRange();
              editor.setSelection(fullRange);
              editor.focus();
            }
          },
          deselect: () => {
            editor.setSelection({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1
            });
            editor.focus();
          },
          // Добавляем метод для инвертированного выделения
          invertSelection: () => {
            const model = editor.getModel();
            if (model) {
              const selection = editor.getSelection();
              if (selection) {
                const fullRange = model.getFullModelRange();
                
                // Если есть текущее выделение
                if (!selection.isEmpty()) {
                  // Создаем два новых выделения (до и после текущего)
                  const before = {
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: selection.startLineNumber,
                    endColumn: selection.startColumn
                  };
                  
                  const after = {
                    startLineNumber: selection.endLineNumber,
                    startColumn: selection.endColumn,
                    endLineNumber: fullRange.endLineNumber,
                    endColumn: fullRange.endColumn
                  };
                  
                  // Устанавливаем новые выделения
                  if (before.endLineNumber > 1 || (before.endLineNumber === 1 && before.endColumn > 1)) {
                    editor.setSelection(before);
                  } else if (after.startLineNumber < fullRange.endLineNumber || 
                           (after.startLineNumber === fullRange.endLineNumber && after.startColumn < fullRange.endColumn)) {
                    editor.setSelection(after);
                  }
                } else {
                  // Если нет текущего выделения, выделяем всё
                  editor.setSelection(fullRange);
                }
                editor.focus();
              }
            }
          },
          // Добавляем метод для расширенного выделения
          expandSelection: () => {
            const model = editor.getModel();
            if (model) {
              const selection = editor.getSelection();
              if (selection) {
                // Расширяем текущее выделение до границ строки
                const expandedSelection = {
                  startLineNumber: selection.startLineNumber,
                  startColumn: 1,
                  endLineNumber: selection.endLineNumber,
                  endColumn: model.getLineMaxColumn(selection.endLineNumber)
                };
                
                editor.setSelection(expandedSelection);
                editor.focus();
              }
            }
          }
        };
        
        // Устанавливаем объект в ref
        if (typeof editorRef === 'function') {
          editorRef(editorInterface);
        } else if (editorRef) {
          editorRef.current = editorInterface;
        }
      }
      
      // Добавляем обработчик изменения позиции курсора
      editor.onDidChangeCursorPosition((e: any) => {
        try {
          // Обновляем информацию о позиции курсора
          if (onEditorInfoChange && editorInstance) {
            const model = editor.getModel();
            const totalChars = model ? model.getValueLength() : 0;
            
            onEditorInfoChange({
              errors: 0, // будет обновлено при изменении маркеров
              warnings: 0, // будет обновлено при изменении маркеров
              language: model ? model.getLanguageId() : 'plaintext',
              encoding: 'UTF-8',
              cursorInfo: {
                line: e.position.lineNumber,
                column: e.position.column,
                totalChars
              }
            });
          }
        } catch (cursorError) {
          console.error('Ошибка при обновлении курсора:', cursorError);
        }
      });
      
      // Добавляем отслеживание маркеров (ошибок, предупреждений)
      const updateMarkers = () => {
        try {
          if (editor && selectedFile) {
            const uri = monaco.Uri.parse(selectedFile);
            const markers = monaco.editor.getModelMarkers({ resource: uri });
            
            let errors = 0;
            let warnings = 0;
            
            markers.forEach((marker: any) => {
              if (marker.severity === monaco.MarkerSeverity.Error) errors++;
              if (marker.severity === monaco.MarkerSeverity.Warning) warnings++;
            });
            
            if (onEditorInfoChange) {
              const model = editor.getModel();
              onEditorInfoChange({
                errors,
                warnings,
                language: model ? model.getLanguageId() : 'plaintext',
                encoding: 'UTF-8',
                cursorInfo: {
                  line: editor.getPosition().lineNumber,
                  column: editor.getPosition().column,
                  totalChars: model ? model.getValueLength() : 0
                }
              });
            }
            
            if (onIssuesChange) {
              const fileName = selectedFile.split(/[\\/]/).pop() || '';
              const issuesData: IssueInfo = {
                filePath: selectedFile,
                fileName,
                issues: markers.map((marker: any) => ({
                  severity: marker.severity === monaco.MarkerSeverity.Error ? 'error' : 
                            marker.severity === monaco.MarkerSeverity.Warning ? 'warning' : 'info',
                  message: marker.message,
                  line: marker.startLineNumber,
                  column: marker.startColumn,
                  endLine: marker.endLineNumber,
                  endColumn: marker.endColumn,
                  source: marker.source,
                  code: marker.code
                }))
              };
              
              onIssuesChange([issuesData]);
            }
          }
        } catch (markersError) {
          console.error('Ошибка при обновлении маркеров:', markersError);
        }
      };
      
      try {
        // Отслеживаем изменения маркеров
        monaco.editor.onDidChangeMarkers(updateMarkers);
        
        // Отслеживаем изменения моделей
        monaco.editor.onDidCreateModel((model: any) => {
          // Когда создается новая модель, применяем конфигурацию Monaco
          const filePath = model.uri.path;
          console.log(`Создана новая модель для файла: ${filePath}`);
        });
      } catch (hookError) {
        console.error('Ошибка при регистрации слушателей событий:', hookError);
      }
    } catch (mountError) {
      console.error('Критическая ошибка при инициализации редактора:', mountError);
    }
  };

  useEffect(() => {
    // Передаем текущую директорию в monacoConfig
    if (selectedFolder) {
      setCurrentProject(selectedFolder);
    }
  }, [selectedFolder]);

  // Следим за открытыми файлами
  useEffect(() => {
    if (openedFiles.length > 0) {
      setOpenedFilesList(openedFiles);
    }
  }, [openedFiles]);

  return (
    <div className="center-container" style={style}>
      {isEditorOpen || selectedFile ? (
        <>
          {isEditableFile(selectedFile || '') ? (
            <div className="editor-container">
              <div className="monaco-editor-container">
                <MonacoEditor
                  height="100%"
                  width="100%"
                  language={getLanguageFromExtension(selectedFile || '')}
                  theme="vs-dark"
                  value={fileContent || code}
                  onChange={(value) => setCode(value || '')}
                  options={{
                    fontSize: fontSize,
                    minimap: { enabled: true },
                    quickSuggestions: true,
                    scrollBeyondLastLine: false,
                    fontFamily: 'Fira Code, Menlo, Monaco, Consolas, monospace',
                    lineNumbers: 'on',
                    roundedSelection: false,
                    selectOnLineNumbers: true,
                    readOnly: false,
                    cursorStyle: 'line',
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                  onMount={handleEditorDidMount}
                  key={`monaco-editor-${selectedFile || 'default'}-${fontSize}`}
                />
              </div>
            </div>
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
            <p>Создать файл</p>
            <span className="hotkey">CTRL + SHIFT + N</span>
          </button>
          <button className="start-card" onClick={handleCreateFile}>
            <p>Новая папка</p>
            <span className="hotkey">CTRL + SHIFT + F</span>
          </button>
          <button className="start-card" onClick={handleOpenFolder}>
            <p>Открыть папку</p>
            <span className="hotkey">CTRL + O</span>
          </button>
          <button className="start-card" onClick={handleOpenFolder}>
            <p>Открыть последний проект</p>
            <span className="hotkey">CTRL + O</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CenterContainer;
