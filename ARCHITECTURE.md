# Pont-Bascule & LAPI — Architecture de l'application
**Supervision pont-bascule & lecture de plaques (SIITEP-AXONE)**

> Document initialement rédigé à partir de l'analyse de la vidéo de démonstration (`WhatsApp Video 2026-10-09 at 11.26.22 AM (1).mp4`). **Mise à jour** : le site utilise réellement deux logiciels du commerce (Survision VSS7 + Truckflow de Précia Molen) — voir section 9. Les sections 1 à 8 ci-dessous décrivent le fonctionnement cible du dashboard (toujours valable pour le prototype/démo actuel) ; la section 9 précise comment ce dashboard doit réellement se brancher sur l'existant du site plutôt que réimplémenter la pesée/rapprochement.

---

## 1. Objectif de l'application

Automatiser la supervision d'un site logistique (carrière, dépôt, usine) équipé d'un **pont-bascule** et de **caméras LAPI** (lecture automatique de plaques) en entrée/sortie :

- Rapprocher automatiquement chaque **lecture de plaque** avec la **pesée** correspondante (plus de saisie manuelle).
- Calculer en temps réel le **poids net** transporté (livraison ou enlèvement) et la **durée de présence** de chaque camion sur site.
- Détecter et signaler les **anomalies** (camion resté trop longtemps, sortie sans entrée enregistrée, erreur de lecture OCR).
- Fournir un **historique consultable et exportable** (CSV/Excel) pour la facturation et les contrôles.
- Fonctionner **100% en local** (réseau du site), sans dépendance à Internet.

---

## 2. Vue d'ensemble de l'architecture (3 niveaux)

```
┌─────────────────────────┐   ┌─────────────────────────┐   ┌───────────────────────────┐
│  Caméra LAPI — Entrée    │   │     Pont-bascule         │   │  Caméra LAPI — Sortie     │
│  Survision Micropak 3    │   │  Indicateur Précia Molen │   │  Survision Micropak 3     │
│  Vario                   │   │                          │   │  Vario                    │
│  → HTTP Push (plaque+photo)│ │ → TCP/RS232 (trames poids)│  │ → HTTP Push (plaque+photo)│
└───────────┬──────────────┘   └───────────┬──────────────┘   └───────────┬───────────────┘
            │                              │                              │
            └──────────────┬───────────────┴──────────────┬───────────────┘
                            ▼                              ▼
                 ┌─────────────────────────────────────────────────┐
                 │                SERVEUR LOCAL                    │
                 │        (réseau site, ex: 192.168.1.x)           │
                 │  - Récepteur HTTP (ingestion caméras LAPI)       │
                 │  - Lecteur série/TCP (ingestion pont-bascule)    │
                 │  - Moteur de rapprochement plaque ↔ pesée        │
                 │  - Calcul durée de présence & poids net          │
                 │  - Détection d'anomalies                         │
                 │  - Base de données (historique des passages)     │
                 │  - API temps réel (WebSocket/SSE) + API REST     │
                 └───────────────────────┬───────────────────────────┘
                                         │ Temps réel (WebSocket) + REST (historique)
                                         ▼
                 ┌─────────────────────────────────────────────────┐
                 │              DASHBOARD WEB                       │
                 │   Poste de garde / bureaux — navigateur web      │
                 │   - Onglet "Temps réel" (KPIs, pesée en direct,  │
                 │     camions sur site, passages du jour, alertes) │
                 │   - Onglet "Historique" (recherche, export CSV)  │
                 └─────────────────────────────────────────────────┘
```

**Point clé** : le serveur local est le cœur métier. Il ne remplace aucun équipement existant (caméras Survision, indicateur Précia Molen déjà en place) — il s'intercale pour collecter, corréler et restituer les données.

---

## 3. Composants

### 3.1 Edge — Équipements existants (non modifiés)
| Équipement | Rôle | Interface |
|---|---|---|
| Caméra LAPI Entrée (Survision Micropak 3 Vario) | Capture plaque + photo à l'entrée | HTTP Push (POST JSON/photo vers le serveur local) |
| Caméra LAPI Sortie (Survision Micropak 3 Vario) | Capture plaque + photo à la sortie | HTTP Push |
| Indicateur de pesage (Précia Molen) | Envoie les trames de poids en continu | TCP ou RS232 (trames propriétaires poids) |

### 3.2 Serveur local (business logic)
Service déployé sur le réseau du site, sans accès Internet requis.

- **Ingestion**
  - Endpoint HTTP recevant les événements des caméras LAPI (plaque OCR + score de fiabilité + photo + sens entrée/sortie + horodatage).
  - Connecteur TCP/série qui parse en continu les trames du pont-bascule et détecte les états : `Pont libre` → `Pesée en cours` → `Poids stable`.
