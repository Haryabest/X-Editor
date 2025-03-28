/**
 * Утилиты для работы с файлами
 */

/**
 * Конвертирует размер файла в байтах в читаемый формат (KB, MB, GB)
 * @param sizeInBytes - Размер файла в байтах
 * @returns Отформатированная строка с размером файла
 */
export function convertFileSizeToPrettyFormat(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
} 