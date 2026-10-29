/* English version of experiment_v005_no_rationale/configs/aisas_codebook.yaml (codebook v002, 4 labels) for participants.
 * 2026-10-29 (requester, after the pilot, agreed with the co-authors): participants see the label definitions only. The
 * examples, counter-examples, typical signals, quick rules, tie-break rules and the notes on the domain that the earlier
 * version had (and showed in the Stage guide and on the instructions page) were removed; the last version with them is
 * this file at commit 6ee335f.
 * 2026-10-29, second change (requester): the definitions themselves listed concrete operations (searching, filtering
 * search results, reading the detail page, the cart, add to cart, ...). They now state the stage only, e.g. Interest =
 * interest in a product category, Search = examining one specific product. The previous wording is this file at 0284601.
 *   Uncertain and the intro sentence are unchanged. Terminology: stage / change point / step / session (SPEC.md §7). */
window.PARTICIPANT_CODEBOOK = {
  version: "v002 (English version for participants, definitions only, without concrete operations; 2026-10-29)",
  codebook_version: "v002",
  intro: "There are four labels: Interest, Search, Action and Uncertain. The names come from a marketing model, but in this study they mean exactly what is defined below, even where the everyday meaning of the word differs.",
  labels: {
    interest: {
      definition: "The shopper is interested in a product category or a set of candidate products, but has not yet focused on one specific product."
    },
    search: {
      definition: "The shopper has focused on one specific product and is examining it in detail."
    },
    action: {
      definition: "The shopper performs a purchase-related operation in the step itself."
    },
    uncertain: {
      definition: "The behaviour does not clearly belong to any of the other labels, is ambiguous, or seems unrelated to shopping. Also use it when there is not enough evidence or two labels are equally plausible."
    }
  }
};
