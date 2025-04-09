import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './HtmlPreview.css';

interface HtmlPreviewProps {
  htmlContent: string;
  isVisible: boolean;
  filename?: string;
  onClose?: () => void;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ 
  htmlContent, 
  isVisible, 
  filename = 'preview.html',
  onClose 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [url, setUrl] = useState(`http://localhost/${filename.split(/[/\\]/).pop()}`);
  const [processedHtml, setProcessedHtml] = useState<string>(htmlContent);
  
  // Helper function to normalize file paths
  const normalizePath = (path: string): string => {
    return path.replace(/\\/g, '/');
  };
  
  // Helper function to extract the directory from a file path
  const getDirectoryFromPath = (filePath: string): string => {
    const normalizedPath = normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    return lastSlashIndex !== -1 ? normalizedPath.substring(0, lastSlashIndex) : '';
  };
  
  // Helper function to resolve a CSS path relative to the HTML file
  const resolveCssPath = (cssPath: string, htmlFilePath: string): string => {
    const htmlDir = getDirectoryFromPath(htmlFilePath);
    
    // If the CSS path is relative (doesn't start with / or http)
    if (!cssPath.startsWith('/') && !cssPath.startsWith('http')) {
      // Join the HTML directory with the CSS path
      return normalizePath(`${htmlDir}/${cssPath}`);
    } else if (cssPath.startsWith('/')) {
      // For paths starting with /, make them relative to the project root
      return cssPath.substring(1);
    }
    
    // For http URLs, return as-is
    return cssPath;
  };
  
