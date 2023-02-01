# La cible par défaut du Makefile est la cible "help"
.DEFAULT_GOAL := help

# Cibles pour gérer Docker Compose
# Lance Docker Compose en arrière-plan
up:
	docker-compose up -d

# Arrête Docker Compose
down:
	docker-compose down

# Cible pour lancer un shell interactif dans le conteneur "php"
bash:
	docker-compose exec php bash

# Cible d'aide qui décrit les cibles disponibles
help:
	@echo "Cibles disponibles :"
	@grep -E '^#\s.*:.*' $(MAKEFILE_LIST) | sed -e 's/^#\s*//' -e 's/:/ :/'
