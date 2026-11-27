# Публичный выпуск Android

Пакет `org.evaassistant.app` обновляется одним сертификатом. Его публичный отпечаток хранится в `signer.sha256`. GitHub собирает APK на пустом Linux runner. Хранилище ключа и файл пароля нужны только на компьютере, где подписывают выпуск.

## Сборка кандидата

Внеси изменения в исходники и укажи версию в `app/build.gradle`. После обычного коммита поставь тег на этот коммит. Например, для 0.106 команды такие.

```sh
git tag candidate-0.106
git push origin candidate-0.106
```

В Actions появится запуск **Public Android release**. Он подготовит свежую Linux-среду из закреплённых пакетов, воспроизведёт четыре нативные библиотеки, сверит официальную русскую модель Vosk и соберёт release APK через Gradle 8.9 и JDK 17. После zipalign и двух проверок появится артефакт `eva-candidate-RUN_ID-ATTEMPT` с `Eva-unsigned.apk` и `candidate.json`. Повторная попытка того же запуска получает отдельное имя. Для исправления исходников используй новый тег, например `candidate-0.106-r2`.

## Получение и подпись

Нужны Python 3.11+, JDK 17 и `apksigner.jar` из Android Build Tools 35.0.0. Работай в исходниках коммита кандидата. Для загрузки подойдёт авторизованный доступ GitHub на чтение Actions. Скрипт учитывает `GH_TOKEN` или `GITHUB_TOKEN`, сверяет запуск, SHA-256 ZIP из GitHub API и SHA-256 APK до подписания.

```sh
python3 tools/distribution/fetch_candidate.py OWNER/REPO RUN_ID /tmp/eva-candidate
```

Если ZIP артефакта уже скачан из интерфейса GitHub, передай `--archive /path/to/artifact.zip`. Для публичного проекта без входа в GitHub доступен запасной `--public-relay` через nightly.link с той же проверкой контрольной суммы у GitHub. Если выбираешь между повторными запусками, укажи `--attempt 2`. Результат сохраняется в новый каталог.

```sh
python3 tools/distribution/release.py sign /tmp/eva-candidate \
  --apksigner-jar "$ANDROID_HOME/build-tools/35.0.0/lib/apksigner.jar" \
  --keystore /private/eva-release.jks --password-file /private/store-password \
  --output /tmp/Eva-0.106-arm64.apk
```

При нескольких ключах укажи `--alias`, при отдельном пароле ключа добавь `--key-password-file`. При нестандартной установке JDK укажи `--java /path/to/bin/java`.

Команда ещё раз проверит содержимое APK по публичным исходникам и сверит сертификат. Подпись делает библиотека apksig из Android SDK по исходным байтам ZIP. На диске появится квитанция `tools/distribution/receipts/v0.106.json`, в которой есть ссылка на запуск, исходный коммит, оба SHA-256 и маленький публичный блок подписи. Из APK его и так может прочитать любой получатель. Подписанный файл дополнительно проходит обычный `apksigner verify` для v2 и v3. Повторный запуск может использовать уже выпущенную квитанцию.

## Публикация

Между коммитом кандидата и тегом выпуска добавь единственный новый файл квитанции. Проверь имена файлов перед отправкой.

```sh
git add tools/distribution/receipts/v0.106.json
git diff --cached --name-only
git commit -m 'Publish signature for Eva 0.106'
git tag v0.106
git push origin HEAD:main
git push origin v0.106
```

Workflow сверит оба тега, скачает тот же артефакт из конкретной попытки, восстановит подписанный APK и проверит SHA-256, сертификат, v2/v3, выравнивание, файлы приложения и библиотеки. В проверенный черновик выпуска попадут APK, SHA256SUMS, инструкции и соответствующие исходники Linux и нативных компонентов. Для восстановления исходников Linux объедини все части в порядке имён. Оборванную выгрузку в черновик можно запустить повторно. При совпадении всех хэшей опубликованный выпуск проходит повторную проверку.

Кандидат хранится в Actions до 60 дней с учётом настроек репозитория. Если срок истёк до подписи, подними новый кандидат на актуальных исходниках и подпиши его квитанцию. После публикации APK и контрольные суммы доступны в Releases.

## Проверка воспроизведения

```sh
python3 tools/distribution/release.py restore /tmp/eva-candidate \
  --apksigner-jar "$ANDROID_HOME/build-tools/35.0.0/lib/apksigner.jar" \
  --output /tmp/Eva-restored.apk
python3 tools/distribution/check_signing.py \
  --android-jar "$ANDROID_HOME/platforms/android-35/android.jar" \
  --aapt2 "$ANDROID_HOME/build-tools/35.0.0/aapt2" \
  --apksigner-jar "$ANDROID_HOME/build-tools/35.0.0/lib/apksigner.jar"
```

Вторая команда собирает маленькое приложение и одноразовый ключ, сверяет оба файла побайтово и проверяет отказ Android SDK при изменении содержимого. Формат блока подписи и параметры официального проверяющего инструмента описаны в документации Android. [Формат APK Signing Block](https://source.android.com/docs/security/features/apksigning/v2) · [apksigner](https://developer.android.com/tools/apksigner)
