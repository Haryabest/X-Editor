import React from 'react';
import './style.css';

const BottomToolbar: React.FC = () => {
  return (
    <div className="bottom-toolbar">
      <div className="status-item">
        <span className="status-icon">✓</span>
        Ready
      </div>
      <div className="status-item">
        <span className="status-icon">🔠</span>
        UTF-8
      </div>
      <div className="status-item">
        <span className="status-icon">⚡</span>
        Tauri v2.0
      </div>
      <div className="status-item">
        <span className="status-icon">🔄</span>
        Auto-Save
      </div>
    </div>
  );
};

export default BottomToolbar;