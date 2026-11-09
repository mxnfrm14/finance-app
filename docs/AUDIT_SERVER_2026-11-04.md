# Audit de la version serveur — Bourse

Date : 4 novembre 2026. Référence : `/home/homelab/finance-app`, sur `homelab@100.10.4.14`, commit `45903ba` (« initial commit »). Le dépôt serveur était propre lors de la récupération.

**Ce rapport remplace l'audit de l'ancienne version locale.** Les deux projets ont des fonctionnalités, schémas et contrôles d'accès différents. Les conclusions de l'ancien audit ne doivent pas être attribuées à cette version.

**Récupération et état du développement**

Mise à jour du 4 novembre 2026 : le PC utilise désormais une connexion directe à
`100.10.4.14:5432`, vérifiée avec les identifiants existants et une requête `SELECT 1`.
La commande `db:tunnel` a été retirée. Les mentions du tunnel ci-dessous décrivent
la configuration initiale lors de la récupération.

- La source versionnée du serveur a été copiée sur ce PC après sauvegarde complète de l'ancien projet, de ses fichiers d'environnement et de ses bases locales dans `.local-backups/local-before-server-20261104.tar.gz`. Les dépendances et caches de compilation ne font pas partie de cette archive.
- L'ancien conteneur PostgreSQL original, précédemment conservé à l'arrêt, a été remis en service sous son nom `bourse-postgres-dev`.
- Le conteneur créé pour l'autre version locale est arrêté et conservé sous `bourse-postgres-dev-local-schema-20261104`, avec son volume.
- La connexion du PC passe par un tunnel SSH, de `127.0.0.1:15432` au port 5432 du serveur. L'environnement local a été adapté sans publication des secrets.
- Les migrations et le schéma du code serveur correspondent exactement à la base restaurée. Aucun migrate deploy, migrate dev ou seed n'a été exécuté sur cette base durant la récupération.
- Les dépendances du verrou pnpm serveur sont installées. Le client Prisma a été généré.
- Adaptations locales : commande `db:tunnel`, documentation, exclusions des sauvegardes, autorisations des scripts de dépendances pour pnpm 12, et correction de deux clauses d'upsert du seed pour employer la clé composée `userId_slug`. Cette dernière correction résout les deux erreurs TypeScript de la source serveur ; le seed n'a pas été exécuté.
- L'historique Git local n'a pas été remplacé. La source de référence de cette récupération est le commit serveur indiqué ci-dessus.

**Périmètre et méthode**

11 pages, 16 routes API, 26 méthodes HTTP exportées et 14 modèles Prisma ont été inventoriés. Lecture des pages, composants métier, API, authentification, calculs, outils de l'agent, fournisseurs IA et configurations Docker/Nginx.

Vérifications effectuées : TypeScript, installation figée, génération Prisma, état des migrations, comparaison du schéma réel, requêtes de lecture sur les 14 modèles, page de connexion HTTP, redirection d'une API anonyme et simulations isolées de fonctions réelles. Les simulations emploient une couche Prisma et un agent factices ; aucun appel IA payant, aucune modification de compte, de transaction ou de configuration IA réelle n'a été effectué.

Les fonctionnalités ci-dessous sont classées d'après le code et ses raccordements. Les parcours authentifiés, services de marché et fournisseurs IA n'ont pas fait l'objet d'un test complet dans un navigateur. Le build de production et les images Docker ne sont pas validés par cet audit.

**Inventaire fonctionnel de la bonne version**

