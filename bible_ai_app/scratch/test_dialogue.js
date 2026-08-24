let text = `Cléopas et la désillusion **Lisez Luc 24.13-35.** C’était un dimanche après-midi. Cléopas et son ami dépassèrent la porte ouest de Jérusalem en se dirigeant vers Emmaüs. Ils étaient visiblement plongés dans une conversation animée. Alors qu’ils marchaient depuis une dizaine de minutes, un étranger qui cheminait non loin d’eux leur demanda soudain : — De quoi parlez-vous en marchant ? Ils s’arrêtèrent, profondément surpris par la question. L’exécution de Jésus était le grand sujet de conversation dans toute la ville de Jérusalem. Cela avait été l’apogée d’une semaine agitée par des controverses, des confrontations et des intrigues politiques en tous genres. Peut-être était-il un peu prématuré de parler « d’apogée ». On parlait, ce matin même, d’un nouveau rebondissement dans l’affaire. Le corps de Jésus avait disparu. Aucune déclaration officielle n’avait été faite par le Sanhédrin ou les Romains. La rumeur courait qu’il était ressuscité. Les ragots allaient bon train. Cléopas s’exclama : — Es-tu le seul en séjour à Jérusalem qui ne sache pas ce qui y est arrivé ces jours-ci ? L’homme répondit : — Quoi ? — Ce qui est arrivé à Jésus de Nazareth, qui était un prophète puissant en actes et en paroles devant Dieu et devant tout le peuple. Il se tut un instant, semblant revivre ce qu’il disait. Puis il reprit : — Nous espérions que ce serait lui qui délivrerait Israël. Il s’essuya les yeux et se remit à marcher. — Mais avec tout cela, voici déjà le troisième jour que ces événements se sont produits.`;

// 1. Découpage des titres d'en-tête (ex: "Cléopas et la désillusion **Lisez Luc 24.13-35.**")
text = text.replace(/^([A-ZÀ-ÿ][^\n*]+?)\s+(\*\*Lisez\s+[^*]+\*\*)/gim, '### $1\n\n$2\n\n');

// 2. Découpage après les directives en gras ("**Lisez Luc 24.13-35.** C'était...")
text = text.replace(/(\*\*[^*]+\*\*)\s+([A-ZÀ-ÿ])/g, '$1\n\n$2');

// 3. Découpage intelligent des dialogues au tiret cadratin (—)
text = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s*)/g, '$1\n\n$2');
text = text.replace(/\.\s+([—–\u2013\u2014]\s*[A-ZÀ-ÿ])/g, '.\n\n$1');

console.log('FORMATTED TEXT:\n' + text);
