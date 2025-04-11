import React, { useEffect, useRef } from 'react';

// Effect for handling theme changes
useEffect(() => {
  const handleThemeChange = (event: CustomEvent) => {
    const { monacoTheme } = event.detail;
    if (editorRef.current) {
      console.log(`MonacoEditor: Applying theme ${monacoTheme} to editor for ${path}`);
      editorRef.current.updateOptions({ theme: monacoTheme });
    }
  };

  window.addEventListener('monaco-theme-changed', handleThemeChange as EventListener);
  
  return () => {
    window.removeEventListener('monaco-theme-changed', handleThemeChange as EventListener);
  };
}, [path]); 