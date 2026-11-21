# @service/media

`sellgar.media.service` - data-plane сервис над S3 (SeaweedFS в dev) для публичной доставки
изображений и внутренних write/delete операций над объектами.

## Что здесь находится

- `src/api/images` - public image delivery endpoint для CDN origin.
- `src/file-metadata` - Rabbit adapter к `file_srv`, который получает metadata
  по `fileUuid`.
- `src/storage` - S3 adapter на существующем MinIO SDK. Здесь остаются операции чтения,
  записи и удаления object bytes.
- `docker-compose.yaml` - локальная инфраструктура media service: MinIO для
  object storage, bootstrap bucket `sellgar` и nginx CDN origin/cache.
- `infra/local-cdn/nginx.conf` - конфигурация локального CDN для публичного
  `GET /images/:fileUuid`.

## Правила изменений

- Публичный CDN path использует `GET /images/:fileUuid`.
- Внутренняя запись объекта идет через `PUT /internal/objects` от `admin_gw`;
  браузер не должен вызывать этот endpoint напрямую.
- Не храните каталожную модель и связи с товарами здесь. `product_srv` хранит
  `variant_image`, `file_srv` хранит file metadata, этот сервис работает с
  bytes/object storage.
- Write/delete endpoints должны быть internal-only или закрыты отдельной
  авторизацией; не открывайте их через nginx CDN config.
- RabbitMQ использовать для инфраструктурных событий/команд по metadata, но не
  для передачи bytes.
- HTTP здесь считается внешним data-plane API; внутренние обращения к
  `file_srv` идут через RabbitMQ.
- CDN/nginx конфигурация должна проксировать только публичные read endpoints.
  Internal write/delete routes и Rabbit-driven operations не должны попадать в
  nginx public surface.
- MinIO compose хранить здесь, потому что сервис владеет storage adapter и
  локальным контрактом object storage.

## Проверка

Основная проверка: `yarn build`.
Локальная инфраструктура: `docker compose up -d`.

## Деплой

- Исходники и Yarn root находятся в `code/`; команды выполнять оттуда.
- Dockerfile, `.github/` CI и `helm/` находятся в корне. Рабочая ветка `development`, выпуск `master`.
- CI публикует проверенный image и Helm OCI-пакет среды; Argo автоматически отслеживает dev-пакеты. Prod публикуется только ручным release workflow.
- ConfigMap монтирует `/app/.env`, credentials поступают только из Secret refs. Одна реплика, внутренний порт 8080.
- Dev endpoint — `seaweedfs-all-in-one:8333`, бакет `sellgar`.
  Имена `MINIO_*` env сохранены для совместимости текущего SDK/config-контракта.
- Ingress публикует только `/images` на `cdn.dev.sellgar.ru`; будущий prod —
  `cdn.sellgar.ru`. `/internal/objects` доступен gateway по внутреннему Service.
  S3 credentials Media ограничены бакетом sellgar.
