# LNES-59.2 Holdout Stratification Plan (working doc, not part of the sealed holdout)

50 cases, H01-H50, fresh ID space VENDOR-9000+/PO-9000+/INV-95000+ (dev corpus
max was VENDOR-6066/PO-6062/INV-91004 -- zero collision risk). No document or
case here reuses development wording, entities, or predicates. **Ground truth
is hand-derived from the frozen architecture's documented rules, NOT by
running extract_case_state()/evaluate() -- that would violate the "do not run
the architecture while authoring" constraint.** Each case's construction note
records the hand-trace reasoning so the eventual Stage B autopsy can check it.

Coverage matrix (bucket -> case IDs), every bucket hit >=2 times:
1. ordinary factual state: H01, H02, H03, H45, H46
2. rumor vs authoritative fact: H04, H05, H47
3. temporal contradiction: H06, H07, H43, H44
4. supersession: H06, H08, H09, H38, H39
5. revocation: H10, H11, H44
6. reinstatement: H11, H40
7. future-effective state: H12, H13
8. authority limits: H14, H15, H16, H42, H50
9. wrong-role authority: H17, H18
10. wrong-vendor authority: H19, H20
11. wrong-purpose authority: H21, H22, H49
12. scope: H23, H24, H25, H26, H48
13. NO_MATCH: H23, H24, H25, H26, H33, H48
14. INCOMPLETE: H27, H28, H29, H32, H34
15. conflicting evidence: H09, H30, H31, H35, H37, H49, H50
16. hypothesis: H32, H33
17. recommendation: H34, H35
18. multi-source: H06, H09, H11, H31, H36, H37, H42
19. multi-hop: H38, H39, H40, H50

Ordinary/non-adversarial share: H01,H02,H03,H36,H45,H46 explicitly framed as
plain controls (>=12% of 50), matching "must contain ordinary controls."