| Domaine | Fonctionnalités raccordées | Limites / état réel |
| --- | --- | --- |
| Connexion | Email et mot de passe, bcrypt, JWT de 30 jours, déconnexion, protection des pages et API | Fournisseur Credentials uniquement ; les tables Account/Session/VerificationToken ne signifient pas qu'OAuth, MFA ou une récupération par email sont actifs |
| Inscription | Formulaire et API publics, validation Zod, mot de passe d'au moins huit caractères, création d'un membre | L'inscription reste ouverte ; le premier inscrit ne devient pas automatiquement administrateur dans cette version |
| Administration | Page réservée aux administrateurs, liste des utilisateurs, création de membres/administrateurs, réinitialisation de leur mot de passe | Pas de suppression d'utilisateur ou de changement de rôle existant repérés dans les routes de cette version |
| Courtiers | Liste et ajout personnels, unicité par utilisateur et slug, sélection dans une position | Bouton de suppression présent mais renvoie « à venir » ; aucune API DELETE de courtier |
| Positions | Création avec recherche d'instrument, compte, courtier, devise, secteur, géographie, notes ; gestion des doublons ; portefeuille regroupé par ISIN et réparti entre comptes/courtiers | API de lecture/modification/archivage avec contrôle propriétaire ; interface de détail principalement dépliée dans le portefeuille ; lien du dashboard vers un détail non implémenté |
| Types d'actifs | ACTION, ETF, OBLIGATION, TURBO, CRYPTO, AUTRE ; champs spécifiques barrière, levier, strike et échéance dans le modèle/API | Ne pas reprendre la liste STOCK/OPTION de l'ancienne version ; l'étendue exacte des champs présentés dans chaque formulaire dépend du type choisi |
| Enveloppes | PEA, CTO, AV, PEA-PME, avec regroupement et répartition sur le dashboard | Catégories de positions, sans comptabilité des liquidités/versements de compte ni suivi de plafond PEA dans cette version |
| Transactions | Ajout de BUY, SELL, DIVIDEND, SPLIT, TRANSFER ; date, quantité, prix, frais et notes ; historique dépliable ; suppression ; modification par API | PRU recalculé après les mutations ; SPLIT est proposé mais ignoré par le calcul, et une vente supérieure à la quantité est acceptée puis ramenée à zéro |
| PRU | Calcul pondéré des achats, intégration des frais d'achat, conservation du PRU lors d'une vente partielle ; recalcul depuis les transactions côté résumé | Valeurs en cache utilisées dans la page portefeuille ; synchronisation et écritures à rendre atomiques |
| Dashboard | Capital investi, valeur, P&L latent en montant et pourcentage ; répartition par enveloppe ; positions et cours courants | Filtrage par utilisateur présent ; conversion de devises absente ; repli à zéro en cas d'erreur de chargement |
| Marché | Page dédiée, indices de référence, ETF populaires, recherche d'instruments, cours et variation journalière ; lien vers l'analyse d'un instrument | Yahoo Finance et cache de quinze minutes sur les API de marché ; dépendance à un service externe, pas de flux de cotation continu |
| Watchlist | Page dédiée, ajout/retrait personnels, recherche d'ISIN et préremplissage, ticker, prix de référence, cours et performance depuis l'ajout | Les fichiers d'historique existent mais aucun raccordement YTD/un an dans cette page/API n'a été repéré |
| Agent IA | Conversation avec streaming SSE, trois modes : portefeuille, instrument, marché ; questions rapides, choix du mode/cible et réinitialisation de la conversation | Historique fourni par le navigateur et enregistrement en base ; pas de parcours de relecture des anciennes conversations ; limite de dix itérations par exécution |
| Outils de l'agent | Cours, fondamentaux, cours historiques, actualités, recherche d'instruments, composition d'ETF et lecture du portefeuille personnel | Qualité tributaire de Yahoo Finance et du fournisseur IA ; outils de lecture, pas de passage d'ordre repéré |
| Fournisseurs IA | Anthropic, OpenAI, NVIDIA NIM, Ollama ; modèles, clés et URL Ollama configurables dans les paramètres | Paramètres globaux modifiables par tous les comptes ; choix de repli fondé sur la disponibilité, sans bascule complète démontrée après l'échec réel d'une génération |
| Langue et présentation | FR/EN partiel, préférence enregistrée, initialisation depuis la session, navigation latérale repliable et liens administrateur conditionnels | Nombreux textes français fixes ; rôle et langue de session potentiellement périmés jusqu'à nouvelle connexion ; pas de commande de thème sombre repérée |
| Analytiques | Page et navigation existantes | Écran « À venir », sans graphiques de performance, allocations graphiques ou comparaison à un indice effectivement raccordés |
| Alertes de prix | Modèle PriceAlert avec cible, direction et état de déclenchement | Aucun écran, endpoint de gestion, évaluateur ou mécanisme de notification repéré : fonctionnalité prévue, pas opérationnelle |
| Contrats d'assurance-vie | Modèles AssuranceVie et AssuranceViePayment | Pas de pages/API de contrats repérées dans cette version. La catégorie de position AV ne remplace pas cette gestion des contrats |
| Déploiement | Compose PostgreSQL seul pour le dev ; stack app/PostgreSQL/Nginx pour la production ; sortie Next standalone ; scripts de nettoyage/fusion de positions | Configuration de production à fiabiliser ; aucun test automatisé applicatif ou CI repérés ; pas de sauvegarde/restauration intégrée à l'interface |

