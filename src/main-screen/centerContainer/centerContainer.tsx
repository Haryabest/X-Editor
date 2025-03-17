import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import { FileItem } from '../../types';

import "./style.css";

interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void;
  selectedFile: string | null;
  openedFiles: FileItem[];
  setOpenedFiles: (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
  handleCreateFile: () => void;
  selectedFolder?: string | null;
}

const CenterContainer: React.FC<CenterContainerProps> = ({
  style,
  setSelectedFolder,
  selectedFile,
  openedFiles,
  setOpenedFiles,
  handleCreateFile,
  selectedFolder
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('// Начните писать код здесь...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const supportedTextExtensions = useMemo(() => [
    '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.py', '.java', '.cpp', '.c', '.md', '.dart'
  ], []);

  const supportedImageExtensions = useMemo(() => ['.png', '.jpg', '.jpeg', '.gif'], []);
  const supportedVideoExtensions = useMemo(() => ['.mp4', '.avi', '.mov', '.webm', '.mkv'], []);

  const getLanguageFromExtension = useCallback((filePath: string): string => {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.json':
        return 'json';
      case '.html':
        return 'html';
      case '.css':
        return 'css';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cpp':
      case '.c':
        return 'cpp';
      case '.md':
        return 'markdown';
      case '.dart':
        return 'dart';
      case '.txt':
      default:
        return 'plaintext';
    }
  }, []);

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
            console.log('Text file content loaded:', content);
          } else if (supportedImageExtensions.includes(ext)) {
            const base64Content: string = await invoke('read_binary_file', { path: selectedFile });
            const fileUrl = `data:image/${ext.slice(1)};base64,${base64Content}`;
            setImageSrc(fileUrl);
            setFileContent(null);
            setVideoSrc(null);
            console.log('Image file loaded:', fileUrl);
          } else if (supportedVideoExtensions.includes(ext)) {
            const videoUrl: string = await invoke('stream_video', { path: selectedFile });
            setVideoSrc(videoUrl);
            setFileContent(null);
            setImageSrc(null);
            console.log('Video streaming URL:', videoUrl);
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
          console.error('Ошибка чтения файла:', error);
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
        console.log('Выбранная папка:', folderPath);
        setSelectedFolder(folderPath as string);
        setIsEditorOpen(false);
      } else {
        console.log('Выбор папки отменен');
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error('Ошибка при открытии папки:', error);
      alert(`Не удалось открыть папку: ${error}`);
    }
  }, [setSelectedFolder]);

  const handleSaveFile = useCallback(async () => {
    if (selectedFile && selectedFile.startsWith('untitled-')) {
      try {
        const filePath = await save({
          filters: [{ name: 'Text', extensions: ['txt', 'js', 'ts', 'json', 'html', 'css', 'py'] }],
          defaultPath: selectedFolder || undefined,
          title: 'Сохранить файл как...',
        });

        if (filePath) {
          await invoke('save_file', { path: filePath as string, content: code });
          console.log('Файл сохранён:', filePath);

          setOpenedFiles((prev: FileItem[]) => {
            return prev.map((file: FileItem) =>
              file.path === selectedFile
                ? { ...file, name: (filePath as string).split(/[\\/]/).pop() || 'Без названия', path: filePath as string }
                : file
            );
          });
        }
      } catch (error) {
        console.error('Ошибка при сохранении файла:', error);
        alert(`Не удалось сохранить файл: ${error}`);
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

  return (
    <div className="center-container" style={style}>
      {isEditorOpen || selectedFile ? (
        <>
          {isEditableFile(selectedFile || '') ? (
            <>
              <button onClick={handleSaveFile} className="save-btn">
                Сохранить
              </button>
              <MonacoEditor
                height="100%"
                language={getLanguageFromExtension(selectedFile || 'untitled-1')}
                theme="vs-light"
                value={fileContent || code}
                onChange={(value) => setCode(value ?? '')}
                options={{
                  automaticLayout: true,
                  fontSize: 14,
                  minimap: { enabled: true },
                  fontFamily: "Times New Roman",
                  
                }}
              />
            </>
          ) : imageSrc !== null && isImageFile(selectedFile || '') ? (
            <img src={imageSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : videoSrc !== null && isVideoFile(selectedFile || '') ? (
            <ReactPlayer
              url={videoSrc}
              controls={true}
              width="50%"
              height="50%"
              playing={false}
              onError={(e) => console.error('Ошибка воспроизведения видео:', e)}
            />
          ) : (
            <p>
              Файл {selectedFile} {fileContent === null && imageSrc === null && videoSrc === null ? 'не удалось загрузить' : 'не поддерживается для просмотра'}.
            </p>
          )}
        </>
      ) : (
        <div className="card-container">
          <button className="start-card" onClick={handleCreateFile}>
            <p>Создать проект</p>
            <span className="hotkey">CTRL + SHIFT + A</span>
          </button>
          <button className="start-card" onClick={handleOpenFolder}>
            <p>Открыть папку</p>
            <span className="hotkey">CTRL + SHIFT + A</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CenterContainer;
