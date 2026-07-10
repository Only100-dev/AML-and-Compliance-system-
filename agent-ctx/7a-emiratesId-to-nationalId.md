# Task 7a: emiratesId → nationalId + nationalIdType Migration

## Summary
Updated all source code references from `IndividualKYC.emiratesId` to `IndividualKYC.nationalId` + `IndividualKYC.nationalIdType` across the entire `src/` directory.

## Files Modified (21 files)
1. `src/lib/validations/kyc.ts` — Schema: emiratesId → nationalId + nationalIdType enum
2. `src/app/api/kyc/individual/route.ts` — Create data: emiratesId → nationalId + nationalIdType + jurisdiction
3. `src/app/api/kyc/route.ts` — Update schema and POST data mapping
4. `src/lib/types.ts` — IndividualKYCItem interface
5. `src/lib/compliance/pii-hooks.ts` — MaskingStrategy + field rules
6. `src/lib/compliance/goaml-xml.ts` — Dynamic XML element based on nationalIdType
7. `src/app/api/goaml-xml/route.ts` — Schema + data mapping
8. `src/app/api/sanctions/route.ts` — identifiersSchema
9. `src/app/api/kyc-upload/route.ts` — Document type 'emirates_id' → 'national_id'
10. `src/app/api/test/pii-fixtures/route.ts` — Sentinel references
11. `src/lib/fiu/adapters/goaml-adapter.ts` — Data mapping + validation
12. `src/lib/goaml/xml-validator.ts` — Variable name + error message
13. `src/lib/integrations/identity-provider.ts` — idType 'emirates_id' → 'national_id'
14. `src/lib/help-data.ts` — Prisma model documentation
15. `src/hooks/use-pii.ts` — Added maskNationalId re-export
16. `src/lib/fiu/adapters/base-adapter.ts` — Added validateNationalId()
17. `src/lib/fiu/types.ts` — Added nationalIdType to SARPayload
18. `src/components/ic-os/kyc/IndividualKYCWizard.tsx` — Full UI migration + ID Type dropdown
19. `src/components/ic-os/shared/PIIRevealField.tsx` — Comment updated
20. `src/app/api/chat/scenarios/route.ts` — Added 'national id' keyword
21. `src/lib/pii.ts` — Doc example updated

## Intentionally Kept References
- `maskEmiratesId` function name — still handles UAE ID format masking
- `emiratesId` in PII field detection — backward compatibility
- `EMIRATES_ID` enum value — valid nationalIdType option
- `<EmiratesID>` XML tag — CBUAE goAML specification requirement
- `userInfo.emiratesId` — UAE Pass API external field

## Validation
- Lint: 0 FAILs
- Dev server: healthy, all routes 200
