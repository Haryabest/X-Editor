import React, { useRef, useEffect } from 'react';
import { LogOut, Github } from 'lucide-react';
import './AccountMenu.css';

interface AccountMenuProps {
  isVisible: boolean;
  onClose: () => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ isVisible, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        const toolbarButtons = document.querySelectorAll('.toolbar-button');
        let isClickOnToolbarButton = false;
        
        toolbarButtons.forEach(button => {
          if (button.contains(event.target as Node)) {
            isClickOnToolbarButton = true;
          }
        });
        
        if (!isClickOnToolbarButton) {
          onClose();
        }
      }
    };

    if (isVisible) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="leftbar-account-overlay">
      <div className="leftbar-account-menu" ref={menuRef}>
        <div className="leftbar-account-header">
          <h3>Аккаунт</h3>
        </div>
        <div className="leftbar-account-content">
          <div 
            className="leftbar-account-item" 
            onClick={() => {
              console.log('GitHub login');
              onClose();
            }}
          >
            <Github size={16} />
            <span>Войти через GitHub</span>
          </div>
          <div className="leftbar-account-divider"></div>
          <div 
            className="leftbar-account-item logout"
            onClick={() => {
              console.log('Logout');
              onClose();
            }}
          >
            <LogOut size={16} />
            <span>Выйти</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountMenu; 