  // Функция для обработки содержимого HTML и встраивания внешних CSS
  const processHtmlContent = async (content: string) => {
    try {
      setIsLoading(true);
      
      // Получаем короткое имя файла для отображения
      const shortFilename = filename.split(/[/\\]/).pop() || 'preview.html';
      console.log(`Processing HTML content for file: ${filename}`);
      
      // Извлекаем ссылки на CSS файлы
      const cssLinkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g;
      let match;
      let processedContent = content;
      
      // Создаем массив промисов для загрузки CSS
      const cssPromises = [];
      const cssLinks = [];
      
      while ((match = cssLinkRegex.exec(content)) !== null) {
        const cssPath = match[1];
        cssLinks.push(match[0]); // Сохраняем полный тег link
        
        // Получаем полный путь к CSS файлу
        const fullCssPath = resolveCssPath(cssPath, filename);
        console.log(`CSS file detected: ${cssPath} -> resolved to: ${fullCssPath}`);
        
        // Создаем промис для загрузки файла CSS
        const cssPromise = invoke('read_text_file', { 
          path: fullCssPath 
        }).then((cssContent: unknown) => {
          console.log(`Successfully loaded CSS file: ${fullCssPath}`);
          return { path: cssPath, content: cssContent as string };
        }).catch(error => {
          console.error(`Ошибка загрузки CSS файла ${fullCssPath}:`, error);
          
          // Пытаемся с абсолютным путем из директории HTML
          const htmlDir = getDirectoryFromPath(filename);
          const absoluteCssPath = normalizePath(`${htmlDir}/${cssPath.split(/[/\\]/).pop()}`);
          console.log(`Trying absolute CSS path: ${absoluteCssPath}`);
          
          return invoke('read_text_file', { path: absoluteCssPath })
            .then((cssContent: unknown) => {
              console.log(`Successfully loaded CSS from absolute path: ${absoluteCssPath}`);
              return { path: cssPath, content: cssContent as string };
            })
            .catch(altError => {
              console.error(`Also failed with absolute path: ${absoluteCssPath}`, altError);
              return { path: cssPath, content: '' };
            });
        });
        
        cssPromises.push(cssPromise);
      }
      
      // Извлекаем ссылки на JavaScript файлы
      const jsScriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
      const jsPromises = [];
      const jsScripts = [];
      
      while ((match = jsScriptRegex.exec(content)) !== null) {
        const jsPath = match[1];
        jsScripts.push(match[0]); // Сохраняем полный тег script
        
        // Получаем полный путь к JS файлу (аналогично CSS)
        const fullJsPath = resolveCssPath(jsPath, filename); // Используем ту же функцию для путей
        console.log(`JavaScript file detected: ${jsPath} -> resolved to: ${fullJsPath}`);
        
        // Создаем промис для загрузки файла JavaScript
        const jsPromise = invoke('read_text_file', { 
          path: fullJsPath 
        }).then((jsContent: unknown) => {
          console.log(`Successfully loaded JavaScript file: ${fullJsPath}`);
          return { path: jsPath, content: jsContent as string };
        }).catch(error => {
          console.error(`Ошибка загрузки JavaScript файла ${fullJsPath}:`, error);
          
          // Пытаемся с абсолютным путем из директории HTML
          const htmlDir = getDirectoryFromPath(filename);
          const absoluteJsPath = normalizePath(`${htmlDir}/${jsPath.split(/[/\\]/).pop()}`);
          console.log(`Trying absolute JavaScript path: ${absoluteJsPath}`);
          
          return invoke('read_text_file', { path: absoluteJsPath })
            .then((jsContent: unknown) => {
              console.log(`Successfully loaded JavaScript from absolute path: ${absoluteJsPath}`);
              return { path: jsPath, content: jsContent as string };
            })
            .catch(altError => {
              console.error(`Also failed with absolute path for JS: ${absoluteJsPath}`, altError);
              return { path: jsPath, content: '' };
            });
        });
        
        jsPromises.push(jsPromise);
      }
      
      // Ждем загрузки всех CSS файлов
      const cssResults = await Promise.all(cssPromises);
      
      // Заменяем ссылки на CSS встроенными стилями
      for (let i = 0; i < cssLinks.length; i++) {
        const cssLink = cssLinks[i];
        const cssResult = cssResults[i];
        
        if (cssResult.content) {
          const inlineStyle = `<style data-href="${cssResult.path}">\n${cssResult.content}\n</style>`;
          processedContent = processedContent.replace(cssLink, inlineStyle);
        }
      }
      
      // Ждем загрузки всех JavaScript файлов
      const jsResults = await Promise.all(jsPromises);
      
      // Заменяем ссылки на JavaScript встроенными скриптами
      for (let i = 0; i < jsScripts.length; i++) {
        const jsScript = jsScripts[i];
        const jsResult = jsResults[i];
        
        if (jsResult.content) {
          const inlineScript = `<script data-src="${jsResult.path}">\n${jsResult.content}\n</script>`;
          processedContent = processedContent.replace(jsScript, inlineScript);
        }
      }
      
      // Добавляем базовый URL для относительных путей изображений и других ресурсов
      const htmlDir = getDirectoryFromPath(filename);
      const baseUrl = htmlDir ? `${htmlDir}/` : '/';
      const baseTag = `<base href="${baseUrl}" />`;
      
      if (processedContent.includes('<head>')) {
        processedContent = processedContent.replace(/<head>/i, `<head>\n  ${baseTag}`);
      } else if (processedContent.includes('<html>')) {
        processedContent = processedContent.replace(/<html>/i, `<html>\n<head>\n  ${baseTag}\n</head>`);
      } else {
        processedContent = `<head>\n  ${baseTag}\n</head>\n${processedContent}`;
      }
      
      console.log('HTML processing complete with base URL:', baseUrl);
      setProcessedHtml(processedContent);
      return processedContent;
    } catch (error) {
      console.error('Ошибка обработки HTML:', error);
      return content;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция для обновления содержимого iframe
  const updateIframeContent = async () => {
    if (!iframeRef.current) return;
    
    setIsLoading(true);
    
    try {
      // Обрабатываем HTML для включения CSS
      const contentToRender = await processHtmlContent(htmlContent);
      
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(contentToRender);
        iframeDoc.close();
        
        // После полной загрузки убираем индикатор загрузки
        iframe.onload = () => {
          setIsLoading(false);
          
          // Add current content to history if not navigating through history
          if (currentHistoryIndex === history.length - 1 || history.length === 0) {
            setHistory(prev => [...prev, contentToRender]);
            setCurrentHistoryIndex(prev => prev + 1);
          }
        };
      }
    } catch (error) {
      console.error('Ошибка обновления предпросмотра HTML:', error);
      setIsLoading(false);
    }
  };
  
  // Навигация назад
  const goBack = () => {
    if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(prev => prev - 1);
      
      // Загружаем предыдущее состояние из истории, без добавления нового элемента в историю
      const previousContent = history[currentHistoryIndex - 1];
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(previousContent);
          iframeDoc.close();
        }
      }
    }
  };
  
  // Навигация вперед
  const goForward = () => {
    if (currentHistoryIndex < history.length - 1) {
      setCurrentHistoryIndex(prev => prev + 1);
      
      // Загружаем следующее состояние из истории
      const nextContent = history[currentHistoryIndex + 1];
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(nextContent);
          iframeDoc.close();
        }
      }
    }
  };
  
  // Обработчик нажатия Enter в адресной строке
  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // В реальном приложении здесь был бы запрос к серверу
      // В нашем случае просто обновляем текущий контент
      updateIframeContent();
    }
  };
  
  // Обновляем содержимое при изменении HTML или видимости
  useEffect(() => {
    if (isVisible && htmlContent) {
      updateIframeContent();
      // Обновляем URL в адресной строке (показываем только короткое имя файла)
      const shortFilename = filename.split(/[/\\]/).pop() || 'preview.html';
      setUrl(`http://localhost/${shortFilename}`);
    }
  }, [htmlContent, isVisible, filename]);
  
  // Если компонент не видим, не рендерим его содержимое
  if (!isVisible) return null;
  
  return (
    <div className="html-preview-container">
      <div className="html-preview-header">
        <div className="html-preview-title">
          Предпросмотр: {filename.split(/[/\\]/).pop()}
        </div>
        <div className="html-preview-controls">
          <button 
            className="html-preview-refresh-btn" 
            onClick={updateIframeContent} 
            title="Обновить предпросмотр"
          >
            🔄
          </button>
          <button 
            className="html-preview-close-btn" 
            onClick={onClose} 
            title="Закрыть предпросмотр"
          >
            ✖
          </button>
        </div>
      </div>
      
      <div className="html-preview-browser-controls">
        <div className="browser-navigation-buttons">
          <button 
            className="browser-back-btn" 
            onClick={goBack}
            disabled={currentHistoryIndex <= 0}
            title="Назад"
          >
            ←
          </button>
          <button 
            className="browser-forward-btn" 
            onClick={goForward}
            disabled={currentHistoryIndex >= history.length - 1}
            title="Вперед"
          >
            →
          </button>
          <button 
            className="browser-refresh-btn" 
            onClick={updateIframeContent}
            title="Обновить"
          >
            ↻
          </button>
        </div>
        <input 
          type="text" 
          className="browser-url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleUrlKeyDown}
        />
      </div>
      
      <div className="html-preview-content">
        {isLoading && (
          <div className="html-preview-loading">
            Загрузка...
          </div>
        )}
        <iframe 
          ref={iframeRef}
          className="html-preview-iframe"
          title="HTML Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        />
      </div>
    </div>
  );
};

export default HtmlPreview; 