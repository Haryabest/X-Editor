import React, { useState } from 'react';
import ImageViewer from './ImageViewer';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const ImageContainer: React.FC = () => {
  const [imagePath, setImagePath] = useState<string>('');

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Изображения',
          extensions: ['png']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        setImagePath(selected);
      }
    } catch (err) {
      console.error('Ошибка при выборе файла:', err);
    }
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
  };

  const viewerContainerStyle: React.CSSProperties = {
    flex: 1,
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#f5f5f5',
    overflow: 'hidden',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#0078d7',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={containerStyle}>
      <button 
        style={buttonStyle}
        onClick={handleSelectImage}
      >
        Выбрать PNG изображение
      </button>
      
      <div style={viewerContainerStyle}>
        {imagePath ? (
          <ImageViewer 
            imagePath={imagePath} 
            alt="Выбранное изображение" 
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            color: '#666' 
          }}>
            Выберите изображение для просмотра
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageContainer; 