# Media service

## Сборка и доставка

Команды Yarn выполняются из `code/`. Dockerfile и `.github/workflows` находятся в корне, конфигурация Kubernetes — в `helm/`. Push в `development` запускает проверки, публикацию образа и Helm OCI-пакета; dev Argo CD автоматически применяет новую версию. Релиз в prod запускается вручную из `master` с digest проверенного кандидата. Prod пока не развёрнут.

Сервер читает `/app/.env` из ConfigMap. Пароли передаются ссылками на Kubernetes Secrets и не включаются в образ или Helm-пакет. Операционный `/health` слушает внутренний порт 8080 и проверяет зависимости.

Ingress публикует только `/images`; загрузка `/internal/objects` доступна по внутреннему Service. CI проверяет Sharp, RabbitMQ и отказ readiness без MinIO; успешная запись и чтение проверяются отдельно на dev MinIO при приёмке развёртывания.
