# Task: AI Regulatory Intelligence API Routes

## Task ID: regulatory-intel-api

## Summary
Created two API route files for the AI Regulatory Intelligence module:

### FILE 1: `/src/app/api/regulatory-intel/analyze/route.ts`
- POST handler performing real LLM-powered gap analysis using z-ai-web-dev-sdk
- authGuard with roles: admin, mlro, compliance_officer, compliance_manager
- Zod schema validates either `circularId` or `circularText` (mutually exclusive, one required)
- Fetches circular from DB if circularId provided (404 if not found)
- Creates ad-hoc circular for raw text analysis
- Updates circular status to 'analyzing' before LLM call
- Strict system prompt for UAE AML/CFT compliance gap identification
- JSON response parsing with fallback for parse failures
- Creates GapAnalysis records for each identified gap
- Updates circular status to 'analyzed' on success, 'ingested' on LLM failure
- Audit log entry for both success and failure
- Error handling: 401 (unauthorized), 422 (validation), 404 (not found), 502 (LLM failure)

### FILE 2: `/src/app/api/regulatory-intel/approve/route.ts`
- POST handler for approving/rejecting gap analysis findings
- authGuard with senior roles only: admin, mlro, compliance_manager
- Zod schema validates gapAnalysisId, action (approve/reject), optional notes
- Verifies gap analysis exists (404) and is in draft/pending_approval status (422)
- On approve: updates gap analysis status to 'approved', sets approvedBy, updates circular to 'actioned', creates Policy record
- On reject: updates gap analysis status to 'rejected'
- Audit log entry for both outcomes
- Returns gap analysis and policy task in response

## Testing Results
- Lint: PASS (no errors)
- Validation tests: Both endpoints correctly return 422 for invalid input
- 404 tests: Analyze returns 404 for non-existent circularId; Approve returns 404 for non-existent gap analysis
- Note: Full LLM integration test was not completed due to environment memory constraints causing server crashes during z-ai-web-dev-sdk compilation
