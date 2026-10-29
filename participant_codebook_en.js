/* English version of experiment_v005_no_rationale/configs/aisas_codebook.yaml (codebook v002, 4 labels) for participants.
 * 2026-10-29 (requester, after the pilot, agreed with the co-authors): participants see the label definitions only. The
 * examples, counter-examples, typical signals, quick rules, tie-break rules and the notes on the domain that the earlier
 * version had (and showed in the Stage guide and on the instructions page) were removed; the last version with them is
 * this file at commit 6ee335f. The four definitions are unchanged.
 * Translation rules (see SPEC.md §7): meaning preserved; terminology unified to stage / change point / step / session;
 * statements about how often a stage occurs in the data are omitted because they would hint at the answer distribution. */
window.PARTICIPANT_CODEBOOK = {
  version: "v002 (English version for participants, definitions only)",
  codebook_version: "v002",
  intro: "There are four labels: Interest, Search, Action and Uncertain. The names come from a marketing model, but in this study they mean exactly what is defined below, even where the everyday meaning of the word differs.",
  labels: {
    interest: {
      definition: "The shopper has not yet focused on one specific product. They show interest in a product category or a set of candidates: reacting to recommended products or ads, searching for products, and filtering, sorting or browsing search results. A shopper who starts the session already interested in a category or product is also in this stage."
    },
    search: {
      definition: "The shopper focuses on a specific product and looks into it in detail: clicking a specific product, reading its detail page, opening its reviews, or checking the contents of the cart (the products already chosen or saved)."
    },
    action: {
      definition: "The shopper clicks a purchase-related button: add to cart, remove from cart, change the quantity, buy now, proceed to checkout, or subscribe. Only when that act is visible in the step itself."
    },
    uncertain: {
      definition: "The behaviour does not clearly belong to any of the other labels, is ambiguous, or seems unrelated to shopping. Also use it when there is not enough evidence or two labels are equally plausible."
    }
  }
};
