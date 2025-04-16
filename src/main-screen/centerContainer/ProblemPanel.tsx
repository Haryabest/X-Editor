import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Info, File, RefreshCw } from 'lucide-react';
// Импортируем стили
import '../../styles/problem-panel.css';

// Добавляем описание функции в глобальный интерфейс Window
declare global {
  interface Window {
    refreshAllPythonDiagnostics?: () => Promise<void>;
    getPythonDiagnostics?: () => any[];
    forceUpdateAllDecorations?: () => number;
  }
}

interface ProblemIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  rawMessage?: string; // Исходное сообщение без имени файла
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source?: string;
  code?: string;
  fileName?: string; // Имя файла для каждой ошибки
}

interface ProblemFile {
  filePath: string;
  fileName: string;
  issues: ProblemIssue[];
}

interface ProblemPanelProps {
  onFileClick?: (filePath: string, line?: number, column?: number) => void;
}

const ProblemPanel: React.FC<ProblemPanelProps> = ({ onFileClick }) => {
  const [problems, setProblems] = useState<ProblemFile[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [stats, setStats] = useState<{ errors: number; warnings: number; infos: number }>({
    errors: 0,
    warnings: 0,
    infos: 0
  });

  // Обработчик для клика по файлу или проблеме
  const handleClick = (filePath: string, line?: number, column?: number) => {
    if (onFileClick) {
      onFileClick(filePath, line, column);
    }
  };

  // Обработчик для переключения развернутости файла
  const toggleFileExpand = (filePath: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  // Функция для запуска расширенной проверки кода
  const runExtendedCodeScan = async () => {
    try {
      setIsScanning(true);
      
      // Сначала запускаем обычную проверку
      if (window.refreshAllPythonDiagnostics) {
        await window.refreshAllPythonDiagnostics();
      }
      
      // Затем принудительно обновляем все декорации
      if (window.forceUpdateAllDecorations) {
        window.forceUpdateAllDecorations();
      }
      
      // Получаем обновленные данные
      if (window.getPythonDiagnostics && typeof window.getPythonDiagnostics === 'function') {
        const diagnostics = window.getPythonDiagnostics();
        if (diagnostics && Array.isArray(diagnostics)) {
          setProblems(diagnostics);
          
          // Обновляем статистику
          let errors = 0;
          let warnings = 0;
          let infos = 0;
          
          diagnostics.forEach((file: ProblemFile) => {
            file.issues.forEach((issue: ProblemIssue) => {
              if (issue.severity === 'error') errors++;
              else if (issue.severity === 'warning') warnings++;
              else infos++;
            });
          });
          
          setStats({ errors, warnings, infos });
          
          // Разворачиваем все файлы
          const newExpandedFiles = new Set<string>();
          diagnostics.forEach((file: ProblemFile) => {
            newExpandedFiles.add(file.filePath);
          });
          setExpandedFiles(newExpandedFiles);
        }
      }
    } catch (error) {
      console.error('Ошибка при запуске расширенной проверки:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Слушаем событие обновления диагностики Python
  useEffect(() => {
    const handlePythonDiagnosticsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.diagnostics) {
        setProblems(customEvent.detail.diagnostics);
        
        // Обновляем статистику
        let errors = 0;
        let warnings = 0;
        let infos = 0;
        
        customEvent.detail.diagnostics.forEach((file: ProblemFile) => {
          file.issues.forEach((issue: ProblemIssue) => {
            if (issue.severity === 'error') errors++;
            else if (issue.severity === 'warning') warnings++;
            else infos++;
          });
        });
        
        setStats({ errors, warnings, infos });
        
        // Автоматически разворачиваем файлы, если их немного
        if (customEvent.detail.diagnostics.length <= 5) {
          const newExpandedFiles = new Set<string>();
          customEvent.detail.diagnostics.forEach((file: ProblemFile) => {
            newExpandedFiles.add(file.filePath);
          });
          setExpandedFiles(newExpandedFiles);
        }
      }
    };
    
    document.addEventListener('python-diagnostics-updated', handlePythonDiagnosticsUpdate);
    
    // Запрашиваем начальные данные при монтировании
    if (window.getPythonDiagnostics && typeof window.getPythonDiagnostics === 'function') {
      const diagnostics = window.getPythonDiagnostics();
      if (diagnostics && Array.isArray(diagnostics)) {
        setProblems(diagnostics);
        
        // Обновляем статистику
        let errors = 0;
        let warnings = 0;
        let infos = 0;
        
        diagnostics.forEach((file: ProblemFile) => {
          file.issues.forEach((issue: ProblemIssue) => {
            if (issue.severity === 'error') errors++;
            else if (issue.severity === 'warning') warnings++;
            else infos++;
          });
        });
        
        setStats({ errors, warnings, infos });
        
        // Автоматически разворачиваем файлы, если их немного
        if (diagnostics.length <= 5) {
          const newExpandedFiles = new Set<string>();
          diagnostics.forEach((file: ProblemFile) => {
            newExpandedFiles.add(file.filePath);
          });
          setExpandedFiles(newExpandedFiles);
        }
      }
    }
    
    return () => {
      document.removeEventListener('python-diagnostics-updated', handlePythonDiagnosticsUpdate);
    };
  }, []);

  // Иконка для отображения уровня серьезности проблемы
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={8} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={8} className="text-yellow-500" />;
      default:
        return <Info size={8} className="text-blue-500" />;
    }
  };

  // Функция для усечения длинных сообщений
  const truncateMessage = (message: string, maxLength: number = 80) => {
    if (!message) return '';
    
    // Проверяем, содержит ли сообщение информацию о файле в квадратных скобках
    const fileNameMatch = message.match(/\[(.*?)\]/);
    let fileName = '';
    let cleanMessage = message;
    
    // Если есть информация о файле в формате [filename], извлекаем её
    if (fileNameMatch && fileNameMatch[1]) {
      fileName = fileNameMatch[1];
      // Удаляем имя файла из сообщения для компактности
      cleanMessage = message.replace(fileNameMatch[0], '').trim();
    }
    
    // Очищаем сообщение от лишних префиксов
    cleanMessage = cleanMessage
      .replace(/Python \[\d+(\.\d+)*\]/g, '')
      .replace(/\(pycodestyle\)/g, '')
      .replace(/\(pylint\)/g, '')
      .replace(/\(mypy\)/g, '')
      .replace(/\(pyflakes\)/g, '')
      .replace(/(^\s+|\s+$)/g, ''); // Удаляем пробелы в начале и конце
    
    // Если сообщение слишком длинное, сокращаем его
    if (cleanMessage.length > maxLength) {
      cleanMessage = cleanMessage.substring(0, maxLength - 3) + '...';
    }
    
    // Добавляем информацию о файле обратно, если она была
    if (fileName) {
      return `[${fileName}] ${cleanMessage}`;
    }
    
    return cleanMessage;
  };

  // Выключаем глобальные стили и используем только встроенные tailwind классы
  useEffect(() => {
    // Ждем рендера DOM-элементов
    setTimeout(() => {
      try {
        document.querySelectorAll('.problem-panel .issue-item').forEach(el => {
          if (el) {
            const element = el as HTMLElement;
            if (element.style) {
              element.style.height = '14px';
              element.style.maxHeight = '14px';
              element.style.minHeight = '14px';
              element.style.lineHeight = '14px';
              element.style.overflow = 'hidden';
            }
          }
        });
      } catch (error) {
        console.error('Ошибка при применении стилей к issue-item:', error);
      }
    }, 100);
  }, [problems, expandedFiles]);

  return (
    <div className="problem-panel overflow-auto h-full text-sm">
      <div className="problem-header px-2 py-1 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div className="font-medium text-xs">Проблемы</div>
          <div className="flex items-center space-x-2 text-xs">
            {stats.errors > 0 && (
              <span className="flex items-center text-red-500">
                <AlertCircle size={8} className="mr-1" />
                {stats.errors}
              </span>
            )}
            {stats.warnings > 0 && (
              <span className="flex items-center text-yellow-500">
                <AlertTriangle size={8} className="mr-1" />
                {stats.warnings}
              </span>
            )}
            <div className="flex space-x-1">
              <button 
                className="flex items-center bg-gray-700 hover:bg-gray-600 rounded px-1 py-0.5 text-xs text-gray-300"
                onClick={() => {
                  // Вызываем обновление диагностики
                  if (window.refreshAllPythonDiagnostics) {
                    window.refreshAllPythonDiagnostics().then(() => {
                      // После обновления получаем новые данные
                      if (window.getPythonDiagnostics && typeof window.getPythonDiagnostics === 'function') {
                        const diagnostics = window.getPythonDiagnostics();
                        if (diagnostics && Array.isArray(diagnostics)) {
                          setProblems(diagnostics);
                          
                          // Обновляем статистику
                          let errors = 0;
                          let warnings = 0;
                          let infos = 0;
                          
                          diagnostics.forEach((file: ProblemFile) => {
                            file.issues.forEach((issue: ProblemIssue) => {
                              if (issue.severity === 'error') errors++;
                              else if (issue.severity === 'warning') warnings++;
                              else infos++;
                            });
                          });
                          
                          setStats({ errors, warnings, infos });
                        }
                      }
                    });
                  }
                }}
                title="Обновить диагностику"
              >
                <RefreshCw size={10} className="mr-1" />
                Обновить
              </button>
              
              <button 
                className={`flex items-center rounded px-1 py-0.5 text-xs ${
                  isScanning 
                    ? 'bg-blue-600 text-white cursor-wait' 
                    : 'bg-blue-700 hover:bg-blue-600 text-gray-200'
                }`}
                onClick={runExtendedCodeScan}
                disabled={isScanning}
                title="Расширенная проверка всех типов ошибок, включая деление на ноль"
              >
                <AlertCircle size={10} className="mr-1" />
                {isScanning ? 'Проверка...' : 'Глубокая проверка'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="problem-list">
        {problems.length === 0 ? (
          <div className="py-1 px-2 text-gray-400 italic text-center text-xs">
            Нет проблем в текущем рабочем пространстве
          </div>
        ) : (
          problems.map((file) => (
            <div key={file.filePath} className="problem-file-group mb-0 border-b border-gray-800">
              <div 
                className="problem-file-header px-2 py-0 flex items-center cursor-pointer hover:bg-gray-700 text-xs bg-gray-800"
                onClick={() => toggleFileExpand(file.filePath)}
                style={{ height: '16px', maxHeight: '16px', lineHeight: '16px' }}
              >
                <span className="mr-1 flex items-center" style={{ height: '16px' }}>
                  {expandedFiles.has(file.filePath) ? 
                    <ChevronDown size={10} /> : 
                    <ChevronRight size={10} />
                  }
                </span>
                <File size={10} className="mr-1 text-blue-400" />
                <span 
                  className="truncate cursor-pointer hover:underline flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(file.filePath);
                  }}
                >
                  {file.fileName}
                </span>
                <span className="ml-1 text-gray-400 text-xs">
                  ({file.issues.length})
                </span>
              </div>
              
              {expandedFiles.has(file.filePath) && (
                <div className="problem-issues">
                  {file.issues.map((issue, index) => (
                    <div 
                      key={`${file.filePath}-issue-${index}`}
                      className="issue-item px-2 flex items-center cursor-pointer hover:bg-gray-700 text-xs border-t border-gray-800 overflow-hidden"
                      onClick={() => handleClick(file.filePath, issue.line, issue.column)}
                      title={issue.rawMessage || issue.message}
                      style={{ 
                        height: '14px !important', 
                        maxHeight: '14px !important', 
                        minHeight: '14px !important', 
                        lineHeight: '14px !important',
                        paddingTop: '0px !important',
                        paddingBottom: '0px !important',
                        marginTop: '0px !important',
                        marginBottom: '0px !important',
                        overflow: 'hidden !important',
                        display: 'flex !important',
                        alignItems: 'center !important',
                      }}
                    >
                      <span className="mr-1 flex-shrink-0" style={{ height: '14px !important', lineHeight: '14px !important' }}>
                        {getSeverityIcon(issue.severity)}
                      </span>
                      <div className="flex flex-row flex-1 overflow-hidden" style={{ height: '14px !important', lineHeight: '14px !important' }}>
                        <span className="truncate flex-1" style={{ height: '14px !important', lineHeight: '14px !important' }}>
                          {truncateMessage(issue.rawMessage || issue.message, 100)}
                        </span>
                        <span className="text-xxs text-gray-400 flex-shrink-0 ml-1" style={{ height: '14px !important', lineHeight: '14px !important' }}>
                          [{issue.line}:{issue.column}]
                          {issue.source && <span className="ml-1">[{issue.source}]</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProblemPanel; 