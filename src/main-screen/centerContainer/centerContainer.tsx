import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { open } from '@tauri-apps/plugin-dialog';

import "./style.css";

interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void; // Проп для обновления selectedFolder
}


const CenterContainer: React.FC<CenterContainerProps> = ({ style, setSelectedFolder }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('// Начните писать код здесь...');

  const handleOpenFolder = async () => {
    try {
      const folderPath = await open({ directory: true, multiple: false });
      console.log('Выбранная папка:', folderPath);
      setSelectedFolder(folderPath as string); // Устанавливаем путь выбранной папки
    } catch (error) {
      console.error('Ошибка при открытии папки:', error);
    }
  };

  return (
    <div className="center-container" style={style}>
      {isEditorOpen ? (
        <MonacoEditor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          options={{
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: true },
          }}
        />
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