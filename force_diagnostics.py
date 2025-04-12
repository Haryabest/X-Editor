import subprocess
import sys
import os

# Получаем текущую директорию
current_dir = os.getcwd()
print(f"Текущая директория: {current_dir}")

# Проверяем наличие установленных пакетов для Python LSP
try:
    import pylsp
    print("Python Language Server уже установлен")
except ImportError:
    print("Устанавливаем Python Language Server...")
    subprocess.call([sys.executable, "-m", "pip", "install", "python-lsp-server"])

# Проверяем ошибки в файле
try:
    with open("test_error.py", "r", encoding="utf-8") as f:
        content = f.read()
        print("Содержимое файла test_error.py:")
        print(content)
except Exception as e:
    print(f"Ошибка при чтении файла: {e}")

# Пробуем запустить Python LSP в фоне для диагностики
try:
    print("Запускаем Python LSP для анализа файла...")
    from pylsp import _utils
    print("Доступные команды в pylsp:", dir(pylsp))
    print("\nВерсия pylsp:", pylsp.__version__)
except Exception as e:
    print(f"Ошибка при использовании pylsp: {e}")

print("\nПроверка завершена.") 