import { invoke } from '@tauri-apps/api/core';

// Define types for different settings categories
export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  fontFamily: string;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'line';
  cursorBlink: boolean;
}

export interface ThemeSettings {
  theme: 'dark' | 'light' | 'auto';
  customThemePath: string;
  monacoTheme: string;
}

export interface UISettings {
  leftPanelWidth: number;
  terminalHeight: number;
  isLeftPanelVisible: boolean;
  isTerminalVisible: boolean;
  activeLeftPanel: string;
  lastOpenedFolder: string | null;
}

// Default settings values
const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  fontFamily: 'Inter'
};

const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  cursorStyle: 'block',
  cursorBlink: true
};

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: 'dark',
  customThemePath: '',
  monacoTheme: 'vs-dark'
};

const DEFAULT_UI_SETTINGS: UISettings = {
  leftPanelWidth: 250,
  terminalHeight: 200,
  isLeftPanelVisible: true,
  isTerminalVisible: true,
  activeLeftPanel: 'explorer',
  lastOpenedFolder: null
};

// Storage keys
const STORAGE_KEYS = {
  EDITOR: 'editor-settings',
  TERMINAL: 'terminal-settings',
  THEME: 'theme-settings',
  UI: 'ui-settings',
  EDITOR_FONT_SIZE: 'editor-font-size'
};

// Load settings from localStorage
export function loadSettings<T>(key: string, defaultValue: T): T {
  try {
    const savedValue = localStorage.getItem(key);
    if (savedValue) {
      return JSON.parse(savedValue);
    }
  } catch (error) {
    console.error(`Error loading settings for ${key}:`, error);
  }
  return defaultValue;
}

