import { Monaco } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../types';

export function setupVirtualFileSystem(
  monaco: Monaco, 
  openedFiles: FileItem[], 
  selectedFolder: string | null,
  supportedTextExtensions: string[],
  getLanguageFromExtension: (filePath: string) => string
) {
  // Функция для добавления виртуальных файлов в Monaco
  const addVirtualFile = (filePath: string, content: string) => {
    const uri = monaco.Uri.parse(filePath);
    
    if (!monaco.editor.getModel(uri)) {
      const language = getLanguageFromExtension(filePath);
      
      monaco.editor.createModel(
        content,
        language,
        uri
      );
    }
  };

  // Создание виртуальной файловой системы на основе открытых файлов
  if (openedFiles && openedFiles.length > 0) {
    openedFiles.forEach(async (file) => {
      try {
        if (supportedTextExtensions.includes(file.path.slice(file.path.lastIndexOf('.')).toLowerCase())) {
          const content: string = await invoke('read_text_file', { path: file.path });
          const normalizedPath = file.path.replace(/\\/g, '/');
          
          // Добавляем файл с абсолютным путем
          addVirtualFile(`file:///${normalizedPath}`, content);
          
          // Добавляем файл также с относительным путем для импортов
          if (selectedFolder) {
            const normalizedFolder = selectedFolder.replace(/\\/g, '/');
            let relativePath = '';
            
            // Получаем относительный путь
            if (normalizedPath.startsWith(normalizedFolder)) {
              relativePath = normalizedPath.replace(normalizedFolder, '');
              if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
              }
            } else {
              relativePath = normalizedPath;
            }
            
            // Создаем виртуальные пути для импортов
            
            // 1. Для импортов вида 'src/path'
            addVirtualFile(`file:///src/${relativePath}`, content);
            
            // 2. Для импортов вида './path'
            addVirtualFile(`file:///${relativePath}`, content);
            
            // 3. Для импортов с абсолютным путем от корня проекта
            const fileName = relativePath.split('/').pop() || '';
            addVirtualFile(`file:///${fileName}`, content);
            
            // 4. Для импортов с относительным путем без ./
            const dirPath = relativePath.split('/').slice(0, -1).join('/');
            if (dirPath) {
              addVirtualFile(`file:///${dirPath}/${fileName}`, content);
            }
            
            // 5. Для импортов с относительным путем с ./
            if (dirPath) {
              addVirtualFile(`file:///./src/${dirPath}/${fileName}`, content);
              addVirtualFile(`file:///./src/${relativePath}`, content);
            }
            
            // 6. Для импортов с относительным путем с ../
            const parentDir = dirPath.split('/').slice(0, -1).join('/');
            if (parentDir) {
              addVirtualFile(`file:///../${parentDir}/${fileName}`, content);
            }
            
            // 7. Для импортов без расширения
            const fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
            if (fileNameWithoutExt) {
              addVirtualFile(`file:///${fileNameWithoutExt}`, content);
              addVirtualFile(`file:///src/${dirPath}/${fileNameWithoutExt}`, content);
              if (dirPath) {
                addVirtualFile(`file:///${dirPath}/${fileNameWithoutExt}`, content);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error adding virtual file:', error);
      }
    });
  }
} 