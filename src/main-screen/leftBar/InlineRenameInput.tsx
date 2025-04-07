import React, { useEffect, useRef, useState } from 'react';

interface InlineRenameInputProps {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  isNewItem?: boolean;
}

const InlineRenameInput: React.FC<InlineRenameInputProps> = ({
  initialValue,
  onSubmit,
  onCancel,
  isNewItem = false
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // При отображении компонента автоматически устанавливаем фокус на поле ввода
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      
      // Если создаем новый элемент, то выбираем все, иначе устанавливаем курсор 
      // перед расширением файла
      if (isNewItem) {
        inputRef.current.select();
      } else {
        const lastDotIndex = initialValue.lastIndexOf('.');
        if (lastDotIndex > 0) {
          // Файл с расширением - выделяем только имя файла без расширения
          inputRef.current.setSelectionRange(0, lastDotIndex);
        } else {
          // Папка или файл без расширения - выделяем все
          inputRef.current.select();
        }
      }
    }
  }, [initialValue, isNewItem]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(value);
      } else {
        onCancel();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  
  const handleBlur = () => {
    // При потере фокуса применяем изменения, если значение не пустое
    if (value.trim()) {
      onSubmit(value);
    } else {
      onCancel();
    }
  };
  
  return (
    <input
      ref={inputRef}
      type="text"
      className="inline-rename-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
};

export default InlineRenameInput; 