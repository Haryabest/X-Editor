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
}

const LeftToolBar: React.FC<LeftToolBarProps> = ({ 
  onToggleFileExplorer,
  isFileExplorerOpen
}) => {
  const [activeButton, setActiveButton] = useState<string>('explorer');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Добавляем ref для кнопки аккаунта
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  const handleButtonClick = (buttonName: string) => {
    if (buttonName === 'explorer') {
      setActiveButton(buttonName);
      onToggleFileExplorer();
    } else if (buttonName === 'git' || buttonName === 'files') {
      setActiveButton(buttonName);
    } else if (buttonName === 'account') {
      // Гарантируем что меню переключится на противоположное состояние
      setIsAccountMenuOpen(prevState => {
        const newState = !prevState;
        // Активировать кнопку только если меню открывается
        setActiveButton(newState ? 'account' : '');
        console.log(`Аккаунт меню ${newState ? 'открыто' : 'закрыто'}`);
        return newState;
      });
    } else if (buttonName === 'settings') {
      setIsSettingsOpen(true);
      setActiveButton(buttonName);
    }
    
    console.log(`${buttonName} button clicked`);
  };

  // Обработчик закрытия меню аккаунта
  const handleAccountMenuClose = () => {
    setIsAccountMenuOpen(false);
    setActiveButton('');
  };

  // Обработчик закрытия окна настроек
  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
    setActiveButton('');
  };

  return (
    <div className="left-toolbar">
      <div className="top-buttons">
        <button 
          className={`toolbar-button ${activeButton === 'explorer' ? 'active' : ''} ${isFileExplorerOpen ? 'open' : ''}`}
          onClick={() => handleButtonClick('explorer')}
          title="Проводник"
        >
          <FolderTree size={24} />
        </button>
        <button 
          className={`toolbar-button ${activeButton === 'git' ? 'active' : ''}`}
          onClick={() => handleButtonClick('git')}
          title="Ветви Git"
        >
          <GitBranch size={24} />
        </button>
      </div>
      
      <div className="bottom-buttons">
        <button 
          ref={accountButtonRef}
          className={`toolbar-button ${activeButton === 'account' ? 'active' : ''}`}
          onClick={() => handleButtonClick('account')}
          title="Аккаунт"
        >
          <User size={24} />
        </button>
        <button 
          className={`toolbar-button ${activeButton === 'settings' ? 'active' : ''}`}
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
