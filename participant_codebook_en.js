/* English version of experiment_v005_no_rationale/configs/aisas_codebook.yaml (codebook v002, 4 labels) for participants.
 * Translation rules (see SPEC.md §7): meaning preserved; terminology unified to stage / change point / step / session;
 * statements about how often a stage occurs in the data, and fields that belong to the model pipeline
 * (ambiguity flags, gate notes), are omitted because they would hint at the answer distribution.
 * Boundary cases marked "provisional" in the Japanese codebook are written here as plain rules (participants need one answer).
 * Review by the research team is required before use. */
window.PARTICIPANT_CODEBOOK = {
  version: "v002 (English version for participants)",
  codebook_version: "v002",
  domain_notes: [
    "Each session is one shopping visit on Amazon, recorded as fine-grained steps (click, scroll, typed input, page navigation, tab switch).",
    "One step = one action. A single step rarely tells the whole story, so judge the stage from the surrounding context of the same session: which page the shopper is on, what they are looking at, and what they eventually do.",
    "There are four labels: Interest, Search, Action and Uncertain. The names come from a marketing model, but in this study they mean exactly what is defined below. In particular, searching for products and looking through search results is Interest, and examining one specific product is Search.",
    "The stages do not have to progress in order. A shopper may go back from Search to Interest, start directly in Search, and so on.",
    "Assign Action only when the step itself shows a click on a purchase-related button. Do not assign it from context alone."
  ],
  quick_rules: [
    "Typing a search, clicking a suggested term, filtering, sorting or scrolling search results → Interest.",
    "Clicking a recommended or advertised product (home page, recommendation carousels) → Interest.",
    "Opening a product from the search results or the cart, reading its page, choosing its colour or size, opening its reviews → Search.",
    "Looking at the cart or a saved list → Search.",
    "Add to cart, remove from cart, change quantity, buy now, proceed to checkout, subscribe → Action.",
    "Account, orders, unrelated pages, or no way to tell → Uncertain."
  ],
  labels: {
    interest: {
      definition: "The shopper has not yet focused on one specific product. They show interest in a product category or a set of candidates: reacting to recommended products or ads, searching for products, and filtering, sorting or browsing search results. A shopper who starts the session already interested in a category or product is also in this stage.",
      positive_examples: [
        "Clicking a recommended or advertised product on the home page, on another site, or in a recommendation area of any page (for example \"Buy again\", \"Your browsing history\", \"Products related to this item\").",
        "Typing in the search box, clicking the search button, or clicking a suggested search term.",
        "Using filters, refinements, sorting or page numbers on a search results page; scrolling a search results page.",
        "Moving to a category, store, best-seller or deals page.",
        "Scrolling the home page, or paging through a recommendation carousel."
      ],
      negative_examples: [
        "Clicking a specific product in the search results or in the cart (Search).",
        "Scrolling a product detail page (Search).",
        "Add to cart or changing the quantity (Action)."
      ],
      typical_signals: ["Search results page (URL /s) or home page", "Typed input", "Click type search, suggested_term or filter", "Page numbers or recommendation carousels"]
    },
    search: {
      definition: "The shopper focuses on a specific product and looks into it in detail: clicking a specific product, reading its detail page, opening its reviews, or checking the contents of the cart (the products already chosen or saved).",
      positive_examples: [
        "Clicking a specific product link from the search results, the cart or a saved list.",
        "Scrolling a product detail page (description, images, videos), playing its video, or navigating to a product detail page.",
        "Selecting a colour, size or other option on a product detail page to see that variant.",
        "Opening reviews or paging through review images (click type review).",
        "Checking the cart: opening the cart, scrolling the cart page, clicking a product in the cart side bar.",
        "Looking at the \"Save for later\" list or a wish list, or adding a product to a wish list."
      ],
      negative_examples: [
        "Searching for products, or scrolling and filtering search results (Interest).",
        "Clicking a recommended or advertised product (Interest).",
        "Add to cart, remove from cart, changing the quantity, buy now, proceed to checkout (Action)."
      ],
      typical_signals: ["Product detail page (URL contains /dp or /gp/product)", "Click type product_link, review, product_option or cart_side_bar", "Scrolling the cart page", "Opening the cart"]
    },
    action: {
      definition: "The shopper clicks a purchase-related button: add to cart, remove from cart, change the quantity, buy now, proceed to checkout, or subscribe. Only when that act is visible in the step itself.",
      positive_examples: [
        "Click type purchase (add to cart / buy now / proceed to checkout / subscribe & save \"Set up now\").",
        "Click type quantity: opening or changing the quantity selector, increasing or decreasing the quantity in the cart or the cart side bar, or \"Delete\".",
        "Selecting or deselecting items for purchase in the cart (click type cart_page_select, including select all / deselect all).",
        "Moving an item between \"Save for later\" and the cart (\"Move to cart\" / \"Save for later\" buttons).",
        "Navigation to the page shown right after adding to cart (URL contains /cart/add-to-cart)."
      ],
      negative_examples: [
        "Just scrolling the cart page (Search).",
        "Adding to a wish list (Search: not a purchase button).",
        "Ticking a coupon box or only opening the one-time / subscribe options (Search: not a purchase button)."
      ],
      typical_signals: ["Click type purchase, quantity or cart_page_select", "Element id contains add_to_cart, buy_now, check_out, set_up_now or delete", "URL contains /cart/add-to-cart"],
      hard_requirement: "Assign Action only when the step itself contains a click on a purchase-related button (or the page shown right after adding to cart). Never assign Action from context alone."
    },
    uncertain: {
      definition: "The behaviour does not clearly belong to any of the other labels, is ambiguous, or seems unrelated to shopping. Also use it when there is not enough evidence or two labels are equally plausible.",
      positive_examples: [
        "Account, order-history or returns operations (account and lists button, orders button, /your-orders, order history).",
        "Steps on pages unrelated to shopping (music or video services, sign-in, error pages), or switching to such a tab.",
        "Closing a pop-up or other interface actions that say nothing about the stage.",
        "A lone scroll or tab switch with no change of page, where the purpose cannot be read from the surrounding steps either.",
        "Leaving the session at the end with no readable intent."
      ],
      negative_examples: [],
      typical_signals: ["Click type nav_bar or other on account or unrelated pages", "URL is /gp/css/order-history or /your-orders", "Purpose cannot be identified from context"]
    }
  },
  tie_break_rules: [
    "Decide in this order of priority: an explicit act in the step itself > the steps immediately before and after > the purpose of the session as a whole.",
    "Searching for products and checking the search results (scroll, filter, sort, page numbers) is Interest, even though the word \"search\" is used.",
    "Anything about one specific product (its detail page, its reviews, choosing its options) is Search.",
    "A product click depends on where it comes from: from a recommendation area or an ad it is Interest; from the search results, the cart or a saved list it is Search.",
    "A scroll depends on the page: search results or home page → Interest; product detail, cart or checkout page → Search.",
    "Page navigations (including back and reload) and tab switches: apply the rules above to the page that is shown. If that page is unrelated to shopping, use Uncertain.",
    "Step #1 follows the same rules: landing on search results or the home page is Interest; landing directly on a product detail page is Search.",
    "Assign Action only when the step contains a purchase-related button click.",
    "If two or more labels are equally plausible and you cannot decide, use Uncertain."
  ]
};
