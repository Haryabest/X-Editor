import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface CenterContainerProps {
  style?: React.CSSProperties;
}

const CenterContainer: React.FC<CenterContainerProps> = ({ style }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [code, setCode] = useState('// Начните писать код здесь...');

  return (
    <div className="center-container" style={style}>
      {isEditorOpen ? (
        <MonacoEditor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            automaticLayout: true, // Ключевой параметр!
            fontSize: 14,
            minimap: { enabled: false },
          }}
        />
      ) : (
        <>
          <div className="start-card" onClick={() => setIsEditorOpen(true)}>
            <h3>New File</h3>
            <p>Create new text file</p>
          </div>
          <div className="start-card" onClick={() => setIsEditorOpen(true)}>
            <h3>Open File</h3>
            <p>Open existing file</p>
          </div>
          <div className="start-card" onClick={() => setIsEditorOpen(true)}>
            <h3>Open Folder</h3>
            <p>Open project folder</p>
          </div>
        </>
      )}
    </div>
  );
};

export default CenterContainer;
