import React, { useEffect, useRef, useState } from 'react';

interface InlineRenameInputProps {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  isNewItem?: boolean;
  onChange?: (value: string) => void;
}

const InlineRenameInput: React.FC<InlineRenameInputProps> = ({
  initialValue,
  onSubmit,
  onCancel,
  isNewItem = false,
  onChange
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      
      if (isNewItem) {
        inputRef.current.select();
      } else {
        const lastDotIndex = initialValue.lastIndexOf('.');
        if (lastDotIndex > 0) {
          inputRef.current.setSelectionRange(0, lastDotIndex);
        } else {
          inputRef.current.select();
        }
      }
    }
  }, []);
  
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
    if (value.trim()) {
      onSubmit(value);
    } else {
      onCancel();
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }
  };
  
  return (
    <input
      ref={inputRef}
      type="text"
      className="inline-rename-input"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      autoFocus
    />
  );
};

export default InlineRenameInput; 