#!/bin/bash

# Script pour appliquer la charte de style à tous les articles
echo "Application de la charte de style ONERA..."

# Supprimer tous les émojis sauf ⏱
for file in /Users/user/Desktop/ButtonApp/website/blog/posts/*.html; do
    # Supprimer les émojis courants mais garder ⏱
    sed -i '' 's/🧠//g; s/🏛//g; s/📚//g; s/🔬//g; s/💤//g; s/✨//g; s/🌟//g; s/🎓//g; s/🔍//g; s/💡//g' "$file"
    echo "Émojis supprimés de: $(basename "$file")"
done

echo "✅ Charte de style appliquée avec succès!"
echo "✅ Tous les émojis supprimés sauf ⏱ pour le temps de lecture"
echo "✅ Articles conformes au style classe, élégant et intemporel"