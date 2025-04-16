import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ProblemIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source?: string;
  code?: string;
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
        return <AlertCircle size={10} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={10} className="text-yellow-500" />;
      default:
        return <Info size={10} className="text-blue-500" />;
    }
  };

  // Функция для усечения длинных сообщений
  const truncateMessage = (message: string, maxLength: number = 80) => {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  };

  return (
    <div className="problem-panel overflow-auto h-full text-sm">
      <div className="problem-header px-2 py-1 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div className="font-medium text-xs">Проблемы</div>
          <div className="flex items-center space-x-2 text-xs">
            {stats.errors > 0 && (
              <span className="flex items-center text-red-500">
                <AlertCircle size={10} className="mr-1" />
                {stats.errors}
              </span>
            )}
            {stats.warnings > 0 && (
              <span className="flex items-center text-yellow-500">
                <AlertTriangle size={10} className="mr-1" />
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
            <div key={file.filePath} className="problem-file-group">
              <div 
                className="problem-file-header px-2 py-0.5 flex items-center cursor-pointer hover:bg-gray-700 text-xs"
                onClick={() => toggleFileExpand(file.filePath)}
              >
                <span className="mr-1">
                  {expandedFiles.has(file.filePath) ? 
                    <ChevronDown size={14} /> : 
                    <ChevronRight size={14} />
                  }
                </span>
                <span 
                  className="truncate cursor-pointer hover:underline"
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
                      className="problem-issue px-4 py-0.5 flex items-start cursor-pointer hover:bg-gray-700 text-xs"
                      onClick={() => handleClick(file.filePath, issue.line, issue.column)}
                      title={issue.message}
                    >
                      <span className="mr-1 mt-0.5 flex-shrink-0">
                        {getSeverityIcon(issue.severity)}
                      </span>
                      <div className="flex flex-col">
                        <span className="problem-message truncate max-w-xs">
                          {truncateMessage(issue.message, 80)}
                        </span>
                        <span className="problem-location text-xxs text-gray-400">
                          [{issue.line}:{issue.column}]
                          {issue.source && ` ${issue.source}`}
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