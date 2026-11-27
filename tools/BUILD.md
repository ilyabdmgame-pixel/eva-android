# Сборка и проверка Евы

Основная сборка использует Gradle. Команда `python3 tools/build_offline.py --profile /path/to/android-build.json` собирает то же приложение на компьютере с заранее подготовленным Android SDK. Этот вариант подходит и для ARM64 Linux. Подготовь ровно те ARM64-зависимости, которые описаны в README.

## Локальный профиль сборки

Все пути в примере условные. Для AAPT нужен двоичный файл для архитектуры компьютера. Для JDK нужен каталог с `bin/javac`, `bin/jar` и `bin/java`. Архивы Vosk и JNA должны соответствовать зависимостям Gradle. Задай SHA-256 своего сертификата в виде 64 шестнадцатеричных цифр.

```json
{
  "jdk": "/opt/jdk-17",
  "androidJar": "/opt/android/platforms/android-35/android.jar",
  "aapt": "/opt/android/build-tools/35.0.0/aapt",
  "d8Jar": "/opt/android/build-tools/35.0.0/lib/d8.jar",
  "apkSignerJar": "/opt/android/build-tools/35.0.0/lib/apksigner.jar",
  "runtimeDeps": "/opt/eva/runtime-arm64",
  "aars": ["/opt/eva/vosk-android.aar", "/opt/eva/jna.aar"],
  "keyStore": "/private/eva.jks",
  "keyStorePasswordFile": "/private/keystore-password",
  "certificateSha256": "<SHA-256 сертификата>",
  "outputDirectory": "/path/to/outputs"
}
```

Пароль читается из файла. Профиль и файл пароля должны быть доступны владельцу сборки. При наличии нескольких ключей в хранилище используй отдельное хранилище для нужного приложения. Для обновлений существующей установки должны совпадать идентификатор Android и подпись. Для другой сборки можно задать `applicationId`, `versionCodeOffset`, `resourceJar`, `libraryDirs` и `nativeLibraries`. Если меняется идентификатор пакета, проверь путь загрузчика встроенного PRoot.

Скрипт заново компилирует Java и DEX, собирает ресурсы через AAPT, упаковывает исходники по тому же списку, что и Gradle, проверяет сертификат, содержимое и контрольные суммы, затем перемещает готовый APK в каталог назначения. Аргумент `--output /path/to/update.apk` задаёт конкретный файл. `project install-check` отдельно сверяет его с подключённым устройством. Для сборки и проверки содержимого APK достаточно компьютера.

## Графика и регрессионные проверки

- `bash tools/check.sh` запускает JS, Python и JVM-тесты. Для JVM нужен JDK 17 в PATH или в `JAVA_HOME`.
- `node tools/verify_ui.mjs app/build/ui-check` открывает сборочные исходники в изолированном Chromium с WebGL, играет сцену, проверяет системный диспетчер и основной чат. Укажи `CHROME_BIN`, если команда браузера отличается от `google-chrome`.
- Для покадрового просмотра персонажа запусти `python3 -m http.server 8000 --bind 127.0.0.1` из корня проекта и открой `http://127.0.0.1:8000/tools/preview_eva_motion.html`. На странице можно менять занятие и фазу движения.
- `python3 tools/audit_apk.py /path/to/update.apk` сравнивает упакованную комнату, персонажа, чат, ресурсы и манифест миграции с рабочей копией, проверяет архив среды и имена личных файлов. Для такого сравнения используй исходники именно той версии, из которой собран APK.
