// Определяем язык на основе расширения файла
if (filePath) {
  try {
    // Вызываем функцию с обновленными параметрами
    correctLanguageFromExtension(filePath, editor);
  } catch (error) {
    console.error('Ошибка при определении языка файла:', error);
  }
} 