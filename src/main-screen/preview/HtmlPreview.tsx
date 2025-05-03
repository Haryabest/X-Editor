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
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  
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
  
  // Создает виртуальный HTML файл для предпросмотра
  const createVirtualHtmlFile = async () => {
    try {
      setIsLoading(true);
      console.log('Creating virtual HTML file for preview...');
      
      // Получаем директорию исходного файла для правильных относительных путей
      const fileDir = getDirectoryFromPath(filename);
      console.log(`File directory: ${fileDir}`);
      
      // Создаем HTML контент с базовым тегом для правильного разрешения относительных путей
      const enhancedHtml = await processHtmlContent(htmlContent);
      
      // Создаем data URL для предпросмотра
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(enhancedHtml)}`;
      console.log(`Created data URL for HTML preview, length: ${dataUrl.length}`);
      
      // Устанавливаем URL для iframe
      setUrl(dataUrl);
      
      return dataUrl;
    } catch (error) {
      console.error('Error creating virtual HTML file:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Обрабатываем HTML-контент для обеспечения правильной загрузки ресурсов
  const processHtmlContent = async (content: string): Promise<string> => {
    try {
      const baseDir = getDirectoryFromPath(filename);
      console.log(`Processing HTML content with base directory: ${baseDir}`);
      
      // Добавляем базовый тег, который указывает браузеру где искать ресурсы
      // Используем file:// протокол для прямого доступа к файловой системе
      const baseUrl = `file:///${baseDir.replace(/^\/+/, '')}/`;
      let processedContent = content;
      
      // Лимиты для предотвращения зависаний
      const MAX_CSS_FILES = 10;
      const MAX_IMAGES = 20;
      const MAX_ICONS = 5;
      
      // Извлекаем и обрабатываем все CSS ссылки в документе
      const cssLinkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g;
      const cssLinks = [];
      const cssContents = [];
      let match;
      
      // Находим все ссылки на CSS файлы (с ограничением)
      let cssCount = 0;
      while ((match = cssLinkRegex.exec(content)) !== null && cssCount < MAX_CSS_FILES) {
        const cssPath = match[1];
        const fullTag = match[0];
        cssLinks.push({ path: cssPath, tag: fullTag });
        cssCount++;
      }
      
      console.log(`Found ${cssLinks.length} CSS files, processing up to ${MAX_CSS_FILES}`);
      
      // Загружаем все CSS файлы
      const cssPromises = cssLinks.map(async (cssLink) => {
        try {
          // Определяем полный путь к CSS файлу
          let cssFullPath;
          
          // Если путь абсолютный (начинается с / или содержит :// для URL)
          if (cssLink.path.startsWith('/') || cssLink.path.includes('://')) {
            if (cssLink.path.startsWith('/')) {
              // Если начинается с /, считаем это от корня проекта
              cssFullPath = cssLink.path.substring(1);
            } else {
              // Если это внешний URL, пропускаем (не можем загрузить)
              console.warn(`Skipping external CSS URL: ${cssLink.path}`);
              return { tag: cssLink.tag, content: null };
            }
          } else {
            // Для относительных путей добавляем базовую директорию
            cssFullPath = `${baseDir}/${cssLink.path}`;
          }
          
          // Загружаем CSS файл с таймаутом
          const cssContent = await Promise.race([
            invoke<string>('read_text_file', { path: cssFullPath }),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('CSS load timeout')), 2000))
          ]);
          
          return { tag: cssLink.tag, content: cssContent };
        } catch (error) {
          console.error(`Error loading CSS file ${cssLink.path}:`, error);
          
          // Пробуем альтернативный путь (только имя файла в той же директории)
          try {
            const fileName = cssLink.path.split('/').pop();
            const alternativePath = `${baseDir}/${fileName}`;
            
            const cssContent = await Promise.race([
              invoke<string>('read_text_file', { path: alternativePath }),
              new Promise<string>((_, reject) => setTimeout(() => reject(new Error('CSS alt load timeout')), 2000))
            ]);
            
            return { tag: cssLink.tag, content: cssContent };
          } catch (altError) {
            return { tag: cssLink.tag, content: null };
          }
        }
      });
      
      // Обрабатываем CSS параллельно с таймаутом
      const cssResults = await Promise.all(cssPromises);
      
      // Заменяем CSS ссылки на встроенные стили
      for (const css of cssResults) {
        if (css.content) {
          // Создаем встроенный стиль вместо ссылки
          const inlineStyle = `<style>/* From ${css.tag} */\n${css.content}\n</style>`;
          processedContent = processedContent.replace(css.tag, inlineStyle);
        }
      }
      
      // Ускоренная стратегия для изображений - вместо замены на data URL, просто исправляем пути
      // Извлекаем img теги
      const imgTags = [];
      const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/g;
      let imgCount = 0;
      
      // Сбрасываем lastIndex регулярного выражения
      imgRegex.lastIndex = 0;
      
      while ((match = imgRegex.exec(content)) !== null && imgCount < MAX_IMAGES) {
        const imgPath = match[1];
        const fullTag = match[0];
        
        if (!imgPath.startsWith('data:') && !imgPath.includes('://')) {
          imgTags.push({ path: imgPath, tag: fullTag });
          imgCount++;
        }
      }
      
      console.log(`Found ${imgTags.length} images, fixing paths instead of loading content`);
      
      // Исправляем пути для изображений вместо загрузки содержимого
      for (const img of imgTags) {
        let fullPath;
        
        if (img.path.startsWith('/')) {
          fullPath = `file:///${img.path.substring(1)}`;
        } else {
          fullPath = `${baseUrl}${img.path}`;
        }
        
        const newTag = img.tag.replace(img.path, fullPath);
        processedContent = processedContent.replace(img.tag, newTag);
      }
      
      // Добавляем базовый тег в head
      if (processedContent.includes('<head>')) {
        processedContent = processedContent.replace(/<head>/i, `<head>\n<base href="${baseUrl}">\n`);
      } else if (processedContent.includes('<html>')) {
        processedContent = processedContent.replace(/<html>/i, `<html>\n<head>\n<base href="${baseUrl}">\n</head>\n`);
      } else {
        processedContent = `<head>\n<base href="${baseUrl}">\n</head>\n${processedContent}`;
      }
      
      // Добавляем специальный скрипт для обработки ошибок загрузки и исправления путей
      const helperScript = `
      <script>
        // Обработчик ошибок загрузки ресурсов
        window.addEventListener('error', function(e) {
          if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT')) {
            console.error('Ошибка загрузки ресурса:', e.target.src || e.target.href);
          }
        }, true);
        
        // Функция для преобразования относительных путей в абсолютные file:// URLs
        function fixRelativePaths() {
          // Исправление для background-image в стилях
          const elementsWithBackgroundImage = document.querySelectorAll('*[style*="background-image"]');
          elementsWithBackgroundImage.forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('url(') && !style.includes('data:') && !style.includes('://')) {
              const newStyle = style.replace(/url\\(['"]?([^'"\\)]+)['"]?\\)/g, function(match, url) {
                if (!url.includes('://') && !url.startsWith('data:')) {
                  return 'url("' + document.baseURI + url + '")';
                }
                return match;
              });
              el.setAttribute('style', newStyle);
            }
          });
        }
        
        // Вызываем функцию после загрузки страницы
        window.addEventListener('DOMContentLoaded', fixRelativePaths);
      </script>`;
      
      // Добавляем скрипт в конец body или в конец документа
      if (processedContent.includes('</body>')) {
        processedContent = processedContent.replace('</body>', `${helperScript}\n</body>`);
      } else {
        processedContent += `\n${helperScript}`;
      }
      
      console.log(`Processed HTML content successfully with optimized strategy`);
      setProcessedHtml(processedContent);
      return processedContent;
    } catch (error) {
      console.error("Error in processHtmlContent:", error);
      // В случае ошибки возвращаем исходный контент с базовым тегом
      const baseDir = getDirectoryFromPath(filename);
      const baseUrl = `file:///${baseDir.replace(/^\/+/, '')}/`;
      const safeContent = `
        <html>
        <head>
          <base href="${baseUrl}">
          <style>
            body { font-family: sans-serif; color: #333; padding: 20px; }
            .error { color: red; padding: 10px; border: 1px solid red; background: #fff0f0; }
          </style>
        </head>
        <body>
          <h1>Ошибка обработки HTML</h1>
          <div class="error">Произошла ошибка при обработке HTML. Показан исходный файл.</div>
          <hr>
          <iframe src="${baseUrl}${filename.split(/[/\\]/).pop()}" style="width:100%;height:80vh;border:1px solid #ccc;"></iframe>
        </body>
        </html>
      `;
      return safeContent;
    }
  };
  
  // Функция для обновления предпросмотра
  const updateIframeContent = async () => {
    try {
      setIsLoading(true);
      console.log('Updating HTML preview...');
      
      const previewUrl = await createVirtualHtmlFile();
      if (!previewUrl || !iframeRef.current) {
        console.error('Failed to create preview URL or iframe reference is missing');
        return;
      }
      
      const iframe = iframeRef.current;
      
      // Устанавливаем обработчик загрузки iframe
        iframe.onload = () => {
        console.log('iframe loaded successfully');
          setIsLoading(false);
          
        // Добавляем текущий URL в историю браузера
          if (currentHistoryIndex === history.length - 1 || history.length === 0) {
          setHistory(prev => [...prev, previewUrl]);
            setCurrentHistoryIndex(prev => prev + 1);
          }
        };
      
      // Устанавливаем URL для iframe
      iframe.src = previewUrl;
    } catch (error) {
      console.error('Error updating iframe content:', error);
      setIsLoading(false);
    }
  };
  
  // Навигация назад
  const goBack = () => {
    if (currentHistoryIndex > 0 && iframeRef.current) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      const previousUrl = history[newIndex];
      iframeRef.current.src = previousUrl;
    }
  };
  
  // Навигация вперед
  const goForward = () => {
    if (currentHistoryIndex < history.length - 1 && iframeRef.current) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      const nextUrl = history[newIndex];
      iframeRef.current.src = nextUrl;
    }
  };
  
  // Обработчик нажатия Enter в адресной строке
  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && iframeRef.current) {
      try {
        // Проверяем, является ли URL локальным или внешним
        const inputUrl = url.trim();
        if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
          // Для безопасности внешние URL ограничиваем
          alert('Внешние URL не поддерживаются в предпросмотре');
          return;
        }
        
        // Загружаем введенный URL
        iframeRef.current.src = inputUrl;
        
        // Добавляем в историю
        setHistory(prev => [...prev.slice(0, currentHistoryIndex + 1), inputUrl]);
        setCurrentHistoryIndex(prev => prev + 1);
      } catch (error) {
        console.error('Error navigating to URL:', error);
      }
    }
  };
  
  // Обновляем содержимое при изменении HTML или видимости
  useEffect(() => {
    if (isVisible && htmlContent) {
      updateIframeContent();
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
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
};

export default HtmlPreview; 