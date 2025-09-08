# Charte de Style Blog ONERA ✅

## Principes Fondamentaux ✅
- **Élégance** : Design minimaliste noir et blanc ✅
- **Intemporel** : Pas de tendances passagères, style durable ✅
- **Classe** : Typographie raffinée, espacement généreux ✅
- **Cohérence** : Tous les articles identiques ✅

## Structure HTML Standard ✅

```html
<body>
    <div class="particles-container" id="particles"></div>
    
    <nav class="nav-header">
        <a href="/" class="logo-link">ONERA</a>
        <div class="nav-links">
            <a href="/" class="nav-link">Home</a>
            <a href="/blog" class="nav-link">Blog</a>
            <a href="/founders-letter.html" class="nav-link">Founder's Letter</a>
        </div>
    </nav>
    
    <div class="article-container">
        <a href="/blog/" class="back-link">
            <span class="back-arrow">←</span>
            Back to Blog
        </a>
        
        <header class="article-header">
            <div class="article-date">Date</div>
            <h1 class="article-title">Titre</h1>
            <p class="article-subtitle">Sous-titre</p>
            <div class="article-meta">
                <span>⏱ X min read</span>
                <div class="meta-separator"></div>
                <span>Catégorie</span>
            </div>
        </header>

        <article class="article-content">
            <!-- Contenu -->
        </article>

        <footer class="article-footer">
            <div class="share-section">
                <p class="share-title">Share This Article</p>
            </div>
        </footer>
    </div>
</body>
```

## CSS Variables Standard ✅

```css
:root {
    --primary-bg: #000000;
    --text-primary: #FFFFFF;
    --text-secondary: #999999;
    --text-muted: #666666;
    --accent: #FFFFFF;
    --border-color: rgba(255, 255, 255, 0.08);
}
```

## Animations Obligatoires ✅

1. **Header Animation** : `fadeInUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)`
2. **Content Animation** : `fadeIn 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s both`

## Typographie Standard ✅

### Titre Principal
```css
.article-title {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 100;
    line-height: 1.2;
    letter-spacing: 0.02em;
    margin-bottom: 1.5rem;
    background: linear-gradient(180deg, #FFFFFF 0%, #CCCCCC 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

### Sous-titres H2
```css
.article-content h2 {
    font-size: 2rem;
    font-weight: 300;
    margin: 3rem 0 1.5rem;
    color: var(--text-primary);
    letter-spacing: 0.02em;
    line-height: 1.3;
}
```

## Navigation Standard ✅

- Logo : "ONERA" uniquement ✅
- 3 liens : Home, Blog, Founder's Letter ✅
- Boutons avec hover effects élégants ✅
- Pas d'émojis dans la navigation ✅

## Métadonnées Article ✅

Format obligatoire : `Date` + `⏱ X min read` ✅
Pas d'autres émojis autorisés ✅

## Règles Interdites ✅

❌ **Émojis** : Sauf ⏱ pour le temps de lecture ✅
❌ **Couleurs vives** : Seulement noir, blanc, gris ✅
❌ **Polices fantaisistes** : SF Pro Display uniquement ✅
❌ **Animations tape-à-l'œil** : Transitions subtiles uniquement ✅
❌ **Inconsistances** : Tous les articles identiques ✅

## Règles Obligatoires ✅

✅ **Animations progressives** : Chaque élément se charge un par un ✅
✅ **Typographie uniforme** : Mêmes tailles et poids partout ✅
✅ **Logo ONERA** : Sur tous les articles ✅
✅ **Gradient sur titre** : Animation élégante obligatoire ✅
✅ **Particules subtiles** : Système d'animation discret ✅
✅ **Layout cohérent** : 900px max-width, padding standardisé ✅

## Timing des Animations ✅

1. Header : 0s (immédiat) ✅
2. Content : +0.3s delay ✅
3. Smooth transitions : 0.3-0.8s duration ✅
4. Easing : cubic-bezier(0.25, 0.46, 0.45, 0.94) ✅

## Nouvelles Spécifications Ajoutées ✅

### Lien Back to Blog ✅
- Format : `<a href="/blog/" class="back-link">` ✅
- Avec flèche animée `<span class="back-arrow">←</span>` ✅
- Animation hover : flèche se déplace vers la gauche ✅
- Soulignement au survol ✅

### Métadonnées SEO ✅
- Domaine : `dreaminsight.app` ✅
- Open Graph et Twitter Cards ✅
- Site name : "ONERA" ✅
- Twitter handle : `@onera_dreams` ✅
- Auteur : "ONERA Research Team" ✅

### Structure Header Mise à Jour ✅
```html
<header class="article-header">
    <div class="article-date">Date</div>
    <h1 class="article-title">Titre</h1>
    <p class="article-subtitle">Sous-titre</p>
    <div class="article-meta">
        <span>⏱ X min read</span>
        <div class="meta-separator"></div>
        <span>Catégorie</span>
    </div>
</header>
```

---

**STATUT FINAL : ✅ TOUS LES 16 ARTICLES CONFORMES**

Cette charte garantit un style **classe, élégant et intemporel** sur tous les articles.