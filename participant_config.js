/* Participant site configuration (production values are NOT set).
 *
 * Every value marked "[CONFIG REQUIRED: ...]" or null must be provided by the research team before a live study.
 * Status 2026-10-05: all values are set (endpoint deployed). The completion code / URL lives only in the Worker secret.
 * participant.js computes a readiness check from this file: while anything required is missing, the site shows the
 * missing items in English and refuses to start assigned sessions / accept a submission / show a completion code.
 * Do not put test fixtures or mock endpoints in this file; tests use their own config in a separate directory.
 */
window.PARTICIPANT_CONFIG = {
  // Identifier for the state namespace and the submission payload. Change per study (pilot and main study differ).
  // Use [A-Za-z0-9_.-] only. Must equal the endpoint's STUDY_ID and the --study-id given to release/make_allocations.py,
  // because the allocation tokens are signed for it.
  // Decided 2026-10-05: pilot "aisas_pilot_2026_10" (runs first), main study "aisas_main_2026_10".
  // After the pilot: change this to "aisas_main_2026_10", rebuild/publish, redeploy the Worker with the same STUDY_ID and
  // regenerate the allocations (release/README.md "パイロットから本番への切り替え").
  study_id: "aisas_pilot_2026_10",

  // Texts shown on the consent / briefing page. Anything still containing "[CONFIG REQUIRED" makes the site not ready.
  study: {
    title: "Marking the stages of a shopping journey",
    institution: "Hitotsubashi University",   // decided 2026-10-05 (research team names may be added)
    // contact / ethics / retention / deletion / payment decided 2026-10-05 (answers_3.md)
    contact: "Please contact us through Prolific's messaging system.",
    // Not reviewed by an ethics committee: say so plainly; nothing here may read as an approval.
    ethics: "Not applicable: this study has not been reviewed by a research ethics committee.",
    // What is recorded follows the 2026-10-05 decision to collect Prolific IDs (ids.include_prolific_url_params: true).
    // Retention: private data (Prolific ID + raw submission) deleted 5 years after the project ends; deletion on request
    // within 7 days of the submission (answers_3.md said 30; the requester shortened it on 2026-10-21); published anonymised markings cannot be deleted.
    data_retention: "When you press \"Send my results\", we receive your stage markings and comments, your Prolific ID, the Prolific study and session IDs, the time you agreed to take part, your practice attempts, timestamps of your actions in the task (for example, when you open a session or set a mark), and your browser type and window size. We do not ask for your name or e-mail address, and we do not store your IP address (the hosting services, GitHub Pages and Cloudflare, may keep standard access logs). Your Prolific ID is used only to process your submission and payment and to handle a request to withdraw your data. Your Prolific ID and your raw submission are stored privately (never published) and are deleted five years after the end of the research project. You can ask us to delete your data within 7 days of your submission by sending us a message through Prolific. Anonymised markings that have already been published cannot be deleted, because they cannot be linked back to you.",
    // Decided 2026-10-05: markings are published, limited to IDs linked to the OPeRA dataset + the new labels (CC BY 4.0).
    data_sharing: "Your stage markings may be published as part of an open research dataset under the CC BY 4.0 licence. The published data will contain only the identifiers of the OPeRA sessions and steps and the stage markings. Your Prolific ID and any other information that could identify you will not be published.",
    estimated_minutes: 30,             // decided 2026-10-05 (docs/prolific_study_design.md §6; same value in Prolific)
    payment_text: "£4.50 for about 30 minutes. We review submissions within 3 days.",
  },

  // Prolific IDs: whether to read PROLIFIC_PID / STUDY_ID / SESSION_ID from the URL and include them in the payload.
  // Decided 2026-10-05: collect them (true). The Taskflow URLs must then carry the placeholders, which
  // release/make_allocations.py adds by default (--prolific-params). See docs/prolific_study_design.md §4.2.
  ids: { include_prolific_url_params: true },

  // Assigned sessions. Either provide `sessions` here (array of session_uid) or pass them in the URL as
  // ?sessions=uid1,uid2&alloc=TOKEN (e.g. via Prolific Taskflow). `alloc` (allocation token) is required in both cases
  // because it is the idempotency key of the submission and part of the storage namespace.
  // SECURITY BOUNDARY: URL parameters can be edited by the participant. The UI only filters what is shown; it does not
  // authorise anything. The result endpoint must verify the allocation token, that the submitted sessions are the ones
  // allowed for that token, duplicate submissions, and payload schema/size. Query strings (including `alloc`) can end up
  // in GitHub/CDN logs, browser history and referrers: do not put secrets or direct identifiers in them.
  // Sessions not present in data/participant_data.js cannot be shown (see SPEC.md §8.2 for the bundle-scope decision).
  // For the live study, the URLs (sessions + signed token) come from release/make_allocations.py (taskflow.csv), so
  // `sessions` and `token` stay null here.
  allocation: { sessions: null, token: null, url_params: { sessions: "sessions", token: "alloc" } },

  // Practice + comprehension check. null = not configured -> live study cannot start.
  // Shape: [{ id, title, intro, logs: [ <same step schema as participant_data> ], question, options: [..], correct_index }]
  //   or, with several questions answered together: [{ id, title, intro, logs, questions: [{ question, options, correct_index }, ...] }]
  // Material must be synthetic or held-out; never one of the assigned/evaluated sessions.
  // BEGIN practice: copied verbatim from practice/practice_v002.json (built by practice/build_practice.py, codebook v002,
  // session s_5035d4f3fbd1a829, not one of the 25 evaluated sessions). Re-copy the whole array if that file changes;
  // release/build_public.py warns when the two differ. The answer key (practice_v002_key.json) is never published.
  // Note: correct_index is visible to anyone reading this public file; the comprehension check is a teaching aid,
  // not a security measure (Prolific: failing it twice -> return, never a rejection).
  practice: [
    {
      "id": "practice_v002_tide",
      "title": "Searching for a stain-remover pen",
      "intro": "A short real session (12 steps, about 20 seconds). Go through the steps, choose the starting stage on step #1 and mark every step where the stage changes, exactly as you will do in the main sessions. Your practice marks are not scored. Then answer the three questions below; you can open the Stage guide at any time.",
      "logs": [
        {
          "log_id": "5e57241976",
          "action_id": "2805ec35-dda6-476a-a8a0-74db35b9a3eb",
          "pos": 1,
          "t_rel_s": 0.0,
          "dt_s": 0.0,
          "action_type": "navigation",
          "click_type": null,
          "navigation_type": "new",
          "semantic_id": "",
          "page_kind": "home",
          "url_path": "/",
          "page_changed": true,
          "observation": {},
          "rationale": null,
          "screenshot": null,
          "screenshot_new_page": "007381.jpg",
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "557a3992cb",
          "action_id": "22084fac-3730-44f3-aa2a-161a209175e1",
          "pos": 2,
          "t_rel_s": 1.1,
          "dt_s": 1.1,
          "action_type": "tab_activate",
          "click_type": null,
          "navigation_type": null,
          "semantic_id": "",
          "page_kind": "home",
          "url_path": "/",
          "page_changed": false,
          "observation": {},
          "rationale": null,
          "screenshot": "007381.jpg",
          "screenshot_new_page": "007382.jpg",
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "56bf38f242",
          "action_id": "ecbb8914-0e8a-4139-a042-879d46f82cd7",
          "pos": 3,
          "t_rel_s": 3.7,
          "dt_s": 2.6,
          "action_type": "input",
          "click_type": null,
          "navigation_type": null,
          "semantic_id": "nav_bar.search_input",
          "page_kind": "home",
          "url_path": "/",
          "page_changed": false,
          "observation": {
            "input_text": "tide pens"
          },
          "rationale": null,
          "screenshot": null,
          "screenshot_new_page": null,
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "09426cd669",
          "action_id": "309b2de1-ed18-4fe3-bcd3-ba69818cfd07",
          "pos": 4,
          "t_rel_s": 3.9,
          "dt_s": 0.2,
          "action_type": "click",
          "click_type": "search",
          "navigation_type": null,
          "semantic_id": "nav_bar.search_button",
          "page_kind": "home",
          "url_path": "/",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "element_text": "Go",
            "element_tag": "INPUT"
          },
          "rationale": null,
          "screenshot": null,
          "screenshot_new_page": null,
          "mouse": {
            "x": 0.0,
            "y": 0.0
          },
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "58d324cf38",
          "action_id": "66506ff0-d388-4ac8-a848-90c4ad026608",
          "pos": 5,
          "t_rel_s": 5.7,
          "dt_s": 1.9,
          "action_type": "scroll",
          "click_type": null,
          "navigation_type": null,
          "semantic_id": "",
          "page_kind": "search_results",
          "url_path": "/s",
          "page_changed": true,
          "observation": {
            "search_term": "tide pens",
            "search_result_count": 64,
            "search_result_titles": [
              "Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover for Clothes, Travel & Poc",
              "Pen Stain Remover for Clothes, To Go Pen, Instant Stain Remover Pen & Spot Cleaner, Portab"
            ],
            "scroll": {
              "dir": "down",
              "dist_y": 159,
              "top": 160
            }
          },
          "rationale": null,
          "screenshot": "007383.jpg",
          "screenshot_new_page": null,
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "144d52ae8f",
          "action_id": "41b69940-0ed5-4821-bf9c-3d360f9eed26",
          "pos": 6,
          "t_rel_s": 8.6,
          "dt_s": 2.8,
          "action_type": "click",
          "click_type": "product_link",
          "navigation_type": null,
          "semantic_id": "search_results.pen_stain_remover_for_clothes_tide_to_go_pen_instant_stain_remove",
          "page_kind": "search_results",
          "url_path": "/s",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "search_result_count": 64,
            "search_result_titles": [
              "Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover for Clothes, Travel & Poc",
              "Pen Stain Remover for Clothes, To Go Pen, Instant Stain Remover Pen & Spot Cleaner, Portab"
            ],
            "element_text": "Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain",
            "element_tag": "SPAN"
          },
          "rationale": null,
          "screenshot": "007384.jpg",
          "screenshot_new_page": null,
          "mouse": {
            "x": 467.0,
            "y": 375.0
          },
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "df00210b9b",
          "action_id": "47945f16-a05c-4c83-84a9-a0f846611a03",
          "pos": 7,
          "t_rel_s": 10.4,
          "dt_s": 1.8,
          "action_type": "scroll",
          "click_type": null,
          "navigation_type": null,
          "semantic_id": "",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": true,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "scroll": {
              "dir": "down",
              "dist_y": 25,
              "top": 32
            }
          },
          "rationale": null,
          "screenshot": "007385.jpg",
          "screenshot_new_page": null,
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "0ee520d180",
          "action_id": "16307e60-b7c1-46f5-87df-27183d4772eb",
          "pos": 8,
          "t_rel_s": 11.0,
          "dt_s": 0.6,
          "action_type": "scroll",
          "click_type": null,
          "navigation_type": null,
          "semantic_id": "",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "scroll": {
              "dir": "down",
              "dist_y": 136,
              "top": 169
            }
          },
          "rationale": null,
          "screenshot": null,
          "screenshot_new_page": null,
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "be5c2e9bf0",
          "action_id": "185d7196-351a-42e6-ae0f-5cc3be7a71ed",
          "pos": 9,
          "t_rel_s": 12.4,
          "dt_s": 1.5,
          "action_type": "navigation",
          "click_type": null,
          "navigation_type": "new",
          "semantic_id": "",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "comparison_items_shown": 6
          },
          "rationale": null,
          "screenshot": null,
          "screenshot_new_page": "007386.jpg",
          "mouse": null,
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "e831d75283",
          "action_id": "6b710531-adb3-4423-aa4a-4c038ceda877",
          "pos": 10,
          "t_rel_s": 15.2,
          "dt_s": 2.8,
          "action_type": "click",
          "click_type": "other",
          "navigation_type": null,
          "semantic_id": "coupon.checkbox",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "comparison_items_shown": 6,
            "element_tag": "I"
          },
          "rationale": "adding a coupon",
          "screenshot": "007387.jpg",
          "screenshot_new_page": null,
          "mouse": {
            "x": 860.0,
            "y": 439.0
          },
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "c4e813e614",
          "action_id": "5ce21e5d-c82e-4d9e-a5b4-c9774f65840b",
          "pos": 11,
          "t_rel_s": 15.2,
          "dt_s": 0.0,
          "action_type": "click",
          "click_type": "other",
          "navigation_type": null,
          "semantic_id": "coupon.checkbox",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "comparison_items_shown": 6,
            "element_tag": "INPUT"
          },
          "rationale": null,
          "screenshot": "007388.jpg",
          "screenshot_new_page": null,
          "mouse": {
            "x": 860.0,
            "y": 439.0
          },
          "window": {
            "w": 1496,
            "h": 789
          }
        },
        {
          "log_id": "a539945a6b",
          "action_id": "1aaf1d12-a2fb-430b-a4e2-c091e8bc7cac",
          "pos": 12,
          "t_rel_s": 22.1,
          "dt_s": 6.8,
          "action_type": "click",
          "click_type": "purchase",
          "navigation_type": null,
          "semantic_id": "buybox.one_time_purchase.purchase_form.add_to_cart",
          "page_kind": "product_detail",
          "url_path": "/Tide-Remover-Clothes-Instant-Travel/dp/B0C4WC8QJR/ref=sr_1_",
          "page_changed": false,
          "observation": {
            "search_term": "tide pens",
            "page_product": "Tide Pen Stain Remover for Clothes, Tide To Go Pen, Instant Stain Remover Pen & Spot Clean",
            "page_product_price": "$6.99",
            "page_product_asin": "B0C4WC8QJR",
            "comparison_items_shown": 6,
            "element_text": "Add to Cart",
            "element_tag": "INPUT"
          },
          "rationale": "I want to buy this product",
          "screenshot": "007389.jpg",
          "screenshot_new_page": null,
          "mouse": {
            "x": 1368.0,
            "y": 343.0
          },
          "window": {
            "w": 1496,
            "h": 789
          }
        }
      ],
      "questions": [
        {
          "question": "In step #5 the shopper scrolls through the search results for “tide pens”. Which stage is this?",
          "options": [
            "Interest",
            "Search",
            "Action",
            "Uncertain"
          ],
          "correct_index": 0
        },
        {
          "question": "In step #12 the shopper clicks “Add to Cart”. Which stage is this?",
          "options": [
            "Interest",
            "Search",
            "Action",
            "Uncertain"
          ],
          "correct_index": 2
        },
        {
          "question": "The session starts in Interest on step #1. At which step does the stage change for the first time?",
          "options": [
            "Step #3 (typing “tide pens” in the search box)",
            "Step #5 (scrolling the search results)",
            "Step #6 (opening one product from the search results)",
            "Step #10 (ticking the coupon box)"
          ],
          "correct_index": 2
        }
      ]
    }
  ],
  // END practice

  // Result submission endpoint. null = not configured -> submission is refused with an English error.
  // Expected success response: HTTP 2xx and a JSON body containing {"ok": true}. Anything else is treated as failure.
  // The client sends an Idempotency-Key header (= allocation token) but the server is responsible for authenticity of
  // the token, the permitted session set, duplicate handling, schema/size validation and CORS.
  // The endpoint is release/endpoint (Cloudflare Worker); its URL looks like
  // "https://aisas-result-endpoint.<subdomain>.workers.dev/v1/submissions". Keep null until deployed: a placeholder
  // string would count as configured.
  // Deployed 2026-10-05 by the requester (free plan; /v1/health ok; only https://sds-nlp.github.io is allowed by CORS).
  endpoint: { url: "https://aisas-result-endpoint.aisas-result-endpoint.workers.dev/v1/submissions", timeout_ms: 20000, max_retries: 2 },

  // Completion step, shown only after the endpoint confirmed receipt.
  // from_endpoint: true -> the code / URL comes from the endpoint's success response (Worker secret COMPLETION_URL, recommended,
  //   or COMPLETION_CODE, set with `npx wrangler secret put`), so it is never in this public file. Decided 2026-10-05 (answers_2.md R4).
  // To go back to the config-side code: set from_endpoint to false (or remove it) and put exactly one of url / code here,
  //   e.g. { from_endpoint: false, url: null, code: "C1A2B3C4" }. Anything in this file is public, so a participant could
  //   read that code without doing the task. Keep url / code null while from_endpoint is true
  //   (release/build_public.py refuses a config that has both).
  completion: { from_endpoint: true, url: null, code: null },

  // LOCAL EVALUATION mode (the researcher evaluating on their own machine, results kept in the browser and exported as JSON).
  // allow_file: true  -> opening participant.html from file:// switches to LOCAL mode automatically (no Prolific gates, no submission).
  //                      Irrelevant on a hosted https page (protocol is not file:). Tests set it to false to simulate a hosted page.
  // allow_local: false -> on http(s), ?local=1 is ignored unless this is explicitly true (never enable on the live Prolific deployment).
  local: { allow_file: true, allow_local: false },

  // Development preview. When allow_preview is true AND the page is opened with ?dev=1, the site shows a
  // "DEVELOPMENT PREVIEW" banner and lets the developer walk through the flow with preview_sessions.
  // It never fabricates a submission success or a completion code.
  dev: { allow_preview: false, preview_sessions: [] },
};
