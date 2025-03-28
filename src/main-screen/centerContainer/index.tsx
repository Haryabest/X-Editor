import React, { useEffect } from 'react';
import { configureMonaco, setCurrentProject } from './monacoConfig';

export default function CenterContainer() {
  // Инициализация корня проекта при загрузке компонента
  useEffect(() => {
    try {
      // Получаем текущий путь проекта
      const projectPath = typeof window !== 'undefined' && window.location.pathname.includes('/src/') 
        ? window.location.pathname.substring(0, window.location.pathname.indexOf('/src/'))
        : 'C:\\PROJECTS\\X-Editor'; // Запасной вариант
        
      // Устанавливаем корень проекта для Monaco
      setCurrentProject(projectPath.replace(/\//g, '\\'));
      
      console.log('Установлен корневой каталог проекта:', projectPath);
    } catch (error) {
      console.error('Ошибка при инициализации корня проекта:', error);
    }
  }, []);

  return (
    <div className="center-container">
      <div className="editor-area">
        {/* Здесь будет редактор Monaco */}
      </div>
    </div>
  );
} 