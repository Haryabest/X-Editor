import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import './style.css';

const TopToolbar: React.FC = () => {
  const handleMinimize = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Minimize error:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize');
    } catch (error) {
      console.error('Maximize error:', error);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Close error:', error);
    }
  };

  return (
    <div className="top-toolbar" data-tauri-drag-region>
      <div className="draggable-area">
        <div className="left-section">
          <div className="app-icon" data-tauri-drag-region>
            ⚡
          </div>
          <div className="menu-items">
            <button className="menu-item">File</button>
            <button className="menu-item">Edit</button>
            <button className="menu-item">View</button>
          </div>
        </div>

        <div className="search-bar">
          <input type="text" placeholder="Search..." />
        </div>
      </div>

      <div className="window-controls">
        <button className="control-btn" onClick={handleMinimize} aria-label="Minimize">
          ─
        </button>
        <button className="control-btn" onClick={handleMaximize} aria-label="Maximize">
          □
        </button>
        <button className="control-btn close-btn" onClick={handleClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
};

export default TopToolbar;
