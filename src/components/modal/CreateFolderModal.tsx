import React, { useState, useEffect, FormEvent } from 'react';
import { X, FolderPlus } from 'lucide-react';
import './Modal.css';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderName: string) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm
}) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  // Фокусировка на инпуте при открытии
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const input = document.getElementById('folder-name');
        if (input) {
          input.focus();
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Обработка клавиши Escape для закрытия
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!folderName.trim()) {
      setError('Введите имя папки');
      return;
    }

    // Проверка на недопустимые символы в имени папки
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(folderName)) {
      setError('Имя папки содержит недопустимые символы: < > : " / \\ | ? *');
      return;
    }

    onConfirm(folderName);
    setFolderName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-container" style={{ width: '280px', maxWidth: '90vw' }}>
        <div className="modal-header" style={{ padding: '8px 12px' }}>
          <h2 className="modal-title">
            <FolderPlus size={14} style={{ marginRight: '6px', color: '#aaa' }} />
            Создать новую папку
          </h2>
          <button type="button" className="modal-close-button" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="modal-content" style={{ padding: '10px 12px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="folder-name" className="form-label">Имя папки</label>
              <input
                id="folder-name"
                type="text"
                className="form-input"
                value={folderName}
                onChange={(e) => {
                  setFolderName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Введите имя папки"
                autoFocus
                style={{
                  width: '100%',
                  height: 'auto',
                  padding: '7px 10px',
                  backgroundColor: '#121212',
                  border: '1px solid #2a2a2a',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                  boxSizing: 'border-box'
                }}
              />
              {error && <div className="form-error">{error}</div>}
            </div>
            <div className="form-actions" style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <button 
                type="button" 
                className="button-secondary"
                onClick={onClose}
                style={{
                  backgroundColor: 'transparent',
                  color: '#aaa',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Отмена
              </button>
              <button 
                type="submit" 
                className="button-primary"
                style={{
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  letterSpacing: '0.3px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                Создать
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateFolderModal; 