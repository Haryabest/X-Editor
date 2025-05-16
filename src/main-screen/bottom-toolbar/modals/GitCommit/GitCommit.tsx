import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './GitCommit.css';
import { GitCommit as GitCommitIcon, X } from 'lucide-react';

interface GitCommitProps {
  onClose: () => void;
  selectedFolder?: string;
  onSuccess?: () => void;
}

const GitCommit: React.FC<GitCommitProps> = ({ onClose, selectedFolder, onSuccess }) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    if (!selectedFolder) {
      setError('Не выбрана папка проекта');
      return;
    }

    if (!commitMessage.trim()) {
      setError('Введите сообщение коммита');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Добавляем все изменения в индекс
      await invoke('git_command', {
        projectRoot: selectedFolder,
        command: 'add',
        args: ['.']
      });

      // Создаем коммит
      await invoke('git_command', {
        projectRoot: selectedFolder,
        command: 'commit',
        args: ['-m', commitMessage]
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Error creating commit:', err);
      setError('Ошибка при создании коммита');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="git-commit-modal">
      <div className="header">
        <div className="title">
          <GitCommitIcon size={16} className="icon" />
          <span>Создать коммит</span>
        </div>
        <button onClick={onClose} className="close-button">
          <X size={16} />
        </button>
      </div>

      <div className="commit-form">
        <textarea
          className="commit-message"
          placeholder="Введите сообщение коммита..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={4}
          autoFocus
        />
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="buttons">
          <button className="cancel-button" onClick={onClose}>
            Отмена
          </button>
          <button 
            className="commit-button" 
            onClick={handleCommit}
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать коммит'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitCommit; 