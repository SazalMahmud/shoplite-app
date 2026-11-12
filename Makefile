.PHONY: build up down test smoke

build:
	docker compose build

up:
	docker compose up -d --build

down:
	docker compose down -v

test:
	cd services/catalog-api && npm ci && npm test

smoke:
	./scripts/smoke-test.sh