Fonctions non repérées : import CSV/Excel ou courtier, export de portefeuille, passage d'ordre, notification de prix, fiscalité, performance globale historique et réinitialisation de mot de passe autonome par email.

**Différences majeures avec l'ancien audit**

- Le contrôle du propriétaire des positions est présent, y compris dans les mutations ; une simulation d'accès à une position d'autrui retourne 404 avec `where: { id, userId }`.
- Le dashboard appelle le résumé avec l'identifiant utilisateur. Les courtiers et watchlists sont personnels.
- Les mutations utilisent des schémas Zod et des listes de champs autorisés. Le mot de passe minimal est aussi vérifié côté serveur.
- Le PRU est réellement utilisé et les ventes/dividendes sont proposés dans l'interface.
- La page Paramètres ne rend plus DATABASE_URL : la fuite de l'ancienne version n'est pas constatée ici.
- L'assurance-vie par contrats et les graphiques de l'ancienne version ne sont pas des fonctionnalités actives de cette source.
- Le lint global de l'ancienne version ne s'applique pas : cette source n'a ni script lint ni configuration ESLint repérés.

**Constats à corriger sur cette version**

P1 : priorité avant ouverture à plusieurs utilisateurs ou déploiement. P2 : fiabilité métier/exploitation. Les priorités ne sont pas des scores CVSS.

**S01 — P1 — Un membre peut modifier la configuration IA globale**

Sources : `app/api/settings/ai/route.ts:13`, `:25`, `:63`, `lib/ai/providers/index.ts:8`, `:43`.

POST vérifie la présence d'une session, sans rôle administrateur, puis écrit les clés globales d'AppConfig : fournisseur, modèle, clé et URL Ollama. Aucun propriétaire utilisateur n'est attaché à ces paramètres.

Reproduction isolée : une session member reçoit 200 pour modifier ai_provider et ollama_base_url. Les écritures ont été capturées dans une base factice.

Impact : un utilisateur peut changer le fournisseur ou la configuration de tous les autres. L'URL Ollama contrôlée est utilisée par le serveur dans le SDK puis pour un appel de disponibilité ; elle crée aussi un risque de requêtes vers des destinations non autorisées ou de transmission de messages à un endpoint choisi. Aucune requête réseau de ce type n'a été lancée pendant l'audit.

Correction : réserver les paramètres communs à l'administrateur, ou stocker explicitement une configuration par utilisateur ; valider les URL et les destinations autorisées. Les clés sont stockées comme valeurs de texte en base et doivent être protégées comme des secrets. GET ne retourne pas les clés API, ce qui est un point positif.

**S02 — P1 — Une session d'agent peut être modifiée sans contrôle de propriétaire**

Source : `app/api/agent/analyze/route.ts:53` à `:57`.

Quand sessionId est fourni, l'API exécute `agentSession.update({ where: { id: sessionId } })`, sans userId. Reproduction isolée : la véritable route retourne un flux HTTP 200 et tente une mise à jour limitée à l'ID d'une session simulée appartenant à un autre utilisateur.

Impact : un membre connaissant un ID peut écraser l'historique d'une autre session. Cette route ne démontre pas, à elle seule, une lecture de cet historique.

Correction : vérifier le propriétaire avant la génération et filtrer également la mutation par id et userId. Ne pas absorber silencieusement les erreurs de persistance.

**S03 — P1 — Versions de dépendances affectées par des avis de sécurité**

L'audit du verrou serveur par `pnpm audit --prod --json` retourne 131 entrées d'avis : 9 critiques, 50 élevées, 61 modérées, 11 faibles. Ce comptage est celui de pnpm, différent du comptage des paquets de l'ancien audit npm. Des avis se répètent sur plusieurs paquets ou chemins et certaines dépendances d'outillage sont classées en production. Ce n'est pas une démonstration de 131 vulnérabilités exploitables dans l'application.

Next.js installé est 16.2.4 et NextAuth 5.0.0-beta.31. Les contrôles locaux des API limitent certaines conséquences d'un contournement du Proxy, mais les dépendances restent à mettre à jour. Les avis doivent être qualifiés selon les fonctions réellement utilisées : OAuth, images, cache, hébergement Windows, etc. Aucune exploitation réseau n'a été tentée.

Sources primaires : [avis Next.js sur le Proxy](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f), [avis Auth.js sur les contrôles de session](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3). La portée du second mérite attention : `app/(app)/layout.tsx:12` teste seulement la présence de session avant d'accéder à session.user, tandis que la plupart des API exigent bien session.user.id.

