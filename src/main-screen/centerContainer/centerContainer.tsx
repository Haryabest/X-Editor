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
import { initializeTypeScriptTypes, registerTypeScriptFile } from './monaco-types-loader';
import { setupMonacoTheme } from './monaco-theme-loader';
import { initializeMonacoEditor, correctLanguageFromExtension } from './monaco-advanced-config';
import { monacoLSPService } from './monaco-lsp-wrapper';
import { initializeMonacoLSP, getMonacoLSPInstance } from './monaco-lsp-integration';
import { debounce } from 'lodash';
import path from 'path';

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
  const [lspStatus, setLspStatus] = useState<{ initialized: boolean; connectedServers: string[] }>({
    initialized: false,
    connectedServers: []
  });
  const lspRef = useRef<any>(null);
  const internalEditorRef = useRef<any>(null);
  const internalMonacoRef = useRef<any>(null);
  
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
            
            // Уведомляем LSP об открытии файла только если инициализация LSP выполнена
            if (monacoInstance && editorInstance && lspStatus.initialized) {
              monacoLSPService.handleFileOpen(selectedFile, content);
              
              // Устанавливаем правильный язык для текущей модели
              const model = editorInstance.getModel();
              if (model) {
                correctLanguageFromExtension(monacoInstance, model, selectedFile);
              }
            }
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
  }, [selectedFile, supportedTextExtensions, supportedImageExtensions, supportedVideoExtensions, lspStatus.initialized, monacoInstance, editorInstance]);

  // Добавляем функцию для открытия папки
  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Выберите рабочую папку',
      });
  
      if (selected) {
        setSelectedFolder(selected);
        console.log('Открыта папка:', selected);
      }
    } catch (error) {
      console.error('Ошибка открытия папки:', error);
    }
  };

  // Добавляем функцию для сохранения файла
  const handleSaveFile = async () => {
    try {
      if (!selectedFile || !code) return;
      
      let targetPath: string | null = null;
      
      if (selectedFile.startsWith('untitled-')) {
        // Если это новый файл, предлагаем выбрать имя
        const result = await save({
          title: 'Сохранить файл',
          defaultPath: selectedFolder || undefined,
          filters: [{ name: 'Text Files', extensions: ['txt', 'js', 'ts', 'html', 'css'] }]
        });
        targetPath = result;
      } else {
        // Используем существующий путь
        targetPath = selectedFile;
      }

      if (targetPath) {
        await invoke('save_file', {
          path: targetPath,
          content: code
        });
        
        console.log(`Файл сохранён: ${targetPath}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
    }
  };

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
    if (!monacoInstance || !monacoInstance.MarkerSeverity) {
      return {
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || '',
        issues: []
      };
    }
    
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
        try {
          const allIssues: IssueInfo[] = [];

          // Собираем маркеры для всех открытых файлов
          openedFiles.forEach(file => {
            if (!file || !file.path) return;
            
            try {
              const uri = monacoInstance.Uri.parse(`file:///${file.path.replace(/\\/g, '/')}`);
              const markers = monacoInstance.editor.getModelMarkers({ resource: uri }) as MarkerData[];
              
              if (markers && markers.length > 0) {
                const issues = convertMarkersToIssues(markers, file.path);
                allIssues.push({
                  ...issues,
                  issues: issues.issues.map(issue => ({
                    ...issue,
                    severity: issue.severity as "error" | "warning" | "info"
                  }))
                });
              }
            } catch (err) {
              console.error(`Ошибка при обработке маркеров для файла ${file.path}:`, err);
            }
          });

          // Обновляем информацию о проблемах
          if (onIssuesChange) {
            onIssuesChange(allIssues);
          }

          // Обновляем информацию для текущего файла в нижней панели
          if (onEditorInfoChange && editorInstance.getModel()) {
            try {
              const model = editorInstance.getModel();
              if (!model) return;
              
              const currentFileMarkers = monacoInstance.editor.getModelMarkers({
                resource: model.uri
              }) as MarkerData[];

              if (currentFileMarkers) {
                const errors = currentFileMarkers.filter(m => m.severity === monacoInstance.MarkerSeverity.Error).length;
                const warnings = currentFileMarkers.filter(m => m.severity === monacoInstance.MarkerSeverity.Warning).length;
                
                updateEditorInfo({ errors, warnings });
              }
            } catch (err) {
              console.error('Ошибка при обновлении информации о маркерах:', err);
            }
          }
        } catch (error) {
          console.error('Ошибка при обновлении маркеров:', error);
        }
      });

      // Подписываемся на изменения позиции курсора
      const cursorListener = editorInstance.onDidChangeCursorPosition((_e: any) => {
        try {
          const position = editorInstance.getPosition();
          if (!position) return;
          
          const model = editorInstance.getModel();
          if (!model) return;
          
          const totalChars = model.getValueLength();
          
          updateEditorInfo({
            cursorInfo: {
              line: position.lineNumber,
              column: position.column,
              totalChars
            }
          });
        } catch (err) {
          console.error('Ошибка при обновлении позиции курсора:', err);
        }
      });

      // Функция для обновления информации
      const updateEditorInfo = (newInfo: any) => {
        if (onEditorInfoChange && editorInstance) {
          try {
            const model = editorInstance.getModel();
            const totalChars = model ? model.getValueLength() : 0;
            const position = editorInstance.getPosition();
            
            onEditorInfoChange({
              errors: newInfo.errors ?? 0,
              warnings: newInfo.warnings ?? 0,
              language: getLanguageFromExtension(selectedFile || ''),
              encoding: 'UTF-8', // В будущем можно добавить определение кодировки
              cursorInfo: newInfo.cursorInfo ?? {
                line: position ? position.lineNumber : 1,
                column: position ? position.column : 1,
                totalChars
              }
            });
          } catch (err) {
            console.error('Ошибка при обновлении информации редактора:', err);
          }
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

  const handleCodeChange = (newValue: string) => {
    setCode(newValue);
    // Notify LSP of code changes
    if (selectedFile && lspStatus.initialized) {
      monacoLSPService.handleFileChange(selectedFile, newValue);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    console.log('Monaco editor mounted successfully');
    
    // Save references
    internalEditorRef.current = editor;
    internalMonacoRef.current = monaco;
    setEditorInstance(editor);
    setMonacoInstance(monaco);

    // If external editorRef is provided, update it
    if (editorRef) {
      editorRef.current = editor;
    }

    // Инициализация Monaco
    initializeMonacoEditor(monaco);

    // Регистрация TypeScript моделей
    if (selectedFile) {
      const model = monaco.editor.getModel(monaco.Uri.file(selectedFile));
      if (model) {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          model.getValue(),
          model.uri.toString()
        );
      }
    }

    // Инициализация LSP
    try {
      const lspInstance = getMonacoLSPInstance();
      if (lspInstance) {
        lspRef.current = lspInstance;
        lspInstance.initialize(editor, monaco);

        // Подключение к языковому серверу
        if (selectedFile) {
          const extension = path.extname(selectedFile).toLowerCase();
          if (extension === '.ts' || extension === '.tsx') {
            lspInstance.connectToLanguageServer('typescript');
          }
        }
      }
    } catch (error) {
      console.error('Error initializing LSP:', error);
    }

    // Обработчик наведения мыши для отображения путей
    editor.onMouseMove((e: any) => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(position.lineNumber);
      const offset = model.getOffsetAt(position);

      // Поиск импортов
      const importRegex = /from\s+['"]([^'"]+)['"]/g;
      let importMatch;
      while ((importMatch = importRegex.exec(lineContent)) !== null) {
        const startOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: importMatch.index + 1
        });
        const endOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: importMatch.index + importMatch[0].length - 1
        });

        if (offset >= startOffset && offset <= endOffset) {
          const importPath = importMatch[1];
          const resolvedPath = resolvePath(selectedFile, importPath);
          editor.getContribution('suggestController').triggerSuggest();
          return;
        }
      }

      // Поиск путей в строках
      const pathRegex = /['"]([^'"]+)['"]/g;
      let pathMatch;
      while ((pathMatch = pathRegex.exec(lineContent)) !== null) {
        const startOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: pathMatch.index + 1
        });
        const endOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: pathMatch.index + pathMatch[0].length - 1
        });

        if (offset >= startOffset && offset <= endOffset) {
          const path = pathMatch[1];
          const resolvedPath = resolvePath(selectedFile, path);
          editor.getContribution('suggestController').triggerSuggest();
          return;
        }
      }
    });
  };

  // Функция для разрешения путей
  const resolvePath = (currentFile: string, importPath: string): string => {
    try {
      const workspaceRoot = path.dirname(currentFile);
      let resolvedPath = importPath;

      // Абсолютный путь
      if (path.isAbsolute(importPath)) {
        resolvedPath = importPath;
      }
      // Относительный путь
      else if (importPath.startsWith('./') || importPath.startsWith('../')) {
        resolvedPath = path.resolve(workspaceRoot, importPath);
      }
      // Путь с алиасом @
      else if (importPath.startsWith('@/')) {
        const srcPath = path.join(workspaceRoot, 'src');
        resolvedPath = path.resolve(srcPath, importPath.slice(2));
      }

      return resolvedPath;
    } catch (error) {
      console.error('Error resolving path:', error);
      return importPath;
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

  // Добавляем новую функцию для регистрации TS/TSX файлов в Monaco
  const registerTypeScriptModels = (monaco: any, editor: any, filePath: string) => {
    if (!monaco || !editor) return;
    
    try {
      const fileExt = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      const model = editor.getModel();
      
      // Только для TypeScript файлов
      if (fileExt === '.ts' || fileExt === '.tsx' || fileExt === '.js' || fileExt === '.jsx') {
        // Если модель существует
        if (model) {
          // Устанавливаем правильный язык для модели
          if (fileExt === '.ts') {
            monaco.editor.setModelLanguage(model, 'typescript');
          } else if (fileExt === '.tsx') {
            monaco.editor.setModelLanguage(model, 'typescriptreact');
          } else if (fileExt === '.js') {
            monaco.editor.setModelLanguage(model, 'javascript');
          } else if (fileExt === '.jsx') {
            monaco.editor.setModelLanguage(model, 'javascriptreact');
          }
          
          // Регистрируем модель в TypeScript сервисе
          if (monaco.languages.typescript) {
            try {
              // Создаем URI для файла
              const uri = model.uri.toString();
              const tsLanguage = 
                fileExt === '.ts' || fileExt === '.tsx' 
                  ? monaco.languages.typescript.typescriptDefaults 
                  : monaco.languages.typescript.javascriptDefaults;
              
              // Устанавливаем параметры компилятора для поддержки JSX и последних возможностей
              tsLanguage.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.Latest,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.CommonJS,
                noEmit: true,
                jsx: monaco.languages.typescript.JsxEmit.React,
                reactNamespace: 'React',
                allowJs: true,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                skipLibCheck: true
              });
              
              // Явно добавляем модель к языковому сервису
              const modelValue = model.getValue();
              
              // Удаляем старую модель если она существует
              try {
                tsLanguage.getModel(model.uri)?.dispose();
              } catch (e) {
                // Игнорируем ошибки при удалении несуществующей модели
              }
              
              // Создаем новую модель в языковом сервисе TypeScript
              tsLanguage.addExtraLib(modelValue, uri);
              
              console.log(`Файл ${filePath} успешно зарегистрирован в TypeScript сервисе`);
            } catch (e) {
              console.error(`Ошибка при регистрации модели TypeScript: ${e}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при регистрации модели TypeScript:', error);
    }
  };

  // Обновление регистрации TypeScript моделей при смене файла
  useEffect(() => {
    if (selectedFile && editorInstance && monacoInstance) {
      try {
        // Зарегистрируем выбранный файл как TypeScript модель
        registerTypeScriptModels(monacoInstance, editorInstance, selectedFile);
        
        // Уведомляем LSP о файле
        if (lspStatus.initialized && monacoLSPService) {
          const content = editorInstance.getValue();
          monacoLSPService.handleFileOpen(selectedFile, content);
        }
      } catch (error) {
        console.error('Ошибка при регистрации файла в TypeScript:', error);
      }
    }
  }, [selectedFile, editorInstance, monacoInstance, lspStatus.initialized]);

  // Добавляем эффект для инициализации LSP при монтировании компонента
  useEffect(() => {
    // LSP будет инициализирован после инициализации редактора
    if (editorInstance && monacoInstance && !lspStatus.initialized) {
      console.log("Инициализация LSP клиента...");
      try {
        // Инициализируем LSP с Monaco и редактором
        monacoLSPService.initialize(monacoInstance, editorInstance);
        
        // Устанавливаем корневую директорию проекта
        if (selectedFolder) {
          monacoLSPService.setProjectRoot(selectedFolder);
        }
        
        // Пытаемся подключиться к предустановленным языковым серверам
        const connectToServers = async () => {
          try {
            // Подключаемся к TypeScript языковому серверу
            const tsConnected = await monacoLSPService.connectToPredefinedServer('typescript');
            
            // В будущем можно добавить подключение к другим серверам
            // await monacoLSPService.connectToPredefinedServer('python');
            // await monacoLSPService.connectToPredefinedServer('html');
            
            // Обновляем статус LSP
            setLspStatus(prev => ({
              initialized: true,
              connectedServers: [
                ...(tsConnected ? ['TypeScript'] : []),
                // Добавляйте другие серверы по мере их подключения
              ]
            }));
            
            console.log("LSP клиент успешно инициализирован и подключен к серверам");
          } catch (error) {
            console.error("Ошибка при подключении к языковым серверам:", error);
            setLspStatus({
              initialized: true,
              connectedServers: []
            });
          }
        };
        
        connectToServers();
      } catch (error) {
        console.error("Ошибка при инициализации LSP клиента:", error);
        setLspStatus({
          initialized: true,
          connectedServers: []
        });
      }
    }
  }, [editorInstance, monacoInstance, selectedFolder, lspStatus.initialized]);

  // Обработчик открытия файла для LSP
  useEffect(() => {
    try {
      // При изменении текущего файла уведомляем LSP
      if (selectedFile && editorRef.current && monacoInstance) {
        const lspInstance = getMonacoLSPInstance();
        if (lspInstance) {
          // Определяем язык файла на основе расширения
          const fileExtension = selectedFile.split('.').pop()?.toLowerCase();
          let languageId = 'plaintext';
          
          // Определяем язык на основе расширения
          if (fileExtension === 'ts') languageId = 'typescript';
          else if (fileExtension === 'js') languageId = 'javascript';
          else if (fileExtension === 'tsx') languageId = 'typescriptreact';
          else if (fileExtension === 'jsx') languageId = 'javascriptreact';
          else if (fileExtension === 'html') languageId = 'html';
          else if (fileExtension === 'css') languageId = 'css';
          else if (fileExtension === 'json') languageId = 'json';
          
          // Устанавливаем язык для модели редактора
          if (editorRef.current.getModel()) {
            monacoInstance.editor.setModelLanguage(editorRef.current.getModel(), languageId);
          }
          
          // Уведомляем LSP об открытии файла
          lspInstance.handleFileOpen(selectedFile, languageId, fileContent || code);
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке открытия файла для LSP:', error);
    }
    
    // При размонтировании компонента уведомляем LSP о закрытии файла
    return () => {
      try {
        if (selectedFile) {
          const lspInstance = getMonacoLSPInstance();
          if (lspInstance) {
            lspInstance.handleFileClose(selectedFile);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке закрытия файла для LSP:', error);
      }
    };
  }, [selectedFile, fileContent, code, editorRef, monacoInstance]);

  // Очистка ресурсов LSP при размонтировании компонента
  useEffect(() => {
    return () => {
      try {
        const lspInstance = getMonacoLSPInstance();
        if (lspInstance) {
          lspInstance.dispose();
        }
      } catch (error) {
        console.error('Ошибка при освобождении ресурсов LSP:', error);
      }
    };
  }, []);

  return (
    <div className="center-container" style={style}>
      {!selectedFile && (
        <div className="welcome-message">
          <h2>X-Editor</h2>
          <p>Выберите файл для редактирования или создайте новый.</p>
          <div className="welcome-buttons">
            <button onClick={handleOpenFolder}>
              Открыть папку
            </button>
            <button onClick={handleCreateFile}>
              Создать файл
            </button>
            <button onClick={handleSaveFile} disabled={!selectedFile || !selectedFile.startsWith('untitled-')}>
              Сохранить как
            </button>
          </div>
        </div>
      )}
      
      {selectedFile && supportedTextExtensions.includes(selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase()) && (
        <MonacoEditor
          width="100%"
          height="100%"
          language={getLanguageFromExtension(selectedFile)}
          theme="vs-dark"
          value={fileContent || code}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true,
            fontSize: fontSize
          }}
        />
      )}
      
      {selectedFile && imageSrc !== null && isImageFile(selectedFile) ? (
        <img src={imageSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
      ) : null}
      
      {selectedFile && videoSrc !== null && isVideoFile(selectedFile) ? (
        <ReactPlayer
          url={videoSrc}
          controls={true}
          width="50%"
          height="50%"
          playing={false}
          onError={(e) => console.error('Video playback error:', e)}
        />
      ) : null}
      
      {selectedFile && !supportedTextExtensions.includes(selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase()) && 
       !imageSrc && !videoSrc && (
        <p className="file-error-message">
          Файл {selectedFile.split(/[/\\]/).pop()} не поддерживается для просмотра.
        </p>
      )}
    </div>
  );
};

export default CenterContainer;
