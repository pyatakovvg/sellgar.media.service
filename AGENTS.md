# @service/media

`sellgar.media.service` - data-plane сервис над MinIO для публичной доставки
изображений и внутренних write/delete операций над объектами.

## Что здесь находится

- `src/api/images` - public image delivery endpoint для CDN origin.
- `src/file-metadata` - Rabbit adapter к `file_srv`, который получает metadata
  по `fileUuid`.
- `src/storage` - MinIO adapter. Здесь должны оставаться операции чтения,
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
