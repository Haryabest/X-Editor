import { useState, forwardRef } from 'react';
import { X } from 'lucide-react';
import './Settings.css';

// Типы для настроек разных разделов
interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
}

interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'line';
  cursorBlink: boolean;
}

interface ThemeSettings {
  theme: 'dark' | 'light' | 'auto';
  customThemePath: string;
}

interface SettingsProps {
  isVisible: boolean;
  onClose: () => void;
}

// Используем forwardRef для передачи ref
const Settings = forwardRef<HTMLDivElement, SettingsProps>(({ isVisible, onClose }, ref) => {
  // Local state for active tab, initialized from context if available or default to 'editor'
  const [activeTab, setActiveTab] = useState(
    'editor'
  );
  
  // Пример первоначальных настроек
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: true
  });
  
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>({
    fontSize: 14,
    fontFamily: 'monospace',
    cursorStyle: 'block',
    cursorBlink: true
  });
  
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    theme: 'dark',
    customThemePath: ''
  });
  
  // Use hideSettings from context and call onClose from props
  const handleClose = () => {
    if (onClose) onClose(); 
  };

  // Обработчики изменения настроек
  const handleEditorSettingChange = (key: keyof EditorSettings, value: any) => {
    setEditorSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTerminalSettingChange = (key: keyof TerminalSettings, value: any) => {
    setTerminalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleThemeSettingChange = (key: keyof ThemeSettings, value: any) => {
    setThemeSettings(prev => ({ ...prev, [key]: value }));
  };
  
  // Check combined visibility after all hooks
  if (!isVisible) return null;

  return (
    <div className="settings-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="settings-modal" ref={ref}>
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="close-button" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-sidebar">
            <div 
              className={`sidebar-item ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              Редактор
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              Терминал
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'theme' ? 'active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              Тема
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'keybindings' ? 'active' : ''}`}
              onClick={() => setActiveTab('keybindings')}
            >
              Горячие клавиши
            </div>
            <div 
              className={`sidebar-item ${activeTab === 'extensions' ? 'active' : ''}`}
              onClick={() => setActiveTab('extensions')}
            >
              Расширения
            </div>
          </div>
          
          <div className="settings-panel">
            {activeTab === 'editor' && (
              <div className="editor-settings">
                <h3>Настройки редактора</h3>
                
                <div className="settings-group">
                  <div className="setting-item">
                    <label>Размер шрифта</label>
                    <div className="setting-control">
                      <input 
                        type="number"
                        value={editorSettings.fontSize}
                        onChange={(e) => handleEditorSettingChange('fontSize', Number(e.target.value))}
                        min={8}
                        max={32}
                      />
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Размер табуляции</label>
                    <div className="setting-control">
                      <select 
                        value={editorSettings.tabSize}
                        onChange={(e) => handleEditorSettingChange('tabSize', Number(e.target.value))}
                      >
                        <option value={2}>2</option>
                        <option value={4}>4</option>
                        <option value={8}>8</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Перенос строк</label>
                    <div className="setting-control">
                      <input 
                        type="checkbox"
                        checked={editorSettings.wordWrap}
                        onChange={(e) => handleEditorSettingChange('wordWrap', e.target.checked)}
                      />
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Номера строк</label>
                    <div className="setting-control">
                      <input 
                        type="checkbox"
                        checked={editorSettings.lineNumbers}
                        onChange={(e) => handleEditorSettingChange('lineNumbers', e.target.checked)}
                      />
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Миникарта</label>
                    <div className="setting-control">
                      <input 
                        type="checkbox"
                        checked={editorSettings.minimap}
                        onChange={(e) => handleEditorSettingChange('minimap', e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'terminal' && (
              <div className="terminal-settings">
                <h3>Настройки терминала</h3>
                
                <div className="settings-group">
                  <div className="setting-item">
                    <label>Размер шрифта</label>
                    <div className="setting-control">
                      <input 
                        type="number"
                        value={terminalSettings.fontSize}
                        onChange={(e) => handleTerminalSettingChange('fontSize', Number(e.target.value))}
                        min={8}
                        max={32}
                      />
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Шрифт</label>
                    <div className="setting-control">
                      <select 
                        value={terminalSettings.fontFamily}
                        onChange={(e) => handleTerminalSettingChange('fontFamily', e.target.value)}
                      >
                        <option value="monospace">Monospace</option>
                        <option value="Consolas">Consolas</option>
                        <option value="'Courier New'">Courier New</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Стиль курсора</label>
                    <div className="setting-control">
                      <select 
                        value={terminalSettings.cursorStyle}
                        onChange={(e) => handleTerminalSettingChange('cursorStyle', e.target.value as 'block' | 'underline' | 'line')}
                      >
                        <option value="block">Блок</option>
                        <option value="underline">Подчеркивание</option>
                        <option value="line">Линия</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Мигающий курсор</label>
                    <div className="setting-control">
                      <input 
                        type="checkbox"
                        checked={terminalSettings.cursorBlink}
                        onChange={(e) => handleTerminalSettingChange('cursorBlink', e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'theme' && (
              <div className="theme-settings">
                <h3>Настройки темы</h3>
                
                <div className="settings-group">
                  <div className="setting-item">
                    <label>Тема</label>
                    <div className="setting-control">
                      <select 
                        value={themeSettings.theme}
                        onChange={(e) => handleThemeSettingChange('theme', e.target.value as 'dark' | 'light' | 'auto')}
                      >
                        <option value="dark">Темная</option>
                        <option value="light">Светлая</option>
                        <option value="auto">Системная</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="setting-item">
                    <label>Путь к пользовательской теме</label>
                    <div className="setting-control">
                      <input 
                        type="text"
                        value={themeSettings.customThemePath}
                        onChange={(e) => handleThemeSettingChange('customThemePath', e.target.value)}
                        placeholder="Путь к JSON файлу темы"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'keybindings' && (
              <div className="keybindings-settings">
                <h3>Настройки горячих клавиш</h3>
                <p>Настройка горячих клавиш будет доступна в следующих версиях.</p>
              </div>
            )}
            
            {activeTab === 'extensions' && (
              <div className="extensions-settings">
                <h3>Расширения</h3>
                <p>Поддержка расширений будет добавлена в будущих обновлениях.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="save-button" onClick={handleClose}>Сохранить</button>
          <button className="cancel-button" onClick={handleClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
});

export default Settings;