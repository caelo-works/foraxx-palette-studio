// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Strings_js
#define __FX_Strings_js

/*
 * FXStrings.js - the interface, in English and French.
 *
 * Every string the user can read lives here and nowhere else. A literal left in
 * FXDialog.js is a string that silently stays English when the language is
 * switched, and nothing on screen would say so - which is why tests/strings
 * asserts that the two tables carry exactly the same keys and that neither
 * carries an empty one.
 *
 * Keys follow the control they belong to: a slider named "gainSii" reads its
 * label from "gainSii" and its tooltip from "gainSiiTip". Sliders are built by
 * fxNumericRow, which already takes that name, so the pairing is mechanical
 * rather than remembered.
 *
 * Rich text is allowed - PixInsight renders a subset of HTML in tooltips - but
 * the markup must be identical in both languages, or one of them silently loses
 * its formatting. The test checks that too.
 *
 * On translating this file: the terms of art are the ones French-speaking
 * astrophotographers actually use in PixInsight, not literal translations.
 * "starless" stays "starless", because that is what the tools are called;
 * "black point" is "point noir"; "midtones" is "tons moyens"; "stretch" stays
 * "stretch", because "etirement" is not what anybody says at the eyepiece.
 */

var FX_UI =
{
   en:
   {
      // --- the header ------------------------------------------------------
      tagline:        "Your channels already hold the colour. This decides where it goes.",
      byLine:         "by CaeloWorks",
      byLineTip:      "https://pixinsight-scripts.caelo.works/",
      language:       "Language:",
      languageTip:    "<p>The language of this dialog. Remembered between sessions.</p>"
                    + "<p>Image identifiers and console output are not translated: they are "
                    + "what you type and what you paste into a forum post.</p>",

      // --- the banner ------------------------------------------------------
      bannerLinear:   "<b>SUPPLY NON-LINEAR (STRETCHED) IMAGES.</b> Linear data is not supported: "
                    + "stretch each channel before you run this.",

      // --- channels --------------------------------------------------------
      threeChannels:  "3 channels (Sii / Ha / Oiii)",
      twoChannels:    "2 channels (Ha / Oiii)",
      starlessOnly:   "Starless only - do not build a stars image",
      palette:        "Palette:",
      reloadList:     "Reload image list",
      reloadListTip:  "<p>Rescan the workspace. Use it if you created or renamed images after "
                    + "opening this dialog.</p>",

      // --- sections --------------------------------------------------------
      secGeneral:     "General",
      secNormalize:   "Channel normalization",
      secWeighting:   "Weighting, transition and colour",
      secStars:       "Stars",
      secScnr:        "Green / magenta suppression",
      secHdr:         "HDR and local contrast",
      secLuminance:   "Artificial luminance",
      secOutput:      "Output",

      // --- preview ---------------------------------------------------------
      preview:        "Preview",
      targetStarless: "Starless",
      targetStars:    "Stars",
      targetLum:      "Luminance",
      fit:            "Fit",
      oneToOne:       "1:1",
      detailAuto:     "Detail: auto",
      detail11:       "Detail: 1:1",
      detail12:       "Detail: 1:2",
      detail14:       "Detail: 1:4",
      detail18:       "Detail: 1:8",
      auto:           "Auto",
      refresh:        "Refresh",
      selectChannels: "Select your channels to build a preview.",
      rendering:      "Rendering preview...",
      renderFailed:   "The render failed - see the console.",
      noHistogram:    "No histogram yet - render a preview first.",

      // --- levels ----------------------------------------------------------
      levelsFor:      "Levels",
      reset:          "Reset",
      resetAll:       "Reset all",
      imageName:      "Image name:",
      execute:        "Execute",
      close:          "Close",

      // --- sliders: label and tooltip, keyed on the row name --------------
      normSii:        "Sii level:",
      normSiiTip:     "<p>Where Sii's median lands, as a multiple of the reference "
                      + "channel's.</p><p>1.00 matches it exactly. Below 1 leaves Sii darker than "
                      + "Ha, above 1 pushes it brighter.</p>",
      normHa:         "Ha level:",
      normHaTip:      "<p>Where Ha's median lands, as a multiple of the reference channel's. With "
                      + "Ha as the reference, 1.00 leaves it exactly as it was.</p>",
      normOiii:       "Oiii level:",
      normOiiiTip:    "<p>Where Oiii's median lands, as a multiple of the reference "
                      + "channel's.</p><p>Oiii is usually the weakest channel, and this is the "
                      + "slider that decides how much teal the palette ends up with.</p>",
      normShadow:     "Shadow point:",
      normShadowTip:  "<p>Where the black point sits, interpolated from each channel's darkest "
                      + "pixel towards its median.</p><p>0 puts it exactly on the minimum and "
                      + "discards nothing. Raising it deepens the background before the levels are "
                      + "matched.</p>",
      gainSii:        "Sii weight:",
      gainSiiTip:     "<p>Weight applied to Sii before the combination.</p><p>This is a soft "
                      + "gain, g&middot;x / (1 + (g-1)&middot;x). It keeps 0 at 0 and 1 at 1, so "
                      + "raising a channel brightens the faint signal without ever clipping the "
                      + "bright cores the way a plain multiplication would.</p>",
      gainHa:         "Ha weight:",
      gainHaTip:      "<p>Weight applied to Ha before the combination. Soft gain, no highlight "
                      + "clipping.</p><p>On a Foraxx palette Ha feeds the ho mask as well as "
                      + "both blended slots, so raising it moves the gold / teal boundary "
                      + "outwards. On a fixed mapping it only brightens wherever that mapping "
                      + "puts Ha.</p>",
      gainOiii:       "Oiii weight:",
      gainOiiiTip:    "<p>Weight applied to Oiii before the combination. Soft gain, no highlight "
                      + "clipping.</p><p>On a Foraxx palette Oiii feeds both dynamic masks as "
                      + "well as the anchor slot, so this slider has the strongest effect on where "
                      + "the palette switches between gold and teal. On a fixed mapping it only "
                      + "brightens wherever that mapping puts Oiii.</p>",
      blend:          "Foraxx amount:",
      blendTip:       "<p>Interpolates between the plain fixed mapping and the full dynamic "
                      + "blend.</p><p>0.00 gives the ordinary mapping, 1.00 the classic Foraxx "
                      + "result.</p><p><b>Foraxx palettes only.</b> A fixed mapping such as SHO or "
                      + "HOO is a straight permutation of the channels, so there is nothing for "
                      + "this to interpolate; it and the two transition sliders grey out.</p>",
      hardO:          "Sii/Ha transition:",
      hardOTip:       "<p>Hardness of the 'o' mask, o = Oiii^(k&middot;~Oiii), which decides "
                      + "where red comes from Sii and where it comes from Ha.</p><p>1.00 is the "
                      + "original. Higher values delay and sharpen the switch; lower values bring "
                      + "it in earlier and soften it.</p><p><b>Three-channel Foraxx only</b> - it "
                      + "needs Sii to transition from, and a fixed mapping has no transition.</p>",
      hardHO:         "Ha/Oiii transition:",
      hardHOTip:      "<p>Hardness of the 'ho' mask, ho = "
                      + "(Ha&middot;Oiii)^(k&middot;~(Ha&middot;Oiii)), which drives the green "
                      + "channel and therefore the gold-to-teal boundary.</p><p>Usually the most "
                      + "consequential slider here.</p><p><b>Foraxx palettes only</b> - a fixed "
                      + "mapping has no transition to shape.</p>",
      curveStrength:  "Signature curves:",
      curveStrengthTip: "<p>Scales the two hue curves of the original script towards or away from "
                      + "the identity transform.</p><p>These act on hue, not brightness: they "
                      + "rotate the reds towards gold and the blues towards teal, and are a large "
                      + "part of what makes a Foraxx image look the way it does.</p>",
      satStrength:    "Selective saturation:",
      satStrengthTip: "<p>Scales the global saturation curve and both selective saturation "
                      + "passes, which boost a narrow band of golds and a narrow band of blues "
                      + "while leaving everything between them alone.</p>",
      extraSaturation: "Overall saturation:",
      extraSaturationTip: "<p>A flat saturation boost across every hue, on top of the selective pass "
                      + "above.</p><p>0 leaves it alone. This is what gives the Andy Warhol palette "
                      + "its poster colour.</p>",
      posterLevels:   "Posterise levels:",
      posterLevelsTip: "<p>Quantises each channel to this many evenly spaced levels, so gradients "
                      + "become flat blocks of colour - the screen-print look.</p><p>0 is off. 4 to "
                      + "8 gives a recognisable poster; higher values are subtler.</p>",
      starStretch:    "Star brightness:",
      starStretchTip: "<p>A hyperbolic stretch, ((3^k)&middot;$T) / ((3^k-1)&middot;$T+1) - the "
                      + "midtones transfer function with m = 1/(1+3^k). It fixes 0 and 1 and is "
                      + "monotonic, so it lifts faint stars hard without ever clipping a bright "
                      + "core. 0 leaves them exactly as the combination produced them.</p><p>1.00 "
                      + "is a gentle lift that suits stars which have already been stretched, which "
                      + "is what this script expects.</p><p>At 5.00 the multiplier is 243: on a "
                      + "star frame whose background already sits at 0.02 that lifts it to 0.83, "
                      + "and at 0.05 to 0.93 - a white sky either way. Raise it only if your stars "
                      + "really are still faint, and watch the preview.</p>",
      starSaturation: "Star colour boost:",
      starSaturationTip: "<p>A hue-weighted saturation boost, applied after the brightness stretch. "
                      + "This is what brings out the blue / white / amber spread of a star "
                      + "field.</p><p>0 leaves the colour alone. 1.00 is a good starting point once "
                      + "the brightness is where you want it.</p>",
      scnrGreen:      "Green amount:",
      scnrGreenTip:   "<p>The amount for the green pass. 0 is off, 1 removes all of the detected "
                      + "excess.</p>",
      scnrMagenta:    "Magenta amount:",
      scnrMagentaTip: "<p>The amount for the magenta pass, run as invert, remove green, "
                      + "invert.</p>",
      hdrAmount:      "Highlight compression:",
      hdrAmountTip:   "<p>Pulls the tones above the knee back towards it. Nothing below the knee "
                      + "is touched at all.</p><p>The correction is computed on luminance and "
                      + "applied as a single scale factor to all three channels, so hue and "
                      + "saturation survive intact. Entirely scale invariant, so the preview "
                      + "matches the final image exactly.</p>",
      hdrKnee:        "Compression knee:",
      hdrKneeTip:     "<p>The brightness above which compression starts. Everything darker is "
                      + "left completely alone.</p><p>Lower it to reach further down into the "
                      + "midtones, raise it to affect only the very brightest cores.</p>",
      hdrLayers:      "HDR multiscale layers:",
      hdrLayersTip:   "<p>Runs a multiscale HDR transform with this many layers. 0 skips "
                      + "it.</p><p>Far more effective than a curve on genuinely blown cores, but it "
                      + "works on spatial scales, so at a reduced preview sampling it can only be "
                      + "indicative. Check the result at 1:1, or after Execute.</p>",
      localContrast:  "Local contrast:",
      localContrastTip: "<p>A large scale unsharp mask on the luminance, to put back structure that "
                      + "highlight compression flattens. Also scale dependent, so the preview is "
                      + "indicative.</p>",
      lumApply:       "Apply to the image:",
      lumApplyTip:    "<p>How much of the artificial luminance to substitute into the colour "
                      + "image.</p><p>0 produces the layer and leaves the colour image untouched, "
                      + "so you can combine them yourself. 1 fully replaces the image's own "
                      + "lightness. The colour ratios are preserved either way, and the "
                      + "substitution stops where a channel would clip.</p>",

      // --- shared fragments -------------------------------------------------
      rangeNote:      "Range %s to %s. The button on the left puts it back to the "
                    + "palette's own starting value.",
      resetToPalette: "Reset to the palette's starting value.",
   },

   fr:
   {
      // --- l'en-tête -------------------------------------------------------
      tagline:        "Vos couches portent d\u00e9j\u00e0 la couleur. Reste \u00e0 d\u00e9cider o\u00f9 elle va.",
      byLine:         "par CaeloWorks",
      byLineTip:      "https://pixinsight-scripts.caelo.works/",
      language:       "Langue :",
      languageTip:    "<p>La langue de ce dialogue. Retenue d'une session \u00e0 l'autre.</p>"
                    + "<p>Les identifiants d'images et la sortie console ne sont pas traduits : "
                    + "c'est ce que vous tapez, et ce que vous collez dans un message de "
                    + "forum.</p>",

      // --- le bandeau ------------------------------------------------------
      bannerLinear:   "<b>FOURNISSEZ DES IMAGES NON LIN\u00c9AIRES (STRETCH\u00c9ES).</b> Les donn\u00e9es "
                    + "lin\u00e9aires ne sont pas prises en charge : stretchez chaque couche avant "
                    + "de lancer ce script.",

      // --- couches ---------------------------------------------------------
      threeChannels:  "3 couches (Sii / Ha / Oiii)",
      twoChannels:    "2 couches (Ha / Oiii)",
      starlessOnly:   "Starless seulement - ne pas construire d'image d'\u00e9toiles",
      palette:        "Palette :",
      reloadList:     "Recharger la liste",
      reloadListTip:  "<p>Relit l'espace de travail. \u00c0 utiliser si vous avez cr\u00e9\u00e9 ou renomm\u00e9 "
                    + "des images apr\u00e8s avoir ouvert ce dialogue.</p>",

      // --- sections --------------------------------------------------------
      secGeneral:     "G\u00e9n\u00e9ral",
      secNormalize:   "Normalisation des couches",
      secWeighting:   "Pond\u00e9ration, transition et couleur",
      secStars:       "\u00c9toiles",
      secScnr:        "Suppression du vert et du magenta",
      secHdr:         "HDR et contraste local",
      secLuminance:   "Luminance artificielle",
      secOutput:      "Sortie",

      // --- prévisualisation ------------------------------------------------
      preview:        "Pr\u00e9visualisation",
      targetStarless: "Starless",
      targetStars:    "\u00c9toiles",
      targetLum:      "Luminance",
      fit:            "Ajuster",
      oneToOne:       "1:1",
      detailAuto:     "D\u00e9tail : auto",
      detail11:       "D\u00e9tail : 1:1",
      detail12:       "D\u00e9tail : 1:2",
      detail14:       "D\u00e9tail : 1:4",
      detail18:       "D\u00e9tail : 1:8",
      auto:           "Auto",
      refresh:        "Rafra\u00eechir",
      selectChannels: "Choisissez vos couches pour construire un aper\u00e7u.",
      rendering:      "Calcul de l'aper\u00e7u...",
      renderFailed:   "Le calcul a \u00e9chou\u00e9 - voir la console.",
      noHistogram:    "Pas encore d'histogramme - calculez un aper\u00e7u d'abord.",

      // --- niveaux ---------------------------------------------------------
      levelsFor:      "Niveaux",
      reset:          "R\u00e9initialiser",
      resetAll:       "Tout r\u00e9initialiser",
      imageName:      "Nom de l'image :",
      execute:        "Ex\u00e9cuter",
      close:          "Fermer",

      // --- curseurs : libellé et infobulle, sur le nom de la ligne ---------
      normSii:        "Niveau Sii :",
      normSiiTip:     "<p>O\u00f9 se place la m\u00e9diane de Sii, en multiple de celle de la couche "
                      + "de r\u00e9f\u00e9rence.</p><p>1.00 l'aligne exactement. En dessous de 1, Sii "
                      + "reste plus sombre que Ha ; au-dessus de 1, il est pouss\u00e9 plus clair.</p>",
      normHa:         "Niveau Ha :",
      normHaTip:      "<p>O\u00f9 se place la m\u00e9diane de Ha, en multiple de celle de la couche de "
                      + "r\u00e9f\u00e9rence. Avec Ha comme r\u00e9f\u00e9rence, 1.00 la laisse exactement telle "
                      + "quelle.</p>",
      normOiii:       "Niveau Oiii :",
      normOiiiTip:    "<p>O\u00f9 se place la m\u00e9diane d'Oiii, en multiple de celle de la couche "
                      + "de r\u00e9f\u00e9rence.</p><p>Oiii est en g\u00e9n\u00e9ral la couche la plus faible, et "
                      + "c'est ce curseur qui d\u00e9cide de la quantit\u00e9 de turquoise que prendra la "
                      + "palette.</p>",
      normShadow:     "Point des basses lumi\u00e8res :",
      normShadowTip:  "<p>O\u00f9 se situe le point noir, interpol\u00e9 entre le pixel le plus sombre de "
                      + "chaque couche et sa m\u00e9diane.</p><p>0 le place exactement sur le minimum "
                      + "et ne perd rien. Le relever assombrit le fond de ciel avant l'alignement "
                      + "des niveaux.</p>",
      gainSii:        "Pond\u00e9ration Sii :",
      gainSiiTip:     "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Sii avant la combinaison.</p><p>C'est un gain "
                      + "doux, g&middot;x / (1 + (g-1)&middot;x). Il laisse 0 \u00e0 0 et 1 \u00e0 1 : "
                      + "relever une couche \u00e9claircit le signal faible sans jamais \u00e9cr\u00eater les "
                      + "c\u0153urs brillants, ce que ferait une simple multiplication.</p>",
      gainHa:         "Pond\u00e9ration Ha :",
      gainHaTip:      "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Ha avant la combinaison. Gain doux, sans "
                      + "\u00e9cr\u00eatage des hautes lumi\u00e8res.</p><p>Sur une palette Foraxx, Ha "
                      + "alimente le masque ho autant que les deux emplacements m\u00e9lang\u00e9s : le "
                      + "relever repousse vers l'ext\u00e9rieur la fronti\u00e8re or / turquoise. Sur un "
                      + "mappage fixe, il n'\u00e9claircit que l\u00e0 o\u00f9 ce mappage place Ha.</p>",
      gainOiii:       "Pond\u00e9ration Oiii :",
      gainOiiiTip:    "<p>Pond\u00e9ration appliqu\u00e9e \u00e0 Oiii avant la combinaison. Gain doux, sans "
                      + "\u00e9cr\u00eatage des hautes lumi\u00e8res.</p><p>Sur une palette Foraxx, Oiii "
                      + "alimente les deux masques dynamiques autant que l'emplacement d'ancrage : "
                      + "c'est le curseur qui p\u00e8se le plus sur l'endroit o\u00f9 la palette bascule de "
                      + "l'or au turquoise. Sur un mappage fixe, il n'\u00e9claircit que l\u00e0 o\u00f9 ce "
                      + "mappage place Oiii.</p>",
      blend:          "Quantit\u00e9 de Foraxx :",
      blendTip:       "<p>Interpole entre le mappage fixe ordinaire et le m\u00e9lange dynamique "
                      + "complet.</p><p>0.00 donne le mappage ordinaire, 1.00 le r\u00e9sultat Foraxx "
                      + "classique.</p><p><b>Palettes Foraxx uniquement.</b> Un mappage fixe comme "
                      + "SHO ou HOO est une simple permutation des couches : il n'y a rien \u00e0 "
                      + "interpoler, et ce curseur comme les deux curseurs de transition sont "
                      + "gris\u00e9s.</p>",
      hardO:          "Transition Sii/Ha :",
      hardOTip:       "<p>Duret\u00e9 du masque \u00ab o \u00bb, o = Oiii^(k&middot;~Oiii), qui d\u00e9cide o\u00f9 le "
                      + "rouge vient de Sii et o\u00f9 il vient de Ha.</p><p>1.00 est la valeur "
                      + "d'origine. Les valeurs plus hautes retardent et durcissent la bascule ; "
                      + "les plus basses l'avancent et l'adoucissent.</p><p><b>Foraxx \u00e0 trois "
                      + "couches uniquement</b> - il faut un Sii d'o\u00f9 partir, et un mappage fixe "
                      + "n'a pas de transition.</p>",
      hardHO:         "Transition Ha/Oiii :",
      hardHOTip:      "<p>Duret\u00e9 du masque \u00ab ho \u00bb, ho = "
                      + "(Ha&middot;Oiii)^(k&middot;~(Ha&middot;Oiii)), qui pilote la couche verte "
                      + "et donc la fronti\u00e8re or / turquoise.</p><p>C'est en g\u00e9n\u00e9ral le curseur "
                      + "le plus lourd de cons\u00e9quences ici.</p><p><b>Palettes Foraxx "
                      + "uniquement</b> - un mappage fixe n'a pas de transition \u00e0 modeler.</p>",
      curveStrength:  "Courbes signature :",
      curveStrengthTip: "<p>Met \u00e0 l'\u00e9chelle les deux courbes de teinte du script d'origine, en les "
                      + "rapprochant ou en les \u00e9loignant de la transformation identit\u00e9.</p><p>Elles "
                      + "agissent sur la teinte, pas sur la luminosit\u00e9 : elles font tourner les "
                      + "rouges vers l'or et les bleus vers le turquoise, et comptent pour beaucoup "
                      + "dans l'allure d'une image Foraxx.</p>",
      satStrength:    "Saturation s\u00e9lective :",
      satStrengthTip: "<p>Met \u00e0 l'\u00e9chelle la courbe de saturation globale et les deux passes de "
                      + "saturation s\u00e9lective, qui renforcent une bande \u00e9troite de dor\u00e9s et une "
                      + "bande \u00e9troite de bleus en laissant intact tout ce qui se trouve entre les "
                      + "deux.</p>",
      extraSaturation: "Saturation globale :",
      extraSaturationTip: "<p>Un renfort de saturation uniforme sur toutes les teintes, par-dessus la "
                      + "passe s\u00e9lective ci-dessus.</p><p>0 n'y touche pas. C'est ce qui donne \u00e0 "
                      + "la palette Andy Warhol sa couleur d'affiche.</p>",
      posterLevels:   "Niveaux de post\u00e9risation :",
      posterLevelsTip: "<p>Quantifie chaque couche sur ce nombre de niveaux r\u00e9guli\u00e8rement "
                      + "espac\u00e9s : les d\u00e9grad\u00e9s deviennent des aplats de couleur - l'effet "
                      + "s\u00e9rigraphie.</p><p>0 d\u00e9sactive. De 4 \u00e0 8 donne une affiche "
                      + "reconnaissable ; au-del\u00e0, l'effet est plus subtil.</p>",
      starStretch:    "Luminosit\u00e9 des \u00e9toiles :",
      starStretchTip: "<p>Un stretch hyperbolique, ((3^k)&middot;$T) / ((3^k-1)&middot;$T+1) - la "
                      + "fonction de transfert des tons moyens avec m = 1/(1+3^k). Il fixe 0 et 1 "
                      + "et reste monotone : il rel\u00e8ve fortement les \u00e9toiles faibles sans jamais "
                      + "\u00e9cr\u00eater un c\u0153ur brillant. 0 les laisse exactement telles que la "
                      + "combinaison les a produites.</p><p>1.00 est un rel\u00e8vement doux, adapt\u00e9 \u00e0 "
                      + "des \u00e9toiles d\u00e9j\u00e0 stretch\u00e9es, ce que ce script attend.</p><p>\u00c0 5.00 le "
                      + "multiplicateur vaut 243 : sur une frame d'\u00e9toiles dont le fond est "
                      + "d\u00e9j\u00e0 \u00e0 0.02, cela le porte \u00e0 0.83, et \u00e0 0.05 il monte \u00e0 0.93 - un "
                      + "ciel blanc dans les deux cas. Ne l'augmentez que si vos \u00e9toiles sont "
                      + "vraiment encore faibles, et surveillez l'aper\u00e7u.</p>",
      starSaturation: "Couleur des \u00e9toiles :",
      starSaturationTip: "<p>Un renfort de saturation pond\u00e9r\u00e9 par la teinte, appliqu\u00e9 apr\u00e8s le "
                      + "stretch de luminosit\u00e9. C'est lui qui fait ressortir l'\u00e9talement bleu / "
                      + "blanc / ambre d'un champ d'\u00e9toiles.</p><p>0 ne touche pas \u00e0 la couleur. "
                      + "1.00 est un bon point de d\u00e9part une fois la luminosit\u00e9 l\u00e0 o\u00f9 vous la "
                      + "voulez.</p>",
      scnrGreen:      "Quantit\u00e9 de vert :",
      scnrGreenTip:   "<p>La quantit\u00e9 pour la passe verte. 0 d\u00e9sactive, 1 retire tout l'exc\u00e8s "
                      + "d\u00e9tect\u00e9.</p>",
      scnrMagenta:    "Quantit\u00e9 de magenta :",
      scnrMagentaTip: "<p>La quantit\u00e9 pour la passe magenta, ex\u00e9cut\u00e9e en inversion, suppression "
                      + "du vert, inversion.</p>",
      hdrAmount:      "Compression des hautes lumi\u00e8res :",
      hdrAmountTip:   "<p>Ram\u00e8ne vers le coude les tons situ\u00e9s au-dessus de lui. Rien de ce qui "
                      + "est sous le coude n'est touch\u00e9.</p><p>La correction est calcul\u00e9e sur la "
                      + "luminance et appliqu\u00e9e comme un facteur d'\u00e9chelle unique aux trois "
                      + "couches : la teinte et la saturation en sortent intactes. Enti\u00e8rement "
                      + "invariante d'\u00e9chelle, donc l'aper\u00e7u correspond exactement \u00e0 l'image "
                      + "finale.</p>",
      hdrKnee:        "Coude de compression :",
      hdrKneeTip:     "<p>La luminosit\u00e9 \u00e0 partir de laquelle la compression commence. Tout ce qui "
                      + "est plus sombre est laiss\u00e9 enti\u00e8rement tranquille.</p><p>Abaissez-le pour "
                      + "descendre plus loin dans les tons moyens, relevez-le pour n'agir que sur "
                      + "les c\u0153urs les plus brillants.</p>",
      hdrLayers:      "Couches multi-\u00e9chelles HDR :",
      hdrLayersTip:   "<p>Applique une transformation HDR multi-\u00e9chelle avec ce nombre de couches. "
                      + "0 la saute.</p><p>Bien plus efficace qu'une courbe sur des c\u0153urs "
                      + "r\u00e9ellement cram\u00e9s, mais elle travaille sur des \u00e9chelles spatiales : \u00e0 "
                      + "l'\u00e9chantillonnage r\u00e9duit de l'aper\u00e7u, elle ne peut \u00eatre qu'indicative. "
                      + "V\u00e9rifiez le r\u00e9sultat \u00e0 1:1, ou apr\u00e8s Ex\u00e9cuter.</p>",
      localContrast:  "Contraste local :",
      localContrastTip: "<p>Un masque flou \u00e0 grande \u00e9chelle sur la luminance, pour restituer la "
                      + "structure que la compression des hautes lumi\u00e8res aplatit. D\u00e9pend lui "
                      + "aussi de l'\u00e9chelle, donc l'aper\u00e7u n'est qu'indicatif.</p>",
      lumApply:       "Appliquer \u00e0 l'image :",
      lumApplyTip:    "<p>Quelle part de la luminance artificielle est substitu\u00e9e dans l'image "
                      + "couleur.</p><p>0 produit la couche et laisse l'image couleur intacte, \u00e0 "
                      + "vous de les combiner vous-m\u00eame. 1 remplace enti\u00e8rement la luminosit\u00e9 "
                      + "propre de l'image. Les rapports de couleur sont pr\u00e9serv\u00e9s dans les deux "
                      + "cas, et la substitution s'arr\u00eate l\u00e0 o\u00f9 une couche \u00e9cr\u00eaterait.</p>",

      // --- fragments partagés -----------------------------------------------
      rangeNote:      "Plage de %s \u00e0 %s. Le bouton \u00e0 gauche remet le curseur \u00e0 la valeur de "
                    + "d\u00e9part de la palette.",
      resetToPalette: "Remettre \u00e0 la valeur de d\u00e9part de la palette."
   }
};

/*
 * The one accessor. Falls back to English for a key the current language has
 * not been given, and returns the key itself if neither has it - visible in the
 * interface, which is the point: a missing string should look wrong rather than
 * render as an empty label nobody notices.
 */
function fxT( key )
{
   let t = FX_UI[ FX.lang ] || FX_UI.en;
   if ( t[key] !== undefined )
      return t[key];
   if ( FX_UI.en[key] !== undefined )
      return FX_UI.en[key];
   return key;
}

#endif   // __FX_Strings_js