- **Moteur de rapprochement (le cœur du système)**
  - Associe une lecture de plaque (entrée) à la pesée stable qui suit sur le pont-bascule.
  - Associe une lecture de plaque (sortie) à la pesée stable de sortie, puis clôture le passage.
  - Calcule : `poids net = |poids_sortie − poids_entrée|`, `durée = sortie.horodatage − entrée.horodatage`.
  - Détermine le type d'opération : **Livraison** (poids diminue) vs **Enlèvement** (poids augmente).
  - Corrige automatiquement certaines erreurs OCR par rapprochement contextuel (ex. confusion `O`/`0`).
- **Détection d'anomalies**
  - Durée dépassée (seuil configurable, ex. > 2h sans sortie).
  - Sortie sans entrée correspondante.
  - Pesée sans plaque associée.
- **Persistance** : base de données locale (historique des passages, photos, événements).
- **Diffusion**
  - Flux temps réel (WebSocket ou Server-Sent Events) vers le dashboard : KPIs, pesée en direct, mises à jour des tableaux.
  - API REST pour la recherche d'historique et l'export CSV.
- **Journal d'événements** : log append-only de tous les événements système (détections, pesées, anomalies) à des fins d'audit.

### 3.3 Dashboard web (front-end)
Application web mono-page, un seul rôle utilisateur (poste de garde / bureaux), pas d'authentification visible dans la démo (à prévoir si besoin de traçabilité par utilisateur).

