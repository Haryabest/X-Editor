import React, { useState, useEffect, useRef } from 'react';
import { Check, GitMerge, GitBranch, RefreshCcw, Search, X, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import './GitBranches.css';

interface GitBranchesProps {
  currentBranch: string;
  onClose: () => void;
  selectedFolder?: string | null;
  onBranchSwitch?: (branch: string) => void;
}

interface BranchInfo {
  name: string;
  isRemote: boolean;
  isDetached: boolean;
  isCurrent: boolean;
  ref?: string; // Для удаленных веток
}

const GitBranches: React.FC<GitBranchesProps> = ({ currentBranch, onClose, selectedFolder, onBranchSwitch }) => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchError, setBranchError] = useState<string | null>(null);
  const newBranchInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    fetchBranches();
  }, [selectedFolder]);

  useEffect(() => {
    if (isCreateBranchModalOpen && newBranchInputRef.current) {
      newBranchInputRef.current.focus();
    }
  }, [isCreateBranchModalOpen]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      // Используем выбранную директорию или текущую, если директория не выбрана
      const currentDir = await invoke('tauri_current_dir') as string;
      const root = selectedFolder || currentDir;
      setProjectRoot(root);
      
      // Проверяем, что это действительно Git репозиторий
      try {
        await invoke('git_command', { 
          projectRoot: root,
          command: 'rev-parse',
          args: ['--is-inside-work-tree'] 
        });
      } catch (err) {
        setError('Текущая директория не является Git репозиторием');
        setLoading(false);
        return;
      }
      
      // Получаем список всех веток (включая удаленные)
      const output = await invoke('git_command', { 
        projectRoot: root,
        command: 'branch',
        args: ['--all', '--verbose'] 
      }) as string;
      
      console.log('Git branches output:', output); // Добавляем лог для отладки
      
      const parsedBranches = parseBranchOutput(output, currentBranch);
      setBranches(parsedBranches);
      setError(null);
    } catch (err) {
      console.error('Error fetching Git branches:', err);
      setError('Ошибка при получении списка веток');
    } finally {
      setLoading(false);
    }
  };

  const parseBranchOutput = (output: string, currentBranchName: string): BranchInfo[] => {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const isCurrentBranch = line.startsWith('*');
        const trimmedLine = line.replace(/^\*\s+/, '').trim();
        
        // Определяем, является ли ветка detached HEAD
        const isDetached = trimmedLine.includes('HEAD detached at') || trimmedLine.includes('(HEAD detached');
        
        let branchName = trimmedLine;
        let isRemote = false;
        let ref;
        
        // Обработка удаленных веток (remotes/origin/...)
        if (branchName.startsWith('remotes/')) {
          isRemote = true;
          branchName = branchName.replace(/^remotes\//, '');
          // Разделяем на origin/main
          const parts = branchName.split('/');
          if (parts.length >= 2) {
            ref = parts[0]; // origin
            branchName = parts.slice(1).join('/'); // main (или другая часть пути)
          }
        }
        
        // Убираем хеш коммита и другую информацию, которую выводит --verbose
        // Пример: "master 1a2b3c4 [ahead 1] Последний коммит"
        const hashMatch = branchName.match(/^([^\s]+)\s+[0-9a-f]+/);
        if (hashMatch) {
          branchName = hashMatch[1];
        }
        
        return {
          name: branchName,
          isRemote,
          isDetached,
          isCurrent: isCurrentBranch || branchName === currentBranchName,
          ref
        };
      });
  };

  const handleBranchSwitch = async (branch: BranchInfo) => {
    if (branch.isCurrent) return;
    
    try {
      setLoading(true);
      // Для удаленных веток создаем локальную ветку с таким же именем
      if (branch.isRemote && branch.ref) {
        await invoke('git_command', { 
          projectRoot,
          command: 'checkout',
          args: ['-b', branch.name, `${branch.ref}/${branch.name}`]
        });
      } else {
        // Переключаемся на выбранную ветку
        await invoke('switch_git_branch', { projectRoot, branchName: branch.name });
      }
      
      // Вызываем колбэк для обновления информации в родительском компоненте
      if (onBranchSwitch) {
        onBranchSwitch(branch.name);
      }
      
      onClose();
    } catch (err) {
      console.error('Error switching branch:', err);
      setError(`Ошибка при переключении на ветку ${branch.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setBranches([]);
    setLoading(true);
    setError(null);
    fetchBranches();
  };

  const openCreateBranchModal = () => {
    setIsCreateBranchModalOpen(true);
    setNewBranchName('');
    setBranchError(null);
  };

  const closeCreateBranchModal = () => {
    setIsCreateBranchModalOpen(false);
    setBranchError(null);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setBranchError('Введите имя новой ветки');
      return;
    }

    // Валидация имени ветки
    if (!/^[a-zA-Z0-9_\-./]+$/.test(newBranchName)) {
      setBranchError('Недопустимые символы в имени ветки');
      return;
    }
    
    try {
      setLoading(true);
      setBranchError(null);
      
      await invoke('git_command', {
        projectRoot,
        command: 'checkout',
        args: ['-b', newBranchName]
      });
      
      // Обновляем список веток после создания новой
      await fetchBranches();
      
      // Закрываем модальное окно
      setIsCreateBranchModalOpen(false);
      
      // Вызываем колбэк для обновления информации в родительском компоненте
      if (onBranchSwitch) {
        onBranchSwitch(newBranchName);
      }
    } catch (err) {
      console.error('Error creating branch:', err);
      setBranchError(`Ошибка при создании ветки: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateBranch();
    } else if (e.key === 'Escape') {
      closeCreateBranchModal();
    }
  };

  const filteredBranches = branches.filter(branch => 
    branch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Сначала группируем все ветки
  const groupedBranches = filteredBranches.reduce(
    (acc, branch) => {
      if (branch.isDetached) {
        acc.detached.push(branch);
      } else if (branch.isRemote) {
        if (!acc.remote[branch.ref || '']) {
          acc.remote[branch.ref || ''] = [];
        }
        acc.remote[branch.ref || ''].push(branch);
      } else {
        acc.local.push(branch);
      }
      return acc;
    },
    { local: [] as BranchInfo[], remote: {} as Record<string, BranchInfo[]>, detached: [] as BranchInfo[] }
  );
  
  // Сортируем ветки по алфавиту в каждой группе
  groupedBranches.local.sort((a, b) => a.name.localeCompare(b.name));
  groupedBranches.detached.sort((a, b) => a.name.localeCompare(b.name));
  
  // Сортируем удаленные ветки в каждой группе
  Object.keys(groupedBranches.remote).forEach(remote => {
    groupedBranches.remote[remote].sort((a, b) => a.name.localeCompare(b.name));
  });
  
  return (
    <>
      <div className="git-branches-modal">
        <div className="header">
          <div className="title">
            <GitBranch className="icon" />
            <span>Выберите ветку или тег для перехода</span>
          </div>
          <button className="refresh-button" onClick={handleRefresh} title="Обновить">
            <RefreshCcw size={14} />
          </button>
        </div>

        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Найти ветку..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="branches-list">
          {loading ? (
            <div className="loading">Загрузка веток...</div>
          ) : (
            <>
              {/* Локальные ветки */}
              {groupedBranches.local.length > 0 && (
                <div className="branch-section">
                  <div className="branch-section-header">Локальные ветки</div>
                  {groupedBranches.local.map((branch, index) => (
                    <div 
                      key={`local-${index}`} 
                      className={`branch-item ${branch.isCurrent ? 'active' : ''}`}
                      onClick={() => handleBranchSwitch(branch)}
                    >
                      <GitBranch size={14} className="branch-icon" />
                      <span className="branch-name">{branch.name}</span>
                      {branch.isCurrent && <Check size={14} className="check-icon" />}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Отделенный HEAD */}
              {groupedBranches.detached.length > 0 && (
                <div className="branch-section">
                  <div className="branch-section-header">Отделенный HEAD</div>
                  {groupedBranches.detached.map((branch, index) => (
                    <div 
                      key={`detached-${index}`} 
                      className={`branch-item detached ${branch.isCurrent ? 'active' : ''}`}
                      onClick={() => handleBranchSwitch(branch)}
                    >
                      <GitBranch size={14} className="branch-icon" />
                      <span className="branch-name">{branch.name}</span>
                      {branch.isCurrent && <Check size={14} className="check-icon" />}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Удаленные ветки, сгруппированные по репозиторию */}
              {Object.keys(groupedBranches.remote).length > 0 && (
                <div className="branch-section">
                  <div className="branch-section-header">Удаленные ветки</div>
                  {Object.entries(groupedBranches.remote).map(([remoteName, branches]) => (
                    <div key={remoteName} className="remote-group">
                      <div className="remote-name">{remoteName}</div>
                      {branches.map((branch, index) => (
                        <div 
                          key={`remote-${remoteName}-${index}`} 
                          className={`branch-item remote-branch ${branch.isCurrent ? 'active' : ''}`}
                          onClick={() => handleBranchSwitch(branch)}
                        >
                          <GitBranch size={14} className="branch-icon" />
                          <span className="branch-name">{branch.name}</span>
                          {branch.isCurrent && <Check size={14} className="check-icon" />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {filteredBranches.length === 0 && (
                <div className="no-branches">
                  {searchTerm ? `Нет веток, соответствующих "${searchTerm}"` : 'Ветки не найдены'}
                </div>
              )}
            </>
          )}
        </div>

        <div className="footer">
          <button className="new-branch-button" onClick={openCreateBranchModal}>
            <Plus size={14} style={{ marginRight: '5px' }} />
            Создать новую ветку
          </button>
          <button onClick={onClose} className="close-button">Закрыть</button>
        </div>
      </div>

      {isCreateBranchModalOpen && (
        <div className="modal-overlay" onClick={closeCreateBranchModal}>
          <div className="create-branch-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <GitBranch className="icon" size={16} />
                <span>Создать новую ветку</span>
              </div>
              <button className="modal-close" onClick={closeCreateBranchModal}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-content">
              <label htmlFor="new-branch-name">Введите имя новой ветки:</label>
              <input
                ref={newBranchInputRef}
                id="new-branch-name"
                type="text"
                className="branch-name-input"
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                onKeyDown={handleCreateBranchKeyDown}
              />
              {branchError && <div className="branch-name-error">{branchError}</div>}
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={closeCreateBranchModal}>
                Отмена
              </button>
              <button 
                className="create-button" 
                onClick={handleCreateBranch}
                disabled={loading}
              >
                {loading ? 'Создание...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GitBranches; 