import React, { useState, useEffect, useCallback } from 'react';
import MonacoEditor, { Monaco } from '@monaco-editor/react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import ReactPlayer from 'react-player';
import * as monaco from 'monaco-editor';
import { MonacoLanguageClient, BrowserMessageReader, BrowserMessageWriter } from 'monaco-languageclient';
import { FileItem } from '../../types';

import "./style.css";

interface DependencyMetadata {
  dependencies: string[];
}

interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void;
  selectedFolder: string | null;
  selectedFile: string | null;
  dependencyMetadata: DependencyMetadata;
  setDependencyMetadata: (metadata: DependencyMetadata) => void;
  currentFiles: FileItem[];
}

const CenterContainer: React.FC<CenterContainerProps> = ({
  style,
  setSelectedFolder,
  selectedFolder,
  selectedFile,
  dependencyMetadata,
  setDependencyMetadata,
  currentFiles,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('// Начните писать код здесь...');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [languageClient, setLanguageClient] = useState<MonacoLanguageClient | null>(null);

  const supportedTextExtensions = [
    '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.py', '.java', '.cpp', '.c', '.md', '.dart'
  ];
  const supportedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
  const supportedVideoExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv'];

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

  const configureMonaco = async (monaco: Monaco) => {
    // Инициализация WebSocket для Language Server
    const url = 'ws://127.0.0.1:8080';
    const webSocket = new WebSocket(url);

    webSocket.onopen = () => {
      const reader = new BrowserMessageReader(webSocket);
      const writer = new BrowserMessageWriter(webSocket);

      const languageClient = new MonacoLanguageClient({
        name: 'TypeScript Language Client',
        clientOptions: {
          documentSelector: [{ scheme: 'file', language: 'typescript' }, { scheme: 'file', language: 'javascript' }],
          initializationOptions: {
            rootUri: `file:///${selectedFolder?.replace(/\\/g, '/')}`,
          },
          // Убираем synchronize, так как workspace не доступен
        },
        reader,
        writer,
      });

      languageClient.start();
      setLanguageClient(languageClient);
      console.log('Language Client started');
    };

    webSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    webSocket.onclose = () => {
      console.log('WebSocket closed');
    };

    // Минимальная конфигурация Monaco
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      baseUrl: selectedFolder || '.',
      allowSyntheticDefaultImports: true,
      paths: {
        '*': ['*', 'node_modules/*'],
      },
    });

    // Добавляем все файлы проекта в Monaco для анализа
    if (selectedFolder && currentFiles.length > 0) {
      currentFiles.forEach(file => {
        if (!file.is_directory && supportedTextExtensions.some(ext => file.path.endsWith(ext))) {
          invoke('read_text_file', { path: file.path }).then(content => {
            monaco.editor.createModel(
              content as string,
              getLanguageFromExtension(file.path),
              monaco.Uri.file(file.path)
            );
          }).catch(e => console.error(`Failed to load ${file.path}:`, e));
        }
      });
    }

    console.log('Monaco configured with baseUrl:', selectedFolder);
  };

  useEffect(() => {
    if (selectedFolder && !languageClient) {
      invoke('start_language_server').catch(err => console.error('Failed to start language server:', err));
    }

    return () => {
      if (languageClient) {
        languageClient.stop();
        setLanguageClient(null);
      }
    };
  }, [selectedFolder, languageClient]);

  useEffect(() => {
    const loadFileContent = async () => {
      if (selectedFile) {
        const ext = selectedFile.slice(selectedFile.lastIndexOf('.')).toLowerCase();

        try {
          if (supportedTextExtensions.includes(ext)) {
            const content: string = await invoke('read_text_file', { path: selectedFile });
            setFileContent(content);
            setImageSrc(null);
            setVideoSrc(null);
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
  }, [selectedFile]);

  const handleOpenFolder = async () => {
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
  };

  const isEditableFile = (filePath: string) => supportedTextExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  const isImageFile = (filePath: string) => supportedImageExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  const isVideoFile = (filePath: string) => supportedVideoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));

  return (
    <div className="center-container" style={style}>
      {isEditorOpen ? (
        <MonacoEditor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          beforeMount={configureMonaco}
          options={{ automaticLayout: true, fontSize: 14, minimap: { enabled: true } }}
        />
      ) : selectedFile ? (
        <div className="file-viewer" style={{ width: '100%', height: '100%', padding: '20px' }}>
          {fileContent !== null && isEditableFile(selectedFile) ? (
            <MonacoEditor
              height="100%"
              language={getLanguageFromExtension(selectedFile)}
              theme="vs-dark"
              value={fileContent}
              beforeMount={configureMonaco}
              options={{ automaticLayout: true, fontSize: 14, minimap: { enabled: true } }}
            />
          ) : imageSrc !== null && isImageFile(selectedFile) ? (
            <img src={imageSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : videoSrc !== null && isVideoFile(selectedFile) ? (
            <ReactPlayer
              url={videoSrc}
              controls={true}
              width="50%"
              height="50%"
              playing={false}
              onError={(e) => console.error('Ошибка воспроизведения видео:', e)}
            />
          ) : (
            <p>Файл {selectedFile} не поддерживается для просмотра.</p>
          )}
        </div>
      ) : (
        <div className="card-container">
          <button className="start-card" onClick={() => setIsEditorOpen(true)}>
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