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
      images:         "Images",
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
      close:          "Close"
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
      images:         "Images",
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
      close:          "Fermer"
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