Résultat détaillé conservé dans `docs/AUDIT_SERVER_DEPENDENCIES_2026-11-04.json`. Prévoir une mise à jour coordonnée et des tests, sans appliquer automatiquement une correction forcée.

**S04 — P1 — Les montants de devises différentes restent additionnés sans conversion**

Sources : `lib/db/queries/portfolio-summary.ts:87`, `:94`, `:120`, `components/portfolio/portfolio-client.tsx:134`, `lib/ai/tools/get-portfolio-context.ts:51`.

Le coût, les valeurs et les totaux sont additionnés sans normalisation de devise ; le dashboard les formate en euros. Le helper Frankfurter existe mais n'est pas raccordé. Le regroupement par ISIN peut aussi fusionner des positions dont la devise diffère.

Exemple illustratif : 100 EUR et 100 USD donnent une somme numérique de 200, sans taux de change. Les quantités et PRU peuvent être corrects dans chaque devise tout en donnant un total consolidé incorrect.

Correction : normaliser coûts et valeurs dans une devise de référence, traiter les unités de cotation et afficher l'état des taux et cours utilisés. Faire correspondre la devise de cotation et celle de la position.

**S05 — P2 — SPLIT et ventes excessives ne sont pas correctement traités**

Sources : `components/portfolio/add-transaction-form.tsx:25`, `app/api/transactions/route.ts:7`, `lib/portfolio/pru-calculator.ts:33` à `:42`.

SPLIT est proposé et enregistré, mais le calcul ne le traite pas. Une vente de quantité supérieure à la détention ne provoque pas d'erreur métier : le calcul applique Math.max(0, quantité restante).

Simulations : achat de 10 titres à 100, avec 10 de frais, puis vente de 4 => PRU 101 et quantité 6, correct pour cet exemple. Ajout d'un SPLIT => quantité inchangée. Vente de 20 après achat de 10 => quantité zéro sans rejet.

Correction : définir et appliquer la sémantique d'un split, valider les détentions à la date de chaque vente et les conséquences d'une suppression/modification d'opération passée. TRANSFER est actuellement traité comme un achat ; préciser le sens et le coût de transfert attendus.

**S06 — P2 — Écritures et synchronisation du cache non atomiques**

Sources : `app/api/transactions/route.ts:65` puis `:79`, `app/api/transactions/[id]/route.ts`, `lib/db/queries/portfolio-summary.ts:141`, `components/portfolio/add-position-form.tsx:161` puis `:192`.

Les créations/modifications/suppressions de transactions et la synchronisation quantity/pru sont séparées. La création de position et de son achat initial dépend même de deux requêtes du navigateur.

Impact : erreur ou concurrence pouvant laisser un cache périmé ou une position sans achat initial. La page portefeuille exploite le cache, alors que le dashboard recalcule depuis les opérations ; les écrans peuvent diverger.

Correction : regrouper chaque opération métier dans une transaction de base et définir une stratégie de verrouillage/recalcul. Mettre la création du premier achat et de la position dans une opération serveur unique si elle doit être indivisible.

**S07 — P2 — Sessions, inscription et coûts d'IA insuffisamment encadrés**

Sources : `auth.ts:41`, `auth.ts:62`, `app/api/auth/register/route.ts:12`, `app/api/agent/analyze/route.ts:7`, fournisseurs IA.

Les JWT durent 30 jours ; le rôle n'est pas relu et les changements de mot de passe ne révoquent pas explicitement les sessions. L'inscription publique crée des membres même quand des utilisateurs existent. Aucun quota par utilisateur ni limitation applicative des tentatives de connexion/appels IA n'est repéré. L'historique reçu par l'agent n'a pas de limite de longueur dans le schéma, même si un message est limité à 4 000 caractères et la boucle à dix itérations.

Correction : définir si l'inscription est ouverte ou réservée à la famille, limiter les tentatives et les coûts, borner les historiques et révoquer les sessions après les changements sensibles.

**S08 — P2 — Historique d'agent et repli entre fournisseurs partiels**

Sources : `components/agent/agent-chat.tsx:328`, `app/api/agent/analyze/route.ts:45`, `lib/ai/providers/index.ts:53`, `lib/ai/providers/anthropic.ts:16`, `lib/ai/providers/openai.ts:26`.

Le client renvoie tout son historique mais n'envoie pas de sessionId. L'API crée donc une nouvelle ligne AgentSession à chaque tour habituel ; aucune API/page de relecture de ces conversations n'a été repérée. Les erreurs d'enregistrement sont ignorées.

