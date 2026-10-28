# Questions pour le client — Accès au système réel (Truckflow / Survision)

**Contexte** : en analysant les dossiers fournis (`Survision/`, `Truckflow/`), nous avons confirmé que le site utilise déjà un logiciel complet de gestion de pont-bascule — **Truckflow**, édité par **Précia Molen** (même fabricant que l'indicateur de pesage) — qui gère nativement le rapprochement plaque/pesée, le calcul de durée et de poids net, et la génération des tickets. Les caméras sont des caméras **Survision** (lecture automatique de plaques).

Le dashboard que nous développons doit donc se connecter en lecture aux données déjà produites par Truckflow plutôt que de recréer ce moteur de zéro. Les dossiers transmis ne contenaient malheureusement pas de sauvegarde de base de données ni de fichier d'export réel — nous avons donc besoin des informations ci-dessous pour finaliser le branchement.

---

## 1. Accès à la base de données (prioritaire — bloquant)

- Peut-on obtenir un **compte SQL Server en lecture seule** sur la base `TruckFlowDB` (distinct du compte `PMTruckflowUser` utilisé par l'application elle-même) ?
- Quelle est l'**adresse réseau** (nom de machine ou IP) du serveur SQL Server, et l'instance `PMSQLSERVER` est-elle accessible depuis le poste où tournera le dashboard, ou uniquement en local sur le serveur ?
- Le service **SQL Server Browser** (port UDP 1434) est-il ouvert sur le réseau du site, ou faut-il demander un **port TCP fixe** pour l'instance `PMSQLSERVER` ?

## 2. Vérification contractuelle / support Précia Molen

- Le contrat de support/maintenance avec Précia Molen **autorise-t-il un accès direct en lecture** à la base `TruckFlowDB`, ou cela risque-t-il d'invalider la garantie/le support ?
- Truckflow propose-t-il déjà une **fonctionnalité d'export ou d'API officielle** (par exemple pour un logiciel de facturation tiers) ? Si oui, c'est la voie à privilégier plutôt qu'un accès direct à la base.

## 3. Alternative si l'accès direct n'est pas possible

- À défaut d'un accès permanent, quelqu'un sur site pourrait-il **exécuter un script que nous avons préparé** (`npm run truckflow:discover`, fourni dans le projet) depuis un poste ayant accès au serveur SQL Server, et nous transmettre le fichier résultat (`truckflow-schema.json`) ? Ce script est en lecture seule et ne modifie rien dans la base.
- À défaut, peut-on obtenir un **export d'une journée type de tickets/pesées** (CSV ou Excel depuis les rapports Truckflow existants), pour que nous connaissions le format réel des données ?

## 4. Informations complémentaires utiles

- Le site exploite-t-il **un seul pont-bascule**, ou plusieurs voies/sites partageant la même base `TruckFlowDB` ?
- Sur combien de temps remonte l'historique des tickets, et quel est le volume approximatif (nombre de passages par jour) ?
- Les photos des caméras LAPI sont-elles stockées comme **fichiers sur disque** (avec un chemin référencé dans la base) ou directement **dans la base SQL Server** ?

---

*Dès réception d'un accès (même temporaire) ou du fichier de schéma, nous pourrons écrire les requêtes réelles et brancher le dashboard sur les données de production, sans rien modifier à l'installation existante.*
