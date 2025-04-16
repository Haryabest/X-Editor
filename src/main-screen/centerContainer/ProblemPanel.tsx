import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Info, File } from 'lucide-react';

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
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  };

  return (
    <div className="problem-panel overflow-auto h-full text-sm">
      <style jsx>{`
        .problem-issue {
          min-height: 10px !important;
          max-height: 20px !important;
          line-height: 10px !important;
          padding-top: 1px !important;
          padding-bottom: 1px !important;
        }
        .problem-message {
          line-height: 10px !important;
          max-height: 10px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-size: 10px !important;
        }
        .problem-location {
          font-size: 8px !important;
          line-height: 8px !important;
        }
        .problem-file-header {
          min-height: 14px !important;
          max-height: 14px !important;
          padding-top: 1px !important;
          padding-bottom: 1px !important;
        }
      `}</style>
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
          </div>
        </div>
      </div>

      <div className="problem-list">
        {problems.length === 0 ? (
          <div className="py-2 px-2 text-gray-400 italic text-center text-xs">
            Нет проблем в текущем рабочем пространстве
          </div>
        ) : (
          problems.map((file) => (
            <div key={file.filePath} className="problem-file-group mb-1 border-b border-gray-800">
              <div 
                className="problem-file-header px-2 py-1 flex items-center cursor-pointer hover:bg-gray-700 text-xs bg-gray-800"
                onClick={() => toggleFileExpand(file.filePath)}
              >
                <span className="mr-1">
                  {expandedFiles.has(file.filePath) ? 
                    <ChevronDown size={12} /> : 
                    <ChevronRight size={12} />
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
                      className="problem-issue px-4 py-1 flex items-center cursor-pointer hover:bg-gray-700 text-xs border-t border-gray-800"
                      onClick={() => handleClick(file.filePath, issue.line, issue.column)}
                      title={issue.rawMessage || issue.message}
                    >
                      <span className="mr-2 flex-shrink-0">
                        {getSeverityIcon(issue.severity)}
                      </span>
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="problem-message whitespace-nowrap text-ellipsis overflow-hidden">
                          {truncateMessage(issue.rawMessage || issue.message, 100)}
                        </span>
                        <span className="problem-location text-xxs text-gray-400 flex items-center">
                          <span className="font-bold mr-1">{file.fileName}</span>
                          <span>[{issue.line}:{issue.column}]</span>
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