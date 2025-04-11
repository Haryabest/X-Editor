import { useState, useEffect, useRef, useContext, forwardRef } from 'react';
import { X, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FontSizeContext } from '../../../App';
import './Settings.css';
import { 
  EditorSettings, 
  TerminalSettings, 
  ThemeSettings,
  getEditorSettings,
  getTerminalSettings,
  getThemeSettings,
  saveEditorSettings,
  saveTerminalSettings,
  saveThemeSettings,
  MONACO_THEMES
} from '../../../utils/settingsManager';

// Интерфейс для props компонента
interface SettingsProps {
  isVisible: boolean;
  onClose: () => void;
}

// Используем forwardRef для передачи ref
const Settings = forwardRef<HTMLDivElement, SettingsProps>(({ isVisible, onClose }, ref) => {
  // Получаем контекст настроек шрифта
  const { fontSize: contextFontSize, setFontSize: setContextFontSize } = useContext(FontSizeContext);
  
  // Local state for active tab, initialized from context if available or default to 'editor'
  const [activeTab, setActiveTab] = useState('editor');
  
  // Состояние для системных шрифтов
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [filteredFonts, setFilteredFonts] = useState<string[]>([]);
  const [loadingFonts, setLoadingFonts] = useState(false);
  
  // Сохраняем первоначальные настройки для функции отмены
  const [initialEditorSettings, setInitialEditorSettings] = useState<EditorSettings | null>(null);
  const [initialTerminalSettings, setInitialTerminalSettings] = useState<TerminalSettings | null>(null);
  const [initialThemeSettings, setInitialThemeSettings] = useState<ThemeSettings | null>(null);
  
  // Настройки для разных разделов - инициализируем из settings manager
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    const settings = getEditorSettings();
    // Ensure we use context font size if available
    return {
      ...settings,
      fontSize: contextFontSize || settings.fontSize
    };
  });
  
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>(() => {
    return getTerminalSettings();
  });
  
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    const settings = getThemeSettings();
    // Ensure monacoTheme has a valid value (for compatibility with older settings)
    if (!settings.monacoTheme) {
      settings.monacoTheme = settings.theme === 'light' ? 'vs' : 'vs-dark';
    }
    return settings;
  });
  
  // Загружаем системные шрифты
  useEffect(() => {
    if (isVisible) {
      loadSystemFonts();
    }
  }, [isVisible]);
  
  // Фильтруем шрифты при изменении поискового запроса
  useEffect(() => {
    if (fontSearchQuery.trim() === '') {
      setFilteredFonts(systemFonts);
    } else {
      const query = fontSearchQuery.toLowerCase();
      setFilteredFonts(systemFonts.filter(font => 
        font.toLowerCase().includes(query)
      ));
    }
  }, [fontSearchQuery, systemFonts]);
  
  // Сохраняем первоначальные настройки при открытии
  useEffect(() => {
    if (isVisible) {
      setInitialEditorSettings({...editorSettings});
      setInitialTerminalSettings({...terminalSettings});
      setInitialThemeSettings({...themeSettings});
    }
  }, [isVisible]);
  
  // Применяем настройки в реальном времени к Monaco Editor
  useEffect(() => {
    if (isVisible) {
      // Применяем настройки Monaco Editor
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach((editor: any) => {
            editor.updateOptions({
              fontSize: editorSettings.fontSize,
              fontFamily: editorSettings.fontFamily,
              tabSize: editorSettings.tabSize,
              wordWrap: editorSettings.wordWrap ? 'on' : 'off',
              lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
              minimap: { enabled: editorSettings.minimap }
            });
          });
        }
      }
      
      // Сохраняем размер шрифта в localStorage для других компонентов
      localStorage.setItem('editor-font-size', editorSettings.fontSize.toString());
    }
  }, [editorSettings, isVisible]);
  
  // Загрузка системных шрифтов
  const loadSystemFonts = async () => {
    try {
      setLoadingFonts(true);
      const fonts = await invoke<string[]>('get_system_fonts');
      setSystemFonts(fonts);
      setFilteredFonts(fonts);
      setLoadingFonts(false);
    } catch (error) {
      console.error('Ошибка при загрузке системных шрифтов:', error);
      setLoadingFonts(false);
      // В случае ошибки используем базовый набор шрифтов
      const fallbackFonts = [
        'Inter', 'Arial', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 
        'Consolas', 'Courier New', 'Georgia', 'Impact', 'Segoe UI', 
        'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
      ];
      setSystemFonts(fallbackFonts);
      setFilteredFonts(fallbackFonts);
    }
  };
  
  // Обработчики изменения настроек
  const handleEditorSettingChange = (key: keyof EditorSettings, value: any) => {
    setEditorSettings(prev => ({ ...prev, [key]: value }));
    
    // Если меняем размер шрифта, обновляем localStorage
    if (key === 'fontSize') {
      localStorage.setItem('editor-font-size', value.toString());
    }
  };

  const handleTerminalSettingChange = (key: keyof TerminalSettings, value: any) => {
    setTerminalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleThemeSettingChange = (key: keyof ThemeSettings, value: any) => {
    const newSettings = { ...themeSettings, [key]: value };
    setThemeSettings(newSettings);
    
    // Apply monaco theme changes immediately for preview
    if (key === 'monacoTheme' && window.monaco && window.monaco.editor) {
      window.monaco.editor.setTheme(value);
    }
  };
  
  // Обработчик сохранения настроек
  const handleSaveSettings = () => {
    // Сохраняем настройки используя settingsManager
    saveEditorSettings(editorSettings);
    saveTerminalSettings(terminalSettings);
    saveThemeSettings(themeSettings);
    
    // Обновляем контекст размера шрифта
    setContextFontSize();
    
    // Закрываем модаль
    if (onClose) onClose();
  };
  
  // Обработчик отмены настроек
  const handleCancelSettings = () => {
    // Восстанавливаем первоначальные настройки
    if (initialEditorSettings) {
      setEditorSettings(initialEditorSettings);
      
      // Восстанавливаем размер шрифта в редакторе
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach((editor: any) => {
            editor.updateOptions({
              fontSize: initialEditorSettings.fontSize,
              fontFamily: initialEditorSettings.fontFamily
            });
          });
        }
      }
      
      // Сохраняем размер шрифта в localStorage
      localStorage.setItem('editor-font-size', initialEditorSettings.fontSize.toString());
    }
    
    if (initialTerminalSettings) setTerminalSettings(initialTerminalSettings);
    if (initialThemeSettings) setThemeSettings(initialThemeSettings);
    
    // Закрываем модаль
    if (onClose) onClose();
  };
  
  // Check combined visibility after all hooks
  if (!isVisible) return null;

  return (
    <div className="settings-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="settings-modal" ref={ref}>
        <div className="settings-header">
          <h2>Настройки</h2>
          <button className="close-button" onClick={handleCancelSettings}>
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
                  
                  <div className="setting-item setting-item-font">
                    <label>Шрифт</label>
                    <div className="setting-control font-control">
                      <div className="font-search">
                        <Search size={14} />
                        <input
                          type="text"
                          value={fontSearchQuery}
                          onChange={(e) => setFontSearchQuery(e.target.value)}
                          placeholder="Поиск шрифтов..."
                        />
                      </div>
                      
                      <div className="font-list">
                        {loadingFonts ? (
                          <div className="loading-fonts">Загрузка шрифтов...</div>
                        ) : (
                          filteredFonts.map(font => (
                            <div 
                              key={font} 
                              className={`font-item ${editorSettings.fontFamily === font ? 'selected' : ''}`}
                              onClick={() => handleEditorSettingChange('fontFamily', font)}
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </div>
                          ))
                        )}
                      </div>
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
                  
                  <div className="setting-item setting-item-font">
                    <label>Шрифт</label>
                    <div className="setting-control font-control">
                      <div className="font-search">
                        <Search size={14} />
                        <input
                          type="text"
                          value={fontSearchQuery}
                          onChange={(e) => setFontSearchQuery(e.target.value)}
                          placeholder="Поиск шрифтов..."
                        />
                      </div>
                      
                      <div className="font-list">
                        {loadingFonts ? (
                          <div className="loading-fonts">Загрузка шрифтов...</div>
                        ) : (
                          filteredFonts.map(font => (
                            <div 
                              key={font} 
                              className={`font-item ${terminalSettings.fontFamily === font ? 'selected' : ''}`}
                              onClick={() => handleTerminalSettingChange('fontFamily', font)}
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </div>
                          ))
                        )}
                      </div>
                      
  
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
                    <label>Тема редактора кода</label>
                    <div className="setting-control">
                      <select 
                        value={themeSettings.monacoTheme}
                        onChange={(e) => handleThemeSettingChange('monacoTheme', e.target.value)}
                        className="monaco-theme-select"
                      >
                        {MONACO_THEMES.map(theme => (
                          <option key={theme.id} value={theme.id}>
                            {theme.name}
                          </option>
                        ))}
                      </select>
                      
                      <div className={`theme-preview ${themeSettings.monacoTheme}`}>
                        <div>
                          <span className="comment-token">// {MONACO_THEMES.find(t => t.id === themeSettings.monacoTheme)?.name}</span>
                        </div>
                        <div>
                          <span className="keyword-token">import</span> <span className="normal-token">{'{'}</span> <span className="component-token">useState</span>, <span className="component-token">useEffect</span> <span className="normal-token">{'}'}</span> <span className="keyword-token">from</span> <span className="string-token">'react'</span>;
                        </div>
                        <div>
                          <span className="keyword-token">function</span> <span className="function-token">Example</span><span className="normal-token">()</span> <span className="normal-token">{'{'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;<span className="keyword-token">const</span> <span className="normal-token">[</span><span className="variable-token">count</span>, <span className="function-token">setCount</span><span className="normal-token">]</span> <span className="operator-token">=</span> <span className="function-token">useState</span><span className="normal-token">(</span><span className="number-token">0</span><span className="normal-token">);</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;<span className="keyword-token">return</span> <span className="normal-token">(</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;<span className="component-token">{'<div>'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="component-token">{'<p>'}</span><span className="string-token">Счётчик: {'{'}count{'}'}</span><span className="component-token">{'</p>'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="component-token">{'<button'}</span> <span className="attribute-token">onClick</span><span className="normal-token">={'{() => </span><span className="function-token">setCount</span><span className="normal-token">(count + 1)}</span><span className="normal-token">'}</span><span className="component-token">{'>'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="normal-token">Нажми меня</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="component-token">{'</button>'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;&nbsp;&nbsp;<span className="component-token">{'</div>'}</span>
                        </div>
                        <div>
                          &nbsp;&nbsp;<span className="normal-token">);</span>
                        </div>
                        <div>
                          <span className="normal-token">{'}'}</span>
                        </div>
                      </div>
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
            
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="save-button" onClick={handleSaveSettings}>Сохранить</button>
          <button className="cancel-button" onClick={handleCancelSettings}>Отмена</button>
        </div>
      </div>
    </div>
  );
});

export default Settings;