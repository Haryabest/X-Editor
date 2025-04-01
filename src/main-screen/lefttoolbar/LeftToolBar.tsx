import { useState, useRef } from 'react';
import { 
  FolderTree, 
  GitBranch, 
  User, 
  Settings,
} from 'lucide-react';
import './LeftToolBar.css';
import AccountMenu from './accountmenu/AccountMenu';
import SettingsComponent from './settings/Settings';

interface LeftToolBarProps {
  onToggleFileExplorer: () => void;
  isFileExplorerOpen: boolean;
  onChangeView: (buttonName: string) => void;
  activeView: string;
}

const LeftToolBar: React.FC<LeftToolBarProps> = ({ 
  onToggleFileExplorer,
  isFileExplorerOpen,
  onChangeView,
  activeView,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Добавляем ref для кнопки аккаунта
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  const handleButtonClick = (buttonName: string) => {
    if (buttonName === 'explorer') {
      onChangeView('explorer');
      onToggleFileExplorer();
    } else if (buttonName === 'git') {
      onChangeView('git');
      if (!isFileExplorerOpen) {
        onToggleFileExplorer();
      }
    } else if (buttonName === 'account') {
      // Гарантируем что меню переключится на противоположное состояние
      setIsAccountMenuOpen(prevState => !prevState);
    } else if (buttonName === 'settings') {
      setIsSettingsOpen(true);
    }
    
    console.log(`${buttonName} button clicked`);
  };

  // Обработчик закрытия меню аккаунта
  const handleAccountMenuClose = () => {
    setIsAccountMenuOpen(false);
  };

  // Обработчик закрытия окна настроек
  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className="left-toolbar">
      <div className="top-buttons">
        <button 
          className={`toolbar-button ${activeView === 'explorer' ? 'active' : ''} ${isFileExplorerOpen ? 'open' : ''}`}
          onClick={() => handleButtonClick('explorer')}
          title="Проводник"
        >
          <FolderTree size={24} />
        </button>
        <button 
          className={`toolbar-button ${activeView === 'git' ? 'active' : ''}`}
          onClick={() => handleButtonClick('git')}
          title="Ветви Git"
        >
          <GitBranch size={24} />
        </button>
      </div>
      
      <div className="bottom-buttons">
        <button 
          ref={accountButtonRef}
          className={`toolbar-button ${isAccountMenuOpen ? 'active' : ''}`}
          onClick={() => handleButtonClick('account')}
          title="Аккаунт"
        >
          <User size={24} />
        </button>
        <button 
          className={`toolbar-button ${isSettingsOpen ? 'active' : ''}`}
          onClick={() => handleButtonClick('settings')}
          title="Настройки"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Меню аккаунта */}
      <AccountMenu 
        isVisible={isAccountMenuOpen} 
        onClose={handleAccountMenuClose} 
      />

      {/* Модальное окно настроек */}
      <SettingsComponent 
        isVisible={isSettingsOpen} 
        onClose={handleSettingsClose} 
      />
    </div>
  );
};

export default LeftToolBar;
