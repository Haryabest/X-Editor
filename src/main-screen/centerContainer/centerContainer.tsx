// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save, saveAs } from '@tauri-apps/plugin-dialog';
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
import CloneRepositoryModal from './CloneRepositoryModal';
import HtmlPreview from '../preview/HtmlPreview';
import { writeBinaryFile, readBinaryFile } from '@tauri-apps/plugin-fs';
import ImageViewer from '../../components/ImageViewer';
import VideoPlayer from '../../components/VideoPlayer';
import CreateFolderModal from '../../components/modal/CreateFolderModal';

// Импортируем и инициализируем обработчики ошибок
import './errors';

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
  invertSelection: () => void;
  selectParagraph: () => void;
  saveCurrentFile: () => void;
  saveFileAs: () => void;
  getModifiedFiles: () => string[];
  openHtmlPreview: (filePath: string) => void;
  closeHtmlPreview: () => void;
  isFileModified: (path: string) => boolean;
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
  editorRef?: React.RefObject<CenterContainerHandle>;
}

// Вспомогательные функции для обработки путей
const pathUtils = {
  extname: (filePath) => {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex !== -1 ? filePath.slice(lastDotIndex) : '';
  },
  basename: (filePath) => {
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath;
  },
  dirname: (filePath) => {
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlashIndex !== -1 ? filePath.slice(0, lastSlashIndex) : '';
  },
  join: (...parts) => {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  }
};

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
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const lspRef = useRef<any>(null);
  const internalEditorRef = useRef<any>(null);
  const internalMonacoRef = useRef<any>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Новые состояния для отслеживания изменений и предпросмотра HTML
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [isHtmlPreviewVisible, setIsHtmlPreviewVisible] = useState<boolean>(false);
  const [originalFileContents, setOriginalFileContents] = useState<Map<string, string>>(new Map());
  
  // Добавим отслеживание предыдущего файла для сохранения при переключении
  const previousFileRef = useRef<string | null>(null);
  
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
    const loadFileContent = async () => {
      if (selectedFile) {
        try {
          // Проверяем, является ли выбранный файл директорией
          const isDirectory = await invoke('check_path_exists', { 
            path: selectedFile, 
            checkType: 'directory' 
          });
          
          if (isDirectory) {
            console.log(`Выбранный путь ${selectedFile} является директорией, пропускаем загрузку`);
            setFileContent(null);
            setImageSrc(null);
            setVideoSrc(null);
            return;
          }
          
          const ext = selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase();
          
          try {
            if (supportedTextExtensions.includes(ext) || selectedFile.startsWith('untitled-')) {
              // First try to load from localStorage cache for modified files
              const cachedContent = localStorage.getItem(`file_cache_${selectedFile}`);
              
              if (cachedContent && modifiedFiles.has(selectedFile)) {
                console.log(`Загружен кэшированный контент для модифицированного файла ${selectedFile}`);
                setFileContent(cachedContent);
                setCode(cachedContent);
                setImageSrc(null);
                setVideoSrc(null);
              } else {
                // Load content from disk since there's no cached version or file is not modified locally
                console.log(`Загрузка файла с диска: ${selectedFile}`);
                const content = await invoke('read_text_file', { path: selectedFile });
                
                // Проверяем, отличается ли новое содержимое от оригинального
                const originalContent = originalFileContents.get(selectedFile);
                if (originalContent !== undefined && originalContent !== content) {
                  console.log(`Файл ${selectedFile} был изменен вне редактора. Обновляем содержимое.`);
                  
                  // Обновляем оригинальное содержимое
                  setOriginalFileContents(prev => {
                    const newMap = new Map(prev);
                    newMap.set(selectedFile, content);
                    return newMap;
                  });
                  
                  // Если файл не был модифицирован в редакторе, обновляем его содержимое
                  if (!modifiedFiles.has(selectedFile)) {
                    setFileContent(content);
                    setCode(content);
                  } else {
                    // Если файл был модифицирован, спрашиваем пользователя, что делать
                    const userChoice = confirm(
                      `Файл "${selectedFile}" был изменен вне редактора.\n\n` +
                      `Хотите загрузить новую версию файла? ` +
                      `(Ваши несохраненные изменения будут потеряны)`
                    );
                    
                    if (userChoice) {
                      // Пользователь выбрал загрузить новую версию
                      setFileContent(content);
                      setCode(content);
                      
                      // Удаляем файл из списка модифицированных
                      setModifiedFiles(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(selectedFile);
                        return newSet;
                      });
                      
                      // Удаляем кеш файла
                      localStorage.removeItem(`file_cache_${selectedFile}`);
                    } else {
                      // Пользователь выбрал оставить свои изменения
                      // Оставляем текущее содержимое редактора
                      console.log('Пользователь предпочел сохранить свои изменения');
                    }
                  }
                } else {
                  // Файл не изменился или это первая загрузка
                  setFileContent(content);
                  setCode(content);
                }
                
                setImageSrc(null);
                setVideoSrc(null);
                
                // Detect encoding (currently hardcoded to UTF-8 since actual detection happens in Rust)
                const encoding = "UTF-8";
                
                // Update editor info with encoding
                if (onEditorInfoChange) {
                  onEditorInfoChange(prev => ({
                    ...prev,
                    encoding
                  }));
                }
                
                // Store this as the original version of the file for comparing changes
                if (!originalFileContents.has(selectedFile)) {
                  setOriginalFileContents(prev => {
                    const newMap = new Map(prev);
                    newMap.set(selectedFile, content);
                    return newMap;
                  });
                }
              }
              
              // Notify LSP about file open
              if (monacoInstance && editorInstance && lspStatus.initialized) {
                monacoLSPService.handleFileOpen(selectedFile, fileContent || code);
                
                // Устанавливаем правильный язык для текущей модели
                const model = editorInstance.getModel();
                if (model) {
                  correctLanguageFromExtension(selectedFile, model);
                }
              }
            } else if (supportedImageExtensions.includes(ext)) {
              if (ext === '.png') {
                console.log(`PNG file detected, will use PngViewer component to display: ${selectedFile}`);
                // Для PNG просто устанавливаем imageSrc как строку пути,
                // реальная обработка будет выполнена в компоненте PngViewer
                setImageSrc('png-file-path'); // Специальный маркер для обозначения PNG
                setFileContent(null);
                setVideoSrc(null);
              } else {
                // Для других форматов изображений используем текущий метод
                console.log(`Loading non-PNG image: ${selectedFile}`);
                try {
                  const base64Content: string = await invoke('read_binary_file', { path: selectedFile });
                  
                  if (base64Content) {
                    const fileUrl = `data:image/${ext.slice(1)};base64,${base64Content}`;
                    console.log(`Loaded non-PNG image, data length: ${fileUrl?.length || 0}, data starts with:`, fileUrl?.substring(0, 50));
                    setImageSrc(fileUrl);
                  } else {
                    console.error('read_binary_file returned empty data for non-PNG image');
                    setImageSrc(null);
                  }
                } catch (error) {
                  console.error('Error loading non-PNG image:', error);
                  setImageSrc(null);
                }
                setFileContent(null);
                setVideoSrc(null);
              }
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
              
              // Сохраняем пустое содержимое для нового файла
              setOriginalFileContents(prev => {
                const newMap = new Map(prev);
                newMap.set(selectedFile, '');
                return newMap;
              });
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
        } catch (error) {
          console.error('Error checking path:', error);
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
  }, [selectedFile, supportedTextExtensions, supportedImageExtensions, supportedVideoExtensions, lspStatus.initialized, monacoInstance, editorInstance, code, modifiedFiles]);

  // Добавляем функцию для открытия папки
  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Выберите рабочую папку',
      });
  
      if (selected) {
        // Закрываем все открытые файлы при смене директории
        setOpenedFiles([]);
        if (handleFileSelect) {
          handleFileSelect(null);
        }
        
        setSelectedFolder(selected);
        console.log('Открыта папка:', selected);
        
        // Сбрасываем счетчик ошибок при открытии новой директории
        if (onEditorInfoChange) {
          onEditorInfoChange({
            errors: 0,
            warnings: 0,
            language: '',
            encoding: 'UTF-8',
            cursorInfo: {
              line: 1,
              column: 1,
              totalChars: 0
            }
          });
        }
        
        // Очищаем список проблем - более радикальный подход
        if (onIssuesChange) {
          onIssuesChange([]);
          
          // Принудительная очистка через пустой массив проблем
          setTimeout(() => {
            onIssuesChange([]);
          }, 100);
          
          // Еще одна попытка очистки
          setTimeout(() => {
            onIssuesChange([]);
          }, 500);
        }
        
        // Очистка моделей и кэша редактора
        if (editorInstance) {
          try {
            // Удаляем все созданные модели
            if (monacoInstance && monacoInstance.editor) {
              const allModels = monacoInstance.editor.getModels();
              if (allModels && allModels.length > 0) {
                allModels.forEach(model => {
                  try {
                    model.dispose();
                  } catch (err) {
                    console.error('Ошибка при удалении модели редактора:', err);
                  }
                });
                console.log('Все модели редактора удалены');
              }
            }
          } catch (err) {
            console.error('Ошибка при очистке моделей редактора:', err);
          }
        }
        
        // Очищаем маркеры ошибок в Monaco
        if (monacoInstance && monacoInstance.editor) {
          // Очищаем все маркеры во всех файлах
          const allModels = monacoInstance.editor.getModels();
          if (allModels && allModels.length > 0) {
            allModels.forEach(model => {
              if (model && model.uri) {
                try {
                  // Устанавливаем пустой массив маркеров для модели
                  monacoInstance.editor.setModelMarkers(model, 'typescript', []);
                  monacoInstance.editor.setModelMarkers(model, 'javascript', []);
                  monacoInstance.editor.setModelMarkers(model, 'python', []);
                  monacoInstance.editor.setModelMarkers(model, 'lint', []);
                  
                  // Пробуем очистить все возможные источники маркеров
                  const allOwners = [
                    'typescript', 'javascript', 'python', 'lint', 
                    'eslint', 'prettier', 'css', 'html', 'json',
                    'markdown', 'yaml', 'xml', 'lsp'
                  ];
                  
                  allOwners.forEach(owner => {
                    try {
                      monacoInstance.editor.setModelMarkers(model, owner, []);
                    } catch (err) {
                      // Игнорируем ошибки для несуществующих владельцев маркеров
                    }
                  });
                  
                  // Очистка для всех других маркеров
                  monacoInstance.editor.setModelMarkers(model, '', []);
                } catch (err) {
                  console.error('Ошибка при очистке маркеров:', err);
                }
              }
            });
          }
          
          // Запрашиваем очистку всех маркеров через глобальный метод
          if (monacoInstance.editor.removeAllMarkers) {
            try {
              monacoInstance.editor.removeAllMarkers();
            } catch (err) {
              console.error('Ошибка при удалении всех маркеров:', err);
            }
          }
          
          console.log('Маркеры ошибок очищены для всех файлов');
        }
        
        // Очищаем все глобальные хранилища ошибок
        if (window.clearAllErrors && typeof window.clearAllErrors === 'function') {
          window.clearAllErrors();
          console.log('Глобальные ошибки очищены');
        }
        
        // Сбрасываем все хранилища
        setModifiedFiles(new Set());
        setOriginalFileContents(new Map());
        localStorage.removeItem('problemsData');
        
        // Очищаем localStorage от всех кэшей файлов
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('file_cache_')) {
            localStorage.removeItem(key);
          }
        });
        
        // Полная очистка DOM элементов через прямое удаление
        try {
          // Находим все элементы, содержащие ошибки
          const errorElements = document.querySelectorAll('.error-message, .diagnostic-error, .marker-error, .problem-item');
          errorElements.forEach(element => {
            try {
              element.remove();
            } catch (e) {
              // Игнорируем ошибки при удалении
            }
          });
          
          // Проверяем и прямо очищаем содержимое панели проблем через DOM
          const problemsPanel = document.querySelector('.problems-panel');
          if (problemsPanel) {
            const problemsList = problemsPanel.querySelector('.problems-list');
            if (problemsList) {
              problemsList.innerHTML = '';
              console.log('Очищено содержимое панели проблем через DOM');
            }
          }
          
          // Очищаем счетчики в верхней панели
          const errorCounters = document.querySelectorAll('.error-counter, .warning-counter, .info-counter');
          errorCounters.forEach(counter => {
            try {
              if (counter instanceof HTMLElement) {
                counter.textContent = '0';
                counter.style.display = 'none';
              }
            } catch (e) {
              // Игнорируем ошибки
            }
          });
          
          // Проверяем и прямо очищаем содержимое терминала через DOM
          const terminalPanel = document.querySelector('.terminal-container');
          if (terminalPanel) {
            const errorMessages = terminalPanel.querySelectorAll('.error-message');
            errorMessages.forEach(element => {
              element.remove();
            });
            console.log('Очищены сообщения об ошибках в терминале через DOM');
          }
        } catch (err) {
          console.error('Ошибка при прямой очистке DOM элементов:', err);
        }
        
        // Очищаем любые ошибки в терминале через событие
        const clearTerminalEvent = new CustomEvent('clear-terminal-errors', {
          detail: { source: 'folder-change', forceClean: true }
        });
        window.dispatchEvent(clearTerminalEvent);
        
        // Отправляем еще раз через небольшую задержку для надежности
        setTimeout(() => {
          const additionalClearEvent = new CustomEvent('clear-terminal-errors', {
            detail: { source: 'folder-change-delayed', forceClean: true }
          });
          window.dispatchEvent(additionalClearEvent);
        }, 300);
        
        // Очищаем панель проблем через событие
        const clearProblemsEvent = new CustomEvent('clear-problems-panel', {
          detail: { source: 'folder-change', forceClean: true }
        });
        window.dispatchEvent(clearProblemsEvent);
        
        // Отправляем еще раз через небольшую задержку для надежности
        setTimeout(() => {
          const additionalClearProblemsEvent = new CustomEvent('clear-problems-panel', {
            detail: { source: 'folder-change-delayed', forceClean: true }
          });
          window.dispatchEvent(additionalClearProblemsEvent);
        }, 300);
        
        // Отправляем событие для полной очистки интерфейса
        const resetUIEvent = new CustomEvent('reset-editor-ui', {
          detail: { source: 'folder-change' }
        });
        window.dispatchEvent(resetUIEvent);
        
        // Отправляем событие обновления интерфейса
        const refreshEvent = new CustomEvent('editor-refresh', {
          detail: { source: 'folder-change' }
        });
        window.dispatchEvent(refreshEvent);
        
        // Если доступен setupAllErrorDecorations, вызываем его для сброса глобального хранилища маркеров
        if (window.setupAllErrorDecorations && typeof window.setupAllErrorDecorations === 'function') {
          setTimeout(() => {
            window.setupAllErrorDecorations(true); // Передаем true для очистки
          }, 300);
        }
        
        // Вызываем принудительную очистку всех кэшей ошибок
        if (window.monaco) {
          try {
            // Очищаем кэш диагностики для всех языковых сервисов
            const languages = ['typescript', 'javascript', 'html', 'css', 'json', 'python'];
            languages.forEach(lang => {
              if (window.monaco.languages[lang]) {
                try {
                  if (window.monaco.languages[lang].diagnosticsCollection) {
                    window.monaco.languages[lang].diagnosticsCollection.clear();
                  }
                } catch (e) {
                  // Игнорируем ошибки для несуществующих коллекций
                }
              }
            });
          } catch (err) {
            console.error('Ошибка при очистке кэша диагностики:', err);
          }
        }
        
        // Обновляем любые счетчики ошибок в различных компонентах через глобальное событие
        const updateCountersEvent = new CustomEvent('update-error-counters', {
          detail: { errors: 0, warnings: 0 }
        });
        window.dispatchEvent(updateCountersEvent);
        
        // Полная перезагрузка состояния редактора
        setTimeout(() => {
          // Отправляем еще одно событие очистки с большей задержкой
          const finalCleanupEvent = new CustomEvent('final-editor-cleanup', {
            detail: { source: 'folder-change-final' }
          });
          window.dispatchEvent(finalCleanupEvent);
          
          console.log('Выполнена полная очистка всех ошибок при смене директории');
        }, 1000);
      }
    } catch (error) {
      console.error('Ошибка открытия папки:', error);
    }
  };

  // Добавляем функцию для сохранения файла
  const handleSaveFile = async (saveAs = false) => {
    try {
      if (!selectedFile || code === undefined) return;
      
      let targetPath: string | null = null;
      
      if (saveAs || selectedFile.startsWith('untitled-')) {
        // Если это новый файл или Сохранить как, предлагаем выбрать имя
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
        // Сохраняем файл на диск
        await invoke('save_file', {
          path: targetPath,
          content: code
        });
        
        console.log(`Файл сохранён: ${targetPath}`);
        
        // Обновляем оригинальное содержимое файла после сохранения
        setOriginalFileContents(prev => {
          const newMap = new Map(prev);
          newMap.set(targetPath as string, code);
          return newMap;
        });
        
        // Удаляем файл из списка модифицированных
        setModifiedFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetPath as string);
          return newSet;
        });
        
        // Если это был новый файл, обновляем его путь
        if (selectedFile.startsWith('untitled-') && targetPath !== selectedFile) {
          const fileName = pathUtils.basename(targetPath);
          
          // Обновляем список открытых файлов
          setOpenedFiles(prev => 
            prev.map(file => 
              file.path === selectedFile 
                ? { ...file, path: targetPath as string, name: fileName }
                : file
            )
          );
          
          // Устанавливаем новый файл как текущий
          if (handleFileSelect) {
            handleFileSelect(targetPath);
          }
        }
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
    
    // Проверяем, изменился ли файл
    if (selectedFile) {
      // Get the original file content (the content when the file was first loaded)
      const originalContent = originalFileContents.get(selectedFile);
      
      if (originalContent !== undefined) {
        // Check if the current content differs from the original (not from the cached)
        const isModified = originalContent !== newValue;
        
        // Update the modified files set based on modification status
        if (isModified) {
          if (!modifiedFiles.has(selectedFile)) {
            console.log(`Файл ${selectedFile} помечен как модифицированный`);
            setModifiedFiles(prev => {
              const newSet = new Set(prev);
              newSet.add(selectedFile);
              return newSet;
            });
          }
          
          // Store the CURRENT content as the cached version
          localStorage.setItem(`file_cache_${selectedFile}`, newValue);
        } else {
          // File content matches original - no longer modified
          if (modifiedFiles.has(selectedFile)) {
            console.log(`Файл ${selectedFile} больше не модифицирован`);
            setModifiedFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedFile);
              return newSet;
            });
            
            // Clear the cache for this file
            localStorage.removeItem(`file_cache_${selectedFile}`);
          }
        }
      }
    }
    
    // Notify LSP of code changes
    if (selectedFile && lspStatus.initialized) {
      monacoLSPService.handleFileChange(selectedFile, newValue);
    }
  };

  // Функция для создания нового файла через проводник
  const handleCreateFileWithExplorer = async () => {
    try {
      // Определяем базовую директорию для создания файла
      let baseDir = selectedFolder;
      
      // Если нет выбранной директории, предлагаем выбрать
      if (!baseDir) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Выберите директорию для создания файла',
        });
        
        if (selected) {
          baseDir = selected;
          setSelectedFolder(selected);
        } else {
          return; // Пользователь отменил выбор
        }
      }
      
      // Открываем диалог сохранения файла
      const filePath = await save({
        title: 'Создать новый файл',
        defaultPath: baseDir,
        filters: [
          { name: 'Текстовые файлы', extensions: ['txt', 'md'] },
          { name: 'Веб-файлы', extensions: ['html', 'css', 'js'] },
          { name: 'Скрипты', extensions: ['py', 'ts', 'jsx', 'tsx'] },
          { name: 'Все файлы', extensions: ['*'] }
        ]
      });
      
      if (filePath) {
        // Создаем пустой файл на диске
        await invoke('save_file', {
          path: filePath,
          content: '' // Создаем пустой файл
        });
        
        console.log(`Создан новый файл: ${filePath}`);
        
        // Получаем имя файла из пути
        const fileName = pathUtils.basename(filePath);
        
        // Добавляем файл в список открытых
        setOpenedFiles(prev => {
          // Проверяем, не открыт ли уже файл
          if (prev.some(file => file.path === filePath)) {
            return prev;
          }
          return [...prev, { name: fileName, path: filePath, isFolder: false }];
        });
        
        // Устанавливаем созданный файл как текущий
        if (handleFileSelect) {
          handleFileSelect(filePath);
        }
        
        // Добавляем пустое содержимое в Map оригинальных содержимых
        setOriginalFileContents(prev => {
          const newMap = new Map(prev);
          newMap.set(filePath, '');
          return newMap;
        });
      }
    } catch (error) {
      console.error('Ошибка создания файла:', error);
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
    
    // Применяем декорации для отображения ошибок
    if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
      console.log('🎨 Применяем декорации ошибок при монтировании редактора');
      window.setupErrorDecorations(editor);
      
      // Настраиваем периодическое обновление декораций
      const errorUpdateInterval = setInterval(() => {
        if (window.setupErrorDecorations && editor && editor.getModel()) {
          window.setupErrorDecorations(editor);
        } else if (!editor || !editor.getModel()) {
          clearInterval(errorUpdateInterval);
        }
      }, 2000); // Каждые 2 секунды
      
      // Сохраняем ID интервала в редакторе для очистки
      editor._errorUpdateInterval = errorUpdateInterval;
      
      // Подписываемся на событие изменения модели для обновления декораций
      editor.onDidChangeModel(() => {
        // При изменении модели сначала собираем все маркеры
        if (window.setupAllErrorDecorations) {
          setTimeout(() => {
            window.setupAllErrorDecorations();
          }, 300);
        } else if (window.setupErrorDecorations) {
          setTimeout(() => {
            window.setupErrorDecorations(editor);
          }, 500);
        }
        
        // Также обновляем при получении фокуса
        editor.onDidFocusEditorWidget(() => {
          if (window.setupAllErrorDecorations) {
            // Обновляем глобальное хранилище маркеров и применяем декорации
            setTimeout(() => {
              window.setupAllErrorDecorations();
            }, 300);
          }
        });
      });
      
      // Очистка при уничтожении редактора
      editor.onDidDispose(() => {
        if (editor._errorUpdateInterval) {
          clearInterval(editor._errorUpdateInterval);
        }
      });
    } else {
      console.warn('❌ Функция setupErrorDecorations недоступна в window');
    }
    
    // Apply current theme immediately to new editor
    try {
      const themeSettings = localStorage.getItem('theme-settings');
      if (themeSettings) {
        const { monacoTheme } = JSON.parse(themeSettings);
        if (monacoTheme && editor && typeof editor.updateOptions === 'function') {
          console.log(`Applying theme ${monacoTheme} to newly mounted editor`);
          monaco.editor.setTheme(monacoTheme);
          editor.updateOptions({ theme: monacoTheme });
        }
      }
    } catch (error) {
      console.error('Error applying theme to newly mounted editor:', error);
    }

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

    // Обработчик наведения мыши для отображения путей
    editor.onMouseMove((e: any) => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(position.lineNumber);
      const offset = model.getOffsetAt(position);

      // Очищаем предыдущий тултип
      setTooltipContent(null);
      setTooltipPosition(null);

      // Ищем строки в кавычках
      const stringRegex = /['"]([^'"]+)['"]/g;
      let stringMatch;
      while ((stringMatch = stringRegex.exec(lineContent)) !== null) {
        const startOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: stringMatch.index + 1
        });
        const endOffset = model.getOffsetAt({
          lineNumber: position.lineNumber,
          column: stringMatch.index + stringMatch[0].length - 1
        });

        if (offset >= startOffset && offset <= endOffset) {
          const path = stringMatch[1];
          if (selectedFile) {
            resolveModulePath(path, selectedFile).then(fullPath => {
              setTooltipContent(`module "${fullPath}"`);
              setTooltipPosition({
                x: e.event.clientX,
                y: e.event.clientY
              });
            });
          }
          return;
        }
      }
    });

    // Добавляем подсказки для импортов
    monaco.languages.registerCompletionItemProvider(['typescript', 'javascript', 'typescriptreact', 'javascriptreact'], {
      provideCompletionItems: async (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const lineUntilPosition = lineContent.substring(0, position.column - 1);

        // Проверяем, что мы находимся в строке импорта
        if (lineUntilPosition.includes('import') || lineUntilPosition.includes('require')) {
          try {
            const projectRoot = await invoke('get_project_root', { currentFilePath: selectedFile });
            const suggestions = await invoke('get_import_suggestions', {
              projectRoot,
              currentFile: selectedFile,
              lineContent,
              position: {
                line: position.lineNumber,
                column: position.column
              }
            });

            return {
              suggestions: suggestions.map((suggestion: any) => ({
                label: suggestion.label,
                kind: monaco.languages.CompletionItemKind.Module,
                detail: suggestion.detail,
                insertText: suggestion.insertText,
                documentation: suggestion.documentation
              }))
            };
          } catch (error) {
            console.error('Error getting import suggestions:', error);
            return { suggestions: [] };
          }
        }

        return { suggestions: [] };
      }
    });
  };

  // Функция для разрешения путей
  const resolvePath = (currentFile: string, importPath: string): string => {
    try {
      if (!currentFile) return importPath;
      
      // Используем простую обработку путей без использования модуля path
      const getDirectory = (path: string): string => {
        const lastSlashIndex = path.lastIndexOf('/');
        if (lastSlashIndex === -1) {
          const lastBackslashIndex = path.lastIndexOf('\\');
          return lastBackslashIndex === -1 ? '' : path.substring(0, lastBackslashIndex);
        }
        return path.substring(0, lastSlashIndex);
      };
      
      const joinPaths = (base: string, relative: string): string => {
        if (!base) return relative;
        return base.endsWith('/') || base.endsWith('\\') ? `${base}${relative}` : `${base}/${relative}`;
      };
      
      const workspaceRoot = getDirectory(currentFile);
      let resolvedPath = importPath;

      // Абсолютный путь
      if (importPath.startsWith('/') || /^[A-Z]:/.test(importPath)) {
        resolvedPath = importPath;
      }
      // Относительный путь
      else if (importPath.startsWith('./') || importPath.startsWith('../')) {
        resolvedPath = joinPaths(workspaceRoot, importPath);
      }
      // Путь с алиасом @
      else if (importPath.startsWith('@/')) {
        // Находим src директорию
        let srcPath = workspaceRoot;
        while (srcPath && !srcPath.endsWith('/src') && !srcPath.endsWith('\\src')) {
          srcPath = getDirectory(srcPath);
        }
        if (!srcPath) srcPath = workspaceRoot;
        resolvedPath = joinPaths(srcPath, importPath.slice(2));
      }

      return resolvedPath;
    } catch (error) {
      console.error('Error resolving path:', error);
      return importPath;
    }
  };

  /**
   * Вызывает автодополнение в редакторе
   * @param editor Экземпляр редактора
   */
  function triggerAutoCompletion(editor: any) {
    if (!editor) {
      console.warn('Редактор не определен для вызова автодополнения');
      return;
    }
    
    try {
      // Проверяем наличие suggestController
      const suggestController = editor.getContribution('editor.contrib.suggestController');
      
      if (suggestController && typeof suggestController.triggerSuggest === 'function') {
        console.log('Вызов автодополнения через suggestController');
        suggestController.triggerSuggest();
      } else {
        console.warn('suggestController недоступен или метод triggerSuggest не является функцией');
        // Альтернативный способ вызова автодополнения
        editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
      }
    } catch (error) {
      console.error('Ошибка при вызове автодополнения:', error);
      // Резервный способ
      try {
        editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
      } catch (fallbackError) {
        console.error('Резервный способ автодополнения также не сработал:', fallbackError);
      }
    }
  }

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

  // Переопределяем обработчик создания файла
  useEffect(() => {
    // При первом рендере заменяем обработчик createFile на наш собственный
    if (typeof handleCreateFile === 'function') {
      // Создаем обработчик события для перехвата
      const handleCreateFileEvent = (e: Event) => {
        e.preventDefault();
        handleCreateFileWithExplorer();
      };

      // Создаем кастомное событие для создания файла
      document.addEventListener('create-file', handleCreateFileEvent);

      return () => {
        document.removeEventListener('create-file', handleCreateFileEvent);
      };
    }
  }, [handleCreateFile, selectedFolder]);

  // Add global keyboard shortcuts for file operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open folder (Ctrl+O)
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
      }
      // Create new file (Ctrl+N)
      else if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        handleCreateFileWithExplorer();
        console.log('Вызван обработчик создания файла по Ctrl+N');
      }
      // Copy path (Ctrl+Shift+C)
      else if (e.ctrlKey && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        if (selectedFile) {
          navigator.clipboard.writeText(selectedFile)
            .then(() => console.log('Path copied to clipboard'))
            .catch(err => console.error('Failed to copy path:', err));
        }
      }
      // Save file (Ctrl+S)
      else if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        console.log('Сохранение файла по Ctrl+S');
        handleSaveFile(false);
      }
      // Save file as (Ctrl+Shift+S)
      else if (e.ctrlKey && e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSaveFile(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, handleSaveFile, handleCreateFileWithExplorer, handleOpenFolder]);

  // Добавляем эффект для обновления модифицированных файлов при изменении кода
  useEffect(() => {
    if (selectedFile && code !== undefined) {
      const originalContent = originalFileContents.get(selectedFile);
      
      // Файл модифицирован если содержимое изменилось
      if (originalContent !== undefined && originalContent !== code) {
        if (!modifiedFiles.has(selectedFile)) {
          console.log(`Файл ${selectedFile} был изменен`);
          setModifiedFiles(prev => {
            const newSet = new Set(prev);
            newSet.add(selectedFile);
            return newSet;
          });
        }
      } else if (originalContent === code) {
        // Если содержимое совпадает с оригиналом, удаляем из модифицированных
        if (modifiedFiles.has(selectedFile)) {
          console.log(`Файл ${selectedFile} больше не модифицирован`);
          setModifiedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedFile);
            return newSet;
          });
        }
      }
    }
  }, [selectedFile, code, originalFileContents]);

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
          const fileExtension = pathUtils.extname(selectedFile).toLowerCase();
          let languageId = 'plaintext';
          
          // Определяем язык на основе расширения
          if (fileExtension === '.ts') languageId = 'typescript';
          else if (fileExtension === '.js') languageId = 'javascript';
          else if (fileExtension === '.tsx') languageId = 'typescriptreact';
          else if (fileExtension === '.jsx') languageId = 'javascriptreact';
          else if (fileExtension === '.html') languageId = 'html';
          else if (fileExtension === '.css') languageId = 'css';
          else if (fileExtension === '.json') languageId = 'json';
          
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

  // Add this function after other utility functions
  const resolveModulePath = async (importPath: string, currentFile: string): Promise<string> => {
    try {
      // Get project root first
      const projectRoot = await invoke('get_project_root', { currentFilePath: currentFile });
      
      // Then resolve the module path
      const result = await invoke('resolve_module_path', {
        projectRoot,
        moduleName: importPath
      });
      return result as string;
    } catch (error) {
      console.error('Error resolving module path:', error);
      return importPath;
    }
  };

  // Инициализация LSP клиента
  useEffect(() => {
    // Проверяем, есть ли редактор и Monaco
    if (editorRef.current && window.monaco && !lspStatus.initialized) {
      console.log('Инициализация LSP клиента для Python...');
      
      try {
        // Используем существующий механизм LSP через monacoLSPService
        const lspInstance = getMonacoLSPInstance();
        if (lspInstance) {
          console.log('Используем существующий LSP клиент');
          
          // Устанавливаем корневую директорию проекта
          if (selectedFolder) {
            lspInstance.setProjectRoot(selectedFolder);
          }
          
          // Открываем текущий файл в LSP
          if (selectedFile && fileContent !== null) {
            lspInstance.handleFileOpen(selectedFile, fileContent);
          }
        }
        
        /*
        // Инициализируем LSP клиент
        if (lspClientRef.current) {
          // Вызываем initialize при первом монтировании
          lspClientRef.current.initialize().then(() => {
            // После инициализации устанавливаем редактор
            lspClientRef.current.setEditor(editorRef.current);
            
            // Устанавливаем корневую директорию проекта
            if (projectRoot) {
              lspClientRef.current.setProjectRoot(projectRoot);
            }
            
            // Открываем текущий файл в LSP
            if (currentFilePath && fileContent !== null) {
              lspClientRef.current.handleFileOpen(currentFilePath, fileContent);
            }
            
            console.log('LSP клиент успешно инициализирован и подключен к серверам');
          }).catch(error => {
            console.error('Ошибка при инициализации LSP клиента:', error);
          });
        }
        */
      } catch (error) {
        console.error('Ошибка при настройке LSP клиента:', error);
      }
    }
  }, [editorRef.current, window.monaco, selectedFolder, selectedFile, fileContent, lspStatus.initialized]);

  // Добавляем функцию для открытия модального окна клонирования репозитория
  const handleOpenCloneModal = () => {
    setIsCloneModalOpen(true);
  };

  // Функция для закрытия модального окна
  const handleCloseCloneModal = () => {
    setIsCloneModalOpen(false);
  };

  // Функция для клонирования репозитория
  const handleCloneRepository = async (repoUrl: string, targetDir: string) => {
    try {
      // Вызываем Rust-функцию для клонирования репозитория
      const result = await invoke('git_clone_repository', {
        url: repoUrl,
        targetPath: targetDir  // Используем camelCase для Tauri
      });
      
      // После успешного клонирования открываем директорию проекта
      setSelectedFolder(targetDir);
      console.log(`Repository ${repoUrl} successfully cloned to ${targetDir}`);
      
      // Закрываем модальное окно
      setIsCloneModalOpen(false);
      
      return { success: true, message: result };
    } catch (error) {
      console.error('Error cloning repository:', error);
      
      // Формируем более понятное сообщение об ошибке
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Проверяем, содержит ли сообщение об ошибке информацию о существующей директории
      if (errorMessage.includes('уже существует') || errorMessage.includes('already exists')) {
        errorMessage = `Директория '${targetDir}' уже существует. Пожалуйста, выберите другую директорию или удалите существующую.`;
      }
      
      return { 
        success: false, 
        message: errorMessage
      };
    }
  };

  // Функция для создания новой папки
  const handleCreateFolder = async () => {
    try {
      // Если нет выбранной директории, предлагаем выбрать
      if (!selectedFolder) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Выберите директорию',
        });
        
        if (selected) {
          setSelectedFolder(selected);
          // Открываем модальное окно после выбора директории
          setIsCreateFolderModalOpen(true);
        }
      } else {
        // Если директория уже выбрана, просто открываем модальное окно
        setIsCreateFolderModalOpen(true);
      }
    } catch (error) {
      console.error('Ошибка при выборе директории:', error);
    }
  };

  // Обработчик подтверждения создания папки
  const handleConfirmCreateFolder = async (newFolderName: string) => {
    try {
      if (!selectedFolder || !newFolderName) return;
      
      // Полный путь новой папки
      const newFolderPath = `${selectedFolder}/${newFolderName}`;
      
      // Вызываем функцию создания папки
      await invoke("create_folder", {
        path: newFolderPath
      });
      
      console.log(`Создана новая папка: ${newFolderPath}`);
      
      // Можно добавить обновление директории после создания
    } catch (error) {
      console.error('Ошибка при создании папки:', error);
    }
  };

  // Функция для открытия предпросмотра HTML
  const handlePreviewHtml = (filePath: string) => {
    if (filePath && filePath.toLowerCase().endsWith('.html')) {
      console.log(`Opening HTML preview for file: ${filePath}`);
      setIsHtmlPreviewVisible(true);
    }
  };
  
  // Функция для закрытия предпросмотра HTML
  const handleCloseHtmlPreview = () => {
    setIsHtmlPreviewVisible(false);
  };

  // Экспортируем интерфейс компонента для использования из вне
  React.useImperativeHandle(editorRef, () => ({
    selectAll: () => {
      if (editorInstance) {
        editorInstance.focus();
        const model = editorInstance.getModel();
        if (model) {
          const lastLine = model.getLineCount();
          const lastColumn = model.getLineMaxColumn(lastLine);
          editorInstance.setSelection(new monacoInstance.Range(1, 1, lastLine, lastColumn));
        }
      }
    },
    deselect: () => {
      if (editorInstance) {
        editorInstance.focus();
        const position = editorInstance.getPosition();
        if (position) {
          editorInstance.setSelection(new monacoInstance.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ));
        }
      }
    },
    invertSelection: () => {
      if (editorInstance && monacoInstance) {
        editorInstance.focus();
        const model = editorInstance.getModel();
        if (model) {
          const selection = editorInstance.getSelection();
          const totalLines = model.getLineCount();
          const lastLineLength = model.getLineMaxColumn(totalLines);
          
          // Если нет выделения, выходим
          if (!selection || selection.isEmpty()) {
            console.log('Нет выделения для инвертирования');
            return;
          }
          
          // Инвертируем выделение - создаем две новые области выделения:
          // 1. От начала документа до начала текущего выделения
          // 2. От конца текущего выделения до конца документа
          
          const newSelections = [];
          
          // Если текущее выделение не с самого начала документа, добавляем первую область
          if (selection.startLineNumber > 1 || selection.startColumn > 1) {
            newSelections.push(
              new monacoInstance.Selection(
                1, 1,
                selection.startLineNumber, selection.startColumn
              )
            );
          }
          
          // Если текущее выделение не до самого конца документа, добавляем вторую область
          if (selection.endLineNumber < totalLines || selection.endColumn < lastLineLength) {
            newSelections.push(
              new monacoInstance.Selection(
                selection.endLineNumber, selection.endColumn,
                totalLines, lastLineLength
              )
            );
          }
          
          // Устанавливаем новые выделения
          if (newSelections.length > 0) {
            editorInstance.setSelections(newSelections);
          }
          
          console.log('Инвертированное выделение применено');
        }
      }
    },
    selectParagraph: () => {
      if (editorInstance && monacoInstance) {
        editorInstance.focus();
        const model = editorInstance.getModel();
        if (model) {
          const position = editorInstance.getPosition();
          if (!position) return;
          
          const lineNumber = position.lineNumber;
          const lineCount = model.getLineCount();
          
          // Найдем начало параграфа (первая пустая строка перед текущей или начало файла)
          let startLine = lineNumber;
          while (startLine > 1) {
            const prevLineContent = model.getLineContent(startLine - 1).trim();
            if (prevLineContent === '') {
              break; // Нашли пустую строку
            }
            startLine--;
          }
          
          // Найдем конец параграфа (первая пустая строка после текущей или конец файла)
          let endLine = lineNumber;
          while (endLine < lineCount) {
            const lineContent = model.getLineContent(endLine).trim();
            if (lineContent === '' && endLine !== startLine) {
              break; // Нашли пустую строку
            }
            endLine++;
          }
          
          // Определяем начальный и конечный столбцы для выделения
          const startColumn = 1;
          const endColumn = model.getLineMaxColumn(endLine);
          
          // Создаем выделение
          const selection = new monacoInstance.Range(
            startLine, startColumn,
            endLine, endColumn
          );
          
          // Применяем выделение
          editorInstance.setSelection(selection);
          
          console.log(`Выделен параграф с ${startLine} по ${endLine} строку`);
        }
      }
    },
    // Добавим методы для управления состоянием файлов
    saveCurrentFile: () => handleSaveFile(false),
    saveFileAs: () => handleSaveFile(true),
    getModifiedFiles: () => Array.from(modifiedFiles),
    openHtmlPreview: handlePreviewHtml,
    closeHtmlPreview: handleCloseHtmlPreview,
    isFileModified: (path: string) => modifiedFiles.has(path)
  }), [editorInstance, monacoInstance, handleSaveFile, modifiedFiles, handlePreviewHtml, handleCloseHtmlPreview]);

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

  // Reference to keep track of the previously selected file
  const prevSelectedFileRef = useRef<string | null>(null);

  // Save content of previous file when switching files
  useEffect(() => {
    // Save the content of the previous file if it was modified
    if (prevSelectedFileRef.current && 
        prevSelectedFileRef.current !== selectedFile && 
        modifiedFiles.has(prevSelectedFileRef.current)) {
      const previousFile = prevSelectedFileRef.current;
      
      // Get content from the cached code for the previous file
      const contentToSave = originalFileContents.get(previousFile);
      
      if (contentToSave !== undefined) {
        // Save the content of the previous file
        console.log(`Auto-saving previous file: ${previousFile}`);
        
        // Save directly to disk using the previous file's path
        invoke('save_file', {
          path: previousFile,
          content: contentToSave
        })
        .then(() => {
          console.log(`Auto-saved previous file: ${previousFile}`);
          
          // Remove from modified files after saving
          setModifiedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(previousFile);
            return newSet;
          });
        })
        .catch(error => {
          console.error(`Error auto-saving previous file: ${previousFile}`, error);
        });
      }
    }
    
    // Update the reference to the current file
    prevSelectedFileRef.current = selectedFile;
  }, [selectedFile, originalFileContents, modifiedFiles]);

  // Listen for monaco theme changes
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      const { monacoTheme } = event.detail;
      console.log(`CenterContainer: Theme changed to ${monacoTheme}`);
      
      // Apply theme to all editors
      if (window.monaco && window.monaco.editor) {
        const allEditors = window.monaco.editor.getEditors();
        console.log(`Applying theme ${monacoTheme} to ${allEditors.length} editors from CenterContainer`);
        
        // Set global theme
        window.monaco.editor.setTheme(monacoTheme);
        
        // Update each editor individually for immediate effect
        if (allEditors && allEditors.length > 0) {
          allEditors.forEach((editor) => {
            try {
              if (editor && typeof editor.updateOptions === 'function') {
                editor.updateOptions({ theme: monacoTheme });
              }
            } catch (error) {
              console.error('Error applying theme to editor:', error);
            }
          });
        }
      }
    };

    // Add event listener
    window.addEventListener('monaco-theme-changed', handleThemeChange as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('monaco-theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  // Слушаем события для действий редактора
  useEffect(() => {
    const handleEditorAction = (event: CustomEvent) => {
      const { command } = event.detail;
      console.log('Получено действие редактора:', command);
      
      // Проверяем, есть ли доступ к функциям редактора
      if (!editorRef?.current) {
        console.warn('Ссылка на редактор недоступна');
        return;
      }
      
      // Вызываем соответствующую функцию в зависимости от команды
      switch (command) {
        case 'selectParagraph':
          editorRef.current.selectParagraph();
          break;
        default:
          console.warn('Неизвестная команда редактора:', command);
      }
    };
    
    // Добавляем слушатель события
    document.addEventListener('editor-action', handleEditorAction as EventListener);
    
    // Очищаем слушатель при размонтировании
    return () => {
      document.removeEventListener('editor-action', handleEditorAction as EventListener);
    };
  }, [editorRef]);

  // Добавляем функцию проверки файла на изменения
  const checkFileForChanges = async (filePath: string) => {
    try {
      if (!filePath || filePath.startsWith('untitled-')) {
        return;
      }

      // Проверяем, существует ли файл
      const fileExists = await invoke('file_exists', { path: filePath });
      if (!fileExists) {
        console.log(`Файл ${filePath} не существует на диске`);
        return;
      }

      // Читаем содержимое файла
      const diskContent = await invoke('read_text_file', { path: filePath });
      
      // Получаем оригинальное содержимое
      const originalContent = originalFileContents.get(filePath);
      
      // Если содержимое на диске отличается от оригинального
      if (originalContent !== undefined && originalContent !== diskContent) {
        console.log(`Файл ${filePath} был изменен вне редактора. Обновляем информацию.`);
        
        // Если файл не открыт сейчас, просто обновляем оригинальное содержимое
        if (filePath !== selectedFile) {
          setOriginalFileContents(prev => {
            const newMap = new Map(prev);
            newMap.set(filePath, diskContent);
            return newMap;
          });
          return;
        }
        
        // Если файл не был изменен в редакторе, обновляем его содержимое
        if (!modifiedFiles.has(filePath)) {
          console.log(`Обновление содержимого для неизмененного файла ${filePath}`);
          setFileContent(diskContent);
          setCode(diskContent);
          
          // Обновляем оригинальное содержимое
          setOriginalFileContents(prev => {
            const newMap = new Map(prev);
            newMap.set(filePath, diskContent);
            return newMap;
          });
        } else {
          // Если файл был изменен в редакторе, спрашиваем пользователя
          const userChoice = confirm(
            `Файл "${filePath}" был изменен вне редактора.\n\n` +
            `Хотите загрузить новую версию файла? ` +
            `(Ваши несохраненные изменения будут потеряны)`
          );
          
          if (userChoice) {
            // Пользователь выбрал загрузить новую версию
            setFileContent(diskContent);
            setCode(diskContent);
            
            // Удаляем файл из списка модифицированных
            setModifiedFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(filePath);
              return newSet;
            });
            
            // Удаляем кеш файла
            localStorage.removeItem(`file_cache_${filePath}`);
            
            // Обновляем оригинальное содержимое
            setOriginalFileContents(prev => {
              const newMap = new Map(prev);
              newMap.set(filePath, diskContent);
              return newMap;
            });
          }
        }
      }
    } catch (error) {
      console.error(`Ошибка при проверке изменений файла ${filePath}:`, error);
    }
  };

  // Периодически проверяем файлы на наличие изменений
  useEffect(() => {
    // Создаем и сохраняем идентификатор таймера
    const checkInterval = 5000; // 5 секунд
    const fileCheckTimer = setInterval(() => {
      // Проверяем только открытые файлы
      openedFiles.forEach(file => {
        if (!file.isFolder && !file.path.startsWith('untitled-')) {
          checkFileForChanges(file.path);
        }
      });
    }, checkInterval);
    
    // Очищаем таймер при размонтировании компонента
    return () => {
      clearInterval(fileCheckTimer);
    };
  }, [openedFiles, originalFileContents, modifiedFiles, selectedFile]);

  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState<boolean>(false);

  return (
    <div className="center-container" style={style}>
      {!selectedFile && (
        <div className="welcome-message">
          <h2>X-Editor</h2>
          <p>Выберите файл для редактирования или создайте новый.</p>
          <div className="welcome-buttons">
            <button onClick={handleCreateFileWithExplorer} className="welcome-button">
              <div className="welcome-button-text">
              Создать файл
              </div>
              <span className="shortcut-label">CTRL + N</span>
            </button>
            
            <button onClick={handleCreateFolder} className="welcome-button">
              <div className="welcome-button-text">
                Создать папку
              </div>
              <span className="shortcut-label">CTRL + SHIFT + A</span>
            </button>
            
            <button onClick={handleOpenFolder} className="welcome-button">
              <div className="welcome-button-text">
                Открыть папку
              </div>
              <span className="shortcut-label">CTRL + O</span>
            </button>
            
            <button onClick={handleOpenCloneModal} className="welcome-button">
              <div className="welcome-button-text">
                Клонировать репозиторий
              </div>
              <span className="shortcut-label">CTRL + SHIFT + C</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Модальное окно для клонирования репозитория */}
      {isCloneModalOpen && (
        <CloneRepositoryModal 
          onClose={handleCloseCloneModal} 
          onClone={handleCloneRepository} 
        />
      )}
      
      {/* Модальное окно для создания папки */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onConfirm={handleConfirmCreateFolder}
      />
      
      {/* Разделим контейнер на две части, если нужен предпросмотр */}
      <div className={`editor-container ${isHtmlPreviewVisible ? 'with-preview' : ''}`}>
      {selectedFile && supportedTextExtensions.includes(selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase()) && (
          <div className="monaco-editor-wrapper">
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
          </div>
      )}
      
      {selectedFile && (isImageFile(selectedFile)) ? (
        <React.Fragment>
          {console.log(`Rendering image for ${selectedFile}`)}
          <ImageViewer 
            filePath={selectedFile}
            onLoad={() => console.log(`Image loaded successfully: ${selectedFile}`)}
            onError={(error) => console.error(`Error loading image: ${error}`)}
          />
        </React.Fragment>
      ) : null}
      
      {selectedFile && (isVideoFile(selectedFile)) ? (
        <React.Fragment>
          {console.log(`Rendering video for ${selectedFile}`)}
          <VideoPlayer 
            filePath={selectedFile}
            onLoad={() => console.log(`Video loaded successfully: ${selectedFile}`)}
            onError={(error) => console.error(`Error loading video: ${error}`)}
          />
        </React.Fragment>
      ) : null}
      
      {selectedFile && !supportedTextExtensions.includes(selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase()) && 
       !imageSrc && !videoSrc && (
        <p className="file-error-message">
          Файл {selectedFile.split(/[/\\]/).pop()} не поддерживается для просмотра.
            </p>
          )}
        
        {/* Блок предпросмотра HTML */}
        {isHtmlPreviewVisible && selectedFile && selectedFile.toLowerCase().endsWith('.html') && (
          <div className="html-preview-wrapper">
            <HtmlPreview
              htmlContent={code}
              isVisible={isHtmlPreviewVisible}
              filename={selectedFile}
              onClose={handleCloseHtmlPreview}
            />
          </div>
        )}
      </div>
      
      {tooltipContent && tooltipPosition && (
        <div 
          className="module-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y + 10,
            zIndex: 1000
          }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

export default CenterContainer;
