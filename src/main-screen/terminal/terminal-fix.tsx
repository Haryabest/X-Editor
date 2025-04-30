// Исправленная функция handleTabClick
const handleTabClick = (tab: "issues" | "terminal") => {
  setActiveTab(tab);
  
  // При переключении на вкладку проблем, обновляем диагностику
  if (tab === 'issues') {
    console.log('Переключение на вкладку проблем');
    
    // Принудительно проверяем все редакторы на наличие ошибок
    console.log('Запуск проверки всех редакторов на ошибки');
    checkAllEditorsForErrors();
    
    // Проверяем наличие маркеров в Monaco
    console.log('Проверка наличия маркеров в Monaco');
    checkAllModelsForMarkers();
    
    // Запускаем обновление диагностики
    if (window.forceDiagnosticsRefresh) {
      console.log('Запуск принудительного обновления диагностики');
      window.forceDiagnosticsRefresh();
    }
    
    // Отправляем событие обновления проблем для компонентов, подписанных на него
    document.dispatchEvent(new CustomEvent('force-update-problems'));
  }
}; 