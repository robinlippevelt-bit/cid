# CID v2 — Récoltes / Laboratoires / Rapports

Cette version conserve la structure et la connexion Supabase de la V1, et ajoute les rapports opérationnels.

## Important

Si ta V1 fonctionne déjà avec ta base Supabase actuelle, **ne supprime pas et ne recrée pas la base**.

Le code est prévu pour utiliser les tables déjà ajoutées :

- `reports`
- `evidence`
- `report_people`
- `report_vehicles`
- `person_relations`
- `drugs`
- `laboratories`

## Correction Supabase

La V2 précédente utilisait `.order()` directement dans le chargement. Cette version ne l'utilise plus : les résultats sont triés côté navigateur. Cela évite l'erreur `sb.from(...).order is not a function`.

## Fonctionnalités

- Trafic / Récolte / Laboratoire
- filtres séparés
- filtres par produit
- recherche de rapports
- suspect, groupe, téléphone, quantité
- personnes liées
- véhicules liés
- relations entre personnes
- lien entre une récolte/laboratoire et un dossier de trafic
- preuves par URL
- collage `Ctrl+V` d'une image
- glisser-déposer d'image
- consultation détaillée des preuves
- rapports visibles depuis les fiches personnes et groupes
- recherche globale des rapports

## Lancer

Ouvre `index.html` via Live Server ou un serveur HTTP local.

## SQL

`supabase/schema.sql` est fourni comme référence. Si ta base actuelle fonctionne déjà, garde-la et n'exécute pas un nouveau schéma complet par-dessus.