Le choix de fournisseur se fonde notamment sur la présence d'une clé. Une clé invalide, un quota ou une erreur durant la génération ne déclenche pas une nouvelle tentative complète avec le fournisseur suivant dans cette couche.

Correction : créer et retourner un ID de conversation, le réutiliser avec contrôle propriétaire, charger l'historique côté serveur et définir explicitement la politique de repli en cas d'erreur réelle, sans dupliquer les coûts ni mélanger les flux.

**S09 — P2 — Certains liens et états affichés masquent l'état réel**

Sources : `app/(app)/dashboard/page.tsx:86`, `:265`, `components/settings/settings-client.tsx:453`.

Le dashboard convertit toute erreur de résumé en portefeuille vide et indicateurs à zéro. Ses liens `/portfolio/{id}` n'ont pas de page correspondante dans l'arborescence, le détail étant déplié dans `/portfolio`. La suppression de courtier est un bouton annoncé « à venir ».

Correction : distinguer un portefeuille vide d'une panne, rendre les liens cohérents avec les écrans existants et signaler clairement les commandes non disponibles. Les traductions restent partielles.

**S10 — P2 — Déploiement et initialisation à fiabiliser**

Sources : `Dockerfile:29`, `docker-compose.yml`, `docker-compose.dev.yml`, `nginx/nginx.conf`, `prisma/seed.ts`.

Le Dockerfile copie un dossier public qui n'est pas présent dans la source versionnée récupérée : un clonage propre ne le crée pas. Aucun `.dockerignore` n'est repéré, ce qui laisse entrer environnements et artefacts locaux dans le contexte de build. La stack de production ne lance pas explicitement les migrations.

Nginx contient deux blocs concurrents listen 80/server_name _, dont une redirection vers HTTPS alors que le bloc 443 est commenté. La configuration doit être clarifiée avant déploiement ; aucune image Docker ni configuration Nginx n'a été exécutée sur ce PC.

Le Compose de développement publie 5432 sur toutes les interfaces et contient des identifiants de démonstration. Le conteneur original restauré reprend cette configuration existante. Le tunnel utilisé par le PC ne rend pas nécessaire cette publication générale ; l'exposition effective au réseau dépend aussi des pare-feu. Le seed contient un administrateur avec un mot de passe de démonstration connu ; il ne faut pas en faire un compte de production. L'état des mots de passe des comptes réels n'a pas été inspecté.

Les deux erreurs de clé unique dans les upserts du seed ont été corrigées localement pour faire passer TypeScript ; aucune exécution du seed n'a été faite. Aucun test automatisé applicatif, workflow CI ou commande lint n'a été repéré.

**Validation et limites**

| Contrôle | Résultat |
| --- | --- |
| Source récupérée | Code serveur versionné au commit 45903ba ; ancien code sauvegardé |
| Installation | `pnpm install --frozen-lockfile` réussi |
| Génération Prisma | Réussie avec PostgreSQL |
| TypeScript | Deux erreurs initiales dans le seed ; `pnpm run type-check` réussi après correction |
| Migrations de la base originale | À jour ; aucune migration exécutée |
| Comparaison base réelle / schéma | Aucune différence détectée |
| Lectures Prisma | Les 14 modèles accessibles ; comptes existants présents, données personnelles non affichées |
| Interface locale | `/login` répond 200 avec formulaire ; API anonyme redirigée vers la connexion ; polices de secours utilisées quand Google Fonts est inaccessible |
| Contrôle propriétaire des positions | Filtrage userId et réponse 404 reproduits avec base factice |
| Paramètres IA / sessions agent | Défauts S01 et S02 reproduits avec services factices, sans changement réel |
| Calcul PRU | Frais/vente partielle vérifiés ; limites SPLIT et vente excessive reproduites |
| Dépendances de production | 131 entrées d'avis pnpm ; applicabilité à qualifier |
| Build de production, Docker et tests navigateur authentifiés | Non validés |
| Appels IA payants et modifications métier en base | Aucun pendant la récupération et l'audit |

Après le changement de version et de secret de session, une ancienne session du navigateur local peut être invalide. La connexion doit employer un compte de la base serveur restaurée, pas un compte créé dans la base de l'autre version locale.

Ordre proposé : S01/S02 et mises à jour de sécurité ; devises et intégrité des transactions ; contrôle des sessions/coûts ; historique de l'agent ; liens et erreurs ; déploiement et fonctions annoncées mais absentes.