**Onglet "Temps réel"**
- En-tête : statut de connexion des 3 équipements (caméra entrée / caméra sortie / indicateur de pesage), horloge/date.
- Bandeau KPI (6 tuiles) : Camions sur site, Entrées du jour, Sorties du jour, Durée moyenne sur site, Tonnage net du jour, Anomalies.
- Bloc "Pont-bascule — poids en direct" : poids en kg avec états visuels (`Pont libre` / `Pesée en cours...` avec barre de progression 0–60t / `Poids stable`).
- Bloc "Dernière lecture de plaque" : snapshot caméra, plaque détectée, score de fiabilité OCR, sens (entrée/sortie).
- Tableau "Camions sur site" : Plaque, Heure d'entrée, Durée sur site, Poids entrée, État, action "Sortie".
- Tableau "Passages du jour" : Plaque, Entrée, Sortie, Durée, Poids entrée/sortie, Net, Opération, Statut.
- Graphique "Entrées par heure" (histogramme horaire).
- "Journal des événements" (flux d'événements horodatés).
- Alertes contextuelles (popup) sur anomalie (ex. durée dépassée).

**Onglet "Historique"**
- Filtres : plage de dates (Du/Au), plaque (recherche texte).
- Bouton "Rechercher" + bouton "Exporter CSV (Excel)".
- Compteur de résultats (ex. "22 passages · 321,3 t net").
- Table complète : Plaque, Entrée, Sortie, Durée, Poids entrée/sortie, Net, Opération, Statut, Remarque (ex. anomalie expliquée en texte).

---

## 4. Modèle de données

```
Camion
  - plaque (identifiant métier, format "AB-123-CD")

Passage   (= un cycle entrée → sortie d'un camion)
  - id
  - plaque
  - entree_horodatage
  - sortie_horodatage (nullable tant que le camion est sur site)
  - poids_entree (kg)
  - poids_sortie (kg, nullable)
  - poids_net (kg, calculé)
  - duree (calculée)
  - operation: ENUM(Livraison, Enlevement)
  - statut: ENUM(SurSite, Sorti, AnomalieSortieSansEntree)
  - remarque (texte libre, ex. message d'anomalie)

LecturePlaque  (événement brut caméra LAPI)
  - id
  - horodatage
  - sens: ENUM(Entree, Sortie)
  - plaque_lue (texte brut OCR)
  - plaque_corrigee (après rapprochement, nullable)
  - fiabilite (% score OCR)
  - photo (référence fichier/blob)

Pesee  (événement brut pont-bascule)
  - id
  - horodatage_debut
  - horodatage_stable
  - poids (kg)
  - etat: ENUM(PontLibre, PeseeEnCours, PoidsStable)

Anomalie
  - id
  - type: ENUM(DureeDepassee, SortieSansEntree, PeseeSansPlaque, ErreurOCR)
  - passage_id (nullable)
  - horodatage
  - details

EvenementJournal  (log technique append-only)
  - id
  - horodatage
  - type
  - message
```

---

## 5. Flux fonctionnel (cycle de vie d'un passage)

1. **Entrée** : la caméra LAPI entrée détecte une plaque → `LecturePlaque(sens=Entree)` envoyée au serveur en HTTP push.
2. Le camion avance sur le pont-bascule → l'indicateur envoie des trames poids en continu → le serveur détecte `PeseeEnCours` puis `PoidsStable`.
3. Le moteur de rapprochement lie la pesée stable à la dernière lecture plaque "Entrée" non associée → crée un `Passage` avec `statut=SurSite`, `poids_entree` renseigné.
4. Le camion repart plus tard → caméra sortie détecte la plaque → nouvelle pesée stable au passage sur le pont.
5. Le serveur retrouve le `Passage` ouvert correspondant à cette plaque → renseigne `poids_sortie`, `sortie_horodatage`, calcule `poids_net` et `duree`, détermine `operation` (Livraison/Enlèvement), passe `statut=Sorti`.
6. Le dashboard reçoit la mise à jour en temps réel (WebSocket) → les tableaux "Camions sur site" et "Passages du jour" se rafraîchissent, les KPIs se recalculent.
7. En continu, le serveur vérifie les seuils (durée > 2h sans sortie, pesée sans plaque, sortie sans entrée) → crée une `Anomalie` → le dashboard affiche une alerte visuelle (ligne en rouge + popup).
8. L'utilisateur peut à tout moment basculer sur "Historique", filtrer par date/plaque, et exporter en CSV pour la facturation.

---

## 6. Exigences non fonctionnelles

- **100% local / on-premise** : aucun appel réseau externe requis pour le fonctionnement courant ; le serveur tourne sur le réseau du site.
- **Temps réel** : latence faible entre l'événement physique (passage plaque/pesée) et l'affichage dashboard (push WebSocket, pas de polling lourd).
- **Résilience** : le serveur doit continuer à ingérer/stocker même si le dashboard est fermé ou déconnecté (découplage ingestion/affichage).
- **Pas de remplacement matériel** : s'intègre aux caméras Survision et à l'indicateur Précia Molen déjà installés, via leurs protocoles natifs (HTTP push, TCP/RS232).
- **Auditabilité** : conservation de l'historique complet (y compris photos LAPI) pour contrôles/facturation.
- **Tolérance aux erreurs OCR** : logique de correction par rapprochement contextuel plutôt que rejet strict.

---

## 7. Proposition de stack technique

> La démo ne montre pas le code ; ce qui suit est une proposition raisonnable compatible avec les contraintes observées (local, temps réel, intégration matérielle série/HTTP).

| Couche | Choix proposé | Justification |
|---|---|---|
| Ingestion HTTP (caméras LAPI) | Endpoint REST léger (Node.js/Express ou Python/FastAPI) | Reçoit du JSON + image en POST, simple à exposer en local |
| Ingestion pont-bascule | Service dédié lisant le port série (RS232 via `pyserial` / `serialport`) ou socket TCP, qui parse les trames propriétaires Précia Molen | Le protocole est propriétaire au fabricant ; nécessite un parseur de trame spécifique |
| Moteur de rapprochement & règles métier | Module applicatif (même service backend), piloté par événements | Logique centrale, doit rester simple à auditer/tester unitairement |
| Base de données | PostgreSQL ou SQLite (selon volumétrie/site unique vs multi-site) | Historique relationnel simple (passages, lectures, pesées, anomalies) |
| Temps réel vers le front | WebSocket (ou Server-Sent Events) | Push immédiat des mises à jour sans polling |
| API Historique/Export | REST (filtrage par date/plaque, export CSV en flux) | Correspond à l'onglet "Historique" observé |
| Front-end | React (ou Vue) + librairie de graphes (ex. Recharts) | SPA avec deux onglets, tableaux dynamiques, graphique horaire |
| Déploiement | Conteneur(s) local(aux) (Docker) sur un poste/serveur du site, accès dashboard via navigateur sur le réseau local | Cohérent avec "100% local", pas de cloud |

---

## 8. Points ouverts à clarifier avec le client avant implémentation

- Authentification/rôles utilisateurs (la démo ne montre aucun login) — un seul rôle "poste de garde/bureaux" suffit-il, ou faut-il distinguer opérateur/admin ?
- ~~Format exact des trames du pont-bascule Précia Molen~~ → **non pertinent** : Précia Molen fournit déjà Truckflow, qui fait cette lecture ; voir section 9.
- ~~Format exact des payloads HTTP push de la caméra Survision~~ → **partiellement répondu** : VSS7 confirme FTP push (pas HTTP) + flux RTSP ; voir section 9.2.
- Seuil de durée configurable pour l'alerte "durée dépassée" (2h vu en démo — figé ou paramétrable par site ?).
- Multi-site ou mono-site pour la V1 ?
- Conservation des photos LAPI : durée de rétention, volumétrie de stockage à prévoir.
- Besoin d'un export/API pour un logiciel de facturation tiers, ou uniquement export CSV manuel ?
- **Nouveau, bloquant** : obtenir un accès (idéalement lecture seule) à l'instance SQL Server `TruckFlowDB` réelle du site — voir section 9.1, c'est le prérequis pour sortir ce projet du mode simulation.

---

## 9. Intégration réelle confirmée (Truckflow / Survision)

En explorant deux dossiers fournis par le client (copies partielles d'une installation réelle de site), on a pu confirmer ce qui suit — cela remplace les hypothèses des sections précédentes là où il y a contradiction.

### 9.1 Truckflow = le vrai moteur métier, pas un tiers à ignorer

Le site n'utilise pas un pont-bascule "nu" : il tourne déjà sous **Truckflow**, une suite complète de gestion de pont-bascule (espace client `OperatorStation`, service `TruckflowServerData`, service `TruckflowServerDevice`). D'après les fichiers de configuration `.NET` retrouvés (`PM.Truckflow.Server.WindowsServiceData.exe.config`) :

- Espace de noms `PM.Truckflow.*` → **Truckflow est l'outil de Précia Molen eux-mêmes** (le fabricant de l'indicateur de pesage vu dans la démo), pas un éditeur tiers.
- Backend = **Microsoft SQL Server**, instance nommée `PMSQLSERVER`, base `TruckFlowDB`, compte dédié `PMTruckflowUser`.
- Accès aux données via **Entity Framework 6** (modèle `OTruckflowModel`, database-first) et rapports **Telerik Reporting** (explique les dossiers de formats papier A4/A5/Letter).
- Le service `TruckflowServerDevice` ne contient pas de chaîne de connexion SQL — il gère probablement le dialogue direct avec le matériel (pont-bascule, caméras) et remonte les données au service `TruckflowServerData`.

**Conséquence majeure sur l'architecture** : Truckflow fait déjà le rapprochement plaque ↔ pesée, le calcul de durée/poids net, la détection d'anomalies et la génération de tickets (sections 3.2 et 5 de ce document). **Le dashboard de ce projet ne doit donc pas réimplémenter ce moteur** — son rôle réel est de devenir une **couche de lecture/visualisation** par-dessus les données déjà produites par Truckflow (lecture seule sur `TruckFlowDB`), avec en plus l'UI moderne temps réel que Truckflow n'offre pas nativement.

Les dossiers fournis étaient cependant une coquille quasi vide (aucun exécutable, aucune sauvegarde de base, aucun fichier d'export réel, dossier `Manuals` vide) — le schéma exact des tables (noms de tables/colonnes pour tickets/pesées) reste inconnu à ce stade.

**Prochaine étape concrète** : `server/scripts/truckflow-discover-schema.js` a été ajouté au projet. Une fois un accès réseau + identifiants SQL Server obtenus pour `TruckFlowDB` (idéalement un compte en lecture seule), lancer :
```
cd server
copy .env.example .env    # puis renseigner TRUCKFLOW_DB_* et DATA_SOURCE=truckflow
npm run truckflow:discover
```
Cela produit `server/truckflow-schema.json` (liste des tables, colonnes, types, nombre de lignes) sans rien modifier dans la base. Avec ce schéma, les vraies requêtes pourront être écrites dans `server/src/adapters/truckflowAdapter.js` (actuellement un stub qui lève une erreur explicite tant que le schéma n'est pas connu).

### 9.2 Survision VSS7 = outil de configuration, pas le protocole lui-même

`Survision/VSS7/` est l'outil desktop de configuration/visualisation du fabricant (pas une API). Son fichier `readme.txt` (changelog v6→v7.5.1.1) confirme cependant des éléments utiles sur le protocole réel des caméras :
- **FTP push** configurable (jusqu'à 3 serveurs FTP cibles) pour l'envoi plaque + photo — **pas du HTTP** comme supposé initialement en section 2/3.1 ; il faudra donc un petit serveur FTP côté "serveur local" plutôt qu'un simple endpoint HTTP.
- Flux vidéo en **RTSP**.
- Port de découverte réseau par défaut **10001** (configurable).
- Support XML pour l'export/import de configuration, mode "connexion lecture seule", et chiffrement des plaques (à partir de v7.2).

Si Truckflow gère déjà l'ingestion caméra (ce qui est probable, voir 9.1), ce point peut devenir secondaire — mais si une ingestion directe des caméras Survision est un jour nécessaire en parallèle de Truckflow, c'est le protocole réel à implémenter (FTP, pas HTTP).

---

*Document mis à jour au fil du projet (vidéo de démonstration + analyse de l'installation réelle Truckflow/Survision fournie par le client). Section 9 à affiner dès que l'accès à `TruckFlowDB` est obtenu.*
