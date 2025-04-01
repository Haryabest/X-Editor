import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitCommit as GitCommitIcon } from 'lucide-react';
import './GitCommit.css';

interface GitCommitProps {
  onClose: () => void;
  selectedFolder: string | null;
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
          <GitCommitIcon className="icon" />
          <span>Создать коммит</span>
        </div>
      </div>

      <div className="commit-form">
        <textarea
          className="commit-message"
          placeholder="Введите сообщение коммита..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={4}
        />
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="buttons">
          <button 
            className="commit-button" 
            onClick={handleCommit}
            disabled={loading}
          >
            {loading ? 'Создание коммита...' : 'Создать коммит'}
          </button>
          <button className="cancel-button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitCommit; 