// Save settings to localStorage
export function saveSettings<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving settings for ${key}:`, error);
  }
}

// Editor settings
export function getEditorSettings(): EditorSettings {
  return loadSettings<EditorSettings>(STORAGE_KEYS.EDITOR, DEFAULT_EDITOR_SETTINGS);
}

export function saveEditorSettings(settings: Partial<EditorSettings>): void {
  const currentSettings = getEditorSettings();
  const newSettings = { ...currentSettings, ...settings };
  saveSettings(STORAGE_KEYS.EDITOR, newSettings);
  
  // Also save font size separately for backward compatibility
  if (settings.fontSize !== undefined) {
    localStorage.setItem(STORAGE_KEYS.EDITOR_FONT_SIZE, settings.fontSize.toString());
  }
  
  // Apply to Monaco if available
  applySettingsToMonaco(newSettings);
}

// Terminal settings
export function getTerminalSettings(): TerminalSettings {
  return loadSettings<TerminalSettings>(STORAGE_KEYS.TERMINAL, DEFAULT_TERMINAL_SETTINGS);
}

export function saveTerminalSettings(settings: Partial<TerminalSettings>): void {
  const currentSettings = getTerminalSettings();
  const newSettings = { ...currentSettings, ...settings };
  saveSettings(STORAGE_KEYS.TERMINAL, newSettings);
  
  // Notify components about terminal settings change
  window.dispatchEvent(new Event('terminal-settings-changed'));
}

// Theme settings
export function getThemeSettings(): ThemeSettings {
  return loadSettings<ThemeSettings>(STORAGE_KEYS.THEME, DEFAULT_THEME_SETTINGS);
}

export function saveThemeSettings(settings: Partial<ThemeSettings>): void {
  const currentSettings = getThemeSettings();
  const newSettings = { ...currentSettings, ...settings };
  saveSettings(STORAGE_KEYS.THEME, newSettings);
  
  // Apply theme if changed
  if (settings.theme || settings.monacoTheme) {
    applyTheme(newSettings.theme, newSettings.monacoTheme);
    
    // Dispatch a global event for theme change
    window.dispatchEvent(new CustomEvent('monaco-theme-changed', { 
      detail: { 
        theme: newSettings.theme,
        monacoTheme: newSettings.monacoTheme 
      } 
    }));
  }
}

// UI settings
export function getUISettings(): UISettings {
  return loadSettings<UISettings>(STORAGE_KEYS.UI, DEFAULT_UI_SETTINGS);
}

export function saveUISettings(settings: Partial<UISettings>): void {
  const currentSettings = getUISettings();
  const newSettings = { ...currentSettings, ...settings };
  saveSettings(STORAGE_KEYS.UI, newSettings);
}

// Helper functions

// Apply editor settings to Monaco
function applySettingsToMonaco(settings: EditorSettings): void {
  if (window.monaco && window.monaco.editor) {
    const editors = window.monaco.editor.getEditors();
    if (editors.length > 0) {
      editors.forEach((editor: any) => {
        editor.updateOptions({
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          tabSize: settings.tabSize,
          wordWrap: settings.wordWrap ? 'on' : 'off',
          lineNumbers: settings.lineNumbers ? 'on' : 'off',
          minimap: { enabled: settings.minimap }
        });
      });
    }
  }
}

// Available Monaco Editor themes
export const MONACO_THEMES = [
  { id: 'vs', name: 'Light', type: 'light' },
  { id: 'vs-dark', name: 'Dark', type: 'dark' },
  { id: 'hc-black', name: 'High Contrast Dark', type: 'dark' },
  { id: 'hc-light', name: 'High Contrast Light', type: 'light' }
];

// Load additional themes from Monaco
export function registerMonacoThemes(): void {
  try {
    if (window.monaco && window.monaco.editor) {
      // Define additional themes
      window.monaco.editor.defineTheme('github-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#24292e',
          'editor.lineHighlightBackground': '#f1f8ff',
          'editorLineNumber.foreground': '#6e7781',
          'editor.selectionBackground': '#dbe9f9',
        }
      });

      window.monaco.editor.defineTheme('github-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0d1117',
          'editor.foreground': '#c9d1d9',
          'editor.lineHighlightBackground': '#161b22',
          'editorLineNumber.foreground': '#6e7681',
          'editor.selectionBackground': '#3b5070',
        }
      });

      window.monaco.editor.defineTheme('monokai', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '#88846f', fontStyle: 'italic' },
          { token: 'keyword', foreground: '#f92672' },
          { token: 'string', foreground: '#e6db74' },
          { token: 'number', foreground: '#ae81ff' },
          { token: 'type', foreground: '#66d9ef', fontStyle: 'italic' },
        ],
        colors: {
          'editor.background': '#272822',
          'editor.foreground': '#f8f8f2',
          'editor.lineHighlightBackground': '#3e3d32',
          'editorLineNumber.foreground': '#90908a',
          'editor.selectionBackground': '#49483e',
        }
      });
      
      window.monaco.editor.defineTheme('solarized-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '#93a1a1', fontStyle: 'italic' },
          { token: 'keyword', foreground: '#859900' },
          { token: 'string', foreground: '#2aa198' },
          { token: 'number', foreground: '#d33682' },
        ],
        colors: {
          'editor.background': '#fdf6e3',
          'editor.foreground': '#657b83',
          'editor.lineHighlightBackground': '#eee8d5',
          'editor.selectionBackground': '#e9e2cb',
        }
      });
      
      window.monaco.editor.defineTheme('solarized-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '#586e75', fontStyle: 'italic' },
          { token: 'keyword', foreground: '#859900' },
          { token: 'string', foreground: '#2aa198' },
          { token: 'number', foreground: '#d33682' },
        ],
        colors: {
          'editor.background': '#002b36',
          'editor.foreground': '#839496',
          'editor.lineHighlightBackground': '#073642',
          'editor.selectionBackground': '#104554',
        }
      });
      
      window.monaco.editor.defineTheme('dracula', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '#6272a4', fontStyle: 'italic' },
          { token: 'keyword', foreground: '#ff79c6' },
          { token: 'string', foreground: '#f1fa8c' },
          { token: 'number', foreground: '#bd93f9' },
        ],
        colors: {
          'editor.background': '#282a36',
          'editor.foreground': '#f8f8f2',
          'editor.lineHighlightBackground': '#44475a',
          'editor.selectionBackground': '#6272a4',
        }
      });
      
      // Add these to the MONACO_THEMES array
      MONACO_THEMES.push(
        { id: 'github-light', name: 'GitHub Light', type: 'light' },
        { id: 'github-dark', name: 'GitHub Dark', type: 'dark' },
        { id: 'monokai', name: 'Monokai', type: 'dark' },
        { id: 'solarized-light', name: 'Solarized Light', type: 'light' },
        { id: 'solarized-dark', name: 'Solarized Dark', type: 'dark' },
        { id: 'dracula', name: 'Dracula', type: 'dark' }
      );
      
      console.log('Additional Monaco themes registered');
    }
  } catch (error) {
    console.error('Error registering custom Monaco themes:', error);
  }
}

// Apply theme
function applyTheme(theme: 'dark' | 'light' | 'auto', monacoTheme?: string): void {
  // Determine the actual theme to apply
  let effectiveTheme = theme;
  
  if (theme === 'auto') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = prefersDark ? 'dark' : 'light';
  }
  
  // Apply the theme to document
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  
  // Apply to Monaco if available
  if (window.monaco && window.monaco.editor) {
    try {
      // If a specific Monaco theme is provided, use it
      if (monacoTheme) {
        // Apply theme to all currently available editors
        const allEditors = window.monaco.editor.getEditors();
        console.log(`Applying theme ${monacoTheme} to ${allEditors.length} editors`);
        
        // First set the global theme
        window.monaco.editor.setTheme(monacoTheme);
        
        // Then explicitly apply to each editor for immediate effect
        if (allEditors && allEditors.length > 0) {
          allEditors.forEach((editor: any) => {
            try {
              if (editor && typeof editor.updateOptions === 'function') {
                editor.updateOptions({ theme: monacoTheme });
              }
            } catch (error) {
              console.error('Error applying theme to editor:', error);
            }
          });
        }
      } else {
        // Otherwise use theme-dependent default
        const defaultMonacoTheme = effectiveTheme === 'dark' ? 'vs-dark' : 'vs';
        
        // Apply globally
        window.monaco.editor.setTheme(defaultMonacoTheme);
        
        // Apply to all existing editors
        const allEditors = window.monaco.editor.getEditors();
        if (allEditors && allEditors.length > 0) {
          allEditors.forEach((editor: any) => {
            try {
              if (editor && typeof editor.updateOptions === 'function') {
                editor.updateOptions({ theme: defaultMonacoTheme });
              }
            } catch (error) {
              console.error('Error applying default theme to editor:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error applying Monaco theme:', error);
    }
  }
}

// Check if a path exists (for loading last folder)
export async function checkPathExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('file_exists', { path });
  } catch (error) {
    console.error('Error checking if path exists:', error);
    return false;
  }
}

// Initialize settings on app start
export function initializeSettings(): void {
  // Register additional Monaco themes
  registerMonacoThemes();
  
  // Load and apply theme
  const themeSettings = getThemeSettings();
  applyTheme(themeSettings.theme, themeSettings.monacoTheme);
  
  // Set up listener for system theme changes if using auto theme
  if (themeSettings.theme === 'auto') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme(themeSettings.theme, themeSettings.monacoTheme);
    });
  }
} 