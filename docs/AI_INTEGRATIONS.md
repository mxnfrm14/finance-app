# Connexions IA personnelles

## Fonctionnement implémenté

Chaque utilisateur enregistre ses connexions dans `AiConnection`, avec une clé primaire composée de `userId` et `provider`. Le fournisseur actif est enregistré sur `User.aiProvider`. Les routes utilisent exclusivement l'identifiant issu de la session authentifiée. Aucune clé globale de `AppConfig` ou de l'environnement n'est utilisée par l'agent, et aucune connexion d'un autre fournisseur n'est choisie automatiquement.

Les clés sont chiffrées en AES-256-GCM avec un nonce aléatoire et des données authentifiées associant l'utilisateur au fournisseur. Les lectures publiques ne renvoient que `hasApiKey`. Une clé laissée vide conserve la clé du même fournisseur ; changer d'URL demande de ressaisir la clé pour éviter de l'envoyer à une nouvelle destination par inadvertance. Supprimer une connexion retire également sa clé.

| Fournisseur | URL | Protocole |
|---|---|---|
| Anthropic | `https://api.anthropic.com/v1/messages` | Messages |
| OpenAI | `https://api.openai.com/v1/responses` | Responses |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1/chat/completions` | Chat Completions |
| Compatible OpenAI | URL de base personnalisée + `/responses` ou `/chat/completions` | Choix explicite |

Ollama a été retiré. Le champ personnalisé n'est pas un convertisseur entre protocoles : le fournisseur doit implémenter le protocole sélectionné et le modèle doit prendre en charge les appels d'outils.

Le test dans les paramètres envoie une courte demande, attend un appel d'outil puis une réponse complète. Il ne consulte pas le portefeuille et ne sauvegarde pas le formulaire. Il peut consommer du crédit API.

## Installation et migration

1. Configurer une valeur aléatoire stable de 32 caractères ou plus dans `AI_ENCRYPTION_KEY`. Sans valeur, `AUTH_SECRET` (ou `NEXTAUTH_SECRET`) est utilisé. Sauvegarder le secret avec les sauvegardes de la base. Un changement de secret impose de ressaisir les clés personnelles.
2. Générer le client : `pnpm prisma:generate`.
3. Appliquer la migration lors du déploiement : `pnpm prisma:deploy`.
4. Chaque utilisateur saisit sa propre configuration dans Paramètres. Les anciennes clés globales n'ont aucun propriétaire vérifiable et ne sont donc pas copiées. Elles restent en base mais ne sont plus lues par l'agent ; l'administrateur peut les retirer après sauvegarde.

Avec Docker Compose, utiliser l'image de maintenance dédiée : `docker compose build app migrate`, puis `docker compose run --rm migrate`, puis `docker compose up -d --no-deps app`. Le service `postgres` doit être démarré et sain. Ne pas lancer la nouvelle application si la migration échoue. Les secrets `.env`, les dépendances et les builds du PC sont exclus du contexte Docker ; le fichier `.env` du serveur reste fourni à Compose au lancement.

Les variables `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `NVIDIA_API_KEY` et `OLLAMA_BASE_URL` ne sont plus nécessaires à l'application. Ne pas placer de clé personnelle dans la configuration Docker commune.

Les domaines usuels OpenAI, NVIDIA, OpenRouter, Mistral, Groq, DeepSeek, xAI et Google sont autorisés pour les API personnalisées. Pour une autre destination, renseigner `AI_ALLOWED_API_ORIGINS` côté serveur, par exemple `https://api.example.com , http://192.168.1.20:8000`. Indiquer des origines exactes sans chemin. Les redirections sont refusées pour éviter de transmettre une clé à une autre destination. Autoriser une origine signifie que l'administrateur fait confiance à ce service, y compris à sa résolution DNS.

## Abonnements : état et prérequis

Les cartes ChatGPT et Claude expliquent les possibilités ; elles ne représentent pas des connexions actives. Aucun OAuth, import de jeton, abonnement partagé ou appel à un endpoint privé n'est implémenté. Une clé API peut utiliser les crédits éventuellement inclus dans un forfait éligible, selon les conditions du fournisseur.

L'application est hébergée sur un serveur au domicile et utilisée par plusieurs personnes. Cela ne doit pas être assimilé automatiquement à une installation personnelle locale chez chaque utilisateur.

- **ChatGPT** : le parcours officiel Sign in with ChatGPT peut autoriser les requêtes Responses au titre du forfait. L'offre publique documentée vise les applications open source et personnelles locales ; l'application hébergée doit obtenir l'accès approprié avant intégration. Ensuite, prévoir des connexions OAuth distinctes par utilisateur, PKCE, state, nonce, validation OIDC, renouvellement, révocation, choix des modèles éligibles et gestion des limites. Ne pas utiliser les endpoints privés `backend-api`.
- **Claude** : l'usage personnel de Claude Agent SDK/`claude -p` avec un forfait n'autorise pas automatiquement un produit tiers à proposer une connexion Claude. La documentation demande une approbation préalable pour ce cas et propose l'API par défaut. Héberger le binaire Claude Code non modifié est une autre modalité encadrée, pas un remplacement automatique de l'API Messages du chat financier.

Sources officielles vérifiées le 4 novembre 2026 :

- [ChatGPT : périmètre et accès](https://developers.openai.com/siwc/token-sharing-open-source)
- [ChatGPT : requêtes Responses avec autorisation du forfait](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Claude : prérequis Agent SDK et restriction des connexions tierces](https://code.claude.com/docs/en/agent-sdk/quickstart)
- [Claude : conditions d'hébergement du binaire et identifiants](https://code.claude.com/docs/en/legal-and-compliance)
- [Claude : utilisation personnelle du SDK avec un forfait](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

## Validation

`pnpm test:ai` couvre le chiffrement lié à l'utilisateur et au fournisseur, l'isolation des connexions, la suppression, la conservation des clés lors des changements de fournisseur, les changements de destination, les restrictions d'URL, les appels d'outils avec les trois protocoles, les identifiants fournis par le serveur, les arguments JSON invalides et les flux interrompus. Ces tests utilisent des réponses simulées, sans API payante ni base de données réelle.
