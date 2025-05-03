import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface VideoPlayerProps {
  filePath: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ filePath, onLoad, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string>('');
  const [playerState, setPlayerState] = useState({
    playing: false,
    muted: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    fullscreen: false,
    playbackRate: 1.0,
    seeking: false
  });

  // Создание иконок для плеера
  const playIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
  
  const pauseIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
  
  const muteIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
  
  const volumeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
  
  const fullscreenIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );

  // Определяем MIME тип на основе расширения файла
  const getMimeType = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'avi':
        return 'video/x-msvideo';
      case 'mov':
        return 'video/quicktime';
      case 'mkv':
        return 'video/x-matroska';
      default:
        return 'video/mp4'; // Используем MP4 как формат по умолчанию
    }
  };

  useEffect(() => {
    if (!filePath) {
      setError('Путь к файлу не указан');
      setLoading(false);
      return;
    }

    const loadVideo = async () => {
      setLoading(true);
      setError(null);
      setVideoUrl(null);
      
      const mimeType = getMimeType(filePath);
      console.log(`VideoPlayer: Loading video from: ${filePath} (${mimeType})`);

      // Метод 1: Виртуальный HTML файл (наиболее совместимый метод)
      try {
        console.log(`Method 1: Creating virtual HTML for ${filePath}`);
        const virtualHtmlUrl = await createVirtualVideoFile();
        
        if (virtualHtmlUrl) {
          console.log(`Method 1: Created virtual HTML player`);
          setVideoUrl(virtualHtmlUrl);
          setMethod('virtual-html');
          setLoading(false);
          return;
        } else {
          console.warn('Method 1: Failed to create virtual HTML');
        }
      } catch (err) {
        console.error('Method 1 failed:', err);
      }

      // Метод 2: Предпочтительный метод - создание Blob URL из данных файла (запасной)
      try {
        console.log(`Method 2: Creating Blob URL from file data for ${filePath}`);
        const binaryData = await invoke<Uint8Array>('read_binary_file', { path: filePath }).catch(() => null);
        
        if (binaryData && binaryData.length > 0) {
          console.log(`Method 2: Received ${binaryData.length} bytes of data`);
          
          // Создаем blob из бинарных данных с правильным типом MIME
          const blob = new Blob([binaryData], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          
          console.log(`Method 2: Created Blob URL: ${blobUrl}`);
          setVideoUrl(blobUrl);
          setMethod('blob-url');
          setLoading(false);
          return;
        } else {
          console.warn('Method 2: Received empty data');
        }
      } catch (err) {
        console.error('Method 2 failed:', err);
      }

      // Метод 3: База64 кодирование и data URL (запасной)
      try {
        console.log(`Method 3: Using base64 encoding for ${filePath}`);
        const base64Data = await invoke<string>('load_image_as_base64', { path: filePath }).catch(() => null);
        
        if (base64Data && base64Data.startsWith('data:')) {
          console.log(`Method 3: Success! URL length: ${base64Data.length}`);
          setVideoUrl(base64Data);
          setMethod('base64-data');
          setLoading(false);
          return;
        } else {
          console.warn('Method 3: Received invalid data');
        }
      } catch (err) {
        console.error('Method 3 failed:', err);
      }

      // Метод 4: Через абсолютный file:// URL (запасной)
      try {
        console.log(`Method 4: Using proper file:// URL for ${filePath}`);
        // Корректно форматируем URL для Windows путей (тройной слеш в начале)
        const fileUrl = `file:///${filePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
        console.log(`Method 4: Generated URL: ${fileUrl}`);
        setVideoUrl(fileUrl);
        setMethod('file-url');
        setLoading(false);
        return;
      } catch (err) {
        console.error('Method 4 failed:', err);
      }

      // Если все методы не сработали
      const errorMsg = 'Не удалось загрузить видео ни одним из методов';
      setError(errorMsg);
      setLoading(false);
      onError?.(errorMsg);
    };

    loadVideo();
  }, [filePath]);

  // Освобождаем ресурсы при размонтировании компонента
  useEffect(() => {
    return () => {
      // Освобождаем URL объекты, созданные через URL.createObjectURL
      if (videoUrl && method === 'blob-url') {
        URL.revokeObjectURL(videoUrl);
        console.log('Revoked Blob URL on component unmount');
      }
    };
  }, [videoUrl, method]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Обработчики событий видео
  const handlePlay = () => {
    if (videoRef.current) {
      if (playerState.playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = value;
      setPlayerState(prev => ({ ...prev, volume: value }));
    }
  };

  const handleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !playerState.muted;
      setPlayerState(prev => ({ ...prev, muted: !prev.muted }));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !playerState.seeking) {
      setPlayerState(prev => ({ 
        ...prev, 
        currentTime: videoRef.current!.currentTime,
        buffered: videoRef.current!.buffered.length > 0 
          ? videoRef.current!.buffered.end(videoRef.current!.buffered.length - 1) 
          : 0
      }));
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setPlayerState(prev => ({ ...prev, duration: videoRef.current!.duration }));
    }
  };

  const handleProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && videoRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = offsetX / width;
      const seekTime = percentage * playerState.duration;
      
      videoRef.current.currentTime = seekTime;
      setPlayerState(prev => ({ ...prev, currentTime: seekTime }));
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error(`Ошибка перехода в полноэкранный режим: ${err}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlayerState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  // Обработчик события загрузки видео
  const handleVideoLoaded = () => {
    console.log(`Video loaded successfully with method: ${method}`);
    onLoad?.();
  };

  // Обработчик ошибки загрузки видео
  const handleVideoError = () => {
    const errorMsg = `Ошибка загрузки видео методом ${method}`;
    console.error(errorMsg);
    setError(errorMsg);
    onError?.(errorMsg);
  };

  const handleSeekStart = () => {
    setPlayerState(prev => ({ ...prev, seeking: true }));
  };

  const handleSeekEnd = () => {
    setPlayerState(prev => ({ ...prev, seeking: false }));
  };

  // Обновляем состояние проигрывания при изменении воспроизведения
  const handlePlayStateChange = () => {
    if (videoRef.current) {
      setPlayerState(prev => ({ ...prev, playing: !videoRef.current!.paused }));
    }
  };

  // Функция для создания виртуального HTML-файла с видео
  const createVirtualVideoFile = async () => {
    const mimeType = getMimeType(filePath);
    
    // Загружаем бинарные данные видео
    const binaryData = await invoke<Uint8Array>('read_binary_file', { path: filePath }).catch(() => null);
    
    if (!binaryData || binaryData.length === 0) {
      console.error('Failed to load binary data for virtual HTML');
      return null;
    }
    
    // Конвертируем в Base64
    let binaryString = '';
    for (let i = 0; i < binaryData.length; i++) {
      binaryString += String.fromCharCode(binaryData[i]);
    }
    
    const base64String = btoa(binaryString);
    const dataUrl = `data:${mimeType};base64,${base64String}`;
    
    // Создаем HTML-контент
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Video Player</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          video {
            max-width: 100%;
            max-height: 100vh;
          }
        </style>
      </head>
      <body>
        <video controls autoplay>
          <source src="${dataUrl}" type="${mimeType}">
          Your browser does not support the video tag.
        </video>
        <script>
          // Автоматически начинаем воспроизведение, когда видео загружено
          document.querySelector('video').addEventListener('loadeddata', function() {
            this.play();
          });
        </script>
      </body>
      </html>
    `;
    
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  };

  // Стили для компонентов
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

  const videoContainerStyle: React.CSSProperties = {
    width: '80%',
    height: '70%',
    maxWidth: '1280px',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000',
  };

  const controlsContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '80%',
    maxWidth: '1280px',
    padding: '10px',
    background: 'rgba(28, 28, 28, 0.8)',
    borderRadius: '8px',
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  };

  const progressBarContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '100%',
    width: `${(playerState.currentTime / playerState.duration) * 100 || 0}%`,
    background: '#3498db',
    borderRadius: '4px',
    position: 'absolute',
    top: 0,
    left: 0,
  };

  const bufferedBarStyle: React.CSSProperties = {
    height: '100%',
    width: `${(playerState.buffered / playerState.duration) * 100 || 0}%`,
    background: 'rgba(255, 255, 255, 0.4)',
    borderRadius: '4px',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: '5px',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: '#333',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const timeDisplayStyle: React.CSSProperties = {
    marginLeft: '10px',
    fontSize: '14px',
  };

  const volumeControlStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  };

  const rangeStyle: React.CSSProperties = {
    width: '80px',
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
    zIndex: 10,
  };

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
          <div style={{ marginTop: '10px' }}>Загрузка видео...</div>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
          
          <div style={{ width: '80%', marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button 
              style={{
                ...buttonStyle,
                flex: 1,
                padding: '15px',
                background: '#553c9a'
              }}
              onClick={async () => {
                try {
                  // Создаем HTML страницу со встроенным видео
                  const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <title>Воспроизведение видео</title>
                      <style>
                        body { margin: 0; padding: 0; background: #000; overflow: hidden; }
                        video { width: 100%; height: 100vh; }
                      </style>
                    </head>
                    <body>
                      <video controls autoplay>
                        <source src="file:///${filePath.replace(/\\/g, '/').replace(/^\/+/, '')}" type="${getMimeType(filePath)}">
                        Ваш браузер не поддерживает тег video.
                      </video>
                    </body>
                    </html>
                  `;
                  
                  // Создаем временный файл HTML
                  const tempDir = await invoke<string>('get_temp_dir').catch(() => {
                    // Если функция недоступна, используем системный temp
                    return `${filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'))}/temp`;
                  });
                  
                  const tempFilePath = `${tempDir}/video_player_${Date.now()}.html`;
                  await invoke('write_text_file', { 
                    path: tempFilePath,
                    content: htmlContent
                  });
                  
                  // Открываем файл во внешнем браузере
                  await invoke('open_file', { path: tempFilePath });
                  
                  console.log('Opened video in external player');
                } catch (err) {
                  console.error('Failed to open video in external player:', err);
                }
              }}
            >
              Открыть во внешнем плеере
            </button>
            
            <button 
              style={{
                ...buttonStyle,
                flex: 1,
                padding: '15px',
                background: '#2c5282'
              }}
              onClick={async () => {
                try {
                  // Создаем виртуальный HTML-файл с видео
                  setLoading(true);
                  const virtualHtmlUrl = await createVirtualVideoFile();
                  
                  if (virtualHtmlUrl) {
                    setVideoUrl(virtualHtmlUrl);
                    setMethod('virtual-html');
                    setError(null);
                  } else {
                    console.error('Failed to create virtual HTML file');
                  }
                  setLoading(false);
                } catch (err) {
                  console.error('Failed to create virtual player:', err);
                  setLoading(false);
                }
              }}
            >
              Использовать виртуальный плеер
            </button>
          </div>
          
          {/* Резервный плеер с кастомным интерфейсом */}
          <div style={videoContainerStyle}>
            <video
              ref={videoRef}
              style={{
                ...videoStyle,
                border: '1px dashed rgba(255,255,255,0.3)',
              }}
              onLoadedData={() => {
                console.log('Fallback video loaded');
                setError(null);
                setMethod('fallback');
                onLoad?.();
              }}
              onError={() => console.error('Fallback video also failed to load')}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onPlay={handlePlayStateChange}
              onPause={handlePlayStateChange}
              playsInline
            >
              <source src={`file:///${filePath.replace(/\\/g, '/').replace(/^\/+/, '')}`} type={getMimeType(filePath)} />
            </video>
          </div>
          
          <div style={controlsContainerStyle}>
            <div 
              ref={progressBarRef}
              style={progressBarContainerStyle}
              onClick={handleProgress}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
            >
              <div style={bufferedBarStyle}></div>
              <div style={progressBarStyle}></div>
            </div>
            
            <div style={controlsStyle}>
              <div style={buttonContainerStyle}>
                <button style={buttonStyle} onClick={handlePlay}>
                  {playerState.playing ? '⏸️' : '▶️'}
                </button>
                
                <div style={volumeControlStyle}>
                  <button style={buttonStyle} onClick={handleMute}>
                    {playerState.muted ? '🔇' : '🔊'}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={playerState.volume} 
                    onChange={handleVolumeChange}
                    style={rangeStyle}
                  />
                </div>
                
                <span style={timeDisplayStyle}>
                  {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
                </span>
              </div>
              
              <div style={buttonContainerStyle}>
                <select 
                  value={playerState.playbackRate} 
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                  style={{ ...buttonStyle, padding: '6px' }}
                >
                  <option value="0.5">0.5x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x</option>
                </select>
                
                <button style={buttonStyle} onClick={handleFullscreen}>
                  📺
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : videoUrl ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={methodBadgeStyle}>
            {method}
          </div>
          
          {method === 'virtual-html' ? (
            <iframe 
              src={videoUrl}
              style={{ 
                width: '90%', 
                height: '90%', 
                border: 'none',
                borderRadius: '4px',
                background: '#000'
              }}
              allowFullScreen
              title="Video Player"
            />
          ) : (
            <>
              <div style={videoContainerStyle}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  style={videoStyle}
                  onLoadedData={handleVideoLoaded}
                  onError={handleVideoError}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onPlay={handlePlayStateChange}
                  onPause={handlePlayStateChange}
                  playsInline
                />
              </div>
              
              <div style={controlsContainerStyle}>
                <div 
                  ref={progressBarRef}
                  style={progressBarContainerStyle}
                  onClick={handleProgress}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                >
                  <div style={bufferedBarStyle}></div>
                  <div style={progressBarStyle}></div>
                </div>
                
                <div style={controlsStyle}>
                  <div style={buttonContainerStyle}>
                    <button style={buttonStyle} onClick={handlePlay}>
                      {playerState.playing ? pauseIcon : playIcon}
                    </button>
                    
                    <div style={volumeControlStyle}>
                      <button style={buttonStyle} onClick={handleMute}>
                        {playerState.muted ? muteIcon : volumeIcon}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={playerState.volume} 
                        onChange={handleVolumeChange}
                        style={rangeStyle}
                      />
                    </div>
                    
                    <span style={timeDisplayStyle}>
                      {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
                    </span>
                  </div>
                  
                  <div style={buttonContainerStyle}>
                    <select 
                      value={playerState.playbackRate} 
                      onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                      style={{ ...buttonStyle, padding: '6px' }}
                    >
                      <option value="0.5">0.5x</option>
                      <option value="1.0">1.0x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                    </select>
                    
                    <button style={buttonStyle} onClick={handleFullscreen}>
                      {fullscreenIcon}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>Не удалось загрузить видео</div>
      )}
    </div>
  );
};

export default VideoPlayer; 