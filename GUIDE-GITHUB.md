# Mettre l'application « Pointage » en ligne avec GitHub Pages

Ce guide explique, étape par étape, comment publier gratuitement l'application sur
Internet puis l'installer sur votre iPhone. Aucune connaissance en développement
n'est nécessaire : il suffit de copier-coller les commandes indiquées.

> **À savoir avant de commencer**
> - Le **dépôt sera public** : c'est la condition pour utiliser GitHub Pages
>   gratuitement. Tout le monde pourra voir **le code** de l'application.
> - **Vos données, elles, restent sur votre téléphone.** Vos créneaux, notes et
>   cigarettes sont enregistrés uniquement dans Safari sur l'iPhone (stockage
>   local). Ils ne sont jamais envoyés sur GitHub ni ailleurs. Seule la fonction
>   « Sauvegarde » crée un fichier, que vous rangez où vous voulez.

Dans ce guide :
- `VOTRE-IDENTIFIANT` est votre nom d'utilisateur GitHub (par exemple `manonkopff95-ux`) ;
- le dépôt s'appelle ici `pointage` ; le vôtre s'appelle **`Pointage-`** : remplacez `pointage` par `Pointage-` dans les commandes et adresses.

---

## Étape 0 — Récupérer le dossier de l'application

Le dossier `pointage` contient tout ce qu'il faut : `index.html`, `css`, `js`,
`icons`, etc. Placez-le dans un endroit simple, par exemple dans vos Documents.

Ouvrez ensuite le **Terminal** :
- sur Mac : `Cmd + Espace`, tapez « Terminal », Entrée ;
- sur Windows : menu Démarrer, tapez « Terminal » (ou « PowerShell »).

Placez-vous dans le dossier (adaptez le chemin si besoin) :

```bash
cd ~/Documents/pointage
```

Astuce Mac : tapez `cd ` (avec l'espace) puis glissez le dossier depuis le Finder
dans la fenêtre du Terminal, et appuyez sur Entrée.

## Étape 1 — Installer l'outil `gh` (une seule fois)

`gh` est l'outil officiel de GitHub en ligne de commande.

- **Mac** : téléchargez l'installateur sur <https://cli.github.com> (bouton
  « Download for Mac »), ouvrez-le et suivez les étapes.
  (Si vous avez Homebrew : `brew install gh`.)
- **Windows** : téléchargez l'installateur sur <https://cli.github.com>, ou tapez
  `winget install --id GitHub.cli`.

Il faut aussi `git` : sur Mac, la première commande `git` vous proposera de
l'installer (acceptez) ; sur Windows, installez-le depuis <https://git-scm.com>.

Vérifiez :

```bash
gh --version
git --version
```

## Étape 2 — Connecter `gh` à votre compte GitHub (une seule fois)

```bash
gh auth login
```

Répondez aux questions avec les flèches du clavier et Entrée :
1. *Where do you use GitHub?* → **GitHub.com**
2. *What is your preferred protocol?* → **HTTPS**
3. *Authenticate Git with your GitHub credentials?* → **Yes**
4. *How would you like to authenticate?* → **Login with a web browser**

`gh` affiche un **code à 8 caractères** (par ex. `ABCD-1234`). Appuyez sur Entrée :
le navigateur s'ouvre sur GitHub. Connectez-vous si besoin, **saisissez le code**,
puis cliquez sur **Authorize GitHub CLI**. De retour dans le Terminal, le message
« Logged in as VOTRE-IDENTIFIANT » confirme que c'est bon.

Indiquez aussi à git votre nom et votre e-mail (une seule fois) :

```bash
git config --global user.name "Votre Prénom"
git config --global user.email "votre-adresse@exemple.com"
```

## Étape 3 — Créer le dépôt et publier le code

Toujours dans le dossier `pointage` :

```bash
git init -b main
git add -A
git commit -m "Première version de l'application Pointage"
gh repo create pointage --public --source=. --push
```

La dernière commande crée le dépôt **public** `pointage` sur votre compte et y
envoie les fichiers. Vous pouvez le voir sur
`https://github.com/VOTRE-IDENTIFIANT/pointage`.

## Étape 4 — Activer GitHub Pages

**Avec une commande** :

```bash
gh api -X POST repos/VOTRE-IDENTIFIANT/pointage/pages -f "source[branch]=main" -f "source[path]=/"
```

**Ou dans le navigateur** : sur la page du dépôt, **Settings** (Paramètres) ›
**Pages** (menu de gauche) › *Build and deployment* › Source : **Deploy from a
branch** › Branch : **main** et dossier **/ (root)** › **Save**.

La première publication prend une à deux minutes. Pour suivre son avancement :

```bash
gh api repos/VOTRE-IDENTIFIANT/pointage/pages --jq .status
```

Quand la réponse est `built`, c'est en ligne.

## Étape 5 — L'adresse de l'application

```
https://VOTRE-IDENTIFIANT.github.io/pointage/
```

(Pour vous : **https://manonkopff95-ux.github.io/Pointage-/**.)

## Étape 6 — Installer l'application sur l'iPhone

1. Ouvrez l'adresse ci-dessus dans **Safari** (pas Chrome : seul Safari permet
   l'installation sur iPhone).
2. Touchez le bouton **Partager** (le carré avec une flèche vers le haut, en bas
   de l'écran).
3. Faites défiler et choisissez **Sur l'écran d'accueil**.
4. Vérifiez le nom « Pointage » et touchez **Ajouter**.

L'icône apparaît sur l'écran d'accueil. Ouvrez toujours l'application **depuis
cette icône** : c'est là que vos données sont enregistrées. Elle fonctionne
ensuite même sans réseau.

> Important : l'application installée et la page ouverte dans Safari ont chacune
> leurs propres données. Utilisez uniquement l'icône de l'écran d'accueil.
> Pensez à faire une **sauvegarde** de temps en temps (onglet « Données »).

## Étape 7 — Publier une mise à jour après une modification

1. Modifiez les fichiers dans le dossier `pointage`.
2. Ouvrez `sw.js` et augmentez le numéro de version en haut du fichier
   (par ex. `pointage-v1` → `pointage-v2`) : cela garantit que l'iPhone
   récupère bien la nouvelle version.
3. Dans le Terminal, depuis le dossier `pointage` :

   ```bash
   git add -A
   git commit -m "Décrivez ici la modification"
   git push
   ```

4. Attendez une à deux minutes, puis fermez complètement l'application sur
   l'iPhone (balayer vers le haut) et rouvrez-la. Si l'ancienne version
   s'affiche encore, rouvrez-la une seconde fois.

Vos données ne sont pas touchées par une mise à jour.

---

## En cas de souci

| Problème | Solution |
|---|---|
| `gh: command not found` | L'installation de `gh` n'est pas terminée : refaites l'étape 1 puis rouvrez le Terminal. |
| `git push` demande un mot de passe | Relancez `gh auth login` (étape 2). |
| La page affiche « 404 » | Pages n'est pas encore prêt : attendez 2 minutes, vérifiez l'étape 4. |
| « Sur l'écran d'accueil » n'apparaît pas | Vérifiez que vous êtes dans Safari et faites défiler le menu Partager. |

## Pour les tests (facultatif)

Le dossier `tests` contient des tests automatiques des règles de calcul et des
exports. Avec Node.js installé : `npm test`.
