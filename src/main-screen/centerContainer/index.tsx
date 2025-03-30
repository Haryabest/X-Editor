import React, { forwardRef } from 'react';
import CenterContainerComponent from './centerContainer';
import type { CenterContainerHandle } from './centerContainer';

// Тип для пропсов CenterContainer
export interface CenterContainerProps {
  style?: React.CSSProperties;
  setSelectedFolder: (folderPath: string | null) => void;
  selectedFile: string | null;
  openedFiles: any[];
  setOpenedFiles: (files: any[] | ((prev: any[]) => any[])) => void;
  handleCreateFile: () => void;
  selectedFolder?: string | null;
  onEditorInfoChange?: any;
  onIssuesChange?: any;
  handleFileSelect?: (filePath: string | null) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;
}

// Оборачиваем компонент CenterContainer с помощью forwardRef для передачи ref
const ForwardedCenterContainer = forwardRef<CenterContainerHandle, CenterContainerProps>((props, ref) => {
  // Создаем обычный ref для передачи в editorRef
  const normalRef = React.useRef<any>(null);
  
  // Синхронизируем значения между refs
  React.useEffect(() => {
    if (ref && normalRef.current) {
      if (typeof ref === 'function') {
        ref(normalRef.current);
      } else {
        ref.current = normalRef.current;
      }
    }
  }, [ref, normalRef.current]);
  
  return <CenterContainerComponent {...props} editorRef={normalRef} />;
});

// Экспортируем обернутый компонент
export default ForwardedCenterContainer;

// Реэкспортируем интерфейс для типизации
export type { CenterContainerHandle }; 