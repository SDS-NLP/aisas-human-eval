# AISAS shopping-journey annotation (participant site)

This site is the task page of a research study run on Prolific. It shows recorded online-shopping sessions and lets
participants mark where the shopper's stage changes. It contains no model predictions.

## Data attribution
The browsing sessions and screenshots are derived from **OPeRA** (NEU-HAI/OPeRA,
https://huggingface.co/datasets/NEU-HAI/OPeRA), licensed under CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/).
Wang et al., "OPeRA: A Dataset of Observation, Persona, Rationale, and Action for Evaluating LLMs on Human Online
Shopping Behavior Simulation", arXiv:2506.05606, 2025.

Changes made: a subset of sessions was selected; only selected log fields are included; screenshots were downscaled
(longest side at most 1400 px) and re-encoded as JPEG. Where a shopper's name, delivery location or name-bearing list (e.g. a gift registry) was visible in a
screenshot, it was covered with a solid box. OPeRA's authors do not endorse this study.
