import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ImageViewerProps {
  filePath: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ filePath, onLoad, onError }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string>('');

  // Определяем MIME тип на основе расширения файла
  const getMimeType = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      case 'bmp':
        return 'image/bmp';
      case 'ico':
        return 'image/x-icon';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      default:
        return 'image/png'; // Используем PNG как формат по умолчанию
    }
  };

  useEffect(() => {
    if (!filePath) {
      setError('Путь к файлу не указан');
      setLoading(false);
      return;
    }

    const loadImage = async () => {
      setLoading(true);
      setError(null);
      setImageSrc(null);
      
      const mimeType = getMimeType(filePath);
      console.log(`ImageViewer: Loading image from: ${filePath} (${mimeType})`);

      // Для SVG файлов попробуем сначала загрузить как текст
      if (filePath.toLowerCase().endsWith('.svg')) {
        try {
          console.log(`Loading SVG file as text: ${filePath}`);
          const svgContent = await invoke<string>('read_text_file', { path: filePath });
          
          if (svgContent && svgContent.trim().startsWith('<svg')) {
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
            console.log(`SVG loaded successfully as text, length: ${dataUrl.length}`);
            setImageSrc(dataUrl);
            setMethod('svg-text');
            setLoading(false);
            onLoad?.();
            return;
          } else {
            console.warn('SVG content appears invalid, trying binary methods');
          }
        } catch (err) {
          console.error('Failed to load SVG as text:', err);
        }
      }

      // Специальная обработка для ICO и BMP файлов
      if (filePath.toLowerCase().endsWith('.ico') || filePath.toLowerCase().endsWith('.bmp')) {
        console.log(`Special handling for ${filePath.toLowerCase().endsWith('.ico') ? 'ICO' : 'BMP'} file`);
        
        // Попробуем напрямую использовать как URL
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        setImageSrc(fileUrl);
        setMethod('direct-file');
        setLoading(false);
        
        // Обратите внимание, что проверка успешной загрузки произойдет в компоненте при событии onError
        return;
      }

      // Метод 1: Использование нашей Rust-функции load_image_as_base64
      try {
        console.log(`Method 1: Using load_image_as_base64 for ${filePath}`);
        const base64Data = await invoke<string>('load_image_as_base64', { path: filePath });
        if (base64Data && base64Data.startsWith('data:')) {
          console.log(`Method 1: Success! Data length: ${base64Data.length}`);
          setImageSrc(base64Data);
          setMethod('rust-base64');
          setLoading(false);
          onLoad?.();
          return;
        } else {
          console.warn('Method 1: Received invalid data');
        }
      } catch (err) {
        console.error('Method 1 failed:', err);
      }

      // Метод 2: Использование обычного read_binary_file через invoke
      try {
        console.log(`Method 2: Using read_binary_file for ${filePath}`);
        const binaryData: Uint8Array = await invoke('read_binary_file', { path: filePath });
        
        if (binaryData && binaryData.length > 0) {
          // Конвертируем Uint8Array в base64
          let binaryString = '';
          for (let i = 0; i < binaryData.length; i++) {
            binaryString += String.fromCharCode(binaryData[i]);
          }
          
          const base64String = btoa(binaryString);
          const dataUrl = `data:${mimeType};base64,${base64String}`;
          
          console.log(`Method 2: Success! Data length: ${dataUrl.length}`);
          setImageSrc(dataUrl);
          setMethod('read-binary');
          setLoading(false);
          onLoad?.();
          return;
        } else {
          console.warn('Method 2: Received empty data');
        }
      } catch (err) {
        console.error('Method 2 failed:', err);
      }

      // Метод 3: Использование прямого URL файла
      try {
        console.log(`Method 3: Using direct file URL for ${filePath}`);
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        setImageSrc(fileUrl);
        setMethod('file-url');
        setLoading(false);
        // Обратите внимание, что успех этого метода мы узнаем только при загрузке изображения
        return;
      } catch (err) {
        console.error('Method 3 failed:', err);
      }

      // Если все методы не сработали
      const errorMsg = 'Не удалось загрузить изображение ни одним из методов';
      setError(errorMsg);
      setLoading(false);
      onError?.(errorMsg);
    };

    loadImage();
  }, [filePath]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    background: '#1e1e1e',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  };

  const imageStyle: React.CSSProperties = {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
  };

  const methodBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#fff',
  };

  // Стиль для анимированного индикатора загрузки
  const loaderStyle: React.CSSProperties = {
    width: '50px',
    height: '50px',
    border: '5px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    borderTop: '5px solid #ffffff',
    animation: 'spin 1s linear infinite',
  };

  return (
    <div style={containerStyle}>
      {loading ? (
        <div style={{ textAlign: 'center' }}>
          <div style={loaderStyle}></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <div style={{ marginTop: '10px' }}>Загрузка изображения...</div>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
          
          {/* Запасной метод для нестандартных форматов - использование object тега */}
          <object
            data={`file://${filePath.replace(/\\/g, '/')}`}
            type={getMimeType(filePath)}
            style={{ 
              maxWidth: '90%', 
              maxHeight: '80%',
              border: '1px dashed rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px'
            }}
          >
            <div>Формат не поддерживается браузером</div>
          </object>
        </div>
      ) : imageSrc ? (
        <>
          <img
            src={imageSrc}
            alt="Image Preview"
            style={imageStyle}
            onLoad={() => {
              console.log(`Image loaded successfully with method: ${method}`);
              onLoad?.();
            }}
            onError={(e) => {
              console.error(`Error loading image with method ${method}:`, e);
              setError(`Ошибка загрузки изображения методом ${method}`);
              onError?.(`Ошибка загрузки изображения методом ${method}`);
            }}
          />
          <div style={methodBadgeStyle}>
            {method}
          </div>
        </>
      ) : (
        <div>Не удалось загрузить изображение</div>
      )}
    </div>
  );
};

export default ImageViewer; 